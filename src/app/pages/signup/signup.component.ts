import { Component, signal, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styles: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SignupComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  email = signal('');
  password = signal('');
  loading = signal(false);
  errorMessage = signal('');

  private getRedirectUrl(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      return redirect;
    }
    return '/boards';
  }

  getLoginRoute(): { path: string[]; queryParams?: { redirect: string } } {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    if (redirect) {
      return { path: ['/login'], queryParams: { redirect } };
    }
    return { path: ['/login'] };
  }

  onSignup() {
    const email = this.email().trim();
    const password = this.password();

    if (!email || !password) {
      this.errorMessage.set('Veuillez remplir tous les champs.');
      return;
    }

    if (password.length < 6) {
      this.errorMessage.set('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.signUpWithEmail(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl(this.getRedirectUrl());
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(this.getAuthErrorMessage(err.code));
      }
    });
  }

  onGoogleSignup() {
    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.signInWithGoogle().subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl(this.getRedirectUrl());
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(this.getAuthErrorMessage(err.code));
      }
    });
  }

  private getAuthErrorMessage(code: string): string {
    const messages: Record<string, string> = {
      'auth/invalid-email': 'Adresse email invalide.',
      'auth/email-already-in-use': 'Cet email est déjà utilisé.',
      'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
      'auth/popup-closed-by-user': 'Inscription annulée.',
      'auth/popup-blocked': 'La fenêtre a été bloquée.',
      'auth/cancelled-popup-request': 'Inscription annulée.'
    };
    return messages[code] ?? 'Une erreur est survenue. Veuillez réessayer.';
  }
}
