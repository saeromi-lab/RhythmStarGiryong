export const GIRYONG_IMAGES = {
  hero: '/images/giryong/giryong-hero.png',
  basic: '/images/giryong/giryong-basic.png',
  main: '/images/giryong/giryong-main.png',
  logo: '/images/giryong/giryong-logo.png',
  dressed: '/images/giryong/giryong-dressed.png',
  happy: '/images/giryong/emote-1.png',
  cheer: '/images/giryong/emote-2.png',
  sad: '/images/giryong/emote-3.png',
  excited: '/images/giryong/emote-4.png',
  celebrate: '/images/giryong/emote-5.png',
};

export const GIRYONG_MOOD_IMAGES = {
  normal: GIRYONG_IMAGES.hero,
  happy: GIRYONG_IMAGES.happy,
  sad: GIRYONG_IMAGES.sad,
  focus: GIRYONG_IMAGES.logo,
  streak: GIRYONG_IMAGES.dressed,
  excited: GIRYONG_IMAGES.excited,
  celebrate: GIRYONG_IMAGES.celebrate,
};

export const GIRYONG_SOURCE_URL = 'https://www.kyonggi.ac.kr/www/contents.do?key=9819';

export const APP_NAME = 'RhythmStarGiryong';
export const DEPT_NAME = '경기대학교 실용음악학과';

export const STORAGE_KEYS = {
  profile: 'rsg-profile',
  rankings: 'rsg-rankings',
  playHistory: 'rsg-plays',
};

export const LEVELS = [
  { id: 'beginner', name: '입문', bpm: 80, noteCount: 16, xpMultiplier: 1 },
  { id: 'basic', name: '기초', bpm: 100, noteCount: 20, xpMultiplier: 1.2 },
  { id: 'intermediate', name: '심화', bpm: 120, noteCount: 24, xpMultiplier: 1.5 },
  { id: 'advanced', name: '실전', bpm: 140, noteCount: 28, xpMultiplier: 2 },
];

export const CURRICULUM = [
  { week: '1~2주', title: '박자 감각 익히기', desc: '4/4박 기본 박, 메트로놈 따라 탭하기', bpm: 80 },
  { week: '3~4주', title: '싱코페이션 입문', desc: '온박·오프박 구분, 셋잇단박자 체험', bpm: 100 },
  { week: '5~8주', title: '장단·그루브', desc: '한국 장단·팝 그루브 패턴 연습', bpm: 120 },
  { week: '9~12주', title: '실전 앙상블', desc: '팀 대결 모드, 합주 타이밍 맞추기', bpm: 140 },
];

export const ATTENDANCE_REWARDS = {
  daily: { coins: 15, xp: 80 },
  streak7: { coins: 50, xp: 200, label: '7일 연속 출석!' },
  streak30: { coins: 200, xp: 1000, label: '30일 연속 출석!' },
};

export const JUDGE = {
  perfect: { label: 'PERFECT', score: 300, xp: 15, windowMs: 55 },
  great: { label: 'GREAT', score: 200, xp: 10, windowMs: 100 },
  good: { label: 'GOOD', score: 100, xp: 5, windowMs: 150 },
  miss: { label: 'MISS', score: 0, xp: 0, windowMs: Infinity },
};

export const GIRYONG_LINES = {
  welcome: [
    '안녕! 나 기룡이야. 오늘도 리듬 연습하러 왔어?',
    '실용음악학과 리듬 마스터는 바로 너야!',
    '매일 조금씩 하면 박자 감각이 확 달라져!',
  ],
  checkIn: [
    '출석 완료! 오늘의 리듬 에너지 충전됐어!',
    '연속 출석 중이네? 기룡이가 응원한다!',
    '꾸준함이 최고의 연습이야. 계속 가보자!',
  ],
  perfect: ['완벽해! 프로 느낌 나는데?', '그 박자감, 무대에서도 통할 거야!'],
  miss: ['괜찮아, 다시 맞춰보자!', '리듬은 반복이 답이야. 한 번 더!'],
  streak: ['연속 출석 레전드! 기룡이도 감동했어.', '이 기세로 랭킹 정복 가자!'],
};

export const DEMO_CLASSMATES = [
  { name: '김하늘', major: '보컬', score: 48200 },
  { name: '이준서', major: '작곡', score: 45100 },
  { name: '박서연', major: '프로듀싱', score: 42800 },
  { name: '최민재', major: '기타', score: 39500 },
  { name: '정유나', major: '드럼', score: 37200 },
];

export function xpForLevel(level) {
  return level * 500;
}

export function levelFromXp(xp) {
  let lvl = 1;
  let need = xpForLevel(lvl);
  let rest = xp;
  while (rest >= need && lvl < 99) {
    rest -= need;
    lvl += 1;
    need = xpForLevel(lvl);
  }
  return { level: lvl, progress: rest, need };
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function randomLine(key) {
  const lines = GIRYONG_LINES[key] ?? GIRYONG_LINES.welcome;
  return lines[Math.floor(Math.random() * lines.length)];
}
