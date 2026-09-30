/* Brick Route · palette
   Twelve color families, ten shades each (0 lightest → 9 darkest).
   shade(name, i) returns an hsl() string; inject() writes every shade onto
   :root as --<name>-<i> so CSS can use the same values. */

const Palette = (() => {
  const FAMILIES = {
    red:    { h: 358, s: 78 },
    orange: { h: 26,  s: 90 },
    yellow: { h: 48,  s: 92 },
    green:  { h: 135, s: 55 },
    teal:   { h: 175, s: 60 },
    mint:   { h: 155, s: 55 },
    blue:   { h: 215, s: 85 },
    purple: { h: 270, s: 60 },
    pink:   { h: 335, s: 75 },
    brown:  { h: 25,  s: 45 },
    black:  { h: 220, s: 8  },
    white:  { h: 90,  s: 10 },
  };

  function shade(name, i) {
    const f = FAMILIES[name] || FAMILIES.red;
    i = Math.max(0, Math.min(9, i | 0));
    let l;
    if (name === 'black') l = 42 - i * 3.8;        // 42 → 8
    else if (name === 'white') l = 99 - i * 2.2;   // 99 → 79
    else l = 93 - i * 7.4;                         // 93 → 26
    return `hsl(${f.h} ${f.s}% ${l.toFixed(1)}%)`;
  }

  /* true when dark text reads better on this shade */
  function isLight(name, i) {
    if (name === 'black') return false;
    if (name === 'white') return true;
    if (name === 'yellow' || name === 'mint') return i < 7;
    return i < 4;
  }

  function inject() {
    const root = document.documentElement;
    for (const n in FAMILIES) for (let i = 0; i < 10; i++) root.style.setProperty(`--${n}-${i}`, shade(n, i));
  }

  return { FAMILIES, names: Object.keys(FAMILIES), shade, isLight, inject };
})();
