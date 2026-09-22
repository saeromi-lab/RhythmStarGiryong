/** 교과서 음표·쉼표. 4분·8분·16분은 같은 타원 머리를 씀. */

const HEAD = { cx: 11.6, cy: 37.4, rx: 7.35, ry: 5.05, rot: -22 };
const STEM_X = 18.35;
const STEM_TOP = 5.2;

function headEl({ open = false } = {}) {
  const rot = `rotate(${HEAD.rot} ${HEAD.cx} ${HEAD.cy})`;
  if (open) {
    return `<ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="6.15" ry="3.95" transform="${rot}" fill="none" stroke="currentColor" stroke-width="2.05"/>`;
  }
  return `<ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}" transform="${rot}" fill="currentColor"/>`;
}

function stemEl() {
  return `<line x1="${STEM_X}" y1="36.2" x2="${STEM_X}" y2="${STEM_TOP}" stroke="currentColor" stroke-width="1.65" stroke-linecap="butt"/>`;
}

function flagsEl(count) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const y = STEM_TOP + i * 7.4;
    out += `<path d="M${STEM_X} ${y} C27.8 ${y + 1.2} 31.4 ${y + 7.2} 26.2 ${y + 16.2} C29.6 ${y + 8.6} 26.4 ${y + 2.4} ${STEM_X} ${y + 1.7}Z" fill="currentColor"/>`;
  }
  return out;
}

function dotEl() {
  return `<circle cx="26.4" cy="37.4" r="1.85" fill="currentColor"/>`;
}

function wholeHeadEl() {
  return `<ellipse cx="16" cy="24" rx="10.4" ry="6.6" transform="rotate(-16 16 24)" fill="none" stroke="currentColor" stroke-width="2.15"/>`;
}

function wrap(cls, inner, label) {
  return `<svg class="${cls}" viewBox="0 0 32 48" aria-label="${label}" role="img" focusable="false">${inner}</svg>`;
}

function staff(y) {
  return `<line x1="5" y1="${y}" x2="27" y2="${y}" stroke="currentColor" stroke-width="1.4" opacity="0.4"/>`;
}

/** 4분쉼표 — 번개 모양 */
function quarterRest() {
  return `<path fill="currentColor" d="M19.4 6.2c-4.6 2.4-7.8 6.6-4.6 11.6 2.2 3.4 6.6 4 3.8 8.6-1.8 3-6 3.8-8.8 2.4 4.2 2.4 9.6 1.4 12.4-2.8 3.6-5.2 1.8-10-1.8-13.4C18.2 10.2 16.4 9 17.8 6.6c.8-1.4 3.6-2.8 7-3.2zM17.2 28.8c4.8 3.2 4.4 10.4-1.6 16.2-3 2.8-7.8 4.4-11.4 2.8 4.6-1.2 8.6-3.6 10.6-8 2.2-4.6.2-8-3.6-9.6z"/>`;
}

/** 8·16분쉼표 — 깃발+대 (7자) */
function flaggedRest(flags) {
  const stem = `<path d="M16.8 15.2 L22.6 41.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`;
  let flagsPath = '';
  for (let i = 0; i < flags; i += 1) {
    const x = 12.4;
    const y = 14.4 + i * 7.8;
    flagsPath += `<ellipse cx="${x}" cy="${y}" rx="5.4" ry="3.25" transform="rotate(-40 ${x} ${y})" fill="currentColor"/>`;
  }
  return `${stem}${flagsPath}`;
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

export function noteGlyphHtml(eighths) {
  const kind = noteKind(eighths);
  if (kind === 'whole') return wrap('note-glyph', wholeHeadEl(), '온음표');
  if (kind === 'dottedHalf') return wrap('note-glyph', `${stemEl()}${headEl({ open: true })}${dotEl()}`, '점2분음표');
  if (kind === 'half') return wrap('note-glyph', `${stemEl()}${headEl({ open: true })}`, '2분음표');
  if (kind === 'dottedQuarter') return wrap('note-glyph', `${stemEl()}${headEl()}${dotEl()}`, '점4분음표');
  if (kind === 'quarter') return wrap('note-glyph', `${stemEl()}${headEl()}`, '4분음표');
  if (kind === 'dottedEighth') return wrap('note-glyph', `${stemEl()}${flagsEl(1)}${headEl()}${dotEl()}`, '점8분음표');
  if (kind === 'eighth') return wrap('note-glyph', `${stemEl()}${flagsEl(1)}${headEl()}`, '8분음표');
  return wrap('note-glyph', `${stemEl()}${flagsEl(2)}${headEl()}`, '16분음표');
}

export function restGlyphHtml(eighths) {
  const e = Number(eighths);
  if (e >= 7.5) {
    return wrap('rest-glyph', `${staff(20)}<rect x="8.5" y="20" width="15" height="6.6" fill="currentColor"/>`, '온쉼표');
  }
  if (e >= 3.5) {
    return wrap('rest-glyph', `${staff(28)}<rect x="8.5" y="21.4" width="15" height="6.6" fill="currentColor"/>`, '2분쉼표');
  }
  if (e >= 1.75) return wrap('rest-glyph', quarterRest(), '4분쉼표');
  if (e >= 0.75) return wrap('rest-glyph', flaggedRest(1), '8분쉼표');
  return wrap('rest-glyph', flaggedRest(2), '16분쉼표');
}
