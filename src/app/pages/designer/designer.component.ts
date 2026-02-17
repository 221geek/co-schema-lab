import { Component, signal, inject, OnInit, OnDestroy, AfterViewChecked, HostListener, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { Auth } from '@angular/fire/auth';
import { AuthService } from '../../services/auth.service';
import { BoardService, type PresenceUser } from '../../services/board.service';
import type { Table, Relationship, ConnectionSide, Field, EnumDef } from '../../models/board.model';
import { faker } from '@faker-js/faker';

export type RelationshipType = '1:1' | '1:N' | 'M:N';

const SCHEMA_TEMPLATES: { name: string; desc: string; tables: Omit<Table, 'id'>[]; relationships: { fromIdx: number; toIdx: number; type: RelationshipType }[] }[] = [
  {
    name: 'Auth',
    desc: 'Utilisateurs, sessions, rôles',
    tables: [
      { name: 'User', x: 80, y: 80, icon: 'solar:user-linear', fields: [{ id: 'f1', name: 'id', type: 'string', isPrimary: true }, { id: 'f2', name: 'email', type: 'string' }, { id: 'f3', name: 'passwordHash', type: 'string' }] },
      { name: 'Session', x: 400, y: 80, icon: 'solar:key-linear', fields: [{ id: 'f4', name: 'id', type: 'string', isPrimary: true }, { id: 'f5', name: 'userId', type: 'string' }, { id: 'f6', name: 'expiresAt', type: 'timestamp' }] },
      { name: 'Role', x: 400, y: 280, icon: 'solar:user-id-linear', fields: [{ id: 'f7', name: 'id', type: 'string', isPrimary: true }, { id: 'f8', name: 'name', type: 'string' }] }
    ],
    relationships: [{ fromIdx: 0, toIdx: 1, type: '1:N' }, { fromIdx: 0, toIdx: 2, type: 'M:N' }]
  },
  {
    name: 'E-commerce',
    desc: 'Produits, commandes, clients',
    tables: [
      { name: 'Product', x: 80, y: 80, icon: 'solar:box-linear', fields: [{ id: 'f1', name: 'id', type: 'string', isPrimary: true }, { id: 'f2', name: 'name', type: 'string' }, { id: 'f3', name: 'price', type: 'number' }] },
      { name: 'Customer', x: 80, y: 280, icon: 'solar:user-linear', fields: [{ id: 'f4', name: 'id', type: 'string', isPrimary: true }, { id: 'f5', name: 'email', type: 'string' }, { id: 'f6', name: 'name', type: 'string' }] },
      { name: 'Order', x: 400, y: 180, icon: 'solar:cart-linear', fields: [{ id: 'f7', name: 'id', type: 'string', isPrimary: true }, { id: 'f8', name: 'customerId', type: 'string' }, { id: 'f9', name: 'total', type: 'number' }] },
      { name: 'OrderItem', x: 720, y: 180, icon: 'solar:document-linear', fields: [{ id: 'f10', name: 'id', type: 'string', isPrimary: true }, { id: 'f11', name: 'orderId', type: 'string' }, { id: 'f12', name: 'productId', type: 'string' }, { id: 'f13', name: 'quantity', type: 'integer' }] }
    ],
    relationships: [{ fromIdx: 1, toIdx: 2, type: '1:N' }, { fromIdx: 2, toIdx: 3, type: '1:N' }, { fromIdx: 0, toIdx: 3, type: '1:N' }]
  },
  {
    name: 'Blog',
    desc: 'Articles, commentaires, catégories',
    tables: [
      { name: 'User', x: 80, y: 80, icon: 'solar:user-linear', fields: [{ id: 'f1', name: 'id', type: 'string', isPrimary: true }, { id: 'f2', name: 'email', type: 'string' }, { id: 'f3', name: 'name', type: 'string' }] },
      { name: 'Post', x: 400, y: 80, icon: 'solar:document-linear', fields: [{ id: 'f4', name: 'id', type: 'string', isPrimary: true }, { id: 'f5', name: 'authorId', type: 'string' }, { id: 'f6', name: 'title', type: 'string' }, { id: 'f7', name: 'content', type: 'text' }] },
      { name: 'Comment', x: 720, y: 80, icon: 'solar:chat-linear', fields: [{ id: 'f8', name: 'id', type: 'string', isPrimary: true }, { id: 'f9', name: 'postId', type: 'string' }, { id: 'f10', name: 'authorId', type: 'string' }, { id: 'f11', name: 'content', type: 'text' }] },
      { name: 'Category', x: 720, y: 280, icon: 'solar:tag-linear', fields: [{ id: 'f12', name: 'id', type: 'string', isPrimary: true }, { id: 'f13', name: 'name', type: 'string' }] }
    ],
    relationships: [{ fromIdx: 0, toIdx: 1, type: '1:N' }, { fromIdx: 1, toIdx: 2, type: '1:N' }, { fromIdx: 0, toIdx: 2, type: '1:N' }, { fromIdx: 1, toIdx: 3, type: 'M:N' }]
  }
];

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
  enums = signal<{ name: string; values: string[] }[]>([]);
  selectedTableId = signal<string | null>(null);
  /** Tables sélectionnées (multi-select + marquee) */
  selectedTableIds = signal<Set<string>>(new Set());
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
  /** Panneau Import SQL ouvert */
  importPanelOpen = signal(false);
  /** Erreur d'import SQL */
  importError = signal<string | null>(null);
  /** Contenu SQL pour l'import (textarea + drop) */
  importSqlContent = signal('');
  /** Zone de drop en cours de survol */
  importDropActive = signal(false);
  /** Mode d'import : 'sql' | 'json' */
  importMode = signal<'sql' | 'json'>('sql');
  /** Panneau templates ouvert */
  templatesPanelOpen = signal(false);
  /** Contenu JSON pour l'import */
  importJsonContent = signal('');
  /** Générer des fausses données à l'export */
  exportWithFakeData = signal(false);
  /** Nombre de lignes par table (tableId -> count) */
  exportRowCounts = signal<Record<string, number>>({});
  /** Tables repliées (affichent moins de propriétés) */
  foldedTableIds = signal<Set<string>>(new Set());
  /** Table copiée pour Ctrl+V */
  copiedTable = signal<Omit<Table, 'id'> | null>(null);
  /** Recherche de tables */
  tableSearchQuery = signal('');
  @ViewChild('tableSearchInput') tableSearchInput?: ElementRef<HTMLInputElement>;
  /** Panneau validation ouvert */
  validationPanelOpen = signal(false);
  /** Édition du nom du board en cours */
  editingBoardName = signal(false);

  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLElement>;
  @ViewChild('canvasTransform') canvasTransform?: ElementRef<HTMLElement>;

  /** Positions mesurées des points de connexion (tableId-side -> {x,y}) pour aligner les lignes */
  private connectionPointPositions = new Map<string, { x: number; y: number }>();

  private presenceCleanup: (() => void) | null = null;
  private lastMouseX = 400;
  private lastMouseY = 300;
  /** Pan du canvas (Espace+glisser ou clic molette) */
  isPanning = false;
  panStart: { clientX: number; clientY: number; panX: number; panY: number } | null = null;
  spacePressed = false;
  /** Sélection par cadre : { startX, startY } en coords contenu */
  selectionBoxStart = signal<{ x: number; y: number } | null>(null);
  selectionBoxCurrent = signal<{ x: number; y: number } | null>(null);
  selectionBoxJustCompleted = false;
  private readonly MAX_UNDO = 10;
  private undoStack: { name: string; tables: Table[]; relationships: Relationship[]; enums: { name: string; values: string[] }[] }[] = [];
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
          const boardEnums = board.enums ?? [];
          const normalizedTables = (board.tables ?? []).map((t: Table) => ({
            ...t,
            fields: (t.fields ?? []).map((f: Field) => this.migrateField(f, boardEnums))
          }));
          this.tables.set(normalizedTables);
          const migratedEnums = this.migrateEnumsFromFields(normalizedTables, boardEnums);
          this.enums.set(migratedEnums);
          const tables = normalizedTables;
          this.foldedTableIds.set(new Set(tables.filter(t => (t.fields?.length ?? 0) > this.FOLD_THRESHOLD).map(t => t.id)));
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
          setTimeout(() => this.ensureForeignKeysForRelationships(), 0);
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

  onCanvasMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('[data-table-card]') || target.closest('[data-relationship-badge]') || target.closest('[data-connection-point]')) return;
    if (this.connectingFrom()) return;
    const canPan = event.button === 1 || (event.button === 0 && this.spacePressed);
    if (canPan) {
      event.preventDefault();
      this.isPanning = true;
      this.panStart = { clientX: event.clientX, clientY: event.clientY, panX: this.panOffsetX(), panY: this.panOffsetY() };
    } else if (event.button === 0 && !this.spacePressed) {
      const pt = this.clientToContent(event.clientX, event.clientY);
      this.selectionBoxStart.set(pt);
      this.selectionBoxCurrent.set(pt);
    }
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
    if (this.selectionBoxStart()) {
      this.selectionBoxCurrent.set(this.clientToContent(event.clientX, event.clientY));
    }
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
    const id = this.selectedTableId();
    return id ? this.tables().find(t => t.id === id) : null;
  }

  get selectedRelationship() {
    return this.getValidRelationships().find(r => r.id === this.selectedRelationshipId());
  }

  getTableName(tableId: string): string {
    return this.tables().find(t => t.id === tableId)?.name ?? tableId;
  }

  tableMatchesSearch(table: Table): boolean {
    const q = this.tableSearchQuery().toLowerCase().trim();
    if (!q) return true;
    return table.name.toLowerCase().includes(q);
  }

  focusTableSearch() {
    setTimeout(() => this.tableSearchInput?.nativeElement?.focus(), 0);
  }

  focusSelectedTable() {
    const tableId = this.selectedTableId();
    if (!tableId) return;
    const table = this.tables().find(t => t.id === tableId);
    if (!table) return;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const zoom = this.zoomLevel();
    const centerX = table.x + this.TABLE_WIDTH / 2;
    const centerY = table.y + this.getTableHeight(table) / 2;
    this.panOffsetX.set(canvas.clientWidth / 2 - centerX * zoom);
    this.panOffsetY.set(canvas.clientHeight / 2 - centerY * zoom);
  }

  /** Données pour la mini-carte */
  getMinimapData(): { tables: { x: number; y: number; w: number; h: number }[]; viewport: { x: number; y: number; w: number; h: number }; scale: number; offsetX: number; offsetY: number } {
    const tables = this.tables();
    const TABLE_W = this.TABLE_WIDTH;
    if (tables.length === 0) return { tables: [], viewport: { x: 0, y: 0, w: 100, h: 80 }, scale: 0.1, offsetX: 0, offsetY: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    tables.forEach(t => {
      const h = this.getTableHeight(t);
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + TABLE_W);
      maxY = Math.max(maxY, t.y + h);
    });
    const padding = 40;
    const contentW = Math.max(maxX - minX + padding * 2, 200);
    const contentH = Math.max(maxY - minY + padding * 2, 150);
    const mapW = 120;
    const mapH = 80;
    const scale = Math.min(mapW / contentW, mapH / contentH);
    const offsetX = -minX + padding;
    const offsetY = -minY + padding;
    const viewportLeft = -this.panOffsetX() / this.zoomLevel();
    const viewportTop = -this.panOffsetY() / this.zoomLevel();
    const canvas = this.canvasRef?.nativeElement;
    const vpW = canvas ? canvas.clientWidth / this.zoomLevel() : 400;
    const vpH = canvas ? canvas.clientHeight / this.zoomLevel() : 300;
    return {
      tables: tables.map(t => ({
        x: (t.x + offsetX) * scale,
        y: (t.y + offsetY) * scale,
        w: TABLE_W * scale,
        h: this.getTableHeight(t) * scale
      })),
      viewport: {
        x: (viewportLeft + offsetX) * scale,
        y: (viewportTop + offsetY) * scale,
        w: Math.min(vpW * scale, mapW),
        h: Math.min(vpH * scale, mapH)
      },
      scale,
      offsetX,
      offsetY
    };
  }

  readonly SCHEMA_TEMPLATES = SCHEMA_TEMPLATES;

  applyTemplate(template: typeof SCHEMA_TEMPLATES[0]) {
    this.pushState();
    const ts = Date.now();
    const newTables: Table[] = template.tables.map((t, i) => ({
      id: `table-${ts}-${i}`,
      name: t.name,
      x: t.x,
      y: t.y,
      icon: t.icon,
      fields: t.fields.map((f, j) => ({ ...f, id: `f-${ts}-${i}-${j}` }))
    }));
    const idByIdx = new Map<number, string>();
    newTables.forEach((t, i) => idByIdx.set(i, t.id));
    const newRels: Relationship[] = template.relationships.map((r, i) => ({
      id: `rel-${ts}-${i}`,
      fromTableId: idByIdx.get(r.fromIdx)!,
      toTableId: idByIdx.get(r.toIdx)!,
      fromSide: 'right' as ConnectionSide,
      toSide: 'left' as ConnectionSide,
      type: r.type
    }));
    this.tables.set(newTables);
    this.relationships.set(newRels);
    newRels.forEach(rel => this.addForeignKeyField(rel));
    this.foldedTableIds.set(new Set(newTables.filter(t => (t.fields?.length ?? 0) > this.FOLD_THRESHOLD).map(t => t.id)));
    this.templatesPanelOpen.set(false);
    this.autoLayout();
    this.scheduleAutoSave();
  }

  autoLayout() {
    this.pushState();
    const tables = this.tables();
    const rels = this.getValidRelationships();
    if (tables.length === 0) return;
    const TABLE_W = this.TABLE_WIDTH;
    const TABLE_H = 200;
    const GAP_X = 60;
    const GAP_Y = 40;
    const tableIds = new Set(tables.map(t => t.id));
    const children = new Map<string, string[]>();
    const parents = new Map<string, string[]>();
    rels.forEach(r => {
      if (!tableIds.has(r.fromTableId) || !tableIds.has(r.toTableId)) return;
      if (!children.has(r.fromTableId)) children.set(r.fromTableId, []);
      children.get(r.fromTableId)!.push(r.toTableId);
      if (!parents.has(r.toTableId)) parents.set(r.toTableId, []);
      parents.get(r.toTableId)!.push(r.fromTableId);
    });
    const levels = new Map<string, number>();
    const roots = tables.filter(t => !parents.has(t.id) || parents.get(t.id)!.length === 0).map(t => t.id);
    if (roots.length === 0) roots.push(tables[0].id);
    const queue = roots.map(id => ({ id, level: 0 }));
    const visited = new Set<string>();
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item || visited.has(item.id)) continue;
      visited.add(item.id);
      levels.set(item.id, item.level);
      (children.get(item.id) ?? []).forEach(cid => queue.push({ id: cid, level: item.level + 1 }));
    }
    tables.forEach(t => { if (!levels.has(t.id)) levels.set(t.id, 0); });
    const byLevel = new Map<number, string[]>();
    tables.forEach(t => {
      const l = levels.get(t.id)!;
      if (!byLevel.has(l)) byLevel.set(l, []);
      byLevel.get(l)!.push(t.id);
    });
    const maxLevel = Math.max(...byLevel.keys());
    let y = 40;
    const positions = new Map<string, { x: number; y: number }>();
    for (let l = 0; l <= maxLevel; l++) {
      const ids = byLevel.get(l) ?? [];
      let x = 40;
      ids.forEach(id => {
        positions.set(id, { x, y });
        x += TABLE_W + GAP_X;
      });
      y += TABLE_H + GAP_Y;
    }
    this.tables.update(tabs => tabs.map(t => {
      const pos = positions.get(t.id) ?? { x: t.x, y: t.y };
      return { ...t, x: pos.x, y: pos.y };
    }));
    this.scheduleAutoSave();
  }

  onMinimapClick(event: MouseEvent) {
    const el = event.currentTarget as SVGSVGElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const md = this.getMinimapData();
    const contentX = mx / md.scale - md.offsetX;
    const contentY = my / md.scale - md.offsetY;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const centerX = contentX - canvas.clientWidth / 2 / this.zoomLevel();
    const centerY = contentY - canvas.clientHeight / 2 / this.zoomLevel();
    this.panOffsetX.set(-centerX * this.zoomLevel());
    this.panOffsetY.set(-centerY * this.zoomLevel());
  }

  getValidationWarnings(): { type: string; message: string; tableId?: string; tableName?: string }[] {
    const warnings: { type: string; message: string; tableId?: string; tableName?: string }[] = [];
    const tables = this.tables();
    const rels = this.relationships();
    const tableIds = new Set(tables.map(t => t.id));
    const connectedTableIds = new Set<string>();
    rels.forEach(r => {
      connectedTableIds.add(r.fromTableId);
      connectedTableIds.add(r.toTableId);
    });
    tables.forEach(t => {
      if (!connectedTableIds.has(t.id) && tables.length > 1) {
        warnings.push({ type: 'orphan', message: 'Table sans relation', tableId: t.id, tableName: t.name });
      }
    });
    const names = new Map<string, string[]>();
    tables.forEach(t => {
      const n = t.name.trim().toLowerCase();
      if (!names.has(n)) names.set(n, []);
      names.get(n)!.push(t.id);
    });
    names.forEach((ids, n) => {
      if (ids.length > 1) {
        ids.forEach(id => {
          const t = tables.find(x => x.id === id);
          if (t) warnings.push({ type: 'duplicate', message: `Nom en doublon : "${t.name}"`, tableId: id, tableName: t.name });
        });
      }
    });
    const tablesWithoutPrimary = tables.filter(t => !(t.fields || []).some(f => f.isPrimary));
    tablesWithoutPrimary.forEach(t => {
      warnings.push({ type: 'no_pk', message: 'Aucune clé primaire', tableId: t.id, tableName: t.name });
    });
    const emptyTables = tables.filter(t => !t.fields?.length);
    emptyTables.forEach(t => {
      warnings.push({ type: 'empty', message: 'Table vide (aucun champ)', tableId: t.id, tableName: t.name });
    });
    rels.forEach(r => {
      if (!tableIds.has(r.fromTableId) || !tableIds.has(r.toTableId)) {
        warnings.push({ type: 'broken_rel', message: 'Relation vers une table supprimée', tableId: r.fromTableId });
      }
    });
    return warnings;
  }

  getTableWarningCount(tableId: string): number {
    return this.getValidationWarnings().filter(w => w.tableId === tableId).length;
  }

  onDragEnded(event: CdkDragEnd, table: Table) {
    this.pushState();
    const { x, y } = event.source.getFreeDragPosition();
    const selected = this.selectedTableIds();
    const toMove = selected.size > 0 && selected.has(table.id) ? selected : new Set([table.id]);
    this.tables.update(tabs => tabs.map(t => {
      if (toMove.has(t.id)) {
        return { ...t, x: t.x + x, y: t.y + y };
      }
      return t;
    }));
    event.source.reset();
    this.scheduleAutoSave();
  }

  addTable(x?: number, y?: number) {
    this.pushState();
    const newId = `table-${Date.now()}`;
    const newTable: Table = {
      id: newId,
      name: 'NewTable',
      x: x ?? 300,
      y: y ?? 300,
      icon: 'solar:widget-add-linear',
      fields: [{ id: `f-${Date.now()}`, name: 'id', type: 'string', isPrimary: true }]
    };
    this.tables.update(tabs => [...tabs, newTable]);
    this.scheduleAutoSave();
  }

  pasteTable() {
    const copied = this.copiedTable();
    if (!copied) return;
    this.pushState();
    const newId = `table-${Date.now()}`;
    const offset = 40;
    const existingNames = new Set(this.tables().map(t => t.name));
    let name = copied.name;
    let i = 1;
    while (existingNames.has(name)) {
      name = `${copied.name}_${i}`;
      i++;
    }
    const newTable: Table = {
      id: newId,
      name,
      x: copied.x + offset,
      y: copied.y + offset,
      icon: copied.icon,
      fields: copied.fields.map((f, i) => ({
        ...f,
        id: `f-${Date.now()}-${i}`,
        relationId: undefined
      }))
    };
    this.tables.update(tabs => [...tabs, newTable]);
    this.selectedTableIds.set(new Set([newId]));
    this.selectedTableId.set(newId);
    this.scheduleAutoSave();
  }

  onCanvasDblClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('[data-table-card]') || target.closest('[data-relationship-badge]')) return;
    const container = this.canvasTransform?.nativeElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const zoom = this.zoomLevel();
    const contentX = (event.clientX - rect.left) / zoom;
    const contentY = (event.clientY - rect.top) / zoom;
    this.addTable(Math.round(contentX), Math.round(contentY));
  }

  clearSelection() {
    this.selectedTableIds.set(new Set());
    this.selectedTableId.set(null);
  }

  selectTableById(id: string) {
    this.selectedTableIds.set(new Set([id]));
    this.selectedTableId.set(id);
  }

  onCanvasClick(event: MouseEvent) {
    if (this.selectionBoxJustCompleted) {
      this.selectionBoxJustCompleted = false;
      return;
    }
    this.clearSelection();
    this.selectedRelationshipId.set(null);
    this.cancelConnecting();
  }

  selectTable(id: string, event?: MouseEvent) {
    const addToSelection = event?.ctrlKey || event?.metaKey;
    this.selectedRelationshipId.set(null);
    if (addToSelection) {
    this.selectedTableIds.update(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const first = next.size > 0 ? next.values().next().value : null;
      this.selectedTableId.set(first ?? null);
      return next;
    });
    } else {
      this.selectedTableIds.set(new Set([id]));
      this.selectedTableId.set(id);
    }
  }

  isTableSelected(id: string): boolean {
    return this.selectedTableIds().has(id);
  }

  private clientToContent(clientX: number, clientY: number): { x: number; y: number } {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const zoom = this.zoomLevel();
    return {
      x: (clientX - rect.left - this.panOffsetX()) / zoom,
      y: (clientY - rect.top - this.panOffsetY()) / zoom
    };
  }

  getSelectionBoxRect(): { x: number; y: number; w: number; h: number } | null {
    const start = this.selectionBoxStart();
    const curr = this.selectionBoxCurrent();
    if (!start || !curr) return null;
    const x = Math.min(start.x, curr.x);
    const y = Math.min(start.y, curr.y);
    const w = Math.abs(curr.x - start.x);
    const h = Math.abs(curr.y - start.y);
    return { x, y, w, h };
  }

  tablesInSelectionBox(): Table[] {
    const rect = this.getSelectionBoxRect();
    if (!rect || rect.w < 3 || rect.h < 3) return [];
    const TABLE_W = this.TABLE_WIDTH;
    return this.tables().filter(t => {
      const th = this.getTableHeight(t);
      const tx2 = t.x + TABLE_W;
      const ty2 = t.y + th;
      const rx2 = rect.x + rect.w;
      const ry2 = rect.y + rect.h;
      return !(t.x > rx2 || tx2 < rect.x || t.y > ry2 || ty2 < rect.y);
    });
  }

  readonly FOLD_THRESHOLD = 5;
  readonly FOLDED_VISIBLE = 3;

  isTableFolded(tableId: string): boolean {
    return this.foldedTableIds().has(tableId);
  }

  toggleTableFold(tableId: string, event?: Event) {
    event?.stopPropagation();
    this.foldedTableIds.update(s => {
      const next = new Set(s);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }

  getVisibleFields(table: Table): { fields: typeof table.fields; hiddenCount: number } {
    const folded = this.isTableFolded(table.id);
    const fields = table.fields || [];
    if (!folded || fields.length <= this.FOLDED_VISIBLE) {
      return { fields, hiddenCount: 0 };
    }
    return {
      fields: fields.slice(0, this.FOLDED_VISIBLE),
      hiddenCount: fields.length - this.FOLDED_VISIBLE
    };
  }

  addField(tableId: string) {
    this.pushState();
    this.tables.update(tabs => tabs.map(t => {
      if (t.id === tableId) {
        const newFields = [...t.fields, { id: `f-${Date.now()}`, name: 'new_field', type: 'string' }];
        if (newFields.length > this.FOLD_THRESHOLD) {
          this.foldedTableIds.update(s => new Set(s).add(tableId));
        }
        return { ...t, fields: newFields };
      }
      return t;
    }));
    this.scheduleAutoSave();
  }

  removeField(tableId: string, fieldId: string, event?: Event) {
    event?.stopPropagation();
    this.pushState();
    this.tables.update(tabs => tabs.map(t => {
      if (t.id !== tableId) return t;
      return { ...t, fields: t.fields.filter(f => f.id !== fieldId) };
    }));
    if (this.selectedTableId() === tableId) {
      this.selectedRelationshipId.set(null);
    }
    this.scheduleAutoSave();
  }

  onFieldTypeChange(field: Field) {
    this.pushState();
    if (field.type === 'enum' && !field.enumRef && this.enums().length) {
      field.enumRef = this.enums()[0].name;
    }
    this.scheduleAutoSave();
  }

  getEnumValues(field: Field): string[] {
    if (field.enumRef) {
      const e = this.enums().find(x => x.name === field.enumRef);
      return e?.values ?? [];
    }
    return field.enumValues ?? [];
  }

  addEnum(name: string) {
    if (!name?.trim()) return;
    const n = name.trim();
    if (this.enums().some(e => e.name === n)) return;
    this.pushState();
    this.enums.update(es => [...es, { name: n, values: [] }]);
    this.scheduleAutoSave();
  }

  removeEnum(name: string) {
    this.pushState();
    this.enums.update(es => es.filter(e => e.name !== name));
    this.tables.update(tabs => tabs.map(t => ({
      ...t,
      fields: t.fields.map(f => f.type === 'enum' && f.enumRef === name ? { ...f, enumRef: undefined } : f)
    })));
    this.scheduleAutoSave();
  }

  addEnumValue(enumName: string, inputEl: HTMLInputElement) {
    const val = inputEl?.value?.trim();
    if (!val) return;
    this.pushState();
    this.enums.update(es => es.map(e =>
      e.name === enumName ? { ...e, values: [...e.values, val] } : e
    ));
    if (inputEl) inputEl.value = '';
    this.scheduleAutoSave();
  }

  removeEnumValue(enumName: string, index: number) {
    this.pushState();
    this.enums.update(es => es.map(e =>
      e.name === enumName ? { ...e, values: e.values.filter((_, i) => i !== index) } : e
    ));
    this.scheduleAutoSave();
  }

  private normalizeFieldType(type: string): string {
    const valid = ['string', 'number', 'integer', 'boolean', 'text', 'date', 'timestamp', 'json', 'uuid', 'enum', 'Relation'];
    if (valid.includes(type)) return type;
    if (['UUID', 'String'].includes(type)) return 'string';
    if (type === 'Money') return 'number';
    if (type === 'Enum') return 'enum';
    return 'string';
  }

  private migrateField(f: Field, boardEnums: EnumDef[]): Field {
    const type = this.normalizeFieldType(f.type);
    if (type === 'enum') {
      if (f.enumRef && boardEnums.some(e => e.name === f.enumRef)) return { ...f, type };
      if (f.enumValues?.length) {
        const enumName = `enum_${f.id}`.replace(/-/g, '_');
        return { ...f, type, enumRef: enumName };
      }
      return { ...f, type };
    }
    return { ...f, type };
  }

  private migrateEnumsFromFields(tables: Table[], boardEnums: EnumDef[]): EnumDef[] {
    const byName = new Map<string, string[]>();
    boardEnums.forEach(e => byName.set(e.name, [...e.values]));
    tables.forEach(t => (t.fields || []).forEach(f => {
      if (f.type === 'enum' && f.enumRef && f.enumValues?.length && !byName.has(f.enumRef)) {
        byName.set(f.enumRef, f.enumValues);
      }
    }));
    return Array.from(byName.entries()).map(([name, values]) => ({ name, values }));
  }

  removeTable(id: string) {
    this.pushState();
    const selRel = this.selectedRelationship;
    const shouldClearRel = selRel && (selRel.fromTableId === id || selRel.toTableId === id);
    const relIdsToRemove = new Set(
      this.relationships()
        .filter(r => r.fromTableId === id || r.toTableId === id)
        .map(r => r.id)
    );
    this.tables.update(tabs =>
      tabs
        .filter(t => t.id !== id)
        .map(t => ({
          ...t,
          fields: (t.fields || []).filter(f => !f.relationId || !relIdsToRemove.has(f.relationId))
        }))
    );
    this.relationships.update(rels =>
      rels.filter(r => r.fromTableId !== id && r.toTableId !== id)
    );
    this.selectedTableIds.update(s => {
      const next = new Set(s);
      next.delete(id);
      const first = next.size > 0 ? next.values().next().value : null;
      this.selectedTableId.set(first ?? null);
      return next;
    });
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

  onImportFileDrop(event: DragEvent) {
    event.preventDefault();
    this.importDropActive.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const isSql = /\.(sql|txt)$/i.test(file.name) || file.type === 'text/plain' || file.type === 'application/sql';
    if (!isSql) {
      this.importError.set('Fichier non supporté. Utilisez un fichier .sql ou .txt');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      this.importSqlContent.set(text);
      this.importError.set(null);
    };
    reader.onerror = () => this.importError.set('Erreur lors de la lecture du fichier');
    reader.readAsText(file);
  }

  onImportFileDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.importDropActive.set(true);
  }

  onImportFileDragLeave() {
    this.importDropActive.set(false);
  }

  onImportJsonDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.importDropActive.set(true);
  }

  onImportJsonDrop(event: DragEvent) {
    event.preventDefault();
    this.importDropActive.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const isJson = /\.(json)$/i.test(file.name) || file.type === 'application/json';
    if (!isJson) {
      this.importError.set('Fichier non supporté. Utilisez un fichier .json');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.importJsonContent.set(String(reader.result ?? ''));
      this.importError.set(null);
    };
    reader.onerror = () => this.importError.set('Erreur lors de la lecture du fichier');
    reader.readAsText(file);
  }

  importFromJson() {
    this.importError.set(null);
    const content = this.importJsonContent().trim();
    if (!content) {
      this.importError.set('Collez ou déposez un fichier JSON');
      return;
    }
    try {
      const data = JSON.parse(content) as { tables?: Table[]; relationships?: Relationship[]; enums?: { name: string; values: string[] }[] };
      const rawTables = data.tables ?? [];
      const rawRels = data.relationships ?? [];
      const rawEnums = data.enums ?? [];
      if (rawTables.length === 0) {
        this.importError.set('Aucune table dans le JSON');
        return;
      }
      this.pushState();
      const idMap = new Map<string, string>();
      const newTables: Table[] = rawTables.map((t, i) => {
        const newId = `table-${Date.now()}-${i}`;
        idMap.set(t.id, newId);
        return {
          ...t,
          id: newId,
          fields: (t.fields ?? []).map((f, j) => ({ ...f, id: `f-${Date.now()}-${i}-${j}` }))
        };
      });
      const relIdMap = new Map<string, string>();
      const newRels: Relationship[] = rawRels
        .filter(r => idMap.has(r.fromTableId) && idMap.has(r.toTableId))
        .map((r, i) => {
          const newRelId = `rel-${Date.now()}-${i}`;
          relIdMap.set(r.id, newRelId);
          return {
            ...r,
            id: newRelId,
            fromTableId: idMap.get(r.fromTableId)!,
            toTableId: idMap.get(r.toTableId)!
          };
        });
      newTables.forEach(t => {
        t.fields.forEach(f => {
          if (f.relationId && relIdMap.has(f.relationId)) {
            f.relationId = relIdMap.get(f.relationId)!;
          }
        });
      });
      const newEnums = rawEnums.map(e => ({ name: e.name, values: e.values ?? [] }));
      this.tables.set(newTables);
      this.relationships.set(newRels);
      this.enums.set(newEnums);
      this.foldedTableIds.set(new Set(newTables.filter(t => (t.fields?.length ?? 0) > this.FOLD_THRESHOLD).map(t => t.id)));
      this.scheduleAutoSave();
      this.importPanelOpen.set(false);
    } catch (e) {
      this.importError.set(e instanceof Error ? e.message : 'JSON invalide');
    }
  }

  importFromSql(sql?: string) {
    this.importError.set(null);
    const content = sql ?? this.importSqlContent();
    const trimmed = content?.trim();
    if (!trimmed) {
      this.importError.set('Collez un script SQL');
      return;
    }
    try {
      const parsed = this.parseSqlSchema(trimmed);
      if (parsed.tables.length === 0) {
        this.importError.set('Aucune table CREATE TABLE trouvée');
        return;
      }
      this.pushState();
      const tableIdByName = new Map<string, string>();
      const newTables: Table[] = [];
      const TABLE_WIDTH = 256;
      const GAP = 80;
      parsed.tables.forEach((pt, i) => {
        const id = `table-${Date.now()}-${i}`;
        tableIdByName.set(pt.name.toLowerCase(), id);
        const fields: Field[] = pt.columns.map((c, j) => ({
          id: `f-${Date.now()}-${i}-${j}`,
          name: c.name,
          type: c.type,
          isPrimary: c.isPrimary,
          relationId: c.references ? undefined : undefined
        }));
        newTables.push({
          id,
          name: pt.name,
          x: 80 + (i % 3) * (TABLE_WIDTH + GAP),
          y: 80 + Math.floor(i / 3) * 200,
          icon: 'solar:widget-add-linear',
          fields
        });
      });
      this.tables.set(newTables);
      const newRels: Relationship[] = [];
      parsed.tables.forEach((pt, tableIdx) => {
        const toTableId = tableIdByName.get(pt.name.toLowerCase());
        if (!toTableId) return;
        pt.columns.forEach((col, colIdx) => {
          if (col.references) {
            const fromTableId = tableIdByName.get(col.references.table.toLowerCase());
            if (!fromTableId || fromTableId === toTableId) return;
            const rel: Relationship = {
              id: `rel-${Date.now()}-${tableIdx}-${colIdx}`,
              fromTableId,
              toTableId,
              fromSide: 'right',
              toSide: 'left',
              type: '1:N'
            };
            newRels.push(rel);
            const toTable = newTables.find(t => t.id === toTableId);
            const field = toTable?.fields[colIdx];
            if (field) {
              field.relationId = rel.id;
              field.type = 'Relation';
            }
          }
        });
      });
      this.relationships.set(newRels);
      this.foldedTableIds.set(new Set(newTables.filter(t => (t.fields?.length ?? 0) > this.FOLD_THRESHOLD).map(t => t.id)));
      this.scheduleAutoSave();
      this.importPanelOpen.set(false);
    } catch (e) {
      this.importError.set(e instanceof Error ? e.message : 'Erreur de parsing SQL');
    }
  }

  private parseSqlSchema(sql: string): { tables: { name: string; columns: { name: string; type: string; isPrimary: boolean; references?: { table: string; column: string } }[] }[] } {
    const tables: { name: string; columns: { name: string; type: string; isPrimary: boolean; references?: { table: string; column: string } }[] }[] = [];
    const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s*\(/gi;
    const typeMap: Record<string, string> = {
      varchar: 'string', char: 'string', character: 'string', nvarchar: 'string',
      int: 'integer', integer: 'integer', bigint: 'integer', smallint: 'integer', serial: 'integer', bigserial: 'integer',
      decimal: 'number', numeric: 'number', float: 'number', real: 'number', double: 'number',
      boolean: 'boolean', bool: 'boolean',
      text: 'text', longtext: 'text', mediumtext: 'text',
      date: 'date', time: 'string',
      timestamp: 'timestamp', timestamptz: 'timestamp', datetime: 'timestamp',
      json: 'json', jsonb: 'json',
      uuid: 'uuid'
    };
    let m: RegExpExecArray | null;
    while ((m = createRegex.exec(sql)) !== null) {
      const tableName = m[1];
      const start = m.index + m[0].length;
      let depth = 1;
      let end = start;
      for (let i = start; i < sql.length; i++) {
        if (sql[i] === '(') depth++;
        else if (sql[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
      }
      const body = sql.slice(start, end);
      const columns: { name: string; type: string; isPrimary: boolean; references?: { table: string; column: string } }[] = [];
      const parts = body.split(',').map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        if (/^\s*PRIMARY\s+KEY\s*\(/i.test(part) || /^\s*FOREIGN\s+KEY\s*\(/i.test(part) || /^\s*UNIQUE\s*\(/i.test(part) || /^\s*CHECK\s*\(/i.test(part)) continue;
        const refMatch = part.match(/^(\w+)\s+(\w+(?:\s*\(\s*\d+\s*\))?)\s*(.*)$/i);
        if (!refMatch) continue;
        const colName = refMatch[1];
        const sqlType = refMatch[2].replace(/\s*\(\s*\d+\s*\)/i, '').toLowerCase();
        const rest = refMatch[3].toUpperCase();
        const isPrimary = /\bPRIMARY\s+KEY\b/.test(rest);
        const refMatch2 = part.match(/REFERENCES\s+["']?(\w+)["']?\s*\(\s*["']?(\w+)["']?\s*\)/i) || part.match(/REFERENCES\s+["']?(\w+)["']?\s*\(/i);
        let references: { table: string; column: string } | undefined;
        if (refMatch2) {
          references = { table: refMatch2[1], column: refMatch2[2] || 'id' };
        }
        const type = typeMap[sqlType] ?? 'string';
        columns.push({ name: colName, type, isPrimary, references });
      }
      if (columns.length > 0) tables.push({ name: tableName, columns });
    }
    return { tables };
  }

  exportSql() {
    let sql = '';
    const withData = this.exportWithFakeData();
    const rowCounts = this.exportRowCounts();

    this.tables().forEach(table => {
      sql += `-- Table: ${table.name}\n`;
      sql += `CREATE TABLE ${table.name.toLowerCase()} (\n`;
      const fields = table.fields.map(f => {
        let type = 'TEXT';
        if (f.type === 'Relation') {
          const rel = this.relationships().find(r => r.id === f.relationId);
          const refTable = rel ? this.tables().find(t => t.id === rel.fromTableId) : null;
          const refTableName = refTable?.name.toLowerCase() ?? 'ref_table';
          type = `BIGINT REFERENCES ${refTableName}(id)`;
        } else if (f.type === 'string' || f.type === 'String') type = 'VARCHAR(255)';
        else if (f.type === 'number' || f.type === 'Money') type = 'DECIMAL(10,2)';
        else if (f.type === 'integer') type = 'BIGINT';
        else if (f.type === 'boolean') type = 'BOOLEAN';
        else if (f.type === 'text') type = 'TEXT';
        else if (f.type === 'date') type = 'DATE';
        else if (f.type === 'timestamp') type = 'TIMESTAMP';
        else if (f.type === 'json') type = 'JSONB';
        else if (f.type === 'uuid') type = 'UUID';
        else if (f.type === 'enum' || f.type === 'Enum') {
          const vals = this.getEnumValues(f);
          const sqlVals = vals.length ? vals.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ') : "'value'";
          type = `ENUM(${sqlVals})`;
        }
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

  private toPrismaType(f: Field): string {
    if (f.type === 'Relation') {
      const rel = this.relationships().find(r => r.id === f.relationId);
      const refTable = rel ? this.tables().find(t => t.id === rel.fromTableId) : null;
      return refTable ? `${refTable.name}?` : 'String?';
    }
    const t = (f.type || 'string').toLowerCase();
    if (t === 'string') return 'String';
    if (t === 'text') return 'String @db.Text';
    if (t === 'number' || t === 'money') return 'Float';
    if (t === 'integer') return 'Int';
    if (t === 'boolean') return 'Boolean';
    if (t === 'date') return 'DateTime @db.Date';
    if (t === 'timestamp') return 'DateTime';
    if (t === 'json') return 'Json';
    if (t === 'uuid') return 'String @db.Uuid';
    if (t === 'enum') {
      const vals = this.getEnumValues(f);
      const enumName = (f.enumRef || 'MyEnum').replace(/[^a-zA-Z0-9]/g, '_');
      return vals.length ? `${enumName}` : 'String';
    }
    return 'String';
  }

  exportPrisma() {
    let out = '// Prisma schema generated by CoSchemaLab\n\ngenerator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n';
    const enums = this.enums();
    enums.forEach(e => {
      const name = e.name.replace(/[^a-zA-Z0-9]/g, '_');
      out += `enum ${name} {\n  ${e.values.join('\n  ')}\n}\n\n`;
    });
    this.tables().forEach(table => {
      out += `model ${table.name} {\n`;
      const addedRels = new Set<string>();
      table.fields.forEach(f => {
        if (f.type === 'Relation') {
          const rel = this.relationships().find(r => r.id === f.relationId);
          if (!rel || addedRels.has(rel.id)) return;
          addedRels.add(rel.id);
          const fromTable = this.tables().find(t => t.id === rel.fromTableId);
          const toTable = this.tables().find(t => t.id === rel.toTableId);
          if (!fromTable || !toTable) return;
          const isFrom = rel.fromTableId === table.id;
          const otherTable = isFrom ? toTable : fromTable;
          const fkField = (isFrom ? toTable : fromTable).fields?.find(x => x.relationId === rel.id);
          const fkName = fkField?.name ?? `${otherTable.name}Id`;
          if (rel.type === '1:1') {
            out += `  ${fkName} String? @unique\n  ${otherTable.name}? ${otherTable.name} @relation(fields: [${fkName}], references: [id])\n`;
          } else if (rel.type === '1:N') {
            if (isFrom) out += `  ${otherTable.name} ${otherTable.name}[]\n`;
            else out += `  ${fkName} String?\n  ${otherTable.name}? ${otherTable.name} @relation(fields: [${fkName}], references: [id])\n`;
          } else {
            out += `  ${otherTable.name} ${otherTable.name}[]\n`;
          }
        } else {
          const prismaType = this.toPrismaType(f);
          const opt = f.isPrimary ? '' : '?';
          out += `  ${f.name} ${prismaType}${opt}${f.isPrimary ? ' @id' : ''}\n`;
        }
      });
      this.relationships().forEach(rel => {
        if (addedRels.has(rel.id)) return;
        if (rel.fromTableId !== table.id) return;
        const toTable = this.tables().find(t => t.id === rel.toTableId);
        if (!toTable) return;
        addedRels.add(rel.id);
        if (rel.type === '1:N') out += `  ${toTable.name} ${toTable.name}[]\n`;
        else if (rel.type === 'M:N') out += `  ${toTable.name} ${toTable.name}[]\n`;
        else out += `  ${toTable.name}? ${toTable.name}\n`;
      });
      out += '}\n\n';
    });
    this.downloadFile(out, 'schema.prisma');
  }

  private toTypeORMType(f: Field): string {
    if (f.type === 'Relation') return 'string';
    const t = (f.type || 'string').toLowerCase();
    if (t === 'string' || t === 'text') return 'string';
    if (t === 'number' || t === 'money') return 'number';
    if (t === 'integer') return 'number';
    if (t === 'boolean') return 'boolean';
    if (t === 'date' || t === 'timestamp') return 'Date';
    if (t === 'json') return 'object';
    if (t === 'uuid') return 'string';
    if (t === 'enum') return 'string';
    return 'string';
  }

  exportTypeORM() {
    let out = '// TypeORM entities generated by CoSchemaLab\n\n';
    out += `import { Entity, PrimaryColumn, Column, ManyToOne, OneToMany, OneToOne, ManyToMany, JoinColumn } from 'typeorm';\n\n`;
    this.tables().forEach(table => {
      out += `@Entity('${table.name.toLowerCase()}')\n`;
      out += `export class ${table.name} {\n`;
      const addedRels = new Set<string>();
      table.fields.forEach(f => {
        if (f.type === 'Relation') {
          const rel = this.relationships().find(r => r.id === f.relationId);
          if (!rel || addedRels.has(rel.id)) return;
          addedRels.add(rel.id);
          const fromTable = this.tables().find(t => t.id === rel.fromTableId);
          const toTable = this.tables().find(t => t.id === rel.toTableId);
          if (!fromTable || !toTable) return;
          const isFrom = rel.fromTableId === table.id;
          const otherTable = isFrom ? toTable : fromTable;
          if (rel.type === '1:1') {
            out += `  @OneToOne(() => ${otherTable.name})\n  @JoinColumn()\n  ${otherTable.name}: ${otherTable.name};\n`;
          } else if (rel.type === '1:N') {
            if (isFrom) out += `  @OneToMany(() => ${otherTable.name}, (e) => e.${table.name})\n  ${otherTable.name}s: ${otherTable.name}[];\n`;
            else out += `  @ManyToOne(() => ${otherTable.name})\n  @JoinColumn()\n  ${otherTable.name}: ${otherTable.name};\n`;
          } else {
            out += `  @ManyToMany(() => ${otherTable.name})\n  ${otherTable.name}s: ${otherTable.name}[];\n`;
          }
        } else {
          const decorator = f.isPrimary ? '@PrimaryColumn()' : '@Column()';
          out += `  ${decorator}\n  ${f.name}: ${this.toTypeORMType(f)};\n`;
        }
      });
      this.relationships().forEach(rel => {
        if (addedRels.has(rel.id) || rel.fromTableId !== table.id) return;
        const toTable = this.tables().find(t => t.id === rel.toTableId);
        if (!toTable) return;
        addedRels.add(rel.id);
        if (rel.type === '1:N') out += `  @OneToMany(() => ${toTable.name}, (e) => e.${table.name})\n  ${toTable.name}s: ${toTable.name}[];\n`;
        else if (rel.type === 'M:N') out += `  @ManyToMany(() => ${toTable.name})\n  ${toTable.name}s: ${toTable.name}[];\n`;
        else if (rel.type === '1:1') out += `  @OneToOne(() => ${toTable.name})\n  ${toTable.name}: ${toTable.name};\n`;
      });
      out += '}\n\n';
    });
    this.downloadFile(out, 'schema.typeorm.ts');
  }

  private generateFakeValue(field: Field): unknown {
    const hint = (field.faker || field.type || '').toLowerCase();

    if (field.type === 'enum' || field.type === 'Enum') {
      const vals = this.getEnumValues(field);
      if (vals.length) return faker.helpers.arrayElement(vals);
      return 'value';
    }
    if (field.type === 'boolean') return faker.datatype.boolean();
    if (field.type === 'number' || field.type === 'Money') return parseFloat(faker.commerce.price({ min: 0, max: 10000 }));
    if (field.type === 'integer') return faker.number.int({ min: 1, max: 999999 });
    if (field.type === 'date') return faker.date.past().toISOString().slice(0, 10);
    if (field.type === 'timestamp') return faker.date.recent().toISOString();
    if (field.type === 'json') return JSON.stringify({ id: faker.string.uuid(), value: faker.lorem.word() });
    if (field.type === 'uuid') return faker.string.uuid();
    if (field.type === 'text') return faker.lorem.sentence();
    if (field.type === 'string' || field.type === 'String') {
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
    const containerRect = container.getBoundingClientRect();
    const zoom = this.zoomLevel();
    const points = container.querySelectorAll<HTMLElement>('[data-connection-point]');
    points.forEach((el) => {
      const tableId = el.getAttribute('data-table-id') ?? el.dataset['tableId'];
      const side = (el.getAttribute('data-side') ?? el.dataset['side']) as ConnectionSide | undefined;
      if (!tableId || !side) return;
      const rect = el.getBoundingClientRect();
      const x = (rect.left + rect.width / 2 - containerRect.left) / zoom;
      const y = (rect.top + rect.height / 2 - containerRect.top) / zoom;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
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
    if (this.isPanning && this.panStart) {
      const dx = event.clientX - this.panStart.clientX;
      const dy = event.clientY - this.panStart.clientY;
      this.panOffsetX.set(this.panStart.panX + dx);
      this.panOffsetY.set(this.panStart.panY + dy);
      return;
    }
    if (this.selectionBoxStart()) {
      this.selectionBoxCurrent.set(this.clientToContent(event.clientX, event.clientY));
    }
    if (this.connectingFrom()) {
      this.updatePreviewMousePos(event.clientX, event.clientY);
    }
  }

  onDocumentMouseUp(event: MouseEvent) {
    if (this.isPanning && (event.button === 1 || event.button === 0)) {
      this.isPanning = false;
      this.panStart = null;
      return;
    }
    if (event.button === 0 && this.selectionBoxStart()) {
      const tables = this.tablesInSelectionBox();
      if (tables.length > 0) {
        this.selectedTableIds.set(new Set(tables.map(t => t.id)));
        this.selectedTableId.set(tables[0].id);
        this.selectionBoxJustCompleted = true;
      } else {
        this.clearSelection();
      }
      this.selectionBoxStart.set(null);
      this.selectionBoxCurrent.set(null);
      return;
    }
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
    this.addForeignKeyField(rel);
    this.scheduleAutoSave();
    requestAnimationFrame(() => this.measureConnectionPoints());
  }

  /** Ajoute la propriété clé étrangère : sur "to" pour 1:1/1:N, sur les deux tables pour M:N */
  private addForeignKeyField(rel: Relationship) {
    const fromTable = this.tables().find(t => t.id === rel.fromTableId);
    const toTable = this.tables().find(t => t.id === rel.toTableId);
    if (!fromTable || !toTable) return;
    const addFkOnTable = (table: Table, refTable: Table, tableId: string) => {
      const baseName = `${refTable.name}Id`;
      const existingNames = new Set((table.fields || []).map(f => f.name));
      let fkName = baseName;
      let i = 1;
      while (existingNames.has(fkName)) {
        fkName = `${baseName}_${i}`;
        i++;
      }
      return { tableId, field: { id: `f-${Date.now()}-${tableId}`, name: fkName, type: 'Relation' as const, relationId: rel.id } };
    };
    const toAdd: { tableId: string; field: Field }[] = [];
    toAdd.push(addFkOnTable(toTable, fromTable, rel.toTableId));
    if (rel.type === 'M:N') {
      toAdd.push(addFkOnTable(fromTable, toTable, rel.fromTableId));
    }
    this.tables.update(tabs => tabs.map(t => {
      const add = toAdd.find(a => a.tableId === t.id);
      if (!add) return t;
      return { ...t, fields: [...(t.fields || []), add.field] };
    }));
  }

  /** Vérifie que chaque relation 1:1 ou M:N a sa clé étrangère, la crée si manquante */
  private ensureForeignKeysForRelationships() {
    const rels = this.getValidRelationships().filter(r => r.type === '1:1' || r.type === 'M:N');
    let needsSave = false;
    for (const rel of rels) {
      const toTable = this.tables().find(t => t.id === rel.toTableId);
      const fromTable = this.tables().find(t => t.id === rel.fromTableId);
      if (!toTable || !fromTable) continue;
      const hasFkOnTo = (toTable.fields || []).some(f => f.relationId === rel.id);
      const hasFkOnFrom = (fromTable.fields || []).some(f => f.relationId === rel.id);
      if (!hasFkOnTo || (rel.type === 'M:N' && !hasFkOnFrom)) {
        this.addForeignKeyField(rel);
        needsSave = true;
      }
    }
    if (needsSave) this.scheduleAutoSave();
  }

  updateRelationshipType(relId: string, type: RelationshipType) {
    this.pushState();
    this.removeForeignKeyField(relId);
    this.relationships.update(rels =>
      rels.map(r => r.id === relId ? { ...r, type } : r)
    );
    const rel = this.relationships().find(r => r.id === relId);
    if (rel) this.addForeignKeyField(rel);
    this.scheduleAutoSave();
  }

  reverseRelationshipDirection(relId: string) {
    this.pushState();
    const rel = this.relationships().find(r => r.id === relId);
    if (!rel) return;
    this.removeForeignKeyField(relId);
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
    const relAfter = this.relationships().find(r => r.id === relId);
    if (relAfter) this.addForeignKeyField(relAfter);
    this.scheduleAutoSave();
  }

  removeRelationship(relId: string) {
    this.pushState();
    this.relationships.update(rels => rels.filter(r => r.id !== relId));
    this.removeForeignKeyField(relId);
    if (this.selectedRelationshipId() === relId) {
      this.selectedRelationshipId.set(null);
    }
    this.scheduleAutoSave();
  }

  /** Supprime la propriété clé étrangère liée à cette relation */
  private removeForeignKeyField(relId: string) {
    this.tables.update(tabs => tabs.map(t => ({
      ...t,
      fields: (t.fields || []).filter(f => f.relationId !== relId)
    })));
  }

  selectRelationship(relId: string, event: Event) {
    event.stopPropagation();
    this.clearSelection();
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

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.code === 'Space') {
      const target = event.target as HTMLElement;
      if (target?.closest('input, textarea, [contenteditable]')) return;
      event.preventDefault();
      this.spacePressed = true;
      return;
    }
    if (event.code === 'Delete' || event.code === 'Backspace') {
      const target = event.target as HTMLElement;
      if (target?.closest('input, textarea, [contenteditable]')) return;
      const relId = this.selectedRelationshipId();
      if (relId) {
        event.preventDefault();
        this.removeRelationship(relId);
        return;
      }
      const ids = this.selectedTableIds();
      if (ids.size > 0) {
        event.preventDefault();
        [...ids].forEach(id => this.removeTable(id));
        this.clearSelection();
      }
      return;
    }
    const target = event.target as HTMLElement;
    const inInput = target?.closest('input, textarea, [contenteditable]');
    if (!inInput && event.code === 'KeyN') {
      event.preventDefault();
      this.addTable();
      return;
    }
    if (!inInput && event.code === 'KeyF' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.focusSelectedTable();
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      if (inInput) return;
      if (event.code === 'KeyD') {
        const tableId = this.selectedTableId();
        if (tableId) {
          const table = this.tables().find(t => t.id === tableId);
          if (table) {
            event.preventDefault();
            const { id, ...rest } = table;
            this.copiedTable.set({
              ...rest,
              fields: (table.fields ?? []).filter(f => f.type !== 'Relation').map(f => {
                const { relationId, ...fRest } = f;
                return fRest;
              })
            });
            this.pasteTable();
          }
        }
        return;
      }
      if (event.code === 'KeyC') {
        const tableId = this.selectedTableId();
        if (tableId) {
          const table = this.tables().find(t => t.id === tableId);
          if (table) {
            event.preventDefault();
            const { id, ...rest } = table;
            this.copiedTable.set({
              ...rest,
              fields: (table.fields ?? []).filter(f => f.type !== 'Relation').map(f => {
                const { relationId, ...fRest } = f;
                return fRest;
              })
            });
          }
        }
        return;
      }
      if (event.code === 'KeyV') {
        const copied = this.copiedTable();
        if (copied) {
          event.preventDefault();
          this.pasteTable();
        }
        return;
      }
      if (event.code === 'KeyF') {
        event.preventDefault();
        this.focusTableSearch();
      }
    }
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    if (event.code === 'Space') {
      this.spacePressed = false;
      if (this.isPanning) {
        this.isPanning = false;
        this.panStart = null;
      }
    }
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
      relationships: JSON.parse(JSON.stringify(this.relationships())),
      enums: JSON.parse(JSON.stringify(this.enums()))
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
    this.enums.set(prev.enums ?? []);
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
    const target = event.target as HTMLElement;
    const isOverTableScroll = target?.closest?.('[data-table-fields-scroll]');
    if (isOverTableScroll && !event.ctrlKey && !event.metaKey) {
      return;
    }
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const target = event.currentTarget as HTMLElement;
      const rect = target?.getBoundingClientRect();
      const mouseX = rect ? event.clientX - rect.left : this.lastMouseX;
      const mouseY = rect ? event.clientY - rect.top : this.lastMouseY;
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      this.zoomAtMouse(Math.max(0.5, Math.min(2, this.zoomLevel() + delta)), mouseX, mouseY);
    } else {
      this.panOffsetX.set(this.panOffsetX() - event.deltaX);
      this.panOffsetY.set(this.panOffsetY() - event.deltaY);
    }
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
      relationships: this.relationships(),
      enums: this.enums()
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
