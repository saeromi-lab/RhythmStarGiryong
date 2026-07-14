/**
 * 실용음악 전공생용 리듬 커리큘럼
 * 교재 흐름: 2연음 → 쉼표·싱코페이션 → 6/8 → 2마디 읽기 → 재즈/16분
 */

import { N, R, groupsToPlayPattern, measureSum } from './rhythm-groups.js';

/** @typedef {'beginner'|'basic'|'intermediate'} LevelId */

/**
 * @typedef {object} CurriculumPattern
 * @property {string} id
 * @property {string} unitId
 * @property {LevelId} level
 * @property {string} meter
 * @property {number} bpm
 * @property {string} focus — 학습 포인트 (힌트용, 정답 노출 X)
 * @property {import('./rhythm-groups.js').Group[]} [measure] — 1마디
 * @property {import('./rhythm-groups.js').Group[][]} [measures] — 여러 마디
 * @property {number[]} [pattern] — 청음용 (레거시 quarter 단위, 쉼표 없음)
 * @property {number[]} [slots] — 빈칸용 (양수=음표 8분칸)
 * @property {number} [trainTier]
 */

export const CURRICULUM_UNITS = [
  {
    id: 'u1-even8',
    level: 'beginner',
    order: 1,
    title: '1과 · 2연음 기초',
    subtitle: '4분·8분음표 정박 읽기',
    skills: ['4분 4개', '8분 8개', '2분 2개', '4분+8분 혼합'],
    bpm: 80,
    meter: '4/4',
  },
  {
    id: 'u2-8mix',
    level: 'beginner',
    order: 2,
    title: '2과 · 8분 배치 변화',
    subtitle: '5B-2 기초 — 음표 위치 바꾸기',
    skills: ['♩♪♪ 패턴', '♪♪♩ 패턴', '8분 4연속'],
    bpm: 80,
    meter: '4/4',
  },
  {
    id: 'u3-rests',
    level: 'basic',
    order: 3,
    title: '3과 · 쉼표와 오프비트',
    subtitle: '5B-2 — 4분쉼·8분쉼·뒤박',
    skills: ['4분쉼', '8분쉼+8분', '오프비트 4연속'],
    bpm: 80,
    meter: '4/4',
  },
  {
    id: 'u4-sync',
    level: 'basic',
    order: 4,
    title: '4과 · 싱코페이션',
    subtitle: '점4분·밀림 리듬',
    skills: ['점4분+8분', '8분 밀림', '쉼 후 들어오기'],
    bpm: 88,
    meter: '4/4',
  },
  {
    id: 'u5-68',
    level: 'basic',
    order: 5,
    title: '5과 · 6/8 박자',
    subtitle: '복박자·점8분 그룹',
    skills: ['점8분 2개', '8분 3+점8분', '6/8 박자표'],
    bpm: 96,
    meter: '6/8',
  },
  {
    id: 'u6-2bar',
    level: 'intermediate',
    order: 6,
    title: '6과 · 2마디 연속 읽기',
    subtitle: '8박 한 번에 읽기·청음',
    skills: ['2마디 4분', '2마디 8분', '2마디 혼합'],
    bpm: 100,
    meter: '4/4',
  },
  {
    id: 'u7-jazz',
    level: 'intermediate',
    order: 7,
    title: '7과 · 재즈 리듬',
    subtitle: '스윙·오프비트 그루브',
    skills: ['재즈 4마디', '쉼+오프비트', '연속 싱코페이션'],
    bpm: 100,
    meter: '4/4',
  },
  {
    id: 'u8-sixteenth',
    level: 'intermediate',
    order: 8,
    title: '8과 · 16분음표 입문',
    subtitle: '4연음·빠른 칸 읽기',
    skills: ['16분 4연속', '8분+16분', '2마디 16분'],
    bpm: 72,
    meter: '4/4',
  },
];

