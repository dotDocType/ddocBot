/** Shared visual/audio pulse clock. Driven by the component's visible frame loop. */
export class AlertPulse {
  constructor() { this._interval = 2000; this.active = false; this.elapsed = 0; }
  get interval() { return this._interval; }
  set interval(value) {
    if (!Number.isFinite(value)) throw new TypeError('alertInterval must be finite');
    this._interval = Math.max(600, value); this.elapsed = 0;
  }
  get phase() { return this.elapsed / this.interval; }
  update(dt, active) {
    if (!active) { this.active = false; this.elapsed = 0; return false; }
    if (!this.active) { this.active = true; this.elapsed = 0; return true; }
    this.elapsed += Math.max(0, dt);
    if (this.elapsed >= this.interval) { this.elapsed %= this.interval; return true; }
    return false;
  }
}
