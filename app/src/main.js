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
  savePlacementResult,
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
import {
  PLACEMENT_SIZE,
  PLACEMENT_REWARD,
  buildPlacementRound,
  evaluatePlacement,
} from './placement-test.js';
import { RhythmPlayer } from './rhythm-player.js';

const TIER_LABELS = {
  beginner: '입문',
  basic: '기초',
  intermediate: '심화',
};

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
  const placementChip = profile.placement
    ? `<span class="placement-chip">추천 ${profile.placement.quizLevelName}</span>`
    : '';
  $('profileBar').innerHTML = `
    <div class="profile-name">${s.nickname} ${placementChip}</div>
    <div class="xp-bar"><div class="xp-fill" style="width:${pct}%"></div></div>
    <div class="profile-meta">Lv.${s.level} · ${s.progress}/${s.need} XP · 최고점 ${s.bestScore.toLocaleString()}</div>
  `;
  $('streakNum').textContent = s.streak;
  renderHeader();
  renderMissions();
  renderPlacementHome();
  renderMyRank();
}

function renderPlacementHome() {
  const status = $('placementHomeStatus');
  const btn = $('placementHomeBtn');
  if (!status || !btn) return;

  if (profile.placement) {
    const date = new Date(profile.placement.testedAt).toLocaleDateString('ko-KR');
    status.innerHTML = `
      <div class="placement-result-chip">
        <strong>추천 훈련 구간</strong>
        <span>퀴즈 ${profile.placement.quizLevelName} · 아케이드 ${profile.placement.arcadeLevelName}</span>
        <span class="placement-meta">${profile.placement.totalCorrect}/${profile.placement.total} 정답 · 커리큘럼 ${profile.placement.curriculumWeek} · ${date}</span>
      </div>
    `;
    btn.textContent = '레벨 테스트 다시 하기';
  } else {
    status.innerHTML = '<p class="placement-empty">아직 테스트를 하지 않았어요. 10문제로 맞는 구간을 찾아보세요!</p>';
    btn.textContent = '레벨 테스트 시작';
  }
}

function goToPlacementTest() {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.querySelector('[data-tab="play"]').classList.add('active');
  $('panel-play').classList.add('active');
  setPlayMode('placement');
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

function applyRecommendedLevels(quizLevelId, arcadeLevelId) {
  const quiz = QUIZ_LEVELS.find((l) => l.id === quizLevelId);
  const arcade = LEVELS.find((l) => l.id === arcadeLevelId);
  if (quiz) selectedQuizLevel = quiz;
  if (arcade) selectedLevel = arcade;
  renderLevels();
}

function renderLevels() {
  if (playMode === 'placement') return;

  if (playMode === 'quiz') {
    $('levelLabel').textContent = '퀴즈 난이도';
    $('levelSelect').innerHTML = QUIZ_LEVELS.map((lv) => {
      const recommended = profile.placement?.quizLevelId === lv.id;
      return `
      <button class="level-btn ${lv.id === selectedQuizLevel.id ? 'active' : ''} ${recommended ? 'recommended' : ''}" data-id="${lv.id}">
        <strong>${lv.name}${recommended ? ' ★' : ''}</strong>
        <span>${lv.bpm} BPM · ${lv.barsLabel}</span>
      </button>
    `;
    }).join('');

    $('levelSelect').querySelectorAll('.level-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedQuizLevel = QUIZ_LEVELS.find((l) => l.id === btn.dataset.id);
        renderLevels();
      });
    });
    return;
  }

  $('levelLabel').textContent = '난이도 선택';
  $('levelSelect').innerHTML = LEVELS.map((lv) => {
    const recommended = profile.placement?.arcadeLevelId === lv.id;
    return `
    <button class="level-btn ${lv.id === selectedLevel.id ? 'active' : ''} ${recommended ? 'recommended' : ''}" data-id="${lv.id}">
      <strong>${lv.name}${recommended ? ' ★' : ''}</strong>
      <span>${lv.bpm} BPM · ${lv.noteCount}박</span>
    </button>
  `;
  }).join('');

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
  $('quizCard').style.display = mode === 'quiz' || mode === 'placement' ? 'block' : 'none';
  $('levelSelectCard').style.display = mode === 'placement' ? 'none' : 'block';
  $('resultCard').style.display = 'none';
  game?.stop();
  rhythmPlayer?.stop();
  if (mode === 'quiz' || mode === 'placement') resetQuizUI();
  renderLevels();
  updateQuizModeUI();
}

