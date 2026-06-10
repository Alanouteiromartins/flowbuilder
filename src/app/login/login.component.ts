import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  isLoading = signal(false);
  errorMessage = signal('');

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * Performs authentication via Email and Password
   */
  async onSubmit() {
    if (!this.email() || !this.password()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      await this.authService.loginWithEmail(this.email(), this.password());
      console.log('Login bem-sucedido via e-mail!');
      this.router.navigate(['/projects']);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Erro ao realizar login.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Performs authentication via Google provider (Popup)
   */
  async onGoogleLogin() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      await this.authService.loginWithGoogle();
      console.log('Login bem-sucedido via Google!');
      this.router.navigate(['/projects']);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Erro ao logar com o Google.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
