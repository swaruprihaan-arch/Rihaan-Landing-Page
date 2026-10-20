/* CONTRAIL — Build your own aircraft. Loads custom designs into CT_DATA.AIRCRAFT before app.js starts,
   and registers the #/build page (via window.CT_H / window.CT_ROUTES from app.js). Physics come from a base
   flight-model template, with thrust solved so the aircraft really reaches the top speed you choose. */
(function () {
  const D = window.CT_DATA, KEY = 'contrail.customAc';
  const KT = 1.943844, G0 = 9.81;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // shape templates: base aircraft + real-world reference size + slider ranges
  const TPL = {
    airliner: { label: 'Airliner', base: 'b738', len: 39.5, span: 35.8, top: [250, 560, 453], wt: [20, 450, 65], eng: [2, 4, 8], alt: 9000, prop: false },
    bizjet: { label: 'Business jet', base: 'c25c', len: 16.3, span: 15.5, top: [280, 560, 451], wt: [4, 45, 8], eng: [2], alt: 10000, prop: false },
    turboprop: { label: 'Turboprop', base: 'at76', len: 27.2, span: 27, top: [160, 400, 275], wt: [5, 90, 21], eng: [2, 4], alt: 5000, prop: true },
    fighter: { label: 'Fighter jet', base: 'f16', len: 15, span: 9.9, top: [400, 1400, 1150], wt: [6, 40, 12], eng: [1, 2], alt: 10000, prop: false },
    delta: { label: 'Delta fighter', base: 'eufi', len: 16, span: 11, top: [400, 1400, 1150], wt: [6, 40, 12], eng: [1, 2], alt: 10000, prop: false },
    attack: { label: 'Attack jet', base: 'a10', len: 16.3, span: 17.5, top: [250, 520, 381], wt: [8, 30, 14], eng: [2], alt: 3000, prop: false },
    light: { label: 'Light plane', base: 'c172', len: 8.3, span: 11, top: [70, 260, 124], wt: [.4, 3.5, 1.1], eng: [1, 2], alt: 1500, prop: true },
    warbird: { label: 'Warbird', base: 'p51', len: 9.8, span: 11.3, top: [200, 480, 383], wt: [2, 9, 4], eng: [1], alt: 4000, prop: true },
    glider: { label: 'Glider', base: 'ask21', len: 8.4, span: 17, top: [80, 170, 151], wt: [.25, .9, .6], eng: [0], alt: 0, prop: false, glider: true },
    heli: { label: 'Helicopter', base: 'h135', len: 10.2, span: 10.2, top: [70, 210, 137], wt: [.6, 14, 2.8], eng: [1, 2], alt: 0, prop: false, heli: true }
  };
  const acBase = id => D.AIRCRAFT.find(a => a.id === id);

  function defaultsFor(type) {
    const t = TPL[type], b = acBase(t.base);
    return { type, name: 'My ' + t.label, top: t.top[2], len: t.len, span: t.span, wt: t.wt[2], eng: b.nEng || t.eng[0], agility: 100, fuel: 100, gear: 'auto', climb: 100, body: '#F4F6F8', belly: '#1C4F9C', accent: '#F5B942', tail: '#1C4F9C' };
  }

  /* ---------- physics derived from the design ---------- */
  function lapse(prop, V, alt, vne) {
    const rho = 1.225 * Math.exp(-alt / 8500);
    return prop ? Math.pow(rho / 1.225, .7) * clamp(1.15 - V / (vne * 1.25), .25, 1.1) : Math.pow(rho / 1.225, .75) * Math.max(.6, 1 - V / 900);
  }
  function drag(fm, m, V, alt) {
    const rho = 1.225 * Math.exp(-alt / 8500), q = .5 * rho * V * V, CL = m * G0 / (q * fm.S);
    return q * fm.S * (fm.cd0 + fm.k * CL * CL);
  }
  function maxSpeed(fm, m, prop, alt) {
    let lo = 10, hi = 900;
    for (let i = 0; i < 50; i++) { const V = (lo + hi) / 2; if (fm.T * lapse(prop, V, alt, fm.vne) > drag(fm, m, V, alt)) lo = V; else hi = V; }
    return lo;
  }
  function derive(p) {
    const t = TPL[p.type], b = acBase(t.base), base = D.FM[b.fm];
    const lenMul = p.len / t.len, spanMul = p.span / t.span;
    const fm = Object.assign({}, base);
    fm.m = p.wt * 1000;
    const agi = p.agility / 100;
    fm.roll = base.roll * agi * clamp(1 / Math.sqrt(spanMul), .6, 1.5); fm.pitch = base.pitch * agi; fm.yaw = base.yaw * agi;
    if (base.fuelCap) fm.fuelCap = Math.round(base.fuelCap * (p.wt * 1000 / base.m) * p.fuel / 100);
    if (base.burn) fm.burn = base.burn * (p.wt * 1000 / base.m);
    const Vtop = p.top / KT;
    if (t.heli) {
      fm.drag = base.drag * Math.pow(137 / p.top, 1.4); fm.vne = Vtop * 1.12; fm.lift = base.lift * (p.climb / 100 * .25 + .75 + .25);
      fm.lift = clamp(1.25 + .45 * p.climb / 100, 1.3, 2.4);
    } else {
      fm.S = base.S * spanMul * Math.sqrt(lenMul) * Math.pow(fm.m / base.m, 0); // wing area from size
      fm.S = Math.max(fm.S, fm.m / 650); // keep wing loading sane
      fm.vne = Vtop * 1.1;
      if (t.glider) { fm.T = 0; fm.k = base.k / clamp(spanMul, .5, 2); }
      else {
        const alt = t.alt;
        fm.T = drag(fm, fm.m, Vtop, alt) / Math.max(.05, lapse(t.prop, Vtop, alt, fm.vne));
        const climbT = fm.m * G0 * (t.prop ? .18 : .25) * (p.climb / 100); // make sure it can climb
        fm.T = Math.max(fm.T, climbT);
        const vSea = maxSpeed(fm, fm.m, t.prop, 0);
        fm.vne = Math.max(fm.vne, vSea * 1.05);
      }
      fm.gmax = base.gmax;
    }
    const stall = t.heli ? 0 : Math.sqrt(2 * fm.m * G0 / (1.225 * fm.S * (fm.clmax + fm.flapCl)));
    const tw = fm.T ? fm.T / (fm.m * G0) : 0;
    const rangeNm = fm.burn ? Math.round(fm.fuelCap / (fm.burn * .55) * Vtop * .8 / 1852) : 0;
    return { fm, lenMul, spanMul, stallKt: stall * KT, tw, rangeNm, base: b };
  }
  function toAircraft(p, id) {
    const t = TPL[p.type], d = derive(p), b = d.base, F = d.fm;
    const fixed = p.gear === 'fixed' ? true : p.gear === 'retract' ? false : undefined;
    const speedTxt = p.top > 600 ? `Mach ${(p.top / 661).toFixed(1)}` : `${Math.round(p.top)} kt`;
    return Object.assign({}, b, {
      id, name: p.name.trim().slice(0, 40) || 'Custom aircraft', mfr: 'Your design', custom: true, tags: ['Custom'],
      engines: t.glider ? '—' : `${p.eng}× custom`, nEng: p.eng || b.nEng, twinTail: p.type === 'fighter' ? p.eng >= 2 : b.twinTail,
      speed: speedTxt, range: t.glider ? '—' : `${d.rangeNm.toLocaleString()} nm`, ceiling: b.ceiling, seats: b.seats,
      lenMul: d.lenMul, spanMul: d.spanMul, gearFixed: fixed, params: Object.assign({}, p),
      fmOver: { m: F.m, S: F.S, T: F.T, vne: F.vne, roll: F.roll, pitch: F.pitch, yaw: F.yaw, fuelCap: F.fuelCap, burn: F.burn, k: F.k, drag: F.drag, lift: F.lift },
      paint: { body: p.body, belly: p.belly, accent: p.accent, tail: p.tail, engine: p.body, logo: p.accent, wing: shade(p.body, -.12) }
    });
  }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => clamp(Math.round(v + (f < 0 ? v * f : (255 - v) * f)), 0, 255)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }

  /* ---------- storage + registration into CT_DATA ---------- */
  function loadDesigns() { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(x => x && typeof x.id === 'string' && /^ca-[a-z0-9]+$/.test(x.id) && x.params && TPL[x.params.type]) : []; } catch (e) { return []; } }
  let designs = loadDesigns();
  const saveDesigns = () => { try { localStorage.setItem(KEY, JSON.stringify(designs)); } catch (e) { } };
  function register() {
    for (let i = D.AIRCRAFT.length - 1; i >= 0; i--) if (D.AIRCRAFT[i].custom) D.AIRCRAFT.splice(i, 1);
    designs.forEach(d => { const p = Object.assign(defaultsFor(d.params.type), d.params); D.AIRCRAFT.push(toAircraft(p, d.id)); });
  }
  register();
  if (!D.CATEGORIES.includes('Custom')) D.CATEGORIES.push('Custom');
  const origLiveries = D.liverySetFor;
  D.liverySetFor = ac => ac && ac.custom && ac.paint ? [{ id: 'builder', name: 'Your paint', c: ac.paint }].concat(origLiveries(ac)) : origLiveries(ac);

  /* ---------- page ---------- */
  function registerPages() {
    const H = window.CT_H, routes = window.CT_ROUTES; if (!H || !routes) return;
    const { $, $$, esc, head, foot, toast, go, I } = H, ART = window.CT_ART;
    routes.build = (page, args) => {
      const editing = designs.find(d => d.id === args[0]);
      let p = editing ? Object.assign(defaultsFor(editing.params.type), editing.params) : defaultsFor(args[0] && TPL[args[0]] ? args[0] : 'airliner');
      const row = (id, label, min, max, step, val, unit, hint) => `<div class="brow"><label for="${id}">${label}${hint ? `<small class="muted" style="display:block;font-size:12px">${hint}</small>` : ''}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${label}"><span class="val" id="${id}-v"></span></div>`;
      const render = () => {
        const t = TPL[p.type], b = acBase(t.base);
        page.innerHTML = `${head('Hangar · Build', editing ? 'Edit your aircraft' : 'Build your own aircraft', `<a class="btn ghost" href="#/hangar">${I('back', 18)}Hangar</a>`)}
          <div class="builder">
            <div class="stack">
              <section class="card"><span class="eyebrow">1 · Choose a shape</span>
                <div class="typegrid" id="btype">${Object.entries(TPL).map(([k, v]) => `<button type="button" data-t="${k}" aria-pressed="${p.type === k}"><span class="sil" style="--sil-fill:#161D26;height:44px;width:76px">${ART.plan(acBase(v.base))}</span>${v.label}</button>`).join('')}</div>
              </section>
              <section class="card" style="gap:0"><span class="eyebrow" style="margin-bottom:6px">2 · Choose the numbers</span>
                <div class="bgroup"><div class="brow"><label for="b-name">Name</label><input class="field" id="b-name" type="text" maxlength="40" value="${esc(p.name)}" style="grid-column:span 2"></div></div>
                <div class="bgroup">
                  ${row('b-top', t.glider ? 'Max dive speed' : 'Top speed', t.top[0], t.top[1], 5, p.top, '', t.glider ? 'Gliders have no engine' : 'Engines are sized to reach this')}
                  ${t.glider ? '' : row('b-climb', t.heli ? 'Lift power' : 'Climb power', 50, 200, 5, p.climb, '', 'Extra thrust for take-off and climbing')}
                  ${row('b-agility', 'Agility', 40, 220, 5, p.agility, '', 'How fast it rolls and turns')}
                </div>
                <div class="bgroup">
                  ${row('b-len', 'Length', +(t.len * .5).toFixed(1), +(t.len * 2).toFixed(1), .1, p.len, '')}
                  ${row('b-span', t.heli ? 'Rotor size' : 'Wingspan', +(t.span * .5).toFixed(1), +(t.span * 2).toFixed(1), .1, p.span, '', t.heli ? '' : 'Bigger wings = slower stall, more lift')}
                  ${row('b-wt', 'Weight', t.wt[0], t.wt[1], t.wt[1] > 10 ? 1 : .05, p.wt, '')}
                  ${t.glider ? '' : row('b-fuel', 'Fuel tanks', 30, 250, 5, p.fuel, '')}
                </div>
                <div class="bgroup">
                  ${t.eng.length > 1 ? `<div class="brow"><span>Engines</span><div class="seg" id="b-eng" style="grid-column:span 2">${t.eng.map(n => `<button type="button" data-v="${n}" aria-pressed="${p.eng === n}">${n}</button>`).join('')}</div></div>` : ''}
                  ${t.glider || t.heli ? '' : `<div class="brow"><span>Landing gear</span><div class="seg" id="b-gear" style="grid-column:span 2">${[['auto', 'Default'], ['retract', 'Retractable'], ['fixed', 'Fixed']].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${p.gear === k}">${l}</button>`).join('')}</div></div>`}
                </div>
                <div class="bgroup"><span class="eyebrow">Paint</span>
                  <div class="hstack">${[['body', 'Body'], ['belly', 'Belly'], ['tail', 'Tail'], ['accent', 'Stripe']].map(([k, l]) => `<label class="hstack" style="gap:6px;font-size:13px"><input type="color" data-paint="${k}" value="${p[k]}" aria-label="${l} colour">${l}</label>`).join('')}</div>
                </div>
              </section>
            </div>
            <div class="preview">
              <div class="bstage" style="height:260px"><div class="scaled" id="b-prof"></div></div>
              <div class="bstage" style="height:200px"><div class="scaled sil" id="b-plan" style="--sil-fill:#10151C"></div></div>
              <section class="card"><span class="eyebrow">Performance</span><div class="bstats" id="b-stats"></div></section>
              <div class="hstack"><button class="btn" type="button" id="b-fly">${I('play', 18)}Save & fly</button><button class="btn sec" type="button" id="b-save">Save to hangar</button>${editing ? `<button class="btn danger" type="button" id="b-del">${I('trash', 16)}Delete</button>` : ''}</div>
            </div>
          </div>`;
        bind(); update();
      };
      const fmtSpd = v => v > 600 ? `${Math.round(v)} kt · M${(v / 661).toFixed(2)}` : `${Math.round(v)} kt`;
      const update = () => {
        const t = TPL[p.type], ac = toAircraft(p, 'preview'), d = derive(p);
        const vals = { 'b-top': fmtSpd(p.top), 'b-climb': p.climb + '%', 'b-agility': p.agility + '%', 'b-len': p.len.toFixed(1) + ' m', 'b-span': p.span.toFixed(1) + ' m', 'b-wt': (p.wt >= 10 ? Math.round(p.wt) : p.wt.toFixed(2)) + ' t', 'b-fuel': p.fuel + '%' };
        for (const k in vals) { const e = $('#' + k + '-v'); if (e) e.textContent = vals[k]; }
        // previews scale with size (relative to template)
        const lw = clamp(d.lenMul, .5, 2), sw = clamp(d.spanMul, .5, 2);
        const prof = $('#b-prof'); prof.style.width = (50 + 25 * lw) + '%'; prof.style.height = (60 + 20 * Math.sqrt(lw)) + '%'; prof.innerHTML = ART.profile(ac, ac.paint, '');
        const plan = $('#b-plan'); plan.style.width = (35 + 22 * sw) + '%'; plan.style.height = (40 + 25 * lw) + '%'; plan.innerHTML = ART.plan(ac).replace('viewBox="0 0 240 200"', 'viewBox="0 0 240 200" preserveAspectRatio="none"');
        const st = [['Top speed', fmtSpd(p.top)], ['Stall speed', t.heli ? 'none' : Math.round(d.stallKt) + ' kt'], ['Thrust / weight', t.glider ? '0 (glider)' : t.heli ? '—' : d.tw.toFixed(2)], ['Range', t.glider ? '∞ thermals' : d.rangeNm.toLocaleString() + ' nm'], ['Wing loading', t.heli ? '—' : Math.round(d.fm.m / d.fm.S) + ' kg/m²'], ['Roll rate', Math.round(d.fm.roll * 57.3) + '°/s']];
        $('#b-stats').innerHTML = st.map(([l, v]) => `<div class="stat"><span class="eyebrow">${l}</span><span class="mono" style="font-size:15px">${v}</span></div>`).join('');
        if (!t.heli && !t.glider && d.stallKt > p.top * .8) $('#b-stats').insertAdjacentHTML('beforeend', '<div class="red" style="grid-column:1/-1;font-size:13px">Warning: stall speed is close to top speed — make the wings bigger or the plane lighter.</div>');
      };
      const bind = () => {
        $$('#btype button').forEach(btn => btn.onclick = () => { const keep = { name: p.name, body: p.body, belly: p.belly, accent: p.accent, tail: p.tail }; p = Object.assign(defaultsFor(btn.dataset.t), keep); if (/^My /.test(keep.name)) p.name = 'My ' + TPL[btn.dataset.t].label; render(); });
        [['b-top', 'top'], ['b-climb', 'climb'], ['b-agility', 'agility'], ['b-len', 'len'], ['b-span', 'span'], ['b-wt', 'wt'], ['b-fuel', 'fuel']].forEach(([id, k]) => { const e = $('#' + id); if (e) e.oninput = () => { p[k] = +e.value; update(); }; });
        $('#b-name').oninput = e => { p.name = e.target.value; };
        $$('#b-eng button').forEach(btn => btn.onclick = () => { p.eng = +btn.dataset.v; $$('#b-eng button').forEach(x => x.setAttribute('aria-pressed', x === btn)); update(); });
        $$('#b-gear button').forEach(btn => btn.onclick = () => { p.gear = btn.dataset.v; $$('#b-gear button').forEach(x => x.setAttribute('aria-pressed', x === btn)); });
        $$('[data-paint]').forEach(i => i.oninput = () => { p[i.dataset.paint] = i.value; update(); });
        const store = () => {
          const id = editing ? editing.id : 'ca-' + Date.now().toString(36);
          const rec = { id, params: Object.assign({}, p, { name: (p.name || '').trim().slice(0, 40) || 'Custom aircraft' }) };
          const i = designs.findIndex(d => d.id === id); if (i >= 0) designs[i] = rec; else designs.push(rec);
          saveDesigns(); register();
          const ST = window.CT_UI.state(); ST.acId = id; ST.liveryByAc[id] = 'builder'; window.CT_STATE && localStorage.setItem('contrail.v1', JSON.stringify(ST));
          return id;
        };
        $('#b-save').onclick = () => { const id = store(); toast('Saved to your hangar'); go('#/hangar/' + id); };
        $('#b-fly').onclick = () => { const id = store(); window.CT_UI.launch({ ac: D.AIRCRAFT.find(a => a.id === id) }); };
        if ($('#b-del')) $('#b-del').onclick = () => { designs = designs.filter(d => d.id !== editing.id); saveDesigns(); register(); const ST = window.CT_UI.state(); if (ST.acId === editing.id) ST.acId = 'b738'; localStorage.setItem('contrail.v1', JSON.stringify(ST)); toast('Design deleted'); go('#/hangar'); };
      };
      render();
      foot([], `<button class="btn" type="button" id="f-fly">${I('play', 18)}Save & fly</button>`);
      $('#f-fly').onclick = () => $('#b-fly').click();
    };
  }
  window.CT_BUILD = { registerPages, TPL, derive, toAircraft, designs: () => designs };
})();
