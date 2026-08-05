/** 리듬 파티시에 — 리듬 조합·굽기·코드 공유·도전 */

import { N, R, groupsToPlayPattern } from './rhythm-groups.js';

const CODE_PREFIX = 'RSG';

/** 8칸 그리드(0/1) → 그룹 배열 */
export function gridToMeasure(grid) {
  const groups = [];
  let i = 0;
  while (i < grid.length) {
    if (!grid[i]) {
      let restLen = 0;
      while (i < grid.length && !grid[i]) {
        restLen += 1;
        i += 1;
      }
      if (restLen) groups.push(R(restLen));
    } else {
      let noteLen = 0;
      while (i < grid.length && grid[i]) {
        noteLen += 1;
        i += 1;
      }
      groups.push(N(noteLen));
    }
  }
  return groups;
}

export function measureToGrid(measure) {
  const grid = Array(8).fill(0);
  let pos = 0;
  for (const g of measure) {
    const len = g.e;
    for (let j = 0; j < len && pos < 8; j += 1) {
      grid[pos] = g.t === 'n' ? 1 : 0;
      pos += 1;
    }
  }
  return grid;
}

/** 공유 코드: RSG88-11110000 (BPM + 8칸) */
export function encodeShareCode(bpm, grid) {
  const g = grid.map((v) => (v ? '1' : '0')).join('');
  return `${CODE_PREFIX}${bpm}-${g}`;
}

export function decodeShareCode(raw) {
  const code = raw.trim().toUpperCase();
  const m = code.match(/^RSG(\d{2,3})-([01]{8})$/);
  if (!m) return null;
  const bpm = Number(m[1]);
  const grid = m[2].split('').map((c) => c === '1');
  const measure = gridToMeasure(grid);
  if (measure.reduce((s, g) => s + g.e, 0) !== 8) return null;
  return {
    bpm,
    grid,
    measure,
    pattern: groupsToPlayPattern(measure),
  };
}

export function emptyGrid() {
  return [1, 0, 1, 0, 1, 0, 1, 0];
}

export function randomShareCode(bpm, grid) {
  return encodeShareCode(bpm, grid);
}
