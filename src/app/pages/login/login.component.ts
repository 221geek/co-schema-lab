import { Component, signal, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  email = signal('');
  password = signal('');
  loading = signal(false);
  errorMessage = signal('');

  getSignupQueryParams(): { redirect?: string } {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    return redirect ? { redirect } : {};
  }

  navigateToSignup(e: Event): void {
    e.preventDefault();
    const q = this.getSignupQueryParams();
    this.router.navigate(['/signup'], { queryParams: q });
  }

  private getRedirectUrl(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      return redirect;
    }
    return '/boards';
  }

  onLogin() {
    const email = this.email().trim();
    const password = this.password();

    if (!email || !password) {
      this.errorMessage.set('Veuillez remplir tous les champs.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.signInWithEmail(email, password).subscribe({
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

  onGoogleLogin() {
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
      'auth/user-disabled': 'Ce compte a été désactivé.',
      'auth/user-not-found': 'Aucun compte trouvé avec cet email.',
      'auth/wrong-password': 'Mot de passe incorrect.',
      'auth/invalid-credential': 'Identifiants incorrects.',
      'auth/email-already-in-use': 'Cet email est déjà utilisé.',
      'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
      'auth/popup-closed-by-user': 'Connexion annulée.',
      'auth/popup-blocked': 'La fenêtre de connexion a été bloquée.',
      'auth/cancelled-popup-request': 'Connexion annulée.'
    };
    return messages[code] ?? 'Une erreur est survenue. Veuillez réessayer.';
  }
}
