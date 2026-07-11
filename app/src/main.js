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
  addQuizResult,
  resetDailyIfNeeded,
  getLeaderboard,
  profileSummary,
} from './storage.js';
import { RhythmGame } from './game.js';
import {
  QUIZ_LEVELS,
  QUIZ_ROUND_SIZE,
  QUIZ_SCORE,
  buildQuizRound,
} from './quiz-data.js';
import { RhythmPlayer } from './rhythm-player.js';

let profile = null;
let game = null;
let rhythmPlayer = null;
let selectedLevel = LEVELS[1];
let selectedQuizLevel = QUIZ_LEVELS[0];
let playMode = 'arcade';
let quizState = null;

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
  profile = resetDailyIfNeeded(profile);
  const checked = !canCheckInToday(profile);
  $('dailyMissions').innerHTML = `
    <div class="mission ${checked ? 'done' : ''}">
      <span>${checked ? '✓' : '○'}</span> 오늘 출석 체크 ${checked ? '(완료)' : ''}
    </div>
    <div class="mission ${profile.dailyQuiz ? 'done' : ''}">
      <span>${profile.dailyQuiz ? '✓' : '○'}</span> 리듬 퀴즈 1회 완료
    </div>
    <div class="mission ${profile.dailyArcade ? 'done' : ''}">
      <span>${profile.dailyArcade ? '✓' : '○'}</span> 아케이드 모드 1회 플레이
    </div>
    <div class="mission ${profile.dailyCombo10 ? 'done' : ''}">
      <span>${profile.dailyCombo10 ? '✓' : '○'}</span> COMBO 10 이상 달성
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
  if (playMode === 'quiz') {
    $('levelLabel').textContent = '퀴즈 난이도';
    $('levelSelect').innerHTML = QUIZ_LEVELS.map((lv) => `
      <button class="level-btn ${lv.id === selectedQuizLevel.id ? 'active' : ''}" data-id="${lv.id}">
        <strong>${lv.name}</strong>
        <span>${lv.bpm} BPM · ${lv.barsLabel}</span>
      </button>
    `).join('');

    $('levelSelect').querySelectorAll('.level-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedQuizLevel = QUIZ_LEVELS.find((l) => l.id === btn.dataset.id);
        renderLevels();
      });
    });
    return;
  }

  $('levelLabel').textContent = '난이도 선택';
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

function setPlayMode(mode) {
  playMode = mode;
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  $('arcadeCard').style.display = mode === 'arcade' ? 'block' : 'none';
  $('quizCard').style.display = mode === 'quiz' ? 'block' : 'none';
  $('resultCard').style.display = 'none';
  game?.stop();
  rhythmPlayer?.stop();
  if (mode === 'quiz') resetQuizUI();
  renderLevels();
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
        profile = addPlayResult(profile, {
          score: result.score,
          xpGained: xp,
          coinsGained: coins,
          maxCombo: result.maxCombo,
        });

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

  $('playAgain').addEventListener('click', () => {
    $('resultCard').style.display = 'none';
    if (playMode === 'arcade') {
      resetUI();
    } else {
      resetQuizUI();
    }
  });
  resetUI();
}

function resetQuizUI() {
  quizState = null;
  rhythmPlayer?.stop();
  $('quizCard').style.display = 'block';
  $('quizProgress').textContent = `0/${QUIZ_ROUND_SIZE}`;
  $('quizScore').textContent = '0';
  $('quizStreak').textContent = '0';
  $('quizPrompt').textContent = '리듬을 듣고 맞는 채보를 고르세요';
  $('quizBpmInfo').textContent = '';
  $('quizOptions').innerHTML = '';
  $('quizFeedback').textContent = '';
  $('quizFeedback').className = 'quiz-feedback';
  $('quizStart').style.display = 'block';
  $('quizStart').disabled = false;
  $('quizNext').style.display = 'none';
  $('quizListen').disabled = true;
  $('quizListenLabel').textContent = '듣기';
}

function renderQuizQuestion() {
  const q = quizState.questions[quizState.index];
  const bars = q.bars >= 2 ? '2마디' : '1마디';
  $('quizProgress').textContent = `${quizState.index + 1}/${quizState.questions.length}`;
  $('quizScore').textContent = quizState.score.toLocaleString();
  $('quizStreak').textContent = quizState.streak;
  $('quizPrompt').textContent = `${bars} 리듬 — 맞는 채보를 고르세요`;
  $('quizBpmInfo').textContent = `${q.bpm} BPM`;
  $('quizFeedback').textContent = '';
  $('quizFeedback').className = 'quiz-feedback';
  $('quizOptions').innerHTML = q.options.map((opt) => `
    <button class="quiz-option" data-id="${opt.id}" type="button">
      <span class="opt-id">${opt.id}</span>
      <span class="opt-notation">${opt.notation}</span>
    </button>
  `).join('');

  $('quizOptions').querySelectorAll('.quiz-option').forEach((btn) => {
    btn.addEventListener('click', () => answerQuiz(btn.dataset.id));
  });

  $('quizListen').disabled = false;
  $('quizListenLabel').textContent = '듣기';
}

async function playCurrentQuestion() {
  const q = quizState.questions[quizState.index];
  $('quizListen').disabled = true;
  $('quizListenLabel').textContent = '재생 중…';
  if (!rhythmPlayer) rhythmPlayer = new RhythmPlayer();
  await rhythmPlayer.playPattern(q.correctPattern, q.bpm);
  if (quizState?.index != null && quizState.questions[quizState.index] === q) {
    $('quizListen').disabled = quizState.answered;
    $('quizListenLabel').textContent = '다시 듣기';
  }
}

function answerQuiz(choiceId) {
  if (!quizState || quizState.answered) return;
  quizState.answered = true;

  const q = quizState.questions[quizState.index];
  const correct = choiceId === q.answerId;
  const feedback = $('quizFeedback');

  $('quizOptions').querySelectorAll('.quiz-option').forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.id === q.answerId) btn.classList.add('correct');
    else if (btn.dataset.id === choiceId) btn.classList.add('wrong');
  });

  if (correct) {
    quizState.correct += 1;
    quizState.streak += 1;
    const bonus = quizState.streak >= 2 ? QUIZ_SCORE.streakBonus * (quizState.streak - 1) : 0;
    const pts = QUIZ_SCORE.correct.points + bonus;
    quizState.score += pts;
    quizState.xp += QUIZ_SCORE.correct.xp;
    quizState.coins += QUIZ_SCORE.correct.coins;
    feedback.textContent = `정답! +${pts}점${bonus ? ` (연속 보너스 +${bonus})` : ''}`;
    feedback.className = 'quiz-feedback ok';
    setGiryongMood('happy');
    sayGiryong('quizCorrect');
  } else {
    quizState.streak = 0;
    quizState.xp += QUIZ_SCORE.wrong.xp;
    feedback.textContent = `오답. 정답은 ${q.answerId} (${q.correctNotation})`;
    feedback.className = 'quiz-feedback ng';
    setGiryongMood('sad');
    sayGiryong('quizWrong');
  }

  $('quizScore').textContent = quizState.score.toLocaleString();
  $('quizStreak').textContent = quizState.streak;
  $('quizNext').style.display = 'block';
  $('quizListen').disabled = false;
  $('quizListenLabel').textContent = '다시 듣기';
}

function finishQuiz() {
  const { score, correct, questions, xp, coins } = quizState;
  profile = addQuizResult(profile, {
    score,
    xpGained: xp,
    coinsGained: coins,
    correct,
    total: questions.length,
  });

  $('quizCard').style.display = 'none';
  $('resultCard').style.display = 'block';
  $('resultBody').innerHTML = `
    <div class="result-score">${score.toLocaleString()}</div>
    <div class="result-grid">
      <span>정답 ${correct}/${questions.length}</span>
      <span>정답률 ${Math.round((correct / questions.length) * 100)}%</span>
      <span>난이도 ${selectedQuizLevel.name}</span>
      <span>+${xp} XP · +${coins} 🪙</span>
    </div>
  `;
  setGiryongMood(correct >= 4 ? 'celebrate' : 'happy');
  sayGiryong('quizDone', `${correct}/${questions.length} 정답! 점수 ${score.toLocaleString()}`);
  renderProfile();
  renderRank();
  quizState = null;
}

function initQuiz() {
  const startBtn = $('quizStart');
  const nextBtn = $('quizNext');
  const listenBtn = $('quizListen');

  listenBtn.addEventListener('click', () => {
    if (!quizState || quizState.index >= quizState.questions.length) return;
    playCurrentQuestion();
  });

  startBtn.addEventListener('click', async () => {
    rhythmPlayer?.stop();
    quizState = {
      questions: buildQuizRound(selectedQuizLevel.id),
      index: 0,
      score: 0,
      streak: 0,
      correct: 0,
      xp: 0,
      coins: 0,
      answered: false,
    };
    startBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    setGiryongMood('focus');
    renderQuizQuestion();
    await playCurrentQuestion();
  });

  nextBtn.addEventListener('click', async () => {
    quizState.index += 1;
    if (quizState.index >= quizState.questions.length) {
      finishQuiz();
      return;
    }
    quizState.answered = false;
    nextBtn.style.display = 'none';
    renderQuizQuestion();
    await playCurrentQuestion();
  });

  resetQuizUI();
}

function initModeSwitch() {
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setPlayMode(btn.dataset.mode));
  });
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
  initModeSwitch();
  initGame();
  initQuiz();
  renderCurriculum();
  renderRank();
  sayGiryong('welcome');
}

init();
