import {
  QUIZ_LEVELS,
  buildListenQuestion,
  getPatternsForLevel,
} from './quiz-data.js';
import { buildFillQuestion, getFillPatternsForLevel } from './fill-quiz.js';
import { LEVELS } from './data.js';

/** 입문 3 + 기초 3 + 심화 4 = 10문제 (청음 + 빈칸 혼합) */
export const PLACEMENT_SIZE = 10;

const PLACEMENT_TIERS = [
  { levelId: 'beginner', count: 3, label: '입문' },
  { levelId: 'basic', count: 3, label: '기초' },
  { levelId: 'intermediate', count: 4, label: '심화' },
];

export const PLACEMENT_REWARD = { xp: 60, coins: 15 };

export function buildPlacementRound() {
  const questions = [];

  PLACEMENT_TIERS.forEach(({ levelId, count }) => {
    const listenPool = [...getPatternsForLevel(levelId)].sort(() => Math.random() - 0.5);
    const fillPool = [...getFillPatternsForLevel(levelId)].sort(() => Math.random() - 0.5);
    let listenIdx = 0;
    let fillIdx = 0;

    for (let i = 0; i < count; i += 1) {
      const useFill = i % 2 === 1 && fillPool.length > 0;
      if (useFill) {
        try {
          questions.push(buildFillQuestion(levelId, fillPool[fillIdx % fillPool.length]));
          fillIdx += 1;
          continue;
        } catch {
          // listen으로 대체
        }
      }
      questions.push(buildListenQuestion(levelId, listenPool[listenIdx % listenPool.length]));
      listenIdx += 1;
    }
  });

  return questions;
}

export function evaluatePlacement(answers) {
  const tierStats = PLACEMENT_TIERS.map(({ levelId, label, count }) => {
    const items = answers.filter((a) => a.levelId === levelId);
    const correct = items.filter((a) => a.correct).length;
    return {
      levelId,
      label,
      correct,
      total: count,
      rate: correct / count,
    };
  });

  const totalCorrect = answers.filter((a) => a.correct).length;
  const accuracy = totalCorrect / answers.length;
  const beginner = tierStats.find((t) => t.levelId === 'beginner');
  const basic = tierStats.find((t) => t.levelId === 'basic');
  const intermediate = tierStats.find((t) => t.levelId === 'intermediate');

  let quizLevelId = 'beginner';
  let message = '기본 박자부터 차근차근 익혀보세요!';
  let detail = '4분·8분음표 리듬 감각을 다지는 입문 구간을 추천해요.';

  if (intermediate.rate >= 0.75 && basic.rate >= 0.67) {
    quizLevelId = 'intermediate';
    message = '심화 패턴까지 잘 들어내요!';
    detail = '2마디 그루브·싱코페이션 훈련 구간에서 실력을 키워보세요.';
  } else if (basic.rate >= 0.5 && beginner.rate >= 0.5) {
    quizLevelId = 'basic';
    message = '기초 리듬 감각이 있어요!';
    detail = '싱코페이션과 2마디 패턴 연습이 딱 맞을 거예요.';
  } else if (beginner.rate >= 0.67) {
    quizLevelId = 'beginner';
    message = '기본기를 다지는 게 좋겠어요!';
    detail = '1마디 기본 패턴부터 천천히 익혀보세요.';
  }

  let arcadeLevelId = quizLevelId;
  if (intermediate.rate === 1 && totalCorrect >= 9) {
    arcadeLevelId = 'advanced';
    detail += ' 아케이드는 실전 난이도도 도전해 볼 만해요!';
  } else if (quizLevelId === 'intermediate') {
    arcadeLevelId = 'intermediate';
  }

  const quizLevel = QUIZ_LEVELS.find((l) => l.id === quizLevelId);
  const arcadeLevel = LEVELS.find((l) => l.id === arcadeLevelId);
  const curriculumWeek = quizLevelId === 'beginner'
    ? '1~2주'
    : quizLevelId === 'basic'
      ? '3~4주'
      : '5~8주';

  return {
    quizLevelId,
    arcadeLevelId,
    quizLevelName: quizLevel.name,
    arcadeLevelName: arcadeLevel.name,
    tierStats,
    totalCorrect,
    total: answers.length,
    accuracy,
    message,
    detail,
    curriculumWeek,
  };
}
