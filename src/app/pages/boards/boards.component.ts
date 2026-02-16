import { Component, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BoardService } from '../../services/board.service';
import { Board } from '../../models/board.model';

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
}
