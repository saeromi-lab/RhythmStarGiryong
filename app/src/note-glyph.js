/** 교과서형 음표·쉼표 SVG. 4분·8분·16분은 같은 타원 머리를 씀. */

const HEAD = { cx: 15.2, cy: 41.2, rx: 8.05, ry: 5.45, rot: -22 };
const STEM_X = 22.55;

function headEl({ open = false } = {}) {
  const rot = `rotate(${HEAD.rot} ${HEAD.cx} ${HEAD.cy})`;
  if (open) {
    return `<ellipse class="note-head note-head-open" cx="${HEAD.cx}" cy="${HEAD.cy}" rx="6.9" ry="4.35" transform="${rot}" fill="none" stroke="currentColor" stroke-width="2.2"/>`;
  }
  return `<ellipse class="note-head" cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}" transform="${rot}" fill="currentColor"/>`;
}

function wholeHeadEl() {
  return `<ellipse class="note-head note-head-open" cx="20" cy="28" rx="11.2" ry="7.2" transform="rotate(-18 20 28)" fill="none" stroke="currentColor" stroke-width="2.3"/>`;
}

function stemEl() {
  return `<line class="note-stem" x1="${STEM_X}" y1="39.6" x2="${STEM_X}" y2="6.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`;
}

function flagsEl(count) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const y = 6.2 + i * 8.2;
    out += `<path class="note-flag" d="M${STEM_X} ${y} C33.6 ${y + 2.4} 36.2 ${y + 10.6} 29.4 ${y + 18.4} C33.2 ${y + 9.6} 30.8 ${y + 3.2} ${STEM_X} ${y + 2.15}Z" fill="currentColor"/>`;
  }
  return out;
}

function dotEl() {
  return `<circle class="note-dot" cx="30.6" cy="41.2" r="2.2" fill="currentColor"/>`;
}

function wrapNote(inner, label) {
  return `<svg class="note-glyph" viewBox="0 0 40 52" aria-label="${label}" role="img" focusable="false">${inner}</svg>`;
}

function wrapRest(inner, label) {
  return `<svg class="rest-glyph" viewBox="0 0 40 52" aria-label="${label}" role="img" focusable="false">${inner}</svg>`;
}

function staffLine(y) {
  return `<line class="rest-staff" x1="8" y1="${y}" x2="32" y2="${y}" stroke="currentColor" stroke-width="1.55" opacity="0.45"/>`;
}

/** 4분쉼표 — 번개/‘3’자 교과서 모양 */
function quarterRestPath() {
  return `<path class="rest-quarter" fill="currentColor" d="M23.2 6.4c-5.2 2.2-8.6 6.2-5.4 11.2 2.2 3.4 6.8 4.2 4.2 8.8-1.8 3.2-6.2 4.2-9.4 2.8 4.4 2.2 10.2 1.2 13.2-3.2 4-5.4 2.2-10.6-1.6-14.2-2.8-2.6-4.8-3.6-3.2-6.4 1-1.8 4.2-3.4 8.2-4zM20.6 29.2c5.4 3.4 5 11.2-1.6 17.4-3.4 3.2-8.6 5-12.6 3.4 5.2-1.4 9.6-4.2 11.8-8.8 2.4-5 .4-8.8-3.8-10.6z"/>`;
}

/** 8·16·32분쉼표 — 같은 깃발+대 모양을 깃발 수만 늘림 */
function flaggedRest(flags) {
  const stem = `<line x1="20.2" y1="14" x2="25.4" y2="44.5" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/>`;
  let blobs = '';
  for (let i = 0; i < flags; i += 1) {
    const x = 14.6;
    const y = 14.2 + i * 8.4;
    blobs += `<ellipse cx="${x}" cy="${y}" rx="6.1" ry="3.55" transform="rotate(-38 ${x} ${y})" fill="currentColor"/>`;
  }
  return `${stem}${blobs}`;
}

function noteKind(eighths) {
  const e = Number(eighths);
  if (e >= 7.5) return 'whole';
  if (e >= 5.5) return 'dottedHalf';
  if (e >= 3.5) return 'half';
  if (e >= 2.5) return 'dottedQuarter';
  if (e >= 1.75) return 'quarter';
  if (e >= 1.25) return 'dottedEighth';
  if (e >= 0.75) return 'eighth';
  return 'sixteenth';
}

/** 8분음표 칸 수 → 음표 SVG (0.5=16분, 1=8분, 2=4분, 3=점4분, 4=2분, 8=온) */
export function noteGlyphHtml(eighths) {
  const kind = noteKind(eighths);
  if (kind === 'whole') return wrapNote(wholeHeadEl(), '온음표');
  if (kind === 'dottedHalf') return wrapNote(`${stemEl()}${headEl({ open: true })}${dotEl()}`, '점2분음표');
  if (kind === 'half') return wrapNote(`${stemEl()}${headEl({ open: true })}`, '2분음표');
  if (kind === 'dottedQuarter') return wrapNote(`${stemEl()}${headEl()}${dotEl()}`, '점4분음표');
  if (kind === 'quarter') return wrapNote(`${stemEl()}${headEl()}`, '4분음표');
  if (kind === 'dottedEighth') return wrapNote(`${stemEl()}${flagsEl(1)}${headEl()}${dotEl()}`, '점8분음표');
  if (kind === 'eighth') return wrapNote(`${stemEl()}${flagsEl(1)}${headEl()}`, '8분음표');
  return wrapNote(`${stemEl()}${flagsEl(2)}${headEl()}`, '16분음표');
}

export function restGlyphHtml(eighths) {
  const e = Number(eighths);
  if (e >= 7.5) {
    return wrapRest(`${staffLine(22)}${`<rect x="12" y="22" width="16" height="7.6" rx="0.6" fill="currentColor"/>`}`, '온쉼표');
  }
  if (e >= 3.5) {
    return wrapRest(`${staffLine(30)}${`<rect x="12" y="22.4" width="16" height="7.6" rx="0.6" fill="currentColor"/>`}`, '2분쉼표');
  }
  if (e >= 1.75) return wrapRest(quarterRestPath(), '4분쉼표');
  if (e >= 0.75) return wrapRest(flaggedRest(1), '8분쉼표');
  return wrapRest(flaggedRest(2), '16분쉼표');
}

export function noteHeadSpec() {
  return { ...HEAD };
}
