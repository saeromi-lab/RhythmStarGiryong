/** 8분음표 그룹 DSL — 음표·쉼표 공통 표현 */

export const N = (eighths) => ({ t: 'n', e: eighths });
export const R = (eighths) => ({ t: 'r', e: eighths });

export function measureSum(groups) {
  return groups.reduce((s, g) => s + g.e, 0);
}

export function groupsToSlots(groups) {
  return groups.map((g) => (g.t === 'n' ? g.e : -g.e));
}

export function groupsToPlayPattern(groups) {
  const out = [];
  for (const g of groups) {
    if (g.t === 'n') out.push(g.e * 0.5);
  }
  return out;
}

/** 청음용: 쉼표 포함 전체 타임라인 (음표만 클릭, 쉼표는 무음) */
export function groupsToTimeline(groups) {
  return groups.map((g) => ({
    kind: g.t,
    beats: g.e * 0.5,
  }));
}

export function groupsKey(groups) {
  return groups.map((g) => `${g.t}${g.e}`).join('|');
}

export function slotsToGroups(slots) {
  return slots.map((s) => (s > 0 ? N(s) : R(-s)));
}

export function validateMeasure(groups, eighthsPerBar = 8) {
  return measureSum(groups) === eighthsPerBar;
}
