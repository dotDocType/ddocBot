const failures = new Set(['timeout', 'target-lost', 'ambiguous-target', 'target-resolution-failed']);
const liveStates = new Set(['waiting-route', 'waiting-target', 'presenting', 'active', 'paused']);
// 24px-grid icons; stroked ones draw outlines, the rest are filled shapes.
const icons = {
  previous: { d: 'M15 6l-6 6 6 6', stroke: true },
  next: { d: 'M9 6l6 6-6 6', stroke: true },
  complete: { d: 'M5 12.5l4.5 4.5L19 7.5', stroke: true },
  pause: { d: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z' },
  resume: { d: 'M8 5.5v13l10.5-6.5z' },
  retry: { d: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4', stroke: true },
  stop: { d: 'M6.5 6.5h11v11h-11z' }
};

const labels = {
  'pt-BR': {
    previous: 'Voltar', next: 'Próximo', complete: 'Concluir', pause: 'Pausar', resume: 'Retomar', retry: 'Tentar novamente', stop: 'Encerrar',
    progress: ({ current, total }) => `Passo ${current} de ${total}`,
    hints: { waitingRoute: 'Aguardando a tela…', waitingTarget: 'Aguardando o componente…', presenting: 'Preparando a orientação…', active: 'Aguardando sua ação.', paused: 'Treinamento pausado.' },
    reasons: { timeout: 'A tela ou o componente não ficou disponível a tempo.', 'target-lost': 'O componente desta etapa não está mais disponível.', 'ambiguous-target': 'Há mais de um componente correspondente a esta etapa.', 'target-resolution-failed': 'Não foi possível encontrar o componente desta etapa.', 'route-changed': 'A tela mudou. Retome quando estiver pronto.', 'external-command': 'Treinamento pausado durante outra orientação.', restored: 'Progresso restaurado. Retome quando estiver pronto.', user: 'Treinamento pausado.' }
  },
  en: {
    previous: 'Back', next: 'Next', complete: 'Complete', pause: 'Pause', resume: 'Resume', retry: 'Try again', stop: 'End',
    progress: ({ current, total }) => `Step ${current} of ${total}`,
    hints: { waitingRoute: 'Open the indicated screen…', waitingTarget: 'Waiting for the component…', presenting: 'Preparing the guidance…', active: 'Waiting for your action.', paused: 'Training paused.' },
    reasons: { timeout: 'The screen or component was not available in time.', 'target-lost': 'The component for this step is no longer available.', 'ambiguous-target': 'More than one component matches this step.', 'target-resolution-failed': 'The component for this step could not be found.', 'route-changed': 'The screen changed. Resume when ready.', 'external-command': 'Training paused during another orientation.', restored: 'Progress restored. Resume when ready.', user: 'Training paused.' }
  },
  es: {
    previous: 'Volver', next: 'Siguiente', complete: 'Completar', pause: 'Pausar', resume: 'Reanudar', retry: 'Intentar de nuevo', stop: 'Terminar',
    progress: ({ current, total }) => `Paso ${current} de ${total}`,
    hints: { waitingRoute: 'Abre la pantalla indicada…', waitingTarget: 'Esperando al componente…', presenting: 'Preparando la orientación…', active: 'Esperando tu acción.', paused: 'Entrenamiento pausado.' },
    reasons: { timeout: 'La pantalla o el componente no estuvo disponible a tiempo.', 'target-lost': 'El componente de este paso ya no está disponible.', 'ambiguous-target': 'Hay más de un componente para este paso.', 'target-resolution-failed': 'No se pudo encontrar el componente de este paso.', 'route-changed': 'La pantalla cambió. Reanuda cuando estés listo.', 'external-command': 'Entrenamiento pausado durante otra orientación.', restored: 'Progreso restaurado. Reanuda cuando estés listo.', user: 'Entrenamiento pausado.' }
  }
};

export function trainingLabels(locale = 'pt-BR') {
  const value = String(locale || '').toLowerCase();
  const key = value === 'en' || value.startsWith('en-') ? 'en' : value === 'es' || value.startsWith('es-') ? 'es' : 'pt-BR';
  return labels[key];
}

/** Owns only training content and feedback timing inside the existing movable bubble. */
export class TrainingView {
  constructor({ bubble, status, closeButton, trigger, onAction, onResize, locale = 'pt-BR' }) {
    Object.assign(this, { bubble, status, closeButton, trigger, onAction, onResize });
    this.setLocale(locale);
    this.doc = bubble.ownerDocument;
    this.win = this.doc.defaultView;
    this.active = false;
    this.visible = !this.doc.hidden;
    this.pauses = new Set();
    this.remaining = 0;
    this.timer = null;
    this.frames = new Map();
    this.pendingChanges = new Map();
    this.listeners = [];
    const element = (tag, className) => {
      const node = this.doc.createElement(tag);
      node.className = className;
      return node;
    };
    this.instruction = element('div', 'ddocbot-training-instruction');
    this.progress = element('div', 'ddocbot-training-progress');
    this.counter = element('span', 'ddocbot-training-counter');
    this.counter.setAttribute('aria-hidden', 'true');
    this.hint = element('div', 'ddocbot-training-hint');
    this.feedback = element('div', 'ddocbot-training-feedback');
    this.feedback.setAttribute('aria-live', 'polite');
    this.feedback.setAttribute('aria-atomic', 'true');
    this.controls = element('div', 'ddocbot-training-controls');
    this.style = this.doc.createElement('style');
    this.style.textContent = `
      .ddocbot-training-active{padding-right:16px}
      .ddocbot-training-progress{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
      .ddocbot-training-hint,.ddocbot-training-feedback{font-size:13px;margin-top:10px;white-space:pre-wrap;overflow-wrap:anywhere}
      .ddocbot-training-feedback:empty{margin:0}
      .ddocbot-training-controls{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:10px;white-space:normal}
      .ddocbot-training-counter{margin-right:auto;padding-right:8px;font-size:12px;opacity:.75}
      .ddocbot-training-controls button{box-sizing:border-box;display:grid;place-items:center;width:32px;height:32px;padding:0;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer}
      .ddocbot-training-controls button svg{width:16px;height:16px}
      .ddocbot-training-controls button:not(:disabled):hover{background:color-mix(in srgb,currentColor 10%,transparent)}
      .ddocbot-training-controls .ddocbot-training-primary{background:currentColor}
      .ddocbot-training-controls .ddocbot-training-primary svg{color:var(--ddocbot-bubble-background,#fff)}
      .ddocbot-training-controls .ddocbot-training-primary:not(:disabled):hover{background:currentColor;opacity:.85}
      .ddocbot-training-controls button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
      .ddocbot-training-controls button:disabled{opacity:.35;cursor:default}
      .ddocbot-training-controls [hidden],.ddocbot-training-hint[hidden],.ddocbot-training-feedback[hidden],.ddocbot-training-controls[hidden]{display:none!important}
    `;
    this.buttons = {};
    this.controls.append(this.counter);
    for (const action of ['previous', 'pause', 'resume', 'stop', 'next']) {
      const button = element('button', action === 'next' ? 'ddocbot-training-primary' : '');
      button.type = 'button';
      this._setButton(button, action);
      button.addEventListener('click', () => { if (this.active) this.onAction(action); });
      this.buttons[action] = button;
      this.controls.append(button);
    }
    this.hint.hidden = this.controls.hidden = true;
    bubble.append(this.style, this.hint, this.feedback, this.controls);
    this._listen('pointerenter', () => this._pause('hover'));
    this._listen('pointerleave', () => this._resume('hover'));
    this._listen('focusin', () => this._pause('focus'));
    this._listen('focusout', event => {
      if (!this.bubble.contains(event.relatedTarget)) this._resume('focus');
    });
  }

  setLocale(locale) {
    this.locale = locale;
    this.labels = trainingLabels(locale);
    if (this.buttons) {
      for (const [action, button] of Object.entries(this.buttons)) this._setButton(button, action);
      if (this.snapshot && this.active) this.render(this.snapshot);
    }
  }

  /** Icon-only buttons carry their localized name in aria-label and the hover tooltip. */
  _setButton(button, key) {
    const label = this.labels[key];
    button.setAttribute('aria-label', label); button.title = label;
    if (button.dataset.icon === key) return;
    button.dataset.icon = key;
    const { d, stroke } = icons[key];
    const paint = stroke ? 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"';
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path ${paint} d="${d}"/></svg>`;
  }

  _listen(name, handler) {
    this.bubble.addEventListener(name, handler);
    this.listeners.push([name, handler]);
  }

  _focused() { return this.bubble.getRootNode().activeElement; }

  render(snapshot) {
    this.snapshot = snapshot;
    if (!liveStates.has(snapshot.state) || !snapshot.step) { this.clear(); return; }
    const focused = this._focused();
    const controlledFocus = this.controls.contains(focused);
    const changedStep = this.stepId !== snapshot.step.id || this.index !== snapshot.index || this.token !== snapshot.token;
    if (changedStep) this._clearMessage();
    this.stepId = snapshot.step.id; this.index = snapshot.index; this.token = snapshot.token;
    this.active = true;
    this.bubble.classList.add('ddocbot-training-active');
    this.bubble.hidden = false;
    if (this.instruction.parentNode !== this.status) this.status.replaceChildren(this.instruction, this.progress);
    const progress = this.labels.progress({ current: snapshot.index + 1, total: snapshot.total });
    this.counter.textContent = progress;
    const content = `${snapshot.step.text}\n${progress}`;
    if (changedStep || this.instructionContent !== content) {
      this.instructionContent = content;
      this._deferChange('instruction', () => {
        this.instruction.textContent = snapshot.step.text;
        this.progress.textContent = progress;
        this.onResize();
      });
    }
    const paused = snapshot.state === 'paused';
    const active = snapshot.state === 'active';
    const hint = paused ? this.labels.reasons[snapshot.reason] || this.labels.hints.paused
      : snapshot.state === 'waiting-route' ? this.labels.hints.waitingRoute
      : snapshot.state === 'waiting-target' ? this.labels.hints.waitingTarget
      : snapshot.state === 'presenting' ? this.labels.hints.presenting
      : snapshot.step.advance.type !== 'manual' ? this.labels.hints.active : '';
    this.hint.textContent = hint; this.hint.hidden = !hint;
    this.buttons.previous.disabled = snapshot.index === 0;
    this.buttons.next.hidden = !active || snapshot.step.advance.type !== 'manual';
    this._setButton(this.buttons.next, snapshot.index === snapshot.total - 1 ? 'complete' : 'next');
    this.buttons.pause.hidden = paused;
    this.buttons.resume.hidden = !paused;
    this._setButton(this.buttons.resume, failures.has(snapshot.reason) ? 'retry' : 'resume');
    this.closeButton.hidden = true;
    this.controls.hidden = false;
    this.bubble.hidden = false;
    if (controlledFocus && (focused.hidden || focused.disabled)) {
      const replacement = paused ? this.buttons.resume
        : !this.buttons.next.hidden ? this.buttons.next : this.buttons.pause;
      replacement.focus({ preventScroll: true });
    }
    this.onResize();
  }

  message(text, { duration = 6000 } = {}) {
    if (typeof text !== 'string') throw new TypeError('text must be a string');
    if (!Number.isFinite(duration) || duration < 0) throw new TypeError('duration must be finite and nonnegative');
    if (!this.active) return;
    this._clearMessage();
    if (!text) { this.onResize(); return; }
    this.remaining = duration;
    if (this.bubble.matches(':hover')) this.pauses.add('hover');
    if (this.bubble.contains(this._focused())) this.pauses.add('focus');
    if (!this.visible) this.pauses.add('hidden');
    this._deferChange('feedback', () => {
      this.feedback.textContent = text;
      this._schedule();
      this.onResize();
    });
    this.onResize();
  }

  setVisible(visible) {
    this.visible = visible;
    if (visible) {
      this._resume('hidden');
      for (const key of this.pendingChanges.keys()) this._scheduleChange(key);
    } else {
      this._pause('hidden');
      for (const id of this.frames.values()) this.win.cancelAnimationFrame(id);
      this.frames.clear();
    }
  }

  _cancelChange(key) {
    this.win.cancelAnimationFrame(this.frames.get(key));
    this.frames.delete(key); this.pendingChanges.delete(key);
  }

  _deferChange(key, callback) {
    this._cancelChange(key);
    this.pendingChanges.set(key, callback);
    this._scheduleChange(key);
  }

  _scheduleChange(key) {
    if (!this.visible || !this.active || this.frames.has(key)) return;
    // Expose an empty live region for a frame before adding announcement text.
    this.frames.set(key, this.win.requestAnimationFrame(() => {
      this.frames.set(key, this.win.requestAnimationFrame(() => {
        this.frames.delete(key);
        if (!this.active || !this.visible) return;
        const callback = this.pendingChanges.get(key);
        this.pendingChanges.delete(key);
        callback?.();
      }));
    }));
  }

  _pause(reason) {
    if (this.timer !== null) {
      this.remaining = Math.max(1, this.remaining - (this.win.performance.now() - this.started));
      this.win.clearTimeout(this.timer); this.timer = null;
    }
    this.pauses.add(reason);
  }

  _resume(reason) { this.pauses.delete(reason); this._schedule(); }

  _schedule() {
    if (!this.active || !this.feedback.textContent || !this.remaining || this.pauses.size || this.timer !== null) return;
    this.started = this.win.performance.now();
    this.timer = this.win.setTimeout(() => { this._clearMessage(); this.onResize(); }, this.remaining);
  }

  _clearMessage() {
    this._cancelChange('feedback');
    this.win.clearTimeout(this.timer); this.timer = null;
    this.remaining = 0; this.pauses.clear();
    this.feedback.textContent = '';
  }

  clear() {
    this._clearMessage();
    this._cancelChange('instruction');
    if (!this.active) return;
    const controlledFocus = this.controls.contains(this._focused());
    this.active = false; this.stepId = undefined; this.index = undefined; this.token = undefined;
    this.controls.hidden = this.hint.hidden = true;
    this.hint.textContent = '';
    this.closeButton.hidden = false;
    this.status.textContent = '';
    this.instruction.textContent = ''; this.progress.textContent = ''; this.counter.textContent = ''; this.instructionContent = null;
    this.bubble.classList.remove('ddocbot-training-active');
    this.bubble.hidden = true;
    if (controlledFocus && this.trigger.isConnected && this.visible) this.trigger.focus({ preventScroll: true });
    this.onResize();
  }

  destroy() {
    this.clear();
    for (const [name, handler] of this.listeners) this.bubble.removeEventListener(name, handler);
    this.listeners.length = 0;
    this.controls.remove(); this.hint.remove(); this.feedback.remove(); this.style.remove();
  }
}
