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
  { level: 'beginner', pattern: [1, 0.5, 0.5, 1], title: '점8분 리듬' },
  { level: 'beginner', pattern: [0.5, 0.5, 1, 1], title: '앞 8분 2개' },
  { level: 'beginner', pattern: [1, 1, 0.5, 0.5], title: '뒤 8분 2개' },
  { level: 'beginner', pattern: [2, 2], title: '2분음표 2개' },

  // 기초 — 1마디 싱코페이션
  { level: 'basic', pattern: [0.5, 1, 0.5, 1], title: '싱코페이션 A' },
  { level: 'basic', pattern: [1, 0.5, 1, 0.5], title: '싱코페이션 B' },
  { level: 'basic', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1], title: '앞 8분 4개' },
  { level: 'basic', pattern: [1, 0.5, 0.5, 0.5, 0.5], title: '뒤 8분 4개' },
  { level: 'basic', pattern: [1, 1, 0.5, 0.5, 1], title: '5박 패턴' },

  // 기초 — 2마디
  { level: 'basic', pattern: [1, 1, 1, 1, 1, 0.5, 0.5, 1], title: '2마디 기본' },
  { level: 'basic', pattern: [0.5, 0.5, 1, 1, 1, 1, 1, 1], title: '2마디 8분 시작' },

  // 심화 — 2마디
  { level: 'intermediate', pattern: [1, 0.5, 0.5, 1, 0.5, 0.5, 1, 1], title: '2마디 싱코페이션' },
  { level: 'intermediate', pattern: [0.5, 1, 0.5, 1, 1, 0.5, 0.5, 1], title: '2마디 혼합 A' },
  { level: 'intermediate', pattern: [1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1], title: '2마디 혼합 B' },
  { level: 'intermediate', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 0.5, 0.5], title: '9박 그루브' },
  { level: 'intermediate', pattern: [1, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 1, 0.5], title: '팝 그루브' },
];

export const QUIZ_ROUND_SIZE = 5;

export const QUIZ_SCORE = {
  correct: { points: 200, xp: 25, coins: 5 },
  wrong: { points: 0, xp: 3, coins: 0 },
  streakBonus: 50,
};

export function getPatternsForLevel(levelId) {
  return QUIZ_PATTERNS.filter((p) => p.level === levelId);
}

export function buildQuizQuestion(levelId, patternOverride = null) {
  const pool = getPatternsForLevel(levelId);
  const correct = patternOverride ?? pool[Math.floor(Math.random() * pool.length)];
  const correctKey = patternKey(correct.pattern);

  const distractors = pool
    .filter((p) => patternKey(p.pattern) !== correctKey)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  while (distractors.length < 3) {
    const extra = QUIZ_PATTERNS.find((p) => patternKey(p.pattern) !== correctKey
      && !distractors.some((d) => patternKey(d.pattern) === patternKey(p.pattern)));
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

  const answerId = options.find((o) => patternKey(o.pattern) === correctKey).id;
  const level = QUIZ_LEVELS.find((l) => l.id === levelId);

  return {
    levelId,
    bpm: level.bpm,
    bars: correct.pattern.reduce((s, d) => s + d, 0) / 4,
    correctPattern: correct.pattern,
    correctNotation: patternToNotation(correct.pattern),
    options,
    answerId,
    hint: correct.title,
  };
}

export function buildQuizRound(levelId, count = QUIZ_ROUND_SIZE) {
  return Array.from({ length: count }, () => buildQuizQuestion(levelId));
}
