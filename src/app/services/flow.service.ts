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
import { ProjectService } from './project.service';

export interface FlowNode {
  id: string;
  type: 'start' | 'message' | 'http_request' | 'conditional' | 'uazapi_buttons' | 'uazapi_list' | 'uazapi_send_text' | 'question' | 'chatwoot_label' | 'chatwoot_agent' | 'chatwoot_team' | 'chatwoot_status' | 'time_check' | 'delay' | 'finish';
  name: string;
  x: number;
  y: number;
  messageText?: string;
  
  // Chatwoot Label Node properties
  chatwootLabelName?: string;
  chatwootLabelAction?: 'add' | 'remove' | 'clear';

  // Chatwoot Agent Node properties
  chatwootAgentId?: string;
  chatwootAgentName?: string;
  chatwootAgentAction?: 'assign' | 'unassign';

  // Chatwoot Team Node properties
  chatwootTeamId?: string;
  chatwootTeamName?: string;
  chatwootTeamAction?: 'assign' | 'unassign';

  // Chatwoot Status Node properties
  chatwootStatusAction?: 'open' | 'resolved' | 'pending' | 'snoozed';
  
  // Question Node properties
  questionText?: string;
  saveVariableName?: string;
  
  // HTTP Request properties
  httpUrl?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  httpHeaders?: { key: string; value: string }[];
  httpBody?: string;
  
  nextNodeId?: string;

  // Conditional Node properties
  conditionVariable?: string;
  conditionOperator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  conditionValue?: string;
  trueNodeId?: string;
  falseNodeId?: string;

  // Uazapi Buttons Node properties
  menuText?: string;
  menuFooterText?: string;
  menuButtonText?: string;
  
  button1Label?: string;
  button1Value?: string;
  button1NodeId?: string;
  
  button2Label?: string;
  button2Value?: string;
  button2NodeId?: string;
  
  button3Label?: string;
  button3Value?: string;
  button3NodeId?: string;

  button4Label?: string;
  button4Value?: string;
  button4NodeId?: string;

  button5Label?: string;
  button5Value?: string;
  button5NodeId?: string;

  button6Label?: string;
  button6Value?: string;
  button6NodeId?: string;
  
  fallbackNodeId?: string;

  // Time Check Node properties
  timeStartHour?: number;
  timeStartMinute?: number;
  timeEndHour?: number;
  timeEndMinute?: number;
  timeWeekdays?: string[];
  timeTimezone?: string;

  // Delay Node properties
  delayTime?: number;
  delayUnit?: 'seconds' | 'minutes';
}

export interface Flow {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
  useBotLabel?: boolean; // Controls whether the bot label is synced with Chatwoot
  updatedAt: number;
  nodes?: FlowNode[]; // Storing all canvas nodes directly inside the flow document!
  integrationKey?: string; // Optional bound integration key (e.g., 'chatwoot', 'whatsapp', 'none')
}

@Injectable({
  providedIn: 'root'
})
export class FlowService {
  private db: Firestore;

  constructor(
    private firebaseService: FirebaseService,
    private projectService: ProjectService
  ) {
    this.db = getFirestore(this.firebaseService.getApp());
  }

  /**
   * Subscribe to real-time updates for a specific project's flows from Firestore
   */
  subscribeToFlows(
    projectId: string, 
    onUpdate: (flows: Flow[]) => void,
    onError: (error: any) => void
  ): Unsubscribe {
    const flowsCollection = collection(this.db, 'projects', projectId, 'flows');
    const q = query(flowsCollection, orderBy('updatedAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Flow[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Flow);
        });
        
        onUpdate(list);
        
        // Auto-update the project's flowCount
        this.updateProjectFlowCount(projectId, list.length);
      },
      (error) => {
        console.error(`Erro ao escutar fluxos do projeto ${projectId}:`, error);
        onError(error);
      }
    );
  }

  /**
   * Subscribe to real-time updates for a single specific flow document
   */
  subscribeToFlow(
    projectId: string,
    flowId: string,
    onUpdate: (flow: Flow) => void,
    onError: (error: any) => void
  ): Unsubscribe {
    const flowRef = doc(this.db, 'projects', projectId, 'flows', flowId);
    
    return onSnapshot(
      flowRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate({ id: docSnap.id, ...docSnap.data() } as Flow);
        }
      },
      (error) => {
        console.error(`Erro ao escutar fluxo ${flowId}:`, error);
        onError(error);
      }
    );
  }

  /**
   * Helper to sync flow count back to the parent project document
   */
  private async updateProjectFlowCount(projectId: string, count: number) {
    try {
      await this.projectService.updateProject(projectId, {
        flowCount: count
      });
    } catch (err) {
      console.warn(`Não foi possível sincronizar o flowCount do projeto ${projectId}:`, err);
    }
  }

  /**
   * CREATE: Add a new flow to the project subcollection in Firestore
   */
  async createFlow(projectId: string, flow: Omit<Flow, 'id' | 'updatedAt' | 'nodes'>): Promise<void> {
    const newFlow: Omit<Flow, 'id'> = {
      ...flow,
      updatedAt: Date.now(),
      nodes: [] // Starts with empty canvas
    };

    try {
      const flowsCollection = collection(this.db, 'projects', projectId, 'flows');
      await addDoc(flowsCollection, newFlow);
    } catch (error: any) {
      console.error('Erro ao criar fluxo no Firestore:', error);
      throw new Error('Falha ao criar fluxo no Firebase: ' + (error.message || error));
    }
  }

  /**
   * UPDATE: Edit an existing flow in the project subcollection
   */
  async updateFlow(projectId: string, flowId: string, updates: Partial<Omit<Flow, 'id' | 'updatedAt'>>): Promise<void> {
    const fullUpdates = {
      ...updates,
      updatedAt: Date.now()
    };

    try {
      const flowRef = doc(this.db, 'projects', projectId, 'flows', flowId);
      await updateDoc(flowRef, fullUpdates);
    } catch (error: any) {
      console.error('Erro ao atualizar fluxo no Firestore:', error);
      throw new Error('Falha ao atualizar fluxo no Firebase: ' + (error.message || error));
    }
  }

  /**
   * DELETE: Remove a flow from the project subcollection
   */
  async deleteFlow(projectId: string, flowId: string): Promise<void> {
    try {
      const flowRef = doc(this.db, 'projects', projectId, 'flows', flowId);
      await deleteDoc(flowRef);
    } catch (error: any) {
      console.error('Erro ao deletar fluxo no Firestore:', error);
      throw new Error('Falha ao deletar fluxo no Firebase: ' + (error.message || error));
    }
  }
}
