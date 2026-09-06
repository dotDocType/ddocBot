<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { createTrainingBridge } from './training/bridge.js';
import { router } from './training/router.js';

const bot = ref(null);
const status = ref('Pronto para começar');
const busy = ref(false);
const soundEnabled = ref(false);
const simulateFailure = ref(false);
const automaticNavigation = ref(false);
const trainingState = ref('idle');
const startingTraining = ref(false);
const trainingFeedback = ref('O roteiro será carregado quando o exemplo estiver pronto.');
const runningTraining = computed(() => [
  'waiting-route', 'waiting-target', 'presenting', 'active', 'paused'
].includes(trainingState.value));
const trainingStartUnavailable = computed(() => startingTraining.value || runningTraining.value);
const saveTimers = new Set();
let timer;
let trainingBridge;

provide('trainingShell', {
  registerTarget(key, element) {
    trainingBridge?.registerTarget(key, element);
  },
  saveClient
});

onMounted(() => {
  bot.value.volume = 0.35;
  bot.value.movementWidth = 180;
  trainingBridge = createTrainingBridge(bot.value, router);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  for (const saveTimer of saveTimers) clearTimeout(saveTimer);
  trainingBridge?.dispose();
});

async function enableSound() {
  if (!bot.value) return;
  soundEnabled.value = await bot.value.enableSound();
  status.value = soundEnabled.value ? 'Som ativado' : 'Não foi possível ativar o som';
}

function runTask() {
  if (busy.value || !bot.value) return;

  busy.value = true;
  bot.value.say('Estou preparando tudo ✨', { duration: 1600 });
  if (soundEnabled.value) bot.value.playSound('beep');
  const taskId = bot.value.beginTask();

  timer = setTimeout(() => {
    bot.value?.endTask(taskId, { outcome: 'success' });
    bot.value?.say('Tudo pronto!', { duration: 2200 });
    if (soundEnabled.value) bot.value?.playSound('success');
    busy.value = false;
  }, 1400);
}

async function guideToHighlight() {
  if (!bot.value) return;
  status.value = 'Voando até o destaque';
  const result = await bot.value.flyTo('#guide-target');
  if (result !== 'arrived') {
    status.value = result === 'cancelled' ? 'Voo cancelado' : 'Destaque indisponível';
    return;
  }
  bot.value.pointAt('#guide-target');
  bot.value.say('Cheguei ao destaque!', { duration: 0 });
  status.value = 'Apontando para o destaque';
}

async function returnHome() {
  if (!bot.value) return;
  bot.value.stopPointing();
  await bot.value.returnHome();
  bot.value.dismissBubble();
  status.value = 'Pronto para começar';
}

function onStateChange(event) {
  const { state, pendingTasks } = event.detail;
  status.value = pendingTasks
    ? `${state} · ${pendingTasks} tarefa(s)`
    : state === 'success' ? 'Concluído com sucesso' : 'Pronto para começar';
}

async function startTraining() {
  if (!bot.value || trainingStartUnavailable.value) return;
  startingTraining.value = true;
  try {
    await router.push({ name: 'clients-list' });
    if (!bot.value || runningTraining.value) return;
    trainingBridge?.dispose();
    trainingBridge = createTrainingBridge(bot.value, router, {
      navigation: automaticNavigation.value ? 'automatic' : 'user'
    });
    bot.value.training.start();
  } finally {
    startingTraining.value = false;
  }
}

function saveClient() {
  const controller = bot.value.training;
  const token = controller.token;
  const shouldFail = simulateFailure.value;
  return new Promise(resolve => {
    const saveTimer = setTimeout(() => {
      saveTimers.delete(saveTimer);
      if (shouldFail) {
        controller.message(
          'Não foi possível salvar. Desmarque a falha simulada e tente novamente.',
          { token, duration: 6000 }
        );
        resolve('Não foi possível salvar o cliente.');
      } else {
        controller.signal('client-saved', { token });
        resolve('Cliente salvo com sucesso.');
      }
    }, 350);
    saveTimers.add(saveTimer);
  });
}

function onTrainingStateChange(event) {
  trainingState.value = event.detail.state;
  const labels = {
    idle: 'Nenhum roteiro carregado.',
    ready: 'Roteiro pronto.',
    'waiting-route': 'Abra a tela indicada para continuar.',
    'waiting-target': 'Aguardando o componente…',
    presenting: 'Preparando a orientação…',
    active: 'Siga a instrução no balão do ddocBot.',
    paused: 'Treinamento pausado. Você pode retomar quando quiser.',
    completed: 'Treinamento concluído!',
    cancelled: 'Treinamento encerrado.'
  };
  trainingFeedback.value = labels[event.detail.state];
}
</script>

