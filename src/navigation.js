import { clampPosition, nearTarget, nearestPoint, easeInOut } from './geometry.js';

const validDuration = value => {
  if (!Number.isFinite(value) || value < 0) throw new TypeError('duration must be a nonnegative finite number');
  return value;
};
const parentElement = element => element.parentElement || element.getRootNode()?.host || null;
const intersect = (a, b) => {
  const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right), bottom = Math.min(a.bottom, b.bottom);
  return { x:left, y:top, left, top, right, bottom, width: Math.max(0, right-left), height: Math.max(0, bottom-top) };
};

/** Resolves once: selectors never silently bind to a replacement component. */
export function resolveTarget(value, doc) {
  if (typeof value === 'string') {
    try { value = doc.querySelector(value); } catch { return null; }
  }
  if (value instanceof doc.defaultView.Element) {
    return value.ownerDocument === doc ? { element: value } : null;
  }
  if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
    return { point: { x: value.x, y: value.y } };
  }
  return null;
}

/** Geometry is measured in viewport coordinates, including clipping scrollers. */
export function measureTarget(target, doc) {
  if (!target) return null;
  const win = doc.defaultView;
  let rect;
  if (target.point) {
    const x = target.point.x - win.scrollX, y = target.point.y - win.scrollY;
    rect = { x, y, left:x, right:x, top:y, bottom:y, width:0, height:0 };
    return { rect, visibleRect:rect, visible:x>=0 && y>=0 && x<win.innerWidth && y<win.innerHeight };
  }
  const element = target.element;
  if (!element.isConnected || !element.getClientRects().length) return null;
  rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  let visibleRect = intersect(rect, {left:0,top:0,right:win.innerWidth,bottom:win.innerHeight});
  for (let node = element; node; node = parentElement(node)) {
    const css = win.getComputedStyle(node);
    if (css.display === 'none' || css.visibility === 'hidden' || css.visibility === 'collapse' || Number(css.opacity) === 0) return null;
    if (node !== element && node !== doc.body && node !== doc.documentElement) {
      const box = node.getBoundingClientRect();
      const clipX = /auto|scroll|hidden|clip/.test(css.overflowX);
      const clipY = /auto|scroll|hidden|clip/.test(css.overflowY);
      visibleRect = intersect(visibleRect, {
        left:clipX ? box.left + node.clientLeft : -Infinity,
        right:clipX ? box.left + node.clientLeft + node.clientWidth : Infinity,
        top:clipY ? box.top + node.clientTop : -Infinity,
        bottom:clipY ? box.top + node.clientTop + node.clientHeight : Infinity
      });
    }
  }
  return { rect, visibleRect, visible:visibleRect.width>0 && visibleRect.height>0 };
}

