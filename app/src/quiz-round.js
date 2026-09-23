import { buildListenQuestion, getPatternsForLevel, QUIZ_ROUND_SIZE } from './quiz-data.js';
import { buildFillQuestion } from './fill-quiz.js';
import { buildExtraQuestion } from './quiz-extra.js';
import { getUnit } from './rhythm-curriculum.js';

export const QUIZ_ROUND_TYPES = ['echo', 'echo', 'fill', 'meter', 'odd'];

export { QUIZ_ROUND_SIZE };

/** 단원별 유형 순서 — 같은 단원 패턴으로 집중 훈련 */
const UNIT_TYPE_ORDER = {
  'u1-even8': ['echo', 'odd', 'fill', 'echo', 'count'],
  'u2-8mix': ['echo', 'odd', 'fill', 'echo', 'count'],
  'u3-rests': ['echo', 'odd', 'fill', 'echo', 'meter'],
  'u4-sync': ['echo', 'odd', 'listen', 'echo', 'fill'],
  'u5-68': ['echo', 'meter', 'fill', 'echo', 'count'],
  'u6-2bar': ['echo', 'odd', 'listen', 'echo', 'count'],
  'u7-jazz': ['echo', 'odd', 'listen', 'echo', 'count'],
  'u8-sixteenth': ['echo', 'odd', 'listen', 'echo', 'count'],
};

export function buildQuestionByType(levelId, type, listenOverride = null, unitId = null) {
  if (type === 'listen') return buildListenQuestion(levelId, listenOverride, unitId);
  if (type === 'fill') {
    try {
      return buildFillQuestion(levelId, null, unitId);
    } catch {
      return buildListenQuestion(levelId, listenOverride, unitId);
    }
  }
  return buildExtraQuestion(type, levelId, unitId);
}

/** 단원 집중 라운드 (5문제) */
export function buildUnitQuizRound(unitId) {
  const unit = getUnit(unitId);
  if (!unit) throw new Error(`단원 없음: ${unitId}`);

  const types = UNIT_TYPE_ORDER[unitId] ?? QUIZ_ROUND_TYPES;
  const questions = [];

  for (let i = 0; i < QUIZ_ROUND_SIZE; i += 1) {
    const type = types[i % types.length];
    try {
      questions.push(buildQuestionByType(unit.level, type, null, unitId));
    } catch {
      questions.push(buildListenQuestion(unit.level, null, unitId));
    }
  }

  return { unit, questions };
}

/** 레벨 전체 랜덤 */
export function buildQuizRound(levelId, count = QUIZ_ROUND_SIZE) {
  const questions = [];
  const listenPool = [...getPatternsForLevel(levelId)].sort(() => Math.random() - 0.5);
  let listenIdx = 0;

  for (let i = 0; i < count; i += 1) {
    const type = QUIZ_ROUND_TYPES[i % QUIZ_ROUND_TYPES.length];
    if (type === 'listen') {
      const override = listenPool[listenIdx % listenPool.length];
      listenIdx += 1;
      questions.push(buildListenQuestion(levelId, override));
      continue;
    }
    try {
      questions.push(buildQuestionByType(levelId, type));
    } catch {
      const override = listenPool[listenIdx % listenPool.length];
      listenIdx += 1;
      questions.push(buildListenQuestion(levelId, override));
    }
  }

  return questions;
}
