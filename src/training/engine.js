import { normalizeScript, normalizeProgress } from './schema.js';

let instanceSequence = 0;
const RUNNING = new Set(['waiting-route', 'waiting-target', 'presenting', 'active', 'paused']);
const ERRORS = {
  timeout: 'Training preparation timed out.',
  'target-lost': 'The training target is no longer available.',
  'ambiguous-target': 'More than one element matches the training target.',
  'target-resolution-failed': 'The training target could not be resolved.'
};
const PAUSE_REASONS = new Set(['user', 'route-changed', 'external-command', ...Object.keys(ERRORS)]);
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function nonempty(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field}: expected a non-empty string`);
  }
}

function tokenOption(options) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype) {
    throw new TypeError('options: expected an object containing token');
  }
  if (options.token !== null) nonempty(options.token, 'token');
  return options.token;
}

/** Browser-independent sequential state machine. Effects must complete synchronously;
 * asynchronous adapters report readiness through the token-bound internal methods.
 */
export class TrainingEngine {
  #emitCallback;
  #effectCallback;
  #makeToken;
  #instance = ++instanceSequence;
  #sessionSequence = 0;
  #attemptSequence = 0;
  #revision = 0;
  #script = null;
  #state = 'idle';
  #index = -1;
  #token = null;
  #sessionId = null;
  #visible = true;
  #remaining = 0;
  #reason;
  #satisfied = false;
  #preparationStarted = false;
  #restoring = false;
  #destroying = false;

  constructor({ emit = () => {}, effect = () => {}, makeToken } = {}) {
    for (const [name, value] of Object.entries({ emit, effect })) {
      if (typeof value !== 'function') throw new TypeError(`${name}: expected a function`);
    }
    if (makeToken !== undefined && typeof makeToken !== 'function') {
      throw new TypeError('makeToken: expected a function');
    }
    this.#emitCallback = emit;
    this.#effectCallback = effect;
    this.#makeToken = makeToken ?? (() => `training-${this.#instance}-${++this.#attemptSequence}`);
  }

  get state() { return this.#state; }
  get token() { return this.#token; }
  get running() { return RUNNING.has(this.#state); }
  get visible() { return this.#visible; }
  get currentStep() {
    if (this.#index < 0 || !this.#script) return null;
    return { ...clone(this.#script.steps[this.#index]), index: this.#index, total: this.#script.steps.length };
  }

  load(value, options = {}) {
    if (this.running || this.#destroying) throw new Error('Stop the current training before loading a script.');
    if (!options || Object.getPrototypeOf(options) !== Object.prototype ||
        (options.resolveTarget !== undefined && typeof options.resolveTarget !== 'function')) {
      throw new TypeError('options.resolveTarget: expected a function');
    }
    const script = normalizeScript(value);
    const previousState = this.#state;
    this.#script = script;
    this.#index = -1;
    this.#sessionId = null;
    this.#token = null;
    this.#state = 'ready';
    this.#clearAttempt();
    const revision = ++this.#revision;
    this.#announce(previousState, undefined, revision);
  }

  start() {
    if (this.#destroying || !['ready', 'completed', 'cancelled'].includes(this.#state)) return false;
    return this.#enter(0, 'start', true);
  }

  next() {
    if (!this.#visible || !this.#accepts(this.#token, 'active') || this.#step.advance.type !== 'manual') return false;
    return this.#satisfy();
  }

  previous() {
    if (!this.running || this.#destroying || this.#index === 0) return false;
    return this.#enter(this.#index - 1, 'previous');
  }

  pause(reason = 'user') {
    if (!PAUSE_REASONS.has(reason)) throw new TypeError('reason: invalid training pause reason');
    if (!this.running || this.#state === 'paused') return false;
    return this.#pause(reason);
  }

  resume() {
    if (this.#destroying || this.#state !== 'paused') return false;
    return this.#enter(this.#index, 'resume');
  }

  stop(reason = 'user') {
    if (reason !== 'user' && reason !== 'disconnected') throw new TypeError('reason: invalid training cancel reason');
    if (!this.running) return false;
    this.#finish('cancelled', reason);
    return true;
  }

  signal(name, options) {
    nonempty(name, 'name');
    const token = tokenOption(options);
    if (!this.#accepts(token, 'active') || this.#step.advance.type !== 'signal' || this.#step.advance.name !== name) return false;
    return this.#satisfy();
  }

  routeReady(route, options) {
    nonempty(route, 'route');
    const token = tokenOption(options);
    if (!this.#accepts(token, 'waiting-route') || this.#step.route !== route) return false;
    const previousState = this.#state;
    this.#state = this.#step.target === undefined ? 'presenting' : 'waiting-target';
    this.#reason = undefined;
    const revision = ++this.#revision;
    if (this.#announce(previousState, undefined, revision) && this.#visible) this.#prepare(revision);
    return true;
  }

  routeChanged(route) {
    nonempty(route, 'route');
    if (['waiting-target', 'presenting', 'active'].includes(this.#state)) this.pause('route-changed');
  }

  getProgress() {
    if (!this.#sessionId || !this.#script) return null;
    return {
      schemaVersion: 1,
      trainingId: this.#script.id,
      version: this.#script.version,
      stepId: this.#step.id,
      status: this.running ? 'in-progress' : this.#state
    };
  }

  restoreProgress(value) {
    if (this.running || this.#destroying) throw new Error('Stop the current training before restoring progress.');
    if (!this.#script) throw new TypeError('Load a script before restoring progress.');
    const progress = normalizeProgress(value, this.#script);
    const token = progress.status === 'in-progress' ? this.#newToken() : null;
    if (token === undefined) return;
    const previousState = this.#state;
    this.#sessionId = this.#newSession();
    this.#index = this.#script.steps.findIndex(step => step.id === progress.stepId);
    this.#token = token;
    this.#state = progress.status === 'in-progress' ? 'paused' : progress.status;
    this.#clearAttempt();
    this.#reason = 'restored';
    const revision = ++this.#revision;
    if (!this.#emit('ddocbot-trainingstepchange', {}, revision)) return;
    this.#announce(previousState, 'restored', revision);
  }

  targetResolved(token) {
    if (!this.#visible || !this.#accepts(token, 'waiting-target')) return false;
    const previousState = this.#state;
    this.#state = 'presenting';
    const revision = ++this.#revision;
    this.#announce(previousState, undefined, revision);
    return true;
  }

  prepared(token) {
    if (!this.#visible || token == null || token !== this.#token) return false;
    const restoring = this.#state === 'active' && this.#restoring;
    if (this.#state !== 'presenting' && !restoring) return false;
    const previousState = this.#state;
    this.#state = 'active';
    this.#restoring = false;
    const revision = ++this.#revision;
    if (!this.#effect('listen', {}, revision)) return true;
    if (restoring) {
      this.#render(revision);
      return true;
    }
    if (!this.#announce(previousState, undefined, revision)) return true;
    if (this.#step.audio) this.#effect('audio', {}, revision);
    return true;
  }

  interaction(token) {
    if (!this.#visible || !this.#accepts(token, 'active') || this.#restoring ||
        !['click', 'change'].includes(this.#step.advance.type)) return false;
    return this.#satisfy();
  }

  fail(code, token) {
    if (!Object.hasOwn(ERRORS, code)) throw new TypeError('code: invalid training failure code');
    if (token == null || token !== this.#token || !this.running || this.#state === 'paused') return false;
    return this.#pause(code, true);
  }

  tick(dt) {
    if (typeof dt !== 'number' || !Number.isFinite(dt) || dt < 0) throw new TypeError('dt: expected a finite non-negative number');
    if (!this.#visible || !['waiting-route', 'waiting-target'].includes(this.#state)) return;
    this.#remaining -= dt;
    if (this.#remaining <= 0) this.fail('timeout', this.#token);
  }

  setVisible(visible) {
    if (typeof visible !== 'boolean') throw new TypeError('visible: expected a boolean');
    if (visible === this.#visible) return;
    this.#visible = visible;
    const revision = ++this.#revision;
    if (!this.running || this.#state === 'paused') return;
    if (!visible) {
      this.#restoring = false;
      this.#effect('release', { reason: 'hidden' }, revision);
      return;
    }
    if (this.#satisfied) {
      this.#advance();
      return;
    }
    if (this.#state === 'waiting-route') return;
    this.#restoring = this.#state === 'active';
    this.#prepare(revision);
  }

  destroy() {
    if (this.#destroying) return;
    this.#destroying = true;
    try {
      this.stop('disconnected');
    } finally {
      const previousState = this.#state;
      this.#script = null;
      this.#sessionId = null;
      this.#index = -1;
      this.#token = null;
      this.#state = 'idle';
      this.#visible = true;
      this.#clearAttempt();
      const revision = ++this.#revision;
      try {
        if (previousState !== 'idle') this.#announce(previousState, undefined, revision);
      } finally {
        this.#destroying = false;
      }
    }
  }

  get #step() { return this.#script.steps[this.#index]; }

  #newSession() { return `training-session-${this.#instance}-${++this.#sessionSequence}`; }

  #newToken() {
    const revision = this.#revision;
    const token = this.#makeToken();
    if (revision !== this.#revision) return undefined;
    nonempty(token, 'makeToken result');
    return token;
  }

  #clearAttempt() {
    this.#satisfied = false;
    this.#preparationStarted = false;
    this.#restoring = false;
    this.#remaining = 0;
    this.#reason = undefined;
  }

  #enter(index, reason, newSession = false) {
    const token = this.#newToken();
    if (token === undefined) return false;
    const previousState = this.#state;
    const oldToken = this.#token;
    const oldStep = this.currentStep;
    if (newSession) this.#sessionId = this.#newSession();
    this.#index = index;
    this.#token = token;
    this.#clearAttempt();
    this.#remaining = this.#step.timeout;
    this.#state = this.#step.route ? 'waiting-route' : this.#step.target === undefined ? 'presenting' : 'waiting-target';
    const revision = ++this.#revision;
    // State/token change precedes release: even a synchronous cleanup callback
    // cannot confirm the previous attempt or overwrite a reentrant transition.
    if (oldToken && !this.#effect('release', { token: oldToken, step: oldStep, reason }, revision)) return true;
    if (!this.#emit('ddocbot-trainingstepchange', {}, revision)) return true;
    if (!this.#announce(previousState, undefined, revision)) return true;
    if (this.#state === 'waiting-route') {
      if (!this.#effect('home', { reason: 'waiting-route' }, revision)) return true;
      this.#emit('ddocbot-trainingroute', { route: this.#step.route, navigation: this.#step.navigation }, revision);
    } else if (this.#visible) {
      this.#prepare(revision);
    }
    return true;
  }

  #prepare(revision) {
    const resume = this.#preparationStarted;
    this.#preparationStarted = true;
    return this.#effect('prepare', { resume }, revision);
  }

  #accepts(token, state) {
    return !this.#destroying && token != null && token === this.#token && this.#state === state && !this.#satisfied;
  }

  #satisfy() {
    this.#satisfied = true;
    ++this.#revision;
    if (this.#visible) this.#advance();
    return true;
  }

  #advance() {
    if (this.#index + 1 < this.#script.steps.length) this.#enter(this.#index + 1, 'next');
    else this.#finish('completed', 'completed');
  }

  #pause(reason, error = false) {
    const previousState = this.#state;
    this.#state = 'paused';
    this.#satisfied = false;
    this.#restoring = false;
    this.#reason = reason;
    const revision = ++this.#revision;
    if (!this.#effect('release', { reason }, revision)) return true;
    if (!this.#announce(previousState, reason, revision)) return true;
    if (!this.#emit('ddocbot-trainingpause', { reason }, revision)) return true;
    if (error) this.#emit('ddocbot-trainingerror', { code: reason, message: ERRORS[reason] }, revision);
    return true;
  }

  #finish(state, reason) {
    const previousState = this.#state;
    const oldToken = this.#token;
    this.#state = state;
    this.#token = null;
    this.#clearAttempt();
    this.#reason = reason;
    const revision = ++this.#revision;
    if (!this.#effect('release', { token: oldToken, reason }, revision)) return;
    if (!this.#announce(previousState, reason, revision)) return;
    const name = state === 'completed' ? 'ddocbot-trainingcomplete' : 'ddocbot-trainingcancel';
    if (!this.#emit(name, state === 'cancelled' ? { reason } : {}, revision)) return;
    if (reason !== 'disconnected') this.#effect('home', { reason }, revision);
  }

  #detail() {
    const detail = {};
    if (this.#script) {
      detail.trainingId = this.#script.id;
      detail.version = this.#script.version;
      detail.total = this.#script.steps.length;
    }
    if (this.#sessionId) detail.sessionId = this.#sessionId;
    if (this.#index >= 0) {
      detail.stepId = this.#step.id;
      detail.index = this.#index;
      detail.token = this.#token;
    }
    return detail;
  }

  #emit(name, extra, revision) {
    if (revision !== this.#revision) return false;
    this.#emitCallback(name, clone({ ...this.#detail(), ...extra }));
    return revision === this.#revision;
  }

  #effect(type, extra, revision) {
    if (revision !== this.#revision) return false;
    this.#effectCallback(clone({ type, token: this.#token, step: this.currentStep, ...extra }));
    return revision === this.#revision;
  }

  #render(revision) {
    return this.#effect('render', { snapshot: {
      state: this.#state,
      step: this.currentStep,
      index: this.#index >= 0 ? this.#index : null,
      total: this.#script?.steps.length ?? 0,
      reason: this.#reason ?? null
    } }, revision);
  }

  #announce(previousState, reason, revision) {
    if (!this.#render(revision)) return false;
    return this.#emit('ddocbot-trainingstatechange', {
      state: this.#state, previousState, ...(reason === undefined ? {} : { reason })
    }, revision);
  }
}
