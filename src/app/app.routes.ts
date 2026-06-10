import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ProjectsComponent } from './projects/projects.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';
import { FlowbuilderComponent } from './flowbuilder/flowbuilder.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'projects', component: ProjectsComponent, canActivate: [authGuard] },
  { path: 'projects/:id', component: ProjectDetailComponent, canActivate: [authGuard] },
  { path: 'projects/:projectId/flows/:flowId', component: FlowbuilderComponent, canActivate: [authGuard] },
  { path: 'dashboard', redirectTo: 'projects' },
  { path: '**', redirectTo: '' }
];
