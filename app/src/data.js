export const JUMP_STEPS = [
  { id: 1, en: 'Forward Jump Step', ko: '앞으로 점프 스텝' },
  { id: 2, en: 'Backward Jump Step', ko: '뒤로 점프 스텝' },
  { id: 3, en: 'Side Jump Step', ko: '옆으로 점프 스텝' },
  { id: 4, en: 'Side Sit Jump Step', ko: '옆 앉아 점프 스텝' },
  { id: 5, en: 'One Leg Two Jump Step', ko: '한 발 두 번 점프 스텝' },
  { id: 6, en: 'Cross Jump Step', ko: '크로스 점프 스텝' },
  { id: 7, en: 'Split Jump Step', ko: '스플릿 점프 스텝' },
  { id: 8, en: 'Turn 360 Jump Step', ko: '360도 회전 점프 스텝' },
  { id: 9, en: 'Side to Side Jump Step', ko: '좌우 왕복 점프 스텝' },
  { id: 10, en: 'Heel Touch Jump Step', ko: '뒤꿈치 터치 점프 스텝' },
];

export const STAR_MOVES = [
  { id: 1, name: 'STAR MOVE 1', weeks: '5~12주차' },
  { id: 2, name: 'STAR MOVE 2', weeks: '5~12주차' },
  { id: 3, name: 'STAR MOVE 3', weeks: '5~12주차' },
];

export const PHASES = [
  { id: 1, name: 'Ⅰ', weeks: [1, 2], content: '기본스텝 10가지 익히기', bpm: 100, hrr: '40~60', pattern: '10/10' },
  { id: 2, name: 'Ⅱ', weeks: [3, 4], content: '기본스텝 10가지 익히기', bpm: 120, hrr: '50~80', pattern: '10/13' },
  { id: 3, name: 'Ⅲ', weeks: [5, 6, 7, 8], content: '기본스텝 + STAR MOVE 응용', bpm: 120, hrr: '50~80', pattern: '10/15' },
  { id: 4, name: 'Ⅳ', weeks: [9, 10, 11, 12], content: '기본스텝 + STAR MOVE 창작', bpm: 120, hrr: '50~80', pattern: '15/15' },
];

export const SESSION_PHASES = [
  { key: 'warmup', label: '준비운동', durationSec: 5 * 60, description: '체조' },
  { key: 'main', label: '본운동', durationSec: 35 * 60, description: '리듬점프 + STAR MOVE' },
  { key: 'cooldown', label: '정리운동', durationSec: 5 * 60, description: '스트레칭' },
];

export function getPhaseForWeek(week) {
  return PHASES.find((p) => p.weeks.includes(week)) ?? PHASES[0];
}

export function weekHasStarMove(week) {
  return week >= 5;
}

export const STORAGE_KEY = 'rsg-training-history';
export const WEEK_KEY = 'rsg-current-week';
