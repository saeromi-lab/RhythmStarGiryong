/** 8분음표 칸(슬롯) 단위 마디 빈칸 채우기 퀴즈 */

export const METERS = {
  '4/4': {
    id: '4/4',
    label: '4분의 4박자',
    shortLabel: '4/4',
    eighthsPerBar: 8,
    bpm: 88,
  },
  '6/8': {
    id: '6/8',
    label: '8분의 6박자',
    shortLabel: '6/8',
    eighthsPerBar: 6,
    bpm: 96,
  },
};

/** 슬롯 값 = 8분음표 칸 수. [2,2,2,2]=4분 4개, [4,4]=2분 2개 */
export const FILL_PATTERNS = [
  // 4/4 — 8칸(= 4박)
  { level: 'beginner', meter: '4/4', slots: [2, 2, 2, 2], title: '4분음표 4개' },
  { level: 'beginner', meter: '4/4', slots: [1, 1, 1, 1, 1, 1, 1, 1], title: '8분음표 8개' },
  { level: 'beginner', meter: '4/4', slots: [2, 2, 1, 1, 1, 1], title: '4분 2개 + 8분 4개' },
  { level: 'beginner', meter: '4/4', slots: [1, 1, 1, 1, 2, 2], title: '8분 4개 + 4분 2개' },
  { level: 'beginner', meter: '4/4', slots: [4, 4], title: '2분음표 2개' },

  { level: 'basic', meter: '4/4', slots: [3, 1, 2, 2], title: '점4분 + 8분 + 4분 2개' },
  { level: 'basic', meter: '4/4', slots: [2, 1, 1, 2, 2], title: '4분·8분 혼합 A' },
  { level: 'basic', meter: '4/4', slots: [1, 1, 2, 2, 2], title: '8분 2개 + 4분 3개' },
  { level: 'basic', meter: '6/8', slots: [3, 3], title: '점8분음표 2개' },
  { level: 'basic', meter: '6/8', slots: [1, 1, 1, 3], title: '8분 3개 + 점8분' },
  { level: 'basic', meter: '6/8', slots: [3, 1, 1, 1], title: '점8분 + 8분 3개' },
  { level: 'basic', meter: '6/8', slots: [2, 2, 2], title: '4분음표 3개(6/8)' },

  { level: 'intermediate', meter: '4/4', slots: [3, 1, 1, 1, 2], title: '점4분 싱코페이션' },
  { level: 'intermediate', meter: '4/4', slots: [2, 1, 1, 1, 1, 2], title: '4분·8분 싱코페이션' },
  { level: 'intermediate', meter: '6/8', slots: [2, 1, 1, 2], title: '6/8 혼합 A' },
  { level: 'intermediate', meter: '6/8', slots: [1, 2, 1, 2], title: '6/8 혼합 B' },
  { level: 'intermediate', meter: '6/8', slots: [1, 1, 2, 2], title: '6/8 혼합 C' },
];

export function slotSum(slots) {
  return slots.reduce((s, d) => s + d, 0);
}

export function slotsToPlayPattern(slots) {
  return slots.map((s) => s * 0.5);
}

export function slotGroupSymbol(eighths) {
  if (eighths === 4) return '𝅗𝅥';
  if (eighths === 3) return '♩.';
  if (eighths === 2) return '♩';
  if (eighths === 1) return '♪';
  return '♪'.repeat(eighths);
}

export function slotsToNotation(slots) {
  return slots.map((s) => slotGroupSymbol(s)).join(' ');
}

export function renderFillOptionHtml(fillSlots) {
  const cells = fillSlots.map((len) => {
    const sym = slotGroupSymbol(len);
    if (len === 1) {
      return `<span class="measure-slot filled">${sym}</span>`;
    }
    let html = `<span class="measure-slot filled">${sym}</span>`;
    for (let i = 1; i < len; i += 1) {
      html += '<span class="measure-slot tie"></span>';
    }
    return html;
  }).join('');

  const total = fillSlots.reduce((s, d) => s + d, 0);
  return `
    <div class="rhythm-grid-wrap rhythm-grid-option">
      <span class="choice-prefix">□ →</span>
      <div class="measure-slots" style="--slots:${total}">${cells}</div>
    </div>
  `;
}

export function slotsKey(slots) {
  return slots.join(',');
}

export function getMeterLabel(meterId, slots) {
  const meter = METERS[meterId];
  const total = slotSum(slots);
  const beats = total / 2;
  return `${meter.label} · 1마디 (${beats}박 · 8분음표 ${total}칸)`;
}

function getNoteGroups(slots) {
  let pos = 0;
  return slots.map((len) => {
    const group = { start: pos, len, end: pos + len };
    pos += len;
    return group;
  });
}

