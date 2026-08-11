import { JUDGE } from './data.js';
import { countTrainNotes } from './train-data.js';

/** 메트로놈 박자에 맞춰 악보 리듬을 탭하는 훈련 */

export { TRAIN_EXERCISES, TRAIN_PATTERNS, TRAIN_TIERS } from './train-data.js';

const COUNT_IN_BEATS = 4;
/** 훈련 모드: 커서가 음표 위에 있을 때 탭하는 UX에 맞춘 판정 */
const TRAIN_EARLY_MS = 140;
const TRAIN_PERFECT_RATIO = 0.65; // 음표 길이의 65% 안이면 PERFECT

function trainPerfectWindowMs(target) {
  const noteDurMs = (target.endTime - target.time) * 1000;
  return Math.max(140, noteDurMs * TRAIN_PERFECT_RATIO);
}

function trainEarliestSec(target) {
  const earlyMs = target.index === 0 ? TRAIN_EARLY_MS + 40 : TRAIN_EARLY_MS;
  return target.time - earlyMs / 1000;
}

export class MetronomeTrainer {
  constructor({
    bpm,
    measures,
    strict = true,
    binaryJudge = true,
    onCountIn,
    onCursor,
    onNote,
    onJudge,
    onProgress,
    onFail,
    onEnd,
  }) {
    this.bpm = bpm;
    this.measures = measures;
    this.strict = strict;
    this.binaryJudge = binaryJudge;
    this.onCountIn = onCountIn ?? (() => {});
    this.onCursor = onCursor ?? (() => {});
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
    this.segments = [];
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
    this._cursorRaf = null;
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
    gain.gain.setValueAtTime(accent ? 0.18 : 0.11, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    osc.start(time);
    osc.stop(time + 0.07);
  }

  scheduleAt(when, fn) {
    const base = this.audioCtx.currentTime;
    const delayMs = Math.max(0, (when - base) * 1000);
    const timer = setTimeout(() => {
      if (!this.running) return;
      fn();
    }, delayMs);
    this.timers.push(timer);
  }

  buildSegments() {
    const segments = [];
    let beat = 0;
    for (let bar = 0; bar < this.measures.length; bar += 1) {
      for (const group of this.measures[bar]) {
        segments.push({
          pos: segments.length,
          startBeat: beat,
          durBeat: group.e * 0.5,
          isNote: group.t === 'n',
        });
        beat += group.e * 0.5;
      }
    }
    return segments;
  }

  computeTotalBeats() {
    return this.measures.reduce(
      (sum, bar) => sum + bar.reduce((b, g) => b + g.e * 0.5, 0),
      0,
    );
  }

  startCursorLoop() {
    const loop = () => {
      if (!this.running || this.failed || !this.audioCtx) return;
      const now = this.audioCtx.currentTime;

      if (now < this.rhythmStart) {
        const p = Math.max(0, (now - this.countInStart) / (COUNT_IN_BEATS * this.beatSec));
        this.onCursor({ phase: 'count-in', progress: p, activePos: -1 });
      } else {
        const elapsed = now - this.rhythmStart;
        const totalSec = this.totalBeats * this.beatSec;
        const progress = Math.min(1, elapsed / totalSec);
        const currentBeat = elapsed / this.beatSec;
        let activePos = -1;
        for (const seg of this.segments) {
          if (currentBeat >= seg.startBeat - 0.001 && currentBeat < seg.startBeat + seg.durBeat) {
            activePos = seg.pos;
            break;
          }
        }
        this.onCursor({ phase: 'play', progress, activePos, currentBeat });
      }

      if (now < this.rhythmStart + this.totalBeats * this.beatSec + 0.4) {
        this._cursorRaf = requestAnimationFrame(loop);
      }
    };
    this._cursorRaf = requestAnimationFrame(loop);
  }

  schedule() {
    const base = this.audioCtx.currentTime;
    this.countInStart = base;
    this.rhythmStart = base + COUNT_IN_BEATS * this.beatSec;
    this.totalBeats = this.computeTotalBeats();
    this.segments = this.buildSegments();

    for (let b = 0; b < COUNT_IN_BEATS; b += 1) {
      const t = base + b * this.beatSec;
      this.scheduleAt(t, () => {
        this.playClick(this.audioCtx.currentTime, b === 0);
        this.onCountIn(b + 1, COUNT_IN_BEATS);
      });
    }

    let hitIdx = 0;
    for (const seg of this.segments) {
      if (!seg.isNote) continue;
      const hitTime = this.rhythmStart + seg.startBeat * this.beatSec;
      const noteDurSec = seg.durBeat * this.beatSec;
      const endTime = hitTime + noteDurSec;
      const idx = hitIdx;
      hitIdx += 1;
      this.targets.push({
        time: hitTime,
        endTime,
        hit: false,
        index: idx,
        pos: seg.pos,
      });

      this.scheduleAt(hitTime, () => {
        this.onNote(idx, this.totalNotes);
      });

      // 커서가 음표를 지나갈 때까지 탭 대기 (55ms가 아니라 음표 길이 기준)
      const missAt = endTime + 0.04;
      this.scheduleAt(missAt, () => {
        const tgt = this.targets[idx];
        if (tgt && !tgt.hit) this.registerMiss(tgt);
      });
    }

    const endAt = this.rhythmStart + this.totalBeats * this.beatSec + 0.5;
    this.scheduleAt(endAt, () => this.finish());

    this.startCursorLoop();
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
    if (this.audioCtx.currentTime < this.rhythmStart) return null;

    const now = this.audioCtx.currentTime;
    let best = null;
    let bestDelta = Infinity;

    for (const t of this.targets) {
      if (t.hit) continue;
      if (now < trainEarliestSec(t) || now > t.endTime) continue;
      const deltaMs = Math.abs(now - t.time) * 1000;
      if (deltaMs < bestDelta) {
        bestDelta = deltaMs;
        best = t;
      }
    }

    // 아직 탭할 음표가 없으면 무시 (조기 탭으로 실패 처리하지 않음)
    if (!best) return null;

    const windowMs = this.binaryJudge
      ? trainPerfectWindowMs(best)
      : JUDGE.good.windowMs;

    best.hit = true;
    let key = 'miss';
    if (this.binaryJudge) {
      key = bestDelta <= trainPerfectWindowMs(best) ? 'perfect' : 'miss';
    } else if (bestDelta <= JUDGE.perfect.windowMs) key = 'perfect';
    else if (bestDelta <= JUDGE.great.windowMs) key = 'great';
    else if (bestDelta <= windowMs) key = 'good';

    if (key === 'miss') {
      this.combo = 0;
      this.miss += 1;
      this.onJudge('miss', 0, this.combo, best.index, best.pos);
      if (this.strict) this.fail();
      return 'miss';
    }

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
    if (this._cursorRaf) cancelAnimationFrame(this._cursorRaf);
    this.onCursor({ phase: 'end', progress: 1, activePos: -1 });
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
    this.onCursor({ phase: 'ready', progress: 0, activePos: -1 });
    this.schedule();
  }

  finish() {
    if (!this.running || this.failed) return;
    this.running = false;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (this._cursorRaf) cancelAnimationFrame(this._cursorRaf);
    this.onCursor({ phase: 'end', progress: 1, activePos: -1 });

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
    if (this._cursorRaf) cancelAnimationFrame(this._cursorRaf);
    this.onCursor({ phase: 'end', progress: 0, activePos: -1 });
  }
}
