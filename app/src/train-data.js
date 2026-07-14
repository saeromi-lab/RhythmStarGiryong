/** 메트로놈 훈련 — 교재 기반 리듬 (8분음표 칸 단위) */

export const N = (eighths) => ({ t: 'n', e: eighths });
export const R = (eighths) => ({ t: 'r', e: eighths });

/** 1=1마디만, 2=2마디까지, 3=4마디까지 */
export const TRAIN_TIERS = [
  { id: 1, bars: 1, label: '1마디', hint: '기본 박·8분 리듬' },
  { id: 2, bars: 2, label: '2마디', hint: '쉼표·싱코페이션' },
  { id: 3, bars: 4, label: '4마디', hint: '연속 리듬 읽기' },
];

/**
 * measure: 1마디 그룹 (8칸). measures: 마디마다 다른 패턴(4마디 세트).
 * tier: 이 패턴이 열리는 최소 단계
 */
export const TRAIN_EXERCISES = [
  // —— 1마디 기초 (2연음 슬로우) ——
  {
    id: 'e-q4',
    tier: 1,
    measure: [N(2), N(2), N(2), N(2)],
    bpm: 80,
  },
  {
    id: 'e-e8',
    tier: 1,
    measure: [N(1), N(1), N(1), N(1), N(1), N(1), N(1), N(1)],
    bpm: 72,
  },
  {
    id: 'e-half',
    tier: 1,
    measure: [N(4), N(4)],
    bpm: 80,
  },
  {
    id: 'e-mix-a',
    tier: 1,
    measure: [N(2), N(1), N(1), N(2), N(1), N(1)],
    bpm: 80,
  },
  {
    id: 'e-mix-b',
    tier: 1,
    measure: [N(1), N(1), N(2), N(1), N(1), N(2)],
    bpm: 80,
  },
  {
    id: 'e-8block-q',
    tier: 1,
    measure: [N(1), N(1), N(1), N(1), N(2), N(2)],
    bpm: 88,
  },

  // —— 2마디: 쉼표·오프비트 (5B-2) ——
  {
    id: 'e-5b2-a',
    tier: 2,
    measure: [N(2), N(1), N(1), R(2), N(1), N(1)],
    bpm: 80,
  },
  {
    id: 'e-5b2-b',
    tier: 2,
    measure: [R(2), N(1), N(1), N(2), N(1), N(1)],
    bpm: 80,
  },
  {
    id: 'e-5b2-sync',
    tier: 2,
    measure: [N(2), R(2), R(1), N(1), N(2)],
    bpm: 80,
  },
  {
    id: 'e-offbeat',
    tier: 2,
    measure: [R(1), N(1), R(1), N(1), R(1), N(1), R(1), N(1)],
    bpm: 72,
  },
  {
    id: 'e-q-rest',
    tier: 2,
    measure: [N(2), R(2), N(2), R(2)],
    bpm: 80,
  },
  {
    id: 'e-8-rest',
    tier: 2,
    measure: [N(1), N(1), R(2), N(1), N(1), R(2)],
    bpm: 80,
  },

  // —— 4마디 연속 (5B-2 · 재즈리듬) ——
  {
    id: 'e-5b2-l3',
    tier: 3,
    measures: [
      [N(2), N(1), N(1), N(1), N(1), N(1)],
      [N(1), N(1), N(2), N(1), N(1), N(1), N(1)],
      [N(1), N(1), N(1), N(1), N(2), N(1), N(1)],
      [N(1), N(1), N(1), N(1), N(1), N(1), N(2)],
    ],
    bpm: 80,
  },
  {
    id: 'e-5b2-l1',
    tier: 3,
    measures: [
      [N(2), N(1), N(1), R(2), N(1), N(1)],
      [R(2), N(1), N(1), N(2), N(1), N(1)],
      [N(1), N(1), N(1), N(1), N(1), N(1), N(1), N(1)],
      [N(1), N(1), N(1), N(1), N(2), N(2)],
    ],
    bpm: 80,
  },
  {
    id: 'e-jazz-a',
    tier: 3,
    measures: [
      [N(1), N(1), N(1), N(1), N(4)],
      [R(1), N(1), R(1), N(1), R(1), N(1), R(1), N(1)],
      [R(1), N(1), R(1), N(1), R(4)],
      [R(1), N(1), R(1), N(1), N(4)],
    ],
    bpm: 100,
  },
  {
    id: 'e-jazz-b',
    tier: 3,
    measures: [
      [N(2), R(1), N(1), N(1), N(1), R(2)],
      [N(1), N(1), R(1), N(1), N(2), N(2)],
      [N(2), N(2), N(1), N(1), N(1), N(1)],
      [N(1), N(1), R(1), N(1), N(2), R(2)],
    ],
    bpm: 90,
  },
  {
    id: 'e-row8',
    tier: 3,
    measures: [
      [N(2), R(2), N(2), R(2)],
      [N(1), N(1), R(2), N(1), N(1), R(2)],
      [R(2), N(2), R(2), N(2)],
      [R(1), N(1), R(1), N(1), N(1), N(1), N(1), N(1)],
    ],
    bpm: 80,
  },
];

export function tierForBars(bars) {
  if (bars >= 4) return 3;
  if (bars >= 2) return 2;
  return 1;
}

export function exercisesForTier(tier) {
  return TRAIN_EXERCISES.filter((ex) => ex.tier <= tier);
}

export function buildTrainMeasures(exercise, bars) {
  if (exercise.measures) {
    const slice = exercise.measures.slice(0, bars);
    if (slice.length >= bars) return slice;
    const out = [...slice];
    while (out.length < bars) out.push(exercise.measures[out.length % exercise.measures.length]);
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

/** @deprecated — train-data 사용 */
export const TRAIN_PATTERNS = TRAIN_EXERCISES.filter((ex) => ex.tier === 1).map((ex) => ({
  id: ex.id,
  name: ex.id,
  pattern: ex.measure.filter((g) => g.t === 'n').map((g) => g.e * 0.5),
}));
