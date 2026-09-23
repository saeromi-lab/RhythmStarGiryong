/** Visible-tab dwell time. Hidden / locked screens do not count. */

const TICK_MS = 1000;
const FLUSH_EVERY_MS = 5000;
const MAX_DELTA_MS = 5000;

export function formatStudyDuration(ms, { allowSeconds = false } = {}) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  if (min < 1) return allowSeconds ? `${sec}초` : '0분';
  if (hr < 1) return `${min}분`;
  const rem = min % 60;
  return rem ? `${hr}시간 ${rem}분` : `${hr}시간`;
}

export function createStudyClock({ onChange, onFlush } = {}) {
  let lastTick = Date.now();
  let sessionMs = 0;
  let pendingMs = 0;
  let lastFlushAt = Date.now();
  let timer = null;

  function visible() {
    return document.visibilityState === 'visible';
  }

  function tick() {
    const now = Date.now();
    const delta = Math.min(now - lastTick, MAX_DELTA_MS);
    lastTick = now;
    if (visible() && delta > 0) {
      sessionMs += delta;
      pendingMs += delta;
    }
    if (now - lastFlushAt >= FLUSH_EVERY_MS) flush();
    onChange?.({ sessionMs, pendingMs });
  }

  function flush() {
    lastFlushAt = Date.now();
    if (pendingMs <= 0) return 0;
    const ms = pendingMs;
    pendingMs = 0;
    onFlush?.(ms);
    onChange?.({ sessionMs, pendingMs });
    return ms;
  }

  function onVisibility() {
    lastTick = Date.now();
    if (!visible()) flush();
    else onChange?.({ sessionMs, pendingMs });
  }

  function start() {
    if (timer) return;
    lastTick = Date.now();
    timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }

  function stop() {
    flush();
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', flush);
    window.removeEventListener('beforeunload', flush);
  }

  return {
    start,
    stop,
    flush,
    sessionMs: () => sessionMs,
    pendingMs: () => pendingMs,
  };
}
