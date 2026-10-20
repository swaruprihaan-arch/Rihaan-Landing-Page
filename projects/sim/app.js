/* CONTRAIL — UI shell: routing, pages, persistence. Interactive layer over Claude's CONTRAIL design spec. */
(function () {
  const D = window.CT_DATA, ART = window.CT_ART, I = ART.icon;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'contrail.v1';

  /* ---------------- state ---------------- */
  const defaults = () => ({
    acId: 'b738', liveryByAc: {}, regByAc: {}, custom: {}, favs: ['b738', 'f16'],
    flight: { dep: 'KSEA', arr: 'KSFO', rwy: '16L', start: 'runway', hour: 14.5, fuelPct: 70, payloadPct: 50, cruise: 350 },
    weather: Object.assign({}, D.WEATHER_PRESETS[1], { preset: 'few', cloudBase: 4300 }),
    settings: {
      quality: 'medium', viewDist: 40, renderScale: 100, fov: 65, shadows: false, clouds: true, aa: true, shake: true, minimap: true,
      keys: Object.assign({}, D.DEFAULT_KEYS), keysVersion: D.KEYS_VERSION, sensitivity: 100, expo: 30, deadzone: 8, invertPitch: false, mouseYoke: false,
      difficulty: 'normal', realism: { autoTrim: true, assists: true, crashes: true, stallProtection: false, gLimiter: false, gEffects: true, unlimitedFuel: false },
      sound: true, volume: 70, callouts: true, simpleFlight: true, autoSystems: true, keypad: true, aiTraffic: true, trafficDensity: 4, trafficLabels: true, ils: true, pauseOnBlur: true, units: 'imperial', hudColor: '#5BD68A', camera: 'chase'
    },
    log: [], best: {}, hours: 1284.0, xp: 0, cash: 0, contractsDone: 0, contractSeed: 1, loadout: {}
  });
  // Merge only compatible values so an interrupted or old save cannot break startup.
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function mergeSaved(base, value) {
    if (!isRecord(value)) return base;
    for (const key of Object.keys(base)) {
      const v = value[key], fallback = base[key];
      if (Array.isArray(fallback)) { if (Array.isArray(v)) base[key] = v; }
      else if (isRecord(fallback)) base[key] = Object.keys(fallback).length ? mergeSaved(fallback, v) : (isRecord(v) ? v : fallback);
      else if (typeof v === typeof fallback && (typeof v !== 'number' || Number.isFinite(v))) base[key] = v;
    }
    return base;
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!s) return defaults();
      const d = defaults();
      if (s.settings && s.settings.keysVersion !== D.KEYS_VERSION) { s.settings.keys = Object.assign({}, D.DEFAULT_KEYS); s.settings.keysVersion = D.KEYS_VERSION; }
      const result = mergeSaved(d, s);
      const bound = (object, limits) => { for (const [key, lo, hi] of limits) if (Number.isFinite(object[key])) object[key] = Math.max(lo, Math.min(hi, object[key])); };
      bound(result.settings, [['viewDist',10,80],['renderScale',50,150],['fov',40,100],['trafficDensity',1,8],['sensitivity',30,200],['expo',0,100],['deadzone',0,30],['volume',0,100]]);
      result.settings.trafficDensity = Math.round(result.settings.trafficDensity);
      bound(result.flight, [['hour',0,23.75],['fuelPct',5,100],['payloadPct',0,100]]);
      bound(result.weather, [['clouds',0,100],['cloudBase',500,12000],['vis',.5,60],['windDir',0,359],['windSpd',0,50],['turb',0,100],['precip',0,100],['temp',-30,45],['qnh',960,1050]]);
      const initial = defaults();
      for (const [key, choices] of Object.entries({quality:['low','medium','high','ultra'],camera:['chase','cockpit','orbit','tower','flyby'],difficulty:['easy','normal','hard'],units:['imperial','metric']})) if (!choices.includes(result.settings[key])) result.settings[key] = initial.settings[key];
      if (!/^#[0-9a-f]{6}$/i.test(result.settings.hudColor)) result.settings.hudColor = initial.settings.hudColor;
      result.best = Object.fromEntries(Object.entries(result.best).filter(([id, score]) => D.MISSIONS.some(m => m.id === id) && Number.isFinite(score) && score >= 0));
      result.favs = result.favs.filter(id => D.AIRCRAFT.some(a => a.id === id));
      result.log = result.log.filter(l => isRecord(l) && typeof l.ac === 'string' && Number.isFinite(l.time) && Number.isFinite(l.date) && (!l.touch || Number.isFinite(l.touch.fpm)));
      for (const [id, list] of Object.entries(result.custom)) {
        result.custom[id] = Array.isArray(list) ? list.filter(l => isRecord(l) && typeof l.id === 'string' && /^[a-z0-9-]+$/i.test(l.id) && typeof l.name === 'string' && isRecord(l.c) && ['body','belly','accent','tail','engine','logo','wing'].every(k => /^#[0-9a-f]{6}$/i.test(l.c[k]))) : [];
      }
      for (const [id, value] of Object.entries(result.regByAc)) if (typeof value !== 'string') delete result.regByAc[id];
      for (const [id, value] of Object.entries(result.loadout)) if (!['clean','a2a','strike','sead','ferry'].includes(value)) delete result.loadout[id];
      return result;
    } catch (e) { return defaults(); }
  }
  let ST = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) { toast('Could not save — storage full'); } };
  window.CT_STATE = () => ST;

  const acById = id => D.AIRCRAFT.find(a => a.id === id) || D.AIRCRAFT[0];
  const apBy = icao => D.AIRPORTS.find(a => a.icao === icao) || D.AIRPORTS[0];
  const curAc = () => acById(ST.acId);
  function liveriesFor(ac) { return D.liverySetFor(ac).concat((ST.custom[ac.id] || [])); }
  function curLivery(ac) { ac = ac || curAc(); const all = liveriesFor(ac); return all.find(l => l.id === ST.liveryByAc[ac.id]) || all[0]; }
  function regFor(ac) { ac = ac || curAc(); if (ST.regByAc[ac.id]) return ST.regByAc[ac.id]; return ac.cat === 'Military' ? 'AF 91-0372' : ac.id === 'b738' ? 'N737CT' : 'N' + (ac.id.charCodeAt(0) * 7 % 900 + 100) + ac.id.slice(0, 2).toUpperCase(); }

  /* ---------------- helpers ---------------- */
  let toastT;
  function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('show'), 2200); }
  const sil = (ac, fill, h) => `<div class="sil" style="--sil-fill:${fill || '#10151C'};height:${h || 120}px">${ART.plan(ac)}</div>`;
  const prof = (ac, l) => ART.profile(ac, (l || curLivery(ac)).c, regFor(ac));
  const badgeFor = t => `<span class="badge ${t === 'Study' ? 'cyan' : t === 'New' ? 'green' : t === 'Expansion' ? 'amber' : ''}">${t}</span>`;
  function gc(a, b) { // great-circle nm + initial course
    const R = 3440.065, toR = Math.PI / 180, la1 = a.lat * toR, la2 = b.lat * toR, dl = (b.lon - a.lon) * toR;
    const d = 2 * R * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dl / 2) ** 2));
    const y = Math.sin(dl) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dl);
    return { nm: d, crs: (Math.atan2(y, x) / toR + 360) % 360 };
  }
  const cruiseKt = ac => { const m = /Mach ([\d.]+)/.exec(ac.speed); return m ? Math.round(parseFloat(m[1]) * 480) : parseInt(ac.speed.replace(/,/g, ''), 10) || 200; };
  function stallKt(ac) { const fm = D.FM[ac.fm]; if (fm.heli) return 0; return Math.round(Math.sqrt(2 * fm.m * 9.81 / (1.225 * fm.S * (fm.clmax + fm.flapCl))) * 1.944); }
  function metar(ap, w) {
    const wd = String(Math.round(w.windDir / 10) * 10 || 0).padStart(3, '0'), ws = String(Math.round(w.windSpd)).padStart(2, '0');
    const gust = w.turb > 40 ? 'G' + String(Math.round(w.windSpd + w.turb / 5)).padStart(2, '0') : '';
    const vis = w.vis >= 10 ? '9999' : String(Math.round(w.vis * 1000)).padStart(4, '0');
    const wx = w.precip > 60 ? (w.temp <= 0 ? '+SN' : '+TSRA') : w.precip > 20 ? (w.temp <= 0 ? '-SN' : '-RA') : (w.vis < 2 ? 'FG' : '');
    const c = w.clouds, cb = String(Math.round((w.cloudBase || (c > 80 ? 2300 : 4300)) / 100)).padStart(3, '0');
    const cl = c === 0 ? 'SKC' : c < 25 ? 'FEW' + cb : c < 50 ? 'SCT' + cb : c < 88 ? 'BKN' + cb : 'OVC' + cb;
    const t = w.temp, dp = t - (w.precip > 20 ? 1 : 6), f = v => (v < 0 ? 'M' : '') + String(Math.abs(Math.round(v))).padStart(2, '0');
    return `${ap.icao} 161432Z ${wd}${ws}${gust}KT ${vis}${wx ? ' ' + wx : ''} ${cl}${w.precip > 60 && w.temp > 0 ? 'CB' : ''} ${f(t)}/${f(dp)} Q${Math.round(w.qnh)}`;
  }
  const fmtHour = h => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  const keyName = c => !c ? '—' : c.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ControlLeft', 'Ctrl').replace(/^Arrow(.*)/, (m, d) => ({ Up: '↑', Down: '↓', Left: '←', Right: '→' }[d])).replace('Left', ' L').replace('Right', ' R').replace('Slash', '/').replace('Control', 'Ctrl');

  /* ---------------- chrome ---------------- */
  const NAV = [['home', 'Home'], ['hangar', 'Hangar'], ['fly', 'Fly'], ['missions', 'Missions'], ['tutorial', 'Tutorial'], ['settings', 'Settings']];
  function chrome() {
    $('#app').innerHTML = `
      <header class="topbar">
        <a href="#/home" class="brand" aria-label="CONTRAIL home">${I('mark', 28)}<b>CONTRAIL</b><small>v1.4.2</small></a>
        <nav class="nav" aria-label="Primary">${NAV.map(([k, l]) => `<a href="#/${k}" data-nav="${k}">${l}</a>`).join('')}</nav>
        <div class="topright">
          <div class="status"><i></i>ONLINE</div>
          <div class="zulu" id="zulu">--:--Z</div>
          <a href="#/home" class="pilot"><span class="avatar">ML</span><span class="n"><b>Capt. Mara Lindqvist</b><small id="hours">${ST.hours.toFixed(0)} h logged</small></span></a>
        </div>
      </header>
      <main id="page" tabindex="-1"></main>
      <footer class="footbar" id="foot"></footer>`;
    const tick = () => { const d = new Date(); const z = $('#zulu'); if (z) z.textContent = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`; };
    tick(); setInterval(tick, 10000);
  }
  function foot(hints, actions) {
    $('#foot').innerHTML = `<div class="hint"><kbd>Esc</kbd>Back</div>${(hints || []).map(h => `<div class="hint"><kbd>${h[0]}</kbd>${h[1]}</div>`).join('')}
      <div class="right">${actions || ''}</div>`;
  }
  const head = (eyebrow, title, ctl) => `<div class="pagehead"><div class="t"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1></div><div class="ctl">${ctl || ''}</div></div>`;

  /* ---------------- router ---------------- */
  const routes = window.CT_ROUTES = {};
  let cancelKeyCapture = null;
  let closeModal = null;
  function route() {
    // Browser Back/Forward or a nav link while flying/racing: leave the session (results are kept) and show the new page.
    const live = window.CT_SIM.session || (window.CT_RACE && window.CT_RACE.session);
    if (live) { if (typeof live.menu === 'function') live.menu('exit'); else { window.CT_SIM.stop(); window.CT_RACE && window.CT_RACE.stop(); route(); } return; }
    // still loading the 3D engine: cancel the launch
    if (document.querySelector('#flight.on')) window.CT_SIM.stop();
    if (document.querySelector('#race.on')) window.CT_RACE && window.CT_RACE.stop();
    if (cancelKeyCapture) cancelKeyCapture();
    if (closeModal) closeModal();
    const parts = (location.hash.replace(/^#\/?/, '') || 'choose').split('/');
    if (parts[0] === 'racing') parts[0] = 'race';
    if (parts[0] === 'race' && !['garage','tracks','howto','settings','build','showroom','car'].includes(parts[1])) parts.length = 1;
    const portal = parts[0] === 'choose';
    setNav(parts[0] === 'race' ? 'race' : 'fly');
    document.body.classList.toggle('portal-mode', portal);
    document.title = portal ? 'SIM — Choose your simulator' : parts[0] === 'race' ? 'CONTRAIL Racing' : 'CONTRAIL — Flight Simulator';
    if (portal) { window.CT_PORTAL.render($('#page'), parts[0]); return; }
    const r = routes[parts[0]] ? parts[0] : 'home';
    const tab = r === 'race' ? (parts[1] === 'car' ? 'race/showroom' : parts[1] ? 'race/' + parts[1] : 'race') : { home: 'home', hangar: 'hangar', build: 'hangar', aircraft: 'hangar', liveries: 'hangar', fly: 'fly', missions: 'missions', tutorial: 'tutorial', settings: 'settings' }[r];
    $$('[data-nav]').forEach(a => a.dataset.nav === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    const page = $('#page'); page.scrollTop = 0;
    routes[r](page, parts.slice(1));
  }
  const go = h => { if (location.hash === h) route(); else location.hash = h; };
  const RACE_NAV = [['race', 'Race'], ['race/garage', 'Garage'], ['race/showroom', 'Showroom'], ['race/tracks', 'Tracks'], ['race/howto', 'How to drive'], ['race/settings', 'Settings']];
  let navMode = null;
  function setNav(mode) {
    const nav = $('.nav'); if (!nav || mode === navMode) return; navMode = mode;
    document.body.classList.toggle('race-mode', mode === 'race'); // racing pages use the SLIPSTREAM orange accent (showroom.css)
    const list = mode === 'race' ? RACE_NAV : NAV;
    nav.innerHTML = list.map(([k, l]) => `<a href="#/${k}" data-nav="${k}">${l}</a>`).join('');
    const brand = $('.brand'); if (brand) { brand.href = mode === 'race' ? '#/race' : '#/home'; brand.setAttribute('aria-label', mode === 'race' ? 'CONTRAIL Racing home' : 'CONTRAIL home'); }
    const b = $('.brand b'); if (b) b.textContent = mode === 'race' ? 'CONTRAIL RACING' : 'CONTRAIL';
  }

  /* ---------------- HOME ---------------- */
  routes.home = page => {
    const ac = curAc(), lv = curLivery(ac), f = ST.flight, dep = apBy(f.dep), arr = apBy(f.arr), g = gc(dep, arr);
    const landings = ST.log.filter(l => l.touch && l.kind !== 'crashed');
    const best = landings.length ? Math.min(...landings.map(l => l.touch.fpm)) : null;
    const flown = ST.log.reduce((a, l) => a + (l.time || 0), 0) / 3600;
    const done = Object.keys(ST.best).length;
    page.innerHTML = `
      <section class="hero">
        <div class="art">${prof(ac, lv)}</div>
        <div class="content">
          <span class="eyebrow">Ready at ${esc(dep.icao)} · ${esc(dep.name)}</span>
          <h1 style="font-size:48px">${esc(ac.name)}</h1>
          <div class="dim">${esc(lv.name)} · <span class="mono">${esc(regFor(ac))}</span> · planned <span class="mono cyan">${dep.icao} → ${arr.icao}</span> · ${Math.round(g.nm).toLocaleString()} nm</div>
          <div class="hstack" style="margin-top:8px">
            <button class="btn" type="button" id="h-fly">${I('play', 18)}Fly now</button>
            <a class="btn sec" href="#/fly">Plan flight</a>
            <a class="btn sec" href="#/hangar">Change aircraft</a>
            <a class="btn ghost" href="#/tutorial">How to fly</a>
            <button class="btn ghost" type="button" id="h-rand">${I('dice', 18)}Random flight</button>
          </div>
        </div>
      </section>
      ${resumeCard()}
      <div class="grid g4">
        ${stat('Hours logged', (ST.hours).toFixed(1), 'h')}${stat('Flights in CONTRAIL', ST.log.length, '')}${stat('Best landing', best === null ? '—' : Math.round(best), best === null ? '' : 'fpm')}${stat('Missions complete', `${done}/${D.MISSIONS.length}`, '')}
      </div>
      <div class="split3">
        <section class="card">
          <div class="titlerow"><h2>Logbook</h2><span class="r muted mono" style="font-size:12px">${flown.toFixed(1)} h this install</span></div>
          <div class="log">${ST.log.length ? ST.log.slice(-8).reverse().map(l => `<div class="row"><span class="lbl"><b style="font-weight:500">${esc(acById(l.ac).name)}</b><small>${esc(l.apt)} · ${new Date(l.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · ${esc(l.mission ? (D.MISSIONS.find(m => m.id === l.mission) || {}).name || '' : 'Free flight')}</small></span><span class="ctl"><span class="mono dim">${fmtDur(l.time)}</span><span class="badge ${l.kind === 'crashed' || l.kind === 'failed' ? 'red' : 'green'}">${l.kind === 'crashed' ? 'Crashed' : l.kind === 'failed' ? 'Failed' : l.touch ? Math.round(l.touch.fpm) + ' fpm' : 'Flown'}</span></span></div>`).join('') : '<div class="empty">No flights yet. Press <b>Fly now</b> to take off.</div>'}</div>
        </section>
        <section class="card">
          <div class="titlerow"><h2>Missions</h2><a class="r btn ghost sm" href="#/missions">All missions</a></div>
          ${D.MISSIONS.slice(0, 5).map(m => `<a href="#/missions/${m.id}" class="row" style="padding:6px 0"><span class="lbl"><b style="font-weight:500">${esc(m.name)}</b><small>${esc(acById(m.ac).name)} · ${m.apt}</small></span><span class="ctl">${pips(m.diff)}${ST.best[m.id] !== undefined ? '<span class="badge green">Done</span>' : ''}</span></a>`).join('')}
        </section>
      </div>`;
    $('#h-fly').onclick = () => launch();
    if ($('#h-resume')) { $('#h-resume').onclick = () => resumeFlight(); $('#h-discard').onclick = () => { window.CT_RESUME.clear(); toast('Saved flight discarded'); route(); }; }
    $('#h-rand').onclick = () => {
      const pick = a => a[Math.floor(Math.random() * a.length)];
      const ac2 = pick(D.AIRCRAFT), ap = pick(D.AIRPORTS);
      ST.acId = ac2.id; ST.flight.dep = ap.icao; ST.flight.rwy = pick(ap.rwys).id; ST.flight.hour = Math.round(Math.random() * 24 * 4) / 4;
      ST.flight.start = pick(['runway', 'final', 'air']);
      const w = pick(D.WEATHER_PRESETS); ST.weather = Object.assign({}, w, { preset: w.id });
      const lv2 = pick(liveriesFor(ac2)); ST.liveryByAc[ac2.id] = lv2.id; save();
      toast(`${ac2.name} at ${ap.icao} · ${w.name}`); launch();
    };
    foot([['F', 'Fly now'], ['H', 'Hangar']], `<button class="btn" type="button" id="f-fly">${I('play', 18)}Fly now</button>`);
    $('#f-fly').onclick = () => launch();
  };
  function resumeCard() {
    const r = window.CT_RESUME && window.CT_RESUME.get(); if (!r) return '';
    const ac = acById(r.ac), mins = Math.round((Date.now() - r.date) / 60000);
    return `<section class="card" style="flex-direction:row;align-items:center;gap:28px;flex-wrap:wrap;outline:1px solid rgba(245,185,66,.35)">
      <div class="stack" style="gap:4px;min-width:220px;flex:1"><span class="eyebrow">Last flight · <span class="amber">paused</span> ${mins < 60 ? mins + ' min ago' : Math.round(mins / 60) + ' h ago'}</span><h2 class="section-heading">${esc(ac.name)} near ${esc(r.apt)}</h2><span class="muted mono" style="font-size:13px">${esc(r.reg || '')} · HDG ${String(Math.round(r.hdg)).padStart(3, '0')}</span></div>
      <div class="stat"><span class="eyebrow">Altitude</span><b>${Math.round(r.alt).toLocaleString()}<small>ft</small></b></div>
      <div class="stat"><span class="eyebrow">Speed</span><b>${Math.round(r.ias)}<small>kt</small></b></div>
      <div class="stat"><span class="eyebrow">Fuel</span><b>${r.fuelCap ? Math.round(r.fuel / r.fuelCap * 100) : 0}<small>%</small></b></div>
      <div class="hstack"><button class="btn" type="button" id="h-resume">${I('play', 18)}Resume flight</button><button class="btn ghost" type="button" id="h-discard">Discard</button></div></section>`;
  }
  const stat = (l, v, u) => `<section class="card" style="gap:6px"><span class="eyebrow">${l}</span><span class="stat"><b>${v}<small>${u}</small></b></span></section>`;
  const pips = n => `<span class="hstack" style="gap:3px" aria-label="Difficulty ${n} of 5">${[1, 2, 3, 4, 5].map(i => `<i style="width:8px;height:8px;border-radius:2px;display:block;background:${i <= n ? 'var(--amber)' : 'var(--line2)'}"></i>`).join('')}</span>`;
  const fmtDur = t => { t = t || 0; const m = Math.floor(t / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };

  /* ---------------- HANGAR ---------------- */
  let hangarQ = '', hangarCat = 'All', hangarSort = 'name', hangarFav = false, hangarTag = '';
  routes.hangar = (page, args) => {
    if (args[0]) { routes.aircraft(page, args); return; }
    const counts = {}; D.CATEGORIES.forEach(c => counts[c] = c === 'All' ? D.AIRCRAFT.length : c === 'Custom' ? D.AIRCRAFT.filter(a => a.custom).length : D.AIRCRAFT.filter(a => a.cat === c).length);
    page.innerHTML = `${head('Hangar', 'Aircraft', `
        <a class="btn" href="#/build" id="hbuild">${I('brush', 18)}Build your own</a>
        <label class="search">${I('search', 18)}<input id="hq" type="text" placeholder="Search aircraft" aria-label="Search aircraft" value="${esc(hangarQ)}"></label>
        <select class="select" id="hs" aria-label="Sort"><option value="name">Sort: Name</option><option value="speed">Sort: Speed</option><option value="range">Sort: Range</option><option value="seats">Sort: Seats</option><option value="mfr">Sort: Manufacturer</option></select>
        <div class="seg" id="htag">${['', 'Included', 'Expansion', 'Study', 'New'].map(t => `<button type="button" data-t="${t}" aria-pressed="${hangarTag === t}">${t || 'All'}</button>`).join('')}</div>
        <button class="ibtn ${hangarFav ? 'on' : ''}" id="hfav" type="button" aria-pressed="${hangarFav}" aria-label="Favourites only" title="Favourites only">${I('star')}</button>`)}
      <div class="split" style="flex:1">
        <nav class="side stack" style="gap:2px" aria-label="Categories">${D.CATEGORIES.map(c => `<a href="#/hangar" data-c="${c}" class="${c === hangarCat ? 'on' : ''}">${c === 'All' ? 'All aircraft' : c === 'Helicopter' ? 'Helicopters' : c === 'Glider' ? 'Gliders' : c === 'Warbird' ? 'Warbirds & Vintage' : c === 'Airliner' ? 'Airliners' : c === 'Custom' ? 'Your designs' : c}<span class="c">${counts[c]}</span></a>`).join('')}</nav>
        <div class="stack"><div class="muted" id="hcount"></div><div class="acgrid" id="hgrid"></div></div>
      </div>`;
    $('#hs').value = hangarSort;
    const draw = () => {
      let list = D.AIRCRAFT.filter(a => (hangarCat === 'All' || (hangarCat === 'Custom' ? a.custom : a.cat === hangarCat)) && (!hangarFav || ST.favs.includes(a.id)) && (!hangarTag || a.tags.includes(hangarTag)));
      const q = hangarQ.trim().toLowerCase(); if (q) list = list.filter(a => (a.name + ' ' + a.mfr + ' ' + a.cat + ' ' + a.id).toLowerCase().includes(q));
      const num = s => parseFloat(String(s).replace(/[^\d.]/g, '')) || 0;
      const key = { name: a => a.name, mfr: a => a.mfr + a.name, speed: a => -cruiseKt(a), range: a => -num(a.range), seats: a => -num(a.seats) }[hangarSort];
      list.sort((a, b) => { const x = key(a), y = key(b); return typeof x === 'string' ? x.localeCompare(y) : x - y; });
      $('#hcount').textContent = `${list.length} aircraft`;
      $('#hgrid').innerHTML = list.length ? list.map(a => `
        <div class="ac ${a.id === ST.acId ? 'sel' : ''}" data-id="${a.id}">
          <a class="ac-open" href="#/hangar/${a.id}" aria-label="Configure ${esc(a.name)}"></a>
          <button class="ibtn fav ${ST.favs.includes(a.id) ? 'on' : ''}" type="button" data-fav="${a.id}" aria-label="Favourite ${esc(a.name)}" aria-pressed="${ST.favs.includes(a.id)}">${I('star', 18)}</button>
          <div class="pic">${sil(a, '#10151C', 120)}</div>
          <div class="hstack" style="gap:6px">${a.tags.map(badgeFor).join('')}</div>
          <div class="nm">${esc(a.name)}</div>
          <div class="meta"><span>${esc(a.speed)}</span><span>${esc(a.range)}</span><span>${esc(a.seats)} seats</span></div>
        </div>`).join('') : '<div class="empty">No aircraft match. Clear the search or filters.</div>';
    };
    draw();
    $('#hq').oninput = e => { hangarQ = e.target.value; draw(); };
    $('#hs').onchange = e => { hangarSort = e.target.value; draw(); };
    $('#hfav').onclick = e => { hangarFav = !hangarFav; e.currentTarget.classList.toggle('on', hangarFav); e.currentTarget.setAttribute('aria-pressed', hangarFav); draw(); };
    $$('#htag button').forEach(b => b.onclick = () => { hangarTag = b.dataset.t; $$('#htag button').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); });
    $$('.side a').forEach(a => a.onclick = e => { e.preventDefault(); hangarCat = a.dataset.c; $$('.side a').forEach(x => x.classList.toggle('on', x === a)); draw(); });
    $('#hgrid').onclick = e => {
      const f = e.target.closest('[data-fav]'); if (f) { e.stopPropagation(); toggleFav(f.dataset.fav); f.classList.toggle('on', ST.favs.includes(f.dataset.fav)); f.setAttribute('aria-pressed', ST.favs.includes(f.dataset.fav)); if (hangarFav) draw(); return; }
      const c = e.target.closest('.ac'); if (c) go('#/hangar/' + c.dataset.id);
    };
    $('#hgrid').onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('ac')) { e.preventDefault(); go('#/hangar/' + e.target.dataset.id); } };
    foot([['/', 'Search'], ['F', 'Favourite']], `<span class="muted">Selected: <b style="color:var(--text)">${esc(curAc().name)}</b></span><button class="btn" type="button" id="f-fly">${I('play', 18)}Fly selected</button>`);
    $('#f-fly').onclick = () => launch();
  };
  function toggleFav(id) { const i = ST.favs.indexOf(id); if (i >= 0) ST.favs.splice(i, 1); else ST.favs.push(id); save(); toast(i >= 0 ? 'Removed from favourites' : 'Added to favourites'); }

  routes.aircraft = (page, args) => {
    const ac = acById(args[0]), fm = D.FM[ac.fm], lv = (ac.id === ST.acId ? curLivery(ac) : (liveriesFor(ac).find(l => l.id === ST.liveryByAc[ac.id]) || liveriesFor(ac)[0]));
    const twr = fm.T ? (fm.T / (fm.m * 9.81)).toFixed(2) : '—';
    page.innerHTML = `${head(`Hangar · ${esc(ac.cat)}`, esc(ac.name), `${ac.custom ? `<a class="btn sec" href="#/build/${ac.id}">${I('brush', 18)}Edit design</a>` : ''}<a class="btn ghost" href="#/hangar">${I('back', 18)}All aircraft</a><button class="ibtn ${ST.favs.includes(ac.id) ? 'on' : ''}" id="dfav" type="button" aria-label="Favourite">${I('star')}</button>`)}
      <div class="split3">
        <div class="stack">
          <div class="profile" style="height:300px">${ART.profile(ac, lv.c, regFor(ac))}</div>
          <section class="card">
            <div class="titlerow"><h2>Livery</h2><span class="r"><a class="btn ghost sm" href="#/liveries/${ac.id}">${I('brush', 16)}Livery editor</a></span></div>
            <div class="lvgrid">${liveriesFor(ac).slice(0, 8).map(l => lvTile(ac, l, l.id === lv.id)).join('')}</div>
          </section>
        </div>
        <div class="stack">
          <section class="card">
            <div class="hstack" style="gap:6px">${ac.tags.map(badgeFor).join('')}</div>
            <div style="height:170px">${sil(ac, '#10151C', 170)}</div>
            <div class="grid g2" style="gap:14px">
              ${spec('Manufacturer', ac.mfr)}${spec('Engines', ac.engines)}${spec('Max speed', ac.speed)}${spec('Range', ac.range)}${spec('Ceiling', ac.ceiling)}${spec('Seats', ac.seats)}
              ${spec('Stall (flaps)', fm.heli ? 'n/a' : stallKt(ac) + ' kt')}${spec('Thrust / weight', twr)}${spec('Max G', '+' + fm.gmax)}${spec('Gear', ['ga', 'bush', 'aerobatic', 'glider', 'gliderPerf', 'heli', 'heliLight', 'heliHeavy', 'gaFast'].includes(ac.fm) || ac.floats ? (ac.floats ? 'Floats' : fm.heli ? 'Skids' : 'Fixed') : 'Retractable')}
            </div>
          </section>
          ${ac.cat === 'Military' ? `<section class="card">
            <div class="titlerow"><h2>Loadout</h2><span class="r muted mono" style="font-size:12px" id="lo-info"></span></div>
            <div class="seg" id="lo-seg">${Object.entries(LOADOUTS).map(([k, l]) => `<button type="button" data-lo="${k}" aria-pressed="${(ST.loadout[ac.id] || 'a2a') === k}">${l.name}</button>`).join('')}</div>
            <div id="lo-list" class="mono" style="font-size:13px;line-height:1.7"></div>
          </section>` : ''}
          <section class="card">
            <div class="titlerow"><h2>Registration</h2></div>
            <input class="field mono" id="dreg" type="text" value="${esc(regFor(ac))}" aria-label="Registration" maxlength="12">
          </section>
          <div class="hstack">
            <button class="btn" type="button" id="dsel">${ac.id === ST.acId ? 'Selected' : 'Select aircraft'}</button>
            <button class="btn sec" type="button" id="dfly">${I('play', 18)}Fly now</button>
          </div>
        </div>
      </div>`;
    $('#dfav').onclick = e => { toggleFav(ac.id); e.currentTarget.classList.toggle('on', ST.favs.includes(ac.id)); };
    $('#dsel').onclick = () => { ST.acId = ac.id; save(); $('#dsel').textContent = 'Selected'; toast(`${ac.name} selected`); };
    $('#dfly').onclick = () => { ST.acId = ac.id; save(); launch(); };
    $('#dreg').onchange = e => { ST.regByAc[ac.id] = e.target.value.toUpperCase().slice(0, 12); save(); route(); };
    bindLvTiles(ac);
    const drawLo = () => { if (!$('#lo-seg')) return; const l = LOADOUTS[ST.loadout[ac.id] || 'a2a']; $('#lo-info').textContent = `+${l.kg.toLocaleString()} kg · drag ${l.drag}`; $('#lo-list').innerHTML = l.stores.map(x => `<div class="hstack" style="justify-content:space-between"><span>${esc(x[0])}</span><span class="muted">${x[1]}</span></div>`).join('') || '<span class="muted">Clean — no external stores</span>'; };
    $$('#lo-seg button').forEach(b => b.onclick = () => { ST.loadout[ac.id] = b.dataset.lo; save(); $$('#lo-seg button').forEach(x => x.setAttribute('aria-pressed', x === b)); drawLo(); toast(LOADOUTS[b.dataset.lo].name + ' loadout applied'); });
    drawLo();
    foot([['Enter', 'Select']], `<button class="btn" type="button" id="f-fly">${I('play', 18)}Fly ${esc(ac.name)}</button>`);
    $('#f-fly').onclick = () => { ST.acId = ac.id; save(); launch(); };
  };
  const LOADOUTS = {
    clean: { name: 'Clean', kg: 0, drag: 0, stores: [] },
    a2a: { name: 'Air-to-air', kg: 1100, drag: 40, stores: [['2× AIM-120C AMRAAM', 'wingtip'], ['2× AIM-9X Sidewinder', 'outboard'], ['2× AIM-120C AMRAAM', 'inboard']] },
    strike: { name: 'Strike', kg: 4400, drag: 148, stores: [['2× GBU-12 Paveway II', 'stations 4/6'], ['2× 370 gal tank', 'stations 3/7'], ['2× AIM-9X', 'wingtip'], ['AN/AAQ-33 targeting pod', 'chin']] },
    sead: { name: 'SEAD', kg: 3100, drag: 110, stores: [['2× AGM-88 HARM', 'stations 3/7'], ['2× AIM-120C', 'wingtip'], ['ALQ-184 ECM pod', 'centreline']] },
    ferry: { name: 'Ferry', kg: 5200, drag: 95, stores: [['2× 370 gal tank', 'stations 4/6'], ['300 gal tank', 'centreline']] }
  };
  const spec = (l, v) => `<div class="stat"><span class="eyebrow">${l}</span><span class="mono" style="font-size:15px">${esc(v)}</span></div>`;
  const lvTile = (ac, l, sel) => `<div class="lv ${sel ? 'sel' : ''}" data-lv="${l.id}" role="button" tabindex="0" aria-label="${esc(l.name)} livery"><div style="height:72px;display:flex;align-items:center">${ART.profile(ac, l.c, '')}</div><div class="hstack" style="justify-content:space-between"><span style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.name)}</span>${l.custom ? '<span class="badge cyan">Custom</span>' : ''}</div><div class="sw">${Object.values(l.c).map(c => `<i style="background:${c}"></i>`).join('')}</div></div>`;
  function bindLvTiles(ac) {
    $$('[data-lv]').forEach(t => { const pick = () => { ST.liveryByAc[ac.id] = t.dataset.lv; save(); toast('Livery applied'); route(); }; t.onclick = pick; t.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }; });
  }

  /* ---------------- LIVERIES ---------------- */
  let edit = null;
  routes.liveries = (page, args) => {
    const ac = args[0] ? acById(args[0]) : curAc(), all = liveriesFor(ac), cur = curLivery(ac);
    if (!edit || edit.ac !== ac.id) edit = { ac: ac.id, name: cur.custom ? cur.name : cur.name + ' (custom)', c: Object.assign({}, cur.c), editingId: cur.custom ? cur.id : null };
    const SLOTS = [['body', 'Fuselage / upper'], ['belly', 'Belly / lower'], ['accent', 'Cheatline / stripe'], ['tail', 'Tail / fin'], ['engine', 'Engines / radome'], ['logo', 'Logo / canopy'], ['wing', 'Wings']];
    page.innerHTML = `${head('Hangar · Liveries', esc(ac.name), `<select class="select" id="lac" aria-label="Aircraft">${D.AIRCRAFT.map(a => `<option value="${a.id}" ${a.id === ac.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select><a class="btn ghost" href="#/hangar/${ac.id}">${I('back', 18)}Aircraft</a>`)}
      <div class="split3">
        <div class="stack">
          <div class="profile" style="height:300px" id="lprev">${ART.profile(ac, edit.c, regFor(ac))}</div>
          <section class="card"><div class="titlerow"><h2>Liveries</h2><span class="r muted mono" style="font-size:12px">${all.length} available</span></div>
            <div class="lvgrid">${all.map(l => lvTile(ac, l, l.id === cur.id)).join('')}</div></section>
        </div>
        <section class="card">
          <div class="titlerow"><h2>Paint shop</h2><span class="r"><button class="btn ghost sm" type="button" id="lrand">${I('dice', 16)}Randomise</button></span></div>
          <label class="stack" style="gap:6px"><span class="eyebrow">Livery name</span><input class="field" id="lname" type="text" value="${esc(edit.name)}" maxlength="40"></label>
          <div>${SLOTS.map(([k, l]) => `<div class="row" style="padding:4px 0"><span class="lbl">${l}</span><span class="ctl"><span class="mono muted" style="font-size:12px" id="hx-${k}">${edit.c[k]}</span><input type="color" data-slot="${k}" value="${edit.c[k]}" aria-label="${l}"></span></div>`).join('')}</div>
          <div class="hstack">
            <button class="btn" type="button" id="lsave">${edit.editingId ? 'Update livery' : 'Save as new livery'}</button>
            ${edit.editingId ? '<button class="btn sec" type="button" id="lnew">Save as copy</button><button class="btn danger" type="button" id="ldel">' + I('trash', 16) + 'Delete</button>' : ''}
          </div>
          <p class="muted" style="margin:0;font-size:13px">Pick a livery on the left to start from it, change any colour, then save. Custom liveries are stored in this browser.</p>
        </section>
      </div>`;
    $('#lac').onchange = e => { edit = null; go('#/liveries/' + e.target.value); };
    const preview = () => { $('#lprev').innerHTML = ART.profile(ac, edit.c, regFor(ac)); };
    $$('[data-slot]').forEach(i => i.oninput = () => { edit.c[i.dataset.slot] = i.value; $('#hx-' + i.dataset.slot).textContent = i.value.toUpperCase(); preview(); });
    $('#lname').oninput = e => edit.name = e.target.value;
    $('#lrand').onclick = () => { const h = Math.random() * 360; const hs = (dh, s, l) => hsl2hex((h + dh) % 360, s, l); edit.c = { body: hs(0, .1, .93), belly: hs(0, .6, .3), accent: hs(160, .7, .55), tail: hs(0, .6, .35), engine: hs(0, .1, .9), logo: hs(160, .7, .6), wing: hs(0, .05, .78) }; routes.liveries(page, [ac.id]); };
    const store = asNew => {
      const list = ST.custom[ac.id] = ST.custom[ac.id] || [];
      const name = (edit.name || '').trim().slice(0, 40) || 'Custom';
      if (!asNew && edit.editingId) { const l = list.find(x => x.id === edit.editingId); if (l) { l.name = name; l.c = Object.assign({}, edit.c); } ST.liveryByAc[ac.id] = edit.editingId; }
      else { const id = 'custom-' + crypto.randomUUID(); list.push({ id, name, c: Object.assign({}, edit.c), custom: true }); ST.liveryByAc[ac.id] = id; edit.editingId = id; }
      save(); toast('Livery saved'); routes.liveries(page, [ac.id]);
    };
    $('#lsave').onclick = () => store(false);
    if ($('#lnew')) $('#lnew').onclick = () => store(true);
    if ($('#ldel')) $('#ldel').onclick = () => { ST.custom[ac.id] = (ST.custom[ac.id] || []).filter(l => l.id !== edit.editingId); delete ST.liveryByAc[ac.id]; edit = null; save(); toast('Livery deleted'); routes.liveries(page, [ac.id]); };
    $$('[data-lv]').forEach(t => { t.onclick = () => { ST.liveryByAc[ac.id] = t.dataset.lv; save(); edit = null; routes.liveries(page, [ac.id]); }; t.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); } }; });
    foot([], `<button class="btn" type="button" id="f-fly">${I('play', 18)}Fly with this livery</button>`);
    $('#f-fly').onclick = () => { ST.acId = ac.id; save(); launch(); };
  };
  function hsl2hex(h, s, l) { const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); }

  /* ---------------- FLY (planner + weather + time) ---------------- */
  let flyTab = 'route';
  routes.fly = (page, args) => {
    flyTab = ['route', 'weather', 'time', 'load'].includes(args[0]) ? args[0] : 'route';
    const f = ST.flight, w = ST.weather, ac = curAc(), dep = apBy(f.dep), arr = apBy(f.arr);
    if (!dep.rwys.find(r => r.id === f.rwy)) f.rwy = dep.rwys[0].id;
    const g = gc(dep, arr), kt = cruiseKt(ac), mins = g.nm / Math.max(60, kt) * 60 + 20;
    const tabs = [['route', 'Route'], ['weather', 'Weather'], ['time', 'Time & Season'], ['load', 'Fuel & Payload']];
    page.innerHTML = `${head('Fly', 'Flight setup', `<div class="muted">Aircraft: <a href="#/hangar/${ac.id}" class="amber">${esc(ac.name)}</a> · ${esc(curLivery(ac).name)}</div>`)}
      <nav class="tabs" role="tablist" aria-label="Sections">${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" tabindex="${flyTab === k ? 0 : -1}" aria-selected="${flyTab === k}">${l}</button>`).join('')}</nav>
      <div id="flyBody" style="display:flex;flex-direction:column;gap:20px"></div>`;
    $$('[data-tab]').forEach(b => b.onclick = () => { flyTab = b.dataset.tab; history.replaceState(null, '', '#/fly/' + flyTab); routes.fly(page, [flyTab]); });
    const body = $('#flyBody');
    if (flyTab === 'route') {
      const opt = sel => D.AIRPORTS.map(a => `<option value="${a.icao}" ${a.icao === sel ? 'selected' : ''}>${a.icao} · ${esc(a.name)}</option>`).join('');
      body.innerHTML = `<div class="split3">
        <div class="map" id="rmap">${routeMap(dep, arr)}</div>
        <div class="stack">
          <section class="card">
            <label class="stack" style="gap:6px"><span class="eyebrow">Departure</span><select class="select" id="fdep">${opt(f.dep)}</select></label>
            <label class="stack" style="gap:6px"><span class="eyebrow">Runway</span><select class="select" id="frwy">${dep.rwys.map(r => `<option value="${r.id}" ${r.id === f.rwy ? 'selected' : ''}>${r.id} · ${r.len.toLocaleString()} ft · ${String(r.hdg).padStart(3, '0')}°</option>`).join('')}</select></label>
            <label class="stack" style="gap:6px"><span class="eyebrow">Destination</span><select class="select" id="farr">${opt(f.arr)}</select></label>
            <div class="stack" style="gap:6px"><span class="eyebrow">Start position</span><div class="seg" id="fstart">${[['runway', 'On runway'], ['final', '6 nm final'], ['air', 'In the air']].map(([k, l]) => `<button type="button" data-s="${k}" aria-pressed="${f.start === k}">${l}</button>`).join('')}</div></div>
          </section>
          <section class="card"><div class="grid g2" style="gap:14px">
            ${spec('Distance', Math.round(g.nm).toLocaleString() + ' nm')}${spec('Initial course', String(Math.round(g.crs)).padStart(3, '0') + '°')}
            ${spec('Cruise', kt + ' kt · FL' + Math.min(450, Math.round(parseInt(ac.ceiling.replace(/,/g, '')) * .85 / 1000) * 10))}${spec('Block time', `${Math.floor(mins / 60)} h ${String(Math.round(mins % 60)).padStart(2, '0')} m`)}
            ${spec('Field elevation', dep.elev.toLocaleString() + ' ft')}${spec('Terrain', dep.terrain.replace('-', ' '))}
          </div></section>
        </div></div>`;
      $('#fdep').onchange = e => { f.dep = e.target.value; f.rwy = apBy(f.dep).rwys[0].id; save(); routes.fly(page, [flyTab]); };
      $('#farr').onchange = e => { f.arr = e.target.value; save(); routes.fly(page, [flyTab]); };
      $('#frwy').onchange = e => { f.rwy = e.target.value; save(); };
      $$('#fstart button').forEach(b => b.onclick = () => { f.start = b.dataset.s; save(); $$('#fstart button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    } else if (flyTab === 'weather') {
      body.innerHTML = `<div class="split3"><div class="stack">
        <section class="card"><div class="titlerow"><h2>Presets</h2></div><div class="seg" id="wpre">${D.WEATHER_PRESETS.map(p => `<button type="button" data-p="${p.id}" aria-pressed="${w.preset === p.id}">${p.name}</button>`).join('')}<button type="button" data-p="custom" aria-pressed="${w.preset === 'custom'}">Custom</button></div></section>
        <section class="card" style="padding:4px 4px">
          ${slider('w-clouds', 'Cloud cover', 0, 100, 1, w.clouds, '%')}
          ${slider('w-cloudBase', 'Cloud base', 500, 12000, 100, w.cloudBase || (w.clouds > 80 ? 2300 : 4300), ' ft')}
          ${slider('w-vis', 'Visibility', .5, 60, .5, w.vis, ' km')}
          ${slider('w-windDir', 'Wind direction', 0, 359, 1, w.windDir, '°')}
          ${slider('w-windSpd', 'Wind speed', 0, 50, 1, w.windSpd, ' kt')}
          ${slider('w-turb', 'Turbulence / gusts', 0, 100, 1, w.turb, '%')}
          ${slider('w-precip', 'Precipitation', 0, 100, 1, w.precip, '%')}
          ${slider('w-temp', 'Temperature', -30, 45, 1, w.temp, ' °C')}
          ${slider('w-qnh', 'QNH', 960, 1050, 1, w.qnh, ' hPa')}
        </section></div>
        <div class="stack"><section class="card"><span class="eyebrow">METAR</span><div class="mono cyan" id="wmetar" style="font-size:15px;line-height:1.6">${esc(metar(dep, w))}</div></section>
          <section class="card"><span class="eyebrow">Live weather</span><p class="muted" style="margin:0;font-size:14px">Fetch current conditions for ${dep.icao} from Open-Meteo (free, no key).</p><button class="btn sec" type="button" id="wlive">${I('cloud', 18)}Use live weather</button></section></div></div>`;
      $$('#wpre button').forEach(b => b.onclick = () => { if (b.dataset.p !== 'custom') { const p = D.WEATHER_PRESETS.find(x => x.id === b.dataset.p); ST.weather = Object.assign({}, p, { preset: p.id }); } else ST.weather.preset = 'custom'; save(); routes.fly(page, [flyTab]); });
      bindSliders(body, (k, v) => { ST.weather[k.replace('w-', '')] = v; ST.weather.preset = 'custom'; $$('#wpre button').forEach(x => x.setAttribute('aria-pressed', x.dataset.p === 'custom')); $('#wmetar').textContent = metar(dep, ST.weather); save(); });
      $('#wlive').onclick = async () => {
        const b = $('#wlive'), weather = ST.weather, weatherSnapshot = JSON.stringify(weather); b.disabled = true; b.textContent = 'Fetching…';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${dep.lat}&longitude=${dep.lon}&current=temperature_2m,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,pressure_msl,visibility&wind_speed_unit=kn`, { signal: controller.signal });
          if (!r.ok) throw new Error('Weather service unavailable');
          const j = await r.json(), c = j.current;
          if (!b.isConnected || ST.weather !== weather) return;
          if (JSON.stringify(weather) !== weatherSnapshot) { b.disabled = false; b.textContent = 'Use live weather'; return; }
          if (!c || !['temperature_2m','cloud_cover','wind_speed_10m','wind_direction_10m','wind_gusts_10m','precipitation','pressure_msl'].every(k => Number.isFinite(c[k])) || (c.visibility != null && !Number.isFinite(c.visibility))) throw new Error('Incomplete weather response');
          Object.assign(ST.weather, { preset: 'custom', temp: clamp(Math.round(c.temperature_2m), -30, 45), clouds: clamp(c.cloud_cover, 0, 100), windSpd: clamp(Math.round(c.wind_speed_10m), 0, 50), windDir: ((Math.round(c.wind_direction_10m) % 360) + 360) % 360, turb: clamp(Math.round((c.wind_gusts_10m - c.wind_speed_10m) * 5), 0, 100), precip: clamp(Math.round(c.precipitation * 25), 0, 100), qnh: clamp(Math.round(c.pressure_msl), 960, 1050), vis: clamp((c.visibility ?? 30000) / 1000, .5, 60) });
          save(); toast('Live weather loaded for ' + dep.icao); routes.fly(page, [flyTab]);
        } catch (e) { if (b.isConnected) { toast('Could not fetch live weather'); b.disabled = false; b.textContent = 'Use live weather'; } }
        finally { clearTimeout(timeout); }
      };
    } else if (flyTab === 'time') {
      body.innerHTML = `<div class="split3"><section class="card" style="padding:4px">
          ${slider('t-hour', 'Local time', 0, 23.75, .25, f.hour, '', fmtHour)}
        </section><section class="card"><span class="eyebrow">Quick set</span><div class="seg" id="tq">${[['Dawn', 6.25], ['Morning', 9], ['Noon', 12.5], ['Golden hour', 18.5], ['Dusk', 19.75], ['Night', 23]].map(([l, h]) => `<button type="button" data-h="${h}" aria-pressed="${Math.abs(f.hour - h) < .01}">${l}</button>`).join('')}</div>
        <div id="tsky" style="height:120px;border-radius:6px;border:1px solid var(--line)"></div></section></div>`;
      const sky = () => { const h = f.hour, e = Math.sin((h - 6) / 12 * Math.PI), d = Math.max(0, Math.min(1, (e + .12) / .37)); $('#tsky').style.background = `linear-gradient(${lerpC('#05070c', '#2f6db0', d)}, ${lerpC('#0d1220', e > -.2 && e < .35 ? '#f2a66a' : '#a9cbe8', d)})`; };
      sky();
      bindSliders(body, (k, v) => { f.hour = v; save(); sky(); });
      $$('#tq button').forEach(b => b.onclick = () => { f.hour = +b.dataset.h; save(); routes.fly(page, [flyTab]); });
    } else {
      const fm = D.FM[ac.fm];
      body.innerHTML = `<div class="split3"><section class="card" style="padding:4px">
          ${fm.fuelCap ? slider('l-fuelPct', 'Fuel', 5, 100, 1, f.fuelPct, '%') : '<div class="row">Gliders carry no fuel.</div>'}
          ${slider('l-payloadPct', 'Payload', 0, 100, 1, f.payloadPct, '%')}
        </section><section class="card"><div class="grid g2" style="gap:14px">
          ${spec('Fuel on board', fm.fuelCap ? Math.round(fm.fuelCap * f.fuelPct / 100).toLocaleString() + ' kg' : '—')}
          ${spec('Endurance at cruise', fm.burn ? fmtDur(fm.fuelCap * f.fuelPct / 100 / (fm.burn * .7)) : '∞')}
          ${spec('Gross weight', Math.round(fm.m * (.8 + .25 * f.payloadPct / 100) + (fm.fuelCap || 0) * f.fuelPct / 100 * .6).toLocaleString() + ' kg')}
          ${spec('Stall speed (flaps)', fm.heli ? 'n/a' : stallKt(ac) + ' kt')}
        </div></section></div>`;
      bindSliders(body, (k, v) => { f[k.replace('l-', '')] = v; save(); });
    }
    foot([['Tab', 'Next section']], `<span class="muted mono" style="font-size:13px">${dep.icao} ${f.rwy} · ${esc(w.preset === 'custom' ? 'Custom wx' : (D.WEATHER_PRESETS.find(p => p.id === w.preset) || {}).name || '')} · ${fmtHour(f.hour)}</span><button class="btn" type="button" id="f-fly">${I('play', 18)}Fly now</button>`);
    $('#f-fly').onclick = () => launch();
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function lerpC(a, b, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  function slider(id, label, min, max, step, val, unit, fmt) {
    const pct = (val - min) / (max - min) * 100;
    return `<div class="row"><label class="lbl" for="${id}">${label}</label><span class="ctl"><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-unit="${unit}" ${fmt ? 'data-fmt="hour"' : ''} style="background:linear-gradient(to right,var(--amber) 0 ${pct}%,var(--line2) ${pct}% 100%)"><span class="val" id="${id}-v">${fmt ? fmt(val) : val + unit}</span></span></div>`;
  }
  function bindSliders(root, cb) {
    $$('input[type=range]', root).forEach(i => i.oninput = () => {
      const v = +i.value, pct = (v - i.min) / (i.max - i.min) * 100;
      i.style.background = `linear-gradient(to right,var(--amber) 0 ${pct}%,var(--line2) ${pct}% 100%)`;
      $('#' + i.id + '-v').textContent = i.dataset.fmt === 'hour' ? fmtHour(v) : v + i.dataset.unit; cb(i.id, v);
    });
  }
  function routeMap(dep, arr) {
    // equirectangular world projection with graticule + great-circle polyline
    const W = 1000, H = 520, px = (lon, lat) => [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
    const pts = []; const toR = Math.PI / 180, la1 = dep.lat * toR, lo1 = dep.lon * toR, la2 = arr.lat * toR, lo2 = arr.lon * toR;
    const d = 2 * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2));
    for (let i = 0; i <= 64; i++) { const f = i / 64; if (d < 1e-6) { pts.push(px(dep.lon, dep.lat)); continue; } const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d); const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2), y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2), z = A * Math.sin(la1) + B * Math.sin(la2); pts.push(px(Math.atan2(y, x) / toR, Math.atan2(z, Math.hypot(x, y)) / toR)); }
    let path = '', prev = null; pts.forEach(p => { path += (prev && Math.abs(p[0] - prev[0]) > W / 2 ? 'M' : (prev ? 'L' : 'M')) + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' '; prev = p; });
    const grat = []; for (let lo = -180; lo <= 180; lo += 30) grat.push(`<line x1="${px(lo, 0)[0]}" y1="0" x2="${px(lo, 0)[0]}" y2="${H}"></line>`); for (let la = -60; la <= 60; la += 30) grat.push(`<line x1="0" y1="${px(0, la)[1]}" x2="${W}" y2="${px(0, la)[1]}"></line>`);
    const apts = D.AIRPORTS.map(a => { const p = px(a.lon, a.lat); const on = a.icao === dep.icao || a.icao === arr.icao; return `<circle cx="${p[0]}" cy="${p[1]}" r="${on ? 5 : 2.5}" fill="${a.icao === dep.icao ? '#F5B942' : a.icao === arr.icao ? '#57C7DB' : '#394655'}"></circle>${on ? `<text x="${p[0] + 8}" y="${p[1] - 8}" fill="${a.icao === dep.icao ? '#F5B942' : '#57C7DB'}" font-family="IBM Plex Mono,monospace" font-size="14">${a.icao}</text>` : ''}`; }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Route map ${dep.icao} to ${arr.icao}"><rect width="${W}" height="${H}" fill="#0b1119"></rect><g stroke="#1b2430" stroke-width="1">${grat.join('')}</g>${continents(px)}<path d="${path}" fill="none" stroke="#57C7DB" stroke-width="2.5" stroke-dasharray="8 5"></path>${apts}</svg>`;
  }
  function continents(px) { // very coarse outlines for orientation
    const polys = [[[-168, 66], [-140, 70], [-95, 72], [-62, 60], [-52, 47], [-80, 25], [-97, 18], [-83, 9], [-77, 8], [-105, 22], [-118, 33], [-125, 48], [-135, 58], [-165, 60]], [[-80, 10], [-62, 11], [-35, -6], [-40, -22], [-58, -38], [-68, -55], [-75, -45], [-71, -18], [-81, -5]], [[-10, 36], [-9, 44], [-2, 48], [-5, 58], [5, 61], [20, 70], [40, 68], [60, 70], [100, 77], [140, 72], [180, 68], [160, 60], [140, 54], [130, 42], [122, 30], [108, 20], [100, 13], [97, 6], [80, 15], [72, 22], [57, 25], [50, 30], [35, 36], [27, 41], [12, 44], [3, 43]], [[-17, 21], [-6, 36], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [35, -25], [20, -35], [12, -18], [9, 4], [-8, 4], [-17, 14]], [[114, -22], [129, -12], [142, -11], [153, -28], [145, -39], [130, -32], [115, -34]]];
    return `<g fill="#141c27" stroke="#27313D">${polys.map(p => `<polygon points="${p.map(c => px(c[0], c[1]).map(n => n.toFixed(0)).join(',')).join(' ')}"></polygon>`).join('')}</g>`;
  }

  /* ---------------- MISSIONS + CAREER ---------------- */
  const RANKS = ['Student Pilot', 'Private Pilot', 'First Officer', 'Senior First Officer', 'Captain', 'Senior Captain', 'Chief Pilot', 'Legend'];
  const level = () => { const xp = ST.xp; let lv = 1, need = 500, acc = 0; while (xp >= acc + need) { acc += need; lv++; need = Math.round(need * 1.25); } return { lv, into: xp - acc, need, rank: RANKS[Math.min(RANKS.length - 1, Math.floor((lv - 1) / 3))] }; };
  function rngOf(seed) { let a = seed * 9301 + 49297; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; }
  function contracts() {
    const r = rngOf(ST.contractSeed * 31 + 7), out = [];
    const kinds = [['Scheduled', 'Airliner', 'pax'], ['Cargo', 'Airliner', 'cargo'], ['Charter', 'Business', 'pax'], ['Medevac', 'Helicopter', 'med'], ['Ferry', 'General Aviation', 'ferry'], ['Exercise', 'Military', 'mil']];
    for (let i = 0; i < 6; i++) {
      const k = kinds[i], acs = D.AIRCRAFT.filter(a => a.cat === k[1]), ac = acs[Math.floor(r() * acs.length)];
      const range = (parseFloat(ac.range.replace(/,/g, '')) || 400) * (ac.range.includes('glide') ? 0 : .85);
      let dep, others, inRange = [];
      for (let t = 0; t < 40 && !inRange.length; t++) { dep = D.AIRPORTS[Math.floor(r() * D.AIRPORTS.length)]; others = D.AIRPORTS.filter(x => x !== dep).map(x => ({ x, d: gc(dep, x).nm })).sort((p, q) => p.d - q.d); inRange = others.filter(o => o.d <= range); }
      const arr = inRange.length ? inRange[Math.floor(r() * inRange.length)].x : dep;
      const g = gc(dep, arr), w = D.WEATHER_PRESETS[Math.floor(r() * 5)];
      const diff = Math.min(5, 1 + Math.floor(r() * 3) + (w.id === 'storm' || w.id === 'overcast' ? 1 : 0) + (arr.terrain === 'alpine' ? 1 : 0));
      const pay = Math.round((800 + g.nm * (k[2] === 'cargo' ? 4 : 3) * (k[1] === 'Airliner' ? 2 : 1)) / 100) * 100, xp = 120 + diff * 90 + Math.round(g.nm / 20);
      const flight = k[2] === 'mil' ? 'Red Flag ' + (20 + i) + '-1' : (['Meridian', 'Nordlys', 'Pacifica', 'Kestrel', 'Sakura'][Math.floor(r() * 5)] + ' ' + (100 + Math.floor(r() * 899)));
      out.push({ id: 'c' + ST.contractSeed + '-' + i, kind: k[0], name: `${flight} · ${dep.icao} → ${arr.icao}`, ac: ac.id, dep: dep.icao, arr: arr.icao, nm: g.nm, pay, xp, diff, weather: w.id, hour: Math.round(r() * 22 * 4) / 4 + 1,
        brief: `${k[2] === 'cargo' ? 'Freight' : k[2] === 'med' ? 'Patient transfer' : k[2] === 'mil' ? 'Training sortie' : k[2] === 'ferry' ? 'Aircraft delivery' : 'Passenger service'} from ${dep.name} to ${arr.name}. You take over on a 6 nm final for ${arr.rwys[0].id} at ${arr.icao} — ${w.name.toLowerCase()}. Touch down on the runway under 600 fpm; under 200 fpm earns a 25% bonus.` });
    }
    return out;
  }
  let missionsTab = 'career';
  routes.missions = (page, args) => {
    if (args[0] === 'career' || args[0] === 'challenges') { missionsTab = args[0]; args = args.slice(1); }
    else if (args[0]) missionsTab = 'challenges';
    const L = level(), C = contracts();
    const tabsHtml = `<nav class="tabs" role="tablist" aria-label="Sections" style="border:0">${[['career', 'Career'], ['challenges', 'Challenges']].map(([k, l]) => `<button type="button" role="tab" data-mt="${k}" tabindex="${missionsTab === k ? 0 : -1}" aria-selected="${missionsTab === k}">${l}</button>`).join('')}</nav>`;
    let sel, body;
    if (missionsTab === 'career') {
      sel = C.find(c => c.id === args[0]) || C[0];
      const a = acById(sel.ac);
      body = `<section class="card" style="flex-direction:row;align-items:center;gap:32px;flex-wrap:wrap">
          <div class="stack" style="gap:8px;flex:1;min-width:240px"><div class="hstack" style="justify-content:space-between"><span class="eyebrow">Career</span><span class="mono muted" style="font-size:12px">${L.into.toLocaleString()} / ${L.need.toLocaleString()} XP</span></div>
            <h2 class="section-heading amber">${L.rank} · Level ${L.lv}</h2><div class="meter"><i style="width:${L.into / L.need * 100}%;background:var(--amber)"></i></div></div>
          ${[['Total time', ST.hours.toFixed(0), 'h'], ['Contracts', ST.contractsDone, ''], ['Earnings', '$' + ST.cash.toLocaleString(), ''], ['Landings', ST.log.filter(l => l.touch && l.kind !== 'crashed').length, '']].map(x => `<div class="stat"><span class="eyebrow">${x[0]}</span><b>${x[1]}<small>${x[2]}</small></b></div>`).join('')}
        </section>
        <div class="split3"><div class="stack"><span class="eyebrow">Contracts · ${C.length} available</span>
          <div class="acgrid" id="cgrid">${C.map(c => { const ac = acById(c.ac); return `<div class="ac ${c.id === sel.id ? 'sel' : ''}" data-c="${c.id}" role="button" tabindex="0"><div class="hstack" style="justify-content:space-between"><span class="badge">${c.kind}</span><span class="badge green">Available</span></div><div class="pic" style="height:80px">${sil(ac, '#10151C', 80)}</div><div class="nm" style="font-size:16px">${esc(c.name)}</div><div class="muted" style="font-size:13px">${esc(ac.name)}</div><div class="meta"><span class="amber">$${c.pay.toLocaleString()}</span><span>${c.xp} XP</span>${pips(c.diff)}</div></div>`; }).join('')}</div>
          <button class="btn ghost sm" type="button" id="crefresh" style="align-self:flex-start">${I('dice', 16)}New contracts</button></div>
        <section class="card" style="align-self:start"><span class="eyebrow">${sel.kind} · ${Math.round(sel.nm).toLocaleString()} nm</span><h2 class="section-heading">${esc(sel.name)}</h2>
          <div class="profile" style="height:140px">${ART.profile(a, curLivery(a).c, regFor(a))}</div><p style="margin:0">${esc(sel.brief)}</p>
          <div class="grid g2" style="gap:12px">${spec('Aircraft', a.name)}${spec('Destination', apBy(sel.arr).name)}${spec('Weather', D.WEATHER_PRESETS.find(p => p.id === sel.weather).name)}${spec('Local time', fmtHour(sel.hour))}${spec('Payout', '$' + sel.pay.toLocaleString())}${spec('Experience', sel.xp + ' XP')}</div>
          <button class="btn" type="button" id="mstart">${I('play', 18)}Accept & fly</button></section></div>`;
    } else {
      sel = D.MISSIONS.find(m => m.id === args[0]) || D.MISSIONS[0];
      body = `<div class="split3">
        <div class="acgrid" id="mgrid">${D.MISSIONS.map(m => { const a = acById(m.ac); return `<div class="ac ${m.id === sel.id ? 'sel' : ''}" data-m="${m.id}" role="button" tabindex="0"><div class="hstack" style="justify-content:space-between">${pips(m.diff)}${ST.best[m.id] !== undefined ? `<span class="badge green">Best ${ST.best[m.id]}</span>` : `<span class="badge">${{ land: 'Landing', rings: 'Gates', altitude: 'Climb', survive: 'Soaring', hover: 'Hover' }[m.type]}</span>`}</div><div class="pic" style="height:90px">${sil(a, '#10151C', 90)}</div><div class="nm">${esc(m.name)}</div><div class="meta"><span>${esc(a.name)}</span><span>${m.apt}</span></div></div>`; }).join('')}</div>
        <section class="card" style="align-self:start">
          <span class="eyebrow">Briefing · ${sel.apt}</span><h2 class="section-heading">${esc(sel.name)}</h2>
          <div class="profile" style="height:150px">${ART.profile(acById(sel.ac), liveriesFor(acById(sel.ac))[0].c, '')}</div>
          <p style="margin:0">${esc(sel.brief)}</p>
          <div class="grid g2" style="gap:12px">${spec('Aircraft', acById(sel.ac).name)}${spec('Airport', apBy(sel.apt).name)}${spec('Weather', (D.WEATHER_PRESETS.find(p => p.id === sel.weather) || {}).name || '')}${spec('Local time', fmtHour(sel.time))}${spec('Best score', ST.best[sel.id] !== undefined ? String(ST.best[sel.id]) : '—')}${spec('Difficulty', ['', 'Student', 'Private', 'Commercial', 'Airline', 'Test pilot'][sel.diff])}</div>
          <button class="btn" type="button" id="mstart">${I('play', 18)}Start mission</button>
        </section></div>`;
    }
    page.innerHTML = `${head('Missions', 'Missions & training', tabsHtml)}${body}`;
    $$('[data-mt]').forEach(b => b.onclick = () => go('#/missions/' + b.dataset.mt));
    const startSel = () => missionsTab === 'career' ? launchContract(sel) : launchMission(sel);
    $$('[data-m]').forEach(c => { const f = () => go('#/missions/challenges/' + c.dataset.m); c.onclick = f; c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } }; });
    $$('[data-c]').forEach(c => { const f = () => go('#/missions/career/' + c.dataset.c); c.onclick = f; c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } }; });
    if ($('#crefresh')) $('#crefresh').onclick = () => { ST.contractSeed++; save(); go('#/missions/career'); };
    $('#mstart').onclick = startSel;
    foot([['Enter', 'Start']], `<button class="btn" type="button" id="f-fly">${I('play', 18)}${missionsTab === 'career' ? 'Accept contract' : 'Start ' + esc(sel.name)}</button>`);
    $('#f-fly').onclick = startSel;
  };

  /* ---------------- TUTORIAL ---------------- */
  routes.tutorial = page => {
    const k = ST.settings.keys, K = c => `<kbd>${esc(keyName(c))}</kbd>`;
    const keyRow = (keys, what, hint) => `<div class="row"><span class="ctl" style="margin:0;min-width:150px;gap:6px">${keys}</span><span class="lbl"><b style="font-weight:500">${what}</b>${hint ? `<small>${hint}</small>` : ''}</span></div>`;
    const pad = (top, mid) => `<div style="display:grid;grid-template-columns:repeat(3,52px);gap:6px;justify-content:center">${['', top[0], ''].concat(mid).map(x => x ? `<div style="height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg2);border:1px solid var(--line2);border-bottom-width:3px;border-radius:8px"><b class="mono" style="font-size:16px">${esc(keyName(x[0]))}</b><small class="muted" style="font-size:10px">${x[1]}</small></div>` : '<div></div>').join('')}</div>`;
    page.innerHTML = `${head('Tutorial', 'How to fly', `<button class="btn" type="button" id="t-plane">${I('play', 18)}Start training flight</button><button class="btn sec" type="button" id="t-heli">Helicopter training</button>`)}
      <div class="grid g3">
        <section class="card"><span class="eyebrow">Step 1</span><h2 class="section-heading">Move with WASD</h2>${pad([[k.throttleUp, 'faster']], [[k.rollLeft, 'left'], [k.throttleDown, 'slower'], [k.rollRight, 'right']])}<p class="muted" style="margin:0">${K(k.throttleUp)} speeds up, ${K(k.throttleDown)} slows down. ${K(k.rollLeft)} and ${K(k.rollRight)} bank the wings to turn — the rudder helps automatically.</p></section>
        <section class="card"><span class="eyebrow">Step 2</span><h2 class="section-heading">Go up and down</h2><div class="hstack" style="justify-content:center;gap:16px"><div class="stack" style="align-items:center;gap:6px">${K(k.climb)}<span class="green">Go up</span></div><div class="stack" style="align-items:center;gap:6px">${K(k.descend)}<span class="amber">Go down</span></div></div><p class="muted" style="margin:0">${K(k.climb)} raises the nose so you climb; ${K(k.descend)} lowers it so you descend. With <b>Simple flight assist</b> (on by default) the plane holds a safe angle and levels itself when you let go. You need speed to climb — if the <b class="red">STALL</b> warning shows, press ${K(k.descend)} and ${K(k.throttleUp)}.</p></section>
        <section class="card"><span class="eyebrow">Step 3</span><h2 class="section-heading">Take off &amp; land</h2><ol style="margin:0;padding-left:18px;line-height:1.7"><li>Hold ${K(k.throttleUp)} to full power.</li><li>At take-off speed hold ${K(k.climb)}.</li><li>Press ${K(k.gear)} to raise the gear.</li><li>To land: slow down, extend flaps ${K(k.flapsDown)}, gear down ${K(k.gear)}.</li><li>Just above the runway tap ${K(k.climb)} to flare, then hold ${K(k.brakes)}.</li></ol></section>
      </div>
      <div class="split3">
        <section class="card" style="padding:4px 20px"><div class="titlerow" style="padding-top:16px"><h2>All controls · aeroplane</h2><span class="r"><a class="btn ghost sm" href="#/settings/controls">Change keys</a></span></div>
          ${keyRow(K(k.throttleUp) + K(k.throttleDown), 'Speed up / slow down', 'Throttle — W/S')}
          ${keyRow(K(k.rollLeft) + K(k.rollRight), 'Turn left / right', 'Bank the wings — also steers on the ground')}
          ${keyRow(K(k.climb) + K(k.descend), 'Go up / go down', 'Nose up / nose down')}
          ${keyRow('<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>', 'Fine pitch and roll', 'Arrow keys — alternative to the above')}
          ${keyRow(K(k.yawLeft) + K(k.yawRight), 'Rudder', 'Small heading changes, crosswind landings')}
          ${keyRow(K(k.flapsDown) + K(k.flapsUp), 'Flaps out / in', 'More lift at low speed for take-off and landing')}
          ${keyRow(K(k.gear), 'Landing gear', 'Raise after take-off, lower before landing')}
          ${keyRow(K(k.brakes), 'Brakes', 'Hold on the ground')}
          ${keyRow(K(k.spoilers), 'Speed brakes', 'Lose speed quickly')}
          ${keyRow('<kbd>[</kbd><kbd>]</kbd>', 'Trim', 'Only when auto-trim is off in Realism settings')}
        </section>
        <div class="stack">
          <section class="card" style="padding:4px 20px"><div class="titlerow" style="padding-top:16px"><h2>Helicopter</h2></div>
            ${keyRow(K(k.throttleUp) + K(k.throttleDown), 'Move forward / back', 'Tilts the rotor')}
            ${keyRow(K(k.rollLeft) + K(k.rollRight), 'Move left / right', '')}
            ${keyRow(K(k.climb) + K(k.descend), 'Go up / go down', 'Collective')}
            ${keyRow(K(k.yawLeft) + K(k.yawRight), 'Turn on the spot', 'Pedals')}
          </section>
          <section class="card" style="padding:4px 20px"><div class="titlerow" style="padding-top:16px"><h2>View &amp; menus</h2></div>
            ${keyRow(K(k.camera) + '<kbd>1</kbd>–<kbd>5</kbd>', 'Camera', 'Chase · cockpit · orbit · tower · fly-by. Drag the mouse to look, wheel to zoom.')}
            ${keyRow('<kbd>F1</kbd><kbd>?</kbd>', 'Show controls in flight', '')}
            ${keyRow('<kbd>Tab</kbd>', 'Flight menu', 'Failures, weather, teleport, replay, save')}
            ${keyRow('<kbd>Z</kbd>', 'Autopilot', 'Holds altitude and heading')}
            ${keyRow('<kbd>Esc</kbd>' + K(k.pause), 'Pause', '')}
            ${keyRow(K(k.timeAccel), 'Sim speed', '×1, ×2, ×4')}
          </section>
          <section class="card"><span class="eyebrow">Gamepad</span><p class="muted" style="margin:0">Left stick steers, right trigger speeds up, left trigger slows down, A toggles gear. Plug it in and press any button.</p></section>
        </div>
      </div>`;
    $('#t-plane').onclick = () => launchTutorial('c172');
    $('#t-heli').onclick = () => launchTutorial('r44');
    foot([['F1', 'Controls in flight']], `<button class="btn" type="button" id="f-fly">${I('play', 18)}Start training flight</button>`);
    $('#f-fly').onclick = () => launchTutorial('c172');
  };
  function launchTutorial(id) {
    const ac = acById(id);
    launch({ ac, apt: 'KSEA', weather: 'clear', hour: 13, mission: { id: 'tutorial', name: 'Training flight', type: 'tutorial', start: 'runway' }, tutorial: true });
  }

  /* ---------------- SETTINGS ---------------- */
  routes.settings = (page, args) => {
    const sec = ['graphics', 'controls', 'realism', 'audio', 'hud', 'data'].includes(args[0]) ? args[0] : 'graphics', s = ST.settings;
    const secs = [['graphics', 'Graphics', 'cog'], ['controls', 'Controls', 'plane'], ['realism', 'Realism', 'trophy'], ['audio', 'Audio', 'play'], ['hud', 'HUD & Units', 'map'], ['data', 'Data', 'trash']];
    page.innerHTML = `${head('Settings', secs.find(x => x[0] === sec)[1])}
      <div class="split"><nav class="side stack" style="gap:2px" aria-label="Settings sections">${secs.map(([k, l, ic]) => `<a href="#/settings/${k}" class="${k === sec ? 'on' : ''}">${I(ic)}${l}</a>`).join('')}</nav>
      <section class="card" style="padding:4px" id="sbody"></section></div>`;
    const b = $('#sbody');
    const sw = (id, label, on, hint) => `<div class="row"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ''}</span><span class="ctl"><button class="switch" type="button" role="switch" aria-checked="${!!on}" aria-label="${label}" data-sw="${id}"></button></span></div>`;
    const seg = (id, label, opts, val, hint) => `<div class="row"><span class="lbl">${label}${hint ? `<small>${hint}</small>` : ''}</span><span class="ctl"><div class="seg" data-seg="${id}">${opts.map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${String(val) === String(k)}">${l}</button>`).join('')}</div></span></div>`;
    if (sec === 'graphics') b.innerHTML = seg('quality', 'Terrain quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], s.quality, 'Mesh resolution, trees and buildings') + slider('s-viewDist', 'View distance', 10, 80, 5, s.viewDist, ' km') + slider('s-renderScale', 'Render scale', 50, 150, 5, s.renderScale, ' %') + slider('s-fov', 'Field of view', 40, 100, 1, s.fov, '°') + sw('shadows', 'Shadows', s.shadows, 'Costs performance') + sw('clouds', 'Volumetric clouds', s.clouds) + sw('aa', 'Anti-aliasing', s.aa) + sw('shake', 'Camera shake', s.shake) + sw('minimap', 'Show minimap', s.minimap) + sw('aiTraffic', 'AI traffic', s.aiTraffic, 'Other aircraft flying around the airport') + slider('s-trafficDensity', 'Traffic density', 1, 8, 1, s.trafficDensity, ' aircraft') + sw('trafficLabels', 'Traffic labels', s.trafficLabels) + sw('pauseOnBlur', 'Pause when the window loses focus', s.pauseOnBlur) + seg('camera', 'Default camera', [['chase', 'Chase'], ['cockpit', 'Cockpit'], ['orbit', 'Orbit'], ['tower', 'Tower']], s.camera);
    else if (sec === 'controls') {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      b.innerHTML = `<div class="row"><span class="lbl">Gamepad / joystick<small>${pads.length ? esc(pads[0].id) : 'None detected — press any button on your controller'}</small></span><span class="ctl"><span class="badge ${pads.length ? 'green' : ''}">${pads.length ? 'Connected' : 'Not connected'}</span></span></div>` +
        slider('s-sensitivity', 'Sensitivity', 30, 200, 5, s.sensitivity, ' %') + slider('s-expo', 'Response curve (expo)', 0, 100, 5, s.expo, ' %') + slider('s-deadzone', 'Stick deadzone', 0, 30, 1, s.deadzone, ' %') + sw('keypad', 'On-screen keyboard', s.keypad, 'Small keyboard in the corner showing which key does what (K hides it in flight)') + sw('autoSystems', 'Automatic gear, flaps & brakes', s.autoSystems, 'On = you only need W A S D, Space and Shift') + sw('simpleFlight', 'Simple flight assist', s.simpleFlight, 'Space/Shift climb and descend at a safe angle, A/D bank 30°, let go to level off. Turn off for full manual control.') + sw('invertPitch', 'Invert pitch', s.invertPitch, 'Off = push forward to dive, like a real yoke') + sw('mouseYoke', 'Mouse yoke', s.mouseYoke, 'Mouse position steers the aircraft') +
        `<div class="row"><span class="lbl"><b style="font-weight:500">Key bindings</b><small>Click a key, then press the new key. Arrow keys also pitch and roll; [ ] trim; 1–5 cameras; F1 shows controls in flight.</small></span><span class="ctl"><button class="btn sec sm" type="button" id="kreset">Reset to defaults</button></span></div>` +
        Object.keys(D.KEY_LABELS).map(k => `<div class="row"><span class="lbl">${D.KEY_LABELS[k]}</span><span class="ctl"><button class="btn sec sm mono" type="button" data-bind="${k}" style="min-width:110px">${keyName(s.keys[k])}</button></span></div>`).join('');
      $$('[data-bind]', b).forEach(btn => btn.onclick = () => {
        if (cancelKeyCapture) cancelKeyCapture();
        btn.textContent = 'Press a key…'; btn.style.borderColor = 'var(--amber)';
        const h = e => { e.preventDefault(); e.stopPropagation(); cancelKeyCapture(); if (e.code !== 'Escape') { const clash = Object.keys(s.keys).find(k => s.keys[k] === e.code && k !== btn.dataset.bind); if (clash) s.keys[clash] = s.keys[btn.dataset.bind]; s.keys[btn.dataset.bind] = e.code; save(); toast(clash ? `Swapped with “${D.KEY_LABELS[clash]}”` : 'Key bound'); } routes.settings(page, ['controls']); };
        cancelKeyCapture = () => { window.removeEventListener('keydown', h, true); btn.textContent = keyName(s.keys[btn.dataset.bind]); btn.style.borderColor = ''; cancelKeyCapture = null; };
        window.addEventListener('keydown', h, true);
      });
      $('#kreset').onclick = () => { s.keys = Object.assign({}, D.DEFAULT_KEYS); save(); toast('Key bindings reset'); routes.settings(page, ['controls']); };
    } else if (sec === 'realism') {
      const r = s.realism;
      b.innerHTML = seg('difficulty', 'Landing tolerance', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], s.difficulty, 'Max sink rate at touchdown: 1,400 / 1,000 / 700 fpm') +
        sw('r-crashes', 'Crash detection', r.crashes, 'Off = the aircraft can touch anything') + sw('r-autoTrim', 'Auto-trim (fly-by-wire)', r.autoTrim, 'Off = trim manually with [ and ]') + sw('r-assists', 'Helicopter stability assist', r.assists) +
        sw('r-stallProtection', 'Stall protection', r.stallProtection, 'Pushes the nose down near the critical angle') + sw('r-gLimiter', 'G limiter', r.gLimiter) + sw('r-gEffects', 'G effects (blackout)', r.gEffects, 'Screen dims above ~6 G') + sw('r-unlimitedFuel', 'Unlimited fuel', r.unlimitedFuel);
    } else if (sec === 'audio') b.innerHTML = sw('sound', 'Sound', s.sound) + slider('s-volume', 'Master volume', 0, 100, 1, s.volume, ' %') + sw('callouts', 'Altitude callouts', s.callouts, '1000, 500, 100, 50… on approach');
    else if (sec === 'hud') b.innerHTML = seg('units', 'Units', [['imperial', 'Knots / feet'], ['metric', 'km/h / metres']], s.units) + sw('ils', 'ILS approach guide', s.ils, 'Localizer and glideslope needles on final') + seg('hudColor', 'HUD colour', [['#5BD68A', 'Green'], ['#F5B942', 'Amber'], ['#57C7DB', 'Cyan'], ['#E6EBF0', 'White']], s.hudColor);
    else b.innerHTML = `<div class="row"><span class="lbl">Logbook<small>${ST.log.length} flights</small></span><span class="ctl"><button class="btn danger sm" type="button" id="dlog">Clear logbook</button></span></div><div class="row"><span class="lbl">Custom liveries<small>${Object.values(ST.custom).reduce((a, l) => a + l.length, 0)} saved</small></span><span class="ctl"><button class="btn danger sm" type="button" id="dlv">Delete all</button></span></div><div class="row"><span class="lbl">Everything<small>Settings, liveries, logbook, mission scores</small></span><span class="ctl"><button class="btn danger sm" type="button" id="dall">Reset CONTRAIL</button></span></div>`;
    $$('[data-sw]', b).forEach(x => x.onclick = () => {
      const k = x.dataset.sw, on = x.getAttribute('aria-checked') !== 'true'; x.setAttribute('aria-checked', on);
      if (k.startsWith('r-')) s.realism[k.slice(2)] = on; else s[k] = on; save();
    });
    $$('[data-seg]', b).forEach(g => $$('button', g).forEach(btn => btn.onclick = () => { s[g.dataset.seg] = btn.dataset.v; $$('button', g).forEach(x => x.setAttribute('aria-pressed', x === btn)); save(); }));
    bindSliders(b, (k, v) => { s[k.replace('s-', '')] = v; save(); });
    const confirmDo = (msg, fn) => modal(msg, fn);
    if ($('#dlog')) $('#dlog').onclick = () => confirmDo('Clear the logbook?', () => { ST.log = []; save(); toast('Logbook cleared'); route(); });
    if ($('#dlv')) $('#dlv').onclick = () => confirmDo('Delete all custom liveries?', () => { ST.custom = {}; save(); toast('Custom liveries deleted'); route(); });
    if ($('#dall')) $('#dall').onclick = () => confirmDo('Reset everything to factory settings?', () => { ST = defaults(); if (window.CT_RESUME) window.CT_RESUME.clear(); save(); toast('CONTRAIL reset'); route(); });
    foot([], `<button class="btn" type="button" id="f-fly">${I('play', 18)}Fly now</button>`);
    $('#f-fly').onclick = () => launch();
  };
  function modal(msg, ok) {
    if (closeModal) closeModal();
    const opener = document.activeElement, m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><h2 class="section-heading" id="confirm-title">${esc(msg)}</h2><p class="muted" id="confirm-description" style="margin:0">This can’t be undone.</p><div class="hstack" style="justify-content:flex-end"><button class="btn sec" type="button" data-x>Cancel</button><button class="btn" type="button" data-ok style="background:var(--red)">Confirm</button></div></div>`;
    document.body.appendChild(m);
    const cancel = m.querySelector('[data-x]'), confirm = m.querySelector('[data-ok]');
    const close = () => { m.remove(); closeModal = null; if (opener && opener.isConnected) opener.focus(); };
    closeModal = close;
    m.onclick = e => { if (e.target === m || e.target.closest('[data-x]')) close(); if (e.target.closest('[data-ok]')) { close(); ok(); } };
    m.onkeydown = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Tab' && ((e.shiftKey && document.activeElement === cancel) || (!e.shiftKey && document.activeElement === confirm))) { e.preventDefault(); (e.shiftKey ? confirm : cancel).focus(); }
    };
    cancel.focus();
  }

  /* ---------------- launch ---------------- */
  function launch(over) {
    const ac = over && over.ac || curAc(), lv = curLivery(ac), f = ST.flight, ap = apBy(over && over.apt || f.dep);
    const rwy = over && over.apt ? ap.rwys[0] : (ap.rwys.find(r => r.id === f.rwy) || ap.rwys[0]);
    const weather = over && over.resume ? Object.assign({}, over.resume.weather) : over && over.weather ? Object.assign({}, D.WEATHER_PRESETS.find(p => p.id === over.weather)) : Object.assign({}, ST.weather);
    const lo = ac.cat === 'Military' ? LOADOUTS[ST.loadout[ac.id] || 'a2a'] : null;
    const cfg = { ac, livery: over && over.livery || lv.c, reg: regFor(ac), airport: ap, runway: over && over.rwy ? (ap.rwys.find(r => r.id === over.rwy) || rwy) : rwy, start: f.start, weather, hour: over && over.hour !== undefined ? over.hour : f.hour, fuelPct: f.fuelPct, payloadPct: f.payloadPct, settings: ST.settings, mission: over && over.mission, tutorial: over && over.tutorial, resume: over && over.resume, extraMass: lo ? lo.kg : 0, dragIndex: lo ? lo.drag : 0, arr: f.arr };
    document.activeElement && document.activeElement.blur();
    window.CT_SIM.start(cfg, res => {
      if (res && res.time > 3) {
        ST.log.push({ date: Date.now(), ac: ac.id, apt: ap.icao, time: res.time, kind: res.kind, touch: res.touch, mission: res.mission });
        if (ST.log.length > 200) ST.log.shift();
        ST.hours += res.time / 3600;
        if (res.mission && (res.kind === 'landed') && res.score !== undefined) ST.best[res.mission] = Math.max(ST.best[res.mission] || 0, res.score);
        const c = over && over.contract;
        if (c && res.kind === 'landed') { const bonus = res.touch && res.touch.fpm < 200 ? 1.25 : 1; ST.xp += Math.round(c.xp * bonus); ST.cash += Math.round(c.pay * bonus); ST.contractsDone++; ST.contractSeed++; setTimeout(() => toast(`Contract complete · +${Math.round(c.xp * bonus)} XP · $${Math.round(c.pay * bonus).toLocaleString()}`), 400); }
        else if (res.kind === 'landed' || res.touch) ST.xp += Math.round(20 + res.time / 30);
        save();
      }
      route(); const h = $('#hours'); if (h) h.textContent = ST.hours.toFixed(0) + ' h logged';
    });
  }
  function launchMission(m) {
    const ac = acById(m.ac);
    launch({ ac, apt: m.apt, weather: m.weather, hour: m.time, mission: m });
  }
  function launchContract(c) {
    const ac = acById(c.ac), m = { id: 'contract', name: c.name, type: 'land', start: 'final', limit: 600, apt: c.arr };
    launch({ ac, apt: c.arr, weather: c.weather, hour: c.hour, mission: m, contract: c });
  }
  function resumeFlight() {
    const r = window.CT_RESUME && window.CT_RESUME.get(); if (!r) return;
    const ap = apBy(r.apt);
    launch({ ac: acById(r.ac), apt: r.apt, rwy: r.rwy, weather: null, hour: r.hour, resume: r, livery: r.livery });
  }
  // record mission results even when "Exit" is pressed from end screen
  window.CT_UI = { launch, launchMission, launchTutorial, launchContract, resumeFlight, route, state: () => ST, contracts: () => contracts() };

  /* ---------------- keyboard shortcuts (menus) ---------------- */
  window.addEventListener('keydown', e => {
    if (window.CT_SIM.session || (window.CT_RACE && window.CT_RACE.session)) return;
    if (document.body.classList.contains('portal-mode')) { if (e.key === 'ArrowLeft' || e.key === '1') go('#/home'); else if (e.key === 'ArrowRight' || e.key === '2') go('#/race'); return; }
    const tab = e.target.closest?.('[role="tab"]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')], i = tabs.indexOf(tab);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      const attr = tabs[next].hasAttribute('data-tab') ? 'data-tab' : 'data-mt', value = tabs[next].getAttribute(attr);
      e.preventDefault(); tabs[next].click();
      setTimeout(() => document.querySelector(`[${attr}="${value}"]`)?.focus(), 0);
      return;
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === 'Escape') { if (closeModal) { closeModal(); return; } history.length > 1 ? history.back() : go('#/home'); }
    else if (e.key === '/' && $('#hq')) { e.preventDefault(); $('#hq').focus(); }
    else if (e.key.toLowerCase() === 'f' && location.hash.startsWith('#/home')) launch();
    else if (e.key.toLowerCase() === 'h' && location.hash.startsWith('#/home')) go('#/hangar');

  });

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    chrome();
    window.CT_H = { $, $$, esc, head, foot, toast, go, I, modal };
    window.CT_RACE && window.CT_RACE.registerPages();
    window.CT_BUILD && window.CT_BUILD.registerPages();
    window.CT_SHOWROOM && window.CT_SHOWROOM.registerPages();
    const switcher = document.createElement('a');
    switcher.href = '#/choose'; switcher.className = 'sim-switch'; switcher.textContent = 'Simulators';
    $('.topbar').prepend(switcher);
    route(); window.addEventListener('hashchange', route);
    // warm the 3D engine in the background
    setTimeout(() => window.CT_SIM.preload().catch(() => { }), 800);
  });
})();
