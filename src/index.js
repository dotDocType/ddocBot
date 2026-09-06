import { BotEngine } from './engine.js';
import { drawBot, getLaserOrigin } from './pixels.js';
import { BotAudio } from './audio.js';
import { BotNavigation } from './navigation.js';
import { AlertPulse } from './alert.js';
import { createTrainingRuntime } from './training/runtime.js';
import { TrainingView } from './training/view.js';

const styles = `
:host{position:fixed;right:16px;bottom:16px;display:block;width:min(160px,calc(100vw - 52px));height:24px;color:inherit;z-index:1000;font:14px/1.5 var(--ddocbot-font-family,system-ui,sans-serif);pointer-events:none}
*{box-sizing:border-box} [hidden]{display:none!important}
canvas{position:absolute;width:24px;height:24px;image-rendering:pixelated;pointer-events:none}
.trigger{position:absolute;top:-10px;left:-10px;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;pointer-events:auto}
.trigger:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.bubble{position:fixed;bottom:56px;width:max-content;max-width:min(280px,calc(100vw - 24px));max-height:min(320px,calc(100dvh - 80px));overflow:auto;padding:14px 38px 14px 16px;background:var(--ddocbot-bubble-background,#fff);color:var(--ddocbot-bubble-color,#202a25);border:1px solid var(--ddocbot-bubble-border,#cbd4cd);border-radius:12px;box-shadow:var(--ddocbot-bubble-shadow,0 6px 24px #00000012);pointer-events:auto;overflow-wrap:anywhere;white-space:pre-wrap}
.close{position:absolute;right:5px;top:5px;width:28px;height:28px;border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer;border-radius:5px}
.close:focus-visible{outline:2px solid currentColor}
`;

