import {
  JUMP_STEPS,
  STAR_MOVES,
  PHASES,
  STORAGE_KEY,
  WEEK_KEY,
  getPhaseForWeek,
} from './data.js';
import { Metronome } from './metronome.js';
import { TrainingSession, formatTime } from './session.js';

let currentWeek = Number(localStorage.getItem(WEEK_KEY)) || 1;
let metronome = null;
let session = null;

function $(id) {
  return document.getElementById(id);
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(entry) {
  const list = loadHistory();
  list.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
}

function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`panel-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function renderWeekSelect() {
  const select = $('weekSelect');
  select.innerHTML = '';
  for (let w = 1; w <= 12; w += 1) {
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = `${w}주차`;
    if (w === currentWeek) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', (e) => {
    currentWeek = Number(e.target.value);
    localStorage.setItem(WEEK_KEY, String(currentWeek));
    renderProgram();
    syncBpmFromWeek();
    $('starMoveCard').style.display = currentWeek >= 5 ? 'block' : 'none';
  });
}

function renderProgram() {
  const phase = getPhaseForWeek(currentWeek);
  $('phaseInfo').innerHTML = `
    <strong>${phase.name}단계 · ${currentWeek}주차</strong><br>
    ${phase.content}<br>
    BPM <strong>${phase.bpm}</strong> · HRR <strong>${phase.hrr}%</strong> · 패턴 <strong>${phase.pattern}</strong>
  `;

  $('phaseTable').innerHTML = PHASES.map((p) => {
    const active = p.id === phase.id ? 'active' : '';
    const weeks = `${p.weeks[0]}~${p.weeks[p.weeks.length - 1]}주`;
    return `
      <div class="phase-row ${active}">
        <span>${p.name}</span>
        <span class="muted">${weeks}</span>
        <span>${p.content}</span>
        <span>${p.bpm}</span>
        <span class="muted">${p.hrr}%</span>
      </div>
    `;
  }).join('');
}

function renderSteps() {
  $('stepsList').innerHTML = JUMP_STEPS.map((s) => `
    <div class="step-card">
      <div class="num">STEP ${s.id}</div>
      <div class="en">${s.en}</div>
      <div class="ko">${s.ko}</div>
    </div>
  `).join('');

  $('starMovesGuide').innerHTML = STAR_MOVES.map((m) => `
    <div class="step-card">
      <div class="num">${m.weeks}</div>
      <div class="en">${m.name}</div>
    </div>
  `).join('');
}

function renderStarMoves() {
  $('starMoveList').innerHTML = STAR_MOVES.map((m) => `
    <span class="star-badge">${m.name}</span>
  `).join('');
}

function renderStepProgress(stepIndex) {
  $('stepProgress').innerHTML = JUMP_STEPS.map((s, i) => {
    let cls = 'step-chip';
    if (i === stepIndex % 10) cls += ' active';
    else if (i < stepIndex % 10) cls += ' done';
    return `<span class="${cls}">${s.id}</span>`;
  }).join('');
}

function syncBpmFromWeek() {
  const bpm = getPhaseForWeek(currentWeek).bpm;
  $('bpmSlider').value = bpm;
  $('bpmDisplay').textContent = bpm;
  if (metronome) metronome.setBpm(bpm);
}

function initMetronome() {
  metronome = new Metronome({
    onBeat: (beatInBar) => {
      const dots = document.querySelectorAll('.beat-dot');
      dots.forEach((d, i) => d.classList.toggle('active', i === beatInBar));
    },
  });

  const slider = $('bpmSlider');
  const display = $('bpmDisplay');

  const setBpm = (val) => {
    metronome.setBpm(val);
    slider.value = metronome.bpm;
    display.textContent = metronome.bpm;
  };

  slider.addEventListener('input', (e) => setBpm(e.target.value));
  $('bpmDown').addEventListener('click', () => setBpm(metronome.bpm - 5));
  $('bpmUp').addEventListener('click', () => setBpm(metronome.bpm + 5));

  $('metronomeToggle').addEventListener('click', async () => {
    const running = await metronome.toggle();
    $('metronomeToggle').textContent = running ? '정지' : '시작';
    $('metronomeToggle').classList.toggle('primary', !running);
  });
}

function updateSessionUI(state) {
  if (!state) return;
  $('sessionPhase').textContent = state.sessionPhase?.label ?? '대기';
  $('sessionTimer').textContent = formatTime(state.remainingSec ?? 0);
  $('currentStepName').textContent = state.step
    ? `${state.step.id}. ${state.step.ko}`
    : '—';
  renderStepProgress(state.stepIndex ?? 0);
  $('starMoveCard').style.display = state.showStarMove ? 'block' : 'none';

  if (state.running && metronome && !metronome.running) {
    metronome.setBpm(state.bpm);
    syncBpmFromWeek();
    metronome.start();
    $('metronomeToggle').textContent = '정지';
  }
}

function initSession() {
  $('sessionStart').addEventListener('click', async () => {
    if (!session || (!session.running && session.phaseIndex === 0 && session.elapsedSec === 0)) {
      session = new TrainingSession({
        week: currentWeek,
        onUpdate: updateSessionUI,
        onComplete: (state) => {
          metronome?.stop();
          $('metronomeToggle').textContent = '시작';
          $('metronomeToggle').classList.add('primary');
          $('sessionStart').disabled = false;
          $('sessionPause').disabled = true;
          $('sessionStop').disabled = true;

          saveHistory({
            date: new Date().toISOString(),
            week: currentWeek,
            phase: state.programPhase.name,
            duration: '45:00',
          });
          renderHistory();
        },
      });
    }
    session.start();
    $('sessionStart').disabled = true;
    $('sessionPause').disabled = false;
    $('sessionStop').disabled = false;
    await metronome?.ensureAudio();
    metronome?.setBpm(session.bpm);
    syncBpmFromWeek();
    metronome?.start();
    $('metronomeToggle').textContent = '정지';
  });

  $('sessionPause').addEventListener('click', () => {
    session?.pause();
    metronome?.stop();
    $('sessionStart').disabled = false;
    $('sessionPause').disabled = true;
    $('metronomeToggle').textContent = '시작';
    $('metronomeToggle').classList.add('primary');
  });

  $('sessionStop').addEventListener('click', () => {
    session?.reset();
    metronome?.stop();
    $('sessionPhase').textContent = '대기';
    $('sessionTimer').textContent = '00:00';
    $('currentStepName').textContent = '—';
    renderStepProgress(0);
    $('sessionStart').disabled = false;
    $('sessionPause').disabled = true;
    $('sessionStop').disabled = true;
    $('metronomeToggle').textContent = '시작';
    $('metronomeToggle').classList.add('primary');
  });
}

function renderHistory() {
  const list = loadHistory();
  const container = $('historyList');
  const stats = $('historyStats');

  if (!list.length) {
    container.innerHTML = '<div class="empty-msg">아직 훈련 기록이 없습니다.</div>';
    stats.innerHTML = '';
    return;
  }

  container.innerHTML = list.map((h) => {
    const d = new Date(h.date);
    return `
      <div class="history-item">
        <strong>${d.toLocaleDateString('ko-KR')} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</strong><br>
        ${h.week}주차 · ${h.phase}단계 · ${h.duration}
      </div>
    `;
  }).join('');

  const weeks = new Set(list.map((h) => h.week));
  stats.innerHTML = `
    <div class="stat-box"><div class="val">${list.length}</div><div class="lbl">총 세션</div></div>
    <div class="stat-box"><div class="val">${weeks.size}</div><div class="lbl">진행 주차</div></div>
    <div class="stat-box"><div class="val">${currentWeek}</div><div class="lbl">현재 주차</div></div>
  `;
}

function initHistory() {
  $('clearHistory').addEventListener('click', () => {
    if (confirm('모든 훈련 기록을 삭제할까요?')) {
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
    }
  });
}

function init() {
  initTabs();
  renderWeekSelect();
  renderProgram();
  renderSteps();
  renderStarMoves();
  renderStepProgress(0);
  renderHistory();
  initMetronome();
  initSession();
  initHistory();
  syncBpmFromWeek();
  $('starMoveCard').style.display = currentWeek >= 5 ? 'block' : 'none';
}

init();
