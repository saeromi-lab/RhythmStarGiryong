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
  addQuizResult,
  savePlacementResult,
  saveTrainClear,
  resetDailyIfNeeded,
  getLeaderboard,
  profileSummary,
} from './storage.js';
import { RhythmGame } from './game.js';
import {
  QUIZ_LEVELS,
  QUIZ_ROUND_SIZE,
  QUIZ_SCORE,
} from './quiz-data.js';
import { buildQuizRound, buildUnitQuizRound } from './quiz-round.js';
import { CURRICULUM_UNITS, unitsForLevel } from './rhythm-curriculum.js';
import { QUIZ_TYPE_LABELS } from './quiz-extra.js';
import {
  PLACEMENT_SIZE,
  PLACEMENT_REWARD,
  buildPlacementRound,
  evaluatePlacement,
} from './placement-test.js';
import { RhythmPlayer } from './rhythm-player.js';
import { MetronomeTrainer } from './metronome-trainer.js';
import { RhythmRunnerGame, RUNNER_LIVES } from './runner-game.js';
import {
  emptyGrid,
  gridToMeasure,
  encodeShareCode,
  decodeShareCode,
} from './rhythm-throw.js';
import {
  TRAIN_TIERS,
  TRAIN_EXERCISES,
  exercisesForTier,
  buildTrainMeasures,
  countTrainNotes,
} from './train-data.js';
import { renderPatternGridHtml, renderTrainScoreHtml, renderPatternPickerHtml } from './rhythm-display.js';

const TIER_LABELS = {
  beginner: '입문',
  basic: '기초',
  intermediate: '심화',
};

let profile = null;
let game = null;
let runnerGame = null;
let trainer = null;
let rhythmPlayer = null;
let selectedLevel = LEVELS[1];
let selectedTrainExerciseId = TRAIN_EXERCISES[0]?.id ?? 'u1-even8-q4';
let selectedTrainTier = 1;
let selectedQuizLevel = QUIZ_LEVELS[0];
let selectedQuizUnitId = 'u1-even8';
let playMode = 'runner';
let quizState = null;
let lessonSelectedId = null;
let selectedPath = 'placement';
let throwGrid = emptyGrid();
let throwBpm = 88;
let pendingThrowChallenge = null;

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
    { done: profile.dailyArcade, label: '비트 서핑 1회', reward: '20 XP' },
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
  $('runnerCard').style.display = mode === 'runner' ? 'block' : 'none';
  $('throwCard').style.display = mode === 'throw' ? 'block' : 'none';
  $('arcadeCard').style.display = 'none';
  $('trainCard').style.display = mode === 'train' ? 'block' : 'none';
  $('quizCard').style.display = mode === 'quiz' || mode === 'placement' ? 'block' : 'none';
  $('levelSelectCard').style.display = (mode === 'placement' || mode === 'train' || mode === 'throw') ? 'none' : 'block';
  $('resultCard').style.display = 'none';
  game?.stop();
  runnerGame?.stop();
  trainer?.stop();
  rhythmPlayer?.stop();
  if (mode === 'quiz' || mode === 'placement') {
    quizState = null;
    $('quizStart').style.display = 'block';
  }
  renderLevels();
  if (mode === 'train') {
    renderTrainTierRow();
    renderTrainPatternPicker();
  }
  if (mode === 'quiz') renderQuizUnitList();
  if (mode === 'throw') renderThrowMaker();
  updateTrainPreview();
  updateQuizModeUI();
}

