export class Metronome {
  constructor({ onBeat, onTick } = {}) {
    this.bpm = 100;
    this.running = false;
    this.onBeat = onBeat ?? (() => {});
    this.onTick = onTick ?? (() => {});
    this.beatIndex = 0;
    this.nextNoteTime = 0;
    this.timerId = null;
    this.audioCtx = null;
  }

  setBpm(bpm) {
    this.bpm = Math.min(160, Math.max(60, Number(bpm)));
  }

  async ensureAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playClick(time, accent = false) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.frequency.value = accent ? 880 : 440;
    gain.gain.setValueAtTime(accent ? 0.15 : 0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  schedule() {
    const ctx = this.audioCtx;
    if (!ctx || !this.running) return;

    const interval = 60 / this.bpm;
    while (this.nextNoteTime < ctx.currentTime + 0.1) {
      const accent = this.beatIndex % 4 === 0;
      this.playClick(this.nextNoteTime, accent);
      const beat = this.beatIndex;
      const scheduledAt = this.nextNoteTime;
      setTimeout(() => {
        if (this.running) {
          this.onBeat(beat % 4, beat);
          this.onTick(this.bpm);
        }
      }, Math.max(0, (scheduledAt - ctx.currentTime) * 1000));

      this.nextNoteTime += interval;
      this.beatIndex += 1;
    }

    this.timerId = setTimeout(() => this.schedule(), 25);
  }

  async start() {
    await this.ensureAudio();
    if (this.running) return;
    this.running = true;
    this.beatIndex = 0;
    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  toggle() {
    if (this.running) {
      this.stop();
    } else {
      this.start();
    }
    return this.running;
  }
}
