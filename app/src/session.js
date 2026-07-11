import { JUMP_STEPS, SESSION_PHASES, getPhaseForWeek, weekHasStarMove } from './data.js';

export class TrainingSession {
  constructor({ week, onUpdate, onComplete }) {
    this.week = week;
    this.onUpdate = onUpdate ?? (() => {});
    this.onComplete = onComplete ?? (() => {});
    this.phaseIndex = 0;
    this.elapsedSec = 0;
    this.stepIndex = 0;
    this.running = false;
    this.paused = false;
    this.intervalId = null;
    this.phase = getPhaseForWeek(week);
  }

  get currentSessionPhase() {
    return SESSION_PHASES[this.phaseIndex];
  }

  get remainingSec() {
    const total = this.currentSessionPhase.durationSec;
    return Math.max(0, total - this.elapsedSec);
  }

  get currentStep() {
    return JUMP_STEPS[this.stepIndex % JUMP_STEPS.length];
  }

  get bpm() {
    return this.phase.bpm;
  }

  get showStarMove() {
    return weekHasStarMove(this.week) && this.currentSessionPhase.key === 'main';
  }

  tick() {
    this.elapsedSec += 1;
    if (this.elapsedSec % 8 === 0 && this.currentSessionPhase.key === 'main') {
      this.stepIndex += 1;
    }

    if (this.elapsedSec >= this.currentSessionPhase.durationSec) {
      if (this.phaseIndex < SESSION_PHASES.length - 1) {
        this.phaseIndex += 1;
        this.elapsedSec = 0;
      } else {
        this.stop(true);
        return;
      }
    }

    this.onUpdate(this.getState());
  }

  getState() {
    return {
      phaseIndex: this.phaseIndex,
      sessionPhase: this.currentSessionPhase,
      elapsedSec: this.elapsedSec,
      remainingSec: this.remainingSec,
      step: this.currentStep,
      stepIndex: this.stepIndex,
      bpm: this.bpm,
      showStarMove: this.showStarMove,
      running: this.running,
      paused: this.paused,
      programPhase: this.phase,
    };
  }

  start() {
    if (this.running && !this.paused) return;
    this.running = true;
    this.paused = false;
    if (!this.intervalId) {
      this.intervalId = setInterval(() => this.tick(), 1000);
    }
    this.onUpdate(this.getState());
  }

  pause() {
    this.paused = true;
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onUpdate(this.getState());
  }

  stop(completed = false) {
    this.running = false;
    this.paused = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (completed) {
      this.onComplete(this.getState());
    }
    this.onUpdate(this.getState());
  }

  reset() {
    this.stop(false);
    this.phaseIndex = 0;
    this.elapsedSec = 0;
    this.stepIndex = 0;
    this.onUpdate(this.getState());
  }
}

export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
