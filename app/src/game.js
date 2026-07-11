import { JUDGE } from './data.js';

export class RhythmGame {
  constructor({ bpm, noteCount, onBeat, onJudge, onEnd }) {
    this.bpm = bpm;
    this.noteCount = noteCount;
    this.onBeat = onBeat ?? (() => {});
    this.onJudge = onJudge ?? (() => {});
    this.onEnd = onEnd ?? (() => {});
    this.beatInterval = 60000 / bpm;
    this.beats = [];
    this.startTime = 0;
    this.index = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.xp = 0;
    this.coins = 0;
    this.running = false;
    this.audioCtx = null;
    this.timerId = null;
    this.perfect = 0;
    this.great = 0;
    this.good = 0;
    this.miss = 0;
  }

  async ensureAudio() {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
  }

  playTone(freq, time, dur = 0.06) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.start(time);
    osc.stop(time + dur);
  }

  scheduleBeats() {
    this.beats = Array.from({ length: this.noteCount }, (_, i) => ({
      index: i,
      time: this.startTime + i * this.beatInterval,
      hit: false,
    }));
    this.beats.forEach((b, i) => {
      setTimeout(() => {
        if (!this.running) return;
        this.onBeat(i, this.noteCount);
        this.playTone(i % 4 === 0 ? 660 : 440, this.audioCtx.currentTime);
        if (!b.hit) this.registerMiss(b);
      }, Math.max(0, (b.time - this.audioCtx.currentTime) * 1000));
    });

    const endMs = this.noteCount * this.beatInterval + 1200;
    this.timerId = setTimeout(() => this.finish(), endMs);
  }

  registerMiss(beat) {
    if (beat.hit) return;
    beat.hit = true;
    this.combo = 0;
    this.miss += 1;
    this.onJudge('miss', 0, this.combo);
  }

  judgeTap() {
    if (!this.running || this.index >= this.beats.length) return null;
    const now = this.audioCtx.currentTime;
    let best = null;
    let bestDelta = Infinity;

    for (const b of this.beats) {
      if (b.hit) continue;
      const delta = Math.abs(now - b.time);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = b;
      }
    }

    if (!best || bestDelta > JUDGE.good.windowMs) {
      this.combo = 0;
      this.miss += 1;
      this.onJudge('miss', 0, this.combo);
      return 'miss';
    }

    best.hit = true;
    let key = 'miss';
    if (bestDelta <= JUDGE.perfect.windowMs) key = 'perfect';
    else if (bestDelta <= JUDGE.great.windowMs) key = 'great';
    else if (bestDelta <= JUDGE.good.windowMs) key = 'good';

    const j = JUDGE[key];
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = 1 + Math.floor(this.combo / 10) * 0.5;
    const pts = Math.round(j.score * mult);
    this.score += pts;
    this.xp += j.xp;
    this.coins += key === 'perfect' ? 3 : key === 'great' ? 2 : 1;
    this[key] += 1;
    this.onJudge(key, pts, this.combo);
    return key;
  }

  async start() {
    await this.ensureAudio();
    this.running = true;
    this.startTime = this.audioCtx.currentTime + 0.8;
    this.scheduleBeats();
  }

  finish() {
    if (!this.running) return;
    this.running = false;
    if (this.timerId) clearTimeout(this.timerId);
    this.beats.forEach((b) => {
      if (!b.hit) this.registerMiss(b);
    });
    this.onEnd({
      score: this.score,
      xp: this.xp,
      coins: this.coins,
      maxCombo: this.maxCombo,
      perfect: this.perfect,
      great: this.great,
      good: this.good,
      miss: this.miss,
    });
  }

  stop() {
    this.running = false;
    if (this.timerId) clearTimeout(this.timerId);
  }
}
