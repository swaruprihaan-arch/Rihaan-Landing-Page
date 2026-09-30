/* Brick Route · a tiny synthesized brick click. No audio files. */

const Click = (() => {
  let ctx = null, on = true;
  try { on = localStorage.getItem('brickroute.sound') !== 'off'; } catch (e) {}
  function play(kind) {
    if (!on) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(kind === 'pop' ? 520 : kind === 'win' ? 660 : 180, t);
      o.frequency.exponentialRampToValueAtTime(kind === 'pop' ? 900 : kind === 'win' ? 990 : 90, t + 0.06);
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'win' ? 0.25 : 0.08));
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.3);
    } catch (e) {}
  }
  function toggle() { on = !on; try { localStorage.setItem('brickroute.sound', on ? 'on' : 'off'); } catch (e) {} return on; }
  return { play, toggle, get on() { return on; } };
})();