function pat(unitId, level, meter, bpm, focus, data) {
  return { id: `${unitId}-${data.id}`, unitId, level, meter, bpm, focus, ...data };
}

/** 전체 패턴 풀 */
export const CURRICULUM_PATTERNS = [
  // —— U1: 2연음 기초 ——
  pat('u1-even8', 'beginner', '4/4', 80, '4분음표 4박 정박', {
    id: 'q4', pattern: [1, 1, 1, 1], slots: [2, 2, 2, 2],
    measure: [N(2), N(2), N(2), N(2)], trainTier: 1,
  }),
  pat('u1-even8', 'beginner', '4/4', 72, '8분음표 8개 균등', {
    id: 'e8', pattern: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], slots: [1, 1, 1, 1, 1, 1, 1, 1],
    measure: [N(1), N(1), N(1), N(1), N(1), N(1), N(1), N(1)], trainTier: 1,
  }),
  pat('u1-even8', 'beginner', '4/4', 80, '2분음표 2박', {
    id: 'h2', pattern: [2, 2], slots: [4, 4],
    measure: [N(4), N(4)], trainTier: 1,
  }),
  pat('u1-even8', 'beginner', '4/4', 80, '4분 + 8분 2개', {
    id: 'q-e2', pattern: [1, 0.5, 0.5, 1, 0.5, 0.5], slots: [2, 1, 1, 2, 1, 1],
    measure: [N(2), N(1), N(1), N(2), N(1), N(1)], trainTier: 1,
  }),
  pat('u1-even8', 'beginner', '4/4', 80, '8분 2개 + 4분', {
    id: 'e2-q', pattern: [0.5, 0.5, 1, 0.5, 0.5, 1], slots: [1, 1, 2, 1, 1, 2],
    measure: [N(1), N(1), N(2), N(1), N(1), N(2)], trainTier: 1,
  }),
  pat('u1-even8', 'beginner', '4/4', 88, '8분 4개 + 4분 2개', {
    id: 'e4-q2', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1], slots: [1, 1, 1, 1, 2, 2],
    measure: [N(1), N(1), N(1), N(1), N(2), N(2)], trainTier: 1,
  }),

  // —— U2: 8분 배치 ——
  pat('u2-8mix', 'beginner', '4/4', 80, '5B-2 L3 — ♩♪♪ 시작', {
    id: 'l3a', pattern: [1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], slots: [2, 1, 1, 1, 1, 1, 1],
    measure: [N(2), N(1), N(1), N(1), N(1), N(1), N(1)], trainTier: 1,
  }),
  pat('u2-8mix', 'beginner', '4/4', 80, '5B-2 L3 — ♪♪♩ 중간', {
    id: 'l3b', pattern: [0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5], slots: [1, 1, 2, 1, 1, 1, 1],
    measure: [N(1), N(1), N(2), N(1), N(1), N(1), N(1)], trainTier: 1,
  }),
  pat('u2-8mix', 'beginner', '4/4', 80, '5B-2 L3 — ♪♪♪♪ 끝', {
    id: 'l3c', pattern: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1], slots: [1, 1, 1, 1, 1, 1, 2],
    measure: [N(1), N(1), N(1), N(1), N(1), N(1), N(2)], trainTier: 1,
  }),
  pat('u2-8mix', 'beginner', '4/4', 80, '8분 4연속 + 4분 2개', {
    id: 'e4q2', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1], slots: [1, 1, 1, 1, 2, 2],
    measure: [N(1), N(1), N(1), N(1), N(2), N(2)],
  }),

  // —— U3: 쉼표 ——
  pat('u3-rests', 'basic', '4/4', 80, '4분 + 8분 + 4분쉼 + 8분', {
    id: '5b2-1a', slots: [2, 1, 1, -2, 1, 1],
    measure: [N(2), N(1), N(1), R(2), N(1), N(1)], trainTier: 2,
  }),
  pat('u3-rests', 'basic', '4/4', 80, '4분쉼 + 8분 + 4분', {
    id: '5b2-1b', slots: [-2, 1, 1, 2, 1, 1],
    measure: [R(2), N(1), N(1), N(2), N(1), N(1)], trainTier: 2,
  }),
  pat('u3-rests', 'basic', '4/4', 80, '4분·4분쉼 교대', {
    id: 'qr-alt', slots: [2, -2, 2, -2],
    measure: [N(2), R(2), N(2), R(2)], trainTier: 2,
  }),
  pat('u3-rests', 'basic', '4/4', 72, '8분쉼+8분 × 4 (오프비트)', {
    id: 'off4', slots: [-1, 1, -1, 1, -1, 1, -1, 1],
    measure: [R(1), N(1), R(1), N(1), R(1), N(1), R(1), N(1)], trainTier: 2,
  }),
  pat('u3-rests', 'basic', '4/4', 80, '8분 2개 + 4분쉼 + 8분 2개', {
    id: 'e2re2', slots: [1, 1, -2, 1, 1, -2],
    measure: [N(1), N(1), R(2), N(1), N(1), R(2)], trainTier: 2,
  }),

  // —— U4: 싱코페이션 ——
  pat('u4-sync', 'basic', '4/4', 88, '점4분 + 8분 + 4분', {
    id: 'dq', pattern: [1.5, 0.5, 1, 1], slots: [3, 1, 2, 2],
    measure: [N(3), N(1), N(2), N(2)],
  }),
  pat('u4-sync', 'basic', '4/4', 88, '4분 + 8분 밀림', {
    id: 'sync-a', pattern: [0.5, 1, 0.5, 0.5, 0.5, 1], slots: [1, 2, 1, 1, 1, 2],
    measure: [N(1), N(2), N(1), N(1), N(1), N(2)],
  }),
  pat('u4-sync', 'basic', '4/4', 88, '4분쉼 + 오프비트 + 4분', {
    id: 'sync-b', slots: [2, -2, -1, 1, 2],
    measure: [N(2), R(2), R(1), N(1), N(2)], trainTier: 2,
  }),
  pat('u4-sync', 'basic', '4/4', 88, '8분쉼 연속 후 4분', {
    id: 'sync-c', pattern: [1, 0.5, 0.5, 1, 0.5, 0.5], slots: [2, 1, 1, 2, 1, 1],
    measure: [N(2), N(1), N(1), N(2), N(1), N(1)],
  }),

  // —— U5: 6/8 ——
  pat('u5-68', 'basic', '6/8', 96, '점8분 2개 (6/8 기본)', {
    id: 'd8-2', slots: [3, 3], measure: [N(3), N(3)],
  }),
  pat('u5-68', 'basic', '6/8', 96, '8분 3개 + 점8분', {
    id: 'e3d8', slots: [1, 1, 1, 3], measure: [N(1), N(1), N(1), N(3)],
  }),
  pat('u5-68', 'basic', '6/8', 96, '점8분 + 8분 3개', {
    id: 'd8e3', slots: [3, 1, 1, 1], measure: [N(3), N(1), N(1), N(1)],
  }),
  pat('u5-68', 'basic', '6/8', 96, '4분 3개 (6/8)', {
    id: 'q3', slots: [2, 2, 2], measure: [N(2), N(2), N(2)],
  }),
  pat('u5-68', 'basic', '6/8', 96, '6/8 혼합 A', {
    id: 'mix-a', slots: [2, 1, 1, 2], measure: [N(2), N(1), N(1), N(2)],
  }),

  // —— U6: 2마디 ——
  pat('u6-2bar', 'intermediate', '4/4', 100, '2마디 4분 8개', {
    id: '2q8', pattern: [1, 1, 1, 1, 1, 1, 1, 1],
    measure: [N(2), N(2), N(2), N(2)],
    measures: [
      [N(2), N(2), N(2), N(2)],
      [N(2), N(2), N(2), N(2)],
    ],
  }),
  pat('u6-2bar', 'intermediate', '4/4', 100, '2마디 4분+8분', {
    id: '2mix', pattern: [1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    measure: [N(2), N(2), N(2), N(2), N(1), N(1), N(1), N(1)],
  }),
  pat('u6-2bar', 'intermediate', '4/4', 100, '2마디 싱코페이션', {
    id: '2sync', pattern: [1, 0.5, 0.5, 1, 0.5, 0.5, 1, 1],
    measure: [N(2), N(1), N(1), N(2), N(1), N(1), N(2), N(2)],
  }),
  pat('u6-2bar', 'intermediate', '4/4', 100, '2마디 8분 그루브', {
    id: '2e8', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1],
    measure: [N(1), N(1), N(1), N(1), N(2), N(2), N(2), N(2)],
  }),
  pat('u6-2bar', 'intermediate', '4/4', 100, '2마디 2분 4개', {
    id: '2h4', pattern: [2, 2, 2, 2],
    measure: [N(4), N(4)],
    measures: [[N(4), N(4)], [N(4), N(4)]],
  }),

  // —— U7: 재즈 ——
  pat('u7-jazz', 'intermediate', '4/4', 100, '재즈 4마디 A', {
    id: 'jz-a', trainTier: 3,
    measures: [
      [N(1), N(1), N(1), N(1), N(4)],
      [R(1), N(1), R(1), N(1), R(1), N(1), R(1), N(1)],
      [R(1), N(1), R(1), N(1), R(4)],
      [R(1), N(1), R(1), N(1), N(4)],
    ],
  }),
  pat('u7-jazz', 'intermediate', '4/4', 90, '재즈 4마디 B', {
    id: 'jz-b', trainTier: 3,
    measures: [
      [N(2), R(1), N(1), N(1), N(1), R(2)],
      [N(1), N(1), R(1), N(1), N(2), N(2)],
      [N(2), N(2), N(1), N(1), N(1), N(1)],
      [N(1), N(1), R(1), N(1), N(2), R(2)],
    ],
  }),
  pat('u7-jazz', 'intermediate', '4/4', 80, '5B-2 4마디 세트', {
    id: '5b2-4', trainTier: 3,
    measures: [
      [N(2), N(1), N(1), R(2), N(1), N(1)],
      [R(2), N(1), N(1), N(2), N(1), N(1)],
      [N(1), N(1), N(1), N(1), N(1), N(1), N(1), N(1)],
      [N(1), N(1), N(1), N(1), N(2), N(2)],
    ],
  }),

  // —— U8: 16분 (청음 중심 — pattern 배열로 정밀 재생) ——
  pat('u8-sixteenth', 'intermediate', '4/4', 72, '16분 4연속 + 4분 3개', {
    id: '16a', pattern: [0.25, 0.25, 0.25, 0.25, 1, 1, 1],
    measure: [N(1), N(1), N(2), N(2), N(2)],
  }),
  pat('u8-sixteenth', 'intermediate', '4/4', 72, '8분 + 16분 2개 + 4분 2개', {
    id: '16b', pattern: [0.5, 0.25, 0.25, 1, 0.5, 0.25, 0.25, 1],
    measure: [N(1), N(1), N(1), N(2), N(1), N(1), N(1), N(2)],
  }),
  pat('u8-sixteenth', 'intermediate', '4/4', 60, '16분 8개 + 4분 2개', {
    id: '16c', pattern: [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 1, 1],
    measure: [N(1), N(1), N(1), N(1), N(2), N(2)],
  }),
];

