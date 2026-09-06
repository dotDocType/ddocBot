const OPEN_MS = 250;
const REACTION_MS = 800;
const MOTION_MS = 800;
const MOTIONS = ['walk', 'wave', 'jump', 'tap'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class BotEngine {
  constructor({ random = Math.random, onStateChange = () => {} } = {}) {
    this.random = random;
    this.onStateChange = onStateChange;
    this.nextId = 1;
    this.reset();
  }

  beginTask() {
    const id = `task-${this.nextId++}`;
    if (this.tasks.size === 0) {
      this.outcomes = [];
      this.pendingReaction = null;
    }
    this.tasks.add(id);
    if (this.state !== 'processing' && this.state !== 'opening') {
      this.motion = 'rest';
      this.phase = 0;
      this.transitionElapsed = this.extension * OPEN_MS;
      this.setState('opening');
    }
    return id;
  }

  endTask(id, { outcome = 'success' } = {}) {
    if (!this.tasks.delete(id)) return;
    this.outcomes.push(outcome);
    if (this.tasks.size > 0) return;
    this.motion = 'rest';
    this.phase = 0;
    if (this.outcomes.includes('error')) {
      this.react('error');
    } else if (this.outcomes.includes('success')) {
      this.react('success');
    } else {
      this.startClosing();
    }
  }

  update(dt, { reducedMotion = false, bubbleVisible = false, width = 160 } = {}) {
    let remaining = Math.max(0, Number.isFinite(dt) ? dt : 0);
    const maxX = Math.max(0, width - 24);
    this.x = clamp(this.x, 0, maxX);

    while (remaining > 0) {
      if (this.state === 'opening') {
        const needed = OPEN_MS - this.transitionElapsed;
        const used = Math.min(remaining, needed);
        this.transitionElapsed += used;
        this.extension = clamp(this.transitionElapsed / OPEN_MS, 0, 1);
        remaining -= used;
        if (this.transitionElapsed >= OPEN_MS) this.finishOpening();
      } else if (this.state === 'closing') {
        const needed = this.transitionElapsed;
        const used = Math.min(remaining, needed);
        this.transitionElapsed -= used;
        this.extension = clamp(this.transitionElapsed / OPEN_MS, 0, 1);
        remaining -= used;
        if (this.transitionElapsed <= 0) {
          this.extension = 0;
          this.setState('idle');
        }
      } else if (this.state === 'success' || this.state === 'error') {
        const needed = REACTION_MS - this.reactionElapsed;
        const used = Math.min(remaining, needed);
        this.reactionElapsed += used;
        this.phase = clamp(this.reactionElapsed / REACTION_MS, 0, 1);
        remaining -= used;
        if (this.reactionElapsed >= REACTION_MS) this.startClosing();
      } else if (this.state === 'processing') {
        this.updateProcessing(remaining, { reducedMotion, bubbleVisible, maxX });
        remaining = 0;
      } else {
        remaining = 0;
      }
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      state: this.state,
      motion: this.motion,
      phase: clamp(this.phase, 0, 1),
      extension: clamp(this.extension, 0, 1),
      x: this.x
    };
  }

  reset() {
    this.tasks = new Set();
    this.outcomes = [];
    this.state = 'idle';
    this.motion = 'rest';
    this.phase = 0;
    this.extension = 0;
    this.x = 0;
    this.transitionElapsed = 0;
    this.reactionElapsed = 0;
    this.motionElapsed = 0;
    this.pauseRemaining = 0;
    this.lastMotion = null;
    this.walkDirection = 1;
    this.pendingReaction = null;
  }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.onStateChange(state);
  }

  startProcessing() {
    this.extension = 1;
    this.motion = 'rest';
    this.phase = 0;
    this.pauseRemaining = this.randomPause();
    this.setState('processing');
  }

  finishOpening() {
    this.extension = 1;
    if (this.pendingReaction) {
      const state = this.pendingReaction;
      this.pendingReaction = null;
      this.reactionElapsed = 0;
      this.phase = 0;
      this.motion = 'rest';
      this.setState(state);
    } else {
      this.startProcessing();
    }
  }

  react(state) {
    if (this.state === 'opening') {
      this.pendingReaction = state;
      return;
    }
    this.reactionElapsed = 0;
    this.setState(state);
  }

  startClosing() {
    this.motion = 'rest';
    this.phase = 0;
    this.transitionElapsed = this.extension * OPEN_MS;
    this.setState('closing');
  }

  randomPause() {
    return 2000 + clamp(this.random(), 0, 1) * 3000;
  }

  chooseMotion() {
    const choices = MOTIONS.filter(motion => motion !== this.lastMotion);
    const index = Math.min(choices.length - 1, Math.floor(clamp(this.random(), 0, .999999) * choices.length));
    this.motion = choices[index];
    this.lastMotion = this.motion;
    this.motionElapsed = 0;
    this.phase = 0;
  }

  updateProcessing(dt, { reducedMotion, bubbleVisible, maxX }) {
    if (reducedMotion) {
      this.motion = 'rest';
      this.phase = 0;
      return;
    }
    let remaining = dt;
    while (remaining > 0) {
      if (this.motion === 'rest') {
        const used = Math.min(remaining, this.pauseRemaining);
        this.pauseRemaining -= used;
        remaining -= used;
        if (this.pauseRemaining <= 0) this.chooseMotion();
      } else {
        const needed = MOTION_MS - this.motionElapsed;
        const used = Math.min(remaining, needed);
        if (this.motion === 'walk' && !bubbleVisible) {
          let next = this.x + this.walkDirection * used * 0.012;
          if (next > maxX) {
            next = maxX;
            this.walkDirection = -1;
          } else if (next < 0) {
            next = 0;
            this.walkDirection = 1;
          }
          this.x = next;
        }
        this.motionElapsed += used;
        this.phase = clamp(this.motionElapsed / MOTION_MS, 0, 1);
        remaining -= used;
        if (this.motionElapsed >= MOTION_MS) {
          this.motion = 'rest';
          this.phase = 0;
          this.pauseRemaining = this.randomPause();
        }
      }
    }
  }
}
