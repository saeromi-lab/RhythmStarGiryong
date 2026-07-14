/** 메트로놈 훈련 — 커리큘럼 연동 */

export { N, R } from './rhythm-groups.js';
import { trainPatternsFromCurriculum } from './rhythm-curriculum.js';

export const TRAIN_EXERCISES = trainPatternsFromCurriculum();

export const TRAIN_TIERS = [
  { id: 1, bars: 1, label: '1마디', hint: '기본 박·8분 리듬' },
  { id: 2, bars: 2, label: '2마디', hint: '쉼표·싱코페이션' },
  { id: 3, bars: 4, label: '4마디', hint: '연속 리듬 읽기' },
];

export function tierForBars(bars) {
  if (bars >= 4) return 3;
  if (bars >= 2) return 2;
  return 1;
}

export function exercisesForTier(tier) {
  return trainPatternsFromCurriculum().filter((ex) => ex.tier <= tier);
}

export function buildTrainMeasures(exercise, bars) {
  if (exercise.measures) {
    const slice = exercise.measures.slice(0, bars);
    if (slice.length >= bars) return slice;
    const out = [...slice];
    while (out.length < bars) {
      out.push(exercise.measures[out.length % exercise.measures.length]);
    }
    return out;
  }
  return Array.from({ length: bars }, () => exercise.measure);
}

export function countTrainNotes(measures) {
  return measures.reduce(
    (sum, bar) => sum + bar.filter((g) => g.t === 'n').length,
    0,
  );
}

export const TRAIN_PATTERNS = [];
