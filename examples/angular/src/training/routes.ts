import type { Routes } from '@angular/router';
import { ClientFormComponent } from './client-form.component';
import { ClientListComponent } from './client-list.component';

export const routes: Routes = [
  { path: 'training/clients', component: ClientListComponent },
  { path: 'training/clients/new', component: ClientFormComponent }
];