// 검증
for (const p of CURRICULUM_PATTERNS) {
  const unit = CURRICULUM_UNITS.find((u) => u.id === p.unitId);
  const perBar = p.meter === '6/8' ? 6 : 8;
  if (p.measure && measureSum(p.measure) !== perBar) {
    console.warn(`커리큘럼 마디 불일치: ${p.id} (${measureSum(p.measure)}/${perBar})`);
  }
  if (p.measures) {
    p.measures.forEach((m, i) => {
      if (measureSum(m) !== perBar) {
        console.warn(`커리큘럼 ${p.id} ${i + 1}마디 불일치`);
      }
    });
  }
}

export function getUnit(unitId) {
  return CURRICULUM_UNITS.find((u) => u.id === unitId);
}

export function unitsForLevel(levelId) {
  return CURRICULUM_UNITS.filter((u) => u.level === levelId);
}

export function patternsForUnit(unitId) {
  return CURRICULUM_PATTERNS.filter((p) => p.unitId === unitId);
}

export function patternsForLevel(levelId) {
  const unitIds = unitsForLevel(levelId).map((u) => u.id);
  return CURRICULUM_PATTERNS.filter((p) => unitIds.includes(p.unitId));
}

export function listenPatternsForLevel(levelId) {
  const perBar = (p) => (p.meter === '6/8' ? 6 : 8);
  return patternsForLevel(levelId).filter((p) => {
    if (p.pattern && isValidListenPattern(p.pattern)) return true;
    if (p.measure && measureSum(p.measure) === perBar(p)) return true;
    return false;
  });
}