/** 음표 덩어리 단위로만 빈칸 지정 (음표 중간을 자르지 않음) */
function pickBlankByGroups(slots, levelId) {
  const groups = getNoteGroups(slots);
  if (groups.length < 2) {
    throw new Error('빈칸을 만들 음표 그룹이 부족합니다');
  }

  const maxBlankGroups = levelId === 'beginner'
    ? Math.min(3, groups.length - 1)
    : Math.min(2, groups.length - 1);
  const candidates = [];

  for (let num = 1; num <= maxBlankGroups; num += 1) {
    for (let start = 0; start <= groups.length - num; start += 1) {
      const trailingOnly = start === groups.length - num;
      if (levelId === 'beginner' && !trailingOnly) continue;

      const blankGroups = groups.slice(start, start + num);
      const blankFrom = blankGroups[0].start;
      const blankLen = blankGroups[blankGroups.length - 1].end - blankFrom;
      const correctFill = blankGroups.map((g) => g.len);

      if (blankLen < 2) continue;
      if (blankLen >= 3 && compositions(blankLen, 4).length < 4) continue;

      candidates.push({ blankFrom, blankLen, correctFill });
    }
  }

  if (!candidates.length) {
    throw new Error('유효한 빈칸 구성을 찾지 못했습니다');
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** 슬롯 배열을 칸 단위 그리드로 펼침 */
export function expandToGrid(slots, meterId) {
  const meter = METERS[meterId];
  const grid = Array(meter.eighthsPerBar).fill(null);
  let pos = 0;
  for (const len of slots) {
    for (let i = 0; i < len; i += 1) {
      if (pos >= grid.length) break;
      grid[pos] = {
        type: i === 0 ? 'note' : 'tie',
        symbol: i === 0 ? slotGroupSymbol(len) : '',
        groupLen: len,
      };
      pos += 1;
    }
  }
  return grid;
}

export function renderMeasureHtml(slots, meterId, blankFrom, blankLen) {
  const meter = METERS[meterId];
  const grid = expandToGrid(slots, meterId);
  const cells = grid.map((cell, i) => {
    const inBlank = i >= blankFrom && i < blankFrom + blankLen;
    if (inBlank) {
      return '<span class="measure-slot blank" aria-hidden="true">□</span>';
    }
    if (!cell || cell.type === 'tie') {
      return '<span class="measure-slot tie" aria-hidden="true"></span>';
    }
    return `<span class="measure-slot filled">${cell.symbol}</span>`;
  }).join('');

  return `
    <div class="measure-card">
      <div class="measure-sig">${meter.shortLabel}</div>
      <div class="measure-slots" style="--slots:${meter.eighthsPerBar}">${cells}</div>
    </div>
  `;
}

function compositions(total, maxPart = 4) {
  const results = [];
  function go(remaining, path) {
    if (remaining === 0) {
      results.push([...path]);
      return;
    }
    for (let k = Math.min(maxPart, remaining); k >= 1; k -= 1) {
      path.push(k);
      go(remaining - k, path);
      path.pop();
    }
  }
  go(total, []);
  return results;
}

function pickDistractorFills(correctFill, blankLen) {
  const correctKey = slotsKey(correctFill);

  if (blankLen === 2) {
    const pool = [[2], [1, 1], [1], [3]]
      .filter((c) => slotsKey(c) !== correctKey)
      .map((fill) => ({ fill, notation: slotsToNotation(fill) }));
    const seen = new Set();
    const picked = [];
    for (const item of pool) {
      if (seen.has(item.notation)) continue;
      seen.add(item.notation);
      picked.push(item.fill);
      if (picked.length >= 3) break;
    }
    return picked;
  }

  const pool = compositions(blankLen, 4)
    .filter((c) => slotsKey(c) !== correctKey)
    .sort(() => Math.random() - 0.5);

  const seen = new Set();
  const picked = [];
  for (const fill of pool) {
    const notation = slotsToNotation(fill);
    if (seen.has(notation)) continue;
    seen.add(notation);
    picked.push(fill);
    if (picked.length >= 3) break;
  }
  return picked;
}

export function getFillPatternsForLevel(levelId) {
  return FILL_PATTERNS.filter((p) => p.level === levelId);
}

export function buildFillQuestion(levelId, patternOverride = null) {
  const pool = getFillPatternsForLevel(levelId);
  const source = patternOverride ?? pool[Math.floor(Math.random() * pool.length)];
  const meter = METERS[source.meter];

  if (slotSum(source.slots) !== meter.eighthsPerBar) {
    throw new Error(`마디 박자 불일치: ${slotsKey(source.slots)}`);
  }

  const { blankFrom, blankLen, correctFill } = pickBlankByGroups(source.slots, levelId);
  const correctKey = slotsKey(correctFill);

  if (slotSum(correctFill) !== blankLen) {
    throw new Error(`빈칸 길이 불일치: ${correctKey}`);
  }

  const distractors = pickDistractorFills(correctFill, blankLen);
  while (distractors.length < 3) {
    const extra = compositions(blankLen, 4).find(
      (c) => slotsKey(c) !== correctKey
        && !distractors.some((d) => slotsKey(d) === slotsKey(c))
        && slotsToNotation(c) !== slotsToNotation(correctFill),
    );
    if (extra) distractors.push(extra);
    else break;
  }

  if (distractors.length < 3) {
    throw new Error(`빈칸 보기 부족: ${correctKey}`);
  }

  const options = [correctFill, ...distractors]
    .map((fill, i) => ({
      id: String.fromCharCode(65 + i),
      fillSlots: fill,
      notation: slotsToNotation(fill),
      gridHtml: renderFillOptionHtml(fill),
    }))
    .sort(() => Math.random() - 0.5);

  const answerOption = options.find((o) => slotsKey(o.fillSlots) === correctKey);
  if (!answerOption) {
    throw new Error(`빈칸 정답 누락: ${correctKey}`);
  }

  return {
    type: 'fill',
    levelId,
    bpm: meter.bpm,
    meterId: source.meter,
    meterLabel: getMeterLabel(source.meter, source.slots),
    bars: 1,
    fullSlots: source.slots,
    blankFrom,
    blankLen,
    measureHtml: renderMeasureHtml(source.slots, source.meter, blankFrom, blankLen),
    correctFill,
    correctPattern: slotsToPlayPattern(source.slots),
    correctNotation: slotsToNotation(source.slots),
    options,
    answerId: answerOption.id,
    hint: source.title,
  };
}

for (const p of FILL_PATTERNS) {
  const meter = METERS[p.meter];
  if (slotSum(p.slots) !== meter.eighthsPerBar) {
    console.warn(`잘못된 마디 패턴: ${p.title} (${slotSum(p.slots)}칸)`);
  }
}
