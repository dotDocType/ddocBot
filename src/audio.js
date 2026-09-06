/** Owns all sound resources; no browser access until explicitly enabled. */
export class BotAudio {
  constructor(onError) {
    this.onError = onError; this.context = null; this.channel = null;
    this.oscillators = new Set(); this._muted = true; this._volume = 0.35;
    this.generation = 0;
  }
  get muted() { return this._muted; }
  set muted(value) { this._muted = Boolean(value); if (this._muted) this.stop(); }
  get volume() { return this._volume; }
  set volume(value) {
    if (!Number.isFinite(Number(value))) throw new TypeError('volume must be finite');
    this._volume = Math.max(0, Math.min(1, Number(value)));
    if (this.channel) this.channel.volume = this._volume;
    if (this.gain) this.gain.gain.value = this._volume * 0.12;
  }
  async enable() {
    const generation = this.generation;
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) throw new Error('Web Audio is unavailable');
      this.context ||= new AudioContext();
      await this.context.resume();
      if (generation !== this.generation) return false;
      this._muted = false; return true;
    } catch (error) { this.onError({ kind: 'enable', message: error.message }); return false; }
  }
  async playSound(name = 'beep') {
    if (this.muted || !this.context) return false;
    const notes = { beep: [660], success: [523, 659, 784], error: [330, 220] }[name];
    if (!notes) throw new TypeError('Unknown sound');
    this.stop();
    try {
      if (this.context.state !== 'running') throw new Error('Audio requires a user gesture');
      const gain = this.context.createGain(); this.gain = gain;
      gain.gain.value = this.volume * 0.12; gain.connect(this.context.destination);
      notes.forEach((frequency, index) => {
        const osc = this.context.createOscillator(); osc.type = 'square';
        osc.frequency.value = frequency; osc.connect(gain); this.oscillators.add(osc);
        osc.onended = () => { osc.disconnect(); this.oscillators.delete(osc); if (!this.oscillators.size) gain.disconnect(); };
        const start = this.context.currentTime + index * 0.11;
        osc.start(start); osc.stop(start + 0.08);
      });
      return true;
    } catch (error) { this.onError({ kind: 'sound', message: error.message }); return false; }
  }
  /** Background alerts never interrupt a foreground beep or narration. */
  playAlert(name) {
    if (this.muted || !this.context || this.oscillators.size || (this.channel && !this.channel.paused)) return Promise.resolve(false);
    const previous = this.generation;
    const result = this.playSound(name);
    if (this.generation === previous + 1) this.alertGeneration = this.generation;
    return result;
  }
  stopAlert() {
    if (this.alertGeneration === this.generation) this.stop();
    this.alertGeneration = null;
  }
  /** Capture ownership before an HTML media play promise can settle. */
  playTraining(spec) {
    if (this.muted || !this.context || this.oscillators.size || (this.channel && !this.channel.paused)) return Promise.resolve(false);
    const previous = this.generation;
    const result = 'sound' in spec ? this.playSound(spec.sound) : this.playAudio(spec.url);
    if (this.generation === previous + 1) this.trainingGeneration = this.generation;
    return result;
  }
  stopTraining() {
    if (this.trainingGeneration === this.generation) this.stop();
    this.trainingGeneration = null;
  }
  async playAudio(url) {
    if (this.muted || !this.context) return false;
    this.stop(); const generation = this.generation;
    let reported = false;
    const report = error => {
      if (generation !== this.generation || reported) return;
      reported = true;
      this.onError({ kind: 'file', message: error?.message || 'Audio playback failed' });
    };
    try {
      const channel = new Audio(url); this.channel = channel;
      this.mediaError = () => report(channel.error);
      channel.addEventListener('error', this.mediaError);
      channel.volume = this.volume;
      await channel.play();
      return generation === this.generation && !reported;
    } catch (error) { report(error); return false; }
  }

  stop() {
    this.generation++;
    if (this.channel) { this.channel.removeEventListener('error', this.mediaError); this.mediaError = null; this.channel.pause(); this.channel.removeAttribute('src'); this.channel.load(); this.channel = null; }
    for (const osc of this.oscillators) { osc.onended = null; try { osc.stop(); } catch {} osc.disconnect(); }
    this.oscillators.clear(); this.gain?.disconnect(); this.gain = null;
  }
  destroy() { this.stop(); this._muted = true; const context = this.context; this.context = null; if (context) void context.close().catch(() => {}); }
}