export function fillPatternsForLevel(levelId) {
  return patternsForLevel(levelId).filter((p) => {
    if (!p.slots) return false;
    if (hasRests(p.slots)) return false;
    return slotSumValid(p);
  });
}

export function trainPatternsFromCurriculum() {
  return CURRICULUM_PATTERNS.filter((p) => p.measure || p.measures).map((p) => ({
    id: p.id,
    tier: p.trainTier ?? (p.level === 'beginner' ? 1 : p.level === 'basic' ? 2 : 3),
    measure: p.measure,
    measures: p.measures,
    bpm: p.bpm,
    unitId: p.unitId,
  }));
}

export function slotSumValid(p) {
  const perBar = p.meter === '6/8' ? 6 : 8;
  if (p.slots) {
    return p.slots.reduce((a, s) => a + Math.abs(s), 0) === perBar;
  }
  if (p.measure) return measureSum(p.measure) === perBar;
  return false;
}

export function isValidListenPattern(pattern) {
  const beats = pattern.reduce((s, d) => s + d, 0);
  return beats === 4 || beats === 8;
}

export function patternBeats(pattern) {
  return pattern.reduce((s, d) => s + d, 0);
}

export function patternKey(pattern) {
  return pattern.join(',');
}

export function slotsKey(slots) {
  return slots.join(',');
}

/** 빈칸용: 음표 슬롯만 (쉼표는 양수 변환 불가 — groups 기반 fill 별도) */
export function fillSlotsNoteOnly(slots) {
  return slots.map((s) => Math.abs(s));
}

export function hasRests(slots) {
  return slots.some((s) => s < 0);
}

export function groupsFromPattern(p) {
  if (p.measure) return p.measure;
  if (p.slots) {
    return p.slots.map((s) => (s > 0 ? N(s) : R(-s)));
  }
  if (p.pattern) {
    return p.pattern.map((d) => N(Math.round(d * 2)));
  }
  return [];
}

export function playPatternForEntry(p) {
  if (p.measure) return groupsToPlayPattern(p.measure);
  if (p.pattern) return [...p.pattern];
  if (p.slots) return groupsToPlayPattern(groupsFromPattern(p));
  return [];
}

export function playTimelineForEntry(p) {
  const groups = groupsFromPattern(p);
  if (groups.length) {
    return groups.map((g) => ({ kind: g.t, beats: g.e * 0.5 }));
  }
  if (p.pattern) {
    return p.pattern.map((d) => ({ kind: 'n', beats: d }));
  }
  return [];
}
