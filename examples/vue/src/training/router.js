import { createRouter, createWebHashHistory } from 'vue-router';
import ClientList from './ClientList.vue';
import ClientForm from './ClientForm.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/training/clients', name: 'clients-list', component: ClientList },
    { path: '/training/clients/new', name: 'client-new', component: ClientForm }
  ]
});
