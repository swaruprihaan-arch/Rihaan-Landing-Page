/* cars/estimate.js — shared by the catalogue build (Node) and the Showroom UI (browser).
   Class vocabulary, keyword classifier and the physics estimator that turns published specs into
   the racing engine's car parameters (see cars/SPEC.md §3.5 and §4). Classic script: no imports. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.CT_ESTIMATE = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  //            label             top  zero grip brake off   len   wid   hgt   kg    archetype  group
  const T = (label, top, zero, grip, brake, off, len, wid, hgt, kg, type, group) => ({ label, top, zero, grip, brake, off, len, wid, hgt, kg, type, group });
  const CLASSES = {
    city:      T('City car',       155, 13.5,  7.0, 0.95, .50, 3600, 1650, 1500, 1000, 'hatch',  'Everyday'),
    supermini: T('Supermini',      170, 11.5,  7.3, 0.95, .50, 4000, 1740, 1480, 1150, 'hatch',  'Everyday'),
    compact:   T('Compact',        195, 10.0,  7.4, 1.00, .50, 4400, 1800, 1450, 1350, 'hatch',  'Everyday'),
    midsize:   T('Mid-size',       210,  9.0,  7.0, 1.00, .50, 4800, 1850, 1450, 1500, 'muscle', 'Everyday'),
    executive: T('Executive',      235,  7.5,  7.4, 1.05, .50, 4950, 1870, 1450, 1700, 'muscle', 'Premium'),
    luxury:    T('Luxury',         245,  6.5,  6.9, 1.05, .50, 5200, 1920, 1480, 2050, 'muscle', 'Premium'),
    limo:      T('Limousine',      210,  8.5,  6.2, 1.00, .45, 5600, 1950, 1500, 2300, 'muscle', 'Premium'),
    wagon:     T('Estate',         205,  9.0,  7.0, 1.00, .55, 4800, 1850, 1480, 1550, 'hatch',  'Everyday'),
    hothatch:  T('Hot hatch',      240,  6.5,  8.3, 1.10, .50, 4300, 1800, 1430, 1350, 'hatch',  'Performance'),
    roadster:  T('Roadster',       225,  6.5,  8.4, 1.10, .45, 4000, 1750, 1250, 1100, 'sports', 'Performance'),
    sports:    T('Sports car',     260,  5.5,  8.6, 1.15, .45, 4450, 1850, 1300, 1450, 'sports', 'Performance'),
    gt:        T('Grand tourer',   295,  4.5,  8.9, 1.20, .45, 4750, 1950, 1350, 1750, 'gt',     'Performance'),
    muscle:    T('Muscle car',     240,  5.5,  6.6, 0.95, .50, 4900, 1900, 1350, 1700, 'muscle', 'Performance'),
    supercar:  T('Supercar',       325,  3.4,  9.6, 1.30, .40, 4600, 2000, 1200, 1500, 'gt',     'Exotic'),
    hypercar:  T('Hypercar',       385,  2.8, 10.0, 1.35, .38, 4650, 2050, 1180, 1500, 'hyper',  'Exotic'),
    race:      T('Racing car',     300,  3.4, 11.0, 1.45, .35, 4600, 2000, 1150, 1250, 'gt',     'Competition'),
    openwheel: T('Single-seater',  330,  2.8, 12.5, 1.50, .30, 5000, 1900,  950,  750, 'open',   'Competition'),
    rally:     T('Rally car',      210,  5.0,  7.4, 1.05, .85, 4200, 1800, 1450, 1250, 'rally',  'Competition'),
    suv:       T('SUV',            200,  8.5,  6.3, 0.95, .75, 4800, 1950, 1750, 2000, 'rally',  'Utility'),
    crossover: T('Crossover',      195,  9.5,  6.6, 0.95, .65, 4450, 1830, 1620, 1500, 'rally',  'Utility'),
    offroad:   T('Off-roader',     160, 12.0,  5.4, 0.85, .90, 4400, 1900, 1850, 2000, 'rally',  'Utility'),
    pickup:    T('Pickup',         175, 10.0,  5.6, 0.85, .85, 5300, 2000, 1850, 2200, 'truck',  'Utility'),
    truck:     T('Truck',          120, 18.0,  5.0, 0.80, .80, 6000, 2300, 2400, 3200, 'truck',  'Utility'),
    van:       T('Van',            150, 14.0,  5.4, 0.85, .60, 4900, 1950, 1900, 1900, 'truck',  'Utility'),
    mpv:       T('MPV',            180, 11.0,  6.0, 0.95, .55, 4600, 1850, 1700, 1600, 'truck',  'Everyday'),
    kei:       T('Kei car',        125, 14.0,  6.5, 0.90, .50, 3400, 1480, 1650,  850, 'hatch',  'Everyday'),
    micro:     T('Microcar',        95, 18.0,  6.0, 0.85, .45, 2700, 1400, 1400,  450, 'hatch',  'Everyday'),
    concept:   T('Concept',        250,  5.5,  8.0, 1.10, .50, 4600, 1900, 1350, 1500, 'hyper',  'Concept'),
    other:     T('Car',            190, 10.0,  7.0, 1.00, .50, 4500, 1800, 1450, 1400, 'sports', 'Everyday')
  };
  const ORDER = Object.keys(CLASSES);
  const CLIM = { top: [80, 450], zero: [1.8, 15], grip: [4, 14], brake: [.5, 2], off: [.2, 1], len: [2.5, 7], wid: [1.4, 2.6], hgt: [.8, 2.4], wt: [500, 3500] };
  const FLAGS = { CONCEPT: 1, RACE: 2, ELECTRIC: 4, WIKI: 8, NONEN: 16, PHOTO: 32, AWD: 64 };

  /* ---------- classification (first matching rule wins; class-like strings before body-style strings) ---------- */
  const RULES = [
    ['openwheel', /formula (one|1|2|3|4|e\b|ford|renault|junior|vee|atlantic|libre|nippon|regional)|single-?seater|indycar|indy car|indy 500|open-?wheel|monoposto|\bf1\b|grand prix car|voiturette racing/],
    ['rally',     /rally car|rally raid|\bwrc\b|group b\b|dakar|rallycross|rally version/],
    ['race',      /racing (car|automobile|version|model|prototype)|race car|racecar|sports prototype|le mans prototype|group c\b|\bgt3\b|\bgt4\b|\bgte\b|\bgt1\b|\bgt2\b|touring car racing|stock car|nascar|\bdtm\b|homologation|\blmp\d?\b|\blmh\b|\blmdh\b|can-am|endurance racing|hill ?climb|time attack|racing$/],
    ['hypercar',  /hypercar|hyper car|megacar/],
    ['supercar',  /supercar|super car|exotic (sports )?car/],
    ['gt',        /grand tourer|grand touring|gran turismo|\bgt\b car|2\+2 coup|grand tour/],
    ['muscle',    /muscle car|pony car/],
    ['hothatch',  /hot hatch|sport compact|warm hatch|performance hatch/],
    ['roadster',  /roadster|spider|spyder|barchetta|speedster|two-seat(er)? convertible|2-seat(er)? convertible|targa/],
    ['sports',    /sports car|sport car|sportscar|sports coup|sports sedan|sports saloon|sport sedan|performance car|sporty|\bcoup[ée]\b/],
    ['pickup',    /pickup|pick-up|coup[ée] utility|\bute\b|light(-| )duty truck|light truck|cab chassis/],
    ['offroad',   /off-?road|4x4 utility|all-terrain|four-wheel-drive vehicle|\bjeep\b|military light|rock crawler/],
    ['suv',       /sport utility|\bsuv\b|4wd wagon|crossover suv/],
    ['crossover', /crossover|\bcuv\b/],
    ['van',       /\bvans?\b|panel van|light commercial|minibus|camper|cargo/],
    ['mpv',       /\bmpv\b|minivan|people carrier|multi-?purpose|microvan|monospace|leisure activity|people mover/],
    ['limo',      /limousine|stretch(ed)? /],
    ['luxury',    /luxury|f-segment|flagship|premium large|ultra-?luxury/],
    ['executive', /executive|e-segment|mid-size luxury|midsize luxury|large family|upper medium|d-segment premium/],
    ['wagon',     /\bestate\b|station wagon|shooting brake|\bkombi\b|\bwagon\b|\bbreak\b/],
    ['kei',       /kei car|kei-car|keijid|kei truck|kei van/],
    ['micro',     /microcar|micro car|bubble car|voiturette|cyclecar|quadricycle|three-wheel|3-wheel|invalid carriage/],
    ['city',      /city car|a-segment|minicompact|minicar|small city/],
    ['supermini', /supermini|subcompact|b-segment|economy car|small car|mini car/],
    ['compact',   /compact|c-segment|small family|hatchback|golf class|lower medium/],
    ['midsize',   /mid-?size|d-segment|family car|large car|full-?size|sedan|saloon|notchback|fastback|liftback|convertible|cabriolet|hardtop|passenger car|touring car|tourer|phaeton|torpedo|tonneau|vis-à-vis|landaulet|brougham|antique|veteran|vintage|automobile model|car model/],
    ['truck',     /\btrucks?\b|lorry|heavy-duty|semi-trailer|tractor unit/],
    ['concept',   /concept|prototype|show car|design study|one-off/]
  ];
  function classify(classStrings, bodyStrings) {
    const norm = a => (Array.isArray(a) ? a : a ? [a] : []).filter(Boolean).map(s => String(s).toLowerCase()).join(' | ');
    const c = norm(classStrings), b = norm(bodyStrings);
    for (const [cl, re] of RULES) if (re.test(c)) return cl;
    for (const [cl, re] of RULES) if (re.test(b)) return cl;
    return 'other';
  }
  function flagsFor(strings) {
    const s = (Array.isArray(strings) ? strings : [strings]).filter(Boolean).join(' | ').toLowerCase();
    let f = 0;
    if (/concept car|show car|design study/.test(s)) f |= FLAGS.CONCEPT;
    if (/racing (car|automobile)|race car|racecar|formula|single-?seater|rally car|prototype racer|sports prototype/.test(s)) f |= FLAGS.RACE;
    if (/electric (car|vehicle|automobile|sports)|battery electric|\bbev\b|\bev\b|fuel cell/.test(s)) f |= FLAGS.ELECTRIC;
    if (/all-wheel|four-wheel|4wd|awd|4x4|4matic|quattro|xdrive|4motion|all wheel/.test(s)) f |= FLAGS.AWD;
    return f;
  }

  /* ---------- estimation ---------- */
  function eraFactor(y0) {
    if (!y0 || !isFinite(y0)) return 1;
    if (y0 <= 1919) return .35; if (y0 <= 1929) return .45; if (y0 <= 1939) return .55; if (y0 <= 1949) return .60;
    if (y0 <= 1959) return .70; if (y0 <= 1969) return .80; if (y0 <= 1979) return .85; if (y0 <= 1989) return .90;
    if (y0 <= 1999) return .95; if (y0 <= 2009) return 1.0; return 1.02;
  }
  function gripPenalty(y0) { if (!y0) return 0; if (y0 <= 1959) return 1.5; if (y0 <= 1969) return 1.0; if (y0 <= 1979) return .6; if (y0 <= 1989) return .3; return 0; }
  const DRAG = { sports: 1, gt: 1, supercar: 1, hypercar: 1, race: 1, openwheel: 1, roadster: .98, hothatch: .96, muscle: .97,
    city: .95, supermini: .95, compact: .95, midsize: .95, executive: .96, luxury: .95, limo: .93, concept: .98, other: .95, kei: .92, micro: .9,
    suv: .85, crossover: .87, wagon: .9, mpv: .86, rally: .9, offroad: .78, pickup: .8, van: .78, truck: .75 };
  const TOPCAP = { pickup: 190, truck: 130, van: 180, offroad: 190, suv: 250, crossover: 235, mpv: 215, kei: 140, micro: 125, limo: 240, wagon: 260 };
  function num(v) { const n = typeof v === 'string' ? parseFloat(v) : v; return typeof n === 'number' && isFinite(n) && n > 0 ? n : null; }
  function archetype(cl, row) {
    const C = CLASSES[cl] || CLASSES.other; let type = C.type; row = row || {};
    const hgt = num(row.hgt), hp = num(row.hp), y0 = num(row.y0), body = String(row.body || '').toLowerCase();
    if ((cl === 'sports' || cl === 'roadster') && hgt && hgt < 1150 && hp && hp >= 400) type = 'gt';
    if (cl === 'concept') type = y0 && y0 >= 2000 ? 'hyper' : 'sports';
    if (/pickup|pick-up|\bute\b/.test(body)) type = 'truck';
    return type;
  }
  /* row: { cl, y0, hp, kg, top, zero, len, wid, hgt, fl, body } — any field may be missing/null. */
  function estimate(row) {
    row = row || {};
    const cl = CLASSES[row.cl] ? row.cl : 'other', C = CLASSES[cl], y0 = num(row.y0), f = eraFactor(y0), fl = row.fl | 0;
    const awd = !!(fl & FLAGS.AWD), electric = !!(fl & FLAGS.ELECTRIC);
    const hp = num(row.hp), kgData = num(row.kg), kg = kgData || C.kg;
    const est = { top: false, zero: false, grip: true, size: false, wt: !kgData };
    let top = num(row.top);
    if (!top) {
      est.top = true;
      if (hp) {
        // power-limited top speed, damped for early cars (gearing, tyres) and capped where vehicles are speed-limited
        top = 40 * Math.pow(hp, 1 / 3) * (DRAG[cl] || .95) * clamp(1 - .1 * (kg / 1500 - 1), .8, 1.1) * Math.min(1, f + .35);
        if (electric) top = Math.min(top * .9, 260);
        if (TOPCAP[cl]) top = Math.min(top, TOPCAP[cl]);
      } else top = C.top * f;
    }
    let zero = num(row.zero);
    if (!zero) {
      est.zero = true;
      if (hp) {
        zero = (1.2 + .92 * (kg / hp)) * (awd ? .93 : 1) * (1 + (1 - f) * .8);
        if (electric) zero *= .78;                         // instant torque
        if (cl === 'race' || cl === 'openwheel') zero *= 1.15; // traction-limited launches
        if (hp < 90) zero *= 1 + (90 - hp) / 90 * .4;      // small engines, tall gearing
      } else zero = C.zero / Math.pow(f, 1.2);
    }
    let grip = C.grip - gripPenalty(y0) + (awd ? .3 : 0);
    let brake = C.brake + (electric ? .05 : 0) - (y0 && y0 <= 1969 ? .15 : 0);
    let off = C.off + (awd ? .1 : 0);
    const mm = (v, d) => { const n = num(v); if (n) return n / 1000; est.size = true; return d / 1000; };
    const len = mm(row.len, C.len), wid = mm(row.wid, C.wid), hgt = mm(row.hgt, C.hgt);
    const out = {
      type: archetype(cl, row), cl,
      top: clamp(Math.round(top), CLIM.top[0], CLIM.top[1]),
      zero: clamp(Math.round(zero * 10) / 10, CLIM.zero[0], CLIM.zero[1]),
      grip: clamp(Math.round(grip * 10) / 10, CLIM.grip[0], CLIM.grip[1]),
      brake: clamp(Math.round(brake * 100) / 100, CLIM.brake[0], CLIM.brake[1]),
      off: clamp(Math.round(off * 100) / 100, CLIM.off[0], CLIM.off[1]),
      len: clamp(Math.round(len * 100) / 100, CLIM.len[0], CLIM.len[1]),
      wid: clamp(Math.round(wid * 100) / 100, CLIM.wid[0], CLIM.wid[1]),
      hgt: clamp(Math.round(hgt * 100) / 100, CLIM.hgt[0], CLIM.hgt[1]),
      wt: clamp(Math.round(kg), CLIM.wt[0], CLIM.wt[1]),
      est
    };
    out.corner = Math.round(Math.sqrt(out.grip / 8 * 1.35 * 9.81 * 60) * 3.6); // km/h through a 60 m radius bend, as race.js computes it
    return out;
  }
  const label = cl => (CLASSES[cl] || CLASSES.other).label;
  const group = cl => (CLASSES[cl] || CLASSES.other).group;
  return { CLASSES, ORDER, CLIM, FLAGS, RULES, classify, flagsFor, archetype, estimate, eraFactor, gripPenalty, label, group };
});