function updateQuizModeUI() {
  const isPlacement = playMode === 'placement';
  $('quizHudMidLbl').textContent = isPlacement ? '정답' : 'SCORE';
  $('quizHudRightLbl').textContent = isPlacement ? '구간' : '연속';
  $('quizStart').textContent = isPlacement ? `테스트 시작 (${PLACEMENT_SIZE}문제)` : '퀴즈 시작';
  $('quizHint').textContent = isPlacement
    ? '입문→기초→심화 순으로 10문제. 결과에 따라 맞는 훈련 구간을 추천해 드려요'
    : '1~2마디 리듬을 듣고, 4개의 채보 중 맞는 것을 고르세요';
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

  $('playAgain').addEventListener('click', handlePlayAgain);
  resetUI();
}

function isPlacementMode() {
  return playMode === 'placement';
}

function getRoundSize() {
  return isPlacementMode() ? PLACEMENT_SIZE : QUIZ_ROUND_SIZE;
}

function handlePlayAgain() {
  $('resultCard').style.display = 'none';
  $('resultTitle').textContent = '결과';
  $('resultActions').innerHTML = '<button id="playAgain" class="primary">다시 하기</button>';
  $('playAgain').addEventListener('click', handlePlayAgain);
  if (playMode === 'arcade') {
    $('arcadeCard').style.display = 'block';
    $('gameScore').textContent = '0';
    $('gameCombo').textContent = '0';
    $('gameBeat').textContent = `0/${selectedLevel.noteCount}`;
    $('gameStart').disabled = false;
    $('gameTap').disabled = true;
  } else {
    resetQuizUI();
  }
}

function resetQuizUI() {
  quizState = null;
  rhythmPlayer?.stop();
  $('quizCard').style.display = 'block';
  $('quizProgress').textContent = `0/${getRoundSize()}`;
  $('quizScore').textContent = '0';
  $('quizStreak').textContent = '-';
  $('quizTier').textContent = '';
  $('quizPrompt').textContent = isPlacementMode()
    ? '레벨 테스트 — 리듬을 듣고 맞는 채보를 고르세요'
    : '리듬을 듣고 맞는 채보를 고르세요';
  $('quizBpmInfo').textContent = '';
  $('quizOptions').innerHTML = '';
  $('quizFeedback').textContent = '';
  $('quizFeedback').className = 'quiz-feedback';
  $('quizStart').style.display = 'block';
  $('quizStart').disabled = false;
  $('quizNext').style.display = 'none';
  $('quizListen').disabled = true;
  $('quizListenLabel').textContent = '듣기';
  updateQuizModeUI();
}

function renderQuizQuestion() {
  const q = quizState.questions[quizState.index];
  const bars = q.bars >= 2 ? '2마디' : '1마디';
  $('quizProgress').textContent = `${quizState.index + 1}/${quizState.questions.length}`;

  if (isPlacementMode()) {
    $('quizScore').textContent = String(quizState.correct);
    $('quizStreak').textContent = TIER_LABELS[q.levelId] ?? q.levelId;
    $('quizTier').textContent = `${TIER_LABELS[q.levelId] ?? ''} 구간 · ${quizState.index + 1}번째`;
    $('quizPrompt').textContent = `${bars} 리듬 — 이 구간 실력을 확인해요`;
  } else {
    $('quizScore').textContent = quizState.score.toLocaleString();
    $('quizStreak').textContent = quizState.streak;
    $('quizTier').textContent = '';
    $('quizPrompt').textContent = `${bars} 리듬 — 맞는 채보를 고르세요`;
  }

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
    if (!isPlacementMode()) {
      quizState.streak += 1;
      const bonus = quizState.streak >= 2 ? QUIZ_SCORE.streakBonus * (quizState.streak - 1) : 0;
      const pts = QUIZ_SCORE.correct.points + bonus;
      quizState.score += pts;
      quizState.xp += QUIZ_SCORE.correct.xp;
      quizState.coins += QUIZ_SCORE.correct.coins;
      feedback.textContent = `정답! +${pts}점${bonus ? ` (연속 보너스 +${bonus})` : ''}`;
    } else {
      feedback.textContent = '정답!';
    }
    feedback.className = 'quiz-feedback ok';
    setGiryongMood('happy');
    sayGiryong('quizCorrect');
  } else {
    if (!isPlacementMode()) quizState.streak = 0;
    if (!isPlacementMode()) quizState.xp += QUIZ_SCORE.wrong.xp;
    feedback.textContent = `오답. 정답은 ${q.answerId} (${q.correctNotation})`;
    feedback.className = 'quiz-feedback ng';
    setGiryongMood('sad');
    sayGiryong('quizWrong');
  }

  if (isPlacementMode()) {
    quizState.answers.push({ levelId: q.levelId, correct });
    $('quizScore').textContent = String(quizState.correct);
  } else {
    $('quizScore').textContent = quizState.score.toLocaleString();
    $('quizStreak').textContent = quizState.streak;
  }
  $('quizNext').style.display = 'block';
  $('quizListen').disabled = false;
  $('quizListenLabel').textContent = '다시 듣기';
}

