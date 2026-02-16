import { Component, signal, inject, OnInit, OnDestroy, AfterViewChecked, HostListener, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { Auth } from '@angular/fire/auth';
import { AuthService } from '../../services/auth.service';
import { BoardService, type PresenceUser } from '../../services/board.service';
import type { Table, Relationship, ConnectionSide } from '../../models/board.model';
import { faker } from '@faker-js/faker';

export type RelationshipType = '1:1' | '1:N' | 'M:N';

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './designer.component.html',
  styleUrl: './designer.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DesignerComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);
  private readonly boardService = inject(BoardService);

  boardId = signal<string | null>(null);
  boardName = signal('Schema');
  tables = signal<Table[]>([]);
  relationships = signal<Relationship[]>([]);
  selectedTableId = signal<string | null>(null);
  loading = signal(true);
  saving = signal(false);
  linkCopied = signal(false);
  connectedUsers = signal<PresenceUser[]>([]);
  zoomLevel = signal(1);
  panOffsetX = signal(10);
  panOffsetY = signal(10);
  readonly Math = Math;
  /** Point de connexion sélectionné pour créer une relation: { tableId, side } */
  connectingFrom = signal<{ tableId: string; side: ConnectionSide } | null>(null);
  /** Type de relation choisi lors de la création (1:1, 1:N, M:N) */
  connectingType = signal<RelationshipType>('1:N');
  /** Position de la souris pendant le drag (coords contenu) pour la ligne de prévisualisation */
  previewMousePos = signal<{ x: number; y: number } | null>(null);
  /** Relation sélectionnée pour éditer type et direction */
  selectedRelationshipId = signal<string | null>(null);
  /** Panneau Export ouvert */
  exportPanelOpen = signal(false);
  /** Générer des fausses données à l'export */
  exportWithFakeData = signal(false);
  /** Nombre de lignes par table (tableId -> count) */
  exportRowCounts = signal<Record<string, number>>({});

  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLElement>;
  @ViewChild('canvasTransform') canvasTransform?: ElementRef<HTMLElement>;

  /** Positions mesurées des points de connexion (tableId-side -> {x,y}) pour aligner les lignes */
  private connectionPointPositions = new Map<string, { x: number; y: number }>();

  private presenceCleanup: (() => void) | null = null;
  private lastMouseX = 400;
  private lastMouseY = 300;
  private readonly MAX_UNDO = 10;
  private undoStack: { name: string; tables: Table[]; relationships: Relationship[] }[] = [];
  private updateCursorPosition: ((x: number, y: number) => void) | null = null;
  private unsubscribePresence: (() => void) | null = null;
  private unsubscribeBoard: (() => void) | null = null;
  private initialLoadDone = false;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/boards']);
      return;
    }
    this.boardId.set(id);
    this.loadBoard(id);
  }

  private loadBoard(id: string, afterJoin = false) {
    this.unsubscribeBoard?.();
    this.unsubscribeBoard = this.boardService.subscribeToBoard(
      id,
      (board) => {
        if (board) {
          this.boardName.set(board.name);
          this.tables.set(board.tables ?? []);
          const tables = board.tables ?? [];
          const tableIds = new Set(tables.map((t: Table) => t.id));
          const validRels = (board.relationships ?? [])
            .filter((r: Relationship) => tableIds.has(r.fromTableId) && tableIds.has(r.toTableId))
            .map((r: Relationship) => ({
              ...r,
              type: (['1:1', '1:N', 'M:N'].includes(r.type) ? r.type : '1:N') as RelationshipType
            }));
          this.relationships.set(validRels);
          if (validRels.length !== (board.relationships ?? []).length) {
            setTimeout(() => this.scheduleAutoSave(), 0);
          }
          if (!this.initialLoadDone) {
            this.initialLoadDone = true;
            if (this.tables().length === 0) {
              this.addTable();
            }
            const user = this.auth.currentUser;
            if (user) {
              const presence = this.boardService.joinPresence(id, user);
              this.presenceCleanup = presence.leave;
              this.updateCursorPosition = presence.updateCursor;
              this.unsubscribePresence = this.boardService.getConnectedUsers(id, (users) =>
                this.connectedUsers.set(users)
              );
              this.connectedUsers.set([{
                userId: user.uid,
                displayName: user.displayName ?? undefined,
                photoURL: user.photoURL ?? undefined,
                email: user.email ?? undefined,
                lastSeen: new Date()
              }]);
            }
          }
        } else {
          this.router.navigate(['/boards']);
        }
        this.loading.set(false);
      },
      () => {
        if (!afterJoin) {
          this.boardService.joinBoard(id).subscribe({
            next: () => this.loadBoard(id, true),
            error: () => {
              this.router.navigate(['/boards']);
              this.loading.set(false);
            }
          });
        } else {
          this.router.navigate(['/boards']);
          this.loading.set(false);
        }
      }
    );
  }

  ngOnDestroy() {
    this.unsubscribeBoard?.();
    this.presenceCleanup?.();
    this.unsubscribePresence?.();
  }

  onCanvasMouseMove(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.lastMouseX = x;
    this.lastMouseY = y;
    this.updateCursorPosition?.(Math.round(x), Math.round(y));
    if (this.connectingFrom()) {
      this.updatePreviewMousePos(event.clientX, event.clientY);
    }
  }

  private updatePreviewMousePos(clientX: number, clientY: number) {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;
    const contentX = (viewportX - this.panOffsetX()) / this.zoomLevel();
    const contentY = (viewportY - this.panOffsetY()) / this.zoomLevel();
    this.previewMousePos.set({ x: contentX, y: contentY });
  }

  getRemoteCursors(): PresenceUser[] {
    const currentUid = this.auth.currentUser?.uid;
    return this.connectedUsers().filter(
      (u) => u.userId !== currentUid && u.cursorX != null && u.cursorY != null
    );
  }

  getUserCursorColor(userId: string): string {
    const colors = [
      '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6'
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getInitials(user: PresenceUser): string {
    if (user.displayName) {
      return user.displayName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    if (user.email) return user.email[0].toUpperCase();
    return user.userId.slice(0, 2).toUpperCase();
  }

  getHoverLabel(user: PresenceUser): string {
    if (user.email) {
      return user.displayName ? `${user.displayName} — ${user.email}` : user.email;
    }
    return user.displayName || 'Contributeur';
  }

  getUserColor(userId: string): string {
    const colors = [
      'bg-indigo-500',
      'bg-emerald-500',
      'bg-amber-500',
      'bg-rose-500',
      'bg-cyan-500',
      'bg-violet-500',
      'bg-orange-500',
      'bg-teal-500'
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getUserRingColor(userId: string): string {
    const colors = [
      'ring-indigo-500/60',
      'ring-emerald-500/60',
      'ring-amber-500/60',
      'ring-rose-500/60',
      'ring-cyan-500/60',
      'ring-violet-500/60',
      'ring-orange-500/60',
      'ring-teal-500/60'
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  get selectedTable() {
    return this.tables().find(t => t.id === this.selectedTableId());
  }

  get selectedRelationship() {
    return this.getValidRelationships().find(r => r.id === this.selectedRelationshipId());
  }

  getTableName(tableId: string): string {
    return this.tables().find(t => t.id === tableId)?.name ?? tableId;
  }

  onDragEnded(event: CdkDragEnd, table: Table) {
    this.pushState();
    const { x, y } = event.source.getFreeDragPosition();
    this.tables.update(tabs => tabs.map(t => {
      if (t.id === table.id) {
        return { ...t, x: t.x + x, y: t.y + y };
      }
      return t;
    }));
    event.source.reset();
    this.scheduleAutoSave();
  }

  addTable() {
    this.pushState();
    const newId = `table-${Date.now()}`;
    const newTable: Table = {
      id: newId,
      name: 'NewTable',
      x: 300,
      y: 300,
      icon: 'solar:widget-add-linear',
      fields: [{ id: `f-${Date.now()}`, name: 'id', type: 'UUID', isPrimary: true }]
    };
    this.tables.update(tabs => [...tabs, newTable]);
    this.selectedTableId.set(newId);
    this.scheduleAutoSave();
  }

  selectTable(id: string) {
    this.selectedTableId.set(id);
    this.selectedRelationshipId.set(null);
  }

  addField(tableId: string) {
    this.pushState();
    this.tables.update(tabs => tabs.map(t => {
      if (t.id === tableId) {
        return {
          ...t,
          fields: [...t.fields, { id: `f-${Date.now()}`, name: 'new_field', type: 'String' }]
        };
      }
      return t;
    }));
    this.scheduleAutoSave();
  }

  removeTable(id: string) {
    this.pushState();
    const selRel = this.selectedRelationship;
    const shouldClearRel = selRel && (selRel.fromTableId === id || selRel.toTableId === id);
    this.tables.update(tabs => tabs.filter(t => t.id !== id));
    this.relationships.update(rels =>
      rels.filter(r => r.fromTableId !== id && r.toTableId !== id)
    );
    if (this.selectedTableId() === id) {
      this.selectedTableId.set(null);
    }
    if (shouldClearRel) {
      this.selectedRelationshipId.set(null);
    }
    this.scheduleAutoSave();
  }

  setExportRowCount(tableId: string, count: number) {
    this.exportRowCounts.update(m => ({ ...m, [tableId]: Math.max(0, count) }));
  }

  getExportRowCount(tableId: string): number {
    return this.exportRowCounts()[tableId] ?? 10;
  }

  exportSql() {
    let sql = '';
    const withData = this.exportWithFakeData();
    const rowCounts = this.exportRowCounts();

    this.tables().forEach(table => {
      sql += `-- Table: ${table.name}\n`;
      sql += `CREATE TABLE ${table.name.toLowerCase()} (\n`;
      const fields = table.fields.map(f => {
        let type = f.type === 'UUID' ? 'UUID' : f.type === 'String' ? 'VARCHAR(255)' : f.type === 'Money' ? 'DECIMAL(10,2)' : 'TEXT';
        return `  ${f.name.toLowerCase()} ${type}${f.isPrimary ? ' PRIMARY KEY' : ''}`;
      });
      sql += fields.join(',\n');
      sql += '\n);\n\n';

      if (withData) {
        const n = rowCounts[table.id] ?? 10;
        const cols = table.fields.filter(f => f.type !== 'Relation').map(f => f.name.toLowerCase());
        if (cols.length > 0 && n > 0) {
          for (let i = 0; i < n; i++) {
            const vals = table.fields
              .filter(f => f.type !== 'Relation')
              .map(f => this.formatSqlValue(this.generateFakeValue(f)));
            sql += `INSERT INTO ${table.name.toLowerCase()} (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`;
          }
          sql += '\n';
        }
      }
    });
    this.downloadFile(sql, 'schema.sql');
  }

  exportJson() {
    const withData = this.exportWithFakeData();
    const rowCounts = this.exportRowCounts();
    const payload: { tables: Table[]; relationships: Relationship[]; data?: Record<string, unknown[]> } = {
      tables: this.tables(),
      relationships: this.relationships()
    };
    if (withData) {
      payload.data = {};
      this.tables().forEach(table => {
        const n = rowCounts[table.id] ?? 10;
        payload.data![table.name] = [];
        for (let i = 0; i < n; i++) {
          const row: Record<string, unknown> = {};
          table.fields.filter(f => f.type !== 'Relation').forEach(f => {
            row[f.name] = this.generateFakeValue(f);
          });
          payload.data![table.name].push(row);
        }
      });
    }
    this.downloadFile(JSON.stringify(payload, null, 2), 'schema.json');
  }

  private generateFakeValue(field: { type: string; faker?: string; name: string }): unknown {
    const hint = (field.faker || field.type || '').toLowerCase();

    if (field.type === 'UUID') return faker.string.uuid();
    if (field.type === 'Money') return parseFloat(faker.commerce.price({ min: 0, max: 10000 }));

    if (field.type === 'String' || field.type === 'Enum') {
      if (hint.includes('email')) return faker.internet.email();
      if (hint.includes('name') && hint.includes('person')) return faker.person.fullName();
      if (hint.includes('name') || hint.includes('first')) return faker.person.firstName();
      if (hint.includes('last')) return faker.person.lastName();
      if (hint.includes('phone')) return faker.phone.number();
      if (hint.includes('address') || hint.includes('street')) return faker.location.streetAddress();
      if (hint.includes('city')) return faker.location.city();
      if (hint.includes('country')) return faker.location.country();
      if (hint.includes('company') || hint.includes('commerce')) return faker.commerce.productName();
      if (hint.includes('lorem') || hint.includes('text')) return faker.lorem.sentence();
      if (hint.includes('string') && hint.includes('8')) return faker.string.alphanumeric(8);
      if (hint.includes('string')) return faker.string.alphanumeric(12);
      return faker.lorem.word();
    }
    return faker.string.alphanumeric(10);
  }

  private formatSqlValue(v: unknown): string {
    if (typeof v === 'number') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  }

  private readonly TABLE_WIDTH = 256;
  private readonly TABLE_HEADER_HEIGHT = 48;
  private readonly TABLE_ROW_HEIGHT = 40;

  getValidRelationships(): Relationship[] {
    const tabs = this.tables();
    const tableIds = new Set(tabs.map(t => t.id));
    return this.relationships().filter(
      r => tableIds.has(r.fromTableId) && tableIds.has(r.toTableId)
    );
  }

  getTableCenter(tableId: string) {
    const table = this.tables().find(t => t.id === tableId);
    if (!table) return { x: 0, y: 0 };
    const h = this.getTableHeight(table);
    return { x: table.x + this.TABLE_WIDTH / 2, y: table.y + h / 2 };
  }

  getTableHeight(table: Table): number {
    return this.TABLE_HEADER_HEIGHT + this.TABLE_ROW_HEIGHT * (table.fields.length + 1);
  }

  getConnectionPoint(tableId: string, side: ConnectionSide): { x: number; y: number } {
    const key = `${tableId}-${side}`;
    const measured = this.connectionPointPositions.get(key);
    if (measured) return measured;
    // Fallback: calcul géométrique si pas encore mesuré
    const table = this.tables().find(t => t.id === tableId);
    if (!table) return { x: 0, y: 0 };
    const w = this.TABLE_WIDTH;
    const h = this.getTableHeight(table);
    const cx = table.x + w / 2;
    const cy = table.y + h / 2;
    switch (side) {
      case 'top': return { x: cx, y: table.y };
      case 'right': return { x: table.x + w, y: cy };
      case 'bottom': return { x: cx, y: table.y + h };
      case 'left': return { x: table.x, y: cy };
      default: return { x: cx, y: cy };
    }
  }

  ngAfterViewChecked() {
    this.measureConnectionPoints();
  }

  private measureConnectionPoints() {
    if (this.loading()) return;
    const canvas = this.canvasRef?.nativeElement;
    const container = this.canvasTransform?.nativeElement;
    if (!canvas || !container) return;
    const canvasRect = canvas.getBoundingClientRect();
    const panX = this.panOffsetX();
    const panY = this.panOffsetY();
    const zoom = this.zoomLevel();
    const points = container.querySelectorAll<HTMLElement>('[data-connection-point]');
    points.forEach((el) => {
      const tableId = el.dataset['tableId'];
      const side = el.dataset['side'] as ConnectionSide | undefined;
      if (!tableId || !side) return;
      const rect = el.getBoundingClientRect();
      const x = (rect.left + rect.width / 2 - canvasRect.left - panX) / zoom;
      const y = (rect.top + rect.height / 2 - canvasRect.top - panY) / zoom;
      const key = `${tableId}-${side}`;
      this.connectionPointPositions.set(key, { x, y });
    });
  }

  onConnectionPointMouseDown(tableId: string, side: ConnectionSide, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const from = this.connectingFrom();
    if (!from) {
      this.connectingFrom.set({ tableId, side });
      this.updatePreviewMousePos(event.clientX, event.clientY);
      return;
    }
    if (from.tableId === tableId && from.side === side) {
      this.connectingFrom.set(null);
      this.previewMousePos.set(null);
      return;
    }
    this.addRelationship(from.tableId, from.side, tableId, side);
    this.connectingFrom.set(null);
    this.previewMousePos.set(null);
  }

  onConnectionPointClick(tableId: string, side: ConnectionSide, event: Event) {
    event.stopPropagation();
    const from = this.connectingFrom();
    if (!from) {
      this.connectingFrom.set({ tableId, side });
      return;
    }
    if (from.tableId === tableId && from.side === side) {
      this.connectingFrom.set(null);
      this.previewMousePos.set(null);
      return;
    }
    this.addRelationship(from.tableId, from.side, tableId, side);
    this.connectingFrom.set(null);
    this.previewMousePos.set(null);
  }

  onDocumentMouseMove(event: MouseEvent) {
    if (this.connectingFrom()) {
      this.updatePreviewMousePos(event.clientX, event.clientY);
    }
  }

  onDocumentMouseUp(event: MouseEvent) {
    const from = this.connectingFrom();
    if (!from) return;
    const target = event.target as HTMLElement;
    const connPoint = target?.closest?.('[data-connection-point]') as HTMLElement | null;
    if (connPoint) {
      const toTableId = connPoint.dataset['tableId'];
      const toSide = connPoint.dataset['side'] as ConnectionSide | undefined;
      if (toTableId && toSide && (from.tableId !== toTableId || from.side !== toSide)) {
        this.addRelationship(from.tableId, from.side, toTableId, toSide);
      }
    }
    this.connectingFrom.set(null);
    this.previewMousePos.set(null);
  }

  getPreviewPath(): string | null {
    const from = this.connectingFrom();
    const to = this.previewMousePos();
    if (!from || !to) return null;
    const start = this.getConnectionPoint(from.tableId, from.side);
    const offset = 40;
    const c1x = start.x + (start.x < to.x ? offset : -offset);
    const c1y = start.y;
    const c2x = to.x + (to.x < start.x ? offset : -offset);
    const c2y = to.y;
    return `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
  }

  getRelationshipPath(rel: Relationship): string {
    const from = rel.fromSide && rel.toSide
      ? this.getConnectionPoint(rel.fromTableId, rel.fromSide)
      : this.getTableCenter(rel.fromTableId);
    const to = rel.fromSide && rel.toSide
      ? this.getConnectionPoint(rel.toTableId, rel.toSide)
      : this.getTableCenter(rel.toTableId);
    const offset = 60;
    let c1x = from.x, c1y = from.y, c2x = to.x, c2y = to.y;
    if (rel.fromSide) {
      switch (rel.fromSide) {
        case 'top': c1y = from.y - offset; break;
        case 'right': c1x = from.x + offset; break;
        case 'bottom': c1y = from.y + offset; break;
        case 'left': c1x = from.x - offset; break;
      }
    } else {
      c1x = from.x + (from.x < to.x ? offset : -offset);
    }
    if (rel.toSide) {
      switch (rel.toSide) {
        case 'top': c2y = to.y - offset; break;
        case 'right': c2x = to.x + offset; break;
        case 'bottom': c2y = to.y + offset; break;
        case 'left': c2x = to.x - offset; break;
      }
    } else {
      c2x = to.x + (to.x < from.x ? offset : -offset);
    }
    return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
  }

  /** Point milieu de la courbe de Bézier (t=0.5) pour placer le badge de relation */
  getRelationshipMidpoint(rel: Relationship): { x: number; y: number } {
    const from = rel.fromSide && rel.toSide
      ? this.getConnectionPoint(rel.fromTableId, rel.fromSide)
      : this.getTableCenter(rel.fromTableId);
    const to = rel.fromSide && rel.toSide
      ? this.getConnectionPoint(rel.toTableId, rel.toSide)
      : this.getTableCenter(rel.toTableId);
    const offset = 60;
    let c1x = from.x, c1y = from.y, c2x = to.x, c2y = to.y;
    if (rel.fromSide) {
      switch (rel.fromSide) {
        case 'top': c1y = from.y - offset; break;
        case 'right': c1x = from.x + offset; break;
        case 'bottom': c1y = from.y + offset; break;
        case 'left': c1x = from.x - offset; break;
      }
    } else {
      c1x = from.x + (from.x < to.x ? offset : -offset);
    }
    if (rel.toSide) {
      switch (rel.toSide) {
        case 'top': c2y = to.y - offset; break;
        case 'right': c2x = to.x + offset; break;
        case 'bottom': c2y = to.y + offset; break;
        case 'left': c2x = to.x - offset; break;
      }
    } else {
      c2x = to.x + (to.x < from.x ? offset : -offset);
    }
    const t = 0.5;
    const mt = 1 - t;
    const x = mt * mt * mt * from.x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * to.x;
    const y = mt * mt * mt * from.y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * to.y;
    return { x, y };
  }

  getRelationshipTypeLabel(type: RelationshipType): string {
    switch (type) {
      case '1:1': return '1 : 1';
      case '1:N': return '1 : N';
      case 'M:N': return 'M : N';
      default: return type;
    }
  }

  addRelationship(fromTableId: string, fromSide: ConnectionSide, toTableId: string, toSide: ConnectionSide, type?: RelationshipType) {
    this.pushState();
    const rel: Relationship = {
      id: `rel-${Date.now()}`,
      fromTableId,
      toTableId,
      fromSide,
      toSide,
      type: type ?? this.connectingType()
    };
    this.relationships.update(rels => [...rels, rel]);
    this.scheduleAutoSave();
  }

  updateRelationshipType(relId: string, type: RelationshipType) {
    this.pushState();
    this.relationships.update(rels =>
      rels.map(r => r.id === relId ? { ...r, type } : r)
    );
    this.scheduleAutoSave();
  }

  reverseRelationshipDirection(relId: string) {
    this.pushState();
    this.relationships.update(rels =>
      rels.map(r => {
        if (r.id !== relId) return r;
        return {
          ...r,
          fromTableId: r.toTableId,
          toTableId: r.fromTableId,
          fromSide: r.toSide,
          toSide: r.fromSide
        };
      })
    );
    this.scheduleAutoSave();
  }

  removeRelationship(relId: string) {
    this.pushState();
    this.relationships.update(rels => rels.filter(r => r.id !== relId));
    if (this.selectedRelationshipId() === relId) {
      this.selectedRelationshipId.set(null);
    }
    this.scheduleAutoSave();
  }

  selectRelationship(relId: string, event: Event) {
    event.stopPropagation();
    this.selectedTableId.set(null);
    this.selectedRelationshipId.set(relId);
  }

  cancelConnecting() {
    this.connectingFrom.set(null);
    this.previewMousePos.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.cancelConnecting();
  }

  @HostListener('document:keydown.control.z', ['$event'])
  @HostListener('document:keydown.meta.z', ['$event'])
  onUndo(event: Event) {
    event.preventDefault();
    this.undo();
  }

  pushState() {
    if (this.loading()) return;
    const snapshot = {
      name: this.boardName(),
      tables: JSON.parse(JSON.stringify(this.tables())),
      relationships: JSON.parse(JSON.stringify(this.relationships()))
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.MAX_UNDO) {
      this.undoStack.shift();
    }
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.boardName.set(prev.name);
    this.tables.set(prev.tables);
    this.relationships.set(prev.relationships);
    this.scheduleAutoSave();
  }

  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(event: MouseEvent) {
    this.onDocumentMouseMove(event);
  }

  @HostListener('document:mouseup', ['$event'])
  onDocMouseUp(event: MouseEvent) {
    this.onDocumentMouseUp(event);
  }

  goToBoards() {
    this.router.navigate(['/boards']);
  }

  zoomIn() {
    this.zoomAtMouse(Math.min(this.zoomLevel() + 0.25, 2));
  }

  zoomOut() {
    this.zoomAtMouse(Math.max(this.zoomLevel() - 0.25, 0.5));
  }

  setZoomFromSlider(value: string) {
    const v = parseInt(value, 10);
    if (!isNaN(v)) this.zoomAtMouse(Math.max(0.5, Math.min(2, v / 100)));
  }

  onCanvasWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const rect = target?.getBoundingClientRect();
    const mouseX = rect ? event.clientX - rect.left : this.lastMouseX;
    const mouseY = rect ? event.clientY - rect.top : this.lastMouseY;
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    this.zoomAtMouse(Math.max(0.5, Math.min(2, this.zoomLevel() + delta)), mouseX, mouseY);
  }

  private zoomAtMouse(newZoom: number, mouseX?: number, mouseY?: number) {
    const mx = mouseX ?? this.lastMouseX;
    const my = mouseY ?? this.lastMouseY;
    const oldZoom = this.zoomLevel();
    const panX = this.panOffsetX();
    const panY = this.panOffsetY();
    const newPanX = mx - (mx - panX) * newZoom / oldZoom;
    const newPanY = my - (my - panY) * newZoom / oldZoom;
    this.zoomLevel.set(newZoom);
    this.panOffsetX.set(newPanX);
    this.panOffsetY.set(newPanY);
  }

  copyBoardLink() {
    const id = this.boardId();
    if (!id) return;
    const url = `${window.location.origin}/designer/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  scheduleAutoSave() {
    if (this.loading()) return;
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      this.save();
      this._saveTimeout = null;
    }, 500);
  }

  private _saveTimeout: ReturnType<typeof setTimeout> | null = null;

  private save() {
    const id = this.boardId();
    if (!id) return;
    this.saving.set(true);
    this.boardService.updateBoard(id, {
      name: this.boardName(),
      tables: this.tables(),
      relationships: this.relationships()
    }).subscribe({
      next: () => this.saving.set(false),
      error: () => this.saving.set(false)
    });
  }

  logout() {
    this.authService.logout().subscribe();
  }

  private downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}
