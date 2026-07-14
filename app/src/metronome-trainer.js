import { JUDGE } from './data.js';
import { countTrainNotes } from './train-data.js';

/** 메트로놈 박자에 맞춰 악보 리듬을 탭하는 훈련 (쉼표·무실수 모드) */

export { TRAIN_EXERCISES, TRAIN_PATTERNS, TRAIN_TIERS } from './train-data.js';

export class MetronomeTrainer {
  constructor({
    bpm,
    measures,
    strict = true,
    onMetro,
    onPlayhead,
    onNote,
    onJudge,
    onProgress,
    onFail,
    onEnd,
  }) {
    this.bpm = bpm;
    this.measures = measures;
    this.strict = strict;
    this.onMetro = onMetro ?? (() => {});
    this.onPlayhead = onPlayhead ?? (() => {});
    this.onNote = onNote ?? (() => {});
    this.onJudge = onJudge ?? (() => {});
    this.onProgress = onProgress ?? (() => {});
    this.onFail = onFail ?? (() => {});
    this.onEnd = onEnd ?? (() => {});
    this.beatSec = 60 / bpm;
    this.running = false;
    this.failed = false;
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
    this.totalNotes = countTrainNotes(measures);
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
    const base = this.audioCtx.currentTime;
    const leadIn = 0.8;
    const start = base + leadIn;
    let hitIdx = 0;
    let posIdx = 0;

    for (let bar = 0; bar < this.measures.length; bar += 1) {
      const barStart = start + bar * 4 * this.beatSec;

      for (let beat = 0; beat < 4; beat += 1) {
        const t = barStart + beat * this.beatSec;
        const delayMs = Math.max(0, (t - base) * 1000);
        const timer = setTimeout(() => {
          if (!this.running) return;
          this.playClick(this.audioCtx.currentTime, beat === 0);
          this.onMetro(bar * 4 + beat + 1, this.measures.length * 4);
        }, delayMs);
        this.timers.push(timer);
      }

      let noteT = barStart;
      for (const group of this.measures[bar]) {
        const eventTime = noteT;
        const durSec = group.e * 0.5 * this.beatSec;
        const pos = posIdx;
        const isNote = group.t === 'n';
        let noteIndex = null;

        if (isNote) {
          noteIndex = hitIdx;
          this.targets.push({
            time: eventTime,
            hit: false,
            index: hitIndex,
            pos,
          });
          hitIdx += 1;
        }

        const playheadMs = Math.max(0, (eventTime - base) * 1000);
        const playheadTimer = setTimeout(() => {
          if (!this.running) return;
          this.onPlayhead(pos, isNote ? noteIndex : null);
          if (isNote) {
            this.playClick(this.audioCtx.currentTime, true);
            this.onNote(noteIndex, this.totalNotes);
          }
        }, playheadMs);
        this.timers.push(playheadTimer);

        if (isNote) {
          const missAt = eventTime + JUDGE.good.windowMs / 1000;
          const missMs = Math.max(0, (missAt - base) * 1000);
          const missTimer = setTimeout(() => {
            if (!this.running) return;
            const tgt = this.targets[noteIndex];
            if (tgt && !tgt.hit) this.registerMiss(tgt);
          }, missMs);
          this.timers.push(missTimer);
        }

        const clearMs = Math.max(0, (eventTime + durSec - base) * 1000);
        const clearTimer = setTimeout(() => {
          if (!this.running) return;
          this.onPlayhead(-1, null);
        }, clearMs);
        this.timers.push(clearTimer);

        noteT += durSec;
        posIdx += 1;
      }
    }

    const totalMs = (leadIn + this.measures.length * 4 * this.beatSec + 0.6) * 1000;
    const endTimer = setTimeout(() => this.finish(), totalMs);
    this.timers.push(endTimer);
  }

  registerMiss(target) {
    if (!this.running || target.hit) return;
    target.hit = true;
    this.combo = 0;
    this.miss += 1;
    this.onJudge('miss', 0, this.combo, target.index, target.pos);
    this.onProgress(this.targets.filter((t) => t.hit).length, this.totalNotes);
    if (this.strict) this.fail();
  }

  judgeTap() {
    if (!this.running || !this.audioCtx || this.failed) return null;
    const now = this.audioCtx.currentTime;
    let best = null;
    let bestDelta = Infinity;

    for (const t of this.targets) {
      if (t.hit) continue;
      const deltaMs = Math.abs(now - t.time) * 1000;
      if (deltaMs < bestDelta) {
        bestDelta = deltaMs;
        best = t;
      }
    }

    if (!best || bestDelta > JUDGE.good.windowMs) {
      this.combo = 0;
      this.miss += 1;
      this.onJudge('miss', 0, this.combo, best?.index ?? null, best?.pos ?? null);
      if (this.strict) this.fail();
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
    this.onJudge(key, pts, this.combo, best.index, best.pos);
    this.onProgress(this.targets.filter((t) => t.hit).length, this.totalNotes);
    return key;
  }

  fail() {
    if (this.failed) return;
    this.failed = true;
    this.running = false;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.onFail({
      score: this.score,
      xp: this.xp,
      coins: this.coins,
      maxCombo: this.maxCombo,
      perfect: this.perfect,
      great: this.great,
      good: this.good,
      miss: this.miss,
      cleared: false,
    });
  }

  async start() {
    await this.ensureAudio();
    this.running = true;
    this.failed = false;
    this.targets = [];
    this.schedule();
  }

  finish() {
    if (!this.running || this.failed) return;
    this.running = false;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];

    const remaining = this.targets.filter((t) => !t.hit);
    if (remaining.length) {
      remaining.forEach((t) => {
        t.hit = true;
        this.miss += 1;
      });
      this.combo = 0;
      if (this.strict) {
        this.failed = true;
        this.onFail({
          score: this.score,
          xp: this.xp,
          coins: this.coins,
          maxCombo: this.maxCombo,
          perfect: this.perfect,
          great: this.great,
          good: this.good,
          miss: this.miss,
          cleared: false,
        });
        return;
      }
    }

    this.onEnd({
      score: this.score,
      xp: this.xp,
      coins: this.coins,
      maxCombo: this.maxCombo,
      perfect: this.perfect,
      great: this.great,
      good: this.good,
      miss: this.miss,
      cleared: this.miss === 0,
    });
  }

  stop() {
    this.running = false;
    this.failed = true;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }
}
