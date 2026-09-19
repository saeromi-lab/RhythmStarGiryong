/** 패턴·슬롯을 화면용 8분음표 칸 그리드로 변환 */

import { slotGroupSymbol, METERS } from './fill-quiz.js';

function restGroupSymbol(eighths) {
  if (eighths >= 4) return '𝄻';
  if (eighths === 2) return '𝄽';
  return '𝄾';
}

function renderGroupCell(group, { hitIdx, posIdx, compact = false } = {}) {
  const sym = group.t === 'n' ? slotGroupSymbol(group.e) : restGroupSymbol(group.e);
  const cls = [
    'measure-slot',
    group.t === 'n' ? 'filled' : 'rest',
    group.t === 'n' ? 'train-hit-slot' : 'train-rest-slot',
    compact ? 'compact' : '',
  ].filter(Boolean).join(' ');
  const hitAttr = group.t === 'n' ? ` data-hit="${hitIdx}"` : '';
  return `<span class="${cls}" style="flex:${group.e}" data-pos="${posIdx}"${hitAttr}>${sym}</span>`;
}

function renderMeasureGroups(groups, meter, { compact = false, startHit = 0, startPos = 0 } = {}) {
  let hitIdx = startHit;
  let posIdx = startPos;
  const cells = [];

  for (const group of groups) {
    cells.push(renderGroupCell(group, {
      hitIdx: group.t === 'n' ? hitIdx : null,
      posIdx,
      compact,
    }));
    if (group.t === 'n') hitIdx += 1;
    posIdx += 1;
  }

  return { html: cells.join(''), nextHit: hitIdx, nextPos: posIdx };
}

function patternBeats(pattern) {
  return pattern.reduce((s, d) => s + d, 0);
}

/** 4분박 단위 패턴 → 8분음표 칸 수 배열 (1칸=8분음표) */
export function patternToSlots(pattern) {
  return pattern.map((d) => Math.round(d * 2));
}

export function slotsForPattern(pattern) {
  return patternToSlots(pattern);
}

function renderSlotParts(slots, { blankFrom = -1, blankLen = 0 } = {}) {
  let pos = 0;
  const parts = [];
  for (const raw of slots) {
    const len = Math.abs(raw);
    const rest = raw < 0;
    const inBlank = blankFrom >= 0 && pos >= blankFrom && pos < blankFrom + blankLen;
    if (inBlank) {
      const prev = parts[parts.length - 1];
      if (prev?.kind === 'blank') prev.span += len;
      else parts.push({ kind: 'blank', span: len });
    } else if (rest) {
      parts.push({ kind: 'rest', span: len, symbol: restGroupSymbol(len) });
    } else {
      parts.push({ kind: 'note', span: len, symbol: slotGroupSymbol(len) });
    }
    pos += len;
  }
  return parts.map((part) => {
    if (part.kind === 'blank') {
      return `<span class="measure-slot blank" style="flex:${part.span}">□</span>`;
    }
    const cls = part.kind === 'rest' ? 'rest' : 'filled';
    return `<span class="measure-slot ${cls}" style="flex:${part.span}">${part.symbol}</span>`;
  }).join('');
}

/** 청음 보기·마디 표시용 그리드 HTML */
export function renderPatternGridHtml(pattern, meterId = '4/4', opts = {}) {
  const slots = patternToSlots(pattern);
  const beats = patternBeats(pattern);
  const meter = METERS[meterId] ?? METERS['4/4'];
  const slotsPerBar = meter.eighthsPerBar;
  const bars = Math.max(1, Math.round(beats / 4));

  if (bars === 1) {
    return `
      <div class="rhythm-grid-wrap">
        <div class="measure-sig">${meter.shortLabel}</div>
        <div class="measure-slots" style="--slots:${slotsPerBar}">${renderSlotParts(slots, opts)}</div>
      </div>
    `;
  }

  const barHtml = [];
  let offset = 0;
  for (let b = 0; b < bars; b += 1) {
    let barSum = 0;
    const barSlots = [];
    while (offset < slots.length && barSum < 4 - 0.001) {
      barSlots.push(slots[offset]);
      barSum += slots[offset] * 0.5;
      offset += 1;
    }
    const blankFrom = opts.blankFrom ?? -1;
    const blankLen = opts.blankLen ?? 0;
    const barStart = b * slotsPerBar;
    const localBlankFrom = blankFrom >= barStart && blankFrom < barStart + slotsPerBar
      ? blankFrom - barStart
      : -1;
    barHtml.push(`
      <div class="measure-slots measure-slots-bar" style="--slots:${slotsPerBar}">
        ${renderSlotParts(barSlots, localBlankFrom >= 0 ? { blankFrom: localBlankFrom, blankLen } : {})}
      </div>
    `);
  }

  return `
    <div class="rhythm-grid-wrap rhythm-grid-multi">
      <div class="measure-sig">${meter.shortLabel}</div>
      <div class="rhythm-grid-bars">${barHtml.join('')}</div>
    </div>
  `;
}