function finishQuiz() {
  if (isPlacementMode()) {
    finishPlacement();
    return;
  }

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
  $('resultTitle').textContent = '퀴즈 결과';
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

function finishPlacement() {
  const result = evaluatePlacement(quizState.answers);
  profile = savePlacementResult(profile, {
    ...result,
    xpGained: PLACEMENT_REWARD.xp,
    coinsGained: PLACEMENT_REWARD.coins,
  });
  applyRecommendedLevels(result.quizLevelId, result.arcadeLevelId);

  $('quizCard').style.display = 'none';
  $('resultCard').style.display = 'block';
  $('resultTitle').textContent = '레벨 테스트 결과';
  $('resultBody').innerHTML = `
    <div class="placement-result-title">${result.message}</div>
    <div class="placement-result-main">
      <div class="placement-level-box">
        <span class="lbl">추천 퀴즈</span>
        <strong>${result.quizLevelName}</strong>
      </div>
      <div class="placement-level-box">
        <span class="lbl">추천 아케이드</span>
        <strong>${result.arcadeLevelName}</strong>
      </div>
    </div>
    <p class="placement-detail">${result.detail}</p>
    <div class="placement-tier-grid">
      ${result.tierStats.map((t) => `
        <div class="placement-tier-item">
          <span>${t.label}</span>
          <strong>${t.correct}/${t.total}</strong>
        </div>
      `).join('')}
    </div>
    <div class="result-grid">
      <span>총 정답 ${result.totalCorrect}/${result.total}</span>
      <span>정답률 ${Math.round(result.accuracy * 100)}%</span>
      <span>커리큘럼 ${result.curriculumWeek}</span>
      <span>+${PLACEMENT_REWARD.xp} XP · +${PLACEMENT_REWARD.coins} 🪙</span>
    </div>
  `;
  $('resultActions').innerHTML = `
    <button id="startTrainingBtn" class="primary">이 레벨로 훈련 시작</button>
    <button id="playAgain" class="secondary-btn">다시 테스트</button>
  `;
  $('startTrainingBtn').addEventListener('click', () => {
    $('resultCard').style.display = 'none';
    setPlayMode('quiz');
    sayGiryong('welcome', `${result.quizLevelName} 구간부터 시작해보자!`);
  });
  $('playAgain').addEventListener('click', handlePlayAgain);

  setGiryongMood(result.accuracy >= 0.7 ? 'celebrate' : 'happy');
  sayGiryong('placementDone', `추천 구간: ${result.quizLevelName}!`);
  renderProfile();
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
    const placement = isPlacementMode();
    quizState = {
      questions: placement ? buildPlacementRound() : buildQuizRound(selectedQuizLevel.id),
      index: 0,
      score: 0,
      streak: 0,
      correct: 0,
      xp: 0,
      coins: 0,
      answers: [],
      answered: false,
    };
    startBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    setGiryongMood('focus');
    sayGiryong(placement ? 'placementStart' : 'welcome');
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

function initPlacementHome() {
  $('placementHomeBtn')?.addEventListener('click', goToPlacementTest);
}

function init() {
  profile = ensureNickname();
  if (!profile.nickname) {
    profile.nickname = '기룡친구';
    saveProfile(profile);
  }
  if (profile.placement) {
    applyRecommendedLevels(profile.placement.quizLevelId, profile.placement.arcadeLevelId);
  }
  initTabs();
  renderProfile();
  initCheckIn();
  initPlacementHome();
  renderLevels();
  initModeSwitch();
  initGame();
  initQuiz();
  renderCurriculum();
  renderRank();
  sayGiryong(profile.placement ? 'welcome' : 'placementStart', profile.placement ? undefined : '처음이면 레벨 테스트부터 해볼까?');
}

init();
