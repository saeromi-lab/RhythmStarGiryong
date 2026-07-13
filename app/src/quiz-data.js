/** 리듬 패턴: 각 숫자 = 음표 길이(박 단위). 1=4분, 0.5=8분, 2=2분 */

export function patternToNotation(pattern) {
  return pattern
    .map((d) => {
      if (d === 2) return '𝅗𝅥';
      if (d === 1) return '♩';
      if (d === 0.5) return '♪';
      return '♩';
    })
    .join(' ');
}

export function patternKey(pattern) {
  return pattern.join(',');
}

export const QUIZ_LEVELS = [
  { id: 'beginner', name: '입문', bpm: 88, barsLabel: '1마디' },
  { id: 'basic', name: '기초', bpm: 100, barsLabel: '1~2마디' },
  { id: 'intermediate', name: '심화', bpm: 112, barsLabel: '2마디' },
];

/** @type {{ level: string, pattern: number[], title?: string }[]} */
export const QUIZ_PATTERNS = [
  // 입문 — 1마디 (4/4)
  { level: 'beginner', pattern: [1, 1, 1, 1], title: '기본 4분음표' },
  { level: 'beginner', pattern: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], title: '8분음표 8개' },
  { level: 'beginner', pattern: [1, 0.5, 0.5, 0.5, 0.5], title: '점8분 리듬' },
  { level: 'beginner', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1], title: '앞 8분 4개' },
  { level: 'beginner', pattern: [1, 1, 0.5, 0.5, 0.5, 0.5], title: '뒤 8분 4개' },
  { level: 'beginner', pattern: [2, 2], title: '2분음표 2개' },

  // 기초 — 1마디 (4박)
  { level: 'basic', pattern: [0.5, 1, 0.5, 0.5, 0.5, 1], title: '싱코페이션 A' },
  { level: 'basic', pattern: [1, 0.5, 0.5, 1, 0.5, 0.5], title: '싱코페이션 B' },
  { level: 'basic', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1], title: '앞 8분 4개' },
  { level: 'basic', pattern: [1, 0.5, 0.5, 0.5, 0.5], title: '뒤 8분 4개' },
  { level: 'basic', pattern: [1, 1, 1, 1], title: '4분 4개' },
  // 기초 — 2마디 (8박)
  { level: 'basic', pattern: [1, 1, 1, 1, 1, 0.5, 0.5, 1], title: '2마디 기본' },
  { level: 'basic', pattern: [0.5, 0.5, 1, 1, 1, 1, 1, 1], title: '2마디 8분 시작' },

  // 심화 — 2마디
  { level: 'intermediate', pattern: [1, 0.5, 0.5, 1, 0.5, 0.5, 1, 1], title: '2마디 싱코페이션' },
  { level: 'intermediate', pattern: [0.5, 1, 0.5, 1, 1, 0.5, 0.5, 1], title: '2마디 혼합 A' },
  { level: 'intermediate', pattern: [1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1], title: '2마디 혼합 B' },
  { level: 'intermediate', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1], title: '2마디 8분 그루브' },
  { level: 'intermediate', pattern: [1, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 1], title: '2마디 팝 그루브' },
];

export const QUIZ_ROUND_SIZE = 5;

export const QUIZ_SCORE = {
  correct: { points: 200, xp: 25, coins: 5 },
  wrong: { points: 0, xp: 3, coins: 0 },
  streakBonus: 50,
};

export function patternBeats(pattern) {
  return pattern.reduce((s, d) => s + d, 0);
}

export function getPatternsForLevel(levelId) {
  return QUIZ_PATTERNS.filter((p) => p.level === levelId);
}

function getPatternsWithSameBeats(beats, excludeKey) {
  return QUIZ_PATTERNS.filter(
    (p) => patternBeats(p.pattern) === beats && patternKey(p.pattern) !== excludeKey,
  );
}

function pickDistractors(correct, levelId) {
  const correctKey = patternKey(correct.pattern);
  const beats = patternBeats(correct.pattern);

  let pool = getPatternsForLevel(levelId).filter(
    (p) => patternKey(p.pattern) !== correctKey && patternBeats(p.pattern) === beats,
  );

  if (pool.length < 3) {
    pool = [
      ...pool,
      ...getPatternsWithSameBeats(beats, correctKey).filter(
        (p) => !pool.some((x) => patternKey(x.pattern) === patternKey(p.pattern)),
      ),
    ];
  }

  const seenNotation = new Set([patternToNotation(correct.pattern)]);
  const picked = [];

  for (const p of pool.sort(() => Math.random() - 0.5)) {
    if (picked.length >= 3) break;
    const notation = patternToNotation(p.pattern);
    if (seenNotation.has(notation)) continue;
    seenNotation.add(notation);
    picked.push(p);
  }

  return picked;
}

export function buildQuizQuestion(levelId, patternOverride = null) {
  const pool = getPatternsForLevel(levelId);
  const correct = patternOverride ?? pool[Math.floor(Math.random() * pool.length)];
  const correctKey = patternKey(correct.pattern);

  const distractors = pickDistractors(correct, levelId);

  while (distractors.length < 3) {
    const beats = patternBeats(correct.pattern);
    const extra = getPatternsWithSameBeats(beats, correctKey).find(
      (p) => !distractors.some((d) => patternKey(d.pattern) === patternKey(p.pattern))
        && patternToNotation(p.pattern) !== patternToNotation(correct.pattern),
    );
    if (extra) distractors.push(extra);
    else break;
  }

  const options = [correct, ...distractors]
    .map((p, i) => ({
      id: String.fromCharCode(65 + i),
      notation: patternToNotation(p.pattern),
      pattern: p.pattern,
      title: p.title,
    }))
    .sort(() => Math.random() - 0.5);

  const level = QUIZ_LEVELS.find((l) => l.id === levelId);

  const answerOption = options.find((o) => patternKey(o.pattern) === correctKey);
  if (!answerOption) {
    throw new Error(`퀴즈 정답 누락: ${correctKey}`);
  }

  return {
    levelId,
    bpm: level.bpm,
    bars: patternBeats(correct.pattern) / 4,
    correctPattern: correct.pattern,
    correctNotation: patternToNotation(correct.pattern),
    options,
    answerId: answerOption.id,
    hint: correct.title,
  };
}

export function buildQuizRound(levelId, count = QUIZ_ROUND_SIZE) {
  return Array.from({ length: count }, () => buildQuizQuestion(levelId));
}
