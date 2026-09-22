import {
  LEVELS,
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
  addTrainResult,
  addQuizResult,
  savePlacementResult,
  saveTrainClear,
  resetDailyIfNeeded,
  markDailyActivity,
  getLeaderboard,
  profileSummary,
} from './storage.js';
import { RhythmRunnerGame, RUNNER_LIVES } from './runner-game.js';
import {
  QUIZ_LEVELS,
  QUIZ_ROUND_SIZE,
  QUIZ_SCORE,
} from './quiz-data.js';
import { buildQuizRound, buildUnitQuizRound } from './quiz-round.js';
import { CURRICULUM_UNITS, unitsForLevel, getUnit, patternsForUnit } from './rhythm-curriculum.js';
import { QUIZ_TYPE_LABELS } from './quiz-extra.js';
import {
  PLACEMENT_SIZE,
  PLACEMENT_REWARD,
  buildPlacementRound,
  evaluatePlacement,
} from './placement-test.js';
import { RhythmPlayer } from './rhythm-player.js';
import { MetronomeTrainer } from './metronome-trainer.js';
import {
  TRAIN_TIERS,
  TRAIN_EXERCISES,
  exercisesForTier,
  buildTrainMeasures,
  countTrainNotes,
  buildTrainSession,
  TRAIN_SESSION_SIZE,
} from './train-data.js';
import { renderPatternGridHtml, renderTrainScoreHtml, renderPatternPickerHtml } from './rhythm-display.js';
import { getQuizMeterConfig } from './fill-quiz.js';

const TIER_LABELS = {
  beginner: '입문',
  basic: '기초',
  intermediate: '심화',
};

let profile = null;
let runnerGame = null;
let trainer = null;
let lessonTrainer = null;
let trainSession = null;
let rhythmPlayer = null;
let selectedLevel = LEVELS[0];
let selectedTrainExerciseId = TRAIN_EXERCISES[0]?.id ?? 'u1-even8-q4';
let selectedTrainTier = 1;
/** lesson: 같이 치고 따라 치기 / together: 같이 치기만 */
let selectedTrainStyle = 'lesson';
let selectedQuizLevel = QUIZ_LEVELS[0];
let selectedQuizUnitId = 'u1-even8';
let playMode = 'learn';
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
      if (btn.dataset.tab === 'home') renderHomeTraining();
    });
  });
}

function goToPlay(mode) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.querySelector('[data-tab="play"]')?.classList.add('active');
  $('panel-play')?.classList.add('active');
  setPlayMode(mode);
}

function currentUnit() {
  const levelId = profile.placement?.quizLevelId ?? selectedQuizLevel.id;
  const units = unitsForLevel(levelId);
  if (!units.some((u) => u.id === selectedQuizUnitId)) {
    selectedQuizUnitId = units[0]?.id ?? 'u1-even8';
  }
  return getUnit(selectedQuizUnitId);
}

function renderHomeTraining() {
  renderTodayLesson();
  renderDailyPath();
}

function renderTodayLesson() {
  const card = $('todayLessonCard');
  if (!card) return;
  profile = resetDailyIfNeeded(profile);
  const unit = currentUnit();
  const points = (unit?.lecturePoints ?? []).map((p) => `<li>${p}</li>`).join('');
  card.innerHTML = `
    <div class="sec-label">오늘 배울 것</div>
    <p class="today-lesson-kicker">${unit?.order ?? 1}과 · ${unit?.meter ?? '4/4'} · ${unit?.bpm ?? 80} BPM</p>
    <h2 class="today-lesson-title">${unit?.title ?? '1과 · 2연음 기초'}</h2>
    <p class="today-lesson-sub">${unit?.subtitle ?? ''}</p>
    <p class="today-lesson-text">${unit?.learn ?? ''}</p>
    ${points ? `<ul class="today-lesson-points">${points}</ul>` : ''}
    <button type="button" id="todayLessonStart" class="duo-btn duo-btn-green">
      ${profile.dailyLearn ? '다시 보기' : '배우기 시작'}
    </button>
  `;
  $('todayLessonStart')?.addEventListener('click', () => {
    selectedQuizUnitId = unit?.id ?? 'u1-even8';
    goToPlay('learn');
  });
}

