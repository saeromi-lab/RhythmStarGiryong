/** 추가 퀴즈 유형: 박자표·칸 세기·다른 리듬 찾기 */

import { QUIZ_PATTERNS, QUIZ_LEVELS, patternKey, patternBeats } from './quiz-data.js';
import {
  FILL_PATTERNS,
  METERS,
  getFillPatternsForLevel,
  slotSum,
  slotsToPlayPattern,
  slotsKey,
} from './fill-quiz.js';
import { renderPatternGridHtml, patternToSlots, renderSlotsGridHtml } from './rhythm-display.js';

function patternsForLevel(levelId) {
  return QUIZ_PATTERNS.filter((p) => {
    const b = patternBeats(p.pattern);
    return p.level === levelId && (b === 4 || b === 8);
  });
}

export const QUIZ_TYPE_LABELS = {
  listen: '청음',
  fill: '마디 채우기',
  meter: '박자표 맞추기',
  count: '칸 수 세기',
  odd: '다른 리듬 찾기',
};

const METER_OPTIONS = [
  { id: '4/4', label: '4분의 4박자 (4/4)' },
  { id: '6/8', label: '8분의 6박자 (6/8)' },
  { id: '3/4', label: '3분의 4박자 (3/4)' },
];

function pickOptions(correct, pool, labelFn) {
  const picked = [correct];
  const seen = new Set([correct.value]);
  for (const item of pool.sort(() => Math.random() - 0.5)) {
    if (picked.length >= 4) break;
    if (seen.has(item.value)) continue;
    seen.add(item.value);
    picked.push(item);
  }
  return picked
    .map((item, i) => ({
      id: String.fromCharCode(65 + i),
      label: labelFn(item),
      value: item.value,
    }))
    .sort(() => Math.random() - 0.5);
}

export function buildMeterQuestion(levelId) {
  const pool = getFillPatternsForLevel(levelId);
  const source = pool[Math.floor(Math.random() * pool.length)];
  const meter = METERS[source.meter];
  const level = QUIZ_LEVELS.find((l) => l.id === levelId);

  const correct = { value: source.meter, label: METER_OPTIONS.find((m) => m.id === source.meter)?.label };
  const distractors = METER_OPTIONS.filter((m) => m.id !== source.meter).map((m) => ({
    value: m.id,
    label: m.label,
  }));

  const options = pickOptions(correct, distractors, (o) => o.label);
  const answerOption = options.find((o) => o.value === source.meter);

  return {
    type: 'meter',
    levelId,
    bpm: meter.bpm,
    meterLabel: `${meter.label} · 1마디`,
    bars: 1,
    measureHtml: renderSlotsGridHtml(source.slots, source.meter),
    correctPattern: slotsToPlayPattern(source.slots),
    options,
    answerId: answerOption.id,
    hint: source.title,
  };
}

export function buildCountQuestion(levelId) {
  const useSlots = Math.random() < 0.5;
  let slotCount;
  let measureHtml;
  let playPattern;
  let meterId = '4/4';
  let title;

  if (useSlots) {
    const pool = getFillPatternsForLevel(levelId);
    const source = pool[Math.floor(Math.random() * pool.length)];
    slotCount = slotSum(source.slots);
    meterId = source.meter;
    title = source.title;
    measureHtml = renderSlotsGridHtml(source.slots, source.meter);
    playPattern = slotsToPlayPattern(source.slots);
  } else {
    const pool = patternsForLevel(levelId).filter((p) => patternKey(p.pattern).split(',').length <= 8);
    const source = pool[Math.floor(Math.random() * pool.length)] ?? patternsForLevel(levelId)[0];
    slotCount = patternToSlots(source.pattern).reduce((s, d) => s + d, 0);
    title = source.title;
    measureHtml = renderPatternGridHtml(source.pattern, '4/4');
    playPattern = source.pattern;
  }

  const meter = METERS[meterId] ?? METERS['4/4'];
  const level = QUIZ_LEVELS.find((l) => l.id === levelId);
  const correct = { value: slotCount, label: `${slotCount}칸` };

  const candidates = [slotCount - 2, slotCount - 1, slotCount + 1, slotCount + 2, 6, 8, 10, 12]
    .filter((n) => n > 0 && n !== slotCount);
  const distractors = [...new Set(candidates)].slice(0, 6).map((n) => ({
    value: n,
    label: `${n}칸`,
  }));

  const options = pickOptions(correct, distractors, (o) => o.label);
  const answerOption = options.find((o) => o.value === slotCount);

  return {
    type: 'count',
    levelId,
    bpm: level.bpm,
    meterLabel: `${meter.label} · 8분음표 칸 세기`,
    bars: 1,
    measureHtml,
    correctPattern: playPattern,
    options,
    answerId: answerOption.id,
    hint: title,
  };
}

export function buildOddQuestion(levelId) {
  const slotPool = getFillPatternsForLevel(levelId);
  const listenPool = patternsForLevel(levelId);

  let correctGrid;
  let oddGrid;

  if (slotPool.length >= 2 && Math.random() < 0.6) {
    const a = slotPool[Math.floor(Math.random() * slotPool.length)];
    let b = slotPool[Math.floor(Math.random() * slotPool.length)];
    while (slotSum(b.slots) === slotSum(a.slots) && slotsKey(b.slots) === slotsKey(a.slots)) {
      b = slotPool[Math.floor(Math.random() * slotPool.length)];
    }
    correctGrid = { html: renderSlotsGridHtml(a.slots, a.meter) };
    oddGrid = { html: renderSlotsGridHtml(b.slots, b.meter) };
  } else {
    const a = listenPool[Math.floor(Math.random() * listenPool.length)];
    let b = listenPool[Math.floor(Math.random() * listenPool.length)];
    while (patternKey(b.pattern) === patternKey(a.pattern)) {
      b = listenPool[Math.floor(Math.random() * listenPool.length)];
    }
    correctGrid = { pattern: a.pattern, html: renderPatternGridHtml(a.pattern, '4/4') };
    oddGrid = { pattern: b.pattern, html: renderPatternGridHtml(b.pattern, '4/4') };
  }

  const sameCount = 2 + Math.floor(Math.random() * 2);
  const grids = Array(sameCount).fill(correctGrid.html);
  grids.push(oddGrid.html);
  grids.sort(() => Math.random() - 0.5);

  const options = grids.map((html, i) => ({
    id: String.fromCharCode(65 + i),
    gridHtml: html,
    isOdd: html === oddGrid.html,
  }));

  const answerOption = options.find((o) => o.isOdd);
  const level = QUIZ_LEVELS.find((l) => l.id === levelId);

  return {
    type: 'odd',
    levelId,
    bpm: level.bpm,
    meterLabel: '4/4 · 다른 패턴 1개 찾기',
    bars: 1,
    measureHtml: '',
    options,
    answerId: answerOption.id,
    hint: '3개는 같고 1개만 달라요',
  };
}

export function buildExtraQuestion(type, levelId) {
  if (type === 'meter') return buildMeterQuestion(levelId);
  if (type === 'count') return buildCountQuestion(levelId);
  if (type === 'odd') return buildOddQuestion(levelId);
  throw new Error(`알 수 없는 유형: ${type}`);
}
