import {
  LEVELS,
  CURRICULUM,
  JUDGE,
  DEMO_CLASSMATES,
  GIRYONG_MOOD_IMAGES,
  randomLine,
} from './data.js';
import {
  ensureNickname,
  saveProfile,
  checkIn,
  canCheckInToday,
  addPlayResult,
  getLeaderboard,
  profileSummary,
} from './storage.js';
import { RhythmGame } from './game.js';

let profile = null;
let game = null;
let selectedLevel = LEVELS[1];

function $(id) {
  return document.getElementById(id);
}

function sayGiryong(key, custom) {
  $('giryongSpeech').textContent = custom ?? randomLine(key);
  $('giryongChar').classList.add('bounce');
  setTimeout(() => $('giryongChar').classList.remove('bounce'), 400);
}

function setGiryongMood(mood) {
  $('giryongChar').dataset.mood = mood;
  const img = $('giryongImg');
  if (img) {
    img.src = GIRYONG_MOOD_IMAGES[mood] ?? GIRYONG_MOOD_IMAGES.normal;
  }
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`panel-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'rank') renderRank();
    });
  });
}

function renderHeader() {
  const s = profileSummary(profile);
  $('headerStats').innerHTML = `
    <span class="chip">Lv.${s.level}</span>
    <span class="chip coin">${s.coins} 🪙</span>
    <span class="chip">${s.nickname || '게스트'}</span>
  `;
}

function renderProfile() {
  const s = profileSummary(profile);
  const pct = Math.round((s.progress / s.need) * 100);
  $('profileBar').innerHTML = `
    <div class="profile-name">${s.nickname}</div>
    <div class="xp-bar"><div class="xp-fill" style="width:${pct}%"></div></div>
    <div class="profile-meta">Lv.${s.level} · ${s.progress}/${s.need} XP · 최고점 ${s.bestScore.toLocaleString()}</div>
  `;
  $('streakNum').textContent = s.streak;
  renderHeader();
  renderMissions();
  renderMyRank();
}

function renderMissions() {
  const checked = !canCheckInToday(profile);
  const played = profile.totalPlays > 0;
  $('dailyMissions').innerHTML = `
    <div class="mission ${checked ? 'done' : ''}">
      <span>${checked ? '✓' : '○'}</span> 오늘 출석 체크 ${checked ? '(완료)' : ''}
    </div>
    <div class="mission">
      <span>○</span> 아케이드 모드 1회 플레이
    </div>
    <div class="mission">
      <span>○</span> COMBO 10 이상 달성
    </div>
    <div class="mission">
      <span>○</span> 랭킹 Top 10 진입 도전
    </div>
  `;
}

function initCheckIn() {
  const btn = $('checkInBtn');
  const updateBtn = () => {
    const can = canCheckInToday(profile);
    btn.disabled = !can;
    btn.textContent = can ? '출석 체크' : '출석 완료 ✓';
    btn.classList.toggle('done', !can);
  };
  updateBtn();

  btn.addEventListener('click', () => {
    const result = checkIn(profile);
    profile = result.profile;
    $('checkInMsg').textContent = result.message;
    if (result.reward) {
      sayGiryong(profile.streak >= 7 ? 'streak' : 'checkIn', result.message);
      setGiryongMood(profile.streak >= 7 ? 'streak' : 'happy');
      $('rewardChips').innerHTML = result.reward.bonuses
        .map((b) => `<span class="bonus-chip">${b}</span>`).join('');
    }
    renderProfile();
    updateBtn();
  });
}

function renderLevels() {
  $('levelSelect').innerHTML = LEVELS.map((lv) => `
    <button class="level-btn ${lv.id === selectedLevel.id ? 'active' : ''}" data-id="${lv.id}">
      <strong>${lv.name}</strong>
      <span>${lv.bpm} BPM · ${lv.noteCount}박</span>
    </button>
  `).join('');

  $('levelSelect').querySelectorAll('.level-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedLevel = LEVELS.find((l) => l.id === btn.dataset.id);
      renderLevels();
    });
  });
}

function flashJudge(key, pts) {
  const el = $('judgeFlash');
  const j = JUDGE[key];
  el.textContent = key === 'miss' ? 'MISS' : `${j.label} +${pts}`;
  el.className = `judge-flash show ${key}`;
  $('noteRing').classList.add('pulse');
  setTimeout(() => {
    el.classList.remove('show');
    $('noteRing').classList.remove('pulse');
  }, 350);
  if (key === 'perfect') {
    setGiryongMood('happy');
    sayGiryong('perfect');
  } else if (key === 'miss') {
    setGiryongMood('sad');
    sayGiryong('miss');
  }
}

function initGame() {
  const startBtn = $('gameStart');
  const tapBtn = $('gameTap');

  const resetUI = () => {
    $('gameScore').textContent = '0';
    $('gameCombo').textContent = '0';
    $('gameBeat').textContent = `0/${selectedLevel.noteCount}`;
    $('resultCard').style.display = 'none';
    $('arcadeCard').style.display = 'block';
    startBtn.disabled = false;
    tapBtn.disabled = true;
  };

  const doTap = () => {
    if (!game?.running) return;
    const key = game.judgeTap();
    if (key && key !== 'miss') {
      const j = JUDGE[key];
      const mult = 1 + Math.floor(game.combo / 10) * 0.5;
      flashJudge(key, Math.round(j.score * mult));
    } else if (key === 'miss') {
      flashJudge('miss', 0);
    }
    $('gameScore').textContent = game.score.toLocaleString();
    $('gameCombo').textContent = game.combo;
  };

  tapBtn.addEventListener('click', doTap);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && $('panel-play').classList.contains('active')) {
      e.preventDefault();
      doTap();
    }
  });

  startBtn.addEventListener('click', async () => {
    game?.stop();
    resetUI();
    startBtn.disabled = true;
    tapBtn.disabled = false;
    setGiryongMood('focus');

    game = new RhythmGame({
      bpm: selectedLevel.bpm,
      noteCount: selectedLevel.noteCount,
      onBeat: (i, total) => {
        $('gameBeat').textContent = `${i + 1}/${total}`;
        $('noteRing').classList.add('beat');
        setTimeout(() => $('noteRing').classList.remove('beat'), 80);
      },
      onJudge: (key, pts, combo) => {
        $('gameScore').textContent = game.score.toLocaleString();
        $('gameCombo').textContent = combo;
      },
      onEnd: (result) => {
        tapBtn.disabled = true;
        const xp = Math.round(result.xp * selectedLevel.xpMultiplier);
        const coins = result.coins;
        profile = addPlayResult(profile, { score: result.score, xpGained: xp, coinsGained: coins });

        $('arcadeCard').style.display = 'none';
        $('resultCard').style.display = 'block';
        $('resultBody').innerHTML = `
          <div class="result-score">${result.score.toLocaleString()}</div>
          <div class="result-grid">
            <span>PERFECT ${result.perfect}</span>
            <span>GREAT ${result.great}</span>
            <span>GOOD ${result.good}</span>
            <span>MISS ${result.miss}</span>
            <span>MAX COMBO ${result.maxCombo}</span>
            <span>+${xp} XP · +${coins} 🪙</span>
          </div>
        `;
        setGiryongMood(result.maxCombo >= 10 ? 'celebrate' : 'happy');
        sayGiryong(result.score > profile.bestScore ? 'perfect' : 'welcome', `점수 ${result.score.toLocaleString()}! ${result.maxCombo} COMBO!`);
        renderProfile();
        renderRank();
      },
    });

    await game.start();
  });

  $('playAgain').addEventListener('click', resetUI);
  resetUI();
}

function renderRank() {
  const board = getLeaderboard(profile, DEMO_CLASSMATES);
  $('rankList').innerHTML = board.map((row, i) => `
    <div class="rank-row ${row.isPlayer ? 'me' : ''} ${i < 3 ? `top-${i + 1}` : ''}">
      <span class="rank-num">${i + 1}</span>
      <span class="rank-name">${row.name}${row.isPlayer ? ' (나)' : ''}</span>
      <span class="rank-major">${row.major ?? '실용음악'}</span>
      <span class="rank-score">${row.score.toLocaleString()}</span>
    </div>
  `).join('') || '<div class="empty-msg">아직 랭킹 데이터가 없습니다. 플레이해 보세요!</div>';

  const myIdx = board.findIndex((r) => r.isPlayer);
  $('myRankStats').innerHTML = `
    <div class="stat-box"><div class="val">${myIdx >= 0 ? myIdx + 1 : '-'}</div><div class="lbl">내 순위</div></div>
    <div class="stat-box"><div class="val">${profile.bestScore.toLocaleString()}</div><div class="lbl">최고 점수</div></div>
    <div class="stat-box"><div class="val">${profile.totalPlays}</div><div class="lbl">총 플레이</div></div>
  `;
}

function renderMyRank() {
  if ($('panel-rank').classList.contains('active')) renderRank();
}

function renderCurriculum() {
  $('curriculumList').innerHTML = CURRICULUM.map((c) => `
    <div class="curriculum-item">
      <div class="curriculum-week">${c.week}</div>
      <div>
        <strong>${c.title}</strong>
        <p>${c.desc}</p>
        <span class="tag">${c.bpm} BPM</span>
      </div>
    </div>
  `).join('');

  $('judgeTable').innerHTML = Object.entries(JUDGE)
    .filter(([k]) => k !== 'miss')
    .map(([k, v]) => `
      <div class="judge-row">
        <span class="judge-badge ${k}">${v.label}</span>
        <span>±${v.windowMs}ms</span>
        <span>${v.score}점</span>
        <span>+${v.xp} XP</span>
      </div>
    `).join('');
}

function init() {
  profile = ensureNickname();
  if (!profile.nickname) {
    profile.nickname = '기룡친구';
    saveProfile(profile);
  }
  initTabs();
  renderProfile();
  initCheckIn();
  renderLevels();
  initGame();
  renderCurriculum();
  renderRank();
  sayGiryong('welcome');
}

init();
