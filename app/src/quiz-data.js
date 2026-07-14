/** 리듬 패턴: 각 숫자 = 음표 길이(4분음표 1박 단위). 1=4분, 0.5=8분, 1.5=점4분, 2=2분 */

import { buildFillQuestion } from './fill-quiz.js';
import { renderPatternGridHtml, listenAnswerInOptions } from './rhythm-display.js';

export function noteSymbol(d) {
  if (d === 2) return '𝅗𝅥';
  if (d === 1.5) return '♩.';
  if (d === 1) return '♩';
  if (d === 0.5) return '♪';
  return '♩';
}

export function patternToNotation(pattern) {
  const beats = patternBeats(pattern);
  if (beats <= 4) {
    return pattern.map(noteSymbol).join(' ');
  }

  const parts = [];
  let bar = [];
  let barSum = 0;
  for (const d of pattern) {
    bar.push(noteSymbol(d));
    barSum += d;
    if (barSum >= 4 - 0.001) {
      parts.push(bar.join(' '));
      bar = [];
      barSum = 0;
    }
  }
  if (bar.length) parts.push(bar.join(' '));
  return parts.join(' │ ');
}

export function patternKey(pattern) {
  return pattern.join(',');
}

export const QUIZ_LEVELS = [
  { id: 'beginner', name: '입문', bpm: 88, barsLabel: '1마디' },
  { id: 'basic', name: '기초', bpm: 100, barsLabel: '1~2마디' },
  { id: 'intermediate', name: '심화', bpm: 112, barsLabel: '2마디' },
];

/** @type {{ level: string, pattern: number[], title: string }[]} */
export const QUIZ_PATTERNS = [
  // 입문 — 1마디 (4박)
  { level: 'beginner', pattern: [1, 1, 1, 1], title: '기본 4분음표' },
  { level: 'beginner', pattern: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], title: '8분음표 8개' },
  { level: 'beginner', pattern: [1.5, 1, 0.5, 1], title: '점4분 리듬' },
  { level: 'beginner', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1], title: '앞 8분 4개' },
  { level: 'beginner', pattern: [1, 1, 0.5, 0.5, 0.5, 0.5], title: '뒤 8분 4개' },
  { level: 'beginner', pattern: [2, 2], title: '2분음표 2개' },

  // 기초 — 1마디
  { level: 'basic', pattern: [0.5, 1, 0.5, 0.5, 0.5, 1], title: '싱코페이션 A' },
  { level: 'basic', pattern: [1, 0.5, 0.5, 1, 0.5, 0.5], title: '싱코페이션 B' },
  { level: 'basic', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1], title: '앞 8분 4개' },
  { level: 'basic', pattern: [1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], title: '4분 + 8분 6개' },
  { level: 'basic', pattern: [1, 1, 1, 1], title: '4분 4개' },
  { level: 'basic', pattern: [1.5, 0.5, 1, 1], title: '점4분·8분 혼합' },
  // 기초 — 2마디 (8박)
  { level: 'basic', pattern: [1, 1, 1, 1, 1, 1, 1, 1], title: '2마디 4분 8개' },
  { level: 'basic', pattern: [1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], title: '2마디 4분+8분' },
  { level: 'basic', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1], title: '2마디 8분 시작' },
  { level: 'basic', pattern: [1, 1, 0.5, 0.5, 1, 1, 0.5, 0.5, 1, 1], title: '2마디 교대 패턴' },

  // 심화 — 2마디 (8박)
  { level: 'intermediate', pattern: [1, 0.5, 0.5, 1, 0.5, 0.5, 1, 1, 1, 1], title: '2마디 싱코페이션' },
  { level: 'intermediate', pattern: [0.5, 1, 0.5, 1, 1, 0.5, 0.5, 1, 1, 1], title: '2마디 혼합 A' },
  { level: 'intermediate', pattern: [1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1], title: '2마디 혼합 B' },
  { level: 'intermediate', pattern: [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1], title: '2마디 8분 그루브' },
  { level: 'intermediate', pattern: [1, 1, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5], title: '2마디 후반 8분' },
  { level: 'intermediate', pattern: [0.5, 0.5, 1, 1, 0.5, 0.5, 1, 1, 1, 1], title: '2마디 팝 그루브' },
  { level: 'intermediate', pattern: [1, 0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.5, 1, 0.5, 0.5], title: '2마디 타이 밀도' },
  { level: 'intermediate', pattern: [2, 2, 2, 2], title: '2마디 2분음표' },
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