function updateQuizModeUI() {
  const isPlacement = playMode === 'placement';
  const hint = $('quizHint');
  if (hint) {
    hint.textContent = isPlacement
      ? '청음·박자표·칸세기 등 10문제 레벨 테스트'
      : '단원을 고르고 5문제 집중 훈련 (청음·빈칸·박자표·칸세기·다른리듬)';
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
    });
  });
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
  const qType = q.type ?? 'listen';
  lessonSelectedId = null;
  quizState.answered = false;
  $('lessonCheckBtn').disabled = true;
  $('lessonFeedback').hidden = true;

  const meterText = q.meterLabel ?? (q.bars >= 2 ? '4/4 · 2마디 (8박)' : '4/4 · 1마디 (4박)');
  const typeLabel = QUIZ_TYPE_LABELS[qType] ?? '퀴즈';
  const measureEl = $('lessonMeasure');
  const audioRow = $('lessonAudioRow');
  const metroBtn = $('lessonMetronome');

  const instructions = {
    listen: '🔊로 듣고, 같은 리듬 칸을 고르세요',
    fill: '위 마디의 빈칸(□)에 들어갈 리듬을 고르세요',
    meter: '이 마디의 박자표는 무엇일까요?',
    count: '8분음표 칸은 모두 몇 칸일까요?',
    odd: '🔊 A→B→C→D 순서로 듣고, 다른 리듬 1개를 고르세요',
  };

  $('lessonInstruction').textContent = instructions[qType] ?? '정답을 고르세요';
  if (metroBtn) {
    metroBtn.hidden = !['listen', 'odd', 'fill', 'count', 'meter'].includes(qType);
    metroBtn.title = (q.bars ?? 1) >= 2 ? '기본박 8박' : '기본박 4박';
  }

  if (qType === 'fill') {
    measureEl.hidden = false;
    measureEl.innerHTML = q.measureHtml;
    audioRow.hidden = false;
    $('lessonListen').setAttribute('aria-label', '전체 마디 듣기 (힌트)');
  } else if (qType === 'odd') {
    measureEl.hidden = false;
    measureEl.innerHTML = '<p class="lesson-measure-hint">악보 없이 귀로만! 3개는 같고 1개만 달라요 · 🔊로 전체 또는 각 보기를 들어보세요</p>';
    audioRow.hidden = false;
    $('lessonListen').setAttribute('aria-label', 'A부터 D까지 순서대로 듣기');
    $('lessonListenSlow').setAttribute('aria-label', '느리게 순서대로 듣기');
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
    $('lessonSub').textContent = `${TIER_LABELS[q.levelId]} · ${typeLabel} · ${meterText} · ${quizState.index + 1}/${quizState.questions.length}`;
  } else {
    const unitPart = q.unitTitle ? `${q.unitTitle} · ` : '';
    $('lessonSub').textContent = `${unitPart}${typeLabel} · ${meterText} · ${q.bpm} BPM · ${quizState.index + 1}/${quizState.questions.length}`;
  }

  $('lessonOptions').innerHTML = q.options.map((opt) => {
    if (qType === 'odd') {
      return `
        <div class="odd-option-row">
          <button type="button" class="odd-play-mini" data-play-id="${opt.id}" aria-label="${opt.label} 리듬 듣기">🔊</button>
          <button type="button" class="duo-choice duo-choice-text odd-select" data-id="${opt.id}">${opt.label}</button>
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
  const bars = q.bars ?? 1;
  await rhythmPlayer.playBasicBeats(q.bpm, { bars, slow });
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
    if (opt.timeline?.length) {
      await rhythmPlayer.playTimeline(opt.timeline, q.bpm, { slow, countdown: false });
    } else {
      await rhythmPlayer.playPattern(opt.pattern, q.bpm, { slow, countdown: false });
    }
    await new Promise((resolve) => setTimeout(resolve, gapMs));
  }

  $('lessonOptions').querySelectorAll('.odd-select').forEach((btn) => {
    btn.classList.remove('odd-playing');
  });
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

  if (q.type === 'listen') {
    await playLessonBasicBeat(slow);
    await new Promise((resolve) => setTimeout(resolve, 320));
  }

  if (q.playTimeline?.length) {
    await rhythmPlayer.playTimeline(q.playTimeline, q.bpm, { slow, countdown: false });
  } else {
    await rhythmPlayer.playPattern(q.correctPattern, q.bpm, { slow, countdown: false });
  }
  if (quizState?.questions[quizState.index] === q && !quizState.answered) {
    await setLessonAudioBusy(false);
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
    : `정답: ${q.answerId} · ${q.options.find((o) => o.id === q.answerId)?.label ?? q.options.find((o) => o.id === q.answerId)?.notation ?? q.correctNotation}`;
  updateLessonProgress();
}

async function goBackLesson() {
  if (!quizState || quizState.index === 0 || quizState.answered) return;
  $('lessonFeedback').hidden = true;
  rhythmPlayer?.stop();
  quizState.index -= 1;
  if (isPlacementMode()) {
    quizState.answers = quizState.answers.slice(0, quizState.index);
  }
  renderLessonQuestion();
  updateLessonProgress();
  const q = quizState.questions[quizState.index];
  if (q.type === 'listen' || q.type === 'odd') await playLessonAudio();
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
  const q = quizState.questions[quizState.index];
  if (q.type === 'listen' || q.type === 'odd') await playLessonAudio();
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
  };
  setGiryongMood('focus');
  openLessonOverlay();
  renderLessonQuestion();
  const q = quizState.questions[0];
  if (q.type === 'listen' || q.type === 'odd') await playLessonAudio();
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

function getTrainBars() {
  return TRAIN_TIERS.find((t) => t.id === selectedTrainTier)?.bars ?? 1;
}

function getTrainExercise() {
  return TRAIN_EXERCISES.find((ex) => ex.id === selectedTrainExerciseId) ?? TRAIN_EXERCISES[0];
}

function getTrainMaxTier() {
  return profile?.trainMaxTier ?? 1;
}

function resetTrainScoreHighlights() {
  const cursor = $('trainCursor');
  if (cursor) {
    cursor.style.left = '0%';
    cursor.classList.remove('active', 'count-in');
  }
  $('trainPatternPreview')?.querySelectorAll('[data-pos]').forEach((el) => {
    el.classList.remove('playhead', 'active', 'hit', 'miss');
  });
}

function getScorePreviewRoots() {
  return [$('runnerScorePreview'), $('trainPatternPreview')].filter((el) => el?.innerHTML?.trim());
}

function setTrainCursor({ phase, progress, activePos }) {
  const isRunner = playMode === 'runner';
  const cursor = isRunner
    ? $('runnerScorePreview')?.querySelector('#trainCursor')
    : $('trainCursor');
  const track = isRunner
    ? $('runnerScorePreview')?.querySelector('#trainScoreTrack')
    : $('trainScoreTrack');
  if (cursor) {
    if (!isRunner) {
      const pct = phase === 'play'
        ? Math.max(0, Math.min(100, progress * 100))
        : 0;
      cursor.style.left = `${pct}%`;
    }
    cursor.classList.toggle('active', phase === 'play');
    cursor.classList.toggle('count-in', phase === 'count-in');
    cursor.hidden = phase !== 'play';
  }
  if (track) {
    track.classList.toggle('train-count-in', phase === 'count-in');
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
  el.textContent = `예비박 ${beat} / ${total}`;
  el.className = 'judge-flash show';
  setTimeout(() => el.classList.remove('show'), 200);
}

function showRunnerPrep(beat, total) {
  const el = $('runnerJudgeFlash');
  if (!el) return;
  el.textContent = `준비 ${beat} / ${total} — 곧 시작!`;
  el.className = 'judge-flash show prep';
  setTimeout(() => el.classList.remove('show'), 280);
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
  $('trainScore').textContent = (trainer?.score ?? 0).toLocaleString();
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

function lockedTierHint(maxTier, current) {
  if (current.id <= maxTier) {
    return `${current.label} — 예비박 4번 후 커서가 지나갈 때 TAP! (PERFECT / MISS)`;
  }
  return '이전 단계를 무실수로 클리어하면 해제됩니다';
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

function showTrainResult(result, { exercise, bars, bpm, failed }) {
  $('trainCard').style.display = 'none';
  $('resultCard').style.display = 'block';
  if (failed || !result.cleared) {
    $('resultTitle').textContent = '훈련 실패';
    $('resultBody').innerHTML = `
      <div class="result-score result-fail">MISS</div>
      <p class="result-fail-msg">한 번이라도 빗나가면 처음부터예요. 악보 표시를 보며 박자에 맞춰 다시!</p>
      <div class="result-grid">
        <span>${bpm} BPM · ${bars}마디</span>
        <span>PERFECT ${result.perfect}</span>
        <span>MISS ${result.miss}</span>
      </div>
    `;
    setGiryongMood('sad');
    sayGiryong('miss', '다시 천천히 맞춰봐요!');
    return;
  }

  const xp = Math.round(result.xp * 1.2);
  profile = addPlayResult(profile, {
    score: result.score,
    xpGained: xp,
    coinsGained: result.coins + 5,
    maxCombo: result.maxCombo,
  });
  profile = saveTrainClear(profile, {
    exerciseId: exercise.id,
    bars,
    tier: selectedTrainTier,
  });

  $('resultTitle').textContent = '무실수 클리어!';
  $('resultBody').innerHTML = `
    <div class="result-score">${result.score.toLocaleString()}</div>
    <p class="result-clear-msg">처음부터 끝까지 MISS 없이 완주했어요!</p>
    <div class="result-grid">
      <span>PERFECT ${result.perfect}</span>
      <span>GREAT ${result.great}</span>
      <span>GOOD ${result.good}</span>
      <span>${bpm} BPM · ${bars}마디</span>
      <span>+${xp} XP · +${result.coins + 5} 🪙</span>
    </div>
  `;
  setGiryongMood('celebrate');
  sayGiryong('perfect', `무실수 클리어 ${result.score}점!`);
  renderProfile();
  renderRank();
  renderTrainTierRow();
}

function initTrain() {
  const bpmInput = $('trainBpm');
  const bpmVal = $('trainBpmVal');
  if (!bpmInput) return;

  bpmInput.addEventListener('input', () => {
    bpmVal.textContent = bpmInput.value;
  });
  renderTrainTierRow();
  renderTrainPatternPicker();
  updateTrainPreview();

  const startBtn = $('trainStart');
  const tapBtn = $('trainTap');

  const doTrainTap = () => {
    if (trainer?.running) trainer.judgeTap();
  };

  tapBtn.addEventListener('click', doTrainTap);

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || !$('panel-play').classList.contains('active')) return;
    if (playMode !== 'train' || !trainer?.running) return;
    e.preventDefault();
    doTrainTap();
  });

  startBtn.addEventListener('click', async () => {
    trainer?.stop();
    const exercise = getTrainExercise();
    const bars = getTrainBars();
    const measures = buildTrainMeasures(exercise, bars);
    const bpm = Number(bpmInput.value) || exercise.bpm || 80;
    const totalTaps = countTrainNotes(measures);

    startBtn.disabled = true;
    tapBtn.disabled = false;
    $('trainScore').textContent = '0';
    $('trainCombo').textContent = '0';
    $('trainProgress').textContent = `0/${totalTaps}`;
    resetTrainScoreHighlights();
    setGiryongMood('focus');

    trainer = new MetronomeTrainer({
      bpm,
      measures,
      strict: true,
      binaryJudge: true,
      onCountIn: showTrainCountIn,
      onCursor: setTrainCursor,
      onNote: (idx) => setTrainScoreActive(idx),
      onJudge: flashTrainJudge,
      onProgress: (hit, total) => {
        $('trainProgress').textContent = `${hit}/${total}`;
        $('trainCombo').textContent = trainer?.combo ?? 0;
      },
      onFail: (result) => {
        tapBtn.disabled = true;
        startBtn.disabled = false;
        showTrainResult(result, { exercise, bars, bpm, failed: true });
      },
      onEnd: (result) => {
        tapBtn.disabled = true;
        startBtn.disabled = false;
        showTrainResult(result, { exercise, bars, bpm, failed: false });
      },
    });

    await trainer.start();
  });
}

function getRunnerExercise() {
  const tierMap = { beginner: 1, basic: 2, intermediate: 3, advanced: 3 };
  const tier = tierMap[selectedLevel.id] ?? 1;
  const list = exercisesForTier(tier);
  return list[Math.floor(Math.random() * list.length)] ?? TRAIN_EXERCISES[0];
}

function getRunnerStage() {
  if (pendingThrowChallenge) {
    return {
      measures: [pendingThrowChallenge.measure],
      bpm: pendingThrowChallenge.bpm,
      title: '파티시에 케이크 도전!',
    };
  }
  const ex = getRunnerExercise();
  return {
    measures: buildTrainMeasures(ex, 1),
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
  const g = $('runnerGiryong');
  if (!fx || !g) return;
  const el = document.createElement('span');
  el.className = 'runner-pearl-pop';
  el.innerHTML = '<img src="/images/giryong/pearl-stamp.png" alt=""> +1';
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
  $('resultCard').style.display = 'none';
  $('runnerCard').style.display = 'block';
}

function showRunnerResult(result, { cleared, title, bpm }) {
  $('runnerCard').style.display = 'none';
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
  pendingThrowChallenge = null;
}

function initRunner() {
  const startBtn = $('runnerStart');
  const tapBtn = $('runnerTap');

  const doTap = () => {
    if (!runnerGame?.running) return;
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
    const totalTaps = countTrainNotes(measures);

    $('runnerScorePreview').innerHTML = renderTrainScoreHtml(measures);
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
        if (phase === 'play') {
          $('runnerProgressBar').style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
          $('runnerLaneScroll')?.style.setProperty('--run-offset', `${progress * 62}%`);
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
        showRunnerResult(result, { cleared: false, title: stage.title, bpm });
      },
      onEnd: (result) => {
        tapBtn.disabled = true;
        startBtn.disabled = false;
        showRunnerResult(result, {
          cleared: true,
          title: stage.title,
          bpm,
        });
      },
    });

    await runnerGame.start();
  });
}

function renderThrowMaker() {
  const grid = $('throwGrid');
  if (!grid) return;
  grid.innerHTML = throwGrid.map((on, i) => `
    <button type="button" class="throw-cell ${on ? 'on baked' : ''}" data-i="${i}" aria-label="${i + 1}번 재료 칸">
      ${on ? '♪' : '·'}
    </button>
  `).join('');
  grid.querySelectorAll('.throw-cell').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      throwGrid[i] = throwGrid[i] ? 0 : 1;
      renderThrowMaker();
    });
  });
  const measure = gridToMeasure(throwGrid);
  $('throwPreview').innerHTML = renderTrainScoreHtml([measure]);
  $('throwBpmVal').textContent = throwBpm;
  const code = encodeShareCode(throwBpm, throwGrid);
  $('throwCodeOut').value = code;
  $('throwChallenge').disabled = measure.every((g) => g.t === 'r');
}

function initThrow() {
  const bpmInput = $('throwBpm');
  bpmInput?.addEventListener('input', () => {
    throwBpm = Number(bpmInput.value) || 88;
    renderThrowMaker();
  });

  $('throwGenerate')?.addEventListener('click', () => {
    renderThrowMaker();
    const code = $('throwCodeOut').value;
    $('throwJudgeFlash').textContent = `굽기 완료! 케이크 코드: ${code}`;
    $('throwJudgeFlash').className = 'judge-flash show perfect';
    setTimeout(() => $('throwJudgeFlash').classList.remove('show'), 2000);
    $('throwChallenge').disabled = false;
    sayGiryong('perfect', '리듬 케이크 완성! 코드를 나눠줘!');
  });

  $('throwLoad')?.addEventListener('click', () => {
    const raw = $('throwCodeIn').value.trim();
    const decoded = decodeShareCode(raw);
    if (!decoded) {
      $('throwJudgeFlash').textContent = '코드 형식: RSG88-11110000';
      $('throwJudgeFlash').className = 'judge-flash show miss';
      setTimeout(() => $('throwJudgeFlash').classList.remove('show'), 1500);
      return;
    }
    throwGrid = decoded.grid;
    throwBpm = decoded.bpm;
    bpmInput.value = throwBpm;
    renderThrowMaker();
    $('throwChallenge').disabled = false;
  });

  $('throwChallenge')?.addEventListener('click', () => {
    const measure = gridToMeasure(throwGrid);
    pendingThrowChallenge = { measure, bpm: throwBpm, grid: [...throwGrid] };
    setPlayMode('runner');
    sayGiryong('excited', '파티시에 케이크! 서핑 시작을 눌러 맛보자!');
  });

  renderThrowMaker();
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
  if (playMode === 'runner') {
    $('runnerCard').style.display = 'block';
    $('runnerStart').disabled = false;
    $('runnerTap').disabled = true;
    resetRunnerUI();
  } else if (playMode === 'throw') {
    $('throwCard').style.display = 'block';
  } else if (playMode === 'arcade') {
    $('arcadeCard').style.display = 'block';
    $('gameScore').textContent = '0';
    $('gameCombo').textContent = '0';
    $('gameBeat').textContent = `0/${selectedLevel.noteCount}`;
    $('gameStart').disabled = false;
    $('gameTap').disabled = true;
  } else if (playMode === 'train') {
    $('trainCard').style.display = 'block';
    $('trainStart').disabled = false;
    $('trainTap').disabled = true;
    $('trainScore').textContent = '0';
    $('trainCombo').textContent = '0';
    renderTrainTierRow();
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

  $('lessonListen').addEventListener('click', () => playLessonAudio(false));
  $('lessonListenSlow').addEventListener('click', () => playLessonAudio(true));
  $('lessonMetronome')?.addEventListener('click', () => playLessonBasicBeat(false));
  $('lessonCheckBtn').addEventListener('click', submitLessonAnswer);
  $('lessonBackBtn')?.addEventListener('click', goBackLesson);
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
  $('curriculumList').innerHTML = CURRICULUM_UNITS.map((u) => `
    <div class="curriculum-item">
      <div class="curriculum-week">${u.order}단원</div>
      <div>
        <strong>${u.title}</strong>
        <p>${u.subtitle}</p>
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
  initThrow();
  initGame();
  initTrain();
  initLesson();
  renderQuizUnitList();
  renderCurriculum();
  renderRank();
  sayGiryong(profile.placement ? 'welcome' : 'placementStart', profile.placement ? undefined : '처음이면 레벨 테스트부터 해볼까?');
}

init();
