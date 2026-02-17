import { Component, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BoardService } from '../../services/board.service';
import { Board } from '../../models/board.model';
import type { Table, Relationship, ConnectionSide } from '../../models/board.model';

@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './boards.component.html',
  styleUrl: './boards.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class BoardsComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly boardService = inject(BoardService);

  boards$ = this.boardService.getBoards();
  creating = false;
  errorMessage = '';

  createBoard() {
    this.creating = true;
    this.errorMessage = '';
    this.boardService.createBoard('Nouveau board').subscribe({
      next: (id) => {
        this.creating = false;
        this.router.navigate(['/designer', id], { replaceUrl: true });
      },
      error: (err) => {
        this.creating = false;
        console.error('Erreur création board:', err);
        this.errorMessage = err?.message?.includes('permission')
          ? 'Vérifiez les règles Firestore dans la console Firebase.'
          : 'Impossible de créer le board. Réessayez.';
      }
    });
  }

  openBoard(board: Board) {
    this.router.navigate(['/designer', board.id]);
  }

  deleteBoard(event: Event, board: Board) {
    event.stopPropagation();
    if (confirm(`Supprimer le board "${board.name}" ?`)) {
      this.boardService.deleteBoard(board.id).subscribe();
    }
  }

  logout() {
    this.authService.logout().subscribe();
  }

  formatDate(value: unknown): string {
    if (!value) return '';
    const date = value instanceof Date ? value : (value as { toDate?: () => Date }).toDate?.() ?? new Date();
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  /** Preview visuel du schéma (tables + relations) */
  private readonly PREVIEW_TABLE_WIDTH = 256;
  private readonly PREVIEW_HEADER = 48;
  private readonly PREVIEW_ROW = 40;
  private readonly PREVIEW_W = 140;
  private readonly PREVIEW_H = 90;

  getPreviewTables(board: Board): { x: number; y: number; w: number; h: number }[] {
    const tables = board.tables || [];
    if (tables.length === 0) return [];
    const t = this.getPreviewTransform(board);
    return tables.map((table) => {
      const h = this.getPreviewTableHeight(table);
      return {
        x: (table.x - t.minX) * t.scale,
        y: (table.y - t.minY) * t.scale,
        w: this.PREVIEW_TABLE_WIDTH * t.scale,
        h: h * t.scale
      };
    });
  }

  getPreviewRelationships(board: Board): string[] {
    const tables = board.tables || [];
    const rels = (board.relationships || []).filter((r) =>
      tables.some((t) => t.id === r.fromTableId) && tables.some((t) => t.id === r.toTableId)
    );
    if (rels.length === 0) return [];
    const t = this.getPreviewTransform(board);
    return rels.map((rel) => {
      const from = this.getPreviewConnectionPoint(board, rel.fromTableId, rel.fromSide);
      const to = this.getPreviewConnectionPoint(board, rel.toTableId, rel.toSide);
      const offset = 15 * t.scale;
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
    });
  }

  private getPreviewTransform(board: Board): { minX: number; minY: number; scale: number } {
    const tables = board.tables || [];
    if (tables.length === 0) return { minX: 0, minY: 0, scale: 1 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const table of tables) {
      const h = this.getPreviewTableHeight(table);
      minX = Math.min(minX, table.x);
      minY = Math.min(minY, table.y);
      maxX = Math.max(maxX, table.x + this.PREVIEW_TABLE_WIDTH);
      maxY = Math.max(maxY, table.y + h);
    }
    const pad = 20;
    const srcW = maxX - minX + pad * 2;
    const srcH = maxY - minY + pad * 2;
    const scale = Math.min(this.PREVIEW_W / srcW, this.PREVIEW_H / srcH);
    return { minX: minX - pad, minY: minY - pad, scale };
  }

  private getPreviewTableHeight(table: Table): number {
    return this.PREVIEW_HEADER + this.PREVIEW_ROW * ((table.fields?.length ?? 0) + 1);
  }

  private getPreviewConnectionPoint(board: Board, tableId: string, side?: ConnectionSide): { x: number; y: number } {
    const table = (board.tables || []).find((t) => t.id === tableId);
    if (!table) return { x: 0, y: 0 };
    const t = this.getPreviewTransform(board);
    const w = this.PREVIEW_TABLE_WIDTH * t.scale;
    const h = this.getPreviewTableHeight(table) * t.scale;
    const sx = (table.x - t.minX) * t.scale;
    const sy = (table.y - t.minY) * t.scale;
    const cx = sx + w / 2;
    const cy = sy + h / 2;
    switch (side) {
      case 'top': return { x: cx, y: sy };
      case 'right': return { x: sx + w, y: cy };
      case 'bottom': return { x: cx, y: sy + h };
      case 'left': return { x: sx, y: cy };
      default: return { x: cx, y: cy };
    }
  }
}
