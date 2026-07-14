/** 패턴·슬롯을 화면용 8분음표 칸 그리드로 변환 */

import { slotGroupSymbol, METERS } from './fill-quiz.js';

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

function expandSlotsToGrid(slots, totalCells) {
  const grid = Array(totalCells).fill(null);
  let pos = 0;
  for (const len of slots) {
    for (let i = 0; i < len; i += 1) {
      if (pos >= totalCells) break;
      grid[pos] = {
        type: i === 0 ? 'note' : 'tie',
        symbol: i === 0 ? slotGroupSymbol(len) : '',
      };
      pos += 1;
    }
  }
  return grid;
}

function renderCells(grid, { blankFrom = -1, blankLen = 0 } = {}) {
  return grid.map((cell, i) => {
    const inBlank = blankFrom >= 0 && i >= blankFrom && i < blankFrom + blankLen;
    if (inBlank) {
      return '<span class="measure-slot blank">□</span>';
    }
    if (!cell || cell.type === 'tie') {
      return '<span class="measure-slot tie"></span>';
    }
    return `<span class="measure-slot filled">${cell.symbol}</span>`;
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
    const grid = expandSlotsToGrid(slots, slotsPerBar);
    return `
      <div class="rhythm-grid-wrap">
        <div class="measure-sig">${meter.shortLabel}</div>
        <div class="measure-slots" style="--slots:${slotsPerBar}">${renderCells(grid, opts)}</div>
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
    const grid = expandSlotsToGrid(barSlots, slotsPerBar);
    const blankFrom = opts.blankFrom ?? -1;
    const blankLen = opts.blankLen ?? 0;
    const barStart = b * slotsPerBar;
    const localBlankFrom = blankFrom >= barStart && blankFrom < barStart + slotsPerBar
      ? blankFrom - barStart
      : -1;
    barHtml.push(`
      <div class="measure-slots measure-slots-bar" style="--slots:${slotsPerBar}">
        ${renderCells(grid, localBlankFrom >= 0 ? { blankFrom: localBlankFrom, blankLen } : {})}
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

/** 2마디 연습 악보 (메트로놈 훈련용) */
export function renderTrainScoreHtml(pattern, bars = 2, meterId = '4/4') {
  const meter = METERS[meterId] ?? METERS['4/4'];
  const slots = patternToSlots(pattern);
  let hitIdx = 0;
  const barsHtml = [];

  for (let b = 0; b < bars; b += 1) {
    const cells = [];
    let pos = 0;
    for (const len of slots) {
      for (let i = 0; i < len; i += 1) {
        if (i === 0) {
          cells.push(
            `<span class="measure-slot filled train-hit-slot" data-hit="${hitIdx}">${slotGroupSymbol(len)}</span>`,
          );
          hitIdx += 1;
        } else {
          cells.push('<span class="measure-slot tie"></span>');
        }
        pos += 1;
      }
    }
    while (pos < meter.eighthsPerBar) {
      cells.push('<span class="measure-slot tie"></span>');
      pos += 1;
    }
    barsHtml.push(`
      <div class="train-score-bar">
        <span class="train-bar-num">${b + 1}마디</span>
        <div class="measure-slots" style="--slots:${meter.eighthsPerBar}">${cells.join('')}</div>
      </div>
    `);
  }

  return `
    <div class="train-score-card" id="trainScoreCard">
      <div class="train-score-label">연습 악보 · ${meter.shortLabel} · ${bars}마디</div>
      <div class="train-score-body">
        <div class="measure-sig train-score-sig">${meter.shortLabel}</div>
        <div class="train-score-bars">${barsHtml.join('')}</div>
      </div>
      <p class="train-score-hint">아래 악보 리듬에 맞춰 메트로놈 박자로 TAP! 하세요</p>
    </div>
  `;
}

/** 패턴 선택용 미리보기 (1마디) */
export function renderPatternPickerHtml(pattern, meterId = '4/4') {
  return renderPatternGridHtml(pattern, meterId);
}

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
  const grid = expandSlotsToGrid(slots, meter.eighthsPerBar);
  return `
    <div class="rhythm-grid-wrap">
      <div class="measure-sig">${meter.shortLabel}</div>
      <div class="measure-slots" style="--slots:${meter.eighthsPerBar}">${renderCells(grid)}</div>
    </div>
  `;
}
