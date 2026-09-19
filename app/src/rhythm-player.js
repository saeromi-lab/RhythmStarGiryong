import { createAudioContext, resumeAudio } from './audio.js';

export class RhythmPlayer {
  constructor() {
    this.audioCtx = null;
    this.playing = false;
  }

  async ensureAudio() {
    if (!this.audioCtx) this.audioCtx = createAudioContext();
    await resumeAudio(this.audioCtx);
    return this.audioCtx;
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

  playNote(time, accent = false) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = accent ? 1180 : 980;
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    gain.gain.setValueAtTime(accent ? 0.16 : 0.13, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  scheduleClickTrack(start, totalBeats, beatSec, beatsPerBar) {
    const clicks = Math.max(1, Math.round(totalBeats));
    for (let b = 0; b < clicks; b += 1) {
      this.playClick(start + b * beatSec, b % beatsPerBar === 0);
    }
  }

  async playTimeline(timeline, bpm, {
    countdown = false,
    slow = false,
    clickTrack = false,
    beatsPerBar = 4,
  } = {}) {
    await this.ensureAudio();
    this.stop();
    this.playing = true;

    const effectiveBpm = slow ? bpm * 0.65 : bpm;
    const beatSec = 60 / effectiveBpm;
    const start = this.audioCtx.currentTime + 0.15;
    let t = start;

    if (countdown) {
      this.playClick(t, true);
      t += beatSec;
    }

    const notesStart = t;
    const totalBeats = timeline.reduce((sum, ev) => sum + ev.beats, 0);
    if (clickTrack) this.scheduleClickTrack(notesStart, totalBeats, beatSec, beatsPerBar);

    timeline.forEach((ev, i) => {
      if (!this.playing) return;
      if (ev.kind === 'n') this.playNote(t, i === 0);
      t += ev.beats * beatSec;
    });

    const totalMs = (t - start) * 1000 + 200;
    await new Promise((resolve) => {
      this._timer = setTimeout(() => {
        this.playing = false;
        resolve();
      }, totalMs);
    });
  }

  /**
   * 패턴 재생. pattern = 박 단위 음표 길이 배열
   * countdown: 시작 전 1박 기본박
   */
  async playPattern(pattern, bpm, {
    countdown = false,
    onHit,
    slow = false,
    clickTrack = false,
    beatsPerBar = 4,
  } = {}) {
    await this.ensureAudio();
    this.stop();
    this.playing = true;

    const effectiveBpm = slow ? bpm * 0.65 : bpm;
    const beatSec = 60 / effectiveBpm;
    const start = this.audioCtx.currentTime + 0.15;
    let t = start;

    if (countdown) {
      this.playClick(t, true);
      t += beatSec;
    }

    const notesStart = t;
    const totalBeats = pattern.reduce((sum, dur) => sum + dur, 0);
    if (clickTrack) this.scheduleClickTrack(notesStart, totalBeats, beatSec, beatsPerBar);

    pattern.forEach((dur, i) => {
      if (!this.playing) return;
      this.playNote(t, i === 0);
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

  /** 기본박 메트로놈 — 4/4는 4박, 6/8은 복박 2박 */
  async playBasicBeats(bpm, { bars = 1, beatsPerBar = 4, slow = false, onBeat } = {}) {
    await this.ensureAudio();
    this.stop();
    this.playing = true;

    const effectiveBpm = slow ? bpm * 0.65 : bpm;
    const beatSec = 60 / effectiveBpm;
    const start = this.audioCtx.currentTime + 0.12;
    const totalBeats = bars * beatsPerBar;
    this._beatTimers = [];

    for (let i = 0; i < totalBeats; i += 1) {
      const beatTime = start + i * beatSec;
      this.playClick(beatTime, i % beatsPerBar === 0);
      if (onBeat) {
        const delayMs = Math.max(0, (beatTime - this.audioCtx.currentTime) * 1000);
        this._beatTimers.push(setTimeout(() => {
          if (this.playing) onBeat(i + 1, totalBeats);
        }, delayMs));
      }
    }

    const totalMs = totalBeats * beatSec * 1000 + 250;
    await new Promise((resolve) => {
      this._timer = setTimeout(() => {
        if (this._beatTimers) {
          this._beatTimers.forEach((t) => clearTimeout(t));
          this._beatTimers = null;
        }
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
    if (this._beatTimers) {
      this._beatTimers.forEach((t) => clearTimeout(t));
      this._beatTimers = null;
    }
  }
}
