import { JUDGE } from './data.js';

/** 메트로놈 박자에 맞춰 패턴 리듬을 탭하는 훈련 */

export const TRAIN_PATTERNS = [
  { id: 'q4', name: '4분음표 4개', pattern: [1, 1, 1, 1] },
  { id: 'e8', name: '8분음표 8개', pattern: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
  { id: 'sync', name: '싱코페이션', pattern: [0.5, 1, 0.5, 0.5, 0.5, 1] },
  { id: 'front8', name: '앞 8분 4개', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1] },
  { id: 'back8', name: '뒤 8분 4개', pattern: [1, 1, 0.5, 0.5, 0.5, 0.5] },
  { id: 'half2', name: '2분음표 2개', pattern: [2, 2] },
];

export class MetronomeTrainer {
  constructor({
    bpm,
    pattern,
    bars = 2,
    onMetro,
    onNote,
    onJudge,
    onProgress,
    onEnd,
  }) {
    this.bpm = bpm;
    this.pattern = pattern;
    this.bars = bars;
    this.onMetro = onMetro ?? (() => {});
    this.onNote = onNote ?? (() => {});
    this.onJudge = onJudge ?? (() => {});
    this.onProgress = onProgress ?? (() => {});
    this.onEnd = onEnd ?? (() => {});
    this.beatSec = 60 / bpm;
    this.running = false;
    this.audioCtx = null;
    this.timers = [];
    this.targets = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfect = 0;
    this.great = 0;
    this.good = 0;
    this.miss = 0;
    this.xp = 0;
    this.coins = 0;
  }

  async ensureAudio() {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
  }

  playClick(time, accent = false) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.frequency.value = accent ? 720 : 480;
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    gain.gain.setValueAtTime(accent ? 0.16 : 0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  schedule() {
    const start = this.audioCtx.currentTime + 0.6;
    let targetIdx = 0;

    for (let bar = 0; bar < this.bars; bar += 1) {
      const barStart = start + bar * 4 * this.beatSec;

      for (let beat = 0; beat < 4; beat += 1) {
        const t = barStart + beat * this.beatSec;
        const timer = setTimeout(() => {
          if (!this.running) return;
          this.playClick(this.audioCtx.currentTime, beat === 0);
          this.onMetro(bar * 4 + beat + 1, this.bars * 4);
        }, Math.max(0, (t - this.audioCtx.currentTime) * 1000));
        this.timers.push(timer);
      }

      let noteT = barStart;
      for (let i = 0; i < this.pattern.length; i += 1) {
        const dur = this.pattern[i];
        const hitTime = noteT;
        const idx = targetIdx;
        targetIdx += 1;
        this.targets.push({ time: hitTime, hit: false, index: idx });

        const timer = setTimeout(() => {
          if (!this.running) return;
          this.playClick(this.audioCtx.currentTime, i === 0);
          this.onNote(idx, targetIdx);
          const tgt = this.targets[idx];
          if (tgt && !tgt.hit) this.registerMiss(tgt);
        }, Math.max(0, (hitTime - this.audioCtx.currentTime) * 1000));
        this.timers.push(timer);

        noteT += dur * this.beatSec;
      }
    }

    const endMs = (start + this.bars * 4 * this.beatSec + 1) * 1000 - Date.now();
    const endTimer = setTimeout(() => this.finish(), Math.max(500, endMs));
    this.timers.push(endTimer);
  }

  registerMiss(target) {
    if (target.hit) return;
    target.hit = true;
    this.combo = 0;
    this.miss += 1;
    this.onJudge('miss', 0, this.combo);
  }

  judgeTap() {
    if (!this.running || !this.audioCtx) return null;
    const now = this.audioCtx.currentTime;
    let best = null;
    let bestDelta = Infinity;

    for (const t of this.targets) {
      if (t.hit) continue;
      const delta = Math.abs(now - t.time);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = t;
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
    const mult = 1 + Math.floor(this.combo / 8) * 0.25;
    const pts = Math.round(j.score * mult);
    this.score += pts;
    this.xp += j.xp;
    this.coins += key === 'perfect' ? 2 : 1;
    this[key] += 1;
    this.onJudge(key, pts, this.combo);
    this.onProgress(this.targets.filter((t) => t.hit).length, this.targets.length);
    return key;
  }

  async start() {
    await this.ensureAudio();
    this.running = true;
    this.targets = [];
    this.schedule();
  }

  finish() {
    if (!this.running) return;
    this.running = false;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.targets.forEach((t) => {
      if (!t.hit) this.registerMiss(t);
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
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }
}
