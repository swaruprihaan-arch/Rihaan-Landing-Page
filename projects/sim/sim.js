/* CONTRAIL — flight simulation engine (Three.js world, flight dynamics, HUD, audio, missions). */
(function () {
  const D = window.CT_DATA;
  const KT = 1.943844, FT = 3.28084, FPM = 196.8504, G0 = 9.81, DEG = Math.PI / 180;
  let THREE = null;
  async function loadThree() {
    if (!THREE) THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    return THREE;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wrapDeg = d => ((d % 360) + 360) % 360;

  /* ---------------- noise / terrain ---------------- */
  function hash2(i, j, s) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
  function vnoise(x, z, s) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z, o, s) { let t = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { t += a * vnoise(x * f, z * f, s + i * 17); n += a; f *= 2.03; a *= .5; } return t / n; }
  function seedOf(str) { let h = 7; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return Math.abs(h) % 100000; }

  function makeTerrain(type, hdg, lenM, seed) {
    const dx = Math.sin(hdg), dz = -Math.cos(hdg), px = Math.cos(hdg), pz = Math.sin(hdg);
    const water = ['coast-flat', 'coast-hills', 'island'].includes(type);
    function raw(x, z) {
      const along = x * dx + z * dz, lat = x * px + z * pz, r = Math.hypot(x, z);
      const n1 = fbm(x / 3500, z / 3500, 5, seed);
      const ridge = 1 - Math.abs(fbm(x / 7000, z / 7000, 5, seed + 99) * 2 - 1);
      const det = (fbm(x / 600, z / 600, 3, seed + 7) - .5) * 30;
      switch (type) {
        case 'plains': return (n1 - .45) * 140 + det;
        case 'forest-mountain': return (n1 - .4) * 220 + Math.pow(ridge, 2.4) * 1900 * ss(5000, 20000, r) + det;
        case 'snow-mountain': return (n1 - .4) * 180 + Math.pow(ridge, 2) * 2300 * ss(6000, 18000, r) + det;
        case 'desert': return (n1 - .45) * 180 + Math.pow(ridge, 3) * 1100 * ss(4000, 15000, r) + det * .6;
        case 'alpine': {
          const wall = ss(1300, 6500, Math.abs(lat) + (n1 - .5) * 1500);
          return (n1 - .4) * 160 + (Math.pow(ridge, 1.3) * 1500 + 1100) * wall + det;
        }
        case 'coast-flat': case 'coast-hills': {
          const s = lat + (fbm(x / 9000, z / 9000, 4, seed + 3) - .5) * 6000;
          const hills = type === 'coast-hills' ? Math.pow(ridge, 2) * 700 * ss(-2000, -9000, s) : 0;
          const land = (n1 - .4) * 90 + 8 + hills + det * .5;
          return lerp(land, -40 - Math.max(0, s - 3000) * .01, ss(2500, 3600, s));
        }
        case 'island': {
          const R = 6000 + (fbm(x / 5000, z / 5000, 3, seed + 5) - .5) * 5000;
          const land = (n1 - .3) * 260 + Math.pow(ridge, 2) * 900 * ss(1500, 5000, r) + 6 + det;
          return lerp(land, -45, ss(R - 1200, R + 600, r));
        }
      }
      return 0;
    }
    function h(x, z) {
      const along = x * dx + z * dz, lat = x * px + z * pz;
      const dd = Math.max(lat < 0 ? -lat - 180 : lat - 820, Math.abs(along) - (lenM / 2 + 600), 0);
      return raw(x, z) * ss(0, 700, dd);
    }
    return { h, water, dir: { x: dx, z: dz }, perp: { x: px, z: pz } };
  }

  const PALETTES = {
    'plains': { low: [0.33, 0.45, 0.22], high: [0.42, 0.47, 0.28], rock: [.45, .43, .38], snow: 9e9 },
    'forest-mountain': { low: [0.18, 0.32, 0.16], high: [0.25, 0.33, 0.2], rock: [.42, .41, .4], snow: 1500 },
    'snow-mountain': { low: [0.28, 0.33, 0.24], high: [0.5, 0.52, 0.5], rock: [.45, .45, .47], snow: 700 },
    'desert': { low: [0.72, 0.6, 0.42], high: [0.63, 0.47, 0.32], rock: [.55, .38, .27], snow: 9e9 },
    'alpine': { low: [0.26, 0.4, 0.2], high: [0.3, 0.35, 0.24], rock: [.44, .43, .42], snow: 1700 },
    'coast-flat': { low: [0.34, 0.47, 0.25], high: [0.4, 0.46, 0.28], rock: [.5, .48, .42], snow: 9e9, sand: [.78, .72, .55] },
    'coast-hills': { low: [0.38, 0.45, 0.24], high: [0.5, 0.48, 0.3], rock: [.5, .46, .4], snow: 9e9, sand: [.78, .72, .55] },
    'island': { low: [0.2, 0.42, 0.18], high: [0.3, 0.4, 0.2], rock: [.42, .4, .36], snow: 9e9, sand: [.85, .8, .62] }
  };

  /* ---------------- audio ---------------- */
  function makeAudio(vol) {
    let ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    const master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
    const eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 60;
    const engF = ctx.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 600;
    const engG = ctx.createGain(); engG.gain.value = 0;
    eng.connect(engF).connect(engG).connect(master); eng.start();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const nF = ctx.createBiquadFilter(); nF.type = 'bandpass'; nF.frequency.value = 800; nF.Q.value = .6;
    const nG = ctx.createGain(); nG.gain.value = 0;
    noise.connect(nF).connect(nG).connect(master); noise.start();
    const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const wF = ctx.createBiquadFilter(); wF.type = 'lowpass'; wF.frequency.value = 400;
    const wG = ctx.createGain(); wG.gain.value = 0;
    wind.connect(wF).connect(wG).connect(master); wind.start();
    const warnO = ctx.createOscillator(); warnO.type = 'square'; warnO.frequency.value = 880;
    const warnG = ctx.createGain(); warnG.gain.value = 0; warnO.connect(warnG).connect(master); warnO.start();
    function beep(f, d, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.type = 'triangle'; g.gain.setValueAtTime(v || .2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + d); o.connect(g).connect(master); o.start(); o.stop(ctx.currentTime + d); }
    return {
      ctx, set(o) {
        const t = ctx.currentTime;
        engG.gain.setTargetAtTime(o.eng, t, .1); eng.frequency.setTargetAtTime(o.engF, t, .2); engF.frequency.setTargetAtTime(300 + o.engF * 6, t, .2);
        nG.gain.setTargetAtTime(o.jet, t, .15); nF.frequency.setTargetAtTime(500 + o.engF * 10, t, .2);
        wG.gain.setTargetAtTime(o.wind, t, .2); wF.frequency.setTargetAtTime(200 + o.windF, t, .2);
        warnG.gain.setTargetAtTime(o.warn ? (Math.floor(t * 6) % 2 ? .06 : 0) : 0, t, .01);
      }, beep, close() { try { ctx.close(); } catch (e) { } }
    };
  }

  /* ---------------- aircraft model ---------------- */
  function buildAircraftMesh(ac, c) {
    const g = new THREE.Group(), s = ac.scale || 1, geo = ac.geo;
    const M = (col, o) => new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: .5, metalness: .2 }, o || {}));
    const add = (mesh, x, y, z) => { mesh.position.set(x || 0, y || 0, z || 0); mesh.castShadow = true; g.add(mesh); return mesh; };
    const cyl = (r1, r2, len, col, seg) => { const geom = new THREE.CylinderGeometry(r1, r2, len, seg || 16); geom.rotateX(Math.PI / 2); return new THREE.Mesh(geom, M(col)); };
    const planform = (pts, depth, col) => { // pts in (x,z), extruded along y
      const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]));
      const geom = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); geom.rotateX(Math.PI / 2); geom.translate(0, depth / 2, 0);
      return new THREE.Mesh(geom, M(col));
    };
    const fin = (pts, th, col) => { // pts in (z,y)
      const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]));
      const geom = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); geom.rotateY(-Math.PI / 2); geom.translate(th / 2, 0, 0);
      return new THREE.Mesh(geom, M(col));
    };
    const wingPts = (span, rootZ, rootC, sweep, tipC) => [[0, rootZ], [span / 2, rootZ + sweep], [span / 2, rootZ + sweep + tipC], [0, rootZ + rootC], [-span / 2, rootZ + sweep + tipC], [-span / 2, rootZ + sweep], [0, rootZ]];
    const gear = new THREE.Group(); g.add(gear);
    const wheel = (x, y, z, r) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * .7, 12), M('#1a1d21', { roughness: .9 })); w.rotation.z = Math.PI / 2; w.position.set(x, y, z); gear.add(w); const st = new THREE.Mesh(new THREE.CylinderGeometry(r * .18, r * .18, -y, 6), M('#9aa1a8')); st.position.set(x, y / 2, z); gear.add(st); };
    let props = [], rotor = null, tailRotor = null, flame = null;
    const glass = M('#1a2633', { roughness: .1, metalness: .8 });
    if (geo === 'airliner' || geo === 'bizjet') {
      const L = (geo === 'bizjet' ? 18 : 36) * s, R = (geo === 'bizjet' ? 1.1 : 1.95) * s * (ac.id === 'b748' ? 1.15 : 1);
      add(cyl(R, R, L * .72, c.body), 0, 0, 0);
      const belly = cyl(R * 1.002, R * 1.002, L * .72, c.belly); belly.scale.y = .5; add(belly, 0, -R * .5, 0);
      const stripe = cyl(R * 1.004, R * 1.004, L * .72, c.accent); stripe.scale.set(1, .08, 1); add(stripe, 0, -R * .05, 0);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(c.body)); nose.rotation.x = -Math.PI / 2; nose.scale.y = 1.6; add(nose, 0, 0, -L * .36);
      add(new THREE.Mesh(new THREE.BoxGeometry(R * 1.3, R * .35, R * .6), glass), 0, R * .45, -L * .36 - R * .9);
      add(cyl(R, R * .25, L * .26, c.body), 0, R * .25, L * .49);
      const span = (geo === 'bizjet' ? 19 : 34) * s * (ac.id === 'b52' ? 1.6 : 1);
      add(planform(wingPts(span, -L * .06, L * .2, span * .2, L * .06), .35 * s, c.wing), 0, ac.highWing ? R * .8 : -R * .55, 0);
      add(planform(wingPts(span * .36, L * .38, L * .1, span * .1, L * .04), .2 * s, c.wing), 0, geo === 'bizjet' ? R * 2.7 : R * .3, 0);
      add(fin([[L * .34, R * .6], [L * .5, R * 3.4], [L * .58, R * 3.4], [L * .56, R * .6]], .3 * s, c.tail), 0, 0, 0);
      const ne = ac.nEng || 2;
      if (geo === 'bizjet') { [-1, 1].forEach(k => add(cyl(R * .45, R * .4, L * .16, c.engine), k * R * 1.5, R * .55, L * .26)); }
      else {
        const pos = ne >= 8 ? [.22, .36, .55, .72] : ne >= 4 ? [.3, .6] : [.34];
        pos.forEach(f => [-1, 1].forEach(k => { const e = add(cyl(R * .55, R * .5, L * .14, c.engine), k * span / 2 * f, (ac.highWing ? R * .4 : -R * 1.25), -L * .08 + span * .2 * f * .9); const ring = add(cyl(R * .56, R * .56, L * .02, '#2b2f36'), e.position.x, e.position.y, e.position.z - L * .07); }));
      }
      wheel(0, -R * 1.6, -L * .3, .45 * s); wheel(R * 1.1, -R * 1.6, L * .02, .6 * s); wheel(-R * 1.1, -R * 1.6, L * .02, .6 * s);
    } else if (geo === 'turboprop') {
      const L = 26 * s, R = 1.4 * s;
      add(cyl(R, R, L * .7, c.body), 0, 0, 0);
      const belly = cyl(R * 1.003, R * 1.003, L * .7, c.belly); belly.scale.y = .45; add(belly, 0, -R * .55, 0);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(c.body)); nose.rotation.x = -Math.PI / 2; nose.scale.y = 1.4; add(nose, 0, 0, -L * .35);
      add(new THREE.Mesh(new THREE.BoxGeometry(R * 1.2, R * .35, R * .6), glass), 0, R * .45, -L * .35 - R * .8);
      add(cyl(R, R * .3, L * .3, c.body), 0, R * .3, L * .5);
      const span = 27 * s;
      add(planform(wingPts(span, -L * .12, L * .12, 0, L * .07), .3 * s, c.wing), 0, R * 1.0, 0);
      add(planform(wingPts(span * .3, L * .56, L * .08, L * .02, L * .05), .2 * s, c.wing), 0, ac.id === 'c130' ? R * .4 : R * 4.2, 0);
      add(fin([[L * .4, R * .6], [L * .58, R * 4.2], [L * .66, R * 4.2], [L * .64, R * .6]], .3 * s, c.tail), 0, 0, 0);
      const pos = (ac.nEng || 2) >= 4 ? [.22, .42] : [.3];
      pos.forEach(f => [-1, 1].forEach(k => { const x = k * span / 2 * f; add(cyl(R * .45, R * .4, L * .2, c.engine), x, R * .8, -L * .16); const p = new THREE.Group(); p.position.set(x, R * .8, -L * .27); for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.25 * s, 2 * s, .08 * s), M('#20242a')); b.rotation.z = i * Math.PI / 3; b.position.y = 0; b.geometry.translate(0, 1 * s, 0); p.add(b); } g.add(p); props.push(p); }));
      wheel(0, -R * 1.4, -L * .3, .4 * s); wheel(R, -R * 1.4, 0, .5 * s); wheel(-R, -R * 1.4, 0, .5 * s);
    } else if (geo === 'fighter' || geo === 'delta' || geo === 'attack') {
      const L = 15 * s, R = .75 * s;
      if (geo === 'attack') {
        add(cyl(R * 1.1, R * .9, L * .8, c.body), 0, 0, 0);
        add(planform(wingPts(17 * s, -L * .1, L * .17, 0, L * .1), .3 * s, c.wing), 0, -R * .4, 0);
        [-1, 1].forEach(k => add(cyl(R * .7, R * .6, L * .18, c.engine), k * R * 1.6, R * 1.1, L * .2));
        add(planform(wingPts(6 * s, L * .38, L * .1, 0, L * .08), .2 * s, c.wing), 0, R * .3, 0);
        [-1, 1].forEach(k => add(fin([[L * .38, -R], [L * .4, R * 2.2], [L * .48, R * 2.2], [L * .48, -R]], .2 * s, c.tail), k * 3 * s, 0, 0));
      } else {
        add(cyl(R, R * .8, L * .7, c.body), 0, 0, L * .02);
        const belly = cyl(R * 1.01, R * .81, L * .7, c.belly); belly.scale.y = .5; add(belly, 0, -R * .45, L * .02);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(R, L * .25, 16), M(c.engine)); nose.rotation.x = -Math.PI / 2; add(nose, 0, 0, -L * .45);
        const cano = new THREE.Mesh(new THREE.SphereGeometry(R * .7, 12, 8), M(c.logo, { roughness: .1, metalness: .7, transparent: true, opacity: .85 })); cano.scale.set(1, .8, 2.6); add(cano, 0, R * .75, -L * .2);
        if (geo === 'delta') {
          add(planform([[0, -L * .2], [5 * s, L * .3], [5 * s, L * .36], [0, L * .36], [-5 * s, L * .36], [-5 * s, L * .3], [0, -L * .2]], .25 * s, c.wing), 0, -R * .2, 0);
          add(planform(wingPts(3.5 * s, -L * .3, L * .06, L * .04, L * .03), .12 * s, c.wing), 0, R * .3, 0);
          add(fin([[L * .14, R * .5], [L * .3, R * 4.5], [L * .36, R * 4.5], [L * .36, R * .5]], .2 * s, c.tail), 0, 0, 0);
        } else {
          const span = 10 * s;
          add(planform(wingPts(span, -L * .05, L * .3, L * .22, L * .07), .2 * s, c.wing), 0, -R * .1, 0);
          add(planform(wingPts(span * .55, L * .3, L * .12, L * .08, L * .04), .15 * s, c.wing), 0, -R * .1, 0);
          if (ac.twinTail) [-1, 1].forEach(k => { const f = add(fin([[L * .22, R * .6], [L * .34, R * 4.2], [L * .4, R * 4.2], [L * .38, R * .6]], .15 * s, c.tail), k * R * 1.4, 0, 0); f.rotation.z = -k * .2; });
          else add(fin([[L * .2, R * .6], [L * .34, R * 4.6], [L * .4, R * 4.6], [L * .38, R * .6]], .18 * s, c.tail), 0, 0, 0);
        }
        add(cyl(R * .7, R * .6, L * .06, '#2b2f36'), 0, 0, L * .38);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(R * .55, L * .35, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
        fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, L * .58); g.add(fl); flame = fl; fl.visible = false;
      }
      wheel(0, -R * 1.8, -L * .25, .3 * s); wheel(R * 1.4, -R * 1.8, L * .1, .35 * s); wheel(-R * 1.4, -R * 1.8, L * .1, .35 * s);
    } else if (geo === 'heli') {
      const L = 11 * s, R = 1.1 * s;
      const cab = new THREE.Mesh(new THREE.SphereGeometry(R * 1.2, 18, 14), M(c.body)); cab.scale.set(1, 1, 2); add(cab, 0, 0, -L * .1);
      const bel = new THREE.Mesh(new THREE.SphereGeometry(R * 1.21, 18, 14, 0, Math.PI * 2, Math.PI * .55, Math.PI * .45), M(c.belly)); bel.scale.set(1, 1, 2); add(bel, 0, 0, -L * .1);
      const win = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 14, 10, 0, Math.PI * 2, 0, Math.PI * .45), glass); win.rotation.x = -Math.PI / 2.3; win.scale.set(1, 1, 1.3); add(win, 0, R * .1, -L * .26);
      add(cyl(R * .35, R * .18, L * .55, c.body), 0, R * .3, L * .3);
      add(fin([[L * .5, R * .2], [L * .58, R * 2], [L * .64, R * 2], [L * .62, R * .2]], .12 * s, c.tail), 0, 0, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(R * 1.2, R * .45, L * .25), M(c.engine)), 0, R * 1.15, -L * .02);
      rotor = new THREE.Group(); rotor.position.set(0, R * 1.6, -L * .08); g.add(rotor);
      for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(5.5 * s, .05 * s, .35 * s), M('#202428')); b.geometry.translate(2.75 * s, 0, 0); b.rotation.y = i * Math.PI / 2; rotor.add(b); }
      const disc = new THREE.Mesh(new THREE.CircleGeometry(5.5 * s, 32), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false })); disc.rotation.x = -Math.PI / 2; rotor.add(disc);
      tailRotor = new THREE.Group(); tailRotor.position.set(R * .3, R * 1.4, L * .6); g.add(tailRotor);
      for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.6 * s, .18 * s), M('#202428')); b.rotation.x = i * Math.PI / 2; tailRotor.add(b); }
      [-1, 1].forEach(k => { const sk = new THREE.Mesh(new THREE.CylinderGeometry(.08 * s, .08 * s, L * .5, 6), M('#5e6469')); sk.rotation.x = Math.PI / 2; sk.position.set(k * R * 1.1, -R * 1.45, -L * .08); gear.add(sk); const st = new THREE.Mesh(new THREE.CylinderGeometry(.06 * s, .06 * s, R * .7, 6), M('#5e6469')); st.position.set(k * R * 1.0, -R * 1.1, -L * .08); gear.add(st); });
    } else if (geo === 'glider') {
      const L = 8.5 * s, R = .45 * s;
      add(cyl(R, R * .2, L * .9, c.body), 0, 0, L * .1);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(R, 12, 10), M(c.body)); nose.scale.z = 2.2; add(nose, 0, 0, -L * .35);
      const can = new THREE.Mesh(new THREE.SphereGeometry(R * .8, 12, 8), glass); can.scale.set(1, .8, 3); add(can, 0, R * .55, -L * .25);
      add(planform(wingPts(17 * s, -L * .1, L * .12, L * .02, L * .05), .12 * s, c.wing), 0, R * .5, 0);
      [-1, 1].forEach(k => add(new THREE.Mesh(new THREE.BoxGeometry(.6 * s, .14 * s, L * .07), M(c.accent)), k * 8.2 * s, R * .55, -L * .07));
      add(fin([[L * .46, 0], [L * .52, R * 3.5], [L * .58, R * 3.5], [L * .58, 0]], .1 * s, c.tail), 0, 0, 0);
      add(planform(wingPts(3 * s, L * .52, L * .06, 0, L * .05), .08 * s, c.wing), 0, R * 3.5, 0);
      wheel(0, -R * 1.2, -L * .05, .2 * s);
    } else { // ga, warbird
      const war = geo === 'warbird', L = (war ? 9.5 : 8) * s, R = (war ? .65 : .7) * s;
      add(cyl(R, R * .3, L * .8, c.body), 0, 0, L * .05);
      const bel = cyl(R * 1.01, R * .31, L * .8, c.belly); bel.scale.y = .45; add(bel, 0, -R * .55, L * .05);
      add(cyl(R * .9, R, L * .16, c.engine), 0, 0, -L * .42);
      const cab = new THREE.Mesh(new THREE.SphereGeometry(R * .85, 12, 8), glass); cab.scale.set(1, .8, 2); add(cab, 0, R * .55, -L * .12);
      const span = (war ? 11.3 : 11) * s * (ac.id === 'dc3' ? 1.6 : 1);
      const wy = ac.highWing ? R * 1.1 : -R * .55;
      if (war) { const sh = []; for (let i = 0; i <= 16; i++) { const t = i / 16 * Math.PI; sh.push([Math.cos(t) * span / 2, -L * .1 + Math.sin(t) * -0 + (1 - Math.sin(t)) * L * .02]); } const pts = [[span / 2, -L * .08]]; for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI; pts.push([Math.cos(a) * span / 2, -L * .08 - Math.sin(a) * 0]); } add(planform([[0, -L * .12], [span * .3, -L * .1], [span * .5, -L * .02], [span * .5, L * .02], [span * .3, L * .1], [0, L * .12], [-span * .3, L * .1], [-span * .5, L * .02], [-span * .5, -L * .02], [-span * .3, -L * .1], [0, -L * .12]], .2 * s, c.wing), 0, wy, 0); }
      else add(planform(wingPts(span, -L * .14, L * .17, 0, L * .14), .18 * s, c.wing), 0, wy, 0);
      add(planform(wingPts(span * .32, L * .36, L * .1, L * .02, L * .07), .1 * s, c.wing), 0, 0, 0);
      add(fin([[L * .3, R * .3], [L * .4, R * 2.6], [L * .48, R * 2.6], [L * .46, R * .3]], .12 * s, c.tail), 0, 0, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(.3 * s, .3 * s, span * .0001 + .01), M(c.accent)), 0, 0, 0);
      const stripe = cyl(R * 1.012, R * .32, L * .8, c.accent); stripe.scale.set(1, .1, 1); add(stripe, 0, R * .1, L * .05);
      const np = (ac.nEng || 1) >= 2 ? [-span * .18, span * .18] : [null];
      np.forEach(x => {
        const p = new THREE.Group();
        if (x === null) p.position.set(0, 0, -L * .51); else { add(cyl(R * .5, R * .45, L * .3, c.engine), x, wy, -L * .18); p.position.set(x, wy, -L * .34); }
        const nb = war ? 4 : (ac.nEng >= 2 ? 3 : 2);
        for (let i = 0; i < nb; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.16 * s, (war ? 1.7 : 0.95) * s, .06 * s), M('#1b1e22')); b.geometry.translate(0, (war ? .85 : .48) * s, 0); b.rotation.z = i * Math.PI * 2 / nb; p.add(b); }
        const sp = new THREE.Mesh(new THREE.ConeGeometry(R * .35, R * .7, 12), M(c.accent)); sp.rotation.x = -Math.PI / 2; p.add(sp);
        g.add(p); props.push(p);
      });
      if (ac.floats) { [-1, 1].forEach(k => { const f = cyl(.3 * s, .2 * s, L * .8, '#d7dbe0'); f.position.set(k * 1.3 * s, -R * 2.3, -L * .05); gear.add(f); }); }
      else { wheel(0, -R * 1.6, -L * .32, .22 * s); wheel(R * 1.5, -R * 1.6, -L * .02, .28 * s); wheel(-R * 1.5, -R * 1.6, -L * .02, .28 * s); }
    }
    // nav lights
    const lm = ac.lenMul || 1, sm = ac.spanMul || 1; if (lm !== 1 || sm !== 1) g.scale.set(sm, (lm + 1) / 2, lm);
    const navL = new THREE.Mesh(new THREE.SphereGeometry(.18 * s, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3030' }));
    const navR = new THREE.Mesh(new THREE.SphereGeometry(.18 * s, 8, 6), new THREE.MeshBasicMaterial({ color: '#30ff60' }));
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(.22 * s, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    const box = new THREE.Box3().setFromObject(g);
    navL.position.set(box.min.x / sm, 0, 0); navR.position.set(box.max.x / sm, 0, 0); strobe.position.set(0, box.max.y / ((lm + 1) / 2), box.max.z * .8 / lm);
    g.add(navL, navR, strobe);
    return { group: g, gear, props, rotor, tailRotor, flame, strobe, bottom: box.min.y, length: box.max.z - box.min.z, span: box.max.x - box.min.x };
  }

  /* ---------------- textures ---------------- */
  function runwayTexture(id, lenFt) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 4096; const x = cv.getContext('2d');
    x.fillStyle = '#2f3237'; x.fillRect(0, 0, 256, 4096);
    for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * .06})`; x.fillRect(Math.random() * 256, Math.random() * 4096, 3, 6); }
    x.fillStyle = '#e8e8e8';
    const thr = (y0, flip, label) => {
      for (let i = 0; i < 12; i++) { if (i === 6) continue; const xx = 14 + i * 19; x.fillRect(xx, flip ? y0 - 90 : y0, 9, 90); }
      x.save(); x.translate(128, flip ? y0 - 150 : y0 + 150); if (!flip) x.rotate(Math.PI); x.font = 'bold 64px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 0, 0); x.restore();
      for (let k = 0; k < 3; k++) { const yy = flip ? y0 - 320 - k * 110 : y0 + 280 + k * 110; x.fillRect(46, yy, 14, 60); x.fillRect(196, yy, 14, 60); }
      const ay = flip ? y0 - 560 : y0 + 500; x.fillRect(36, ay, 30, 110); x.fillRect(190, ay, 30, 110);
    };
    thr(16, false, recip(id)); thr(4080, true, id);
    for (let y = 700; y < 3400; y += 120) x.fillRect(125, y, 6, 60);
    x.fillRect(6, 0, 4, 4096); x.fillRect(246, 0, 4, 4096);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function recip(id) { const n = parseInt(id, 10); let r = ((n + 18 - 1) % 36) + 1; const suf = id.replace(/\d+/, ''); const m = { L: 'R', R: 'L', C: 'C', '': '' }; return String(r).padStart(2, '0') + (m[suf] || ''); }
  function puffTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    for (let i = 0; i < 14; i++) { const cx = 30 + Math.random() * 68, cy = 40 + Math.random() * 50, r = 18 + Math.random() * 26; const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  /* ---------------- simulation ---------------- */
  let S = null; // current session

  let launchVersion = 0;
  async function start(cfg, onExit) {
    stop();
    const version = launchVersion;
    const root = document.getElementById('flight');
    root.innerHTML = `
      <div id="fl-loading"><div>Loading scenery…</div><div class="mono muted" id="fl-ldmsg" style="font-size:12px"></div></div>
      <canvas id="hud"></canvas>
      <div id="fl-vignette"></div>
      <div class="fpanel" id="fl-tl"></div>
      <div class="fpanel" id="fl-tr"></div>
      <div class="fpanel" id="fl-bot"></div>
      <div class="fpanel" id="fl-msg"></div>
      <div class="fpanel" id="fl-warn"></div>
      <canvas class="mini" id="fl-mini" width="400" height="400"></canvas>
      <div class="overlay" id="fl-pause"><div class="card"><div class="eyebrow">Paused</div><h3 id="fl-ptitle">Flight paused</h3><div class="btns">
        <button class="btn" data-a="resume" type="button">Resume</button>
        <button class="btn sec" data-a="restart" type="button">Restart flight</button>
        <button class="btn sec" data-a="camera" type="button">Change camera</button>
        <div class="row" style="padding:0;border:0;min-height:40px"><span class="lbl">Time of day</span><span class="ctl"><input type="range" id="fl-tod" min="0" max="24" step=".25" aria-label="Time of day" style="width:180px"><span class="val" id="fl-todv"></span></span></div>
        <button class="btn ghost" data-a="exit" type="button">Exit to menu</button></div></div></div>
      <div class="overlay" id="fl-end"><div class="card"><div class="eyebrow" id="fl-eeyebrow">Flight ended</div><h3 id="fl-etitle"></h3><div id="fl-ebody" class="stack" style="gap:8px"></div><div class="btns">
        <button class="btn" data-a="restart" type="button">Fly again</button><button class="btn sec" data-a="resume-free" type="button" id="fl-continue">Continue flying</button><button class="btn ghost" data-a="exit" type="button">Exit to menu</button></div></div></div>`;
    root.classList.add('on');
    const app = document.getElementById('app');
    if (app) app.inert = true;
    try {
      await loadThree();
      if (version !== launchVersion) return;
      const session = new Session(cfg, onExit, root);
      S = session; window.__sim = session;
      await session.init();
    } catch (e) {
      if (version !== launchVersion) return;
      if (S) { S.dispose(); S = null; }
      root.innerHTML = '<div id="fl-loading" role="alert"><h2>Unable to start flight</h2><p id="fl-ldmsg" style="max-width:440px;padding:0 24px;text-align:center;letter-spacing:0;text-transform:none"></p><button class="btn sec" type="button" id="fl-bail">Back to menu</button></div>';
      root.querySelector('#fl-ldmsg').textContent = 'The 3D engine could not start. Check your connection and that WebGL is available in your browser.';
      console.error('Flight startup failed:', e);
      const back = root.querySelector('#fl-bail');
      back.onclick = () => { stop(); onExit && onExit(null); document.getElementById('page')?.focus(); };
      back.focus();
    }
  }
  function stop() {
    launchVersion++;
    if (S) { S.dispose(); S = null; }
    const app = document.getElementById('app');
    if (app) app.inert = false;
    const root = document.getElementById('flight');
    if (root) { root.classList.remove('on'); root.innerHTML = ''; }
  }

  class Session {
    constructor(cfg, onExit, root) {
      this.cfg = cfg; this.onExit = onExit; this.root = root;
      this.st = cfg.settings; this.ac = cfg.ac; this.fm = Object.assign({}, D.FM[cfg.ac.fm], cfg.ac.fmOver || {});
      this.keys = {}; this.paused = false; this.ended = false; this.timeScale = 1; this.camMode = cfg.settings.camera || 'chase';
      this.hudOn = true; this.orbit = { yaw: Math.PI * .85, pitch: .15, dist: 1 }; this.log = [];
    }
    async init() {
      const T = THREE, cfg = this.cfg, st = this.st;
      const ap = cfg.airport, rwy = cfg.runway;
      this.hdg = rwy.hdg * DEG; this.rwyLen = rwy.len / FT; this.rwyW = this.rwyLen > 2500 ? 45 : 30;
      this.elevM = ap.elev / FT;
      this.terrain = makeTerrain(ap.terrain, this.hdg, this.rwyLen, seedOf(ap.icao));
      // renderer
      const canvas = document.createElement('canvas'); canvas.className = 'gl'; this.root.prepend(canvas); this.canvas = canvas;
      const r = new T.WebGLRenderer({ canvas, antialias: st.aa !== false, powerPreference: 'high-performance', logarithmicDepthBuffer: true }); // log depth: stops runway/terrain z-fighting with a 120 km far plane
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * (st.renderScale || 100) / 100);
      r.shadowMap.enabled = !!st.shadows; r.shadowMap.type = T.PCFSoftShadowMap;
      r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
      this.renderer = r;
      const scene = new T.Scene(); this.scene = scene;
      const cam = new T.PerspectiveCamera(st.fov || 65, 1, 1.0, 120000); this.camera = cam; // near 1 m: better depth precision at distance
      this.viewDist = (st.viewDist || 40) * 1000;
      // lights
      this.hemi = new T.HemisphereLight(0xbfd8ff, 0x3a3226, .9); scene.add(this.hemi);
      this.sun = new T.DirectionalLight(0xffffff, 2.2); this.sun.castShadow = !!st.shadows;
      this.sun.shadow.mapSize.set(2048, 2048); const sc = this.sun.shadow.camera; sc.left = sc.bottom = -80; sc.right = sc.top = 80; sc.near = 1; sc.far = 2000;
      scene.add(this.sun, this.sun.target);
      scene.fog = new T.Fog(0x9fb8d0, 2000, this.viewDist);
      // weather
      const w = cfg.weather; this.wx = w;
      const wd = (w.windDir + 180) * DEG; // wind blows FROM windDir
      this.windBase = new T.Vector3(Math.sin(wd), 0, -Math.cos(wd)).multiplyScalar(w.windSpd / KT);
      this.turb = (w.turb || 0) / 100;
      // world
      this.ldmsg('Building terrain…');
      await new Promise(r => setTimeout(r, 20));
      if (this.disposed) return;
      this.terrainSeg = { low: 200, medium: 300, high: 420, ultra: 560 }[st.quality || 'medium'] || 300;
      this.terrainSize = Math.max(60000, this.viewDist * 2.2);
      this.buildTerrain(0, 0);
      if (this.terrain.water) {
        const wm = new T.Mesh(new T.PlaneGeometry(400000, 400000), new T.MeshStandardMaterial({ color: 0x1d4a6b, roughness: .25, metalness: .3, transparent: true, opacity: .93 }));
        wm.rotation.x = -Math.PI / 2; wm.position.y = -1.5; scene.add(wm); this.waterMesh = wm;
      }
      this.buildAirport();
      this.ldmsg('Placing clouds…');
      this.buildClouds();
      this.buildPrecip();
      // aircraft
      this.model = buildAircraftMesh(this.ac, cfg.livery);
      scene.add(this.model.group);
      this.gearH = -this.model.bottom; // distance from origin to wheel bottom
      this.retract = this.ac.gearFixed !== undefined ? !this.ac.gearFixed && !this.fm.heli : !['ga', 'bush', 'aerobatic', 'glider', 'gliderPerf', 'heli', 'heliLight', 'heliHeavy', 'gaFast'].includes(this.ac.fm) && !this.ac.floats;
      // mission objects
      this.mission = cfg.mission || null;
      this.setTime(cfg.hour);
      this.reset();
      // HUD
      this.hud = this.root.querySelector('#hud'); this.hctx = this.hud.getContext('2d');
      this.mini = this.root.querySelector('#fl-mini'); this.mctx = this.mini.getContext('2d');
      this.mini.style.display = st.minimap === false ? 'none' : '';
      this.el = id => this.root.querySelector(id);
      this.bindInput();
      this.audio = st.sound === false ? null : makeAudio((st.volume ?? 70) / 100 * .6);
      this.resize(); this._onResize = () => this.resize(); window.addEventListener('resize', this._onResize);
      this.root.querySelector('#fl-loading').remove();
      this.last = performance.now(); this.fpsT = 0; this.fpsN = 0; this.fps = 60;
      this.message(this.mission ? this.mission.name : `${cfg.airport.icao} · RWY ${cfg.runway.id}`, 4);
      const loop = t => { if (!this.alive) return; this.raf = requestAnimationFrame(loop); this.frame(t); };
      this.ext = (window.CT_EXT || []).map(f => { try { return f(this, THREE); } catch (e) { console.error(e); return null; } }).filter(Boolean);
      this.alive = true; this.raf = requestAnimationFrame(loop);
    }
    ldmsg(t) { const e = this.root.querySelector('#fl-ldmsg'); if (e) e.textContent = t; }

    buildTerrain(cx, cz) {
      const T = THREE, seg = this.terrainSeg, size = this.terrainSize;
      if (this.terrainMesh) { this.scene.remove(this.terrainMesh); this.terrainMesh.geometry.dispose(); }
      const geo = new T.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3);
      const h = this.terrain.h;
      for (let i = 0; i < n; i++) { const x = pos.getX(i) + cx, z = pos.getZ(i) + cz; pos.setY(i, h(x, z)); }
      geo.computeVertexNormals();
      const nrm = geo.attributes.normal, pal = PALETTES[this.cfg.airport.terrain] || PALETTES.plains;
      const snowLine = pal.snow - (this.wx.temp < 0 ? 900 : 0) - (this.elevM);
      for (let i = 0; i < n; i++) {
        const y = pos.getY(i), slope = 1 - nrm.getY(i), x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
        const v = fbm(x / 900, z / 900, 2, 11) * .25 + .87;
        let c = pal.low.map((a, k) => lerp(a, pal.high[k], clamp(y / 900, 0, 1)));
        if (pal.sand && y < 2.5 && y > -6) c = pal.sand;
        if (y < -2) c = [.55, .52, .44];
        c = c.map((a, k) => lerp(a, pal.rock[k], ss(.18, .42, slope)));
        if (y > snowLine + (fbm(x / 400, z / 400, 2, 3) - .5) * 300 && slope < .55) c = [.93, .95, .97];
        if (this.wx.temp < -1 && slope < .3) c = c.map(a => lerp(a, .95, .7));
        col[i * 3] = c[0] * v; col[i * 3 + 1] = c[1] * v; col[i * 3 + 2] = c[2] * v;
      }
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      const m = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, flatShading: false }));
      m.position.set(cx, 0, cz); m.receiveShadow = true; this.scene.add(m); this.terrainMesh = m; this.tCenter = { x: cx, z: cz };
    }
    buildAirport() {
      const T = THREE, sc = this.scene, L = this.rwyLen, W = this.rwyW, hdg = this.hdg, h = this.terrain.h;
      const grp = new T.Group(); grp.rotation.y = -hdg; sc.add(grp); this.airport = grp;
      const rg = new T.PlaneGeometry(W, L); rg.rotateX(-Math.PI / 2);
      const rm = new T.Mesh(rg, new T.MeshStandardMaterial({ map: runwayTexture(this.cfg.runway.id, this.cfg.runway.len), roughness: .85, polygonOffset: true, polygonOffsetFactor: -2 }));
      rm.position.y = .15; rm.receiveShadow = true; grp.add(rm);
      // shoulders + taxiway + apron
      const asphalt = new T.MeshStandardMaterial({ color: 0x3a3d42, roughness: .9, polygonOffset: true, polygonOffsetFactor: -1 });
      const pl = (w, l, x, z, mat) => { const g = new T.PlaneGeometry(w, l); g.rotateX(-Math.PI / 2); const m = new T.Mesh(g, mat || asphalt); m.position.set(x, .1, z); m.receiveShadow = true; grp.add(m); return m; };
      pl(W + 16, L + 60, 0, 0, new T.MeshStandardMaterial({ color: 0x4a4c48, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
      pl(23, L * .9, W / 2 + 140, 0);
      for (let k = -2; k <= 2; k++) pl(140, 20, W / 2 + 70, k * L * .2);
      pl(260, Math.min(900, L * .35), W / 2 + 320, 0);
      // buildings
      const bmat = new T.MeshStandardMaterial({ color: 0xb7bcc2, roughness: .7 });
      const box = (w, hh, d, x, z, mat) => { const m = new T.Mesh(new T.BoxGeometry(w, hh, d), mat || bmat); m.position.set(x, hh / 2, z); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
      box(60, 18, Math.min(700, L * .3), W / 2 + 500, 0, new T.MeshStandardMaterial({ color: 0x9aa6b2, roughness: .3, metalness: .5 }));
      for (let k = 0; k < 4; k++) box(70, 22, 60, W / 2 + 480, L * .22 + k * 80, new T.MeshStandardMaterial({ color: 0xc9cdd2, roughness: .6 }));
      box(10, 45, 10, W / 2 + 430, -L * .2); const cab = box(16, 6, 16, W / 2 + 430, -L * .2, new T.MeshStandardMaterial({ color: 0x223344, roughness: .1, metalness: .8 })); cab.position.y = 48;
      this.towerPos = new T.Vector3(W / 2 + 430, 52, -L * .2).applyAxisAngle(new T.Vector3(0, 1, 0), -hdg);
      // city / trees (instanced)
      const N = this.st.quality === 'low' ? 250 : 700, dummy = new T.Object3D();
      const city = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .8 }), N);
      let ci = 0; const rnd = mulberry(seedOf(this.cfg.airport.icao));
      const tcol = new T.Color();
      for (let i = 0; i < N * 4 && ci < N; i++) {
        const a = rnd() * Math.PI * 2, d = 2500 + rnd() * 9000, x = Math.cos(a) * d, z = Math.sin(a) * d;
        const along = x * this.terrain.dir.x + z * this.terrain.dir.z, lat = x * this.terrain.perp.x + z * this.terrain.perp.z;
        if (Math.abs(lat) < 900 && Math.abs(along) < L / 2 + 12000) continue; // keep approach paths clear
        const y = h(x, z); if (y < 2) continue;
        const s0 = h(x + 30, z), s1 = h(x, z + 30); if (Math.abs(s0 - y) > 8 || Math.abs(s1 - y) > 8) continue;
        const bw = 25 + rnd() * 50, bh = 8 + Math.pow(rnd(), 3) * (d < 5000 ? 40 : 110);
        dummy.position.set(x, y + bh / 2 - 1, z); dummy.scale.set(bw, bh, bw * (.6 + rnd())); dummy.rotation.y = rnd() * Math.PI; dummy.updateMatrix();
        city.setMatrixAt(ci, dummy.matrix); tcol.setHSL(.58, .05, .45 + rnd() * .35); city.setColorAt(ci, tcol); ci++;
      }
      city.count = ci; city.castShadow = true; sc.add(city);
      const treeTypes = ['forest-mountain', 'alpine', 'plains', 'coast-hills', 'island', 'snow-mountain', 'coast-flat'];
      if (treeTypes.includes(this.cfg.airport.terrain)) {
        const NT = this.st.quality === 'low' ? 1500 : 5000;
        const tree = new T.InstancedMesh(new T.ConeGeometry(1, 1, 6).translate(0, .5, 0), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), NT);
        let ti = 0;
        for (let i = 0; i < NT * 3 && ti < NT; i++) {
          const a = rnd() * Math.PI * 2, d = 700 + rnd() * 14000, x = Math.cos(a) * d, z = Math.sin(a) * d;
          const lat = x * this.terrain.perp.x + z * this.terrain.perp.z, along = x * this.terrain.dir.x + z * this.terrain.dir.z;
          if (Math.abs(lat) < 350 && Math.abs(along) < L / 2 + 3000) continue;
          const y = h(x, z); if (y < 3 || y > 1800) continue;
          const th = 10 + rnd() * 16; dummy.position.set(x, y - 1, z); dummy.scale.set(th * .35, th, th * .35); dummy.rotation.y = 0; dummy.updateMatrix(); tree.setMatrixAt(ti, dummy.matrix);
          tcol.setHSL(.28 + rnd() * .06, .45, .14 + rnd() * .1); tree.setColorAt(ti, tcol); ti++;
        }
        tree.count = ti; sc.add(tree);
      }
      // runway lights (points)
      const lp = [], lc = [];
      const pushL = (x, z, c) => { lp.push(x, .8, z); lc.push(...c); };
      for (let zz = -L / 2; zz <= L / 2; zz += 60) { pushL(-W / 2 - 1, zz, [1, .95, .8]); pushL(W / 2 + 1, zz, [1, .95, .8]); }
      for (let xx = -W / 2; xx <= W / 2; xx += 3) { pushL(xx, L / 2 + 2, [.2, 1, .3]); pushL(xx, -L / 2 - 2, [1, .2, .2]); }
      for (let k = 1; k <= 30; k++) for (let xx = -8; xx <= 8; xx += 4) pushL(xx, L / 2 + k * 30, [1, 1, .9]);
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); lg.setAttribute('color', new T.Float32BufferAttribute(lc, 3));
      this.rwyLights = new T.Points(lg, new T.PointsMaterial({ size: 3, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false, fog: false }));
      grp.add(this.rwyLights);
      // PAPI at touchdown zone, left side (both ends)
      this.papi = [];
      [1, -1].forEach(end => {
        for (let i = 0; i < 4; i++) {
          const m = new T.Mesh(new T.SphereGeometry(1.2, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff, fog: false }));
          const z = end * (L / 2 - 300), x = -end * (W / 2 + 15 + i * 9);
          m.position.set(x, 1, z); grp.add(m); this.papi.push({ m, end, i });
        }
      });
      // windsock
      const sock = new T.Mesh(new T.ConeGeometry(1, 6, 10, 1, true), new T.MeshStandardMaterial({ color: 0xff7a1a, side: T.DoubleSide }));
      sock.position.set(W / 2 + 60, 9, L / 2 - 400); sc.add(sock); this.sock = sock; this.sock.position.applyAxisAngle(new T.Vector3(0, 1, 0), -hdg);
      const pole = new T.Mesh(new T.CylinderGeometry(.2, .2, 9), new T.MeshStandardMaterial({ color: 0xdddddd })); pole.position.copy(sock.position); pole.position.y = 4.5; sc.add(pole);
    }
    buildClouds() {
      const T = THREE, w = this.wx; if (this.st.clouds === false || !w.clouds) return;
      const tex = puffTexture(), cov = w.clouds / 100;
      const base = (w.cloudBase ? w.cloudBase / FT : (cov > .8 ? 700 : 1300)), n = Math.round((this.st.quality === 'low' ? 160 : 420) * cov) + 10;
      const rnd = mulberry(77), grp = new T.Group();
      const dark = w.precip > 50 ? .55 : cov > .8 ? .78 : 1;
      const mat = new T.SpriteMaterial({ map: tex, color: new T.Color(dark, dark, dark * 1.02), transparent: true, depthWrite: false, opacity: .95 });
      this.cloudMat = mat;
      for (let i = 0; i < n; i++) {
        const cx = (rnd() - .5) * 50000, cz = (rnd() - .5) * 50000, k = 3 + Math.floor(rnd() * 6), size = 500 + rnd() * 900;
        for (let j = 0; j < k; j++) {
          const sp = new T.Sprite(mat); const s = size * (.6 + rnd() * .7);
          sp.scale.set(s, s * .6, 1); sp.position.set(cx + (rnd() - .5) * size * 1.6, base + rnd() * size * .5 * (cov > .8 ? .5 : 1) + this.elevM * 0, cz + (rnd() - .5) * size * 1.6);
          grp.add(sp);
        }
      }
      this.scene.add(grp); this.clouds = grp; this.cloudBase = base;
    }
    buildPrecip() {
      const T = THREE, w = this.wx; if (!w.precip) return;
      const n = Math.round(w.precip * 40), p = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) p[i] = (Math.random() - .5) * 200;
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3));
      const snow = w.temp <= 0;
      this.precip = new T.Points(g, new T.PointsMaterial({ color: snow ? 0xffffff : 0xaabbcc, size: snow ? .5 : .25, transparent: true, opacity: snow ? .9 : .6, depthWrite: false }));
      this.precipSnow = snow; this.scene.add(this.precip);
    }
    setTime(hour) {
      const T = THREE; this.hour = hour;
      const elev = Math.sin((hour - 6) / 12 * Math.PI); // -1..1
      const az = (hour / 24) * Math.PI * 2 + Math.PI;
      const sunDir = new T.Vector3(Math.sin(az) * Math.cos(elev), Math.max(elev, -.3), Math.cos(az) * Math.cos(elev)).normalize();
      this.sunDir = sunDir;
      const day = ss(-.12, .25, elev), dusk = (1 - Math.abs(ss(-.15, .35, elev) * 2 - 1)) * (elev > -.2 ? 1 : 0);
      const ov = this.wx.clouds / 100 * .55 + (this.wx.precip / 100) * .3;
      const sky = new T.Color().setRGB(lerp(.02, .45, day), lerp(.03, .63, day), lerp(.07, .86, day));
      sky.lerp(new T.Color(1, .55, .35), dusk * .35).lerp(new T.Color(.55, .58, .62).multiplyScalar(lerp(.12, 1, day)), ov);
      this.scene.background = sky;
      const fogC = sky.clone().lerp(new T.Color(.75, .8, .85).multiplyScalar(lerp(.1, 1, day)), .4);
      this.scene.fog.color.copy(fogC);
      const vis = Math.max(400, (this.wx.vis || 30) * 1000);
      this.scene.fog.far = Math.min(this.viewDist, vis * 1.2); this.scene.fog.near = Math.min(this.scene.fog.far * .25, vis * .1);
      this.sun.intensity = lerp(0, 2.6, day) * (1 - ov * .6);
      this.sun.color.setRGB(1, lerp(.6, .97, ss(0, .4, elev)), lerp(.4, .92, ss(0, .4, elev)));
      this.hemi.intensity = lerp(.08, 1.0, day) * (1 - ov * .3) + .05;
      this.night = day < .35;
      if (this.rwyLights) this.rwyLights.material.size = this.night ? 4 : 1.6;
      if (this.cloudMat) this.cloudMat.color.setScalar(lerp(.12, 1, day) * (this.wx.precip > 50 ? .6 : 1));
      this.renderer.toneMappingExposure = lerp(.7, 1.0, day);
    }

    /* ---------- spawn ---------- */
    reset() {
      clearTimeout(this.finishTimer);
      this.result = null; this.log = []; this._prevD = undefined; this._failAt = null;
      if (this.smoke) { this.scene.remove(this.smoke); this.smoke.geometry.dispose(); this.smoke.material.dispose(); this.smoke = null; }
      if (this.fire) { this.scene.remove(this.fire); this.fire = null; }
      const T = THREE, fm = this.fm, cfg = this.cfg, L = this.rwyLen;
      const dir = new T.Vector3(this.terrain.dir.x, 0, this.terrain.dir.z);
      const s = {
        p: new T.Vector3(), v: new T.Vector3(), q: new T.Quaternion(), w: new T.Vector3(),
        thr: 0, flaps: 0, flapsT: 0, gear: 1, gearT: 1, spoiler: 0, brake: 0, trim: 0,
        fuel: fm.fuelCap * (cfg.fuelPct ?? 70) / 100, payload: (cfg.payloadPct ?? 50) / 100,
        onGround: true, t: 0, dist: 0, maxG: 1, G: 1, crashed: false, landed: false, airborne: false,
        alpha: 0, beta: 0, ias: 0, vs: 0, agl: 0, stall: false, rpm: 0, collective: 0, gates: 0, hoverT: 0, airT: 0
      };
      this.s = s;
      const start = this.mission ? this.mission.start : cfg.start;
      const heading = this.hdg;
      const vapp = this.vref() * 1.25;
      if (start === 'final' && !fm.heli) {
        // start on the 3° glideslope, but never inside a hill: use the longest final whose path stays clear of terrain
        const gsAt = x => x * Math.tan(3 * DEG) + 15, gAt = x => { const a = -(L / 2) + 300 - x; return this.groundAt(dir.x * a, dir.z * a); };
        let d = 10000;
        for (; d > 3000; d -= 500) { let ok = true; for (let x = 0; x <= d; x += 100) if (gAt(x) > gsAt(x) - 60) { ok = false; break; } if (ok) break; }
        let hi = -1e9; for (let x = 0; x <= d; x += 100) hi = Math.max(hi, gAt(x));
        const alt = Math.max(gsAt(d), hi + 150);
        s.p.copy(dir).multiplyScalar(-(L / 2) + 300 - d); s.p.y = alt;
        s.v.copy(dir).multiplyScalar(vapp); s.v.y = -vapp * Math.tan(3 * DEG);
        s.flaps = s.flapsT = fm.flapCl > .3 ? 1 : .5; s.gear = s.gearT = 1; s.thr = this.trimThrottle(vapp, s.flaps, 1) ; s.onGround = false; s.airborne = true;
        this.setAttitude(heading, 2 * DEG, 0);
      } else if (start === 'air' || (start === 'final' && fm.heli)) {
        const along = -(L / 2) - 2500;
        s.p.copy(dir).multiplyScalar(along);
        const gh = Math.max(0, this.terrain.h(s.p.x, s.p.z));
        const vc = fm.heli ? 35 : Math.max(vapp * 1.6, Math.min(fm.vne * .55, vapp * 2.2));
        s.p.y = gh + (fm.fm === 'glider' ? 900 : this.mission && this.mission.type === 'rings' ? 260 : 900);
        if (this.ac.fm.startsWith('glider')) s.p.y = gh + 920;
        s.v.copy(dir).multiplyScalar(vc); s.gear = s.gearT = this.retract ? 0 : 1; s.thr = fm.heli ? .62 : this.trimThrottle(vc, 0, s.gear);
        s.onGround = false; s.airborne = true; s.collective = .58;
        this.setAttitude(heading, 0, 0);
      } else {
        s.p.copy(dir).multiplyScalar(-(L / 2) + 40); s.p.y = this.gearH + .2;
        this.setAttitude(heading, 0, 0); s.thr = 0;
        if (!fm.heli && fm.flapCl > .3) s.flaps = s.flapsT = .5;
      }
      // mission gates
      if (this.ringGroup) { this.scene.remove(this.ringGroup); this.ringGroup = null; }
      this.gates = [];
      if (this.mission && this.mission.type === 'rings') this.buildGates();
      if (this.mission && this.mission.wind) { const wd = (this.mission.wind.dir + 180) * DEG; this.windBase.set(Math.sin(wd), 0, -Math.cos(wd)).multiplyScalar(this.mission.wind.spd / KT); }
      // thermals
      this.thermals = [];
      const rnd = mulberry(5);
      for (let i = 0; i < 14; i++) this.thermals.push({ x: (rnd() - .5) * 16000, z: (rnd() - .5) * 16000, r: 250 + rnd() * 250, w: 2.5 + rnd() * 3 });
      if (start === 'air') { const tp = s.p.clone().addScaledVector(dir, 1800); this.thermals[0] = { x: tp.x, z: tp.z, r: 400, w: 4.5 }; }
      this.ended = false; this.endShown = false; this.root.querySelector('#fl-end').classList.remove('on');
      this.camSmooth = null; this.events = []; this.lastCallout = 9999; this.touch = null;
      this.engMul = 1; this.gearJam = false; this.flapJam = false; this.elecFail = false;
      (this.ext || []).forEach(x => x.reset && x.reset());
    }
    vref() { const fm = this.fm; if (fm.heli) return 20; const m = this.mass(); return Math.sqrt(2 * m * G0 / (1.225 * fm.S * (fm.clmax + fm.flapCl))); }
    mass() { const fm = this.fm, s = this.s; return fm.m * (.8 + .25 * (s ? s.payload : .5)) + (s ? s.fuel : 0) * .6 + (this.cfg.extraMass || 0); }
    trimThrottle(V, flaps, gear) {
      const fm = this.fm; if (!fm.T) return 0; const m = this.mass();
      const q = .5 * 1.225 * V * V, CL = m * G0 / (q * fm.S), CD = fm.cd0 + fm.k * CL * CL + flaps * .03 + gear * .015;
      return clamp(q * fm.S * CD / (fm.T * this.thrustLapse(V, 0)), 0, 1);
    }
    thrustLapse(V, alt) {
      const fm = this.fm, rho = 1.225 * Math.exp(-alt / 8500);
      const prop = ['ga', 'gaFast', 'gaTwin', 'aerobatic', 'bush', 'warbird', 'dc3', 'turboprop', 'transport', 'sturboprop'].includes(this.ac.fm);
      if (prop) return Math.pow(rho / 1.225, .7) * clamp(1.15 - V / (fm.vne * 1.25), .25, 1.1);
      return Math.pow(rho / 1.225, .75) * Math.max(.6, 1 - V / 900);
    }
    setAttitude(h, p, b) { this.s.q.setFromEuler(new THREE.Euler(p, -h, -b, 'YXZ')); }
    attitude() {
      const T = THREE, q = this.s.q;
      const f = new T.Vector3(0, 0, -1).applyQuaternion(q), u = new T.Vector3(0, 1, 0).applyQuaternion(q), r = new T.Vector3(1, 0, 0).applyQuaternion(q);
      const pitch = Math.asin(clamp(f.y, -1, 1)), heading = Math.atan2(f.x, -f.z);
      const bank = Math.atan2(-r.y, u.y);
      return { pitch, heading, bank, f, u, r };
    }
    buildGates() {
      const T = THREE, s = this.s, grp = new T.Group(), tight = this.mission.tight, n = this.mission.rings || 10;
      const rnd = mulberry(seedOf(this.mission.id));
      let p = s.p.clone(), hdg = this.hdg, alt = p.y;
      for (let i = 0; i < n; i++) {
        hdg += (rnd() - .5) * (tight ? 1.6 : 1.0);
        const step = tight ? 700 : (this.ac.cat === 'Military' ? 2200 : 1400);
        p = p.clone().add(new T.Vector3(Math.sin(hdg) * step, 0, -Math.cos(hdg) * step));
        const gh = Math.max(0, this.terrain.h(p.x, p.z));
        alt = clamp(alt + (rnd() - .5) * (tight ? 300 : 260), gh + (tight ? 150 : 90), gh + 700);
        p.y = alt;
        const R = tight ? 28 : (this.ac.cat === 'Military' ? 45 : 35);
        const ring = new T.Mesh(new T.TorusGeometry(R, 2.2, 8, 40), new T.MeshBasicMaterial({ color: i === 0 ? 0xF5B942 : 0x57C7DB, fog: false }));
        ring.position.copy(p); ring.rotation.y = -hdg; grp.add(ring);
        this.gates.push({ p: p.clone(), n: new T.Vector3(Math.sin(hdg), 0, -Math.cos(hdg)), R, mesh: ring, passed: false, missed: false });
      }
      this.scene.add(grp); this.ringGroup = grp; this.gateIdx = 0;
    }

    /* ---------- input ---------- */
    bindInput() {
      const kb = this.st.keys || D.DEFAULT_KEYS; this.kb = kb;
      const act = code => Object.keys(kb).find(k => kb[k] === code);
      this._kd = e => {
        // Native controls retain Space, Enter and arrow-key behavior while a menu is open.
        if (e.code !== 'Escape' && e.target?.closest?.('button,input,select,textarea')) return;
        const a = act(e.code);
        if (e.code === 'Escape') { e.preventDefault(); if ((this.ext || []).some(x => x.escape && x.escape())) return; this.togglePause(); return; }
        if ((this.ext || []).some(x => x.key && (!this.paused || x.always) && x.key(e))) { e.preventDefault(); return; }
        if (!a && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'BracketLeft', 'BracketRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyM', 'KeyK'].includes(e.code)) return;
        e.preventDefault();
        if (e.repeat) { this.keys[e.code] = true; return; }
        this.keys[e.code] = true;
        const s = this.s;
        if (a === 'pause') this.togglePause();
        else if (this.paused) return;
        else if (a === 'gear') { this.manualGear = true; if (this.gearJam) this.message('Gear failure — no response', 2); else if (this.retract) { if (s.onGround && s.gearT) { this.message('Weight on wheels — gear locked', 2); } else { s.gearT = s.gearT ? 0 : 1; this.message(s.gearT ? 'Gear down' : 'Gear up', 1.5); this.audio && this.audio.beep(440, .2); } } else this.message('Fixed gear', 1.2); }
        else if ((a === 'flapsDown' || a === 'flapsUp') && this.flapJam) this.message('Flap failure — jammed', 2);
        else if (a === 'flapsDown') { this.manualFlaps = true; s.flapsT = clamp(Math.round((s.flapsT + .25) * 4) / 4, 0, 1); this.message(`Flaps ${Math.round(s.flapsT * 100)}%`, 1.2); }
        else if (a === 'flapsUp') { this.manualFlaps = true; s.flapsT = clamp(Math.round((s.flapsT - .25) * 4) / 4, 0, 1); this.message(`Flaps ${Math.round(s.flapsT * 100)}%`, 1.2); }
        else if (a === 'spoilers') { s.spoiler = s.spoiler ? 0 : 1; this.message(s.spoiler ? 'Speed brakes out' : 'Speed brakes in', 1.2); }
        else if (a === 'camera') this.cycleCamera();
        else if (a === 'hud') { this.hudOn = !this.hudOn; }
        else if (a === 'timeAccel') { this.timeScale = this.timeScale >= 4 ? 1 : this.timeScale * 2; this.message(`Sim rate ×${this.timeScale}`, 1.2); }
        else if (e.code === 'Digit1') this.setCam('cockpit'); else if (e.code === 'Digit2') this.setCam('chase'); else if (e.code === 'Digit3') this.setCam('orbit'); else if (e.code === 'Digit4') this.setCam('tower'); else if (e.code === 'Digit5') this.setCam('flyby');
        else if (e.code === 'KeyK') { if (this.keypad) this.keypad.toggle(); }
        else if (e.code === 'KeyM') { this.mini.style.display = this.mini.style.display === 'none' ? '' : 'none'; }
      };
      this._ku = e => { this.keys[e.code] = false; };
      window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
      // mouse orbit + wheel zoom
      let drag = null;
      this._md = e => { if (e.target !== this.canvas && e.target !== this.hud) return; drag = { x: e.clientX, y: e.clientY }; };
      this._mm = e => {
        if (this.st.mouseYoke && !drag) { const r = this.canvas.getBoundingClientRect(); this.mouseYoke = { x: clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), y: clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1) }; }
        if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
        if (this.camMode === 'chase' || this.camMode === 'flyby' || this.camMode === 'tower') this.setCam('orbit');
        this.orbit.yaw -= dx * .006; this.orbit.pitch = clamp(this.orbit.pitch + dy * .005, -1.3, 1.4);
        if (this.camMode === 'cockpit') { this.look = this.look || { y: 0, p: 0 }; this.look.y = clamp(this.look.y - dx * .004, -2.6, 2.6); this.look.p = clamp(this.look.p - dy * .004, -1, 1.2); }
      };
      this._mu = () => { drag = null; };
      this._wh = e => { if (!this.root.contains(e.target)) return; this.orbit.dist = clamp(this.orbit.dist * (e.deltaY > 0 ? 1.1 : .9), .35, 6); };
      window.addEventListener('mousedown', this._md); window.addEventListener('mousemove', this._mm); window.addEventListener('mouseup', this._mu); window.addEventListener('wheel', this._wh, { passive: true });
      this.root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => this.menu(b.dataset.a));
      const tod = this.root.querySelector('#fl-tod'), todv = this.root.querySelector('#fl-todv');
      tod.value = this.hour; todv.textContent = fmtHour(this.hour);
      tod.oninput = () => { this.setTime(+tod.value); todv.textContent = fmtHour(+tod.value); };
      this._blur = () => { this.keys = {}; if (this.st.pauseOnBlur !== false && !this.ended && !this.paused) this.togglePause(true); };
      window.addEventListener('blur', this._blur);
    }
    menu(a) {
      if (a === 'resume') this.togglePause(false);
      else if (a === 'restart') { this.reset(); this.togglePause(false); this.root.querySelector('#fl-end').classList.remove('on'); }
      else if (a === 'camera') this.cycleCamera();
      else if (a === 'resume-free') { this.root.querySelector('#fl-end').classList.remove('on'); this.ended = false; this.mission = null; if (this.ringGroup) { this.scene.remove(this.ringGroup); this.ringGroup = null; } this.gates = []; }
      else if (a === 'exit') { const res = this.summary(); const cb = this.onExit; stop(); cb && cb(res); }
    }
    togglePause(v) {
      if (this.ended) return;
      this.paused = v === undefined ? !this.paused : v;
      this.root.querySelector('#fl-pause').classList.toggle('on', this.paused);
      this.keys = {};
      if (this.paused) this.root.querySelector('#fl-pause [data-a="resume"]').focus();
      else { this.canvas.tabIndex = -1; this.canvas.focus(); }
      if (this.audio) this.paused ? this.audio.ctx.suspend() : this.audio.ctx.resume();
    }
    cycleCamera() { const m = ['chase', 'cockpit', 'orbit', 'tower', 'flyby']; this.setCam(m[(m.indexOf(this.camMode) + 1) % m.length]); }
    setCam(m) { this.camMode = m; this.camSmooth = null; this.look = { y: 0, p: 0 }; if (m === 'flyby') this.flybyPos = null; this.message({ chase: 'Chase camera', cockpit: 'Cockpit view', orbit: 'Orbit camera — drag to look', tower: 'Tower camera', flyby: 'Fly-by camera' }[m], 1.2); }
    axis(neg, pos) { const k = this.keys, kb = this.kb; return (k[kb[pos]] ? 1 : 0) - (k[kb[neg]] ? 1 : 0); }
    readControls(dt) {
      const st = this.st, k = this.keys, s = this.s;
      const heli = !!this.fm.heli;
      let pitch = this.axis('pitchUp', 'pitchDown'), roll = this.axis('rollLeft', 'rollRight'), yaw = this.axis('yawLeft', 'yawRight');
      pitch += (k.ArrowDown && this.kb.pitchUp !== 'ArrowDown' ? 1 : 0) - (k.ArrowUp && this.kb.pitchDown !== 'ArrowUp' ? 1 : 0);
      roll += (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0);
      const fwd = this.axis('throttleDown', 'throttleUp'), upDn = this.axis('descend', 'climb');
      let thrIn, colIn;
      if (heli) { pitch += fwd; colIn = upDn; thrIn = 0; }   // helicopter: W/S tilt forward/back, Space/Shift collective
      else { pitch -= upDn; thrIn = fwd; }                     // aeroplane: W/S throttle, Space/Shift nose up/down
      thrIn += (k.PageUp ? 1 : 0) - (k.PageDown ? 1 : 0);
      if (!this.st.noAutoRudder) yaw += clamp(roll, -1, 1) * .35; // simple coordinated turns with A/D
      // gamepad
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = pads && [...pads].find(p => p && p.connected);
      const dz = (st.deadzone ?? 8) / 100, dzf = v => Math.abs(v) < dz ? 0 : Math.sign(v) * (Math.abs(v) - dz) / (1 - dz);
      let analog = null;
      if (gp) {
        const ax = gp.axes;
        analog = { roll: dzf(ax[0] || 0), pitch: dzf(ax[1] || 0), yaw: dzf(ax[2] || 0) };
        const rt = gp.buttons[7] ? gp.buttons[7].value : 0, lt = gp.buttons[6] ? gp.buttons[6].value : 0;
        thrIn += rt - lt + (-dzf(ax[3] || 0));
        if (gp.buttons[0] && gp.buttons[0].pressed && !this._gpA) { s.gearT = this.retract && !s.onGround ? 1 - s.gearT : s.gearT; } this._gpA = gp.buttons[0] && gp.buttons[0].pressed;
        if (gp.buttons[4] && gp.buttons[4].pressed) { s.brake = 1; }
      }
      if (this.st.mouseYoke && this.mouseYoke) analog = { roll: this.mouseYoke.x, pitch: this.mouseYoke.y, yaw: analog ? analog.yaw : 0 };
      const sens = (st.sensitivity ?? 100) / 100, expo = (st.expo ?? 30) / 100;
      const curve = v => (1 - expo) * v + expo * v * v * v;
      const inv = st.invertPitch ? -1 : 1;
      this.ctl = this.ctl || { pitch: 0, roll: 0, yaw: 0 };
      const ease = (cur, tgt, rate) => cur + clamp(tgt - cur, -rate * dt, rate * dt);
      const tp = analog && Math.abs(analog.pitch) > .02 ? analog.pitch : clamp(pitch, -1, 1);
      const tr = analog && Math.abs(analog.roll) > .02 ? analog.roll : clamp(roll, -1, 1);
      const ty = analog && Math.abs(analog.yaw) > .05 ? analog.yaw : clamp(yaw, -1, 1);
      this.ctl.pitch = ease(this.ctl.pitch, curve(tp) * sens * inv, 4); this.ctl.roll = ease(this.ctl.roll, curve(tr) * sens, 5); this.ctl.yaw = ease(this.ctl.yaw, curve(ty) * sens, 3);
      // Simple flight assist: keys set a target attitude instead of a raw rate; releasing keys levels the aircraft.
      this.assist = !heli && st.simpleFlight !== false && !(analog && (Math.abs(analog.pitch) > .02 || Math.abs(analog.roll) > .02));
      if (this.assist && !s.onGround) {
        const a = this.attitude(), stallM = (this.fm.stall * DEG) - 4 * DEG;
        const climbP = Math.min(14 * DEG, stallM), diveP = -10 * DEG;
        const pIn = clamp(-pitch, -1, 1); // + = nose up
        // no input: hold level flight (zero vertical speed); near the ground let the nose settle for a flare
        let tPitch = pIn > 0 ? climbP * pIn : pIn < 0 ? diveP * -pIn : clamp(a.pitch - s.v.y * .012, diveP * .6, climbP * .8);
        // never command more than ~stall-4° angle of attack
        if (s.alpha > stallM && tPitch > a.pitch) tPitch = a.pitch - .02;
        const tBank = clamp(roll, -1, 1) * 32 * DEG;
        const pr = clamp((tPitch - a.pitch) * 3, -1, 1), rr = clamp((tBank - a.bank) * 2.5, -1, 1);
        this.ctl.pitch = ease(this.ctl.pitch, -pr, 6); this.ctl.roll = ease(this.ctl.roll, rr, 6);
        this.ctl.yaw = ease(this.ctl.yaw, clamp(yaw, -1, 1) + Math.sin(a.bank) * .4, 3);
      } else if (this.assist && s.onGround) { this._holdP = null; this.ctl.pitch = ease(this.ctl.pitch, pitch < 0 ? -.8 : pitch > 0 ? .5 : 0, 4); }
      // trim
      if (k.BracketLeft) s.trim = clamp(s.trim - dt * .3, -1, 1); if (k.BracketRight) s.trim = clamp(s.trim + dt * .3, -1, 1);
      if (heli) s.collective = clamp(s.collective + ((colIn || 0) + thrIn) * dt * .45, 0, 1);
      else s.thr = clamp(s.thr + thrIn * dt * .55, 0, 1);
      if (!gp || !(gp.buttons[4] && gp.buttons[4].pressed)) s.brake = k[this.kb.brakes] ? 1 : 0;
    }

    /* ---------- physics ---------- */
    step(dt) {
      const T = THREE, s = this.s, fm = this.fm, st = this.st, real = st.realism || {};
      const m = this.mass();
      if (st.autoSystems !== false && !this.ended) {
        // Simple mode: gear, flaps and brakes look after themselves
        if (this.retract && !this.gearJam && !this.manualGear) { if (!s.onGround && s.agl * FT > 300 && s.vs > 0) s.gearT = 0; if (s.gearT === 0 && (s.agl * FT < 900 && s.vs < -1 || s.ias * KT < this.vref() * KT * 1.15)) s.gearT = 1; }
        if (!fm.heli && fm.flapCl > .1 && !this.flapJam && !this.manualFlaps) { const vr = this.vref(); s.flapsT = s.onGround ? (s.thr > .3 || s.ias > 5 ? .5 : s.flapsT) : s.ias < vr * 1.35 ? 1 : s.ias < vr * 1.7 ? .5 : 0; }
        if (s.onGround && s.thr < .05 && s.airT > 5 && !fm.heli) s.brake = Math.max(s.brake, .8);
      }
      s.flaps += clamp(s.flapsT - s.flaps, -dt * .25, dt * .25);
      s.gear += clamp(s.gearT - s.gear, -dt * .15, dt * .15);
      const alt = s.p.y + this.elevM, rho = 1.225 * Math.exp(-alt / 8500);
      // wind + turbulence + thermals
      const wind = this.windBase.clone().multiplyScalar(ss(0, 300, s.p.y) * .5 + .5);
      if (this.turb > 0) {
        const t = s.t;
        wind.x += (vnoise(t * .6, 1, 3) - .5) * 14 * this.turb; wind.z += (vnoise(t * .6, 9, 4) - .5) * 14 * this.turb; wind.y += (vnoise(t * .9, 5, 5) - .5) * 9 * this.turb;
      }
      let lift0 = 0;
      for (const th of this.thermals) { const d = Math.hypot(s.p.x - th.x, s.p.z - th.z); if (d < th.r * 2) lift0 += th.w * Math.exp(-(d * d) / (th.r * th.r)) * ss(30, 200, s.p.y - Math.max(0, this.terrain.h(s.p.x, s.p.z))) * (1 - ss(1800, 2600, s.p.y)); }
      if (this.ac.fm.startsWith('glider')) wind.y += lift0 - .4; else wind.y += lift0 * .4;
      s.lift = lift0;
      const vAir = s.v.clone().sub(wind), V = vAir.length();
      const qInv = s.q.clone().invert(), vb = vAir.clone().applyQuaternion(qInv);
      const fwd = new T.Vector3(0, 0, -1).applyQuaternion(s.q), up = new T.Vector3(0, 1, 0).applyQuaternion(s.q), right = new T.Vector3(1, 0, 0).applyQuaternion(s.q);
      s.alpha = V > 2 ? Math.atan2(-vb.y, -vb.z) : 0; s.beta = V > 2 ? Math.atan2(vb.x, -vb.z) : 0;
      const qd = .5 * rho * V * V; s.ias = Math.sqrt(qd / (.5 * 1.225));
      const F = new T.Vector3(0, -m * G0, 0);
      let aeroUp = 0;
      const fuelOk = s.fuel > 0 || real.unlimitedFuel;
      if (fm.heli) {
        const groundEff = 1 + .12 * (1 - ss(0, 15, s.agl));
        const thrust = m * G0 * fm.lift * s.collective * groundEff * (fuelOk ? 1 : 0) * Math.pow(rho / 1.225, .6) * (this.engMul ?? 1);
        F.addScaledVector(up, thrust); aeroUp = thrust;
        F.addScaledVector(vAir, -fm.drag * V * m * .02);
        F.addScaledVector(vAir, -m * .05);
      } else {
        const stallA = fm.stall * DEG - s.flaps * 1.5 * DEG, CLa = 5.7;
        const cl0 = .15 + s.flaps * fm.flapCl;
        let CL;
        const a = s.alpha;
        if (Math.abs(a) <= stallA) CL = CLa * a + cl0;
        else { const over = Math.abs(a) - stallA; CL = Math.sign(a) * (CLa * stallA + cl0) * Math.max(.45, 1 - over * 3) ; }
        CL = clamp(CL, -fm.clmax, fm.clmax + fm.flapCl * s.flaps);
        s.stall = Math.abs(a) > stallA && V > 5 && !s.onGround;
        s.stallWarn = (a > stallA - 3 * DEG) && !s.onGround && V > 5;
        const CD = fm.cd0 * (1 + (this.cfg.dragIndex || 0) / 400) + fm.k * CL * CL + s.flaps * .035 + s.gear * .018 + s.spoiler * .06 + (s.stall ? .1 : 0) + Math.abs(s.beta) * .3;
        const vDir = V > .1 ? vAir.clone().divideScalar(V) : fwd.clone();
        const liftDir = new T.Vector3().crossVectors(right, vDir).normalize();
        const Lf = qd * fm.S * CL * (1 - s.spoiler * .25), Df = qd * fm.S * CD;
        F.addScaledVector(liftDir, Lf); F.addScaledVector(vDir, -Df);
        F.addScaledVector(right, -s.beta * qd * fm.S * .6);
        aeroUp = Lf * liftDir.dot(up);
        let thr = s.thr; const ab = fm.ab && thr > .96;
        s.ab = ab;
        const thrust = fm.T * thr * this.thrustLapse(V, alt) * (ab ? 1.55 : 1) * (fuelOk ? 1 : 0) * (this.engMul ?? 1);
        F.addScaledVector(fwd, thrust);
        this.trimAlpha = clamp((m * G0 / Math.max(qd * fm.S, 1) - cl0) / CLa, -4 * DEG, stallA * .7);
      }
      // ground contact
      const gh = this.groundAt(s.p.x, s.p.z);
      const wheelY = s.p.y - this.gearH;
      s.agl = Math.max(0, wheelY - gh);
      const contact = wheelY <= gh + .02 && s.v.y <= .05;
      const att = this.attitude();
      if (contact) {
        const onRwy = this.onRunway(s.p);
        // a real touchdown needs a real hop: rolling bumps on rough ground are not landings
        if (!s.onGround && s.airborne && (s._hop > .6 || s.t - (s._liftT || 0) > .8 || s.v.y < -1.5)) this.touchdown(onRwy, att, gh);
        s.onGround = true;
        {
          if (wheelY < gh) s.p.y = gh + this.gearH;
          if (s.v.y < 0) s.v.y = 0;
          if (F.y < 0) F.y = 0;
          // friction
          const hv = new T.Vector3(s.v.x, 0, s.v.z), hs = hv.length();
          if (hs > .05) {
            const fh = new T.Vector3(fwd.x, 0, fwd.z).normalize(), side = new T.Vector3(-fh.z, 0, fh.x);
            const vf = hv.dot(fh), vsd = hv.dot(side);
            const rough = onRwy || this.ac.floats ? 1 : 2.5;
            const mu = .015 * rough + s.brake * (fm.heli ? .3 : .55) + (this.ended === 'crashed' ? .6 : 0);
            F.addScaledVector(fh, -Math.sign(vf) * Math.min(Math.abs(vf) * m / dt * .9, mu * m * G0));
            F.addScaledVector(side, -vsd * m * 6);
          }
        }
      } else { if (s.onGround) { s._liftT = s.t; s._hop = 0; } s.onGround = false; s._hop = Math.max(s._hop || 0, s.agl); if (s.agl > 3) s.airborne = true; }
      // integrate linear
      const acc = F.divideScalar(m);
      s.G = aeroUp / (m * G0);
      s.maxG = Math.max(s.maxG, s.G);
      s.v.addScaledVector(acc, dt);
      if (contact && s.v.y < 0) s.v.y = 0;
      s.p.addScaledVector(s.v, dt);
      s.dist += s.v.length() * dt;
      s.vs = s.v.y;
      // rotation
      const c = this.ctl, auth = fm.heli ? 1 : clamp(qd / (.5 * 1.225 * fm.vr * fm.vr), .02, 1.3);
      let pr, rr, yr;
      if (fm.heli) {
        pr = -c.pitch * fm.pitch; rr = -c.roll * fm.roll; yr = -c.yaw * fm.yaw;
        if (real.assists !== false) { // attitude hold assist
          pr += -att.pitch * 1.2 * (Math.abs(c.pitch) < .05 ? 1 : .2); rr += att.bank * 1.5 * (Math.abs(c.roll) < .05 ? 1 : .2);
        }
        // translational lift weathervane
        if (V > 15) yr += -s.beta * .8;
      } else {
        const trimA = (real.autoTrim !== false ? (this.trimAlpha || 0) : 0) + s.trim * 4 * DEG;
        pr = -c.pitch * fm.pitch * auth - (s.alpha - trimA) * 2.2 * clamp(auth, .2, 1.2);
        rr = -c.roll * fm.roll * auth;
        yr = -c.yaw * fm.yaw * auth - s.beta * 1.8 * clamp(auth, .1, 1.2);
        if (real.stallProtection && s.alpha > fm.stall * DEG * .85) pr = Math.min(pr, -.3);
        if (real.gLimiter && s.G > fm.gmax * .95 && pr > 0) pr *= .2;
        if (s.stall) { rr += (vnoise(s.t * 2, 3, 1) - .5) * 1.6; pr -= .25; }
        rr -= this.ctl.yaw * .3 * auth; // adverse coupling: rudder rolls a bit
        rr += -s.beta * .4 * auth; // dihedral
        if (s.onGround) {
          const gs = Math.hypot(s.v.x, s.v.z);
          yr = -clamp(c.yaw + c.roll * .8, -1, 1) * clamp(1.2 - gs / 40, .15, .9) * .6;
          rr = att.bank * 4; // level wings on ground
          if (att.pitch < 0 && pr < 0) pr = -att.pitch * 3; // keep nose wheel on ground
          if (s.ias < fm.vr * .6) pr = Math.min(pr, -att.pitch * 2 + .02);
        }
      }
      if (s.onGround && fm.heli) { rr = att.bank * 4; pr = -att.pitch * 4; if (s.collective < .5) { s.v.x *= .9; s.v.z *= .9; } }
      if (this.ended === 'crashed') { pr = rr = yr = 0; }
      const dq = new T.Quaternion();
      dq.setFromEuler(new T.Euler(pr * dt, yr * dt, rr * dt, 'YXZ'));
      s.q.multiply(dq).normalize();
      // fuel
      if (!real.unlimitedFuel && fm.burn) s.fuel = Math.max(0, s.fuel - fm.burn * (fm.heli ? s.collective : s.thr * (s.ab ? 3 : 1) + .05) * dt);
      s.t += dt;
      if (s.airborne && !s.onGround) s.airT += dt;
      // structural / terrain
      if (!this.ended) {
        if (real.crashes !== false) {
          if (s.G > fm.gmax * 1.6 && !fm.heli) this.crash('Structural failure — overstressed at ' + s.G.toFixed(1) + ' G');
          if (s.ias > fm.vne * 1.25) this.crash('Overspeed — airframe failure');
          // non-wheel parts in terrain
          const nose = s.p.clone().addScaledVector(fwd, this.model.length * .45), tail = s.p.clone().addScaledVector(fwd, -this.model.length * .45);
          const wl = s.p.clone().addScaledVector(right, -this.model.span * .48), wr = s.p.clone().addScaledVector(right, this.model.span * .48);
          // fuselage underside sits ~gearH*.5 below the centreline; tail strike on rotation is a warning, not a crash, unless violent
          const slack = this.gearH * .45;
          const checks = [[nose, 'Nose', slack], [wl, 'Left wing', slack * .6], [wr, 'Right wing', slack * .6], [tail, 'Tail', slack]];
          for (const [pt, nm, sl] of checks) { const dig = this.groundAt(pt.x, pt.z) - .2 - (pt.y + sl); if (dig <= 0) continue;
            // a gentle scrape near the ground (slow sink, shallow contact) is a warning, not a crash
            if (s.agl < 1.2 && s.v.y > -3 && dig < this.gearH * .6 + .8) { if (!this._tsT || s.t - this._tsT > 3) { this.message(nm === 'Tail' ? 'Tail strike!' : nm === 'Nose' ? 'Nose scrape — lift the nose!' : `${nm} tip scrape!`, 2); this._tsT = s.t; } continue; }
            this.crash(`${nm} struck the ${this.waterAt(pt) ? 'water' : 'ground'}`); break;
          }
          if (this.retract && s.gear < .5 && contact && !this.ended) this.crash('Gear-up landing');
          // buildings / water w/o floats
          if (contact && this.waterAt(s.p) && !this.ac.floats && !this.ended) this.crash('Ditched in the water');
        }
      }
      if (real.gEffects && !fm.heli) { const g = s.G; this.gloc = clamp((this.gloc || 0) + (g > 6 ? (g - 6) * .25 : g < -2.5 ? .3 : -.4) * dt, 0, 1); } else this.gloc = 0;
      this.missionTick(dt);
    }
    groundAt(x, z) { const h = this.terrain.h(x, z); return this.terrain.water ? Math.max(h, -1.5) : h; }
    waterAt(p) { return this.terrain.water && this.terrain.h(p.x, p.z) < -1.5; }
    onRunway(p) { const al = p.x * this.terrain.dir.x + p.z * this.terrain.dir.z, la = p.x * this.terrain.perp.x + p.z * this.terrain.perp.z; return Math.abs(al) <= this.rwyLen / 2 + 20 && Math.abs(la) <= this.rwyW / 2 + 6; }
    touchdown(onRwy, att, gh) {
      const s = this.s, fpm = -s.v.y * FPM, real = this.st.realism || {};
      const lim = real.crashes === false ? 1e9 : (this.st.difficulty === 'easy' ? 1400 : this.st.difficulty === 'hard' ? 700 : 1000);
      const bank = Math.abs(att.bank) / DEG;
      s.touch = { fpm, bank, onRwy, ias: s.ias * KT, along: s.p.x * this.terrain.dir.x + s.p.z * this.terrain.dir.z + this.rwyLen / 2, lat: s.p.x * this.terrain.perp.x + s.p.z * this.terrain.perp.z, pitch: att.pitch / DEG };
      this.touch = s.touch;
      if (fpm > lim * (this.fm.heli ? .6 : 1)) { this.crash(`Hard landing — ${Math.round(fpm)} fpm`); return; }
      // bank relative to the ground under the wings (sloped fields are fine); only a fast, steeply banked arrival drags a wing
      const T = THREE, rt = new T.Vector3(1, 0, 0).applyQuaternion(s.q), hs = this.model.span * .45, slope = Math.atan2(this.groundAt(s.p.x + rt.x * hs, s.p.z + rt.z * hs) - this.groundAt(s.p.x - rt.x * hs, s.p.z - rt.z * hs), hs * 2) / DEG;
      const relBank = Math.abs(att.bank / DEG - slope), bankLim = this.fm.heli ? 22 : clamp(Math.atan2(this.gearH * 1.25, this.model.span * .5) / DEG + 4, 9, 22);
      if (relBank > bankLim && s.ias * KT > 25 && real.crashes !== false) { this.crash(`Wingtip strike on landing — ${Math.round(relBank)}° bank`); return; }
      const rating = fpm < 120 ? 'Butter' : fpm < 240 ? 'Smooth' : fpm < 400 ? 'Firm' : fpm < 600 ? 'Hard' : 'Very hard';
      this.message(`Touchdown ${Math.round(fpm)} fpm · ${rating}`, 4);
      this.log.push({ fpm, rating, onRwy });
      if (this.mission && this.mission.type === 'land' && !this.ended) {
        const ok = onRwy && fpm <= this.mission.limit;
        this.scheduleFinish(ok ? 'landed' : 'failed', ok ? 'Mission complete' : (onRwy ? `Landed too hard (${Math.round(fpm)} fpm, limit ${this.mission.limit})` : 'Landed off the runway'), this.landingScore(), 2500);
      }
    }
    landingScore() {
      const t = this.touch; if (!t) return 0;
      const vsS = clamp(1 - t.fpm / 700, 0, 1) * 500, clS = clamp(1 - Math.abs(t.lat) / 15, 0, 1) * 300, tdz = clamp(1 - Math.abs(t.along - 400) / 600, 0, 1) * 200;
      return Math.round(vsS + clS + tdz);
    }
    crash(reason) {
      if (this.ended) return;
      this.s.crashed = true; this.ended = 'crashed';
      this.s.thr = 0; this.s.v.multiplyScalar(.15);
      this.audio && this.audio.beep(90, 1.2, .5);
      this.spawnSmoke();
      this.scheduleFinish('crashed', reason, undefined, 1600);
    }
    spawnSmoke() {
      const T = THREE, n = 60, g = new T.BufferGeometry(), p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { p[i * 3] = this.s.p.x + (Math.random() - .5) * 8; p[i * 3 + 1] = this.s.p.y + Math.random() * 30; p[i * 3 + 2] = this.s.p.z + (Math.random() - .5) * 8; }
      g.setAttribute('position', new T.BufferAttribute(p, 3));
      const sm = new T.Points(g, new T.PointsMaterial({ color: 0x222222, size: 14, transparent: true, opacity: .6, depthWrite: false })); this.scene.add(sm); this.smoke = sm;
      const fire = new T.PointLight(0xff7a2a, 50, 200); fire.position.copy(this.s.p); this.scene.add(fire); this.fire = fire;
    }
    missionTick(dt) {
      const M = this.mission, s = this.s; if (!M || this.ended) return;
      if (M.type === 'rings' && this.gates.length) {
        const g = this.gates[this.gateIdx]; if (!g) return;
        const rel = s.p.clone().sub(g.p), d = rel.dot(g.n);
        if (this._prevD !== undefined && this._prevD < 0 && d >= 0) {
          const lateral = rel.clone().addScaledVector(g.n, -d).length();
          if (lateral <= g.R * 1.05) { g.passed = true; s.gates++; g.mesh.material.color.set(0x5BD68A); this.audio && this.audio.beep(988, .25); this.message(`Gate ${this.gateIdx + 1}/${this.gates.length}`, 1.2); }
          else { g.missed = true; g.mesh.material.color.set(0xFF6B6B); this.message(`Missed gate ${this.gateIdx + 1}`, 1.5); this.audio && this.audio.beep(200, .3); }
          this.gateIdx++; this._prevD = undefined;
          if (this.gates[this.gateIdx]) this.gates[this.gateIdx].mesh.material.color.set(0xF5B942);
          else { const score = Math.round(s.gates / this.gates.length * 1000 - s.t * 2 + 300); this.finish(s.gates >= Math.ceil(this.gates.length * .7) ? 'landed' : 'failed', s.gates >= Math.ceil(this.gates.length * .7) ? 'Course complete' : 'Too many gates missed', Math.max(0, score)); }
          return;
        }
        // skipping a gate by flying past far away
        if (rel.length() > 6000 && d > 0) { g.missed = true; g.mesh.material.color.set(0xFF6B6B); this.gateIdx++; this._prevD = undefined; return; }
        this._prevD = d;
      } else if (M.type === 'altitude') {
        if (s.agl * FT >= M.target) this.finish('landed', `Reached ${M.target.toLocaleString()} ft AGL`, Math.max(0, Math.round(1500 - s.t * 5)));
      } else if (M.type === 'survive') {
        if (s.airT >= M.target) this.finish('landed', `Stayed aloft for ${M.target} s`, Math.round(600 + s.p.y));
      } else if (M.type === 'hover') {
        const agl = s.agl * FT, gs = Math.hypot(s.v.x, s.v.z) * KT;
        if (agl >= M.band[0] && agl <= M.band[1] && gs < 8 && Math.abs(s.vs * FPM) < 200) s.hoverT += dt; else s.hoverT = Math.max(0, s.hoverT - dt * .5);
        if (s.hoverT >= M.target) this.finish('landed', 'Hover held', Math.max(0, Math.round(1200 - s.t * 4)));
      }
    }
    scheduleFinish(kind, reason, score, delay) {
      clearTimeout(this.finishTimer);
      this.finishTimer = setTimeout(() => this.finish(kind, reason, score), delay);
    }
    finish(kind, reason, score) {
      if (this.disposed) return;
      if (this.endShown) return; this.endShown = true;
      if (kind !== 'crashed') this.ended = kind;
      const s = this.s, t = this.touch, mins = s.t / 60;
      const el = this.root.querySelector('#fl-end');
      this.root.querySelector('#fl-eeyebrow').textContent = this.mission ? this.mission.name : 'Flight ended';
      this.root.querySelector('#fl-etitle').textContent = kind === 'crashed' ? 'Crashed' : kind === 'failed' ? 'Mission failed' : (this.mission ? 'Mission complete' : 'Flight complete');
      this.root.querySelector('#fl-etitle').style.color = kind === 'crashed' || kind === 'failed' ? 'var(--red)' : 'var(--green)';
      const rows = [['Result', reason], ['Flight time', `${Math.floor(mins)}:${String(Math.round((mins % 1) * 60)).padStart(2, '0')}`], ['Distance', `${(s.dist / 1852).toFixed(1)} nm`], ['Max G', s.maxG.toFixed(1)]];
      if (t) rows.push(['Touchdown', `${Math.round(t.fpm)} fpm · ${Math.round(t.ias)} kt · ${Math.abs(t.lat).toFixed(1)} m off centreline`]);
      if (score !== undefined) rows.push(['Score', String(score)]);
      this.root.querySelector('#fl-ebody').innerHTML = rows.map(r => `<div class="hstack" style="justify-content:space-between"><span class="muted">${r[0]}</span><span class="mono">${r[1]}</span></div>`).join('');
      this.root.querySelector('#fl-continue').style.display = kind === 'crashed' ? 'none' : '';
      el.classList.add('on');
      this.result = { kind, reason, score, time: s.t, dist: s.dist, touch: t, mission: this.mission && this.mission.id };
    }
    summary() {
      const s = this.s;
      return this.result || { kind: s.crashed ? 'crashed' : (this.log.length ? 'landed' : 'flown'), reason: 'Exited', time: s.t, dist: s.dist, touch: this.touch, mission: this.mission && this.mission.id, score: undefined };
    }

    /* ---------- frame ---------- */
    frame(now) {
      const T = THREE;
      let dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
      this.fpsT += dt; this.fpsN++; if (this.fpsT > .5) { this.fps = this.fpsN / this.fpsT; this.fpsT = 0; this.fpsN = 0; }
      if (!this.paused) {
        this.readControls(dt);
        const sub = 4 * this.timeScale, h = dt * this.timeScale / sub;
        if (!(this.ended === 'crashed' && this.endShown)) for (let i = 0; i < sub; i++) this.step(h);
      }
      const s = this.s, M = this.model;
      M.group.position.copy(s.p); M.group.quaternion.copy(s.q);
      M.gear.visible = s.gear > .05; M.gear.scale.y = Math.max(.05, s.gear);
      const spin = this.fm.heli ? 40 * (.5 + s.collective) : 10 + s.thr * 50;
      M.props.forEach(p => p.rotation.z += spin * dt);
      if (M.rotor) M.rotor.rotation.y += spin * dt * .5; if (M.tailRotor) M.tailRotor.rotation.x += spin * dt * 2.5;
      if (M.flame) { M.flame.visible = !!s.ab && !s.crashed; M.flame.scale.set(1, .7 + Math.random() * .4, 1); }
      M.strobe.visible = (now % 1200) < 80;
      // terrain recenter
      if (Math.hypot(s.p.x - this.tCenter.x, s.p.z - this.tCenter.z) > this.terrainSize * .25) this.buildTerrain(Math.round(s.p.x / 1000) * 1000, Math.round(s.p.z / 1000) * 1000);
      // windsock
      if (this.sock) { const w = this.windBase; this.sock.rotation.set(0, 0, 0); this.sock.lookAt(this.sock.position.clone().add(w.clone().setY(0).normalize().multiplyScalar(10).setY(-Math.max(0, 6 - w.length())))); this.sock.rotateX(Math.PI / 2); }
      // PAPI
      if (this.papi) for (const pp of this.papi) { const wp = pp.m.getWorldPosition(new T.Vector3()); const d = Math.hypot(s.p.x - wp.x, s.p.z - wp.z); const ang = Math.atan2(s.p.y - wp.y, d) / DEG; const facing = (s.p.x - wp.x) * this.terrain.dir.x * pp.end + (s.p.z - wp.z) * this.terrain.dir.z * pp.end; const th = [3.5, 3.17, 2.83, 2.5][pp.i]; pp.m.visible = facing > 0; pp.m.material.color.set(ang > th ? 0xffffff : 0xff2020); }
      // precip follows camera
      if (this.precip) { const pa = this.precip.geometry.attributes.position; const fall = (this.precipSnow ? 3 : 18) * dt; for (let i = 0; i < pa.count; i++) { let y = pa.getY(i) - fall; if (y < -100) y += 200; pa.setY(i, y); } pa.needsUpdate = true; this.precip.position.copy(this.camera.position); }
      if (this.smoke) { const pa = this.smoke.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { let y = pa.getY(i) + dt * 6; if (y > this.s.p.y + 80) y = this.s.p.y; pa.setY(i, y); } pa.needsUpdate = true; }
      this.updateCamera(dt);
      (this.ext || []).forEach(x => x.frame && x.frame(dt, this.paused));
      if (this.keypad) this.keypad.update(this.keys, this.suggestKeys ? this.suggestKeys() : [], this.activeKeys ? this.activeKeys() : {});
      this.sun.position.copy(this.camera.position).addScaledVector(this.sunDir, 800); this.sun.target.position.copy(s.p);
      this.model.group.visible = this.camMode !== 'cockpit';
      this.renderer.render(this.scene, this.camera);
      this.drawHud(); this.drawMini(); this.updatePanels(dt); this.updateAudio();
      const vg = this.root.querySelector('#fl-vignette'); if (vg) vg.style.opacity = clamp((this.gloc || 0) * 1.1, 0, 1);
    }
    updateCamera(dt) {
      const T = THREE, s = this.s, cam = this.camera, att = this.attitude(), L = this.model.length, mode = this.camMode;
      const target = s.p.clone();
      if (mode === 'cockpit') {
        const eye = s.p.clone().addScaledVector(att.f, L * .38).addScaledVector(att.u, this.fm.heli ? 1 : (this.ac.geo === 'airliner' ? 1.2 : .6) * (this.ac.scale || 1));
        cam.position.copy(eye); cam.quaternion.copy(s.q);
        const lk = this.look || { y: 0, p: 0 }; const back = this.keys[this.kb.lookBack] ? Math.PI : 0;
        cam.rotateY(lk.y + back); cam.rotateX(lk.p - 2 * DEG);
      } else if (mode === 'tower') {
        cam.position.copy(this.towerPos); cam.lookAt(target);
        cam.fov = clamp(4000 / Math.max(50, cam.position.distanceTo(target)) * 4, 6, this.st.fov || 65); cam.updateProjectionMatrix(); return;
      } else if (mode === 'flyby') {
        if (!this.flybyPos || this.flybyPos.distanceTo(s.p) > 900) {
          const v = s.v.clone(); if (v.length() < 1) v.copy(att.f);
          this.flybyPos = s.p.clone().addScaledVector(v.normalize(), 500).addScaledVector(att.r, 40 + L).add(new T.Vector3(0, 10, 0));
          const gy = this.groundAt(this.flybyPos.x, this.flybyPos.z) + 3; if (this.flybyPos.y < gy) this.flybyPos.y = gy;
        }
        cam.position.copy(this.flybyPos); cam.lookAt(target);
      } else {
        const dist = L * 2.2 * this.orbit.dist + 8;
        let off;
        if (mode === 'orbit') off = new T.Vector3(Math.sin(this.orbit.yaw) * Math.cos(this.orbit.pitch), Math.sin(this.orbit.pitch), Math.cos(this.orbit.yaw) * Math.cos(this.orbit.pitch)).multiplyScalar(dist);
        else { const h = att.heading; const fl = new T.Vector3(Math.sin(h), 0, -Math.cos(h)); off = fl.multiplyScalar(-dist).add(new T.Vector3(0, dist * .28, 0)); }
        const desired = target.clone().add(off);
        if (!this.camSmooth) this.camSmooth = desired.clone();
        this.camSmooth.lerp(desired, 1 - Math.exp(-dt * (mode === 'orbit' ? 20 : 5)));
        const gy = this.groundAt(this.camSmooth.x, this.camSmooth.z) + 2; if (this.camSmooth.y < gy) this.camSmooth.y = gy;
        cam.position.copy(this.camSmooth); cam.lookAt(target.clone().addScaledVector(att.u, L * .1));
      }
      if (cam.fov !== (this.st.fov || 65)) { cam.fov = this.st.fov || 65; cam.updateProjectionMatrix(); }
      // shake
      if (this.st.shake !== false) { const sh = (s.onGround ? Math.min(1, Math.hypot(s.v.x, s.v.z) / 60) * .04 : 0) + this.turb * .01 + (s.stall ? .02 : 0); cam.rotation.z += (Math.random() - .5) * sh; cam.rotation.x += (Math.random() - .5) * sh; }
    }
    resize() {
      const w = Math.max(1, this.root.clientWidth), h = Math.max(1, this.root.clientHeight);
      this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      const dpr = Math.min(2, window.devicePixelRatio || 1); this.hud.width = w * dpr; this.hud.height = h * dpr; this.hud.style.width = w + 'px'; this.hud.style.height = h + 'px'; this.hdpr = dpr;
    }
    drawHud() {
      const c = this.hctx, W = this.hud.width, H = this.hud.height, d = this.hdpr; c.clearRect(0, 0, W, H);
      if (!this.hudOn || this.elecFail) return;
      const s = this.s, att = this.attitude(), col = this.st.hudColor || '#5BD68A', units = this.st.units || 'imperial';
      c.save(); c.scale(d, d); const w = W / d, h = H / d, cx = w / 2, cy = h / 2;
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.6; c.font = '13px "IBM Plex Mono",Menlo,monospace'; c.textBaseline = 'middle';
      c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 3;
      const ppd = h / (this.camera.fov); // pixels per degree
      // pitch ladder
      c.save(); c.beginPath(); c.rect(cx - 220, cy - 200, 440, 400); c.clip();
      c.translate(cx, cy); c.rotate(-att.bank);
      const pd = att.pitch / DEG;
      for (let a = -90; a <= 90; a += 5) {
        const y = (pd - a) * ppd; if (Math.abs(y) > 260) continue;
        const wl = a === 0 ? 200 : a % 10 === 0 ? 70 : 40;
        c.setLineDash(a < 0 ? [8, 6] : []);
        c.beginPath(); c.moveTo(-wl, y); c.lineTo(-22, y); c.moveTo(22, y); c.lineTo(wl, y); c.stroke();
        if (a !== 0 && a % 10 === 0) { c.textAlign = 'right'; c.fillText(String(Math.abs(a)), -wl - 6, y); c.textAlign = 'left'; c.fillText(String(Math.abs(a)), wl + 6, y); }
      }
      c.setLineDash([]); c.restore();
      // boresight + FPV
      c.beginPath(); c.moveTo(cx - 30, cy); c.lineTo(cx - 10, cy); c.lineTo(cx - 5, cy + 6); c.moveTo(cx + 30, cy); c.lineTo(cx + 10, cy); c.lineTo(cx + 5, cy + 6); c.stroke();
      if (s.v.length() > 5) {
        const T = THREE, vl = s.v.clone().normalize().applyQuaternion(this.s.q.clone().invert());
        const fx = Math.atan2(vl.x, -vl.z) / DEG * ppd, fy = -Math.atan2(vl.y, -vl.z) / DEG * ppd;
        if (Math.abs(fx) < 250 && Math.abs(fy) < 250 && this.camMode === 'cockpit') { c.beginPath(); c.arc(cx + fx, cy + fy, 7, 0, Math.PI * 2); c.moveTo(cx + fx - 16, cy + fy); c.lineTo(cx + fx - 7, cy + fy); c.moveTo(cx + fx + 7, cy + fy); c.lineTo(cx + fx + 16, cy + fy); c.moveTo(cx + fx, cy + fy - 7); c.lineTo(cx + fx, cy + fy - 13); c.stroke(); }
      }
      // bank scale
      c.beginPath(); c.arc(cx, cy, 190, Math.PI * 1.25, Math.PI * 1.75); c.stroke();
      [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].forEach(a => { const r = (a - 90) * DEG; const l = a % 30 === 0 ? 12 : 7; c.beginPath(); c.moveTo(cx + Math.cos(r) * 190, cy + Math.sin(r) * 190); c.lineTo(cx + Math.cos(r) * (190 - l), cy + Math.sin(r) * (190 - l)); c.stroke(); });
      const br = (-att.bank / DEG - 90) * DEG; c.beginPath(); c.moveTo(cx + Math.cos(br) * 178, cy + Math.sin(br) * 178); c.lineTo(cx + Math.cos(br + .04) * 166, cy + Math.sin(br + .04) * 166); c.lineTo(cx + Math.cos(br - .04) * 166, cy + Math.sin(br - .04) * 166); c.closePath(); c.fill();
      // speed tape
      const spd = units === 'metric' ? s.ias * 3.6 : s.ias * KT, su = units === 'metric' ? 'KM/H' : 'KT';
      this.tape(c, cx - 300, cy, spd, units === 'metric' ? 20 : 10, 2.4, 'left', su);
      const altv = units === 'metric' ? (s.p.y + this.elevM) : (s.p.y + this.elevM) * FT, au = units === 'metric' ? 'M' : 'FT';
      this.tape(c, cx + 300, cy, altv, units === 'metric' ? 50 : 100, .5 * (units === 'metric' ? 2 : 1), 'right', au);
      // heading tape
      const hd = wrapDeg(att.heading / DEG);
      c.save(); c.beginPath(); c.rect(cx - 160, 20, 320, 40); c.clip(); c.textAlign = 'center';
      for (let a = Math.floor(hd / 5) * 5 - 40; a <= hd + 40; a += 5) { const x = cx + (a - hd) * 4; c.beginPath(); c.moveTo(x, 50); c.lineTo(x, a % 10 === 0 ? 40 : 45); c.stroke(); if (a % 10 === 0) { const v = wrapDeg(a); c.fillText(v % 90 === 0 ? ['N', 'E', 'S', 'W'][v / 90] : String(v / 10).padStart(2, '0'), x, 30); } }
      c.restore(); c.beginPath(); c.moveTo(cx, 52); c.lineTo(cx - 5, 60); c.lineTo(cx + 5, 60); c.closePath(); c.fill();
      c.textAlign = 'center'; c.fillText(String(Math.round(hd)).padStart(3, '0'), cx, 72);
      // readouts
      c.textAlign = 'left';
      const vsv = units === 'metric' ? s.vs : s.vs * FPM;
      c.fillText(`VS ${vsv >= 0 ? '+' : ''}${Math.round(vsv)}${units === 'metric' ? ' m/s' : ''}`, cx + 260, cy + 150);
      c.fillText(`AGL ${Math.round(units === 'metric' ? s.agl : s.agl * FT)}`, cx + 260, cy + 170);
      c.textAlign = 'right';
      c.fillText(`G ${s.G.toFixed(1)}`, cx - 260, cy + 150);
      c.fillText(`AOA ${(s.alpha / DEG).toFixed(1)}°`, cx - 260, cy + 170);
      c.fillText(`M ${(s.v.length() / (340 - (s.p.y + this.elevM) * .004)).toFixed(2)}`, cx - 260, cy + 190);
      // gates direction cue
      if (this.gates && this.gates[this.gateIdx]) {
        const g = this.gates[this.gateIdx].p, T = THREE, v = g.clone().project(this.camera);
        const behind = v.z > 1; let gx = (v.x * .5 + .5) * w, gy = (-v.y * .5 + .5) * h;
        if (behind || gx < 30 || gx > w - 30 || gy < 30 || gy > h - 30) { const a = Math.atan2(gy - cy, gx - cx) + (behind ? Math.PI : 0); gx = cx + Math.cos(a) * 240; gy = cy + Math.sin(a) * 240; c.fillStyle = '#F5B942'; c.beginPath(); c.arc(gx, gy, 8, 0, Math.PI * 2); c.fill(); }
        else { c.strokeStyle = '#F5B942'; c.strokeRect(gx - 14, gy - 14, 28, 28); }
        c.fillStyle = '#F5B942'; c.textAlign = 'center'; c.fillText(`${(s.p.distanceTo(g) / 1852).toFixed(1)} nm`, gx, gy + 26);
      }
      c.restore();
    }
    tape(c, x, cy, val, step, ppu, side, unit) {
      const hgt = 300; c.save(); c.beginPath(); c.rect(x - 45, cy - hgt / 2, 90, hgt); c.clip();
      c.textAlign = side === 'left' ? 'right' : 'left';
      const start = Math.floor((val - hgt / 2 / ppu) / step) * step;
      for (let v = start; v < val + hgt / 2 / ppu; v += step) { const y = cy - (v - val) * ppu; const big = Math.round(v / step) % 5 === 0; c.beginPath(); const x0 = side === 'left' ? x + 30 : x - 30; c.moveTo(x0, y); c.lineTo(side === 'left' ? x0 - (big ? 12 : 6) : x0 + (big ? 12 : 6), y); c.stroke(); if (big) c.fillText(String(Math.round(v)), side === 'left' ? x + 12 : x - 12, y); }
      c.restore();
      c.save(); c.fillStyle = 'rgba(10,13,18,.85)'; const bx = side === 'left' ? x - 40 : x - 40; c.fillRect(bx, cy - 13, 80, 26); c.strokeRect(bx, cy - 13, 80, 26);
      c.fillStyle = c.strokeStyle; c.textAlign = 'center'; c.font = '15px "IBM Plex Mono",Menlo,monospace'; c.fillText(String(Math.round(val)), x, cy);
      c.font = '11px "IBM Plex Mono",Menlo,monospace'; c.fillText(unit, x, cy - hgt / 2 - 12); c.restore();
    }
    drawMini() {
      if (this.mini.style.display === 'none') return;
      if (this.elecFail) { this.mctx.clearRect(0, 0, 400, 400); return; }
      const c = this.mctx, W = 400, s = this.s, att = this.attitude(), scale = W / 2 / 9000; // 9 km radius
      c.clearRect(0, 0, W, W); c.save(); c.translate(W / 2, W / 2); c.rotate(-att.heading);
      const tp = (x, z) => [(x - s.p.x) * scale, (z - s.p.z) * scale];
      // runway
      const d = this.terrain.dir, L = this.rwyLen;
      const a = tp(-d.x * L / 2, -d.z * L / 2), b = tp(d.x * L / 2, d.z * L / 2);
      c.strokeStyle = '#E6EBF0'; c.lineWidth = 6; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
      c.strokeStyle = 'rgba(87,199,219,.5)'; c.lineWidth = 1.5; c.setLineDash([6, 6]); const fa = tp(-d.x * (L / 2 + 15000), -d.z * (L / 2 + 15000)); c.beginPath(); c.moveTo(...a); c.lineTo(...fa); c.stroke(); c.setLineDash([]);
      // gates
      (this.gates || []).forEach((g, i) => { const p = tp(g.p.x, g.p.z); c.fillStyle = g.passed ? '#5BD68A' : g.missed ? '#FF6B6B' : i === this.gateIdx ? '#F5B942' : '#57C7DB'; c.beginPath(); c.arc(p[0], p[1], i === this.gateIdx ? 7 : 4, 0, Math.PI * 2); c.fill(); });
      if (this.ac.fm.startsWith('glider')) this.thermals.forEach(t => { const p = tp(t.x, t.z); c.strokeStyle = 'rgba(245,185,66,.35)'; c.beginPath(); c.arc(p[0], p[1], t.r * scale, 0, Math.PI * 2); c.stroke(); });
      c.restore();
      c.fillStyle = '#F5B942'; c.beginPath(); c.moveTo(W / 2, W / 2 - 14); c.lineTo(W / 2 - 9, W / 2 + 10); c.lineTo(W / 2 + 9, W / 2 + 10); c.closePath(); c.fill();
      c.fillStyle = '#7B8999'; c.font = '20px "IBM Plex Mono",monospace'; c.fillText('N', W / 2 + Math.sin(-att.heading) * 180 - 6, W / 2 - Math.cos(-att.heading) * 180 + 6);
      const dist = Math.hypot(s.p.x + d.x * L / 2, s.p.z + d.z * L / 2) / 1852;
      c.fillStyle = '#A3AFBC'; c.fillText(`RWY ${dist.toFixed(1)} nm`, 14, W - 16);
    }
    updatePanels(dt) {
      const s = this.s, att = this.attitude(), u = this.st.units || 'imperial', fm = this.fm;
      const tl = this.root.querySelector('#fl-tl'), tr = this.root.querySelector('#fl-tr'), bot = this.root.querySelector('#fl-bot');
      this._pt = (this._pt || 0) + dt; if (this._pt < .1) return; this._pt = 0;
      const gs = Math.hypot(s.v.x, s.v.z), wind = this.windBase;
      const wdir = wrapDeg(Math.atan2(-wind.x, wind.z) / DEG), wsp = wind.length() * KT;
      tl.innerHTML = `<span class="muted" style="font-size:11px;letter-spacing:.08em">${this.ac.name.toUpperCase()} · ${this.cfg.reg || ''}</span>
        <span>IAS <b class="cyan">${Math.round(u === 'metric' ? s.ias * 3.6 : s.ias * KT)}</b> ${u === 'metric' ? 'km/h' : 'kt'} · GS ${Math.round(u === 'metric' ? gs * 3.6 : gs * KT)}</span>
        <span>ALT <b class="cyan">${Math.round(u === 'metric' ? s.p.y + this.elevM : (s.p.y + this.elevM) * FT).toLocaleString()}</b> ${u === 'metric' ? 'm' : 'ft'} · HDG ${String(Math.round(wrapDeg(att.heading / DEG))).padStart(3, '0')}</span>
        <span class="muted">WIND ${String(Math.round(wdir)).padStart(3, '0')}/${Math.round(wsp)} · ${fmtHour(this.hour)} · ${Math.round(this.fps)} FPS</span>`;
      const M = this.mission; let mtxt = '';
      if (M) {
        if (M.type === 'rings') mtxt = `Gates ${s.gates}/${this.gates.length} · next ${this.gateIdx + 1}`;
        else if (M.type === 'land') mtxt = `Land RWY ${this.cfg.runway.id} · limit ${M.limit} fpm`;
        else if (M.type === 'altitude') mtxt = `Climb to ${M.target.toLocaleString()} ft AGL · now ${Math.round(s.agl * FT).toLocaleString()}`;
        else if (M.type === 'survive') mtxt = `Airborne ${Math.round(s.airT)}/${M.target} s · lift ${(s.lift || 0).toFixed(1)} m/s`;
        else if (M.type === 'hover') mtxt = `Hover ${s.hoverT.toFixed(1)}/${M.target} s in ${M.band[0]}–${M.band[1]} ft`;
      }
      tr.innerHTML = `<span class="muted" style="font-size:11px;letter-spacing:.08em">${M ? 'MISSION · ' + M.name.toUpperCase() : 'FREE FLIGHT · ' + this.cfg.airport.icao}</span>
        <span>${M ? mtxt : 'RWY ' + this.cfg.runway.id + ' · ' + this.cfg.airport.name}</span>
        <span class="muted">${this.camMode.toUpperCase()} CAM · ×${this.timeScale} · ${fmtTime(s.t)}</span>
        ${this.ac.fm.startsWith('glider') ? `<span>VARIO <b class="${s.vs > 0 ? 'green' : 'red'}">${(s.vs * KT).toFixed(1)}</b> kt</span>` : ''}`;
      const fuelPct = fm.fuelCap ? s.fuel / fm.fuelCap * 100 : 0;
      bot.innerHTML = `<span><span class="k">${fm.heli ? 'COLLECTIVE' : 'THROTTLE'}</span><span class="thr"><i style="width:${(fm.heli ? s.collective : s.thr) * 100}%;${s.ab ? 'background:#ff9a3c' : ''}"></i></span> ${Math.round((fm.heli ? s.collective : s.thr) * 100)}%${s.ab ? ' AB' : ''}</span>
        ${fm.heli ? '' : `<span><span class="k">FLAPS</span>${Math.round(s.flaps * 100)}%</span>`}
        <span><span class="k">GEAR</span><b class="${s.gear > .99 ? 'green' : s.gear < .01 ? '' : 'amber'}">${this.retract ? (s.gear > .99 ? 'DOWN' : s.gear < .01 ? 'UP' : 'TRANSIT') : 'FIXED'}</b></span>
        ${s.spoiler ? '<span><span class="k">SPDBRK</span><b class="amber">OUT</b></span>' : ''}
        ${s.brake ? '<span><span class="k">BRAKES</span><b class="amber">ON</b></span>' : ''}
        ${this.st.realism && this.st.realism.autoTrim === false ? `<span><span class="k">TRIM</span>${(s.trim * 100).toFixed(0)}</span>` : ''}
        ${fm.fuelCap ? `<span><span class="k">FUEL</span><b class="${fuelPct < 10 ? 'red' : ''}">${this.st.realism && this.st.realism.unlimitedFuel ? '∞' : Math.round(fuelPct) + '%'}</b></span>` : ''}
        ${(this.ext||[]).find(x=>x.ap&&x.ap.mode)?'<span><span class="k">AP</span><b class="green">ON</b></span>':''}${this.engMul<1?'<span><span class="k">ENG</span><b class="red">FAIL</b></span>':''}<span class="muted" style="font-size:11px">W/S speed · A/D turn · SPACE/SHIFT up/down · F1 help · TAB menu</span>`;
      // warnings
      const warn = this.root.querySelector('#fl-warn'); let wtxt = '';
      if (!this.ended) {
        if (s.stallWarn && !fm.heli) wtxt = 'STALL';
        else if (s.ias > fm.vne * .97) wtxt = 'OVERSPEED';
        else if (!s.onGround && s.agl * FT < 800 && s.vs * FPM < -2500) wtxt = 'PULL UP';
        else if (this.retract && s.gear < .5 && s.agl * FT < 600 && s.vs < -2 && s.thr < .4) wtxt = 'GEAR';
        else if (fm.fuelCap && s.fuel <= 0 && !(this.st.realism || {}).unlimitedFuel) wtxt = 'FUEL EMPTY';
      }
      warn.textContent = wtxt; warn.style.display = wtxt ? 'block' : 'none'; this.warnOn = !!wtxt;
      // altitude callouts on approach
      if (!s.onGround && s.vs < -1 && this.audio && this.st.callouts !== false && 'speechSynthesis' in window) {
        const a = s.agl * FT; for (const c of [1000, 500, 100, 50, 30, 20, 10]) if (a <= c && this.lastCallout > c) { this.lastCallout = c; try { const u2 = new SpeechSynthesisUtterance(c >= 100 ? (c === 1000 ? 'one thousand' : c === 500 ? 'five hundred' : 'one hundred') : String(c)); u2.rate = 1.3; u2.volume = (this.st.volume ?? 70) / 100; speechSynthesis.speak(u2); } catch (e) { } break; }
      }
      if (s.agl * FT > 1100) this.lastCallout = 9999;
      // message fade
      const msg = this.root.querySelector('#fl-msg'); if (this._msgT !== undefined) { this._msgT -= .1; msg.style.opacity = clamp(this._msgT, 0, 1); }
    }
    message(t, sec) { const m = this.root.querySelector('#fl-msg'); if (!m) return; m.textContent = t; this._msgT = sec || 2; m.style.opacity = 1; }
    updateAudio() {
      if (!this.audio) return; const s = this.s, fm = this.fm, jet = ['jetliner', 'regionaljet', 'widebody', 'jumbo', 'bizjet', 'fighter', 'fighterHeavy', 'trainer', 'attack', 'bomber'].includes(this.ac.fm);
      const p = fm.heli ? s.collective : s.thr, on = !fm.T && !fm.heli ? 0 : 1;
      const v = this.camMode === 'cockpit' ? .6 : 1;
      this.audio.set({ eng: on * (jet ? .05 : .16) * (.3 + p) * v, engF: jet ? 80 + p * 120 : (fm.heli ? 22 + p * 8 : 40 + p * 60), jet: on * (jet ? .25 * (.2 + p) * (s.ab ? 1.8 : 1) : .03) * v, wind: Math.min(.3, s.ias / 250) * (this.camMode === 'cockpit' ? .5 : 1), windF: s.ias * 6, warn: this.warnOn });
    }
    dispose() {
      this.disposed = true; clearTimeout(this.finishTimer);
      this.alive = false; cancelAnimationFrame(this.raf);
      (this.ext || []).forEach(x => { try { x.dispose && x.dispose(); } catch (e) { } });
      window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
      window.removeEventListener('mousedown', this._md); window.removeEventListener('mousemove', this._mm); window.removeEventListener('mouseup', this._mu); window.removeEventListener('wheel', this._wh);
      window.removeEventListener('resize', this._onResize); window.removeEventListener('blur', this._blur);
      this.audio && this.audio.close();
      try { speechSynthesis.cancel(); } catch (e) { }
      if (this.scene) this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map && m.map.dispose(); m.dispose(); }); });
      if (this.renderer) { this.renderer.dispose(); try { this.renderer.forceContextLoss(); } catch (e) { } }
      window.__sim = null;
    }
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function fmtHour(h) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }
  function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }

  window.CT_SIM = { start, stop, get session() { return S; }, preload: loadThree, get THREE() { return THREE; }, buildAircraftMesh: (a, c) => buildAircraftMesh(a, c) };
})();
