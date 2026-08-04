/** 리듬 러너 — ChordRunner 스타일, 모바일 TAP + 악보 리듬 */

import { MetronomeTrainer } from './metronome-trainer.js';

export const RUNNER_LIVES = 3;
export const RUNNER_PREP_BEATS = 2;

export class RhythmRunnerGame {
  constructor(options) {
    this.trainer = new MetronomeTrainer({
      ...options,
      strict: false,
      binaryJudge: false,
      prepBeats: options.prepBeats ?? RUNNER_PREP_BEATS,
      missGraceSec: options.missGraceSec ?? 0.55,
      tapLeadMs: options.tapLeadMs ?? 220,
      onCountIn: options.onCountIn,
      onPrep: options.onPrep,
      onCursor: options.onCursor,
      onNote: options.onNote,
      onJudge: (key, pts, combo, hitIdx, pos) => {
        if (key === 'miss') {
          this.lives -= 1;
          options.onLifeChange?.(this.lives);
          if (this.lives <= 0) {
            this.trainer.fail();
            return;
          }
        } else if (key === 'perfect') {
          options.onJump?.(hitIdx, pos);
        }
        options.onJudge?.(key, pts, combo, hitIdx, pos);
      },
      onProgress: options.onProgress,
      onFail: options.onFail,
      onEnd: options.onEnd,
    });
    this.lives = RUNNER_LIVES;
  }

  get running() {
    return this.trainer.running;
  }

  get score() {
    return this.trainer.score;
  }

  get combo() {
    return this.trainer.combo;
  }

  get perfect() {
    return this.trainer.perfect;
  }

  get miss() {
    return this.trainer.miss;
  }

  get great() {
    return this.trainer.great;
  }

  get good() {
    return this.trainer.good;
  }

  accuracy() {
    const total = this.trainer.perfect + this.trainer.great + this.trainer.good + this.trainer.miss;
    if (!total) return 100;
    const ok = this.trainer.perfect + this.trainer.great + this.trainer.good;
    return Math.round((ok / total) * 100);
  }

  async start() {
    this.lives = RUNNER_LIVES;
    await this.trainer.start();
  }

  judgeTap() {
    return this.trainer.judgeTap();
  }

  stop() {
    this.trainer.stop();
  }
}
