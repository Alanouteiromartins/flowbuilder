import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProjectService } from '../services/project.service';
import { FlowService, Flow, FlowNode } from '../services/flow.service';
import { VariableService, Variable } from '../services/variable.service';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';

export interface ConnectionLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type?: 'default' | 'true' | 'false';
}

@Component({
  selector: 'app-flowbuilder',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './flowbuilder.component.html',
  styleUrl: './flowbuilder.component.css'
})
export class FlowbuilderComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private flowService = inject(FlowService);
  private variableService = inject(VariableService);

  projectId = signal('');
  flowId = signal('');
  
  project = computed(() => {
    const list = this.projectService.projects();
    const id = this.projectId();
    return list.find(p => p.id === id) || null;
  });

  projectName = computed(() => this.project()?.name || '');
  isChatwootConnected = computed(() => {
    const proj = this.project();
    return !!(proj && proj.chatwootConnected);
  });
  isUazapiConnected = computed(() => {
    const proj = this.project();
    return !!(proj && proj.uazapiConnected);
  });

  flowName = signal('');
  flowIntegrationKey = signal('');
  flowIsActive = signal(false);

  // States for testing HTTP Request
  isTestingHttp = signal(false);
  httpTestResult = signal<{
    success: boolean;
    status: number;
    statusText: string;
    duration: number;
    body: string;
    headers: Record<string, string>;
    request?: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body: string;
    };
  } | null>(null);

  // States for request details expander
  showRequestDetails = signal(false);

  // States for testing Chatwoot Message Send
  chatwootConfig = signal<{ url: string; accountId: string; inboxId: string; token: string } | null>(null);
  chatwootTestConversationId = '';
  isTestingChatwoot = signal(false);
  chatwootTestResult = signal<{ success: boolean; status: number; statusText: string; message: string } | null>(null);

  // Chatwoot Account Labels List
  chatwootLabels = signal<string[]>([]);
  isLoadingLabels = signal(false);

  // Chatwoot Account Agents & Teams
  chatwootAgents = signal<any[]>([]);
  isLoadingAgents = signal(false);
  chatwootTeams = signal<any[]>([]);
  isLoadingTeams = signal(false);

  // Dynamic variables catalog copy feedback state
  copyIndicator = signal<string | null>(null);

  // Dynamic variables catalog popover states
  showVariablesPopover = signal(false);
  activeVariableTab = signal<'system' | 'project'>('system');

  // States for bot activation feedback modal
  showBotActiveModal = signal(false);
  botActiveModalState = signal<'loading' | 'success'>('loading');
  botActiveModalText = signal('');

  // States for cURL Import
  showCurlInput = signal(false);
  curlRawInput = '';

  // Active nodes in the canvas
  nodes = signal<FlowNode[]>([]);
  
  // Project global variables list
  variables = signal<Variable[]>([]);

  // Hours and minutes for Verificar Horário configuration select dropdowns
  hoursList = Array.from({ length: 24 }, (_, i) => i);
  minutesList = Array.from({ length: 60 }, (_, i) => i);

  // Currently selected node for properties panel
  selectedNode = signal<FlowNode | null>(null);

  // Zoom and Pan states
  zoomLevel = signal(1);
  panOffset = { x: 0, y: 0 };

  // Dragging states
  activeDragNodeId = signal<string | null>(null);
  dragOffset = { x: 0, y: 0 };

  // Panning states
  isPanning = signal(false);
  private panStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };

  // Real-time Firestore subscription unsubscribers
  private flowSubscription?: () => void;
  private variablesSubscription?: () => void;

  // Reactively calculate connection lines based on node positions and nextNodeId references
  connections = computed<ConnectionLine[]>(() => {
    const list = this.nodes();
    const lines: ConnectionLine[] = [];

    list.forEach(node => {
      if (node.type === 'conditional' || node.type === 'time_check') {
        // Draw True (Green) Connection
        if (node.trueNodeId) {
          const target = list.find(n => n.id === node.trueNodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-true-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 28, // upper right anchor
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'true'
            });
          }
        }
        // Draw False (Red) Connection
        if (node.falseNodeId) {
          const target = list.find(n => n.id === node.falseNodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-false-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 53, // lower right anchor
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'false'
            });
          }
        }
      } else if (node.type === 'uazapi_buttons') {
        // Draw 4 custom connection lines starting from vertical right anchors:
        // Anchor 1 (Button 1): node.x + 180, node.y + 25
        // Anchor 2 (Button 2): node.x + 180, node.y + 50
        // Anchor 3 (Button 3): node.x + 180, node.y + 75
        // Anchor Fallback: node.x + 180, node.y + 100
        if (node.button1NodeId) {
          const target = list.find(n => n.id === node.button1NodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-b1-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 25,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
        if (node.button2NodeId) {
          const target = list.find(n => n.id === node.button2NodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-b2-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 50,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
        if (node.button3NodeId) {
          const target = list.find(n => n.id === node.button3NodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-b3-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 75,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
        if (node.fallbackNodeId) {
          const target = list.find(n => n.id === node.fallbackNodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-fb-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 100,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
      } else if (node.type === 'uazapi_list') {
        // Draw 7 custom connection lines starting from vertical right anchors:
        // Anchor 1 (Button 1): node.x + 180, node.y + 25
        // Anchor 2 (Button 2): node.x + 180, node.y + 50
        // Anchor 3 (Button 3): node.x + 180, node.y + 75
        // Anchor 4 (Button 4): node.x + 180, node.y + 100
        // Anchor 5 (Button 5): node.x + 180, node.y + 125
        // Anchor 6 (Button 6): node.x + 180, node.y + 150
        // Anchor Fallback: node.x + 180, node.y + 175
        if (node.button1NodeId) {
          const target = list.find(n => n.id === node.button1NodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-b1-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 25,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
        if (node.button2NodeId) {
          const target = list.find(n => n.id === node.button2NodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-b2-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 50,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
        if (node.button3NodeId) {
          const target = list.find(n => n.id === node.button3NodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-b3-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 75,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
        if (node.button4NodeId) {
          const target = list.find(n => n.id === node.button4NodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-b4-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 100,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
        if (node.button5NodeId) {
          const target = list.find(n => n.id === node.button5NodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-b5-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 125,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
        if (node.button6NodeId) {
          const target = list.find(n => n.id === node.button6NodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-b6-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 150,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
        if (node.fallbackNodeId) {
          const target = list.find(n => n.id === node.fallbackNodeId);
          if (target) {
            const targetH = target.type === 'start' ? 44 : 80;
            lines.push({
              id: `line-${node.id}-fb-${target.id}`,
              x1: node.x + 180,
              y1: node.y + 175,
              x2: target.x,
              y2: target.y + (targetH / 2),
              type: 'default'
            });
          }
        }
      } else if (node.nextNodeId) {
        const target = list.find(n => n.id === node.nextNodeId);
        if (target) {
          const isSourceStart = node.type === 'start';
          const isTargetStart = target.type === 'start';
          
          const sourceW = isSourceStart ? 140 : 180;
          const sourceH = isSourceStart ? 44 : 80;
          const targetH = isTargetStart ? 44 : 80;

          lines.push({
            id: `line-${node.id}-${target.id}`,
            x1: node.x + sourceW,
            y1: node.y + (sourceH / 2),
            x2: target.x,
            y2: target.y + (targetH / 2),
            type: 'default'
          });
        }
      }
    });

    return lines;
  });

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const pId = params.get('projectId');
      const fId = params.get('flowId');
      
      if (pId && fId) {
        this.projectId.set(pId);
        this.flowId.set(fId);
        this.loadChatwootConfig(pId);
        this.chatwootTestConversationId = localStorage.getItem('chatwoot_test_conv_id') || '';
        this.subscribeToFlowData(pId, fId);
        this.subscribeToProjectVariables(pId);
      } else {
        this.router.navigate(['/projects']);
      }
    });
  }

  private loadChatwootConfig(pId: string) {
    const saved = localStorage.getItem(`chatwoot_config_${pId}`);
    if (saved) {
      this.chatwootConfig.set(JSON.parse(saved));
      this.fetchChatwootLabels();
      this.fetchChatwootAgents();
      this.fetchChatwootTeams();
    } else {
      this.chatwootConfig.set(null);
    }
  }

  async fetchChatwootAgents() {
    const config = this.chatwootConfig();
    if (!config) return;

    this.isLoadingAgents.set(true);

    const fId = environment.firebase.projectId;
    const baseUrl = (environment as any).backendUrl || `https://us-central1-${fId}.cloudfunctions.net`;
    const endpoint = `${baseUrl}/getChatwootAgents?projectId=${this.projectId()}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Resposta dos agentes do Chatwoot (via Proxy):', data);
        
        // Chatwoot returns agents list as an array directly
        const list = Array.isArray(data) ? data : (data.payload || []);
        console.log('Agentes processados (via Proxy):', list);
        this.chatwootAgents.set(list);
      } else {
        console.warn('Falha ao buscar agentes do Chatwoot via Proxy. Status:', response.status);
      }
    } catch (err) {
      console.error('Erro ao conectar ao servidor para buscar agentes:', err);
    } finally {
      this.isLoadingAgents.set(false);
    }
  }

  async fetchChatwootTeams() {
    const config = this.chatwootConfig();
    if (!config) return;

    this.isLoadingTeams.set(true);

    const fId = environment.firebase.projectId;
    const baseUrl = (environment as any).backendUrl || `https://us-central1-${fId}.cloudfunctions.net`;
    const endpoint = `${baseUrl}/getChatwootTeams?projectId=${this.projectId()}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Resposta dos times do Chatwoot (via Proxy):', data);
        
        // Chatwoot returns teams list as an array directly
        const list = Array.isArray(data) ? data : (data.payload || []);
        console.log('Times processados (via Proxy):', list);
        this.chatwootTeams.set(list);
      } else {
        console.warn('Falha ao buscar times do Chatwoot via Proxy. Status:', response.status);
      }
    } catch (err) {
      console.error('Erro ao conectar ao servidor para buscar times:', err);
    } finally {
      this.isLoadingTeams.set(false);
    }
  }

  async fetchChatwootLabels() {
    const config = this.chatwootConfig();
    if (!config) return;

    this.isLoadingLabels.set(true);

    const fId = environment.firebase.projectId;
    const baseUrl = (environment as any).backendUrl || `https://us-central1-${fId}.cloudfunctions.net`;
    const endpoint = `${baseUrl}/getChatwootLabels?projectId=${this.projectId()}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Resposta das etiquetas do Chatwoot (via Proxy):', data);
        
        // Chatwoot returns either an array directly: [ { "title": "label1" } ]
        // or wrapped in an object: { "payload": [ { "title": "label1" } ] }
        const list = Array.isArray(data) ? data : (data.payload || []);
        const labelTitles = list
          .map((l: any) => (l.title || l.name || l.label_title || '') as string)
          .filter(Boolean);
        
        console.log('Etiquetas processadas (via Proxy):', labelTitles);
        this.chatwootLabels.set(labelTitles);
      } else {
        console.warn('Falha ao buscar etiquetas do Chatwoot via Proxy. Status:', response.status);
      }
    } catch (err) {
      console.error('Erro ao conectar ao servidor para buscar etiquetas:', err);
    } finally {
      this.isLoadingLabels.set(false);
    }
  }

  ngOnDestroy() {
    if (this.flowSubscription) {
      this.flowSubscription();
    }
    if (this.variablesSubscription) {
      this.variablesSubscription();
    }
    this.onCanvasMouseUp(); // Ensure drag state is reset on leave
  }



  // Subscribe to flow data strictly on Firestore
  private subscribeToFlowData(pId: string, fId: string) {
    if (this.flowSubscription) {
      this.flowSubscription();
    }

    this.flowSubscription = this.flowService.subscribeToFlow(
      pId,
      fId,
      (flowData) => {
        this.flowName.set(flowData.name);
        this.flowIntegrationKey.set(flowData.integrationKey || '');
        this.flowIsActive.set(flowData.isActive || false);
        
        const loadedNodes = flowData.nodes || [];
        
        // If the flow is opened completely empty, seed a default starting block
        if (loadedNodes.length === 0 && !this.activeDragNodeId()) {
          const initialNodes: FlowNode[] = [
            {
              id: 'node-start',
              type: 'start',
              name: 'Início',
              x: 150,
              y: 200
            }
          ];
          this.nodes.set(initialNodes);
          this.saveNodes(initialNodes);
        } else if (!this.activeDragNodeId()) {
          this.nodes.set(loadedNodes);
          
          // Refresh selected node reference to keep properties panel in sync
          const active = this.selectedNode();
          if (active) {
            const freshActive = loadedNodes.find(n => n.id === active.id);
            if (freshActive) {
              this.selectedNode.set(freshActive);
            } else {
              this.selectedNode.set(null);
            }
          }
        }
      },
      (error) => {
        console.error('Erro ao conectar ao fluxo no Firestore:', error);
      }
    );
  }

  // Subscribe to global variables of the active project in real-time
  private subscribeToProjectVariables(pId: string) {
    if (this.variablesSubscription) {
      this.variablesSubscription();
    }

    this.variablesSubscription = this.variableService.subscribeToVariables(
      pId,
      (vars) => {
        this.variables.set(vars);
      },
      (error) => {
        console.error('Erro ao ler variáveis para o Flowbuilder:', error);
      }
    );
  }

  // Save active nodes list to Firestore
  private async saveNodes(list: FlowNode[]) {
    try {
      await this.flowService.updateFlow(this.projectId(), this.flowId(), {
        nodes: list
      });
    } catch (err) {
      console.error('Erro ao salvar fluxos no Firestore:', err);
    }
  }

  /* -------------------------------------------------------------
     CANVAS ACTIONS
     ------------------------------------------------------------- */
  
  // Add a new "Enviar Mensagem" component to Firestore
  addMessageComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;
    
    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'message',
      name: `Enviar Mensagem ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      messageText: 'Escreva sua mensagem aqui...'
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Requisição HTTP" component to Firestore
  addHttpRequestComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'http_request',
      name: `Requisição HTTP ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      httpUrl: 'https://api.exemplo.com/dados',
      httpMethod: 'GET',
      httpHeaders: [
        { key: 'Content-Type', value: 'application/json' }
      ],
      httpBody: ''
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Condicional SE" component to Firestore
  addConditionalComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'conditional',
      name: `Condicional SE ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      conditionVariable: '',
      conditionOperator: 'equals',
      conditionValue: ''
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Verificar Horário" component to Firestore
  addTimeCheckComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'time_check',
      name: `Verificar Horário ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      timeStartHour: 9,
      timeStartMinute: 0,
      timeEndHour: 18,
      timeEndMinute: 0,
      timeWeekdays: ['1', '2', '3', '4', '5'],
      timeTimezone: 'America/Sao_Paulo'
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Finalizar Fluxo" component to Firestore
  addFinishComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'finish',
      name: `Finalizar Fluxo ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50)
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Menu de Botões Uazapi" component to Firestore
  addUazapiButtonsComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'uazapi_buttons',
      name: `Botões Uazapi ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      menuText: 'Como podemos te ajudar hoje?',
      menuFooterText: '',
      menuButtonText: '',
      button1Label: 'Opção 1',
      button1Value: 'opcao_1',
      button2Label: '',
      button2Value: '',
      button3Label: '',
      button3Value: '',
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Lista Uazapi" component to Firestore
  addUazapiListComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'uazapi_list',
      name: `Lista Uazapi ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      menuText: 'Como podemos te ajudar hoje?',
      menuFooterText: '',
      menuButtonText: 'Selecionar opção',
      button1Label: 'Opção 1',
      button1Value: 'opcao_1',
      button2Label: '',
      button2Value: '',
      button3Label: '',
      button3Value: '',
      button4Label: '',
      button4Value: '',
      button5Label: '',
      button5Value: '',
      button6Label: '',
      button6Value: '',
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Enviar Mensagem Uazapi" component to Firestore
  addUazapiSendTextComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'uazapi_send_text',
      name: `Enviar TXT Uazapi ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      messageText: 'Escreva sua mensagem Uazapi aqui...'
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Fazer Pergunta" component to Firestore
  addQuestionComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;
    
    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'question',
      name: `Fazer Pergunta ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      questionText: 'Escreva sua pergunta aqui...',
      saveVariableName: ''
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Gerenciar Etiqueta Chatwoot" component to Firestore
  addChatwootLabelComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'chatwoot_label',
      name: `Gerenciar Etiqueta ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      chatwootLabelName: '',
      chatwootLabelAction: 'add'
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Gerenciar Agente Chatwoot" component to Firestore
  addChatwootAgentComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'chatwoot_agent',
      name: `Gerenciar Agente ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      chatwootAgentId: '',
      chatwootAgentName: '',
      chatwootAgentAction: 'assign'
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Gerenciar Equipe Chatwoot" component to Firestore
  addChatwootTeamComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'chatwoot_team',
      name: `Gerenciar Equipe ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      chatwootTeamId: '',
      chatwootTeamName: '',
      chatwootTeamAction: 'assign'
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Add a new "Gerenciar Status Chatwoot" component to Firestore
  addChatwootStatusComponent() {
    const currentNodes = this.nodes();
    const count = currentNodes.length + 1;

    const newNode: FlowNode = {
      id: 'node-' + Date.now(),
      type: 'chatwoot_status',
      name: `Gerenciar Status ${count}`,
      x: 100 + (Math.random() * 50),
      y: 100 + (Math.random() * 50),
      chatwootStatusAction: 'open'
    };

    const updated = [...currentNodes, newNode];
    this.nodes.set(updated);
    this.saveNodes(updated);
    this.selectNode(newNode);
  }

  // Select node to configure in the properties panel
  selectNode(node: FlowNode | null) {
    this.selectedNode.set(node);
    this.httpTestResult.set(null);
    this.chatwootTestResult.set(null);
    this.showRequestDetails.set(false);
    this.showCurlInput.set(false);
    this.curlRawInput = '';
    this.showVariablesPopover.set(false); // Close variables popover on selection
  }

  // Delete the selected node from Firestore
  deleteSelectedNode() {
    const active = this.selectedNode();
    if (!active) return;

    if (active.type === 'start' || active.id === 'node-start') {
      Swal.fire({
        title: 'Operação não permitida',
        text: 'O bloco de início não pode ser excluído.',
        icon: 'error',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    Swal.fire({
      title: 'Excluir componente?',
      text: `Deseja realmente excluir o componente "${active.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const updated = this.nodes()
          .filter(n => n.id !== active.id)
          .map(n => {
            if (n.nextNodeId === active.id) {
              return { ...n, nextNodeId: undefined };
            }
            return n;
          });

        this.nodes.set(updated);
        this.saveNodes(updated);
        this.selectedNode.set(null);

        Swal.fire({
          title: 'Excluído!',
          text: 'O componente foi excluído com sucesso.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  }

  // Update properties of the selected node and save to Firestore
  updateSelectedNodeProperties(updates: Partial<Omit<FlowNode, 'id' | 'type'>>) {
    const active = this.selectedNode();
    if (!active) return;

    const updatedNode = {
      ...active,
      ...updates
    } as FlowNode;

    const updatedList = this.nodes().map(n => n.id === active.id ? updatedNode : n);
    this.nodes.set(updatedList);
    this.saveNodes(updatedList);
    this.selectedNode.set(updatedNode);
  }

  isWeekdaySelected(day: string): boolean {
    const active = this.selectedNode();
    if (!active || !active.timeWeekdays) return false;
    return active.timeWeekdays.includes(day);
  }

  toggleWeekday(day: string) {
    const active = this.selectedNode();
    if (!active || active.type !== 'time_check') return;

    let weekdays = [...(active.timeWeekdays || [])];
    if (weekdays.includes(day)) {
      weekdays = weekdays.filter(d => d !== day);
    } else {
      weekdays.push(day);
      weekdays.sort();
    }

    this.updateSelectedNodeProperties({ timeWeekdays: weekdays });
  }

  // Handle agent selection to save both agent ID and agent Name
  onAgentSelect(agentId: string) {
    if (!agentId) {
      this.updateSelectedNodeProperties({ chatwootAgentId: '', chatwootAgentName: '' });
      return;
    }
    const agent = this.chatwootAgents().find(a => a.id.toString() === agentId.toString());
    if (agent) {
      this.updateSelectedNodeProperties({
        chatwootAgentId: agentId,
        chatwootAgentName: agent.name || agent.available_name || agent.email
      });
    }
  }

  // Handle team selection to save both team ID and team Name
  onTeamSelect(teamId: string) {
    if (!teamId) {
      this.updateSelectedNodeProperties({ chatwootTeamId: '', chatwootTeamName: '' });
      return;
    }
    const team = this.chatwootTeams().find(t => t.id.toString() === teamId.toString());
    if (team) {
      this.updateSelectedNodeProperties({
        chatwootTeamId: teamId,
        chatwootTeamName: team.name
      });
    }
  }

  /* -------------------------------------------------------------
     HTTP HEADERS CRUD HELPERS
     ------------------------------------------------------------- */
  addHeaderToSelectedNode() {
    const active = this.selectedNode();
    if (!active || active.type !== 'http_request') return;

    const headers = [...(active.httpHeaders || [])];
    headers.push({ key: '', value: '' });

    this.updateSelectedNodeProperties({ httpHeaders: headers });
  }

  removeHeaderFromSelectedNode(index: number) {
    const active = this.selectedNode();
    if (!active || active.type !== 'http_request' || !active.httpHeaders) return;

    const headers = active.httpHeaders.filter((_, i) => i !== index);
    this.updateSelectedNodeProperties({ httpHeaders: headers });
  }

  updateHeaderKey(index: number, key: string) {
    const active = this.selectedNode();
    if (!active || active.type !== 'http_request' || !active.httpHeaders) return;

    const headers = active.httpHeaders.map((h, i) => {
      if (i === index) return { ...h, key: key.trim() };
      return h;
    });
    this.updateSelectedNodeProperties({ httpHeaders: headers });
  }

  updateHeaderValue(index: number, value: string) {
    const active = this.selectedNode();
    if (!active || active.type !== 'http_request' || !active.httpHeaders) return;

    const headers = active.httpHeaders.map((h, i) => {
      if (i === index) return { ...h, value: value };
      return h;
    });
    this.updateSelectedNodeProperties({ httpHeaders: headers });
  }

  /* -------------------------------------------------------------
     DRAG AND DROP / PAN LOGIC (NATIVE JS IN CANVAS)
     ------------------------------------------------------------- */
  onNodeMouseDown(event: MouseEvent, node: FlowNode) {
    if (event.button !== 0) return;
    
    event.preventDefault(); // Prevents browser text drag-and-drop ghost image
    this.activeDragNodeId.set(node.id);
    
    const zoom = this.zoomLevel();
    this.dragOffset = {
      x: (event.clientX / zoom) - node.x,
      y: (event.clientY / zoom) - node.y
    };
    
    this.selectNode(node);
    event.stopPropagation();
  }

  onCanvasMouseDown(event: MouseEvent) {
    // Only pan with left click
    if (event.button !== 0) return;
    
    event.preventDefault(); // Prevents selection highlighting during panning
    this.isPanning.set(true);
    this.panStart = {
      x: event.clientX,
      y: event.clientY,
      offsetX: this.panOffset.x,
      offsetY: this.panOffset.y
    };
  }

  onCanvasMouseMove(event: MouseEvent) {
    const dragId = this.activeDragNodeId();
    if (dragId) {
      const zoom = this.zoomLevel();
      const newX = (event.clientX / zoom) - this.dragOffset.x;
      const newY = (event.clientY / zoom) - this.dragOffset.y;

      const updated = this.nodes().map(n => {
        if (n.id === dragId) {
          return { ...n, x: newX, y: newY };
        }
        return n;
      });
      this.nodes.set(updated);
    } else if (this.isPanning()) {
      const dx = event.clientX - this.panStart.x;
      const dy = event.clientY - this.panStart.y;

      this.panOffset = {
        x: this.panStart.offsetX + dx,
        y: this.panStart.offsetY + dy
      };
    }
  }

  onCanvasMouseUp() {
    const dragId = this.activeDragNodeId();
    if (dragId) {
      this.activeDragNodeId.set(null);
      this.saveNodes(this.nodes());
    }
    if (this.isPanning()) {
      this.isPanning.set(false);
    }
  }

  onCanvasWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1;
      this.changeZoom(zoomDelta);
    }
  }

  changeZoom(delta: number) {
    const newZoom = Math.max(0.1, Math.min(3, this.zoomLevel() + delta));
    this.zoomLevel.set(newZoom);
  }

  zoomIn() { this.changeZoom(0.1); }
  zoomOut() { this.changeZoom(-0.1); }
  resetZoom() { this.zoomLevel.set(1); this.panOffset = { x: 0, y: 0 }; }

  // Helper to filter out self from "next node" selection options
  getPotentialNextNodes(node: FlowNode): FlowNode[] {
    return this.nodes().filter(n => n.id !== node.id);
  }

  /* -------------------------------------------------------------
     HTTP REQUEST TEST TOOL
     ------------------------------------------------------------- */
  replaceVariables(text: string): string {
    if (!text) return '';
    let result = text;
    this.variables().forEach(v => {
      const placeholder = `{${v.name}}`;
      result = result.replaceAll(placeholder, v.defaultValue || '');
    });
    return result;
  }

  getOperatorSymbol(op?: string): string {
    switch(op) {
      case 'equals': return '==';
      case 'not_equals': return '!=';
      case 'contains': return 'contém';
      case 'greater_than': return '>';
      case 'less_than': return '<';
      case 'exists': return 'existe';
      case 'not_exists': return 'ñ existe';
      default: return '==';
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.copyIndicator.set(text);
      setTimeout(() => {
        if (this.copyIndicator() === text) {
          this.copyIndicator.set(null);
        }
      }, 1800);
    }).catch(err => {
      console.error('Erro ao copiar para a área de transferência:', err);
    });
  }

  toggleVariablesPopover(event: MouseEvent) {
    event.stopPropagation();
    this.showVariablesPopover.update(v => !v);
  }

  async toggleFlowActive() {
    const nextState = !this.flowIsActive();
    
    // 1. Show modal in loading state
    this.botActiveModalState.set('loading');
    this.botActiveModalText.set(nextState ? 'Ativando o bot de atendimento...' : 'Desativando o bot de atendimento...');
    this.showBotActiveModal.set(true);

    try {
      // Update database
      await this.flowService.updateFlow(this.projectId(), this.flowId(), {
        isActive: nextState
      });

      // Update local state
      this.flowIsActive.set(nextState);

      // 2. Wait 800ms to show the loading effect naturally
      await new Promise(resolve => setTimeout(resolve, 800));

      // 3. Transition to success state
      this.botActiveModalState.set('success');
      this.botActiveModalText.set(nextState ? 'Bot ativado com sucesso!' : 'Bot desativado com sucesso!');

      // 4. Wait another 1000ms for user reading before closing
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (err) {
      console.error('Erro ao atualizar status ativo do fluxo:', err);
      
      // Rollback UI toggle
      this.flowIsActive.set(!nextState);

      // Transition to error feedback
      this.botActiveModalState.set('success');
      this.botActiveModalText.set('Erro ao atualizar o bot. Tente novamente.');
      await new Promise(resolve => setTimeout(resolve, 1500));
    } finally {
      // 5. Dismiss modal
      this.showBotActiveModal.set(false);
    }
  }

  async testSelectedHttpRequest() {
    const active = this.selectedNode();
    if (!active || active.type !== 'http_request') return;

    const url = this.replaceVariables(active.httpUrl || '');
    if (!url) {
      Swal.fire({
        title: 'URL inválida',
        text: 'Por favor, informe uma URL válida antes de testar.',
        icon: 'warning',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    const method = active.httpMethod || 'GET';
    const headersObj: Record<string, string> = {};

    if (active.httpHeaders) {
      active.httpHeaders.forEach(h => {
        if (h.key && h.value) {
          const key = this.replaceVariables(h.key);
          const val = this.replaceVariables(h.value);
          headersObj[key] = val;
        }
      });
    }

    let body: string | undefined = undefined;
    if (method !== 'GET' && active.httpBody) {
      body = this.replaceVariables(active.httpBody);
    }

    this.isTestingHttp.set(true);
    this.httpTestResult.set(null);

    try {
      const options: RequestInit = {
        method,
        headers: headersObj,
      };

      if (body !== undefined) {
        options.body = body;
      }

      const startTime = Date.now();
      const response = await fetch(url, options);
      const duration = Date.now() - startTime;
      const status = response.status;
      const statusText = response.statusText;
      
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseBody = '';
      try {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          responseBody = JSON.stringify(parsed, null, 2);
        } catch {
          responseBody = text;
        }
      } catch (err: any) {
        responseBody = 'Não foi possível ler o corpo da resposta: ' + err.message;
      }

      this.httpTestResult.set({
        success: response.ok,
        status,
        statusText,
        duration,
        body: responseBody,
        headers: responseHeaders,
        request: {
          url,
          method,
          headers: headersObj,
          body: body || ''
        }
      });
    } catch (error: any) {
      console.error('Erro de conexão no teste HTTP:', error);
      this.httpTestResult.set({
        success: false,
        status: 0,
        statusText: 'Erro de Conexão / CORS / URL Inválida',
        duration: 0,
        body: error.message || 'Verifique o console do navegador. Requisições HTTP feitas diretamente do navegador podem ser bloqueadas pela política de CORS do servidor de destino.',
        headers: {},
        request: {
          url,
          method,
          headers: headersObj,
          body: body || ''
        }
      });
    } finally {
      this.isTestingHttp.set(false);
    }
  }

  /* -------------------------------------------------------------
     HTTP REQUEST DETAILS HELPERS
     ------------------------------------------------------------- */
  toggleRequestDetails() {
    this.showRequestDetails.update(v => !v);
  }

  getRequestHeadersCount(): number {
    const req = this.httpTestResult()?.request;
    return req && req.headers ? Object.keys(req.headers).length : 0;
  }

  getRequestHeadersJson(): string {
    const req = this.httpTestResult()?.request;
    return req && req.headers ? JSON.stringify(req.headers, null, 2) : '{}';
  }

  async testChatwootSendMessage() {
    const active = this.selectedNode();
    if (!active || active.type !== 'message') return;

    const config = this.chatwootConfig();
    if (!config) {
      Swal.fire({
        title: 'Credenciais ausentes',
        text: 'Credenciais do Chatwoot não encontradas. Certifique-se de configurar e ativar a integração nos detalhes do projeto.',
        icon: 'error',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    const convId = this.chatwootTestConversationId.trim();
    if (!convId) {
      Swal.fire({
        title: 'ID da conversa obrigatório',
        text: 'Por favor, informe o ID da conversa ativa do Chatwoot.',
        icon: 'warning',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    localStorage.setItem('chatwoot_test_conv_id', convId);

    const messageText = this.replaceVariables(active.messageText || '');
    if (!messageText) {
      Swal.fire({
        title: 'Mensagem vazia',
        text: 'Escreva a mensagem do bloco antes de testar.',
        icon: 'warning',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    this.isTestingChatwoot.set(true);
    this.chatwootTestResult.set(null);

    // Auto-fix URL protocols
    let rawUrl = config.url.trim();
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = 'https://' + rawUrl;
    }
    const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    const endpoint = `${cleanUrl}/api/v1/accounts/${config.accountId}/conversations/${convId}/messages`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': config.token
        },
        body: JSON.stringify({
          content: messageText,
          message_type: 'outgoing'
        })
      });

      const status = response.status;
      const statusText = response.statusText;

      if (response.ok) {
        this.chatwootTestResult.set({
          success: true,
          status,
          statusText,
          message: 'Mensagem enviada com sucesso para o Chatwoot! Verifique a tela de atendimento.'
        });
      } else {
        let errMsg = 'Rejeitado pelo Chatwoot.';
        try {
          const errData = await response.json();
          if (errData && errData.errors) {
            errMsg = JSON.stringify(errData.errors);
          } else if (errData && errData.message) {
            errMsg = errData.message;
          }
        } catch {}

        this.chatwootTestResult.set({
          success: false,
          status,
          statusText,
          message: 'Falha no envio: ' + errMsg
        });
      }
    } catch (err: any) {
      console.error('Erro ao testar integração Chatwoot:', err);
      this.chatwootTestResult.set({
        success: false,
        status: 0,
        statusText: 'Erro de Conexão / CORS / Rede',
        message: `Falha ao tentar conectar ao servidor em: "${endpoint}". 
                 
1. Verifique se o endereço da instalação do Chatwoot está ativo e online.
2. Certifique-se de que a extensão "Allow CORS" está instalada no seu navegador e ativada (com o ícone verde ligado).
3. Tente atualizar a aba do Flowbuilder no navegador após ligar a extensão.`
      });
    } finally {
      this.isTestingChatwoot.set(false);
    }
  }

  /* -------------------------------------------------------------
     CURL IMPORT LOGIC
     ------------------------------------------------------------- */
  toggleCurlImport() {
    this.showCurlInput.update(v => !v);
    this.curlRawInput = '';
  }

  parseCurl(curlCommand: string) {
    if (!curlCommand) return null;

    // Remove OS specific backslashes or carets line-breaks
    const cleanCommand = curlCommand.replace(/\\\s*\n/g, ' ').replace(/\^\s*\n/g, ' ').trim();

    let url = '';
    let method = 'GET';
    const headers: { key: string; value: string }[] = [];
    let body = '';

    // HTTP Method match (-X METHOD or --request METHOD)
    const methodMatch = cleanCommand.match(/(?:-X|--request)\s+([A-Z]+)/i);
    if (methodMatch) {
      method = methodMatch[1].toUpperCase();
    } else if (cleanCommand.includes('--data') || cleanCommand.includes('-d ') || cleanCommand.includes('--data-raw')) {
      method = 'POST';
    }

    // URL match (http:// or https://)
    const urlRegex = /(["']?)(https?:\/\/[^\s"']+)\1/i;
    const urlMatch = cleanCommand.match(urlRegex);
    if (urlMatch) {
      url = urlMatch[2];
    } else {
      const urlParamMatch = cleanCommand.match(/--url\s+["']?([^\s"']+)["']?/i);
      if (urlParamMatch) {
        url = urlParamMatch[1];
      }
    }

    // Headers match (-H or --header)
    const headerRegex = /(?:-H|--header)\s+((["'])(.*?)\2|([^\s"']+))/gi;
    let match;
    while ((match = headerRegex.exec(cleanCommand)) !== null) {
      const headerStr = match[3] || match[4] || '';
      const separatorIndex = headerStr.indexOf(':');
      if (separatorIndex !== -1) {
        const key = headerStr.substring(0, separatorIndex).trim();
        const value = headerStr.substring(separatorIndex + 1).trim();
        if (key) {
          headers.push({ key, value });
        }
      }
    }

    // Body match (-d, --data, --data-raw, --data-binary)
    const bodyRegex = /(?:-d|--data|--data-raw|--data-binary)\s+((["'])([\s\S]*?)\2|([^\s"']+))/i;
    const bodyMatch = cleanCommand.match(bodyRegex);
    if (bodyMatch) {
      body = bodyMatch[3] || bodyMatch[4] || '';
    }

    return {
      url,
      method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
      headers,
      body
    };
  }

  applyCurlImport() {
    if (!this.curlRawInput) {
      Swal.fire({
        title: 'Comando cURL vazio',
        text: 'Por favor, cole um comando cURL válido.',
        icon: 'warning',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    const parsed = this.parseCurl(this.curlRawInput);
    if (!parsed || !parsed.url) {
      Swal.fire({
        title: 'Falha na importação cURL',
        text: 'Não foi possível identificar uma URL válida no comando cURL. Verifique se o comando está no formato correto.',
        icon: 'error',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    this.updateSelectedNodeProperties({
      httpUrl: parsed.url,
      httpMethod: parsed.method,
      httpHeaders: parsed.headers,
      httpBody: parsed.body
    });

    this.curlRawInput = '';
    this.showCurlInput.set(false);
    this.httpTestResult.set(null);
  }
}
