import { Injectable } from '@angular/core';
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
  Unsubscribe
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export interface Variable {
  id?: string;
  name: string;
  type: 'Texto' | 'Número' | 'Boolean';
  defaultValue: string;
}

@Injectable({
  providedIn: 'root'
})
export class VariableService {
  private db: Firestore;

  constructor(private firebaseService: FirebaseService) {
    this.db = getFirestore(this.firebaseService.getApp());
  }

  /**
   * Subscribe to real-time updates for a specific project's variables from Firestore
   * @param projectId The ID of the parent project
   * @param onUpdate Callback function triggered with the updated variables list
   * @param onError Callback function triggered on connection or permission errors
   */
  subscribeToVariables(
    projectId: string, 
    onUpdate: (variables: Variable[]) => void,
    onError: (error: any) => void
  ): Unsubscribe {
    const variablesCollection = collection(this.db, 'projects', projectId, 'variables');
    // Sort variables alphabetically by their technical name
    const q = query(variablesCollection, orderBy('name', 'asc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Variable[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Variable);
        });
        onUpdate(list);
      },
      (error) => {
        console.error(`Erro ao escutar variáveis do projeto ${projectId}:`, error);
        onError(error);
      }
    );
  }

  /**
   * CREATE: Add a new global variable to the project subcollection in Firestore
   */
  async createVariable(projectId: string, variable: Omit<Variable, 'id'>): Promise<void> {
    try {
      const variablesCollection = collection(this.db, 'projects', projectId, 'variables');
      await addDoc(variablesCollection, variable);
    } catch (error: any) {
      console.error('Erro ao criar variável no Firestore:', error);
      throw new Error('Falha ao criar variável no Firebase: ' + (error.message || error));
    }
  }

  /**
   * UPDATE: Edit an existing variable in the project subcollection
   */
  async updateVariable(projectId: string, variableId: string, updates: Omit<Variable, 'id'>): Promise<void> {
    try {
      const varRef = doc(this.db, 'projects', projectId, 'variables', variableId);
      await updateDoc(varRef, updates);
    } catch (error: any) {
      console.error('Erro ao atualizar variável no Firestore:', error);
      throw new Error('Falha ao atualizar variável no Firebase: ' + (error.message || error));
    }
  }

  /**
   * DELETE: Remove a variable from the project subcollection
   */
  async deleteVariable(projectId: string, variableId: string): Promise<void> {
    try {
      const varRef = doc(this.db, 'projects', projectId, 'variables', variableId);
      await deleteDoc(varRef);
    } catch (error: any) {
      console.error('Erro ao deletar variável no Firestore:', error);
      throw new Error('Falha ao deletar variável no Firebase: ' + (error.message || error));
    }
  }
}
