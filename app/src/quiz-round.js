import { buildListenQuestion, getPatternsForLevel, QUIZ_ROUND_SIZE } from './quiz-data.js';
import { buildFillQuestion } from './fill-quiz.js';
import { buildExtraQuestion } from './quiz-extra.js';

export const QUIZ_ROUND_TYPES = ['listen', 'fill', 'meter', 'count', 'odd'];

export { QUIZ_ROUND_SIZE };

export function buildQuestionByType(levelId, type, listenOverride = null) {
  if (type === 'listen') return buildListenQuestion(levelId, listenOverride);
  if (type === 'fill') {
    try {
      return buildFillQuestion(levelId);
    } catch {
      return buildListenQuestion(levelId, listenOverride);
    }
  }
  return buildExtraQuestion(type, levelId);
}

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
