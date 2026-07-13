import {
  LEVELS,
  CURRICULUM,
  JUDGE,
  DEMO_CLASSMATES,
  GIRYONG_MOOD_IMAGES,
  GIRYONG_IMAGES,
  randomLine,
} from './data.js';
import {
  ensureNickname,
  saveProfile,
  checkIn,
  canCheckInToday,
  getCurrentWeekDates,
  getWeekCheckIns,
  syncTodayStamp,
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
let lessonSelectedId = null;
let selectedPath = 'placement';

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
  renderStampBoard();
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
        <span class="placement-meta">${profile.placement.totalCorrect}/${profile.placement.total} 정답 · ${date}</span>
      </div>
    `;
    $('pathBubble').textContent = `${profile.placement.quizLevelName} 구간부터 이어서 훈련해요!`;
  } else {
    status.innerHTML = '';
  }
}

function startFromPathSelection() {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.querySelector('[data-tab="play"]')?.classList.add('active');
  $('panel-play')?.classList.add('active');

  if (selectedPath === 'basics') {
    applyRecommendedLevels('beginner', 'beginner');
    setPlayMode('quiz');
    startLesson('quiz');
    return;
  }
  setPlayMode('placement');
  startLesson('placement');
}

function initPlacementHome() {
  document.querySelectorAll('.duo-path-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPath = btn.dataset.path;
      document.querySelectorAll('.duo-path-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      $('pathBubble').textContent = selectedPath === 'placement'
        ? '10문제만 풀면 네 레벨을 찾아줄게!'
        : '입문 레슨부터 차근차근 가보자!';
    });
  });
  $('placementHomeBtn')?.addEventListener('click', startFromPathSelection);
}

function renderMissions() {
  profile = resetDailyIfNeeded(profile);
  const checked = !canCheckInToday(profile);
  const quests = [
    { done: checked, label: '진주조개 도장 찍기', reward: '15🪙' },
    { done: profile.dailyQuiz, label: '리듬 퀴즈 1회', reward: '25 XP' },
    { done: profile.dailyArcade, label: '아케이드 1회', reward: '20 XP' },
    { done: profile.dailyCombo10, label: 'COMBO 10+', reward: '보너스' },
  ];
  $('dailyMissions').innerHTML = quests.map((q) => `
    <div class="mission ${q.done ? 'done' : ''}">
      <span>${q.done ? '✓' : '○'}</span>
      <span class="quest-label">${q.label}</span>
      <span class="quest-reward">${q.reward}</span>
    </div>
  `).join('');
}

function renderStampBoard(animateToday = false) {
  const board = $('stampBoard');
  if (!board) return;

  const checkedDates = new Set(getWeekCheckIns(profile));
  const week = getCurrentWeekDates();

  board.innerHTML = week.map((day) => {
    const stamped = checkedDates.has(day.date);
    return `
      <div class="stamp-slot ${day.isToday ? 'today' : ''} ${stamped ? 'stamped' : ''} ${animateToday && day.isToday && stamped ? 'stamp-pop' : ''}" data-date="${day.date}">
        <span class="stamp-day">${day.label}</span>
        <div class="stamp-mark">
          ${stamped
            ? `<img src="${GIRYONG_IMAGES.pearlStamp}" alt="출석 도장" class="stamp-img">`
            : '<span class="stamp-empty">·</span>'}
        </div>
      </div>
    `;
  }).join('');
}

function initCheckIn() {
  const btn = $('checkInBtn');
  const updateBtn = () => {
    const can = canCheckInToday(profile);
    btn.disabled = !can;
    if (can) {
      btn.innerHTML = `<img src="${GIRYONG_IMAGES.pearlStamp}" alt="" class="btn-pearl-icon" aria-hidden="true">진주조개 도장 찍기`;
    } else {
      btn.textContent = '오늘 도장 완료 ✓';
    }
    btn.classList.toggle('done', !can);
    renderStampBoard();
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
      renderStampBoard(true);
      setTimeout(() => renderStampBoard(), 700);
    } else {
      renderStampBoard();
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
  if (mode === 'quiz' || mode === 'placement') {
    quizState = null;
    $('quizStart').style.display = 'block';
  }
  renderLevels();
  updateQuizModeUI();
}

function updateQuizModeUI() {
  const isPlacement = playMode === 'placement';
  const hint = $('quizHint');
  if (hint) {
    hint.textContent = isPlacement
      ? '듣기·마디 채우기 → 확인! 10문제 레벨 테스트'
      : '청음 + 마디 채우기 · 듣기 → 선택 → 확인!';
  }
  const startBtn = $('quizStart');
  if (startBtn) {
    startBtn.textContent = isPlacement ? '레벨 테스트 시작' : '리듬 퀴즈 시작';
  }
}

function openLessonOverlay() {
  $('lessonOverlay').hidden = false;
  document.body.classList.add('lesson-open');
}

function closeLessonOverlay() {
  $('lessonOverlay').hidden = true;
  $('lessonFeedback').hidden = true;
  document.body.classList.remove('lesson-open');
  rhythmPlayer?.stop();
}

function updateLessonProgress() {
  if (!quizState) return;
  const total = quizState.questions.length;
  const pct = (quizState.index / total) * 100;
  $('lessonProgressFill').style.width = `${pct}%`;
  const streakLbl = $('lessonStreakLbl');
  if (quizState.streak >= 2 && !isPlacementMode()) {
    streakLbl.textContent = `${quizState.streak}번 연속 정답`;
  } else {
    streakLbl.textContent = '';
  }
}

function renderLessonQuestion() {
  const q = quizState.questions[quizState.index];
  const isFill = q.type === 'fill';
  lessonSelectedId = null;
  quizState.answered = false;
  $('lessonCheckBtn').disabled = true;
  $('lessonFeedback').hidden = true;

  const measureEl = $('lessonMeasure');
  if (isFill) {
    $('lessonInstruction').textContent = '빈칸(□)에 들어갈 리듬을 고르세요';
    measureEl.hidden = false;
    measureEl.innerHTML = q.measureHtml;
    $('lessonAudioRow').hidden = false;
  } else {
    $('lessonInstruction').textContent = '들은 리듬과 같은 보기를 고르세요';
    measureEl.hidden = true;
    measureEl.innerHTML = '';
    $('lessonAudioRow').hidden = false;
  }

  const meterText = q.meterLabel ?? (q.bars >= 2 ? '4/4 · 2마디 (8박)' : '4/4 · 1마디 (4박)');
  const typeLabel = isFill ? '마디 채우기' : '청음';
  if (isPlacementMode()) {
    $('lessonSub').textContent = `${TIER_LABELS[q.levelId]} · ${typeLabel} · ${meterText} · ${quizState.index + 1}/${quizState.questions.length}`;
  } else {
    $('lessonSub').textContent = `${typeLabel} · ${meterText} · ${q.bpm} BPM · ${quizState.index + 1}/${quizState.questions.length}`;
  }

  $('lessonOptions').innerHTML = q.options.map((opt) => `
    <button type="button" class="duo-choice" data-id="${opt.id}">
      ${isFill ? `<span class="choice-prefix">□ →</span>` : ''}${opt.notation}
    </button>
  `).join('');

  $('lessonOptions').querySelectorAll('.duo-choice').forEach((btn) => {
    btn.addEventListener('click', () => selectLessonOption(btn.dataset.id));
  });

  $('lessonListen').disabled = false;
  $('lessonListenSlow').disabled = false;
  updateLessonProgress();
}

function selectLessonOption(choiceId) {
  if (!quizState || quizState.answered) return;
  lessonSelectedId = choiceId;
  $('lessonOptions').querySelectorAll('.duo-choice').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.id === choiceId);
  });
  $('lessonCheckBtn').disabled = false;
}

async function playLessonAudio(slow = false) {
  const q = quizState.questions[quizState.index];
  $('lessonListen').disabled = true;
  $('lessonListenSlow').disabled = true;
  if (!rhythmPlayer) rhythmPlayer = new RhythmPlayer();
  await rhythmPlayer.playPattern(q.correctPattern, q.bpm, { slow });
  if (quizState?.questions[quizState.index] === q && !quizState.answered) {
    $('lessonListen').disabled = false;
    $('lessonListenSlow').disabled = false;
  }
}

function submitLessonAnswer() {
  if (!quizState || quizState.answered || !lessonSelectedId) return;
  quizState.answered = true;

  const q = quizState.questions[quizState.index];
  const correct = lessonSelectedId === q.answerId;

  $('lessonOptions').querySelectorAll('.duo-choice').forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.id === q.answerId) btn.classList.add('correct');
    else if (btn.dataset.id === lessonSelectedId) btn.classList.add('wrong');
  });
  $('lessonCheckBtn').disabled = true;

  if (correct) {
    quizState.correct += 1;
    if (!isPlacementMode()) {
      quizState.streak += 1;
      const bonus = quizState.streak >= 2 ? QUIZ_SCORE.streakBonus * (quizState.streak - 1) : 0;
      quizState.score += QUIZ_SCORE.correct.points + bonus;
      quizState.xp += QUIZ_SCORE.correct.xp;
      quizState.coins += QUIZ_SCORE.correct.coins;
    }
    setGiryongMood('happy');
  } else {
    if (!isPlacementMode()) {
      quizState.streak = 0;
      quizState.xp += QUIZ_SCORE.wrong.xp;
    }
    setGiryongMood('sad');
  }

  if (isPlacementMode()) {
    quizState.answers.push({ levelId: q.levelId, correct });
  }

  $('lessonFeedback').hidden = false;
  $('lessonFeedback').className = `lesson-feedback ${correct ? 'ok' : 'ng'}`;
  $('lessonFeedbackTitle').textContent = correct ? '참 잘했어요!' : '정답이 아니에요';
  $('lessonFeedbackDetail').textContent = correct
    ? (isPlacementMode() ? '' : `+${QUIZ_SCORE.correct.points}점`)
    : `정답: ${q.answerId} · ${q.type === 'fill' ? q.options.find((o) => o.id === q.answerId)?.notation : q.correctNotation}`;
  updateLessonProgress();
}

async function continueLesson() {
  $('lessonFeedback').hidden = true;
  quizState.index += 1;
  $('lessonProgressFill').style.width = `${(quizState.index / quizState.questions.length) * 100}%`;

  if (quizState.index >= quizState.questions.length) {
    closeLessonOverlay();
    if (isPlacementMode()) finishPlacement();
    else finishQuiz();
    return;
  }

  renderLessonQuestion();
  await playLessonAudio();
}

async function startLesson(mode) {
  playMode = mode;
  rhythmPlayer?.stop();
  quizState = {
    questions: mode === 'placement'
      ? buildPlacementRound()
      : buildQuizRound(selectedQuizLevel.id),
    index: 0,
    score: 0,
    streak: 0,
    correct: 0,
    xp: 0,
    coins: 0,
    answers: [],
    answered: false,
  };
  setGiryongMood('focus');
  openLessonOverlay();
  renderLessonQuestion();
  await playLessonAudio();
}

function showLessonComplete(cardsHtml) {
  $('lessonCompleteCards').innerHTML = cardsHtml;
  $('lessonCompleteOverlay').hidden = false;
}

function hideLessonComplete() {
  $('lessonCompleteOverlay').hidden = true;
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
    closeLessonOverlay();
    $('quizCard').style.display = 'block';
    $('quizStart').style.display = 'block';
  }
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

  const accuracy = Math.round((correct / questions.length) * 100);
  showLessonComplete(`
    <div class="duo-stat-card xp">
      <div class="head">총 XP</div>
      <div class="body">⚡ ${xp}</div>
    </div>
    <div class="duo-stat-card acc">
      <div class="head">정답률</div>
      <div class="body">🎯 ${accuracy}%</div>
    </div>
  `);

  setGiryongMood(correct >= 4 ? 'celebrate' : 'happy');
  sayGiryong('quizDone', `${correct}/${questions.length} 정답!`);
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

  const accuracy = Math.round(result.accuracy * 100);
  showLessonComplete(`
    <div class="duo-stat-card xp">
      <div class="head">추천 구간</div>
      <div class="body" style="font-size:16px">${result.quizLevelName}</div>
    </div>
    <div class="duo-stat-card acc">
      <div class="head">정답률</div>
      <div class="body">🎯 ${accuracy}%</div>
    </div>
  `);

  setGiryongMood(result.accuracy >= 0.7 ? 'celebrate' : 'happy');
  sayGiryong('placementDone', `추천: ${result.quizLevelName}!`);
  renderProfile();
  renderPlacementHome();
  quizState = null;
}

function initLesson() {
  $('lessonClose').addEventListener('click', () => {
    if (confirm('레슨을 나가시겠어요?')) {
      closeLessonOverlay();
      quizState = null;
    }
  });

  $('lessonListen').addEventListener('click', () => playLessonAudio(false));
  $('lessonListenSlow').addEventListener('click', () => playLessonAudio(true));
  $('lessonCheckBtn').addEventListener('click', submitLessonAnswer);
  $('lessonContinueBtn').addEventListener('click', continueLesson);

  $('lessonCompleteBtn').addEventListener('click', () => {
    hideLessonComplete();
    if (profile.placement && playMode === 'placement') {
      setPlayMode('quiz');
    }
  });

  $('quizStart').addEventListener('click', () => {
    startLesson(playMode === 'placement' ? 'placement' : 'quiz');
  });
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
  profile = syncTodayStamp(profile);
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
  initLesson();
  renderCurriculum();
  renderRank();
  sayGiryong(profile.placement ? 'welcome' : 'placementStart', profile.placement ? undefined : '처음이면 레벨 테스트부터 해볼까?');
}

init();
