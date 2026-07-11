export class RhythmPlayer {
  constructor() {
    this.audioCtx = null;
    this.playing = false;
  }

  async ensureAudio() {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    return this.audioCtx;
  }

  playClick(time, accent = false) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.frequency.value = accent ? 720 : 520;
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    gain.gain.setValueAtTime(accent ? 0.18 : 0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    osc.start(time);
    osc.stop(time + 0.07);
  }

  /**
   * 패턴 재생. pattern = 박 단위 음표 길이 배열
   * countdown: 시작 전 1박 예비박
   */
  async playPattern(pattern, bpm, { countdown = true, onHit } = {}) {
    await this.ensureAudio();
    this.stop();
    this.playing = true;

    const beatSec = 60 / bpm;
    const start = this.audioCtx.currentTime + 0.15;
    let t = start;

    if (countdown) {
      this.playClick(t, true);
      t += beatSec;
    }

    pattern.forEach((dur, i) => {
      if (!this.playing) return;
      this.playClick(t, i === 0);
      onHit?.(i, t);
      t += dur * beatSec;
    });

    const totalMs = (t - start) * 1000 + 200;
    await new Promise((resolve) => {
      this._timer = setTimeout(() => {
        this.playing = false;
        resolve();
      }, totalMs);
    });
  }

  stop() {
    this.playing = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }
}