/** N마디 연습 악보 (메트로놈 훈련용) — measures: 그룹 배열의 배열 */
export function renderTrainScoreHtml(measures, meterId = '4/4', { idPrefix = 'train' } = {}) {
  const meter = METERS[meterId] ?? METERS['4/4'];
  const bars = measures.length;
  let hitIdx = 0;
  let posIdx = 0;
  const barsHtml = [];

  for (let b = 0; b < bars; b += 1) {
    const rendered = renderMeasureGroups(measures[b], meter, { startHit: hitIdx, startPos: posIdx });
    hitIdx = rendered.nextHit;
    posIdx = rendered.nextPos;
    barsHtml.push(`
      <div class="train-score-bar">
        <span class="train-bar-num">${b + 1}마디</span>
        <div class="measure-slots" style="--slots:${meter.eighthsPerBar}">${rendered.html}</div>
      </div>
    `);
  }

  return `
    <div class="train-score-card" id="${idPrefix}ScoreCard">
      <div class="train-score-label">연습 악보 · ${meter.shortLabel} · ${bars}마디</div>
      <div class="train-score-body">
        <div class="measure-sig train-score-sig">${meter.shortLabel}</div>
        <div class="train-score-track" id="${idPrefix}ScoreTrack">
          <div class="train-cursor" id="${idPrefix}Cursor" aria-hidden="true"></div>
          <div class="train-score-bars">${barsHtml.join('')}</div>
        </div>
      </div>
      <div class="train-score-hint">♩ 4분음표 · ♪ 8분음표 · 폭이 길수록 음이 길어요</div>
    </div>
  `;
}

/** 패턴 선택용 미리보기 (1마디) */
export function renderPatternPickerHtml(measure, meterId = '4/4') {
  if (Array.isArray(measure) && measure[0]?.t) {
    return renderGroupsGridHtml(measure, meterId, { compact: true });
  }
  const meter = METERS[meterId] ?? METERS['4/4'];
  const rendered = renderMeasureGroups(measure, meter, { compact: true });
  return `
    <div class="rhythm-grid-wrap rhythm-grid-option">
      <div class="measure-sig">${meter.shortLabel}</div>
      <div class="measure-slots measure-slots-compact" style="--slots:${meter.eighthsPerBar}">${rendered.html}</div>
    </div>
  `;
}

/** 그룹(음표·쉼표) N마디 그리드 */
export function renderMeasuresGridHtml(measures, meterId = '4/4', { compact = false } = {}) {
  const meter = METERS[meterId] ?? METERS['4/4'];
  const barsHtml = measures.map((m) => {
    const rendered = renderMeasureGroups(m, meter, { compact });
    return `
      <div class="measure-slots ${compact ? 'measure-slots-compact measure-slots-bar' : 'measure-slots-bar'}" style="--slots:${meter.eighthsPerBar}">
        ${rendered.html}
      </div>
    `;
  }).join('');

  return `
    <div class="rhythm-grid-wrap rhythm-grid-multi ${compact ? 'rhythm-grid-option' : ''}">
      <div class="measure-sig">${meter.shortLabel}</div>
      <div class="rhythm-grid-bars">${barsHtml}</div>
    </div>
  `;
}

/** 그룹(음표·쉼표) 1마디 그리드 */
export function renderGroupsGridHtml(groups, meterId = '4/4', { compact = false } = {}) {
  const meter = METERS[meterId] ?? METERS['4/4'];
  const rendered = renderMeasureGroups(groups, meter, { compact });
  return `
    <div class="rhythm-grid-wrap ${compact ? 'rhythm-grid-option' : ''}">
      <div class="measure-sig">${meter.shortLabel}</div>
      <div class="measure-slots ${compact ? 'measure-slots-compact' : ''}" style="--slots:${meter.eighthsPerBar}">${rendered.html}</div>
    </div>
  `;
}

/** 패턴 선택용 미리보기 (1마디) — 레거시 */
export function renderPatternPickerFromPattern(pattern, meterId = '4/4') {
  return renderPatternGridHtml(pattern, meterId);
}

/** @deprecated pattern 배열용 — 호환 */
export function renderTrainScoreFromPattern(pattern, bars = 2, meterId = '4/4') {
  const slots = patternToSlots(pattern);
  const measure = slots.map((e) => ({ t: 'n', e }));
  const measures = Array.from({ length: bars }, () => measure);
  return renderTrainScoreHtml(measures, meterId);
}

/** 청음 정답이 보기에 포함됐는지 */
export function listenAnswerInOptions(question) {
  if (question.type !== 'listen') return true;
  const key = question.correctPattern.join(',');
  return question.options.some(
    (o) => o.pattern.join(',') === key && o.id === question.answerId,
  );
}

/** 슬롯 배열(8분 칸) 그리드 */
export function renderSlotsGridHtml(slots, meterId = '4/4') {
  const meter = METERS[meterId] ?? METERS['4/4'];
  return `
    <div class="rhythm-grid-wrap">
      <div class="measure-sig">${meter.shortLabel}</div>
      <div class="measure-slots" style="--slots:${meter.eighthsPerBar}">${renderSlotParts(slots)}</div>
    </div>
  `;
}

/** 박자표 맞히기 — 정답(4/4·6/8)과 칸 수가 보이지 않게 음표만 표시 */
export function renderMeterGuessHtml(slots) {
  const notes = slots.map((len) => (
    `<span class="meter-guess-note">${slotGroupSymbol(len)}</span>`
  )).join('');
  return `
    <div class="meter-guess">
      <span class="meter-guess-sig" aria-hidden="true">?</span>
      <div class="meter-guess-notes">${notes}</div>
    </div>
    <p class="lesson-measure-hint">박자표는 가렸어요. 음표 묶음과 소리를 듣고 고르세요.</p>
  `;
}
