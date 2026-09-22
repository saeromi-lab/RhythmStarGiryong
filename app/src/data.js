const giryongImg = (file) => `${import.meta.env.BASE_URL}images/giryong/${file}`;

export const GIRYONG_IMAGES = {
  hero: giryongImg('giryong-hero.png'),
  basic: giryongImg('giryong-basic.png'),
  main: giryongImg('giryong-main.png'),
  logo: giryongImg('giryong-logo.png'),
  dressed: giryongImg('giryong-dressed.png'),
  happy: giryongImg('emote-1.png'),
  cheer: giryongImg('emote-2.png'),
  sad: giryongImg('emote-3.png'),
  excited: giryongImg('emote-4.png'),
  celebrate: giryongImg('emote-5.png'),
  pearlCatching: giryongImg('pearl-catching.png'),
  pearlStamp: giryongImg('pearl-stamp.png'),
  withPearl: giryongImg('giryong-main.png'),
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
    '안녕! 나 기룡이야. 오늘 배울 것부터 같이 볼까?',
    '매일 핵심을 보고, 메트로놈으로 손이 따라오면 리듬감이 생겨!',
    '게임은 복습이야. 먼저 오늘 단원부터 익혀보자!',
  ],
  checkIn: [
    '출석 완료! 이제 오늘 배울 걸 보고 연습하자!',
    '도장 찍었어. 개념 보고 메트로놈으로 따라 치는 게 오늘의 핵심이야!',
    '꾸준함이 최고의 연습이야. 배우기 → 연습 → 확인 순서로 가보자!',
  ],
  perfect: ['완벽해! 프로 느낌 나는데?', '그 박자감, 무대에서도 통할 거야!'],
  miss: ['괜찮아, 다시 맞춰보자!', '리듬은 반복이 답이야. 한 번 더!'],
  streak: ['연속 출석 레전드! 기룡이도 감동했어.', '이 기세로 랭킹 정복 가자!'],
  quizCorrect: ['정답! 귀가 정확하네!', '그 리듬, 바로 잡았어!'],
  quizWrong: ['아쉽다! 다시 들어보면 알 수 있어.', '틀려도 괜찮아, 귀로 익히는 거야!'],
  quizDone: ['퀴즈 완료! 오늘도 리듬 감각 업!', '채보 감각이 점점 좋아지고 있어!'],
  placementStart: ['10문제만 풀면 네 레벨을 찾아줄게!', '집중해서 들어봐. 맞는 구간을 추천해 줄게!'],
  placementDone: ['레벨 확인 완료! 이제 맞춤 훈련 가보자!', '결과 나왔어! 추천 구간부터 시작해봐!'],
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

export function todayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function randomLine(key) {
  const lines = GIRYONG_LINES[key] ?? GIRYONG_LINES.welcome;
  return lines[Math.floor(Math.random() * lines.length)];
}