/** Navigation owns no timers: the element supplies its visibility-aware frame clock. */
export class BotNavigation {
  constructor({ document, getHome, reducedMotion, onChange, onTargetLost, wake }) {
    this.doc = document; this.getHome = getHome; this.reducedMotion = reducedMotion;
    this.onChange = onChange; this.onTargetLost = onTargetLost; this.wake = wake;
    this.revision = 0; this.state = 'home'; this.position = {x:0,y:0}; this.phase = 0;
    this.anchor = null; this.laserTarget = null; this.laserEnd = null; this.command = null;
  }
  get viewport() { return {width:this.doc.defaultView.innerWidth,height:this.doc.defaultView.innerHeight}; }
  get active() { return this.state !== 'home'; }
  setState(state) {
    if (state === this.state) return;
    this.state = state; this.onChange(state);
  }
  cancel() {
    this.revision++;
    const command = this.command; this.command = null;
    command?.resolve('cancelled');
  }
  halt() {
    this.cancel();
    this.anchor = null; this.laserTarget = null; this.laserEnd = null;
    if (this.active) this.setState('hovering');
  }
  flyTo(value, { duration = 700 } = {}) {
    validDuration(duration);
    const target = resolveTarget(value, this.doc);
    this.cancel();
    if (!this.active) this.position = this.getHome();
    this.anchor = null; this.laserTarget = null; this.laserEnd = null;
    if (!target || !measureTarget(target, this.doc)) {
      if (this.active) this.setState('hovering');
      return Promise.resolve('target-unavailable');
    }
    const promise = new Promise(resolve => {
      this.command = {kind:'fly', target, duration, resolve, elapsed:0, stage:'reveal', settled:0, waited:0, lastRect:null, start:{...this.position}};
    });
    const command = this.command;
    this.setState('flying');
    if (this.command !== command) return promise;
    const measure = measureTarget(target, this.doc);
    if (!measure) { this.lost(); return promise; }
    if (!measure.visible) {
      const behavior = this.reducedMotion() ? 'instant' : 'smooth';
      if (target.element) target.element.scrollIntoView({behavior,block:'center',inline:'center'});
      else this.doc.defaultView.scrollTo({left:target.point.x-this.viewport.width/2,top:target.point.y-this.viewport.height/2,behavior});
    } else command.stage = 'travel';
    if (this.reducedMotion() || duration === 0) this.update(0);
    this.wake(); return promise;
  }
  pointAt(value) {
    const target = resolveTarget(value, this.doc);
    if (!target || !measureTarget(target, this.doc)) return false;
    if (!this.active) this.position = this.getHome();
    this.cancel(); this.anchor = null;
    this.laserTarget = target;
    this.setState('pointing'); this.update(0); this.wake(); return true;
  }
  stopPointing() {
    this.revision++;
    this.laserTarget = null; this.laserEnd = null;
    if (this.state === 'pointing') this.setState('hovering');
  }
  returnHome({ duration = 700 } = {}) {
    validDuration(duration); this.cancel();
    this.anchor = null; this.laserTarget = null; this.laserEnd = null;
    if (!this.active) return Promise.resolve('arrived');
    const promise = new Promise(resolve => {
      this.command = {kind:'home', duration, resolve, elapsed:0, stage:'travel', start:{...this.position}};
    });
    const command = this.command;
    this.setState('returning');
    if (this.command !== command) return promise;
    if (this.reducedMotion() || duration === 0) this.update(0);
    this.wake(); return promise;
  }
  lost() {
    const command = this.command; this.command = null;
    command?.resolve('target-unavailable');
    this.anchor = null; this.laserTarget = null; this.laserEnd = null;
    const revision = this.revision;
    this.onTargetLost({reason:'target-unavailable'});
    if (this.revision === revision) void this.returnHome();
  }
  update(dt) {
    if (!this.active) return;
    this.phase = (this.phase + dt/1600) % 1;
    const command = this.command;
    if (command) {
      let measurement;
      if (command.kind === 'fly') {
        measurement = measureTarget(command.target, this.doc);
        if (!measurement) { this.lost(); return; }
        if (command.stage === 'reveal') {
          const rectKey = [measurement.rect.left,measurement.rect.top,measurement.rect.right,measurement.rect.bottom].map(Math.round).join(',');
          command.waited += dt;
          command.settled = command.lastRect === rectKey ? command.settled + dt : 0;
          command.lastRect = rectKey;
          if (measurement.visible && (this.reducedMotion() || command.settled >= 100)) {
            command.stage = 'travel'; command.start = {...this.position};
          } else if (command.waited >= 2200) {
            if (!measurement.visible) { this.lost(); return; }
            command.stage = 'travel'; command.start = {...this.position};
          } else return;
        }
      }
      const end = command.kind === 'home' ? this.getHome() : nearTarget(measurement.visible ? measurement.visibleRect : measurement.rect, this.viewport);
      command.elapsed += dt;
      const progress = this.reducedMotion() || command.duration === 0 ? 1 : Math.min(1, command.elapsed/command.duration);
      const eased = easeInOut(progress);
      this.position = clampPosition({x:command.start.x+(end.x-command.start.x)*eased,y:command.start.y+(end.y-command.start.y)*eased},this.viewport);
      if (progress === 1) {
        this.command = null;
        if (command.kind === 'home') this.setState('home');
        else { this.anchor = command.target; this.setState('hovering'); }
        command.resolve('arrived');
      }
    } else if (this.anchor) {
      const measurement = measureTarget(this.anchor, this.doc);
      if (!measurement) { this.lost(); return; }
      if (measurement.visible) this.position = nearTarget(measurement.visibleRect, this.viewport);
    }
    this.position = clampPosition(this.position, this.viewport);
    this.laserEnd = null;
    if (this.laserTarget) {
      const measurement = measureTarget(this.laserTarget, this.doc);
      if (!measurement) { this.lost(); return; }
      if (measurement.visible) {
        this.laserEnd = this.laserTarget.point
          ? {x:measurement.rect.left,y:measurement.rect.top}
          : nearestPoint(measurement.visibleRect,{x:this.position.x+12,y:this.position.y+12});
      }
    }
  }
  destroy() {
    this.cancel(); this.anchor = null; this.laserTarget = null; this.laserEnd = null;
    this.state = 'home'; this.position = {x:0,y:0}; this.phase = 0;
  }
}
