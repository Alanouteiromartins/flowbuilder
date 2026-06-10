import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProjectService, Project } from '../services/project.service';
import { FlowService, Flow } from '../services/flow.service';
import { VariableService, Variable } from '../services/variable.service';
import { environment } from '../../environments/environment';
import Swal from 'sweetalert2';

export interface Integration {
  key: string;
  name: string;
  description: string;
  icon: string;
  isConnected: boolean;
}

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.css'
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private flowService = inject(FlowService);
  private variableService = inject(VariableService);

  // Active Project & Tab signals
  projectId = signal<string>('');
  project = signal<Project | null>(null);
  activeTab = signal<'flows' | 'integrations' | 'variables' | 'settings'>('flows');

  // Sub-items lists (Flows, Variables, Integrations)
  flows = signal<Flow[]>([]);
  variables = signal<Variable[]>([]);
  integrations = signal<Integration[]>([]);

  // Loading states to avoid empty-state flash before Firestore responds
  isLoadingFlows = signal(true);
  isLoadingVariables = signal(true);

  // Firestore real-time listener unsubs
  private flowsSubscription?: () => void;
  private variablesSubscription?: () => void;

  // CRUD Sub-forms
  isFlowModalOpen = signal(false);
  isVariableModalOpen = signal(false);

  // Chatwoot Config Signals
  isChatwootModalOpen = signal(false);
  chatwootUrl = signal('');
  chatwootAccountId = signal('');
  chatwootInboxId = signal('');
  chatwootToken = signal('');

  // Uazapi Config Signals
  isUazapiModalOpen = signal(false);
  uazapiUrl = signal('');
  uazapiToken = signal('');
  uazapiInstanceId = signal('');

  flowFormId = signal('');
  flowFormName = signal('');
  flowFormDescription = signal('');
  flowFormIsActive = signal(true);
  flowFormIntegrationKey = signal('');

  varFormId = signal('');
  varFormName = signal('');
  varFormType = signal<'Texto' | 'Número' | 'Boolean'>('Texto');
  varFormDefaultValue = signal('');

  // Project Settings form fields
  settingsName = signal('');
  settingsDescription = signal('');
  settingsStatus = signal<'Ativo' | 'Rascunho'>('Ativo');

  ngOnInit() {
    // Read route param 'id'
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.projectId.set(id);
        this.loadProjectDetails(id);
        this.loadProjectSubData(id);
      } else {
        this.router.navigate(['/projects']);
      }
    });

    // Read query param 'tab' to auto-switch active tab
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      if (tab && ['flows', 'integrations', 'variables', 'settings'].includes(tab)) {
        this.activeTab.set(tab as any);
      }
    });
  }

  ngOnDestroy() {
    // Clean up active subscriptions on component destroy
    if (this.flowsSubscription) {
      this.flowsSubscription();
    }
    if (this.variablesSubscription) {
      this.variablesSubscription();
    }
  }

  // Load the project metadata
  private loadProjectDetails(id: string) {
    const proj = this.projectService.getProjectById(id);
    if (proj) {
      this.project.set(proj);
      this.settingsName.set(proj.name);
      this.settingsDescription.set(proj.description);
      this.settingsStatus.set(proj.status);
      this.updateIntegrationsList(proj);
      
      // Auto-sync config from Firestore if present
      if (proj.chatwootConfig) {
        localStorage.setItem(`chatwoot_config_${id}`, JSON.stringify(proj.chatwootConfig));
      }
      if (proj.uazapiConfig) {
        localStorage.setItem(`uazapi_config_${id}`, JSON.stringify(proj.uazapiConfig));
      }
    } else {
      // Fallback if not loaded yet (sometimes async Firestore takes a second)
      setTimeout(() => {
        const retryProj = this.projectService.getProjectById(id);
        if (retryProj) {
          this.project.set(retryProj);
          this.settingsName.set(retryProj.name);
          this.settingsDescription.set(retryProj.description);
          this.settingsStatus.set(retryProj.status);
          this.updateIntegrationsList(retryProj);
          
          if (retryProj.chatwootConfig) {
            localStorage.setItem(`chatwoot_config_${id}`, JSON.stringify(retryProj.chatwootConfig));
          }
          if (retryProj.uazapiConfig) {
            localStorage.setItem(`uazapi_config_${id}`, JSON.stringify(retryProj.uazapiConfig));
          }
        } else {
          console.warn('Projeto não encontrado:', id);
          this.router.navigate(['/projects']);
        }
      }, 500);
    }
  }

  private updateIntegrationsList(proj: Project | null) {
    const defaultIntegrations: Integration[] = [
      { key: 'uazapi', name: 'WhatsApp (Uazapi)', description: 'Conecte sua instância do Uazapi para disparar mensagens de WhatsApp no fluxo.', icon: '🟢', isConnected: !!(proj?.uazapiConnected) },
      { key: 'chatwoot', name: 'Chatwoot', description: 'Conecte sua plataforma de atendimento para transferir conversas do chatbot para atendentes humanos.', icon: '🤖', isConnected: !!(proj?.chatwootConnected) }
    ];
    this.integrations.set(defaultIntegrations);
  }

  // Load scoped sub-data (Flows/Variables strictly Firestore, Integrations flat/local)
  private loadProjectSubData(projId: string) {
    // 1. Subscribe to real-time Flows from Firestore via FlowService
    if (this.flowsSubscription) {
      this.flowsSubscription();
    }
    this.flowsSubscription = this.flowService.subscribeToFlows(
      projId,
      (flowsList) => {
        this.flows.set(flowsList);
        this.isLoadingFlows.set(false);
      },
      (error) => {
        console.error('Erro ao carregar fluxos do Firestore:', error);
        this.isLoadingFlows.set(false);
      }
    );

    // 2. Subscribe to real-time Variables from Firestore via VariableService
    if (this.variablesSubscription) {
      this.variablesSubscription();
    }
    this.variablesSubscription = this.variableService.subscribeToVariables(
      projId,
      (varsList) => {
        this.variables.set(varsList);
        this.isLoadingVariables.set(false);
      },
      (error) => {
        console.error('Erro ao carregar variáveis do Firestore:', error);
        this.isLoadingVariables.set(false);
      }
    );

    // 3. Integrations Setup from active Project config
    this.updateIntegrationsList(this.project());
  }

  // Set the current tab in the sidebar
  selectTab(tab: 'flows' | 'integrations' | 'variables' | 'settings') {
    this.activeTab.set(tab);
  }

  // Persistence helpers for non-Firestore assets
  private saveIntegrations() {
    localStorage.setItem(`integrations_${this.projectId()}`, JSON.stringify(this.integrations()));
  }

  /* -------------------------------------------------------------
     SUB-CRUD: FLOWS (FLUXOS) via Firestore
     ------------------------------------------------------------- */
  openNewFlowModal() {
    this.flowFormId.set('');
    this.flowFormName.set('');
    this.flowFormDescription.set('');
    this.flowFormIsActive.set(true);
    this.flowFormIntegrationKey.set('');
    this.isFlowModalOpen.set(true);
  }

  openEditFlowModal(flow: Flow) {
    if (!flow.id) return;
    this.flowFormId.set(flow.id);
    this.flowFormName.set(flow.name);
    this.flowFormDescription.set(flow.description || '');
    this.flowFormIsActive.set(flow.isActive);
    this.flowFormIntegrationKey.set(flow.integrationKey || '');
    this.isFlowModalOpen.set(true);
  }

  closeFlowModal() {
    this.isFlowModalOpen.set(false);
  }

  async onFlowSubmit() {
    if (!this.flowFormName().trim()) return;

    this.isFlowModalOpen.set(false); // Close immediately for seamless UX
    const id = this.flowFormId();
    const flowData = {
      name: this.flowFormName().trim(),
      description: this.flowFormDescription().trim(),
      isActive: this.flowFormIsActive(),
      integrationKey: this.flowFormIntegrationKey()
    };

    try {
      if (id) {
        // UPDATE: Firestore Cloud
        await this.flowService.updateFlow(this.projectId(), id, flowData);
      } else {
        // CREATE: Firestore Cloud
        await this.flowService.createFlow(this.projectId(), flowData);
      }
    } catch (error) {
      console.error('Erro ao salvar fluxo no Firestore:', error);
      Swal.fire({
        title: 'Erro ao salvar',
        text: 'Falha ao salvar fluxo no Firebase. Verifique sua conexão ou permissões.',
        icon: 'error',
        confirmButtonColor: '#0ea5e9'
      });
    }
  }

  async toggleFlowStatus(flow: Flow) {
    if (!flow.id) return;
    
    try {
      await this.flowService.updateFlow(this.projectId(), flow.id, {
        isActive: !flow.isActive
      });
    } catch (error) {
      console.error('Erro ao alterar status do fluxo no Firestore:', error);
    }
  }

  async onDeleteFlow(flow: Flow) {
    const flowId = flow.id;
    if (!flowId) return;
    
    Swal.fire({
      title: 'Excluir fluxo?',
      text: `Deseja realmente excluir o fluxo "${flow.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await this.flowService.deleteFlow(this.projectId(), flowId);
          Swal.fire({
            title: 'Excluído!',
            text: 'O fluxo foi excluído com sucesso.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        } catch (error) {
          console.error('Erro ao deletar fluxo no Firestore:', error);
          Swal.fire({
            title: 'Erro ao excluir',
            text: 'Falha ao deletar fluxo no Firebase.',
            icon: 'error',
            confirmButtonColor: '#0ea5e9'
          });
        }
      }
    });
  }

  openFlowBuilder(flow: Flow) {
    if (flow.id) {
      this.router.navigate(['/projects', this.projectId(), 'flows', flow.id]);
    }
  }

  /* -------------------------------------------------------------
     SUB-CRUD: VARIABLES (VARIÁVEIS) via Firestore
     ------------------------------------------------------------- */
  openNewVarModal() {
    this.varFormId.set('');
    this.varFormName.set('');
    this.varFormType.set('Texto');
    this.varFormDefaultValue.set('');
    this.isVariableModalOpen.set(true);
  }

  openEditVarModal(v: Variable) {
    if (!v.id) return;
    this.varFormId.set(v.id);
    this.varFormName.set(v.name);
    this.varFormType.set(v.type);
    this.varFormDefaultValue.set(v.defaultValue);
    this.isVariableModalOpen.set(true);
  }

  closeVarModal() {
    this.isVariableModalOpen.set(false);
  }

  async onVarSubmit() {
    if (!this.varFormName().trim()) return;

    this.isVariableModalOpen.set(false); // Close immediately for seamless UX
    const id = this.varFormId();
    const varData = {
      name: this.varFormName().trim().toLowerCase().replace(/\s+/g, '_'),
      type: this.varFormType(),
      defaultValue: this.varFormDefaultValue().trim()
    };

    try {
      if (id) {
        // UPDATE: Firestore Cloud
        await this.variableService.updateVariable(this.projectId(), id, varData);
      } else {
        // CREATE: Firestore Cloud
        await this.variableService.createVariable(this.projectId(), varData);
      }
    } catch (error) {
      console.error('Erro ao salvar variável no Firestore:', error);
      Swal.fire({
        title: 'Erro ao salvar',
        text: 'Falha ao salvar variável no Firebase. Verifique sua conexão.',
        icon: 'error',
        confirmButtonColor: '#0ea5e9'
      });
    }
  }

  async onDeleteVar(v: Variable) {
    const varId = v.id;
    if (!varId) return;
    
    Swal.fire({
      title: 'Excluir variável?',
      text: `Deseja realmente excluir a variável "${v.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await this.variableService.deleteVariable(this.projectId(), varId);
          Swal.fire({
            title: 'Excluída!',
            text: 'A variável foi excluída com sucesso.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        } catch (error) {
          console.error('Erro ao deletar variável no Firestore:', error);
          Swal.fire({
            title: 'Erro ao excluir',
            text: 'Falha ao deletar variável no Firebase.',
            icon: 'error',
            confirmButtonColor: '#0ea5e9'
          });
        }
      }
    });
  }

  /* -------------------------------------------------------------
     SUB-CRUD: INTEGRATIONS (INTEGRAÇÕES)
     ------------------------------------------------------------- */
  async toggleIntegration(integration: Integration) {
    if (integration.key === 'chatwoot' && !integration.isConnected) {
      this.openChatwootConfig();
      return;
    }
    if (integration.key === 'uazapi' && !integration.isConnected) {
      this.openUazapiConfig();
      return;
    }

    const nextState = !integration.isConnected;
    const projId = this.projectId();

    try {
      if (integration.key === 'chatwoot') {
        await this.projectService.updateProject(projId, {
          chatwootConnected: nextState
        });
      } else if (integration.key === 'uazapi') {
        await this.projectService.updateProject(projId, {
          uazapiConnected: nextState
        });
      }

      const updated = this.integrations().map(item => {
        if (item.key === integration.key) {
          return { ...item, isConnected: nextState };
        }
        return item;
      });
      this.integrations.set(updated);
    } catch (err) {
      console.error('Erro ao atualizar conexão no Firestore:', err);
    }
  }

  getConnectedIntegrations(): Integration[] {
    return this.integrations().filter(item => item.isConnected);
  }

  openChatwootConfig() {
    const projId = this.projectId();
    const savedConfig = localStorage.getItem(`chatwoot_config_${projId}`);
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      this.chatwootUrl.set(config.url || '');
      this.chatwootAccountId.set(config.accountId || '');
      this.chatwootInboxId.set(config.inboxId || '');
      this.chatwootToken.set(config.token || '');
    } else {
      this.chatwootUrl.set('');
      this.chatwootAccountId.set('');
      this.chatwootInboxId.set('');
      this.chatwootToken.set('');
    }
    this.isChatwootModalOpen.set(true);
  }

  openUazapiConfig() {
    const projId = this.projectId();
    const savedConfig = localStorage.getItem(`uazapi_config_${projId}`);
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      this.uazapiUrl.set(config.url || '');
      this.uazapiToken.set(config.token || '');
      this.uazapiInstanceId.set(config.instanceId || '');
    } else {
      this.uazapiUrl.set('');
      this.uazapiToken.set('');
      this.uazapiInstanceId.set('');
    }
    this.isUazapiModalOpen.set(true);
  }

  closeUazapiModal() {
    this.isUazapiModalOpen.set(false);
  }

  async saveUazapiConfig() {
    const projId = this.projectId();
    const config = {
      url: this.uazapiUrl().trim(),
      token: this.uazapiToken().trim(),
      instanceId: this.uazapiInstanceId().trim()
    };

    localStorage.setItem(`uazapi_config_${projId}`, JSON.stringify(config));
    
    try {
      // Sync config into Firestore Project Document
      await this.projectService.updateProject(projId, {
        uazapiConfig: config,
        uazapiConnected: true
      });
    } catch (err) {
      console.error('Erro ao sincronizar credenciais da Uazapi no Firestore:', err);
    }
    
    // Mark integration as connected
    const updated = this.integrations().map(item => {
      if (item.key === 'uazapi') {
        return { ...item, isConnected: true };
      }
      return item;
    });
    this.integrations.set(updated);
    
    this.isUazapiModalOpen.set(false);
    Swal.fire({
      title: 'Sucesso!',
      text: 'Integração com a Uazapi configurada e ativada com sucesso!',
      icon: 'success',
      confirmButtonColor: '#0ea5e9'
    });
  }

  closeChatwootModal() {
    this.isChatwootModalOpen.set(false);
  }

  async saveChatwootConfig() {
    const projId = this.projectId();
    const config = {
      url: this.chatwootUrl().trim(),
      accountId: this.chatwootAccountId().trim(),
      inboxId: this.chatwootInboxId().trim(),
      token: this.chatwootToken().trim()
    };

    localStorage.setItem(`chatwoot_config_${projId}`, JSON.stringify(config));
    
    try {
      // Sync config into Firestore Project Document
      await this.projectService.updateProject(projId, {
        chatwootConfig: config,
        chatwootConnected: true
      });
    } catch (err) {
      console.error('Erro ao sincronizar credenciais do Chatwoot no Firestore:', err);
    }
    
    // Marca a integração como conectada
    const updated = this.integrations().map(item => {
      if (item.key === 'chatwoot') {
        return { ...item, isConnected: true };
      }
      return item;
    });
    this.integrations.set(updated);
    
    this.isChatwootModalOpen.set(false);
    Swal.fire({
      title: 'Sucesso!',
      text: 'Integração com o Chatwoot configurada e ativada com sucesso!',
      icon: 'success',
      confirmButtonColor: '#0ea5e9'
    });
  }

  getWebhookUrl(): string {
    const pId = environment.firebase.projectId;
    let baseUrl = (environment as any).backendUrl || `https://us-central1-${pId}.cloudfunctions.net`;
    // Remove barra invertida ou barra normal no final da URL para evitar barras duplicadas //
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    return `${baseUrl}/chatwootWebhook?projectId=${this.projectId()}`;
  }

  copyWebhookUrl(inputEl: HTMLInputElement) {
    inputEl.select();
    document.execCommand('copy');
    Swal.fire({
      title: 'Copiado!',
      text: 'URL do Webhook copiada com sucesso! Cole-a nas configurações de Webhook do seu Chatwoot.',
      icon: 'success',
      confirmButtonColor: '#0ea5e9'
    });
  }

  /* -------------------------------------------------------------
     SUB-CRUD: SETTINGS (CONFIGURAÇÕES DO PROJETO)
     ------------------------------------------------------------- */
  async onProjectSettingsSubmit() {
    if (!this.settingsName().trim()) return;

    try {
      await this.projectService.updateProject(this.projectId(), {
        name: this.settingsName().trim(),
        description: this.settingsDescription().trim(),
        status: this.settingsStatus()
      });
      
      // Update local object
      const currentProj = this.project();
      if (currentProj) {
        this.project.set({
          ...currentProj,
          name: this.settingsName().trim(),
          description: this.settingsDescription().trim(),
          status: this.settingsStatus()
        });
      }
      
      Swal.fire({
        title: 'Sucesso!',
        text: 'Configurações do projeto atualizadas com sucesso!',
        icon: 'success',
        confirmButtonColor: '#0ea5e9'
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      Swal.fire({
        title: 'Erro',
        text: 'Ocorreu um erro ao atualizar.',
        icon: 'error',
        confirmButtonColor: '#0ea5e9'
      });
    }
  }
}
