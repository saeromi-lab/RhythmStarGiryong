/** 비트 서핑 — 파도마다 다른 리듬, 기본박은 빨라졌다 느려졌다, 판정은 좁게 */

import { MetronomeTrainer } from './metronome-trainer.js';
import { exercisesForTier, buildTrainMeasures } from './train-data.js';

export const RUNNER_LIVES = 3;
export const RUNNER_PREP_BEATS = 2;
export const RUNNER_WAVES = 4;
export const RUNNER_BPM_CAP = 184;
/** 1파도 기본 → 빨라짐 → 느려짐 → 더 빨라짐 */
export const RUNNER_BPM_CURVE = [0, 16, -12, 28];
export const RUNNER_JUDGE = { perfect: 42, great: 78, good: 112 };

export function runnerBpmForWave(baseBpm, waveIndex, {
  curve = RUNNER_BPM_CURVE,
  cap = RUNNER_BPM_CAP,
} = {}) {
  const offset = curve[Math.min(Math.max(0, waveIndex), curve.length - 1)] ?? 0;
  return Math.max(60, Math.min(cap, baseBpm + offset));
}

function groupsOf(ex) {
  return ex.measures?.flat() ?? ex.measure ?? [];
}

function hasRest(ex) {
  return groupsOf(ex).some((g) => g.t === 'r');
}