function renderDailyPath() {
  const root = $('dailyPath');
  if (!root) return;
  profile = resetDailyIfNeeded(profile);
  const steps = [
    { id: 'learn', done: profile.dailyLearn, optional: false, label: '1. 배우기', desc: '오늘 단원의 핵심을 익힙니다', mode: 'learn' },
    { id: 'train', done: profile.dailyTrain, optional: false, label: '2. 메트로놈 연습', desc: '같이 치고, 같은 리듬을 따라 칩니다', mode: 'train' },
    { id: 'quiz', done: profile.dailyQuiz, optional: false, label: '3. 확인 퀴즈', desc: '배운 내용을 문제로 확인합니다', mode: 'quiz' },
    { id: 'runner', done: profile.dailyArcade, optional: true, label: '4. 게임으로 복습', desc: '비트 서핑으로 같은 TAP을 연습합니다 (선택)', mode: 'runner' },
  ];
  const firstTodo = steps.find((s) => !s.done);
  root.innerHTML = steps.map((s) => `
    <button type="button" class="daily-step ${s.done ? 'done' : ''} ${firstTodo?.id === s.id ? 'current' : ''} ${s.optional ? 'optional' : ''}" data-mode="${s.mode}">
      <span class="daily-step-mark">${s.done ? '✓' : s.optional ? '○' : firstTodo?.id === s.id ? '→' : '·'}</span>
      <span class="daily-step-body">
        <strong>${s.label}</strong>
        <small>${s.desc}</small>
      </span>
    </button>
  `).join('');
  root.querySelectorAll('.daily-step').forEach((btn) => {
    btn.addEventListener('click', () => goToPlay(btn.dataset.mode));
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
  renderHomeTraining();
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
        <span>퀴즈 ${profile.placement.quizLevelName} · 연습 ${profile.placement.arcadeLevelName}</span>
        <span class="placement-meta">${profile.placement.totalCorrect}/${profile.placement.total} 정답 · ${date}</span>
      </div>
    `;
    $('pathBubble').textContent = `${profile.placement.quizLevelName} 구간부터 이어서 훈련해요!`;
    btn.textContent = '이어서 배우기';
    if ($('pathOptions')) $('pathOptions').style.display = 'none';
  } else {
    status.innerHTML = '';
    btn.textContent = '계속하기';
    if ($('pathOptions')) $('pathOptions').style.display = '';
  }
}

function startFromPathSelection() {
  if (profile.placement) {
    applyRecommendedLevels(profile.placement.quizLevelId, profile.placement.arcadeLevelId);
    goToPlay('learn');
    return;
  }
  if (selectedPath === 'basics') {
    applyRecommendedLevels('beginner', 'beginner');
    goToPlay('learn');
    return;
  }
  goToPlay('placement');
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
  renderDailyPath();
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
  const units = unitsForLevel(selectedQuizLevel.id);
  if (units[0]) selectedQuizUnitId = units[0].id;
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
        renderQuizUnitList();
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
  if ($('learnCard')) $('learnCard').style.display = mode === 'learn' ? 'block' : 'none';
  $('runnerCard').style.display = mode === 'runner' ? 'block' : 'none';
  $('trainCard').style.display = mode === 'train' ? 'block' : 'none';
  $('quizCard').style.display = mode === 'quiz' || mode === 'placement' ? 'block' : 'none';
  $('levelSelectCard').style.display = mode === 'runner' ? 'block' : 'none';
  $('resultCard').style.display = 'none';
  runnerGame?.stop();
  trainer?.stop();
  trainSession = null;
  rhythmPlayer?.stop();
  const modeHint = document.querySelector('.mode-hint');
  if (modeHint) {
    const hints = {
      learn: '먼저 오늘 배울 것을 보고, 메트로놈과 함께 따라 칩니다. 게임은 마지막 복습입니다.',
      train: '메트로놈을 켜 두고 악보와 같이 TAP한 뒤, 같은 리듬을 따라 칩니다',
      quiz: '배운 내용을 확인하는 퀴즈입니다. 리듬감 연습은 연습에서',
      runner: '음표가 노란 TAP선에 닿으면 화면을 누르는 복습 게임입니다',
      placement: '지금 실력을 가늠하는 10문제 · 끝나면 추천 단원으로 이어집니다',
    };
    modeHint.textContent = hints[mode] ?? '';
  }
  if (mode === 'quiz' || mode === 'placement') {
    quizState = null;
    $('quizStart').style.display = 'block';
  }
  renderLevels();
  if (mode === 'learn') renderLearnCard();
  if (mode === 'train') {
    renderTrainTierRow();
    renderTrainStyleRow();
    renderTrainPatternPicker();
    updateTrainIntroCopy();
  }
  if (mode === 'runner') {
    previewRunnerIdle();
  } else if ($('runnerScorePreview')) {
    $('runnerScorePreview').innerHTML = '';
  }
  updateTrainPreview();
  updateQuizModeUI();
}

function updateQuizModeUI() {
  const isPlacement = playMode === 'placement';
  const hint = $('quizHint');
  if (hint) {
    hint.textContent = isPlacement
      ? '청음·박자표·칸세기 등 10문제 레벨 테스트'
      : '단원 5문제 중 주관식 따라 치기가 두 문제입니다. 듣고 메트로놈에 맞춰 TAP하세요';
  }
  const startBtn = $('quizStart');
  if (startBtn) {
    startBtn.textContent = isPlacement ? '레벨 테스트 시작' : '단원 퀴즈 시작';
  }
  if (!isPlacement) renderQuizUnitList();
}

function renderQuizUnitList() {
  const list = $('quizUnitList');
  if (!list) return;
  const units = unitsForLevel(selectedQuizLevel.id);
  if (!units.some((u) => u.id === selectedQuizUnitId)) {
    selectedQuizUnitId = units[0]?.id ?? 'u1-even8';
  }
  list.innerHTML = units.map((u) => `
    <button type="button" class="quiz-unit-card ${u.id === selectedQuizUnitId ? 'active' : ''}" data-unit="${u.id}">
      <strong>${u.title}</strong>
      <span>${u.subtitle}</span>
      <span class="quiz-unit-skills">${u.skills.slice(0, 2).join(' · ')}</span>
    </button>
  `).join('');
  list.querySelectorAll('.quiz-unit-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedQuizUnitId = btn.dataset.unit;
      renderQuizUnitList();
      if (playMode === 'learn') renderLearnCard();
    });
  });
}

function renderLearnCard() {
  const body = $('learnBody');
  const list = $('learnUnitList');
  if (!body) return;
  const units = unitsForLevel(selectedQuizLevel.id);
  if (!units.some((u) => u.id === selectedQuizUnitId)) {
    selectedQuizUnitId = units[0]?.id ?? 'u1-even8';
  }
  if (list) {
    list.innerHTML = units.map((u) => `
      <button type="button" class="quiz-unit-card ${u.id === selectedQuizUnitId ? 'active' : ''}" data-unit="${u.id}">
        <strong>${u.title}</strong>
        <span>${u.subtitle}</span>
      </button>
    `).join('');
    list.querySelectorAll('.quiz-unit-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedQuizUnitId = btn.dataset.unit;
        renderLearnCard();
      });
    });
  }

  const unit = getUnit(selectedQuizUnitId);
  const example = patternsForUnit(selectedQuizUnitId).find((p) => p.measure || p.measures);
  const exampleHtml = example
    ? renderTrainScoreHtml(
      example.measures ?? [example.measure],
      example.meter ?? unit?.meter ?? '4/4',
      { idPrefix: 'learn' },
    )
    : '';
  const points = (unit?.lecturePoints ?? [])
    .map((p) => `<li>${p}</li>`)
    .join('');
  body.innerHTML = `
    <p class="learn-kicker">${unit?.order ?? ''}과 · ${unit?.meter ?? '4/4'} · ${unit?.bpm ?? 80} BPM</p>
    <p class="learn-goal">${unit?.title ?? '오늘의 리듬'}</p>
    <p class="learn-sub">${unit?.subtitle ?? ''}</p>
    <p class="learn-text">${unit?.learn ?? '기본박을 듣고, 음표가 있는 순간에 TAP한 뒤 같은 리듬을 따라 칩니다.'}</p>
    ${points ? `<ul class="learn-points">${points}</ul>` : ''}
    <p class="learn-section-lbl">오늘 연습 방법</p>
    <ol class="learn-steps">
      <li>기본박(메트로놈) 4번을 듣습니다. 이때는 TAP하지 않습니다.</li>
      <li>음표가 나오면 메트로놈과 같이 TAP합니다. TAP하면 소리가 납니다.</li>
      <li>같은 리듬을 한 번 더, 기억해서 따라 칩니다.</li>
      <li>확인 퀴즈 후, 원하면 게임으로 복습합니다.</li>
    </ol>
    <p class="learn-section-lbl">예제 악보</p>
    <div class="learn-example">${exampleHtml}</div>
  `;
}

function openLessonOverlay() {
  $('lessonOverlay').hidden = false;
  document.body.classList.add('lesson-open');
}

function closeLessonOverlay() {
  $('lessonOverlay').hidden = true;
  $('lessonFeedback').hidden = true;
  document.body.classList.remove('lesson-open');
  hideLessonPrep();
  rhythmPlayer?.stop();
  lessonTrainer?.stop();
  lessonTrainer = null;
}

function updateLessonProgress() {
  if (!quizState) return;
  const total = quizState.questions.length;
  const pct = (quizState.index / total) * 100;
  $('lessonProgressFill').style.width = `${pct}%`;
  const streakLbl = $('lessonStreakLbl');
  if (quizState.streak >= 2) {
    streakLbl.textContent = `${quizState.streak}번 연속 정답!`;
  } else {
    streakLbl.textContent = '';
  }
}

function showLessonPrep(text) {
  const banner = $('lessonPrepBanner');
  const textEl = $('lessonPrepText');
  if (!banner || !textEl) return;
  textEl.textContent = text;
  banner.hidden = false;
  banner.classList.add('active');
}

function hideLessonPrep() {
  const banner = $('lessonPrepBanner');
  if (!banner) return;
  banner.hidden = true;
  banner.classList.remove('active');
}

function setEchoPhase(phase) {
  if (!quizState) return;
  quizState.echoPhase = phase;
  const hint = $('lessonTapHint');
  const phaseEl = $('lessonTapPhase');
  const tapBtn = $('lessonTapBtn');
  if (phase === 'listen') {
    if (hint) hint.textContent = '시범을 들으세요. 보기를 고르는 문제가 아닙니다.';
    if (phaseEl) phaseEl.textContent = '1. 듣기 · 아직 TAP 금지';
    if (tapBtn) {
      tapBtn.disabled = true;
      tapBtn.textContent = '듣는 중';
    }
  } else if (phase === 'tap') {
    if (hint) hint.textContent = '기본박 후, 들은 리듬을 메트로놈에 맞춰 TAP하세요.';
    if (phaseEl) phaseEl.textContent = '2. 따라 치기 · 음이 있는 순간만';
    if (tapBtn) {
      tapBtn.disabled = false;
      tapBtn.textContent = 'TAP!';
    }
  } else if (phase === 'done') {
    if (tapBtn) {
      tapBtn.disabled = true;
      tapBtn.textContent = '완료';
    }
  }
}

function renderLessonQuestion() {
  lessonTrainer?.stop();
  const q = quizState.questions[quizState.index];
  const qType = q.type ?? 'listen';
  lessonSelectedId = null;
  quizState.answered = false;
  $('lessonCheckBtn').disabled = true;
  $('lessonFeedback').hidden = true;

  const meterText = qType === 'meter'
    ? '박자표 숨김'
    : (q.meterLabel ?? (q.bars >= 2 ? '4/4 · 2마디 (8박)' : '4/4 · 1마디 (4박)'));
  const typeLabel = QUIZ_TYPE_LABELS[qType] ?? '퀴즈';
  const measureEl = $('lessonMeasure');
  const audioRow = $('lessonAudioRow');
  const metroBtn = $('lessonMetronome');

  const instructions = {
    listen: '🔊로 듣고, 같은 리듬 칸을 고르세요',
    fill: '위 마디의 빈칸(□)에 들어갈 리듬을 고르세요',
    meter: '박자표가 가려져 있어요. 리듬을 보고 들어 4/4인지 6/8인지 고르세요',
    count: '빈 칸이 아니라 음표 길이입니다. ♩=♪♪, 이 마디는 8분음표로 몇 개 길이일까요?',
    odd: '🔊 A→B→C→D 네 개를 순서대로 듣고, 다른 리듬 1개를 고르세요',
    echo: '주관식입니다. 들려주는 리듬을 듣고, 메트로놈에 맞춰 그대로 TAP하세요. 보기를 고르지 않습니다',
  };

  $('lessonInstruction').textContent = instructions[qType] ?? '정답을 고르세요';
  if (metroBtn) {
    metroBtn.hidden = !['listen', 'odd', 'fill', 'count', 'meter', 'echo'].includes(qType);
    const meterCfg = getQuizMeterConfig(q.meter ?? q.meterId ?? '4/4', q.bars ?? 1);
    const prepLabel = meterCfg.prepKind === 'compound' ? '복박 기본박' : '기본박';
    const totalPrep = meterCfg.prepBars * meterCfg.beatsPerBar;
    metroBtn.title = `${prepLabel} ${totalPrep}번`;
  }

  if (qType === 'fill') {
    measureEl.hidden = false;
    measureEl.innerHTML = q.measureHtml;
    audioRow.hidden = false;
    $('lessonListen').setAttribute('aria-label', '전체 마디 듣기 (힌트)');
  } else if (qType === 'odd') {
    measureEl.hidden = false;
    measureEl.innerHTML = '<p class="lesson-measure-hint">악보 없이 귀로만! A·B·C·D 중 3개는 같고 1개만 달라요 · 🔊로 전체 또는 각 보기를 들어보세요</p>';
    audioRow.hidden = false;
    $('lessonListen').setAttribute('aria-label', 'A부터 D까지 순서대로 듣기');
    $('lessonListenSlow').setAttribute('aria-label', '느리게 순서대로 듣기');
  } else if (qType === 'echo') {
    measureEl.hidden = false;
    measureEl.innerHTML = `
      <div class="echo-listen-card">
        <p class="echo-listen-title">주관식 · 듣고 따라 치기</p>
        <p class="echo-listen-body">악보와 보기 없이, 들려주는 리듬만 귀로 기억합니다.</p>
        <ol class="echo-how">
          <li>메트로놈과 함께 시범이 나옵니다. <strong>아직 TAP하지 마세요.</strong></li>
          <li>기본박 4번 후, 들은 그대로 TAP합니다. 음이 있는 순간만 칩니다.</li>
        </ol>
      </div>
    `;
    audioRow.hidden = false;
    $('lessonListen').setAttribute('aria-label', '따라 칠 리듬 다시 듣기');
    setEchoPhase('listen');
  } else if (qType === 'meter' || qType === 'count') {
    measureEl.hidden = false;
    measureEl.innerHTML = q.measureHtml;
    audioRow.hidden = false;
    $('lessonListen').setAttribute('aria-label', '리듬 듣기 (힌트)');
  } else {
    measureEl.hidden = false;
    measureEl.innerHTML = `<p class="lesson-measure-hint">${meterText} · 아래 보기 중 같은 패턴을 찾으세요</p>`;
    audioRow.hidden = false;
    $('lessonListen').setAttribute('aria-label', '리듬 듣기');
  }

  if (isPlacementMode()) {
    const extra = qType === 'meter' ? '' : ` · ${meterText}`;
    $('lessonSub').textContent = `${TIER_LABELS[q.levelId]} · ${typeLabel}${extra} · ${quizState.index + 1}/${quizState.questions.length}`;
  } else {
    const unitPart = q.unitTitle ? `${q.unitTitle} · ` : '';
    const extra = qType === 'meter' ? '' : ` · ${meterText}`;
    $('lessonSub').textContent = `${unitPart}${typeLabel}${extra} · ${q.bpm} BPM · ${quizState.index + 1}/${quizState.questions.length}`;
  }

  const tapWrap = $('lessonTapWrap');
  if (tapWrap) tapWrap.hidden = qType !== 'echo';
  const echoTap = $('lessonTapBtn');
  if (echoTap && qType !== 'echo') {
    echoTap.disabled = true;
    echoTap.textContent = 'TAP!';
  }
  if (qType === 'echo') setEchoPhase(quizState.echoPhase || 'listen');
  const checkBtn = $('lessonCheckBtn');
  if (checkBtn) {
    checkBtn.hidden = qType === 'echo';
    checkBtn.disabled = true;
  }

  $('lessonOptions').classList.toggle('lesson-options-odd', qType === 'odd');
  $('lessonOptions').innerHTML = (q.options ?? []).map((opt) => {
    if (qType === 'odd') {
      return `
        <div class="odd-option-row">
          <button type="button" class="odd-play-mini" data-play-id="${opt.id}" aria-label="보기 ${opt.id} 리듬 듣기">🔊</button>
          <button type="button" class="duo-choice duo-choice-text odd-select" data-id="${opt.id}">
            <span class="odd-option-letter">${opt.id}</span>
            <span class="odd-option-desc">보기 ${opt.id}</span>
          </button>
        </div>
      `;
    }
    const inner = opt.gridHtml || opt.label || opt.notation;
    const cls = opt.gridHtml ? 'duo-choice duo-choice-grid' : 'duo-choice duo-choice-text';
    return `<button type="button" class="${cls}" data-id="${opt.id}">${inner}</button>`;
  }).join('');

  $('lessonOptions').querySelectorAll('.odd-select').forEach((btn) => {
    btn.addEventListener('click', () => selectLessonOption(btn.dataset.id));
  });
  $('lessonOptions').querySelectorAll('.odd-play-mini').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playOddOption(btn.dataset.playId, false);
    });
  });
  $('lessonOptions').querySelectorAll('.duo-choice:not(.odd-select)').forEach((btn) => {
    btn.addEventListener('click', () => selectLessonOption(btn.dataset.id));
  });

  $('lessonListen').disabled = false;
  $('lessonListenSlow').disabled = false;
  const metroBtnState = $('lessonMetronome');
  if (metroBtnState) metroBtnState.disabled = false;
  const backBtn = $('lessonBackBtn');
  if (backBtn) {
    backBtn.disabled = quizState.index === 0 || quizState.answered;
  }
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

async function playOddOption(optionId, slow = false) {
  const q = quizState?.questions[quizState.index];
  if (!q || q.type !== 'odd') return;
  const opt = q.options.find((o) => o.id === optionId);
  if (!opt) return;
  rhythmPlayer?.stop();
  if (!rhythmPlayer) rhythmPlayer = new RhythmPlayer();
  if (opt.timeline?.length) {
    await rhythmPlayer.playTimeline(opt.timeline, q.bpm, { slow, countdown: false });
  } else if (opt.pattern?.length) {
    await rhythmPlayer.playPattern(opt.pattern, q.bpm, { slow, countdown: false });
  }
}

async function setLessonAudioBusy(busy) {
  $('lessonListen').disabled = busy;
  $('lessonListenSlow').disabled = busy;
  const metro = $('lessonMetronome');
  if (metro) metro.disabled = busy;
}

async function playLessonBasicBeat(slow = false) {
  const q = quizState?.questions[quizState.index];
  if (!q) return;
  if (!rhythmPlayer) rhythmPlayer = new RhythmPlayer();
  const meterCfg = getQuizMeterConfig(q.meter ?? q.meterId ?? '4/4', q.bars ?? 1);
  const prepLabel = meterCfg.prepKind === 'compound' ? '복박 기본박' : '기본박';
  const totalPrep = meterCfg.prepBars * meterCfg.beatsPerBar;

  hideLessonPrep();
  await rhythmPlayer.playBasicBeats(q.bpm, {
    bars: meterCfg.prepBars,
    beatsPerBar: meterCfg.beatsPerBar,
    slow,
    onBeat: (beat, total) => showLessonPrep(`${prepLabel} ${beat} / ${total}`),
  });
  hideLessonPrep();
}

async function playLessonRhythm(slow = false) {
  const q = quizState?.questions[quizState.index];
  if (!q) return;
  const meterCfg = getQuizMeterConfig(q.meter ?? q.meterId ?? '4/4', q.bars ?? 1);
  const withClicks = q.type === 'echo';
  if (q.playTimeline?.length) {
    await rhythmPlayer.playTimeline(q.playTimeline, q.bpm, {
      slow,
      countdown: false,
      clickTrack: withClicks,
      beatsPerBar: meterCfg.beatsPerBar,
    });
  } else if (q.correctPattern?.length) {
    await rhythmPlayer.playPattern(q.correctPattern, q.bpm, {
      slow,
      countdown: false,
      clickTrack: withClicks,
      beatsPerBar: meterCfg.beatsPerBar,
    });
  }
}

async function playOddSequence(slow = false) {
  const q = quizState?.questions[quizState.index];
  if (!q || q.type !== 'odd') return;
  await setLessonAudioBusy(true);
  rhythmPlayer?.stop();
  if (!rhythmPlayer) rhythmPlayer = new RhythmPlayer();

  await playLessonBasicBeat(slow);
  await new Promise((resolve) => setTimeout(resolve, 320));

  const gapMs = slow ? 700 : 500;
  for (const opt of q.options) {
    if (!quizState || quizState.questions[quizState.index] !== q) break;
    $('lessonOptions').querySelectorAll('.odd-select').forEach((btn) => {
      btn.classList.toggle('odd-playing', btn.dataset.id === opt.id);
    });
    showLessonPrep(`보기 ${opt.id} 재생 중`);
    if (opt.timeline?.length) {
      await rhythmPlayer.playTimeline(opt.timeline, q.bpm, { slow, countdown: false });
    } else {
      await rhythmPlayer.playPattern(opt.pattern, q.bpm, { slow, countdown: false });
    }
    hideLessonPrep();
    await new Promise((resolve) => setTimeout(resolve, gapMs));
  }

  $('lessonOptions').querySelectorAll('.odd-select').forEach((btn) => {
    btn.classList.remove('odd-playing');
  });
  hideLessonPrep();
  if (quizState?.questions[quizState.index] === q && !quizState.answered) {
    await setLessonAudioBusy(false);
  }
}

async function playLessonAudio(slow = false) {
  const q = quizState.questions[quizState.index];
  if (q.type === 'odd') {
    await playOddSequence(slow);
    return;
  }
  if (!q.playTimeline?.length && !q.correctPattern?.length) return;
  await setLessonAudioBusy(true);
  if (!rhythmPlayer) rhythmPlayer = new RhythmPlayer();

  if (q.type === 'listen' || q.type === 'echo') {
    if (q.type === 'echo') {
      setEchoPhase('listen');
      showLessonPrep('시범 듣는 중 · 아직 TAP 금지');
    }
    await playLessonBasicBeat(slow);
    await new Promise((resolve) => setTimeout(resolve, 320));
    if (q.type === 'echo') showLessonPrep('시범 리듬 · 메트로놈에 맞춰 들으세요');
  }

  await playLessonRhythm(slow);
  hideLessonPrep();
  if (quizState?.questions[quizState.index] === q && !quizState.answered) {
    await setLessonAudioBusy(false);
  }
}

async function playLessonThenMaybeEcho() {
  const q = quizState?.questions[quizState.index];
  if (!q) return;
  if (q.type === 'listen' || q.type === 'odd' || q.type === 'echo') {
    await playLessonAudio();
  }
  if (q.type === 'echo' && quizState && !quizState.answered) {
    await startLessonEchoTap();
  }
}

async function replayLessonAudio(slow = false) {
  const q = quizState?.questions[quizState.index];
  if (!q || quizState.answered) return;
  if (q.type === 'echo') {
    lessonTrainer?.stop();
    setEchoPhase('listen');
    await playLessonAudio(slow);
    if (quizState && !quizState.answered && quizState.questions[quizState.index] === q) {
      await startLessonEchoTap();
    }
    return;
  }
  await playLessonAudio(slow);
}

async function startLessonEchoTap() {
  const q = quizState?.questions[quizState.index];
  if (!q?.measures?.length) return;
  setEchoPhase('tap');
  showLessonPrep('기본박 후 TAP · 보기를 고르지 마세요');
  lessonTrainer?.stop();
  lessonTrainer = new MetronomeTrainer({
    bpm: q.bpm,
    measures: q.measures,
    strict: false,
    binaryJudge: true,
    clickTrack: true,
    onCountIn: (beat, total) => {
      showLessonPrep(beat < total ? `기본박 ${beat} / ${total} · 아직 TAP 금지` : '이제 들은 리듬을 TAP!');
    },
    onJudge: (key) => {
      showLessonPrep(key === 'perfect' ? 'PERFECT' : 'MISS');
    },
    onEnd: (result) => finishLessonEcho(result),
    onFail: (result) => finishLessonEcho(result),
  });
  await lessonTrainer.start();
}

function finishLessonEcho(result) {
  if (!quizState || quizState.answered) return;
  setEchoPhase('done');
  lessonSelectedId = result.miss === 0 ? 'tap' : 'miss';
  quizState.echoMiss = result.miss;
  quizState.echoPerfect = result.perfect;
  hideLessonPrep();
  submitLessonAnswer();
}

function submitLessonAnswer() {
  if (!quizState || quizState.answered || !lessonSelectedId) return;
  quizState.answered = true;

  const q = quizState.questions[quizState.index];
  const correct = q.type === 'echo'
    ? lessonSelectedId === 'tap'
    : lessonSelectedId === q.answerId;
  const alreadyScored = q.type === 'echo' && quizState.echoScored;

  $('lessonOptions').querySelectorAll('.duo-choice').forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.id === q.answerId) btn.classList.add('correct');
    else if (btn.dataset.id === lessonSelectedId) btn.classList.add('wrong');
  });
  $('lessonCheckBtn').disabled = true;

  if (!alreadyScored) {
    if (q.type === 'echo') quizState.echoScored = true;
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
  } else {
    setGiryongMood(correct ? 'happy' : 'sad');
  }

  $('lessonFeedback').hidden = false;
  $('lessonFeedback').className = `lesson-feedback ${correct ? 'ok' : 'ng'}`;
  $('lessonFeedbackTitle').textContent = alreadyScored && correct
    ? '이제 맞춰졌어요!'
    : (correct ? '참 잘했어요!' : '정답이 아니에요');
  if (q.type === 'echo') {
    const scoreHtml = q.measureHtml ? `<div class="echo-answer-score">${q.measureHtml}</div>` : '';
    $('lessonFeedbackDetail').innerHTML = correct
      ? `MISS 없이 따라 쳤어요 · PERFECT ${quizState.echoPerfect ?? 0}${scoreHtml}`
      : `MISS ${quizState.echoMiss ?? 1}번. 정답 리듬은 아래와 같아요.${scoreHtml}`;
    const cont = $('lessonContinueBtn');
    if (cont) {
      cont.textContent = correct ? '계속하기' : '다시 따라 치기';
    }
    quizState.echoRetry = !correct;
  } else {
    $('lessonFeedbackDetail').textContent = correct
      ? (isPlacementMode() ? '' : `+${QUIZ_SCORE.correct.points}점`)
      : `정답: ${q.answerId} · ${q.options.find((o) => o.id === q.answerId)?.label ?? q.options.find((o) => o.id === q.answerId)?.notation ?? q.correctNotation}`;
    quizState.echoRetry = false;
    const cont = $('lessonContinueBtn');
    if (cont) cont.textContent = '계속하기';
  }
  updateLessonProgress();
}

async function goBackLesson() {
  if (!quizState || quizState.index === 0 || quizState.answered) return;
  $('lessonFeedback').hidden = true;
  rhythmPlayer?.stop();
  lessonTrainer?.stop();
  quizState.index -= 1;
  if (isPlacementMode()) {
    quizState.answers = quizState.answers.slice(0, quizState.index);
  }
  renderLessonQuestion();
  updateLessonProgress();
  await playLessonThenMaybeEcho();
}

async function continueLesson() {
  lessonTrainer?.stop();
  $('lessonFeedback').hidden = true;
  if (quizState?.echoRetry) {
    quizState.echoRetry = false;
    quizState.answered = false;
    lessonSelectedId = null;
    const cont = $('lessonContinueBtn');
    if (cont) cont.textContent = '계속하기';
    renderLessonQuestion();
    await playLessonThenMaybeEcho();
    return;
  }
  quizState.index += 1;
  quizState.echoScored = false;
  quizState.echoRetry = false;
  $('lessonProgressFill').style.width = `${(quizState.index / quizState.questions.length) * 100}%`;

  if (quizState.index >= quizState.questions.length) {
    closeLessonOverlay();
    if (isPlacementMode()) finishPlacement();
    else finishQuiz();
    return;
  }

  renderLessonQuestion();
  await playLessonThenMaybeEcho();
}

async function startLesson(mode) {
  playMode = mode;
  rhythmPlayer?.stop();
  let questions;
  let unitMeta = null;
  if (mode === 'placement') {
    questions = buildPlacementRound();
  } else {
    const round = buildUnitQuizRound(selectedQuizUnitId);
    questions = round.questions;
    unitMeta = round.unit;
  }
  quizState = {
    questions,
    unitMeta,
    index: 0,
    score: 0,
    streak: 0,
    correct: 0,
    xp: 0,
    coins: 0,
    answers: [],
    answered: false,
    echoPhase: null,
    echoRetry: false,
    echoScored: false,
  };
  setGiryongMood('focus');
  openLessonOverlay();
  renderLessonQuestion();
  await playLessonThenMaybeEcho();
}

function showLessonComplete(cardsHtml) {
  $('lessonCompleteCards').innerHTML = cardsHtml;
  $('lessonCompleteOverlay').hidden = false;
}

function hideLessonComplete() {
  $('lessonCompleteOverlay').hidden = true;
}

function getTrainBars() {
  return TRAIN_TIERS.find((t) => t.id === selectedTrainTier)?.bars ?? 1;
}

function getTrainExercise() {
  return TRAIN_EXERCISES.find((ex) => ex.id === selectedTrainExerciseId) ?? TRAIN_EXERCISES[0];
}

function getTrainMaxTier() {
  return profile?.trainMaxTier ?? 1;
}

function getScorePreviewRoots() {
  return [$('runnerScorePreview'), $('trainPatternPreview')].filter((el) => el?.innerHTML?.trim());
}

function resetTrainScoreHighlights() {
  ['trainCursor', 'runnerCursor'].forEach((id) => {
    const cursor = $(id);
    if (!cursor) return;
    cursor.style.left = '';
    cursor.style.top = '';
    cursor.style.height = '';
    cursor.style.bottom = '';
    cursor.classList.remove('active', 'count-in');
  });
  getScorePreviewRoots().forEach((root) => {
    root.querySelectorAll('[data-pos]').forEach((el) => {
      el.classList.remove('playhead', 'active', 'hit', 'miss');
    });
  });
}

function slotPlayheadT(currentBeat, startBeat, durBeat) {
  if (!(durBeat > 0)) return 0;
  return Math.min(1, Math.max(0, (currentBeat - startBeat) / durBeat));
}

function placeCursorOnSlot(cursor, track, slot, t = 0) {
  if (!cursor || !track || !slot) return false;
  const trackRect = track.getBoundingClientRect();
  const slotRect = slot.getBoundingClientRect();
  if (trackRect.width < 1 || slotRect.width < 1) return false;
  const x = slotRect.left - trackRect.left + slotRect.width * t;
  cursor.style.left = `${Math.max(0, x)}px`;
  cursor.style.top = `${Math.max(0, slotRect.top - trackRect.top)}px`;
  cursor.style.height = `${slotRect.height}px`;
  cursor.style.bottom = 'auto';
  return true;
}

function setTrainCursor({ phase, activePos, currentBeat = 0, startBeat = 0, durBeat = 1 }) {
  const isRunner = playMode === 'runner';
  const cursor = isRunner ? $('runnerCursor') : $('trainCursor');
  const track = isRunner ? $('runnerScoreTrack') : $('trainScoreTrack');
  if (cursor) {
    cursor.classList.toggle('active', phase === 'play');
    cursor.classList.toggle('count-in', phase === 'count-in' || phase === 'prep');
    cursor.hidden = isRunner ? phase !== 'play' : (phase === 'ready' || phase === 'end');
    if (!isRunner && track && !cursor.hidden) {
      const pos = phase === 'play' && activePos >= 0 ? activePos : 0;
      const slot = track.querySelector(`[data-pos="${pos}"]`);
      const t = phase === 'play' ? slotPlayheadT(currentBeat, startBeat, durBeat) : 0;
      placeCursorOnSlot(cursor, track, slot, t);
    }
  }
  if (track) {
    track.classList.toggle('train-count-in', phase === 'count-in' || phase === 'prep');
    track.classList.toggle('train-playing', phase === 'play');
  }
  getScorePreviewRoots().forEach((root) => {
    root.querySelectorAll('[data-pos]').forEach((el) => {
      if (phase === 'play' && activePos >= 0) {
        el.classList.toggle('playhead', Number(el.dataset.pos) === activePos);
      } else {
        el.classList.remove('playhead');
      }
    });
  });
}

function showTrainCountIn(beat, total) {
  const el = playMode === 'runner' ? $('runnerJudgeFlash') : $('trainJudgeFlash');
  if (!el) return;
  el.textContent = `기본박 ${beat} / ${total}`;
  el.className = 'judge-flash show';
  setTimeout(() => el.classList.remove('show'), 200);
  if (playMode === 'train' && trainSession && total > 0) {
    setTrainFlashState({
      phase: `기본박 ${beat} / ${total}`,
      hint: beat < total ? '기본박만 들으세요. 아직 TAP하지 마세요' : '노란 커서가 음표 위에 오면 TAP! 쉼표는 치지 마세요',
    });
  }
  if (playMode === 'runner') {
    setRunnerStatus(
      'count-in',
      beat < total
        ? `기본박 ${beat} / ${total} · 아직 누르지 마세요`
        : '이제 음표가 노란선에 닿으면 TAP',
    );
    $('runnerLane')?.classList.add('count-in');
    $('runnerLane')?.classList.remove('playing');
  }
}

function showRunnerPrep(beat, total) {
  const el = $('runnerJudgeFlash');
  if (!el) return;
  el.textContent = `준비 ${beat} / ${total} — 곧 시작!`;
  el.className = 'judge-flash show prep';
  setTimeout(() => el.classList.remove('show'), 280);
  setRunnerStatus('prep', `곧 시작 · 음표가 노란선에 오면 TAP`);
}

function setRunnerStatus(phase, text) {
  const el = $('runnerStatus');
  const textEl = $('runnerStatusText');
  if (!el || !textEl) return;
  el.hidden = false;
  el.dataset.phase = phase;
  textEl.textContent = text;
}

function previewRunnerIdle() {
  const preview = $('runnerScorePreview');
  if (!preview) return;
  const stage = getRunnerStage();
  preview.innerHTML = renderTrainScoreHtml(stage.measures, '4/4', { idPrefix: 'runnerIdle' });
  $('runnerLaneScroll')?.style.setProperty('--run-offset', '0%');
  $('runnerLane')?.classList.remove('playing', 'count-in');
  setRunnerStatus('idle', '시작을 누르면 음표가 노란 TAP선으로 옵니다');
}

function setTrainScoreActive(hitIdx) {
  getScorePreviewRoots().forEach((root) => {
    root.querySelectorAll('.train-hit-slot').forEach((el) => {
      el.classList.toggle('active', Number(el.dataset.hit) === hitIdx);
    });
  });
}

function markTrainScoreHit(hitIdx, key) {
  getScorePreviewRoots().forEach((root) => {
    const slot = root.querySelector(`[data-hit="${hitIdx}"]`);
    if (!slot) return;
    slot.classList.remove('active', 'playhead');
    slot.classList.add(key === 'miss' ? 'miss' : 'hit');
  });
}

function flashTrainJudge(key, pts, combo, hitIdx, posIdx) {
  const el = $('trainJudgeFlash');
  if (key === 'miss') {
    el.textContent = 'MISS';
  } else if (key === 'perfect') {
    el.textContent = `PERFECT +${pts}`;
  } else {
    el.textContent = `${JUDGE[key]?.label ?? key} +${pts}`;
  }
  el.className = `judge-flash show ${key}`;
  setTimeout(() => el.classList.remove('show'), 380);
  $('trainScore').textContent = getTrainDisplayScore().toLocaleString();
  $('trainCombo').textContent = combo;
  if (hitIdx != null) markTrainScoreHit(hitIdx, key);
}

function updateTrainPreview() {
  const ex = getTrainExercise();
  const bars = getTrainBars();
  const preview = $('trainPatternPreview');
  if (preview && ex) {
    const measures = buildTrainMeasures(ex, bars);
    preview.innerHTML = renderTrainScoreHtml(measures);
    resetTrainScoreHighlights();
    const bpmInput = $('trainBpm');
    const bpmVal = $('trainBpmVal');
    if (bpmInput && ex.bpm) {
      bpmInput.value = ex.bpm;
      if (bpmVal) bpmVal.textContent = ex.bpm;
    }
  }
  if ($('trainFlashHint') && !trainSession) {
    $('trainFlashHint').textContent = '선택한 리듬 미리보기';
  }
}

function renderTrainTierRow() {
  const row = $('trainTierRow');
  const hint = $('trainTierHint');
  if (!row) return;
  const maxTier = getTrainMaxTier();
  row.innerHTML = TRAIN_TIERS.map((tier) => {
    const locked = tier.id > maxTier;
    const active = tier.id === selectedTrainTier;
    return `
      <button type="button" class="train-tier-btn ${active ? 'active' : ''} ${locked ? 'locked' : ''}"
        data-tier="${tier.id}" ${locked ? 'disabled' : ''}>
        <strong>${tier.label}</strong>
        <span>${locked ? '🔒 클리어 후 해제' : tier.hint}</span>
      </button>
    `;
  }).join('');
  row.querySelectorAll('.train-tier-btn:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedTrainTier = Number(btn.dataset.tier);
      renderTrainTierRow();
      renderTrainPatternPicker();
      updateTrainPreview();
    });
  });
  const current = TRAIN_TIERS.find((t) => t.id === selectedTrainTier);
  if (hint && current) {
    hint.textContent = lockedTierHint(maxTier, current);
  }
}

function trainStyleCopy(style = selectedTrainStyle) {
  if (style === 'together') {
    return {
      intro: '메트로놈을 켜 두고 악보와 같이 TAP · 5문제',
      hint: '같이 치기 — 기본박 후 노란 커서가 음표에 닿을 때 TAP합니다',
      lock: `${currentTrainLabel()} — 기본박 4번 후 음표에서 TAP!`,
      listenHint: '노란 커서가 음표(♩♪) 위에 있을 때 TAP! 쉼표는 건너뛰세요',
    };
  }
  return {
    intro: '같이 친 뒤, 같은 리듬을 따라 칩니다 · 5문제',
    hint: '같이 치고 → 따라 치기 — 메트로놈을 켠 채 한 번 같이 치고, 같은 리듬을 혼자 다시 TAP합니다',
    lock: `${currentTrainLabel()} — 같이 친 다음 따라 치기`,
    listenHint: '노란 커서가 음표(♩♪) 위에 있을 때 TAP!',
  };
}

function currentTrainLabel() {
  return TRAIN_TIERS.find((t) => t.id === selectedTrainTier)?.label ?? '1마디';
}

function lockedTierHint(maxTier, current) {
  if (current.id <= maxTier) return trainStyleCopy().lock;
  return '이전 단계를 무실수로 클리어하면 해제됩니다';
}

function updateTrainIntroCopy() {
  const intro = $('trainIntroHint');
  const styleHint = $('trainStyleHint');
  const copy = trainStyleCopy();
  if (intro && !trainSession) intro.textContent = copy.intro;
  if (styleHint) styleHint.textContent = copy.hint;
}

function renderTrainStyleRow() {
  const row = $('trainStyleRow');
  if (!row) return;
  row.querySelectorAll('.train-style-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.style === selectedTrainStyle);
  });
  updateTrainIntroCopy();
}

function renderTrainPatternPicker() {
  const picker = $('trainPatternPicker');
  if (!picker) return;
  const tier = selectedTrainTier;
  const list = exercisesForTier(tier);
  if (!list.some((ex) => ex.id === selectedTrainExerciseId)) {
    selectedTrainExerciseId = list[0]?.id ?? TRAIN_EXERCISES[0].id;
  }
  const clears = profile?.trainClears ?? {};
  const bars = getTrainBars();
  picker.innerHTML = list.map((ex) => {
    const cleared = clears[`${ex.id}-${bars}`];
    const measure = ex.measure ?? ex.measures?.[0];
    return `
      <button type="button" class="train-pattern-card ${ex.id === selectedTrainExerciseId ? 'active' : ''} ${cleared ? 'cleared' : ''}"
        data-id="${ex.id}" aria-label="리듬 패턴 선택">
        ${cleared ? '<span class="train-clear-badge">✓</span>' : ''}
        ${renderPatternPickerHtml(measure)}
      </button>
    `;
  }).join('');
  picker.querySelectorAll('.train-pattern-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedTrainExerciseId = btn.dataset.id;
      renderTrainPatternPicker();
      updateTrainPreview();
    });
  });
}

function getTrainDisplayScore() {
  if (!trainSession) return trainer?.score ?? 0;
  return (trainSession.sessionScore ?? 0) + (trainer?.score ?? 0);
}

function setTrainFlashState({ num, phase, hint, tapHint = false }) {
  const numEl = $('trainFlashNum');
  const phaseEl = $('trainFlashPhase');
  const hintEl = $('trainFlashHint');
  if (num && numEl) numEl.textContent = num;
  if (phase && phaseEl) phaseEl.textContent = phase;
  if (hint && hintEl) {
    hintEl.textContent = hint;
    hintEl.classList.toggle('train-flash-hint-tap', tapHint);
  }
}

function enterTrainSessionUI() {
  $('trainSetup')?.classList.add('train-setup-hidden');
  const intro = $('trainIntroHint');
  if (intro) intro.textContent = trainStyleCopy(trainSession?.style).intro.replace(' · 5문제 연속', '');
  const meta = $('trainFlashMeta');
  if (meta) meta.hidden = false;
  const start = $('trainStart');
  if (start) start.hidden = true;
}

function exitTrainSessionUI() {
  $('trainSetup')?.classList.remove('train-setup-hidden');
  const intro = $('trainIntroHint');
  if (intro) intro.textContent = trainStyleCopy().intro;
  const meta = $('trainFlashMeta');
  if (meta) meta.hidden = true;
  const start = $('trainStart');
  if (start) {
    start.hidden = false;
    start.disabled = false;
  }
  const card = $('trainFlashCard');
  if (card) {
    card.classList.remove(
      'train-flash-enter',
      'train-flash-exit',
      'train-flash-done-ok',
      'train-flash-done-miss',
      'train-flash-tap',
    );
  }
  const hintEl = $('trainFlashHint');
  if (hintEl) {
    hintEl.textContent = '선택한 리듬 미리보기';
    hintEl.classList.remove('train-flash-hint-tap');
  }
}

function animateTrainFlashCard(className) {
  const card = $('trainFlashCard');
  if (!card) return;
  card.classList.remove(
    'train-flash-enter',
    'train-flash-exit',
    'train-flash-done-ok',
    'train-flash-done-miss',
    'train-flash-tap',
  );
  if (className) card.classList.add(className);
}

async function presentTrainFlashCard(round) {
  const total = trainSession.rounds.length;
  const idx = trainSession.index;
  const unit = getUnit(round.exercise.unitId);
  const unitLabel = unit?.title?.replace(/^\d+과 · /, '') ?? '리듬';

  prepareTrainRoundPreview(round);
  animateTrainFlashCard('train-flash-enter');
  setTrainFlashState({
    num: `문제 ${idx + 1} / ${total}`,
    phase: '같이 치기',
    hint: trainSession.style === 'lesson'
      ? `${unitLabel} · ${round.bars}마디 — 기본박 후 같이 TAP, 다음에 따라 치기`
      : `${unitLabel} · ${round.bars}마디 — 기본박 후 TAP`,
  });
  updateTrainRoundHud();
  const dwell = 700;
  await new Promise((resolve) => setTimeout(resolve, dwell));
}

function updateTrainRoundHud() {
  const roundEl = $('trainRound');
  if (!roundEl || !trainSession) return;
  roundEl.textContent = `${trainSession.index + 1}/${trainSession.rounds.length}`;
}

function prepareTrainRoundPreview(round) {
  const preview = $('trainPatternPreview');
  if (!preview || !round) return;
  preview.innerHTML = renderTrainScoreHtml(round.measures);
  resetTrainScoreHighlights();
}

function aggregateTrainSessionResults(results) {
  const agg = {
    score: 0,
    xp: 0,
    coins: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
    clearedRounds: 0,
    totalRounds: results.length,
  };
  for (const r of results) {
    agg.score += r.score;
    agg.xp += r.xp;
    agg.coins += r.coins;
    agg.maxCombo = Math.max(agg.maxCombo, r.maxCombo);
    agg.perfect += r.perfect;
    agg.great += r.great;
    agg.good += r.good;
    agg.miss += r.miss;
    if (r.cleared) agg.clearedRounds += 1;
  }
  agg.allClear = agg.clearedRounds === agg.totalRounds;
  return agg;
}

function showTrainSessionResult() {
  const results = trainSession?.results ?? [];
  const agg = aggregateTrainSessionResults(results);
  const bpm = trainSession?.bpm ?? 88;
  const bars = getTrainBars();

  $('trainCard').style.display = 'none';
  $('resultCard').style.display = 'block';

  if (agg.allClear) {
    const xp = Math.round(agg.xp * 1.2) + TRAIN_SESSION_SIZE * 5;
    profile = addTrainResult(profile, {
      score: agg.score,
      xpGained: xp,
      coinsGained: agg.coins + 10,
      maxCombo: agg.maxCombo,
    });
    results.forEach((r) => {
      if (r.exercise) {
        profile = saveTrainClear(profile, {
          exerciseId: r.exercise.id,
          bars: r.bars,
          tier: selectedTrainTier,
        });
      }
    });
    $('resultTitle').textContent = '세션 완료!';
    $('resultBody').innerHTML = `
      <div class="result-score">${agg.score.toLocaleString()}</div>
      <p class="result-clear-msg">${TRAIN_SESSION_SIZE}개 리듬 모두 무실수 클리어!</p>
      <div class="result-grid">
        <span>PERFECT ${agg.perfect}</span>
        <span>MISS ${agg.miss}</span>
        <span>${bpm} BPM · ${bars}마디 × ${TRAIN_SESSION_SIZE}</span>
        <span>+${xp} XP · +${agg.coins + 10} 🪙</span>
      </div>
    `;
    setGiryongMood('celebrate');
    sayGiryong('perfect', `${TRAIN_SESSION_SIZE}라운드 완주!`);
    renderProfile();
    renderRank();
    renderTrainTierRow();
  } else {
    $('resultTitle').textContent = '세션 종료';
    $('resultBody').innerHTML = `
      <div class="result-score result-fail">${agg.clearedRounds}/${agg.totalRounds}</div>
      <p class="result-fail-msg">무실수 클리어 ${agg.clearedRounds}개 · MISS ${agg.miss}개. 다시 도전해서 ${TRAIN_SESSION_SIZE}개 모두 맞춰보세요!</p>
      <div class="result-grid">
        <span>PERFECT ${agg.perfect}</span>
        <span>MISS ${agg.miss}</span>
        <span>${bpm} BPM · ${bars}마디</span>
        <span>점수 ${agg.score.toLocaleString()}</span>
      </div>
    `;
    setGiryongMood(agg.clearedRounds >= TRAIN_SESSION_SIZE / 2 ? 'happy' : 'sad');
    sayGiryong('miss', `${agg.clearedRounds}/${TRAIN_SESSION_SIZE} 클리어!`);
    profile = markDailyActivity(profile, 'train');
    renderProfile();
  }
  trainSession = null;
  exitTrainSessionUI();
}

async function handleTrainRoundEnd(result, meta) {
  if (!trainSession) return;
  const tapBtn = $('trainTap');
  const startBtn = $('trainStart');

  if (trainSession.style === 'lesson' && trainSession.phase !== 'echo') {
    trainSession.phase = 'echo';
    trainSession.tapPhaseShown = false;
    tapBtn.disabled = true;
    setTrainFlashState({
      phase: '따라 치기',
      hint: '방금 같이 친 리듬을 혼자 다시 TAP하세요',
    });
    animateTrainFlashCard('train-flash-enter');
    await new Promise((resolve) => setTimeout(resolve, 900));
    if (!trainSession) return;
    await runTrainRoundPlay();
    return;
  }

  tapBtn.disabled = true;

  trainSession.results.push({
    ...result,
    exercise: meta.exercise,
    bars: meta.bars,
    cleared: result.cleared,
  });
  trainSession.sessionScore = (trainSession.sessionScore ?? 0) + result.score;
  $('trainScore').textContent = trainSession.sessionScore.toLocaleString();

  const cleared = result.cleared;
  animateTrainFlashCard(cleared ? 'train-flash-done-ok' : 'train-flash-done-miss');
  setTrainFlashState({
    phase: cleared ? '무실수 ✓' : `MISS ${result.miss}`,
    hint: cleared ? '다음 카드로 넘어갈게요!' : '다음 문제에서 다시 맞춰봐요',
    tapHint: false,
  });

  if (trainSession.index < trainSession.rounds.length - 1) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    animateTrainFlashCard('train-flash-exit');
    await new Promise((resolve) => setTimeout(resolve, 380));
    trainSession.index += 1;
    trainSession.tapPhaseShown = false;
    await runTrainRound();
    return;
  }

  startBtn.disabled = false;
  showTrainSessionResult();
}

async function runTrainRoundPlay() {
  const tapBtn = $('trainTap');
  const startBtn = $('trainStart');
  if (!trainSession) return;

  const round = trainSession.rounds[trainSession.index];
  const bpm = trainSession.bpm;
  const totalTaps = countTrainNotes(round.measures);

  $('trainProgress').textContent = `0/${totalTaps}`;
  $('trainCombo').textContent = '0';
  resetTrainScoreHighlights();
  tapBtn.disabled = false;
  startBtn.disabled = true;
  rhythmPlayer?.stop();

  trainer = new MetronomeTrainer({
    bpm,
    measures: round.measures,
    strict: false,
    binaryJudge: true,
    clickTrack: $('trainClickTrack')?.checked !== false,
    onCountIn: showTrainCountIn,
    onCursor: (state) => {
      setTrainCursor(state);
      if (trainSession && state.phase === 'play' && !trainSession.tapPhaseShown) {
        trainSession.tapPhaseShown = true;
        animateTrainFlashCard('train-flash-tap');
        setTrainFlashState({
          phase: 'TAP!',
          hint: trainSession.phase === 'echo'
          ? '방금 친 리듬을 기억해서 TAP!'
          : trainStyleCopy(trainSession.style).listenHint,
          tapHint: true,
        });
      }
    },
    onJudge: flashTrainJudge,
    onProgress: (hit, total) => {
      $('trainProgress').textContent = `${hit}/${total}`;
      $('trainCombo').textContent = trainer?.combo ?? 0;
    },
    onFail: (result) => handleTrainRoundEnd(result, {
      exercise: round.exercise,
      bars: round.bars,
      bpm,
    }),
    onEnd: (result) => handleTrainRoundEnd(result, {
      exercise: round.exercise,
      bars: round.bars,
      bpm,
    }),
  });

  await trainer.start();
}

async function runTrainRound() {
  if (!trainSession) return;
  const round = trainSession.rounds[trainSession.index];
  trainSession.phase = 'together';
  trainSession.tapPhaseShown = false;
  await presentTrainFlashCard(round);
  if (!trainSession) return;
  await runTrainRoundPlay();
}

function initTrain() {
  const bpmInput = $('trainBpm');
  const bpmVal = $('trainBpmVal');
  if (!bpmInput) return;

  bpmInput.addEventListener('input', () => {
    bpmVal.textContent = bpmInput.value;
  });
  renderTrainTierRow();
  renderTrainStyleRow();
  renderTrainPatternPicker();
  updateTrainPreview();
  if ($('trainRound')) $('trainRound').textContent = `0/${TRAIN_SESSION_SIZE}`;

  const startBtn = $('trainStart');
  const tapBtn = $('trainTap');
  const styleRow = $('trainStyleRow');
  if (styleRow) {
    styleRow.querySelectorAll('.train-style-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (trainSession) return;
        selectedTrainStyle = btn.dataset.style === 'together' ? 'together' : 'lesson';
        renderTrainStyleRow();
        renderTrainTierRow();
      });
    });
  }

  const doTrainTap = () => {
    if (trainer?.running) trainer.judgeTap();
  };

  tapBtn.addEventListener('click', doTrainTap);
  $('trainFlashCard')?.addEventListener('pointerdown', (e) => {
    if (playMode !== 'train' || !trainer?.running) return;
    e.preventDefault();
    doTrainTap();
  });
  $('trainClickTrack')?.addEventListener('change', () => {
    if (trainer) trainer.clickTrack = $('trainClickTrack').checked;
  });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || !$('panel-play').classList.contains('active')) return;
    if (playMode !== 'train' || !trainer?.running) return;
    e.preventDefault();
    doTrainTap();
  });

  startBtn.addEventListener('click', async () => {
    trainer?.stop();
    const exercise = getTrainExercise();
    const bpm = Number(bpmInput.value) || exercise.bpm || 80;

    trainSession = {
      rounds: buildTrainSession(selectedTrainTier, TRAIN_SESSION_SIZE),
      index: 0,
      results: [],
      bpm,
      sessionScore: 0,
      tapPhaseShown: false,
      style: selectedTrainStyle,
      phase: 'together',
    };

    startBtn.disabled = true;
    tapBtn.disabled = false;
    $('trainScore').textContent = '0';
    $('trainCombo').textContent = '0';
    $('trainProgress').textContent = '0/0';
    updateTrainRoundHud();
    setGiryongMood('focus');
    enterTrainSessionUI();

    await runTrainRound();
  });
}

function getRunnerExercise() {
  const preferred = TRAIN_EXERCISES.find((ex) => ex.id === 'q4')
    ?? TRAIN_EXERCISES.find((ex) => ex.measure?.length === 4);
  if (selectedLevel.id === 'beginner' && preferred) return preferred;
  const tierMap = { beginner: 1, basic: 2, intermediate: 3, advanced: 3 };
  const tier = tierMap[selectedLevel.id] ?? 1;
  const list = exercisesForTier(tier);
  const even = list.filter((ex) => {
    const groups = ex.measure ?? ex.measures?.[0] ?? [];
    return groups.length > 0 && groups.every((g) => g.t === 'n' && (g.e === 1 || g.e === 2));
  });
  const pool = even.length ? even : list;
  return pool[Math.floor(Math.random() * pool.length)] ?? TRAIN_EXERCISES[0];
}

function getRunnerStage() {
  const ex = getRunnerExercise();
  return {
    measures: buildTrainMeasures(ex, selectedLevel.id === 'beginner' ? 2 : 1),
    bpm: selectedLevel.bpm,
    title: ex.focus ?? '리듬 스테이지',
  };
}

function renderRunnerLives(lives) {
  const el = $('runnerLives');
  if (!el) return;
  el.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, RUNNER_LIVES - lives));
}

let runnerPearls = 0;

function pulseRunnerSurfer(kind = 'carve') {
  const surfer = $('runnerSurfer');
  if (!surfer) return;
  surfer.classList.remove('surf', 'carve', 'wipeout');
  void surfer.offsetWidth;
  surfer.classList.add(kind);
  setTimeout(() => surfer.classList.remove(kind), kind === 'wipeout' ? 520 : 380);
}

function spawnRunnerPearlFx() {
  const fx = $('runnerFx');
  if (!fx) return;
  const el = document.createElement('span');
  el.className = 'runner-pearl-pop';
  el.innerHTML = `<img src="${GIRYONG_IMAGES.pearlStamp}" alt=""> +1`;
  fx.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

function updateRunnerStats() {
  if (!runnerGame) return;
  const correct = runnerGame.perfect + runnerGame.great + runnerGame.good;
  $('runnerCorrect').textContent = correct;
  $('runnerWrong').textContent = runnerGame.miss;
  $('runnerAccuracy').textContent = `${runnerGame.accuracy()}%`;
  $('runnerScore').textContent = runnerGame.score.toLocaleString();
}

function flashRunnerJudge(key, pts) {
  const el = $('runnerJudgeFlash');
  if (key === 'prep') {
    el.textContent = '기본박';
    el.className = 'judge-flash show prep';
    setTimeout(() => el.classList.remove('show'), 280);
    return;
  }
  const j = JUDGE[key];
  el.textContent = key === 'miss' ? 'MISS' : `${j?.label ?? key} +${pts}`;
  el.className = `judge-flash show ${key}`;
  setTimeout(() => el.classList.remove('show'), 380);
}

function resetRunnerUI() {
  $('runnerScore').textContent = '0';
  $('runnerCorrect').textContent = '0';
  $('runnerWrong').textContent = '0';
  $('runnerAccuracy').textContent = '100%';
  runnerPearls = 0;
  $('runnerPearls').textContent = '0';
  renderRunnerLives(RUNNER_LIVES);
  $('runnerProgressBar').style.width = '0%';
  $('runnerSurfer')?.classList.remove('surf', 'carve', 'wipeout');
  $('runnerGiryong')?.classList.remove('swim', 'sink', 'dash');
  $('runnerLane')?.classList.remove('playing');
  $('runnerLaneScroll')?.style.setProperty('--run-offset', '0%');
  $('runnerFx')?.replaceChildren();
  if ($('runnerCue')) $('runnerCue').hidden = true;
  setRunnerStatus('idle', '시작을 누르면 음표가 노란 TAP선으로 옵니다');
  $('resultCard').style.display = 'none';
  $('runnerCard').style.display = 'block';
}

function showRunnerResult(result, { cleared, title, bpm }) {
  $('resultCard').style.display = 'block';
  $('resultTitle').textContent = cleared ? '서핑 완주!' : '서핑 종료';
  $('resultBody').innerHTML = `
    <div class="result-score">${result.score.toLocaleString()}</div>
    <p class="result-clear-msg">${title} · ${bpm} BPM · 정확도 ${runnerGame?.accuracy() ?? 0}%</p>
    <div class="result-grid">
      <span>PERFECT ${result.perfect}</span>
      <span>GREAT ${result.great}</span>
      <span>GOOD ${result.good}</span>
      <span>MISS ${result.miss}</span>
      <span>MAX COMBO ${result.maxCombo}</span>
      <span>진주 ${runnerPearls}개</span>
    </div>
  `;
  if (cleared) {
    const xp = Math.round(result.xp * (selectedLevel.xpMultiplier ?? 1));
    profile = addPlayResult(profile, {
      score: result.score,
      xpGained: xp,
      coinsGained: result.coins + 5,
      maxCombo: result.maxCombo,
    });
    setGiryongMood('celebrate');
    sayGiryong('perfect', '기룡이가 진주를 모았어!');
    renderProfile();
    renderRank();
  } else {
    setGiryongMood('sad');
    sayGiryong('miss', '파도 타이밍을 다시 맞춰보자!');
  }
}

function initRunner() {
  const startBtn = $('runnerStart');
  const tapBtn = $('runnerTap');
  if (!startBtn || !tapBtn) return;

  const doTap = () => {
    if (!runnerGame?.running) return;
    if (runnerGame.inCountIn) {
      flashRunnerJudge('prep', 0);
      $('runnerJudgeFlash').textContent = '기본박 — 곧 TAP!';
      return;
    }
    const key = runnerGame.judgeTap();
    if (key && key !== 'miss') {
      const j = JUDGE[key];
      const mult = 1 + Math.floor(runnerGame.combo / 8) * 0.25;
      flashRunnerJudge(key, Math.round(j.score * mult));
      pulseRunnerSurfer(key === 'perfect' ? 'surf' : 'carve');
    } else if (key === 'miss') {
      flashRunnerJudge('miss', 0);
      pulseRunnerSurfer('wipeout');
    }
    updateRunnerStats();
  };

  tapBtn.addEventListener('click', doTap);
  $('runnerStage')?.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    doTap();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || !$('panel-play').classList.contains('active')) return;
    if (playMode !== 'runner' || !runnerGame?.running) return;
    e.preventDefault();
    doTap();
  });

  startBtn.addEventListener('click', async () => {
    runnerGame?.stop();
    resetRunnerUI();
    const stage = getRunnerStage();
    const measures = stage.measures;
    const bpm = stage.bpm;

    $('runnerScorePreview').innerHTML = renderTrainScoreHtml(measures, '4/4', { idPrefix: 'runner' });
    resetTrainScoreHighlights();

    startBtn.disabled = true;
    tapBtn.disabled = false;
    setGiryongMood('focus');

    runnerGame = new RhythmRunnerGame({
      bpm,
      measures,
      onCountIn: showTrainCountIn,
      onPrep: showRunnerPrep,
      onCursor: ({ phase, progress, activePos }) => {
        setTrainCursor({ phase, progress, activePos });
        $('runnerLane')?.classList.toggle('playing', phase === 'play');
        $('runnerLane')?.classList.toggle('count-in', phase === 'count-in' || phase === 'prep');
        if (phase === 'play') {
          $('runnerProgressBar').style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
          $('runnerLaneScroll')?.style.setProperty('--run-offset', `${progress * 62}%`);
          const noteNow = $('runnerScorePreview')?.querySelector('.train-hit-slot.playhead');
          setRunnerStatus(
            'play',
            noteNow ? '지금 TAP! · 음표가 노란선에 닿았습니다' : '쉼표 · 기다렸다가 다음 음에서 TAP',
          );
        } else if (phase === 'count-in' || phase === 'ready' || phase === 'prep') {
          $('runnerLaneScroll')?.style.setProperty('--run-offset', '0%');
          $('runnerProgressBar').style.width = '0%';
        }
      },
      onJump: () => {
        pulseRunnerSurfer('surf');
      },
      onLifeChange: (lives) => renderRunnerLives(lives),
      onJudge: (key, pts, combo, hitIdx) => {
        updateRunnerStats();
        if (hitIdx != null && key !== 'miss') {
          markTrainScoreHit(hitIdx, key);
          if (key === 'perfect') {
            runnerPearls += 1;
            $('runnerPearls').textContent = runnerPearls;
            spawnRunnerPearlFx();
          }
        }
      },
      onProgress: () => updateRunnerStats(),
      onFail: (result) => {
        tapBtn.disabled = true;
        startBtn.disabled = false;
        setRunnerStatus('idle', '목숨이 끝났어요. 다시 서핑 시작해 보세요');
        showRunnerResult(result, { cleared: false, title: stage.title, bpm });
      },
      onEnd: (result) => {
        tapBtn.disabled = true;
        startBtn.disabled = false;
        setRunnerStatus('idle', '끝! 다시 하려면 서핑 시작을 누르세요');
        showRunnerResult(result, {
          cleared: (runnerGame?.lives ?? 0) > 0,
          title: stage.title,
          bpm,
        });
      },
    });

    await runnerGame.start();
  });

  $('playAgain').addEventListener('click', handlePlayAgain);
}

function isPlacementMode() {
  return playMode === 'placement';
}

function handlePlayAgain() {
  $('resultCard').style.display = 'none';
  $('resultTitle').textContent = '결과';
  $('resultActions').innerHTML = '<button id="playAgain" class="primary">다시 하기</button>';
  $('playAgain').addEventListener('click', handlePlayAgain);
  if (playMode === 'runner') {
    $('runnerCard').style.display = 'block';
    $('runnerStart').disabled = false;
    $('runnerTap').disabled = true;
    resetRunnerUI();
    previewRunnerIdle();
  } else if (playMode === 'train') {
    trainSession = null;
    trainer?.stop();
    exitTrainSessionUI();
    $('trainCard').style.display = 'block';
    $('trainStart').disabled = false;
    $('trainTap').disabled = true;
    $('trainScore').textContent = '0';
    $('trainCombo').textContent = '0';
    if ($('trainRound')) $('trainRound').textContent = `0/${TRAIN_SESSION_SIZE}`;
    renderTrainTierRow();
    renderTrainStyleRow();
    renderTrainPatternPicker();
    updateTrainPreview();
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

  $('lessonListen').addEventListener('click', () => replayLessonAudio(false));
  $('lessonListenSlow').addEventListener('click', () => replayLessonAudio(true));
  $('lessonMetronome')?.addEventListener('click', () => playLessonBasicBeat(false));
  $('lessonTapBtn')?.addEventListener('click', () => {
    if (quizState?.echoPhase !== 'tap' || !lessonTrainer?.running) return;
    lessonTrainer.judgeTap();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    if ($('lessonOverlay')?.hidden) return;
    const q = quizState?.questions[quizState.index];
    if (q?.type !== 'echo' || quizState.echoPhase !== 'tap' || !lessonTrainer?.running) return;
    e.preventDefault();
    lessonTrainer.judgeTap();
  });
  $('lessonCheckBtn').addEventListener('click', submitLessonAnswer);
  $('lessonBackBtn')?.addEventListener('click', goBackLesson);
  $('lessonContinueBtn').addEventListener('click', continueLesson);

  $('lessonCompleteBtn').addEventListener('click', () => {
    hideLessonComplete();
    if (profile.placement && playMode === 'placement') {
      setPlayMode('learn');
    }
  });

  $('quizStart').addEventListener('click', () => {
    startLesson(playMode === 'placement' ? 'placement' : 'quiz');
  });

  $('learnPracticeBtn')?.addEventListener('click', () => {
    const unit = getUnit(selectedQuizUnitId);
    if (unit?.level === 'beginner') selectedTrainTier = 1;
    else if (unit?.level === 'basic') selectedTrainTier = 2;
    else selectedTrainTier = 3;
    const first = patternsForUnit(selectedQuizUnitId).find((p) => p.measure || p.measures);
    if (first) selectedTrainExerciseId = first.id;
    profile = markDailyActivity(profile, 'learn');
    renderProfile();
    setPlayMode('train');
  });
  $('learnQuizBtn')?.addEventListener('click', () => {
    profile = markDailyActivity(profile, 'learn');
    renderProfile();
    setPlayMode('quiz');
  });
  $('learnGameBtn')?.addEventListener('click', () => {
    profile = markDailyActivity(profile, 'learn');
    renderProfile();
    setPlayMode('runner');
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
  `).join('') || '<div class="empty-msg">아직 연습 기록이 없습니다. 오늘 배울 것부터 시작해 보세요!</div>';

  const myIdx = board.findIndex((r) => r.isPlayer);
  $('myRankStats').innerHTML = `
    <div class="stat-box"><div class="val">${myIdx >= 0 ? myIdx + 1 : '-'}</div><div class="lbl">내 순위</div></div>
    <div class="stat-box"><div class="val">${profile.bestScore.toLocaleString()}</div><div class="lbl">최고 점수</div></div>
    <div class="stat-box"><div class="val">${profile.totalPlays}</div><div class="lbl">총 연습</div></div>
  `;
}

function renderMyRank() {
  if ($('panel-rank').classList.contains('active')) renderRank();
}

function renderCurriculum() {
  $('curriculumList').innerHTML = CURRICULUM_UNITS.map((u) => `
    <div class="curriculum-item">
      <div class="curriculum-week">${u.order}단원</div>
      <div>
        <strong>${u.title}</strong>
        <p>${u.subtitle}</p>
        <p class="curriculum-learn">${u.learn}</p>
        <p class="curriculum-skills">${u.skills.join(' · ')}</p>
        <span class="tag">${u.bpm} BPM · ${u.meter}</span>
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
  initRunner();
  initTrain();
  initLesson();
  renderQuizUnitList();
  renderLearnCard();
  renderCurriculum();
  renderRank();
  sayGiryong(
    profile.placement ? 'welcome' : 'placementStart',
    profile.placement ? undefined : '처음이면 레벨을 찾아도 되고, 1과부터 바로 시작해도 돼!',
  );
}

init();
