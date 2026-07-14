/** 청음 퀴즈 — 커리큘럼 기반 */

import { buildFillQuestion } from './fill-quiz.js';
import { renderPatternGridHtml, renderGroupsGridHtml, listenAnswerInOptions } from './rhythm-display.js';
import { groupsKey } from './rhythm-groups.js';
import {
  listenPatternsForLevel,
  patternsForUnit,
  playPatternForEntry,
  playTimelineForEntry,
  getUnit,
} from './rhythm-curriculum.js';
import {
  patternToNotation,
  patternBeats,
  patternKey,
  isValidListenPattern,
  QUIZ_LEVELS,
  QUIZ_ROUND_SIZE,
  QUIZ_SCORE,
} from './rhythm-notation.js';

export { QUIZ_LEVELS, QUIZ_ROUND_SIZE, QUIZ_SCORE } from './rhythm-notation.js';
export { patternBeats, patternKey, isValidListenPattern } from './rhythm-notation.js';

export function getPatternsForLevel(levelId) {
  return listenPatternsForLevel(levelId).map(curriculumToListenEntry);
}

function entryKey(p) {
  if (p.pattern) return patternKey(p.pattern);
  if (p.measure) return groupsKey(p.measure);
  return p.id;
}

function curriculumToListenEntry(p) {
  return {
    level: p.level,
    pattern: p.pattern ?? null,
    measure: p.measure,
    groupsKey: p.measure ? groupsKey(p.measure) : null,
    title: p.focus,
    unitId: p.unitId,
    curriculumId: p.id,
    bpm: p.bpm,
    meter: p.meter,
    timeline: playTimelineForEntry(p),
    curriculumRef: p,
  };
}

export function getMeterLabel(pattern) {
  const beats = patternBeats(pattern);
  if (beats === 4) return '4/4 · 1마디 (4박)';
  if (beats === 8) return '4/4 · 2마디 (8박)';
  return `4/4 · ${beats / 4}마디 (${beats}박)`;
}

function getPatternsWithSameBeats(beats, excludeKey, levelId) {
  return listenPatternsForLevel(levelId)
    .filter((p) => isValidListenPattern(p.pattern)
      && patternBeats(p.pattern) === beats
      && patternKey(p.pattern) !== excludeKey)
    .map(curriculumToListenEntry);
}

function pickListenDistractors(correct, levelId, unitId = null) {
  const correctKey = entryKey(correct);
  const beats = correct.pattern ? patternBeats(correct.pattern) : null;

  let pool = (unitId
    ? patternsForUnit(unitId).filter((p) => p.pattern || p.measure).map(curriculumToListenEntry)
    : getPatternsForLevel(levelId)
  ).filter((p) => entryKey(p) !== correctKey);

  if (beats != null) {
    pool = pool.filter((p) => p.pattern && patternBeats(p.pattern) === beats);
  }

  if (pool.length < 3) {
    const extra = listenPatternsForLevel(levelId)
      .map((p) => curriculumToListenEntry(p))
      .filter((p) => entryKey(p) !== correctKey && !pool.some((x) => entryKey(x) === entryKey(p)));
    pool = [...pool, ...extra];
  }

  const seenKeys = new Set([correctKey]);
  const picked = [];
  for (const p of pool.sort(() => Math.random() - 0.5)) {
    if (picked.length >= 3) break;
    const key = entryKey(p);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    picked.push(p);
  }
  return picked;
}

function renderListenOptionGrid(p) {
  if (p.measure) return renderGroupsGridHtml(p.measure, p.meter ?? '4/4');
  return renderPatternGridHtml(p.pattern, p.meter ?? '4/4');
}

export function buildListenQuestion(levelId, patternOverride = null, unitId = null) {
  let pool = unitId
    ? patternsForUnit(unitId).filter((p) => p.pattern || p.measure).map(curriculumToListenEntry)
    : getPatternsForLevel(levelId);

  if (!pool.length) {
    throw new Error(`청음 패턴 없음: ${levelId}${unitId ? `/${unitId}` : ''}`);
  }

  const correct = patternOverride ?? pool[Math.floor(Math.random() * pool.length)];
  const correctKey = entryKey(correct);
  const distractors = pickListenDistractors(correct, levelId, unitId);

  let fi = 0;
  const fallback = listenPatternsForLevel(levelId).map(curriculumToListenEntry);
  while (distractors.length < 3 && fi < fallback.length) {
    const extra = fallback[fi];
    fi += 1;
    if (distractors.some((d) => entryKey(d) === entryKey(extra))) continue;
    if (entryKey(extra) === correctKey) continue;
    distractors.push(extra);
  }

  if (distractors.length < 3) {
    throw new Error(`보기 부족 (${distractors.length + 1}개): ${correctKey}`);
  }

  const unit = getUnit(correct.unitId ?? unitId);
  const beats = correct.pattern ? patternBeats(correct.pattern) : 4;
  const options = [correct, ...distractors.slice(0, 3)]
    .map((p, i) => ({
      id: String.fromCharCode(65 + i),
      notation: p.pattern ? patternToNotation(p.pattern) : '리듬 악보',
      pattern: p.pattern ? [...p.pattern] : null,
      groupsKey: p.groupsKey,
      measure: p.measure,
      title: p.title,
      gridHtml: renderListenOptionGrid(p),
    }))
    .sort(() => Math.random() - 0.5);

  const answerOption = options.find((o) => (
    correct.pattern
      ? o.pattern && patternKey(o.pattern) === patternKey(correct.pattern)
      : o.groupsKey === correct.groupsKey
  ));
  if (!answerOption) throw new Error(`퀴즈 정답 누락: ${correctKey}`);

  const question = {
    type: 'listen',
    levelId,
    unitId: correct.unitId ?? unitId,
    unitTitle: unit?.title,
    bpm: correct.bpm ?? 88,
    bars: beats / 4,
    meterLabel: correct.pattern ? getMeterLabel(correct.pattern) : `${correct.meter ?? '4/4'} · 1마디`,
    correctPattern: playPatternForEntry(correct.curriculumRef ?? correct),
    playTimeline: correct.timeline,
    correctNotation: correct.pattern ? patternToNotation(correct.pattern) : '악보 패턴',
    options,
    answerId: answerOption.id,
    focus: correct.title,
  };

  return question;
}

export function buildQuizQuestion(levelId, patternOverride = null, questionType = null) {
  const type = questionType ?? (Math.random() < 0.5 ? 'listen' : 'fill');
  if (type === 'fill') {
    try {
      return buildFillQuestion(levelId);
    } catch {
      return buildListenQuestion(levelId, patternOverride);
    }
  }
  return buildListenQuestion(levelId, patternOverride);
}