function noteLens(ex) {
  return [...new Set(groupsOf(ex).filter((g) => g.t === 'n').map((g) => g.e))];
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 난이도별 4파도 플레이리스트 — 8분·쉼표·싱코를 섞고 같은 4분 반복을 피함 */
export function buildRunnerPlaylist(levelId) {
  const tierMap = { beginner: 1, basic: 2, intermediate: 3, advanced: 3 };
  const tier = tierMap[levelId] ?? 1;
  const pool = shuffle(exercisesForTier(Math.min(3, tier + 1)));
  const picked = [];
  const used = new Set();

  const take = (pred) => {
    const found = pool.find((ex) => !used.has(ex.id) && pred(ex));
    if (!found) return;
    used.add(found.id);
    picked.push(found);
  };

  take((ex) => !hasRest(ex) && noteLens(ex).every((e) => e === 1 || e === 2) && noteLens(ex).length >= 1);
  take((ex) => noteLens(ex).includes(1) && noteLens(ex).some((e) => e !== 1));
  take((ex) => hasRest(ex));
  take((ex) => hasRest(ex) || noteLens(ex).includes(3) || groupsOf(ex).length >= 6);

  for (const ex of pool) {
    if (picked.length >= RUNNER_WAVES) break;
    if (!used.has(ex.id)) {
      used.add(ex.id);
      picked.push(ex);
    }
  }
  while (picked.length < RUNNER_WAVES && pool.length) {
    picked.push(pool[picked.length % pool.length]);
  }

  return picked.slice(0, RUNNER_WAVES).map((ex) => ({
    id: ex.id,
    title: ex.focus ?? '리듬 파도',
    measures: buildTrainMeasures(ex, ex.measures ? Math.min(2, ex.measures.length) : 1),
  }));
}

export class RhythmRunnerGame {
  constructor(options) {
    this.options = options;
    this.lives = RUNNER_LIVES;
    this.baseBpm = options.bpm;
    this.waveIndex = 0;
    this.playlist = options.playlist?.length ? options.playlist : [{
      measures: options.measures,
      title: options.title ?? '리듬 파도',
    }];
    this.waveCount = options.waves ?? this.playlist.length ?? RUNNER_WAVES;
    this._running = false;
    this.session = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0,
    };
    this.trainer = null;
    this._waveBanked = false;
  }

  currentItem() {
    return this.playlist[this.waveIndex] ?? this.playlist[0];
  }

  currentBpm() {
    return runnerBpmForWave(this.baseBpm, this.waveIndex);
  }

  get running() {
    return this._running;
  }

  get inCountIn() {
    if (!this._running || !this.trainer?.running) return false;
    return this.trainer.nowAudio() < this.trainer.rhythmStart - 0.2;
  }

  get score() {
    if (this._waveBanked) return this.session.score;
    return this.session.score + (this.trainer?.score ?? 0);
  }

  get combo() {
    return this.trainer?.combo ?? this.session.combo;
  }

  get perfect() {
    if (this._waveBanked) return this.session.perfect;
    return this.session.perfect + (this.trainer?.perfect ?? 0);
  }

  get miss() {
    if (this._waveBanked) return this.session.miss;
    return this.session.miss + (this.trainer?.miss ?? 0);
  }

  get great() {
    if (this._waveBanked) return this.session.great;
    return this.session.great + (this.trainer?.great ?? 0);
  }

  get good() {
    if (this._waveBanked) return this.session.good;
    return this.session.good + (this.trainer?.good ?? 0);
  }

  bankTrainerStats() {
    if (!this.trainer || this._waveBanked) return;
    this._waveBanked = true;
    this.session.score += this.trainer.score;
    this.session.maxCombo = Math.max(this.session.maxCombo, this.trainer.maxCombo);
    this.session.perfect += this.trainer.perfect;
    this.session.great += this.trainer.great;
    this.session.good += this.trainer.good;
    this.session.miss += this.trainer.miss;
    this.session.combo = this.trainer.combo;
  }

  resultPayload(cleared) {
    return {
      score: this.score,
      xp: this.trainer?.xp ?? 0,
      coins: this.trainer?.coins ?? 0,
      maxCombo: Math.max(this.session.maxCombo, this.trainer?.maxCombo ?? 0),
      perfect: this.perfect,
      great: this.great,
      good: this.good,
      miss: this.miss,
      cleared,
      bpm: this.currentBpm(),
      startBpm: this.baseBpm,
      waves: this.waveIndex + (cleared ? 0 : 1),
    };
  }

  accuracy() {
    const total = this.perfect + this.great + this.good + this.miss;
    if (!total) return 100;
    const ok = this.perfect + this.great + this.good;
    return Math.round((ok / total) * 100);
  }

  async start() {
    this.lives = RUNNER_LIVES;
    this.waveIndex = 0;
    this._running = true;
    this.session = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0,
    };
    await this.startWave();
  }

  async startWave() {
    if (!this._running) return;
    const bpm = this.currentBpm();
    const item = this.currentItem();
    const measures = item.measures;
    this.options.onWaveStart?.(this.waveIndex + 1, this.waveCount, bpm, this.baseBpm, measures, item.title);
    this._waveBanked = false;

    this.trainer = new MetronomeTrainer({
      bpm,
      measures,
      strict: false,
      binaryJudge: false,
      prepBeats: this.waveIndex === 0 ? (this.options.prepBeats ?? 0) : 0,
      missGraceSec: this.options.missGraceSec ?? 0.1,
      tapLeadMs: this.options.tapLeadMs ?? 100,
      judgeWindows: this.options.judgeWindows ?? RUNNER_JUDGE,
      onCountIn: this.options.onCountIn,
      onPrep: this.options.onPrep,
      onCursor: this.options.onCursor,
      onNote: this.options.onNote,
      onJudge: (key, pts, combo, hitIdx, pos) => {
        if (key === 'miss') {
          if (this.lives > 0) this.lives -= 1;
          this.options.onLifeChange?.(this.lives);
        } else if (key === 'perfect') {
          this.options.onJump?.(hitIdx, pos);
        }
        this.options.onJudge?.(key, pts, combo, hitIdx, pos);
        if (key === 'miss' && this.lives <= 0) {
          this.trainer?.fail();
        }
      },
      onProgress: this.options.onProgress,
      onFail: (result) => {
        this.bankTrainerStats();
        this._running = false;
        this.options.onFail?.({ ...this.resultPayload(false), ...result, score: this.session.score });
      },
      onEnd: async (result) => {
        this.bankTrainerStats();
        if (!this._running) return;
        if (this.lives <= 0) {
          this._running = false;
          this.options.onFail?.(this.resultPayload(false));
          return;
        }
        if (this.waveIndex + 1 < this.waveCount) {
          this.waveIndex += 1;
          await this.startWave();
          return;
        }
        this._running = false;
        this.options.onEnd?.({ ...result, ...this.resultPayload(true), score: this.session.score });
      },
    });

    await this.trainer.start();
  }

  judgeTap() {
    if (!this._running || !this.trainer) return null;
    return this.trainer.judgeTap();
  }

  stop() {
    this._running = false;
    this.trainer?.stop();
  }
}
