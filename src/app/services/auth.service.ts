import { Injectable, signal } from '@angular/core';
import { 
  getAuth, 
  Auth, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { FirebaseService } from './firebase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth;
  
  // Writable Signal to track the current user reactively in Angular components
  currentUser = signal<User | null>(null);
  
  constructor(private firebaseService: FirebaseService) {
    this.auth = getAuth(this.firebaseService.getApp());
    
    // Subscribe to authentication state changes
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser.set(user);
      console.log('Estado de autenticação alterado:', user ? `Usuário: ${user.email}` : 'Nenhum usuário logado');
    });
  }

  /**
   * Returns a promise that resolves when the Firebase Auth state is initialized.
   */
  waitForAuth(): Promise<User | null> {
    return new Promise((resolve) => {
      if (this.currentUser()) {
        resolve(this.currentUser());
        return;
      }
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  /**
   * Log in using Email and Password
   */
  async loginWithEmail(email: string, password: string): Promise<User> {
    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      return credential.user;
    } catch (error: any) {
      console.error('Erro no login por e-mail:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Log in using Google Provider (Popup flow)
   */
  async loginWithGoogle(): Promise<User> {
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection prompt
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const credential = await signInWithPopup(this.auth, provider);
      return credential.user;
    } catch (error: any) {
      console.error('Erro no login com Google:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign out the current user
   */
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Erro ao sair:', error);
      throw error;
    }
  }

  /**
   * Translates Firebase auth errors into user-friendly Portuguese messages
   */
  private handleAuthError(error: any): Error {
    let message = 'Ocorreu um erro ao tentar realizar o login. Tente novamente.';
    
    if (error.code) {
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          message = 'E-mail ou senha incorretos.';
          break;
        case 'auth/invalid-email':
          message = 'O formato do e-mail inserido é inválido.';
          break;
        case 'auth/user-disabled':
          message = 'Esta conta de usuário foi desativada.';
          break;
        case 'auth/too-many-requests':
          message = 'Muitas tentativas malsucedidas. Tente novamente mais tarde.';
          break;
        case 'auth/popup-closed-by-user':
          message = 'O login com o Google foi cancelado antes de ser concluído.';
          break;
        case 'auth/cancelled-popup-request':
          message = 'A operação foi cancelada devido a múltiplos pop-ups abertos.';
          break;
      }
    }
    
    return new Error(message);
  }
}
