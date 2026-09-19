export function createAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('이 브라우저는 Web Audio를 지원하지 않습니다.');
  return new Ctx();
}

export async function resumeAudio(ctx) {
  if (ctx && ctx.state === 'suspended') await ctx.resume();
  return ctx;
}
