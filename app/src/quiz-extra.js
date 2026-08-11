/** 추가 퀴즈 유형: 박자표·칸 세기·다른 리듬 찾기 */

import { QUIZ_LEVELS, patternKey, patternBeats } from './rhythm-notation.js';
import {
  fillPatternsForLevel,
  patternsForUnit,
  listenPatternsForLevel,
  playPatternForEntry,
  playTimelineForEntry,
  getUnit,
  slotSumValid,
  fillSlotsNoteOnly,
} from './rhythm-curriculum.js';
import {
  slotSum,
  slotsToPlayPattern,
  slotsToNotation,
  slotsKey,
  formatQuizMeterLabel,
  getQuizMeterConfig,
} from './fill-quiz.js';
import { renderPatternGridHtml, renderSlotsGridHtml, renderGroupsGridHtml } from './rhythm-display.js';
import { patternToSlots } from './rhythm-display.js';

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

function poolForUnit(levelId, unitId) {
  if (unitId) return patternsForUnit(unitId);
  return listenPatternsForLevel(levelId);
}

export function buildMeterQuestion(levelId, unitId = null) {
  const fillPool = unitId
    ? patternsForUnit(unitId).filter((p) => p.slots && p.slots.every((s) => s > 0))
    : fillPatternsForLevel(levelId);

  if (!fillPool.length) {
    throw new Error('박자표 문제용 패턴 없음');
  }

  const source = fillPool[Math.floor(Math.random() * fillPool.length)];
  const meter = source.meter;
  const slots = fillSlotsNoteOnly(source.slots);
  const unit = getUnit(source.unitId ?? unitId);

  const correct = { value: meter, label: METER_OPTIONS.find((m) => m.id === meter)?.label };
  const distractors = METER_OPTIONS.filter((m) => m.id !== meter).map((m) => ({
    value: m.id,
    label: m.label,
  }));

  const options = pickOptions(correct, distractors, (o) => o.label);
  const answerOption = options.find((o) => o.value === meter);

  return {
    type: 'meter',
    levelId,
    unitId: source.unitId ?? unitId,
    unitTitle: unit?.title,
    bpm: source.bpm,
    meter,
    meterLabel: formatQuizMeterLabel(meter, 1),
    bars: 1,
    measureHtml: renderSlotsGridHtml(slots, meter),
    correctPattern: slotsToPlayPattern(slots),
    playTimeline: playTimelineForEntry(source),
    options,
    answerId: answerOption.id,
    focus: source.focus,
  };
}

export function buildCountQuestion(levelId, unitId = null) {
  const unitPool = poolForUnit(levelId, unitId);
  const withSlots = unitPool.filter((p) => p.slots && slotSumValid(p));
  const withPattern = unitPool.filter((p) => p.pattern);

  let slotCount;
  let measureHtml;
  let playPattern;
  let meterId = '4/4';
  let focus;
  let bpm = QUIZ_LEVELS.find((l) => l.id === levelId)?.bpm ?? 88;
  let unitTitle;
  let unitIdResolved = unitId;
  let source;

  if (withSlots.length && (withPattern.length === 0 || Math.random() < 0.6)) {
    source = withSlots[Math.floor(Math.random() * withSlots.length)];
    const slots = fillSlotsNoteOnly(source.slots);
    slotCount = slotSum(slots);
    meterId = source.meter;
    focus = source.focus;
    bpm = source.bpm;
    unitTitle = getUnit(source.unitId)?.title;
    unitIdResolved = source.unitId ?? unitId;
    measureHtml = source.measure
      ? renderGroupsGridHtml(source.measure, meterId)
      : renderSlotsGridHtml(slots, meterId);
    playPattern = slotsToPlayPattern(slots);
  } else if (withPattern.length) {
    source = withPattern[Math.floor(Math.random() * withPattern.length)];
    slotCount = patternToSlots(source.pattern).reduce((s, d) => s + d, 0);
    focus = source.focus;
    bpm = source.bpm;
    meterId = source.meter ?? '4/4';
    unitTitle = getUnit(source.unitId)?.title;
    unitIdResolved = source.unitId ?? unitId;
    measureHtml = source.measure
      ? renderGroupsGridHtml(source.measure, meterId)
      : renderPatternGridHtml(source.pattern, meterId);
    playPattern = playPatternForEntry(source);
  } else {
    throw new Error('칸세기 문제용 패턴 없음');
  }

  const correct = { value: slotCount, label: `${slotCount}칸` };
  const candidates = [slotCount - 2, slotCount - 1, slotCount + 1, slotCount + 2]
    .filter((n) => n > 0 && n !== slotCount && n <= 16);
  const distractors = [...new Set(candidates)].map((n) => ({
    value: n,
    label: `${n}칸`,
  }));

  const options = pickOptions(correct, distractors, (o) => o.label);
  const answerOption = options.find((o) => o.value === slotCount);

  return {
    type: 'count',
    levelId,
    unitId: unitIdResolved,
    unitTitle,
    bpm,
    meter: meterId,
    meterLabel: formatQuizMeterLabel(meterId, 1),
    bars: 1,
    measureHtml,
    correctPattern: playPattern,
    playTimeline: playTimelineForEntry(source),
    options,
    answerId: answerOption.id,
    focus,
  };
}

