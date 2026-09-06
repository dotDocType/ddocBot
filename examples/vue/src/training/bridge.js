import { nextTick } from 'vue';
import { trainingScript } from './script.js';

function routeName(route) {
  return typeof route.name === 'string' ? route.name : route.path;
}

export function createTrainingBridge(bot, router, { navigation = 'user' } = {}) {
  const controller = bot.training;
  const targets = new Map();
  let routeRequest = null;
  let disposed = false;

  async function confirmRendered(request) {
    if (!request) return;
    await nextTick();
    if (disposed || routeRequest !== request) return;
    if (routeName(router.currentRoute.value) !== request.route || controller.token !== request.token) return;
    if (controller.routeReady(request.route, { token: request.token })) routeRequest = null;
  }

  const removeBefore = router.beforeEach(to => {
    controller.routeChanged(routeName(to));
  });
  const removeAfter = router.afterEach((to, from, failure) => {
    if (!failure) void confirmRendered(routeRequest);
  });

  function onTrainingRoute(event) {
    const request = {
      route: event.detail.route,
      navigation: event.detail.navigation,
      token: event.detail.token
    };
    routeRequest = request;

    if (request.navigation === 'automatic' && routeName(router.currentRoute.value) !== request.route) {
      void router.push({ name: request.route });
      return;
    }
    void confirmRendered(request);
  }

  bot.addEventListener('ddocbot-trainingroute', onTrainingRoute);
  const script = structuredClone(trainingScript);
  if (navigation === 'automatic') {
    for (const step of script.steps) {
      if (step.route) step.navigation = 'automatic';
    }
  }
  controller.load(script, {
    resolveTarget: key => targets.get(key) ?? null
  });

  return {
    registerTarget(key, element) {
      if (disposed) return;
      if (element) targets.set(key, element);
      else targets.delete(key);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      routeRequest = null;
      targets.clear();
      removeBefore();
      removeAfter();
      bot.removeEventListener('ddocbot-trainingroute', onTrainingRoute);
    }
  };
}
