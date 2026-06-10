import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app: FirebaseApp;

  constructor() {
    // Initialize Firebase
    this.app = initializeApp(environment.firebase);
    console.log('Firebase inicializado com sucesso para o projeto:', environment.firebase.projectId);
  }

  /**
   * Returns the initialized FirebaseApp instance.
   */
  getApp(): FirebaseApp {
    return this.app;
  }
}
