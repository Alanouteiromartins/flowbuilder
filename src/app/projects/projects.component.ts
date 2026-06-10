import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ProjectService, Project } from '../services/project.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css'
})
export class ProjectsComponent {
  authService = inject(AuthService);
  projectService = inject(ProjectService);
  router = inject(Router);

  // Search filter query
  searchQuery = signal('');

  // Shortcut keyboard listener to focus search input when pressing "/"
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      event.preventDefault();
      const searchInput = document.querySelector('.search-input') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  }

  // Form states for modals/drawers
  isCreateModalOpen = signal(false);
  isEditModalOpen = signal(false);
  
  // Selected project for editing/deleting
  selectedProject = signal<Project | null>(null);

  // Form fields
  formName = signal('');
  formDescription = signal('');
  formStatus = signal<'Ativo' | 'Rascunho'>('Ativo');

  // Reactively compute the filtered projects list based on the search query
  filteredProjects = computed(() => {
    const list = this.projectService.projects();
    const query = this.searchQuery().toLowerCase().trim();

    if (!query) {
      return list;
    }

    return list.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.description.toLowerCase().includes(query)
    );
  });

  // Get active user details
  get user() {
    return this.authService.currentUser();
  }

  // Open Create Modal
  openCreateModal() {
    this.formName.set('');
    this.formDescription.set('');
    this.formStatus.set('Ativo');
    this.isCreateModalOpen.set(true);
  }

  // Close Create Modal
  closeCreateModal() {
    this.isCreateModalOpen.set(false);
  }

  // Submit Create Project
  async onCreateSubmit() {
    if (!this.formName().trim()) return;

    try {
      await this.projectService.createProject({
        name: this.formName().trim(),
        description: this.formDescription().trim(),
        status: this.formStatus()
      });
      this.closeCreateModal();
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
    }
  }

  // Open Edit Modal
  openEditModal(project: Project) {
    this.selectedProject.set(project);
    this.formName.set(project.name);
    this.formDescription.set(project.description);
    this.formStatus.set(project.status);
    this.isEditModalOpen.set(true);
  }

  // Close Edit Modal
  closeEditModal() {
    this.isEditModalOpen.set(false);
    this.selectedProject.set(null);
  }

  // Submit Edit Project
  async onEditSubmit() {
    const project = this.selectedProject();
    if (!project || !project.id || !this.formName().trim()) return;

    try {
      await this.projectService.updateProject(project.id, {
        name: this.formName().trim(),
        description: this.formDescription().trim(),
        status: this.formStatus()
      });
      this.closeEditModal();
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
    }
  }

  // Delete Project
  async onDeleteProject(project: Project) {
    const projectId = project.id;
    if (!projectId) return;
    
    Swal.fire({
      title: 'Excluir projeto?',
      text: `Tem certeza que deseja excluir o projeto "${project.name}"? Todos os fluxos e variáveis deste projeto também serão deletados.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#535659',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await this.projectService.deleteProject(projectId);
          if (this.selectedProject()?.id === projectId) {
            this.closeEditModal();
          }
          Swal.fire({
            title: 'Excluído!',
            text: 'O projeto foi excluído com sucesso.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        } catch (error) {
          console.error('Erro ao deletar projeto:', error);
          Swal.fire({
            title: 'Erro ao excluir',
            text: 'Não foi possível deletar o projeto. Tente novamente mais tarde.',
            icon: 'error',
            confirmButtonColor: '#2781F6'
          });
        }
      }
    });
  }

  // Log out action
  async onLogout() {
    try {
      await this.authService.logout();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  }

  // Open flowbuilder editor
  openProject(project: Project) {
    if (project.id) {
      this.router.navigate(['/projects', project.id]);
    }
  }
}
