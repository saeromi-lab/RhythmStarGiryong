import {
  STORAGE_KEYS,
  ATTENDANCE_REWARDS,
  todayKey,
  levelFromXp,
} from './data.js';

const defaultProfile = () => ({
  nickname: '',
  xp: 0,
  coins: 0,
  streak: 0,
  totalCheckIns: 0,
  lastCheckIn: null,
  bestScore: 0,
  totalPlays: 0,
  totalQuizzes: 0,
  dailyDate: null,
  dailyArcade: false,
  dailyQuiz: false,
  dailyCombo10: false,
  placement: null,
  badges: [],
  createdAt: new Date().toISOString(),
});

export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profile);
    return raw ? { ...defaultProfile(), ...JSON.parse(raw) } : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

export function ensureNickname() {
  const profile = loadProfile();
  if (profile.nickname) return profile;
  const name = prompt('닉네임을 입력해 주세요 (랭킹에 표시됩니다)', '기룡친구');
  if (name?.trim()) {
    profile.nickname = name.trim().slice(0, 12);
    saveProfile(profile);
  }
  return profile;
}

export function canCheckInToday(profile) {
  return profile.lastCheckIn !== todayKey();
}

export function checkIn(profile) {
  if (!canCheckInToday(profile)) {
    return { profile, reward: null, message: '오늘은 이미 출석했어요!' };
  }

  const today = todayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);

  const continued = profile.lastCheckIn === yKey;
  profile.streak = continued ? profile.streak + 1 : 1;
  profile.lastCheckIn = today;
  profile.totalCheckIns += 1;

  let coins = ATTENDANCE_REWARDS.daily.coins;
  let xp = ATTENDANCE_REWARDS.daily.xp;
  const bonuses = [];

  if (profile.streak === 7 || profile.streak % 7 === 0) {
    coins += ATTENDANCE_REWARDS.streak7.coins;
    xp += ATTENDANCE_REWARDS.streak7.xp;
    bonuses.push(ATTENDANCE_REWARDS.streak7.label);
  }
  if (profile.streak === 30) {
    coins += ATTENDANCE_REWARDS.streak30.coins;
    xp += ATTENDANCE_REWARDS.streak30.xp;
    bonuses.push(ATTENDANCE_REWARDS.streak30.label);
    if (!profile.badges.includes('streak30')) profile.badges.push('streak30');
  }

  profile.coins += coins;
  profile.xp += xp;
  saveProfile(profile);

  return {
    profile,
    reward: { coins, xp, bonuses },
    message: `+${coins} 코인 · +${xp} XP`,
  };
}

export function resetDailyIfNeeded(profile) {
  const today = todayKey();
  if (profile.dailyDate !== today) {
    profile.dailyDate = today;
    profile.dailyArcade = false;
    profile.dailyQuiz = false;
    profile.dailyCombo10 = false;
  }
  return profile;
}

export function addPlayResult(profile, { score, xpGained, coinsGained, maxCombo = 0 }) {
  profile = resetDailyIfNeeded(profile);
  profile.xp += xpGained;
  profile.coins += coinsGained;
  profile.totalPlays += 1;
  profile.dailyArcade = true;
  if (maxCombo >= 10) profile.dailyCombo10 = true;
  if (score > profile.bestScore) profile.bestScore = score;
  saveProfile(profile);
  saveWeeklyScore(profile.nickname, score);
  return profile;
}

export function savePlacementResult(profile, result) {
  profile.placement = {
    quizLevelId: result.quizLevelId,
    arcadeLevelId: result.arcadeLevelId,
    quizLevelName: result.quizLevelName,
    arcadeLevelName: result.arcadeLevelName,
    totalCorrect: result.totalCorrect,
    total: result.total,
    accuracy: result.accuracy,
    curriculumWeek: result.curriculumWeek,
    testedAt: new Date().toISOString(),
  };
  profile.xp += result.xpGained ?? 0;
  profile.coins += result.coinsGained ?? 0;
  saveProfile(profile);
  return profile;
}

export function addQuizResult(profile, { score, xpGained, coinsGained, correct, total }) {
  profile = resetDailyIfNeeded(profile);
  profile.xp += xpGained;
  profile.coins += coinsGained;
  profile.totalQuizzes += 1;
  profile.dailyQuiz = true;
  if (score > profile.bestScore) profile.bestScore = score;
  saveProfile(profile);
  saveWeeklyScore(profile.nickname, score);
  return profile;
}

function weekKey() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

export function loadRankings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.rankings) || '{}');
  } catch {
    return {};
  }
}

export function saveWeeklyScore(nickname, score) {
  if (!nickname) return;
  const key = weekKey();
  const all = loadRankings();
  const week = all[key] ?? [];
  const existing = week.find((e) => e.name === nickname);
  if (existing) {
    existing.score = Math.max(existing.score, score);
    existing.updatedAt = new Date().toISOString();
  } else {
    week.push({
      name: nickname,
      score,
      major: '실용음악',
      isPlayer: true,
      updatedAt: new Date().toISOString(),
    });
  }
  all[key] = week;
  localStorage.setItem(STORAGE_KEYS.rankings, JSON.stringify(all));
}

export function getLeaderboard(profile, demoClassmates) {
  const key = weekKey();
  const all = loadRankings();
  const week = all[key] ?? [];
  const merged = [...demoClassmates.map((d) => ({ ...d, isPlayer: false })), ...week];
  const map = new Map();
  merged.forEach((e) => {
    const prev = map.get(e.name);
    if (!prev || e.score > prev.score) map.set(e.name, e);
  });
  if (profile.nickname && profile.bestScore > 0) {
    const cur = map.get(profile.nickname) ?? { name: profile.nickname, major: '실용음악', isPlayer: true };
    cur.score = Math.max(cur.score ?? 0, profile.bestScore);
    cur.isPlayer = true;
    map.set(profile.nickname, cur);
  }
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, 20);
}

export function profileSummary(profile) {
  const { level, progress, need } = levelFromXp(profile.xp);
  return { ...profile, level, progress, need };
}