<template>
  <main>
    <section class="card">
      <p class="eyebrow">Web Component em ação</p>
      <h1>DdocBot com Vue 3</h1>
      <p class="intro">Um assistente pequeno para deixar tarefas assíncronas mais vivas.</p>

      <div class="demo">
        <dot-bot
          ref="bot"
          class="bot"
          @ddocbot-statechange="onStateChange"
          @ddocbot-trainingstatechange="onTrainingStateChange"
        />
        <div>
          <span class="label">Status</span>
          <strong aria-live="polite">{{ status }}</strong>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="secondary" :disabled="soundEnabled" @click="enableSound">
          {{ soundEnabled ? 'Som ativado' : 'Ativar som' }}
        </button>
        <button type="button" :disabled="busy" @click="runTask">
          {{ busy ? 'Executando…' : 'Executar tarefa' }}
        </button>
      </div>

      <section class="guidance-example" aria-labelledby="guidance-title">
        <div><span class="label">Guia visual</span><h2 id="guidance-title">Mostre o próximo passo</h2></div>
        <div id="guide-target">Confira este destaque antes de continuar.</div>
        <div class="guide-actions"><button type="button" @click="guideToHighlight">Guiar até o destaque</button><button type="button" class="secondary" @click="returnHome">Voltar para casa</button></div>
      </section>

      <section class="training-example" aria-labelledby="training-title">
        <div>
          <span class="label">Treinamento com rotas reais</span>
          <h2 id="training-title">Cadastre um cliente com o ddocBot</h2>
          <p class="intro">O Vue Router troca as telas e confirma ao componente quando cada uma terminou de renderizar.</p>
        </div>

        <div class="training-actions">
          <button type="button" :disabled="trainingStartUnavailable" @click="startTraining">
            Iniciar treinamento
          </button>
          <label class="training-check">
            <input v-model="simulateFailure" type="checkbox">
            Simular falha ao salvar
          </label>
          <label class="training-check training-check-wide">
            <input v-model="automaticNavigation" type="checkbox" :disabled="runningTraining">
            Solicitar navegação automática entre as etapas
          </label>
        </div>

        <p class="training-feedback" aria-live="polite">{{ trainingFeedback }}</p>
        <nav class="training-routes" aria-label="Telas do treinamento">
          <RouterLink :to="{ name: 'clients-list' }">Lista de clientes</RouterLink>
          <RouterLink :to="{ name: 'client-new' }">Tela de cadastro</RouterLink>
        </nav>

        <RouterView />
      </section>
    </section>
  </main>
</template>

<style scoped>
.training-example {
  display: grid;
  gap: 16px;
  margin-top: 30px;
  padding-top: 26px;
  border-top: 1px solid #dbe4f3;
}
.training-example h2,
.training-screen :deep(h2) { margin: 4px 0 0; font-size: 1.35rem; }
.training-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: stretch; }
.training-check {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 14px;
  color: #4d46ce;
  background: #e8e7ff;
  font-weight: 700;
  cursor: pointer;
}
.training-check input { inline-size: 20px; block-size: 20px; accent-color: #4d46ce; }
.training-check-wide { grid-column: 1 / -1; }
.training-feedback { min-height: 24px; margin: 0; color: #667085; }
.training-routes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.training-routes a {
  min-height: 44px;
  display: grid;
  place-items: center;
  padding: 10px 14px;
  border: 2px solid transparent;
  border-radius: 14px;
  color: #4d46ce;
  background: #f0efff;
  font-weight: 750;
  text-decoration: none;
}
.training-routes a:focus-visible,
.training-check:has(input:focus-visible) { outline: 3px solid #635bff; outline-offset: 2px; }
.training-routes a.router-link-active { border-color: #635bff; }
.training-screen {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid #c9cafc;
  border-radius: 18px;
  background: #f8f8ff;
}
.training-screen :deep(p) { margin: 0; color: #667085; }
.training-screen :deep(form) { display: grid; gap: 10px; }
.training-screen :deep(label) { font-weight: 700; }
.training-screen :deep(input) {
  min-height: 48px;
  width: 100%;
  border: 2px solid #c9cafc;
  border-radius: 12px;
  padding: 10px 12px;
  color: #172033;
  background: #fff;
  font: inherit;
}
.training-screen :deep(input:focus-visible) { outline: 3px solid #635bff; outline-offset: 2px; }
@media (max-width: 520px) {
  .training-actions,
  .training-routes { grid-template-columns: 1fr; }
}
</style>
