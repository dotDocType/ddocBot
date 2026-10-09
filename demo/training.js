import script from './training.json';
import { normalizeProgress } from '../src/training/schema.js';
import { translate } from './i18n.js';

/** The demo application owns route changes and business confirmation. */
export function setupTrainingDemo(bot, { localeManager } = {}) {
  const controller = bot.training;
  if (!controller) return;
  const $ = id => document.getElementById(id);
  const t = key => translate(localeManager?.locale ?? 'pt-BR', key);
  const screen = $('training-screen');
  const feedback = $('training-feedback');
  const pendingTimers = new Set();
  const pendingFrames = new Set();
  const subscriptions = new AbortController();
  let route = '';
  let routeRequest = null;
  const routeFromHash = () => ({ '#training/list': 'clients-list', '#training/new': 'client-new' })[location.hash] ?? null;
  const localizeScript = () => {
    const localized = structuredClone(script);
    const stepKeys = { welcome: 'welcome', 'open-form': 'openForm', name: 'name', save: 'save' };
    for (const step of localized.steps) step.text = t(`training.steps.${stepKeys[step.id]}`);
    return localized;
  };
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
    const existingName = $('training-client-name')?.value ?? '';
    $('training-route-label').textContent = route === 'client-new' ? t('training.routeLabel.new') : t('training.routeLabel.list');
    if (route === 'clients-list') {
      screen.innerHTML = `<h3>${t('training.screen.listTitle')}</h3><p>${t('training.screen.listCopy')}</p><div class="training-empty">${t('training.screen.empty')}</div><button id="training-new-client" type="button">${t('training.screen.new')}</button>`;
      listen($('training-new-client'), 'click', () => navigate('client-new'));
      return;
    }
    screen.innerHTML = `<h3>${t('training.screen.formTitle')}</h3><form id="training-client-form"><label for="training-client-name">${t('training.screen.name')}</label><input id="training-client-name" name="name" autocomplete="off" required><button id="training-save-client" type="submit">${t('training.screen.save')}</button><p id="training-save-result" aria-live="polite"></p></form>`;
    $('training-client-name').value = existingName;
    listen($('training-client-form'), 'submit', event => {
      event.preventDefault();
      const button = $('training-save-client');
      const result = $('training-save-result');
      const token = controller.token; // Capture BEFORE the simulated request.
      const shouldFail = $('training-fail').checked;
      button.disabled = true;
      result.textContent = t('training.screen.saving');
      const timer = setTimeout(() => {
        pendingTimers.delete(timer);
        button.disabled = false;
        result.textContent = shouldFail ? t('training.screen.saveFailed') : t('training.screen.saved');
        if (shouldFail) controller.message(t('training.state.saveRetry'), { token });
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
  function renderTrainingState(detail) {
    if (!detail) return;
    const running = ['waiting-route', 'waiting-target', 'presenting', 'active', 'paused'].includes(detail.state);
    $('training-start').disabled = running;
    $('training-resume').hidden = detail.state !== 'paused';
    $('training-export').disabled = controller.getProgress() === null;
    const labels = { idle: 'idle', ready: 'ready', 'waiting-route': 'waitingRoute', 'waiting-target': 'waitingTarget', presenting: 'presenting', active: 'active', paused: 'paused', completed: 'completed', cancelled: 'cancelled' };
    feedback.textContent = t(`training.state.${labels[detail.state]}`);
  }
  listen(bot, 'ddocbot-trainingstatechange', ({ detail }) => renderTrainingState(detail));
  listen($('training-start'), 'click', () => {
    controller.stop();
    navigate('clients-list');
    const training = localizeScript();
    if ($('training-automatic').checked) {
      for (const step of training.steps) if (step.route) step.navigation = 'automatic';
    }
    controller.load(training, { resolveTarget: key => key === 'client-name' ? $('training-client-name') : null });
    controller.start();
  });
  listen($('training-resume'), 'click', () => controller.resume());
  listen($('training-export'), 'click', () => {
    $('training-progress').value = JSON.stringify(controller.getProgress(), null, 2);
    feedback.textContent = t('training.state.exported');
  });
  listen($('training-restore'), 'click', () => {
    try {
      // The local demo shares the schema validator to keep invalid pastes atomic.
      const localized = localizeScript();
      const progress = normalizeProgress(JSON.parse($('training-progress').value), localized);
      controller.stop();
      controller.load(localized, { resolveTarget: key => key === 'client-name' ? $('training-client-name') : null });
      controller.restoreProgress(progress);
      feedback.textContent = controller.state === 'paused'
        ? t('training.state.restoredPaused')
        : t('training.state.restoredFinished');
    } catch (error) { feedback.textContent = t('training.state.restoreError', { message: error.message }); }
  });
  setRoute(routeFromHash() ?? 'clients-list');
  const unsubscribeLocale = localeManager?.subscribe(() => {
    renderScreen();
    renderTrainingState({ state: controller.state });
  });
  listen(window, 'pagehide', () => {
    for (const timer of pendingTimers) clearTimeout(timer);
    for (const frame of pendingFrames) cancelAnimationFrame(frame);
    subscriptions.abort();
    unsubscribeLocale?.();
  });
}
