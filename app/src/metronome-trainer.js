import { JUDGE } from './data.js';
import { countTrainNotes } from './train-data.js';
import { createAudioContext, resumeAudio } from './audio.js';

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

function trainEarliestSec(target, tapLeadMs = TRAIN_EARLY_MS) {
  const earlyMs = target.index === 0 ? tapLeadMs + 40 : tapLeadMs;
  return target.time - earlyMs / 1000;
}

export class MetronomeTrainer {
  constructor({
    bpm,
    measures,
    strict = true,
    binaryJudge = true,
    prepBeats = 0,
    missGraceSec = 0.04,
    tapLeadMs = TRAIN_EARLY_MS,
    clickTrack = true,
    tapSound = 'click',
    onCountIn,
    onPrep,
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
    this.prepBeats = prepBeats;
    this.missGraceSec = missGraceSec;
    this.tapLeadMs = tapLeadMs;
    this.clickTrack = clickTrack;
    this.tapSound = tapSound;
    this.onCountIn = onCountIn ?? (() => {});
    this.onPrep = onPrep ?? (() => {});
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
    this.wallStart = 0;
    this.audioBase = 0;
  }

  nowAudio() {
    if (!this.audioCtx) return 0;
    const audioNow = this.audioCtx.currentTime;
    const audioElapsed = audioNow - this.audioBase;
    const wallElapsed = (performance.now() - this.wallStart) / 1000;
    if (this.wallStart && audioElapsed < wallElapsed * 0.6) {
      return this.audioBase + wallElapsed;
    }
    return audioNow;
  }

  async ensureAudio() {
    if (!this.audioCtx) this.audioCtx = createAudioContext();
    await resumeAudio(this.audioCtx);
  }

  playTone(time, { freq, gainVal, dur = 0.065 }) {
    if (!this.audioCtx) return;
    const t = time > this.audioCtx.currentTime - 0.002 ? time : this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
  }

  playClick(time, accent = false) {
    this.playTone(time, {
      freq: accent ? 720 : 480,
      gainVal: accent ? 0.16 : 0.1,
      dur: 0.065,
    });
  }

  playTap(time = this.audioCtx.currentTime) {
    if (this.tapSound === 'note') {
      this.playRhythmNote(time);
      return;
    }
    this.playTone(time, { freq: 620, gainVal: 0.11, dur: 0.06 });
    this.playTone(time, { freq: 930, gainVal: 0.035, dur: 0.04 });
  }

  playRhythmNote(time, accent = false) {
    if (!this.audioCtx) return;
    const t = time > this.audioCtx.currentTime - 0.002 ? time : this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1180 : 980, t);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    gain.gain.setValueAtTime(accent ? 0.16 : 0.13, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  beatsPerBar() {
    const eighths = this.measures[0]?.reduce((sum, group) => sum + group.e, 0) ?? 8;
    return eighths === 6 ? 2 : 4;
  }

  scheduleAt(when, fn) {
    const delayMs = Math.max(0, (when - this.nowAudio()) * 1000);
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
      const now = this.nowAudio();

      if (now < this.countInStart + COUNT_IN_BEATS * this.beatSec) {
        const p = Math.max(0, (now - this.countInStart) / (COUNT_IN_BEATS * this.beatSec));
        this.onCursor({ phase: 'count-in', progress: p, activePos: -1 });
      } else if (now < this.rhythmStart) {
        const prepElapsed = now - (this.countInStart + COUNT_IN_BEATS * this.beatSec);
        const p = Math.max(0, prepElapsed / (Math.max(this.prepBeats, 1) * this.beatSec));
        this.onCursor({ phase: 'prep', progress: p, activePos: -1 });
      } else {
        const elapsed = now - this.rhythmStart;
        const totalSec = this.totalBeats * this.beatSec;
        const progress = Math.min(1, elapsed / totalSec);
        const currentBeat = elapsed / this.beatSec;
        let activeSeg = null;
        for (const seg of this.segments) {
          if (currentBeat >= seg.startBeat - 0.001 && currentBeat < seg.startBeat + seg.durBeat) {
            activeSeg = seg;
            break;
          }
        }
        if (!activeSeg && this.segments.length) {
          const last = this.segments[this.segments.length - 1];
          if (currentBeat >= last.startBeat) activeSeg = last;
          else activeSeg = this.segments[0];
        }
        this.onCursor({
          phase: 'play',
          progress,
          activePos: activeSeg?.pos ?? -1,
          currentBeat,
          startBeat: activeSeg?.startBeat ?? 0,
          durBeat: activeSeg?.durBeat ?? 1,
        });
      }

      if (now < this.rhythmStart + this.totalBeats * this.beatSec + 0.4) {
        this._cursorRaf = requestAnimationFrame(loop);
      }
    };
    this._cursorRaf = requestAnimationFrame(loop);
  }

  schedule() {
    const base = this.nowAudio();
    this.audioBase = this.audioCtx.currentTime;
    this.wallStart = performance.now();
    this.countInStart = base;
    this.rhythmStart = base + (COUNT_IN_BEATS + this.prepBeats) * this.beatSec;
    this.segments = this.buildSegments();
    const segBeats = this.segments.reduce((s, seg) => s + seg.durBeat, 0);
    this.totalBeats = Math.max(this.computeTotalBeats(), segBeats, 4);

    for (let b = 0; b < COUNT_IN_BEATS; b += 1) {
      const t = base + b * this.beatSec;
      this.playClick(t, b === 0);
      this.scheduleAt(t, () => this.onCountIn(b + 1, COUNT_IN_BEATS));
    }

    for (let b = 0; b < this.prepBeats; b += 1) {
      const t = base + (COUNT_IN_BEATS + b) * this.beatSec;
      this.playClick(t, false);
      this.scheduleAt(t, () => this.onPrep(b + 1, this.prepBeats));
    }

    const barBeats = this.beatsPerBar();
    const playClicks = Math.max(1, Math.round(this.totalBeats));
    for (let b = 0; b < playClicks; b += 1) {
      const t = this.rhythmStart + b * this.beatSec;
      if (this.clickTrack) this.playClick(t, b % barBeats === 0);
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
      const missAt = endTime + this.missGraceSec;
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
    this.playTap(this.audioCtx.currentTime);
    if (this.nowAudio() < this.rhythmStart - 0.2) return null;

    const now = this.nowAudio() - 0.035;
    let best = null;
    let bestDelta = Infinity;

    for (const t of this.targets) {
      if (t.hit) continue;
      if (now < trainEarliestSec(t, this.tapLeadMs) || now > t.endTime + this.missGraceSec) continue;
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
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.running = true;
    this.failed = false;
    this.targets = [];
    this.onCursor({ phase: 'ready', progress: 0, activePos: -1 });
    this.schedule();
  }

  finish() {
    if (!this.running || this.failed) return;
    const minMs = (COUNT_IN_BEATS + this.prepBeats + Math.max(this.totalBeats, 1)) * this.beatSec * 1000;
    const remain = this.wallStart ? minMs - (performance.now() - this.wallStart) : 0;
    if (remain > 80) {
      const timer = setTimeout(() => this.finish(), remain + 40);
      this.timers.push(timer);
      return;
    }
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
