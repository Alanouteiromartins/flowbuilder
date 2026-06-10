import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    const user = await authService.waitForAuth();
    if (user) {
      return true;
    } else {
      router.navigate(['/']);
      return false;
    }
  } catch (error) {
    console.error('Erro no AuthGuard:', error);
    router.navigate(['/']);
    return false;
  }
};