/** Register on the client. Importing this module is safe in Node/SSR. */
export function defineDdocBot() {
  if (!globalThis.customElements || !globalThis.HTMLElement) throw new Error('defineDdocBot requires a browser');
  const registered = customElements.get('dot-bot');
  if (registered) return registered;
  class DdocBot extends HTMLElement {
    static observedAttributes = ['movement-width', 'muted', 'volume'];
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `<style>${styles}</style><canvas width="24" height="24" aria-hidden="true"></canvas><button class="trigger" type="button" aria-label="ddocBot, assistente"></button><div class="bubble" hidden><div role="status" aria-live="polite" aria-atomic="true"></div><button class="close" type="button" aria-label="Fechar mensagem">×</button></div>`;
      this._canvas = this.shadowRoot.querySelector('canvas'); this._context = this._canvas.getContext('2d');
      this._trigger = this.shadowRoot.querySelector('.trigger'); this._bubble = this.shadowRoot.querySelector('.bubble');
      this._status = this.shadowRoot.querySelector('[role=status]');
      this._viewRoot = this.shadowRoot; this._landing = 0;
      this._alert = new AlertPulse(); this._alertSound = null;
      this._audio = new BotAudio(detail => this._emit('ddocbot-audioerror', detail));
      this._engine = new BotEngine({ onStateChange: () => {
        this._emit('ddocbot-statechange', { state: this.state, pendingTasks: this._engine.tasks.size });
        this._wake();
      }});
      this._navigation = new BotNavigation({
        document: this.ownerDocument,
        getHome: () => this._homePosition(),
        reducedMotion: () => this._media?.matches ?? false,
        onChange: state => {
          if (state === 'home') {
            this._removeLayer();
            if (!this._engine.tasks.size) this._landing = this._media?.matches ? 0 : 250;
          } else this._ensureLayer();
          this._emit('ddocbot-navigationchange', { state }); this._wake();
        },
        onTargetLost: detail => this._emit('ddocbot-targetlost', detail),
        wake: () => this._wake()
      });
      this._movementWidth = 160; this._remaining = 0; this._pauses = new Set();
      this._trainingRuntime = createTrainingRuntime({
        host: this,
        presentation: {
          render: snapshot => {
            const running = this._trainingRuntime.running;
            if (running) this._cancelBubbleTimer();
            if (this._trainingPresented && !running && !this._engine.tasks.size) this._landing = this._media?.matches ? 0 : 250;
            this._trainingPresented = running;
            this._trainingView?.render(snapshot); this._wake();
          },
          message: (text, options) => this._trainingView?.message(text, options),
          clear: () => this._trainingView?.clear(),
          setVisible: visible => this._trainingView?.setVisible(visible)
        },
        navigation: {
          flyTo: target => this._navigation.flyTo(target),
          pointAt: target => this._navigation.pointAt(target),
          returnHome: () => this._navigation.returnHome(),
          halt: () => { this._navigation.halt(); this._syncAlert(); }
        },
        audio: this._audio,
        emit: (name, detail) => this._emit(name, detail)
      });
      this._createTrainingView();
      this._trigger.addEventListener('click', () => this._emit('ddocbot-activate', {}));
      this.shadowRoot.querySelector('.close').addEventListener('click', () => this.dismissBubble());
      this._bubble.addEventListener('pointerenter', () => this._pauseBubble('hover'));
      this._bubble.addEventListener('pointerleave', () => this._resumeBubble('hover'));
      this._bubble.addEventListener('focusin', () => this._pauseBubble('focus'));
      this._bubble.addEventListener('focusout', e => { if (!this._bubble.contains(e.relatedTarget)) this._resumeBubble('focus'); });
      this._onVisibility = () => {
        this._trainingRuntime.visibilityChanged(!this.ownerDocument.hidden);
        if (document.hidden) { this._sleep(); this._pauseBubble('hidden'); this._render(); }
        else { this._last = null; this._resumeBubble('hidden'); this._wake(); }
      };
      this._onResize = () => { this._navigation.update(0); this._render(); };
      this._onMotion = () => { this._last = null; this._wake(); };
    }
    connectedCallback() {
      if (!this._trainingView) this._createTrainingView();
      // Restore properties assigned before customElements.define upgraded this node.
      for (const prop of ['muted', 'volume', 'movementWidth', 'alertSound', 'alertInterval']) {
        if (Object.prototype.hasOwnProperty.call(this, prop)) { const value = this[prop]; delete this[prop]; this[prop] = value; }
      }
      this._media = matchMedia('(prefers-reduced-motion: reduce)');
      this._media.addEventListener('change', this._onMotion);
      document.addEventListener('visibilitychange', this._onVisibility);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('scroll', this._onResize, true);
      this._resize = new ResizeObserver(this._onResize); this._resize.observe(this);
      this._appearance = new MutationObserver(() => this._render());
      for (let node = this; node; node = node.parentElement) {
        this._appearance.observe(node, { attributes: true, attributeFilter: ['style', 'class'] });
      }
      this._trainingRuntime.visibilityChanged(!this.ownerDocument.hidden);
      this._render(); this._wake();
    }
    disconnectedCallback() {
      this._trainingRuntime.destroy(); this._trainingView.destroy(); this._trainingView = null;
      this._trainingPresented = false; this._suppressReaction = false;
      this._sleep(); this._alert.update(0, false); this._audio.stopAlert(); this._dismissBubble(); this._navigation.destroy(); this._removeLayer(); this._landing = 0; this._audio.destroy(); this._engine.reset();
      this._resize?.disconnect(); this._appearance?.disconnect(); this._media?.removeEventListener('change', this._onMotion);
      document.removeEventListener('visibilitychange', this._onVisibility);
      window.removeEventListener('resize', this._onResize); window.removeEventListener('scroll', this._onResize, true);
    }
    attributeChangedCallback(name, previous, value) {
      if (previous === value) return;
      if (name === 'movement-width') this.movementWidth = value === null ? 160 : Number(value);
      if (name === 'volume') this.volume = value === null ? 0.35 : Number(value);
      if (name === 'muted') this.muted = value !== null && value !== 'false';
    }
    get alertSound() { return this._alertSound; }
    set alertSound(value) {
      if (value !== null && !['beep', 'success', 'error'].includes(value)) throw new TypeError('alertSound must be null, beep, success or error');
      if (value === this._alertSound) return;
      this._audio.stopAlert(); this._alertSound = value; this._alert.update(0, false); this._wake();
    }
    get alertInterval() { return this._alert.interval; }
    set alertInterval(value) { this._alert.interval = value; this._wake(); }
    get navigationState() { return this._navigation.state; }
    get training() { return this._trainingRuntime.controller; }
    flyTo(target, options) {
      this._trainingRuntime.externalCommand();
      if (!this.isConnected) return Promise.resolve('target-unavailable');
      const result = this._navigation.flyTo(target, options); this._render(); return result;
    }
    pointAt(target) {
      this._trainingRuntime.externalCommand();
      if (!this.isConnected) return false;
      const pointed = this._navigation.pointAt(target); this._render(); return pointed;
    }
    stopPointing() { this._trainingRuntime.externalCommand(); this._navigation.stopPointing(); this._render(); }
    returnHome(options) { this._trainingRuntime.externalCommand(); const result = this._navigation.returnHome(options); this._render(); return result; }
    get state() { return this._engine.snapshot().state; }
    get muted() { return this._audio.muted; }
    set muted(value) { this._audio.muted = value; }
    get volume() { return this._audio.volume; }
    set volume(value) { this._audio.volume = value; }
    get movementWidth() { return this._movementWidth; }
    set movementWidth(value) {
      if (!Number.isFinite(Number(value))) throw new TypeError('movementWidth must be finite');
      this._movementWidth = Math.max(24, Number(value));
      this.style.width = `min(${this._movementWidth}px, max(24px, calc(100vw - 52px)))`;
      if (this.isConnected) this._render();
    }
    beginTask() {
      this._suppressReaction = false;
      const id = this._engine.beginTask(); this._wake(); return id;
    }
    endTask(id, { outcome = 'success' } = {}) {
      if (!['success', 'error', 'cancelled'].includes(outcome)) throw new TypeError('Invalid outcome');
      if (this._trainingRuntime.running && this._engine.tasks.size === 1 && this._engine.tasks.has(id)) this._suppressReaction = true;
      this._engine.endTask(id, { outcome }); this._wake();
    }
    say(text, { duration = 6000 } = {}) {
      if (!Number.isFinite(duration) || duration < 0) throw new TypeError('duration must be a nonnegative finite number');
      this._trainingRuntime.externalCommand(); this._cancelBubbleTimer();
      this._status.textContent = String(text); this._bubble.hidden = false; this._remaining = duration;
      if (this._bubble.matches(':hover')) this._pauses.add('hover');
      if (this._bubble.contains(this._viewRoot.activeElement)) this._pauses.add('focus');
      if (document.hidden) this._pauses.add('hidden');
      this._positionBubble(); this._scheduleBubble(); this._wake();
    }
    dismissBubble() {
      this._trainingRuntime.externalCommand(); this._dismissBubble();
    }
    _cancelBubbleTimer() {
      clearTimeout(this._bubbleTimer); this._bubbleTimer = null; this._remaining = 0; this._pauses.clear();
    }
    _dismissBubble() {
      this._cancelBubbleTimer();
      if (this._bubble.contains(this._viewRoot.activeElement)) this._trigger.focus();
      this._bubble.hidden = true; this._status.textContent = '';
    }
    _createTrainingView() {
      this._trainingView = new TrainingView({
        bubble: this._bubble, status: this._status, closeButton: this._bubble.querySelector('.close'), trigger: this._trigger,
        onAction: action => this.training[action](), onResize: () => this._positionBubble()
      });
    }
    enableSound() { return this._audio.enable(); }
    playSound(name = 'beep') { return this._audio.playSound(name); }
    playAudio(url) { return this._audio.playAudio(url); }
    stopAudio() { this._audio.stop(); }
    _emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true })); }
    _pauseBubble(reason) {
      if (this._bubbleTimer) { this._remaining = Math.max(1, this._remaining - (performance.now() - this._timerStarted)); clearTimeout(this._bubbleTimer); this._bubbleTimer = null; }
      this._pauses.add(reason);
    }
    _resumeBubble(reason) { this._pauses.delete(reason); this._scheduleBubble(); }
    _scheduleBubble() {
      if (this._bubble.hidden || this._pauses.size || !this._remaining || this._bubbleTimer) return;
      this._timerStarted = performance.now(); this._bubbleTimer = setTimeout(() => this.dismissBubble(), this._remaining);
    }
    _homePosition() {
      const box = this.getBoundingClientRect();
      const x = Math.max(0, Math.min(Math.max(0, box.width - 24), this._engine.snapshot().x));
      return { x: Math.round(box.left + x), y: Math.round(box.top) };
    }
    _ensureLayer() {
      if (this._layer || !this.isConnected) return;
      const layer = this.ownerDocument.createElement('div');
      layer.setAttribute('data-ddocbot-layer', '');
      const root = layer.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${styles}
        :host{position:fixed;inset:0;width:auto;height:auto;pointer-events:none;display:block}
        .laser{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;shape-rendering:crispEdges}
        .laser line{stroke:var(--ddocbot-laser-color,#e64040);stroke-width:1}
        .laser circle{fill:var(--ddocbot-laser-color,#e64040)}
        .alert-waves{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;shape-rendering:crispEdges}
        .alert-waves circle{fill:none;stroke:var(--ddocbot-alert-color,var(--ddocbot-laser-color,#e64040));stroke-width:1}
      </style><svg class="laser" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" hidden><line/><circle r="2"/></svg><svg class="alert-waves" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" hidden><circle/><circle/><circle/></svg>`;
      this._layer = layer;
      this.ownerDocument.body.append(layer);
      this._movePresentation(root);
      this._laser = root.querySelector('.laser'); this._waves = root.querySelector('.alert-waves');
    }
    _movePresentation(root) {
      const focused = this._viewRoot.activeElement;
      root.append(this._canvas, this._trigger, this._bubble);
      this._viewRoot = root;
      if (focused?.isConnected && (focused === this._trigger || this._bubble.contains(focused))) {
        focused.focus({ preventScroll: true });
      }
    }
    _removeLayer() {
      if (!this._layer) return;
      this._movePresentation(this.shadowRoot);
      this._layer.remove(); this._layer = null; this._laser = null; this._waves = null;
      this._canvas.style.top = ''; this._trigger.style.top = '';
    }
    _positionBubble() {
      if (this._bubble.hidden || !this.isConnected) return;
      const box = this._trigger.getBoundingClientRect();
      const viewport = this.ownerDocument.defaultView;
      const above = Math.max(0, box.top - 18);
      const below = Math.max(0, viewport.innerHeight - box.bottom - 18);
      const room = Math.max(above, below);
      this._bubble.style.maxHeight = `${Math.min(320, Math.max(32, room))}px`;
      const size = this._bubble.getBoundingClientRect();
      const useAbove = above >= size.height || above >= below;
      const top = useAbove ? box.top - size.height - 6 : box.bottom + 6;
      this._bubble.style.left = `${Math.max(12, Math.min(viewport.innerWidth - size.width - 12, box.x + box.width / 2 - size.width / 2))}px`;
      this._bubble.style.top = `${Math.max(12, Math.min(viewport.innerHeight - size.height - 12, top))}px`;
      this._bubble.style.bottom = 'auto';
    }
    _syncAlert(dt = 0) {
      const visible = this.isConnected && !document.hidden && this.navigationState === 'pointing' && Boolean(this._navigation.laserEnd);
      const pulse = this._alert.update(dt, visible);
      if (!visible) this._audio.stopAlert();
      else if (pulse && this._alertSound) {
        const sound = this._alertSound;
        // A training state listener may synchronously render before its entry audio effect.
        // Let that effect claim the foreground channel before attempting the background beep.
        queueMicrotask(() => {
          if (this.isConnected && !this.ownerDocument.hidden && this._alert.active &&
              this.navigationState === 'pointing' && this._navigation.laserEnd && this._alertSound === sound) {
            void this._audio.playAlert(sound);
          }
        });
      }
    }
    _render() {
      if (!this.isConnected) return;
      this._syncAlert();
      const width = Math.max(24, this.getBoundingClientRect().width);
      let snapshot = this._engine.snapshot();
      const css = getComputedStyle(this);
      if (this._navigation.active) {
        this._ensureLayer();
        if (!this._layer) return;
        const { x, y } = this._navigation.position;
        this._canvas.style.left = `${Math.round(x)}px`; this._canvas.style.top = `${Math.round(y)}px`;
        this._trigger.style.left = `${Math.round(x) - 10}px`; this._trigger.style.top = `${Math.round(y) - 10}px`;
        const end = this._navigation.laserEnd;
        const aim = end ? {x:end.x-x-12,y:end.y-y-12} : {x:1,y:0};
        const flying = ['flying', 'returning'].includes(this.navigationState);
        snapshot = { state:'processing', extension:1, motion:end ? 'point' : flying ? 'fly' : 'hover', phase:this._media?.matches ? 0 : this._navigation.phase, aim };
        this._layer.style.color = css.color;
        this._layer.style.zIndex = css.zIndex === 'auto' ? '1000' : css.zIndex;
        for (const name of [
          '--ddocbot-laser-color', '--ddocbot-alert-color', '--ddocbot-font-family',
          '--ddocbot-bubble-color', '--ddocbot-bubble-background', '--ddocbot-bubble-border', '--ddocbot-bubble-shadow'
        ]) {
          const value = css.getPropertyValue(name).trim();
          if (value) this._layer.style.setProperty(name, value); else this._layer.style.removeProperty(name);
        }
        this._laser.toggleAttribute('hidden', !end);
        this._waves.toggleAttribute('hidden', !this._alert.active);
        this._waves.querySelectorAll('circle').forEach((ring, index) => {
          const phase = this._media?.matches ? (index + 1) / 4 : (this._alert.phase + index / 3) % 1;
          ring.setAttribute('cx', String(Math.round(x + 12)));
          ring.setAttribute('cy', String(Math.round(y + 12)));
          ring.setAttribute('r', String(Math.round(12 + phase * 26)));
          ring.setAttribute('opacity', String(this._media?.matches ? .18 : (1 - phase) * .6));
        });
        if (end) {
          const [handX, handY] = getLaserOrigin({aim});
          const line = this._laser.querySelector('line'), dot = this._laser.querySelector('circle');
          for (const [name,value] of Object.entries({x1:x+handX,y1:y+handY,x2:end.x,y2:end.y})) line.setAttribute(name, String(Math.round(value)));
          dot.setAttribute('cx', String(Math.round(end.x))); dot.setAttribute('cy', String(Math.round(end.y)));
        }
      } else {
        const x = Math.round(Math.max(0, Math.min(width - 24, snapshot.x)));
        this._canvas.style.left = `${x}px`; this._trigger.style.left = `${x - 10}px`;
        if (this._trainingRuntime.running) snapshot = {...snapshot, state:'processing', extension:1, motion:'rest', phase:0};
        else if (this._landing > 0 && !this._engine.tasks.size) snapshot = {...snapshot, state:'closing', extension:this._landing/250};
        else if (this._suppressReaction && !this._engine.tasks.size) snapshot = {...snapshot, state:'idle', extension:0, motion:'rest', phase:0};
      }
      drawBot(this._context, snapshot, css.color);
      this._positionBubble();
    }
    _wake() {
      if (!this.isConnected || document.hidden || this._raf) return;
      this._raf = requestAnimationFrame(time => {
        this._raf = null;
        const dt = this._last == null ? 0 : Math.min(64, time - this._last); this._last = time;
        this._engine.update(dt, { reducedMotion: this._media?.matches || this._navigation.active || this._trainingRuntime.running, bubbleVisible: !this._bubble.hidden, width: Math.max(24, this.getBoundingClientRect().width) });
        this._trainingRuntime.update(dt);
        this._navigation.update(dt);
        this._syncAlert(dt);
        this._landing = Math.max(0, this._landing - dt);
        this._render();
        if (this.state !== 'idle' || this._navigation.active || this._landing > 0 || (this._trainingRuntime.running && this.training.state !== 'paused')) this._wake(); else this._last = null;
      });
    }
    _sleep() { cancelAnimationFrame(this._raf); this._raf = null; this._last = null; }
  }
  customElements.define('dot-bot', DdocBot);
  return DdocBot;
}