export function getMeterLabel(pattern) {
  const beats = patternBeats(pattern);
  if (beats === 4) return '4/4 · 1마디 (4박)';
  if (beats === 8) return '4/4 · 2마디 (8박)';
  return `4/4 · ${beats / 4}마디 (${beats}박)`;
}

export function getPatternsForLevel(levelId) {
  return QUIZ_PATTERNS.filter((p) => p.level === levelId && isValidListenPattern(p.pattern));
}

function isValidListenPattern(pattern) {
  const beats = patternBeats(pattern);
  return beats === 4 || beats === 8;
}

function getPatternsWithSameBeats(beats, excludeKey) {
  return QUIZ_PATTERNS.filter(
    (p) => isValidListenPattern(p.pattern)
      && patternBeats(p.pattern) === beats
      && patternKey(p.pattern) !== excludeKey,
  );
}

function pickListenDistractors(correct, levelId) {
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

  const seenKeys = new Set([correctKey]);
  const picked = [];

  for (const p of pool.sort(() => Math.random() - 0.5)) {
    if (picked.length >= 3) break;
    const key = patternKey(p.pattern);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    picked.push(p);
  }

  return picked;
}

export function buildListenQuestion(levelId, patternOverride = null) {
  const pool = getPatternsForLevel(levelId);
  if (!pool.length) {
    throw new Error(`청음 패턴 없음: ${levelId}`);
  }

  const correct = patternOverride ?? pool[Math.floor(Math.random() * pool.length)];
  const correctKey = patternKey(correct.pattern);
  const distractors = pickListenDistractors(correct, levelId);

  const beats = patternBeats(correct.pattern);
  const fallbackPool = getPatternsWithSameBeats(beats, correctKey);
  let fi = 0;
  while (distractors.length < 3 && fi < fallbackPool.length) {
    const extra = fallbackPool[fi];
    fi += 1;
    if (distractors.some((d) => patternKey(d.pattern) === patternKey(extra.pattern))) continue;
    distractors.push(extra);
  }

  if (distractors.length < 3) {
    throw new Error(`보기 부족 (${distractors.length + 1}개): ${correctKey}`);
  }

  const options = [correct, ...distractors.slice(0, 3)]
    .map((p, i) => ({
      id: String.fromCharCode(65 + i),
      notation: patternToNotation(p.pattern),
      pattern: [...p.pattern],
      title: p.title,
      gridHtml: renderPatternGridHtml(p.pattern, '4/4'),
    }))
    .sort(() => Math.random() - 0.5);

  const level = QUIZ_LEVELS.find((l) => l.id === levelId);
  const answerOption = options.find((o) => patternKey(o.pattern) === correctKey);
  if (!answerOption) {
    throw new Error(`퀴즈 정답 누락: ${correctKey}`);
  }

  const question = {
    type: 'listen',
    levelId,
    bpm: level.bpm,
    bars: beats / 4,
    meterLabel: getMeterLabel(correct.pattern),
    correctPattern: [...correct.pattern],
    correctNotation: patternToNotation(correct.pattern),
    options,
    answerId: answerOption.id,
    hint: correct.title,
  };

  if (!listenAnswerInOptions(question)) {
    throw new Error(`청음 정답 보기 불일치: ${correctKey}`);
  }

  return question;
}

export function buildQuizQuestion(levelId, patternOverride = null, questionType = null) {
  const type = questionType ?? (Math.random() < 0.5 ? 'listen' : 'fill');
  if (type === 'fill') {
    try {
      return buildFillQuestion(levelId);
    } catch {
      return buildListenQuestion(levelId, patternOverride);
    }
  }
  return buildListenQuestion(levelId, patternOverride);
}

// 개발 시 패턴 검증
for (const p of QUIZ_PATTERNS) {
  if (!isValidListenPattern(p.pattern)) {
    console.warn(`잘못된 청음 패턴 박자(${patternBeats(p.pattern)}): ${patternKey(p.pattern)}`);
  }
}