export function buildOddQuestion(levelId, unitId = null) {
  const pool = poolForUnit(levelId, unitId).filter((p) => p.pattern || p.slots);
  if (pool.length < 2) throw new Error('다른리듬 문제용 패턴 부족');

  const a = pool[Math.floor(Math.random() * pool.length)];
  let b = pool[Math.floor(Math.random() * pool.length)];
  let guard = 0;
  while (guard < 20 && samePattern(a, b)) {
    b = pool[Math.floor(Math.random() * pool.length)];
    guard += 1;
  }
  if (samePattern(a, b)) throw new Error('다른리듬 쌍을 찾지 못함');

  const commonPattern = playPatternForEntry(a);
  const oddPattern = playPatternForEntry(b);
  const commonTimeline = playTimelineForEntry(a);
  const oddTimeline = playTimelineForEntry(b);

  const sameCount = 2 + Math.floor(Math.random() * 2);
  const raw = [
    ...Array(sameCount).fill({ pattern: commonPattern, timeline: commonTimeline, isOdd: false }),
    { pattern: oddPattern, timeline: oddTimeline, isOdd: true },
  ].sort(() => Math.random() - 0.5);

  const options = raw.map((item, i) => ({
    id: String.fromCharCode(65 + i),
    label: String.fromCharCode(65 + i),
    pattern: [...item.pattern],
    timeline: item.timeline,
    isOdd: item.isOdd,
  }));

  const answerOption = options.find((o) => o.isOdd);
  const unit = getUnit(unitId ?? a.unitId);
  const level = QUIZ_LEVELS.find((l) => l.id === levelId);

  return {
    type: 'odd',
    levelId,
    unitId: unitId ?? a.unitId,
    unitTitle: unit?.title,
    bpm: a.bpm ?? level.bpm,
    meter: a.meter ?? '4/4',
    meterLabel: '청음 · 다른 리듬 1개 찾기',
    bars: 1,
    measureHtml: '',
    options,
    answerId: answerOption.id,
    focus: '3번 같고 1번 다름 — 귀로만 구분',
  };
}

function samePattern(a, b) {
  if (a.pattern && b.pattern) return patternKey(a.pattern) === patternKey(b.pattern);
  if (a.slots && b.slots) return slotsKey(fillSlotsNoteOnly(a.slots)) === slotsKey(fillSlotsNoteOnly(b.slots));
  return false;
}

export function buildExtraQuestion(type, levelId, unitId = null) {
  if (type === 'meter') return buildMeterQuestion(levelId, unitId);
  if (type === 'count') return buildCountQuestion(levelId, unitId);
  if (type === 'odd') return buildOddQuestion(levelId, unitId);
  throw new Error(`알 수 없는 유형: ${type}`);
}
