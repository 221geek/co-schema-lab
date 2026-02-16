import { Routes } from '@angular/router';
import { canActivate, redirectUnauthorizedTo } from '@angular/fire/auth-guard';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { BoardsComponent } from './pages/boards/boards.component';
import { DesignerComponent } from './pages/designer/designer.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  {
    path: 'boards',
    component: BoardsComponent,
    ...canActivate((_, state) =>
      redirectUnauthorizedTo(`/login?redirect=${encodeURIComponent(state.url)}`)
    )
  },
  {
    path: 'designer/:id',
    component: DesignerComponent,
    ...canActivate((_, state) =>
      redirectUnauthorizedTo(`/login?redirect=${encodeURIComponent(state.url)}`)
    )
  },
  { path: '**', redirectTo: 'login' }
];
