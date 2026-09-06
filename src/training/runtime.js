import { TrainingEngine } from './engine.js';
import { normalizeScript } from './schema.js';
import { resolveTarget, measureTarget } from '../navigation.js';

const PREPARING = ['waiting-target', 'presenting', 'active'];
const POLL_MS = 100;

function nonempty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field}: expected a non-empty string`);
}

function tokenOption(options) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype) {
    throw new TypeError('options: expected an object containing token');
  }
  if (options.token !== null) nonempty(options.token, 'token');
  return options.token;
}

function matchesChange(element, condition) {
  if (!condition) return true;
  if (condition.kind === 'checked') return typeof element.checked === 'boolean' && element.checked === condition.value;
  if (typeof element.value !== 'string') return false;
  return condition.kind === 'nonempty' ? element.value.trim() !== '' : element.value === condition.value;
}

/** DOM integration; the component supplies animation and preparation timeout ticks. */
export function createTrainingRuntime({ host, presentation, navigation, audio, emit }) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  let resolver;
  let attempt = null;
  let destroying = false;
  let effectRevision = 0;
  let pendingPresentation = null;
  const consumedEvents = new WeakSet();
  const connected = () => !destroying && host.isConnected;
  const engine = new TrainingEngine({ emit, effect: runEffect });

  function valid(operation, states = PREPARING) {
    return connected() && engine.visible && attempt?.operation === operation &&
      !operation.abort.signal.aborted && engine.token === attempt.token && states.includes(engine.state);
  }

  function dispose(operation) {
    if (!operation || operation.abort.signal.aborted) return;
    operation.abort.abort();
    operation.observer?.disconnect();
    win.clearTimeout(operation.timer);
    operation.timer = null;
  }

  function release(effect, revision) {
    if (attempt && attempt.token !== effect.token) return;
    dispose(attempt?.operation);
    if (attempt) attempt.operation = null;
    if (effect.reason !== 'hidden') attempt = null;
    audio.stopTraining();
    if (effectRevision === revision) navigation.halt();
  }

  function fail(operation, code) {
    if (valid(operation)) engine.fail(code, attempt.token);
  }

  function checkCaptured(operation) {
    if (!valid(operation)) return false;
    if (attempt.target && !measureTarget(attempt.target, doc)) {
      fail(operation, 'target-lost');
      return false;
    }
    return true;
  }

  function observe(operation) {
    operation.observer = new win.MutationObserver(() => {
      if (!valid(operation)) return;
      if (engine.state === 'waiting-target') schedulePoll(operation);
      else if (attempt.target) checkCaptured(operation);
    });
    operation.observer.observe(doc, { childList: true, subtree: true, attributes: true });
  }

  function schedulePoll(operation) {
    if (!valid(operation, ['waiting-target']) || operation.timer !== null) return;
    const delay = Math.max(0, POLL_MS - (win.performance.now() - operation.lastPoll));
    operation.timer = win.setTimeout(() => {
      operation.timer = null;
      resolveAttempt(operation);
    }, delay);
  }

  function resolveAttempt(operation) {
    if (!valid(operation, ['waiting-target'])) return;
    operation.lastPoll = win.performance.now();
    const { step } = attempt;
    let target;
    try {
      if (typeof step.target === 'string') {
        const elements = doc.querySelectorAll(step.target);
        if (elements.length > 1) { fail(operation, 'ambiguous-target'); return; }
        target = elements.length ? resolveTarget(elements[0], doc) : null;
      } else if ('ref' in step.target) {
        const element = resolver ? resolver(step.target.ref, { stepId: step.id }) : null;
        if (!valid(operation, ['waiting-target'])) return;
        if (element !== null) {
          target = resolveTarget(element, doc);
          if (!target?.element) { fail(operation, 'target-resolution-failed'); return; }
        }
      } else target = resolveTarget(step.target, doc);
    } catch {
      fail(operation, 'target-resolution-failed');
      return;
    }
    if (!valid(operation, ['waiting-target'])) return;
    if (!target || !measureTarget(target, doc)) { schedulePoll(operation); return; }
    attempt.target = target;
    win.clearTimeout(operation.timer); operation.timer = null;
    engine.targetResolved(attempt.token);
    if (valid(operation, ['presenting'])) void present(operation);
  }

  async function present(operation) {
    if (!valid(operation)) return;
    const current = attempt;
    try {
      if (!checkCaptured(operation)) return;
      if (current.target && !current.arrived) {
        const result = await navigation.flyTo(current.target.element ?? current.target.point);
        if (!valid(operation, ['presenting'])) return;
        if (result !== 'arrived') { fail(operation, 'target-lost'); return; }
        current.arrived = true;
      } else if (!current.target && !current.arrived) {
        const result = await navigation.returnHome();
        if (!valid(operation, ['presenting'])) return;
        if (result !== 'arrived') return;
        current.arrived = true;
      }
      if (!checkCaptured(operation)) return;
      if (current.step.laser) {
        const pointed = navigation.pointAt(current.target.element ?? current.target.point);
        if (!valid(operation)) return;
        if (!pointed) { fail(operation, 'target-lost'); return; }
      }
      if (valid(operation, ['presenting', 'active'])) engine.prepared(current.token);
    } catch {
      fail(operation, 'target-lost');
    }
  }

  function prepare(effect) {
    if (!connected() || !engine.visible || engine.token !== effect.token || !PREPARING.includes(engine.state)) return;
    if (!effect.resume || !attempt || attempt.token !== effect.token) {
      dispose(attempt?.operation);
      attempt = { token: effect.token, step: effect.step, target: null, arrived: false, operation: null };
    }
    dispose(attempt.operation);
    const operation = { abort: new win.AbortController(), observer: null, timer: null,
      lastPoll: -Infinity, geometryElapsed: 0 };
    attempt.operation = operation;
    // Keep presentation asynchronous, including steps without a navigation flight.
    Promise.resolve().then(() => {
      if (!valid(operation)) return;
      observe(operation);
      if (engine.state === 'waiting-target') resolveAttempt(operation);
      else void present(operation);
    });
  }

  function listen(effect) {
    const operation = attempt?.operation;
    if (!operation || effect.token !== attempt.token || !valid(operation, ['active'])) return;
    const element = attempt.target?.element;
    const advance = effect.step.advance;
    if (!element || !['click', 'change'].includes(advance.type)) return;
    element.addEventListener(advance.type, event => {
      if (consumedEvents.has(event) || !valid(operation, ['active']) || !checkCaptured(operation)) return;
      if (advance.type === 'click' ? event.composedPath().includes(element)
        : event.composedPath()[0] === element && matchesChange(element, advance.condition)) {
        // Native dispatch can run microtasks between listeners on different nodes.
        // Mark before entering the engine, whose callbacks may prepare another step.
        consumedEvents.add(event);
        engine.interaction(effect.token);
      }
    }, { capture: true, signal: operation.abort.signal });
  }

  function runEffect(effect) {
    const revision = ++effectRevision;
    switch (effect.type) {
      case 'release': release(effect, revision); break;
      case 'prepare': prepare(effect); break;
      case 'listen': listen(effect); break;
      case 'render':
        pendingPresentation = { ...effect.snapshot, token: effect.token };
        if (connected()) flushPresentation();
        break;
      case 'audio':
        if (attempt?.token === effect.token && valid(attempt.operation, ['active'])) {
          // The audio adapter owns channel identity and reports errors through the existing audio event.
          try { Promise.resolve(audio.playTraining(effect.step.audio)).catch(() => {}); } catch { /* Audio never blocks training. */ }
        }
        break;
      case 'home':
        if (connected()) Promise.resolve(navigation.returnHome()).catch(() => {});
        break;
    }
  }

  function flushPresentation() {
    if (!pendingPresentation || !connected()) return;
    const snapshot = pendingPresentation;
    pendingPresentation = null;
    presentation.render(snapshot);
  }

  const controller = Object.freeze({
    get state() { return engine.state; },
    get currentStep() { return engine.currentStep; },
    get token() { return engine.token; },
    load(script, options = {}) {
      if (engine.running || destroying) throw new Error('Stop the current training before loading a script.');
      if (!options || Object.getPrototypeOf(options) !== Object.prototype ||
        (options.resolveTarget !== undefined && typeof options.resolveTarget !== 'function')) {
        throw new TypeError('options.resolveTarget: expected a function');
      }
      const normalized = normalizeScript(script);
      normalized.steps.forEach((step, index) => {
        if (typeof step.target !== 'string') return;
        try { doc.querySelectorAll(step.target); }
        catch { throw new TypeError(`script.steps[${index}].target: invalid CSS selector`); }
      });
      // Assign before ready events: a synchronous start must use this load's adapter.
      resolver = options.resolveTarget;
      engine.load(normalized, options);
    },
    start: () => connected() && engine.start(),
    next: () => connected() && engine.next(),
    previous: () => connected() && engine.previous(),
    pause: () => engine.pause(),
    resume: () => connected() && engine.resume(),
    stop: () => engine.stop(),
    signal(name, options) {
      nonempty(name, 'name'); tokenOption(options);
      return connected() && engine.signal(name, options);
    },
    routeReady(route, options) {
      nonempty(route, 'route'); tokenOption(options);
      return connected() && engine.routeReady(route, options);
    },
    routeChanged: route => engine.routeChanged(route),
    message(text, options) {
      if (typeof text !== 'string') throw new TypeError('text: expected a string');
      const token = tokenOption(options);
      const duration = options.duration === undefined ? 6000 : options.duration;
      if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) {
        throw new TypeError('duration: expected a finite non-negative number');
      }
      if (!connected() || token === null || token !== engine.token || !['active', 'paused'].includes(engine.state)) return false;
      presentation.message(text, { token, duration });
      return true;
    },
    getProgress: () => engine.getProgress(),
    restoreProgress: snapshot => engine.restoreProgress(snapshot)
  });

  return {
    controller,
    get running() { return engine.running; },
    update(dt) {
      engine.tick(dt);
      const operation = attempt?.operation;
      if (!operation || !valid(operation)) return;
      operation.geometryElapsed += dt;
      if (operation.geometryElapsed >= POLL_MS) {
        operation.geometryElapsed = 0;
        if (attempt.target) checkCaptured(operation);
      }
    },
    visibilityChanged(visible) {
      if (typeof visible !== 'boolean') throw new TypeError('visible: expected a boolean');
      const token = engine.token;
      const restoreHome = !engine.visible && visible && engine.state === 'waiting-route';
      engine.setVisible(visible);
      presentation.setVisible(engine.visible);
      // Mounting may follow a validated offline load/restore without a new state event.
      flushPresentation();
      if (restoreHome && connected() && engine.visible && token === engine.token && engine.state === 'waiting-route') {
        Promise.resolve(navigation.returnHome()).catch(() => {});
      }
    },
    externalCommand() {
      const token = engine.token;
      engine.pause('external-command');
      if (token === engine.token && engine.state === 'paused') {
        pendingPresentation = null;
        presentation.clear();
      }
    },
    destroy() {
      if (destroying) return;
      destroying = true;
      try { engine.destroy(); }
      finally {
        dispose(attempt?.operation); attempt = null; resolver = undefined; pendingPresentation = null;
        presentation.clear(); destroying = false;
      }
    }
  };
}
