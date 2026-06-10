import { Injectable, signal } from '@angular/core';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  Firestore,
  query,
  orderBy,
  DocumentReference
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { FirebaseService } from './firebase.service';

export interface Project {
  id?: string;
  name: string;
  description: string;
  createdAt: number;
  status: 'Ativo' | 'Rascunho';
  flowCount: number;
  chatwootConnected?: boolean;
  uazapiConnected?: boolean;
  chatwootConfig?: {
    url: string;
    accountId: string;
    inboxId: string;
    token: string;
  };
  uazapiConfig?: {
    url: string;
    token: string;
    instanceId?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private db: Firestore;
  private unsubscribeProjects?: () => void;
  
  // Reactive list of projects synced in real-time from Firestore
  projects = signal<Project[]>([]);
  
  // Track loading status of the database
  isLoading = signal(true);
  
  // Store connection error message if rules are blocked
  databaseError = signal<string>('');

  constructor(private firebaseService: FirebaseService) {
    this.db = getFirestore(this.firebaseService.getApp());
    
    // Subscribe to projects only after user auth state is verified
    const auth = getAuth(this.firebaseService.getApp());
    onAuthStateChanged(auth, (user) => {
      if (user) {
        if (!this.unsubscribeProjects) {
          this.subscribeToProjects();
        }
      } else {
        if (this.unsubscribeProjects) {
          this.unsubscribeProjects();
          this.unsubscribeProjects = undefined;
        }
        this.projects.set([]);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Subscribe to real-time updates from Firestore "projects" collection
   */
  private subscribeToProjects() {
    this.isLoading.set(true);
    
    try {
      const projectsCollection = collection(this.db, 'projects');
      const q = query(projectsCollection, orderBy('createdAt', 'desc'));

      this.unsubscribeProjects = onSnapshot(
        q, 
        (snapshot) => {
          const list: Project[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() } as Project);
          });
          this.projects.set(list);
          this.databaseError.set('');
          this.isLoading.set(false);
        },
        (error) => {
          console.error('Erro de conexão com o Firestore:', error);
          this.isLoading.set(false);
          
          if (error.code === 'permission-denied') {
            this.databaseError.set(
              'Acesso negado às regras do Firestore. Certifique-se de ativar o Firestore no console do Firebase e configurar as regras de leitura/escrita como públicas ou autenticadas.'
            );
          } else {
            this.databaseError.set('Erro ao conectar ao banco de dados: ' + error.message);
          }
        }
      );
    } catch (err: any) {
      console.error('Erro de inicialização do listener:', err);
      this.databaseError.set('Erro ao inicializar o banco de dados.');
      this.isLoading.set(false);
    }
  }

  /**
   * Fetch a single project from the active list by its ID
   */
  getProjectById(id: string): Project | undefined {
    return this.projects().find(p => p.id === id);
  }

  /**
   * CREATE: Add a new Project to Firestore
   */
  async createProject(project: Omit<Project, 'id' | 'createdAt' | 'flowCount'>): Promise<DocumentReference> {
    const newProject: Omit<Project, 'id'> = {
      ...project,
      createdAt: Date.now(),
      flowCount: 0
    };

    try {
      const projectsCollection = collection(this.db, 'projects');
      return await addDoc(projectsCollection, newProject);
    } catch (error: any) {
      console.error('Erro ao criar projeto no Firestore:', error);
      throw new Error('Falha ao criar projeto no Firebase: ' + (error.message || error));
    }
  }

  /**
   * UPDATE: Edit an existing Project in Firestore
   */
  async updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const projectRef = doc(this.db, 'projects', id);
      await updateDoc(projectRef, updates);
    } catch (error: any) {
      console.error('Erro ao atualizar projeto no Firestore:', error);
      throw new Error('Falha ao atualizar projeto no Firebase: ' + (error.message || error));
    }
  }

  /**
   * DELETE: Remove a Project from Firestore
   */
  async deleteProject(id: string): Promise<void> {
    try {
      const projectRef = doc(this.db, 'projects', id);
      await deleteDoc(projectRef);
    } catch (error: any) {
      console.error('Erro ao deletar projeto no Firestore:', error);
      throw new Error('Falha ao deletar projeto no Firebase: ' + (error.message || error));
    }
  }
}
