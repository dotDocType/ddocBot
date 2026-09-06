import script from './training.json';
import { normalizeProgress } from '../src/training/schema.js';

/** The demo application owns route changes and business confirmation. */
export function setupTrainingDemo(bot) {
  const controller = bot.training;
  if (!controller) return;
  const $ = id => document.getElementById(id);
  const screen = $('training-screen');
  const feedback = $('training-feedback');
  const pendingTimers = new Set();
  const pendingFrames = new Set();
  const subscriptions = new AbortController();
  let route = '';
  let routeRequest = null;
  const routeFromHash = () => ({ '#training/list': 'clients-list', '#training/new': 'client-new' })[location.hash] ?? null;
  const scheduleFrame = callback => {
    const id = requestAnimationFrame(() => { pendingFrames.delete(id); callback(); });
    pendingFrames.add(id);
  };
  const listen = (node, event, handler) => node.addEventListener(event, handler, { signal: subscriptions.signal });

  function confirmReady(request) {
    scheduleFrame(() => {
      if (request !== routeRequest || route !== request.route || controller.token !== request.token) return;
      const accepted = controller.routeReady(request.route, { token: request.token });
      if (accepted && request === routeRequest) routeRequest = null;
    });
  }

  function renderScreen() {
    $('training-route-label').textContent = route === 'client-new' ? 'CLIENTES / NOVO CADASTRO' : 'CLIENTES / LISTA';
    if (route === 'clients-list') {
      screen.innerHTML = '<h3>Seus clientes</h3><p>Seu próximo cadastro começa aqui.</p><div class="training-empty">Ainda não há clientes nesta demonstração.</div><button id="training-new-client" type="button">Novo cliente</button>';
      listen($('training-new-client'), 'click', () => navigate('client-new'));
      return;
    }
    screen.innerHTML = '<h3>Novo cadastro</h3><form id="training-client-form"><label for="training-client-name">Nome do cliente</label><input id="training-client-name" name="name" autocomplete="off" required><button id="training-save-client" type="submit">Salvar cliente</button><p id="training-save-result" aria-live="polite"></p></form>';
    listen($('training-client-form'), 'submit', event => {
      event.preventDefault();
      const button = $('training-save-client');
      const result = $('training-save-result');
      const token = controller.token; // Capture BEFORE the simulated request.
      const shouldFail = $('training-fail').checked;
      button.disabled = true;
      result.textContent = 'Salvando…';
      const timer = setTimeout(() => {
        pendingTimers.delete(timer);
        button.disabled = false;
        result.textContent = shouldFail ? 'Não foi possível salvar o cliente.' : 'Cliente salvo com sucesso.';
        if (shouldFail) controller.message('Não foi possível salvar. Desmarque a falha simulada e tente novamente.', { token });
        else controller.signal('client-saved', { token });
      }, 350);
      pendingTimers.add(timer);
    });
  }

  function setRoute(next) {
    if (!next || next === route) return;
    controller.routeChanged(next);
    route = next;
    renderScreen();
    if (routeRequest) confirmReady(routeRequest);
  }

  function navigate(next) {
    const hash = next === 'client-new' ? '#training/new' : '#training/list';
    if (location.hash !== hash) history.pushState(null, '', hash);
    setRoute(next);
  }

  listen(window, 'popstate', () => setRoute(routeFromHash()));
  listen(window, 'hashchange', () => setRoute(routeFromHash()));
  listen($('training-list-route'), 'click', () => navigate('clients-list'));
  listen($('training-new-route'), 'click', () => navigate('client-new'));
  listen(bot, 'ddocbot-trainingroute', ({ detail }) => {
    routeRequest = { route: detail.route, token: detail.token };
    if (detail.navigation === 'automatic' && route !== detail.route) navigate(detail.route);
    confirmReady(routeRequest);
  });
  listen(bot, 'ddocbot-trainingstatechange', ({ detail }) => {
    const running = ['waiting-route', 'waiting-target', 'presenting', 'active', 'paused'].includes(detail.state);
    $('training-start').disabled = running;
    $('training-resume').hidden = detail.state !== 'paused';
    $('training-export').disabled = controller.getProgress() === null;
    const labels = { idle: 'Nenhum roteiro carregado.', ready: 'Roteiro pronto.',
      'waiting-route': 'Abra a tela indicada para continuar.', 'waiting-target': 'Aguardando o componente…',
      presenting: 'Preparando a orientação…', active: 'Siga a instrução no balão do ddocBot.',
      paused: 'Treinamento pausado. Você pode retomar quando quiser.', completed: 'Treinamento concluído!', cancelled: 'Treinamento encerrado.' };
    feedback.textContent = labels[detail.state];
  });
  listen($('training-start'), 'click', () => {
    controller.stop();
    navigate('clients-list');
    const training = structuredClone(script);
    if ($('training-automatic').checked) {
      for (const step of training.steps) if (step.route) step.navigation = 'automatic';
    }
    controller.load(training, { resolveTarget: key => key === 'client-name' ? $('training-client-name') : null });
    controller.start();
  });
  listen($('training-resume'), 'click', () => controller.resume());
  listen($('training-export'), 'click', () => {
    $('training-progress').value = JSON.stringify(controller.getProgress(), null, 2);
    feedback.textContent = 'Progresso exportado. A aplicação decide onde armazená-lo.';
  });
  listen($('training-restore'), 'click', () => {
    try {
      // The local demo shares the schema validator to keep invalid pastes atomic.
      const progress = normalizeProgress(JSON.parse($('training-progress').value), script);
      controller.stop();
      controller.load(script, { resolveTarget: key => key === 'client-name' ? $('training-client-name') : null });
      controller.restoreProgress(progress);
      feedback.textContent = controller.state === 'paused'
        ? 'Progresso restaurado. Escolha Retomar para continuar.'
        : 'Progresso restaurado. Este treinamento já foi encerrado.';
    } catch (error) { feedback.textContent = `Não foi possível restaurar: ${error.message}`; }
  });
  setRoute(routeFromHash() ?? 'clients-list');
  listen(window, 'pagehide', () => {
    for (const timer of pendingTimers) clearTimeout(timer);
    for (const frame of pendingFrames) cancelAnimationFrame(frame);
    subscriptions.abort();
  });
}
