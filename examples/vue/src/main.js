import { createApp } from 'vue';
import { defineDdocBot } from '@ddocbot/element';
import App from './App.vue';
import { router } from './training/router.js';
import './style.css';

defineDdocBot();
createApp(App).use(router).mount('#app');
