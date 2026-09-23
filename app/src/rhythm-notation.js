/** 음표 표기·퀴즈 상수 */

export const QUIZ_LEVELS = [
  { id: 'beginner', name: '입문', bpm: 80, barsLabel: '1~2단원' },
  { id: 'basic', name: '기초', bpm: 88, barsLabel: '3~5단원' },
  { id: 'intermediate', name: '심화', bpm: 100, barsLabel: '6~8단원' },
];

export const QUIZ_ROUND_SIZE = 5;

export const QUIZ_SCORE = {
  correct: { points: 200, xp: 25, coins: 5 },
  wrong: { points: 0, xp: 3, coins: 0 },
  streakBonus: 50,
};

export function noteSymbol(d) {
  if (d === 2) return '𝅗𝅥';
  if (d === 1.5) return '♩.';
  if (d === 1) return '♩';
  if (d === 0.5) return '♪';
  if (d === 0.25) return '𝅘𝅥𝅯';
  return '♩';
}

export function patternToNotation(pattern) {
  const beats = pattern.reduce((s, d) => s + d, 0);
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

export function patternBeats(pattern) {
  return pattern.reduce((s, d) => s + d, 0);
}

export function patternKey(pattern) {
  return pattern.join(',');
}

export function isValidListenPattern(pattern) {
  const beats = patternBeats(pattern);
  return beats === 4 || beats === 8;
}
