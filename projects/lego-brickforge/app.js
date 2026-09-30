(async () => {
let THREE = null; // three.js is loaded lazily for the home-page hero (see initHero)

/* =========================== STATE & STORAGE =========================== */
const LS = (k, d) => { try { const v = localStorage.getItem('bah_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const SAVE = (k, v) => localStorage.setItem('bah_' + k, JSON.stringify(v));

const ACCENTS = ['#ffd500', '#e3000b', '#0055bf', '#237841', '#fe8a18', '#e4adc8', '#008f9b', '#a5a5cb'];
const AVATARS = ['#ffd500', '#e3000b', '#0055bf', '#237841', '#fe8a18', '#e4adc8', '#008f9b', '#c870a0', '#4b9f4a', '#5a93db'];

const settings = Object.assign({
  name: 'Builder ' + Math.floor(Math.random() * 900 + 100), avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
  theme: 'yellow', accent: '#e3000b', reduce: false,
  sound: true, volume: 70, autoSecs: 6, autoAdv: true, rbKey: '', proxy: ''
}, LS('settings', {}));
// Options from older versions (3D generator, AI tips) are gone — drop anything left in storage, keys included.
['aiKey', 'perStep', 'highlight', 'outlines', 'grid', 'brickScheme', 'speed'].forEach(k => delete settings[k]);
let saveSettings = () => SAVE('settings', settings);
saveSettings();

let collection = LS('collection', {}); // num -> {num,name,img,pieces,theme,year,status:'building'|'done'|'wish',step,total,ms,added}
let saveCollection = () => { SAVE('collection', collection); renderCollection(); };

const state = { set: null, steps: [], step: 0, mode: 'pages', pos: { pages: 0, '3d': 0 }, pageSteps: [], playing: false, playT: null, room: null, buildStart: 0, booklet: -1, zoom: 1, role: 'build', parts: null, partsLoading: false, gotParts: {}, mySteps: null, assignMap: null, sharedKey: null };
window.state = state; // for debugging

/* =========================== AUDIO (synth) =========================== */
let actx = null;
function ac() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
function tone(freq, dur = .1, type = 'sine', vol = .3, slide = 0) {
  if (!settings.sound) return; try {
    const c = ac(), o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol * settings.volume / 100, c.currentTime); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  } catch { }
}
const SFX = {
  click: () => tone(600, .06, 'square', .12, 200),
  snap: () => { tone(180, .08, 'square', .35, -100); setTimeout(() => tone(900, .05, 'sine', .2), 30); },
  step: () => { tone(523, .1, 'triangle', .25); setTimeout(() => tone(659, .1, 'triangle', .25), 90); setTimeout(() => tone(784, .15, 'triangle', .25), 180); },
  back: () => tone(400, .08, 'triangle', .2, -150),
  fanfare: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .25, 'triangle', .3), i * 110)),
  join: () => { tone(440, .1, 'sine', .25); setTimeout(() => tone(880, .15, 'sine', .25), 100); },
  error: () => tone(200, .25, 'sawtooth', .2, -80),
  whoosh: () => tone(1200, .18, 'sine', .12, -900),
  bag: () => { tone(330, .12, 'triangle', .25); setTimeout(() => tone(440, .12, 'triangle', .25), 120); setTimeout(() => tone(660, .28, 'triangle', .3), 240); },
};

/* =========================== UI HELPERS =========================== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg, icon = '') {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `${icon ? `<span>${icon}</span>` : ''}${msg}`;
  const box = $('#toasts'); while (box.children.length >= 4) box.firstChild.remove(); box.appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2600);
}
function modal(html, buttons) {
  const box = $('#modal-box'); box.innerHTML = html + '<div class="row-btns"></div>';
  const row = box.querySelector('.row-btns');
  buttons.forEach(b => { const el = document.createElement('button'); el.className = 'btn ' + (b.cls || 'ghost'); el.textContent = b.label; el.onclick = () => { closeModal(); b.fn && b.fn(); }; row.appendChild(el); });
  $('#modal').classList.remove('hidden');
}
const closeModal = () => { $('#modal').classList.add('hidden'); $('#modal').classList.remove('g-dark'); };
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
function confetti(n = 80) {
  if (settings.reduce) return;
  for (let i = 0; i < n; i++) { const c = document.createElement('div'); c.className = 'confetti'; c.style.left = Math.random() * 100 + 'vw'; c.style.background = ACCENTS[i % ACCENTS.length]; c.style.animationDuration = (1.8 + Math.random() * 1.5) + 's'; c.style.animationDelay = Math.random() * .6 + 's'; document.body.appendChild(c); setTimeout(() => c.remove(), 3600); }
}
function showTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'build') setTimeout(() => { resizeHero(); resize3d(); if (state.set) renderPage(); }, 50);
  if (name === 'home') setTimeout(resizeHero, 50);
  location.hash = name;
}
$$('.tab').forEach(t => t.onclick = () => { SFX.click(); showTab(t.dataset.tab); });
document.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (!e.target.closest('.tab,.ctl')) SFX.click(); if (settings.reduce) return; const r = document.createElement('span'); r.className = 'ripple'; const rect = b.getBoundingClientRect(); r.style.left = (e.clientX - rect.left) + 'px'; r.style.top = (e.clientY - rect.top) + 'px'; b.appendChild(r); setTimeout(() => r.remove(), 600); }, true);

/* =========================== APPEARANCE =========================== */
function applyTheme() {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const t = settings.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : settings.theme;
  document.documentElement.dataset.theme = t;
  document.documentElement.style.setProperty('--accent', settings.accent);
  const n = parseInt(String(settings.accent).replace('#', ''), 16) || 0; const lum = (.299 * ((n >> 16) & 255) + .587 * ((n >> 8) & 255) + .114 * (n & 255)) / 255; document.documentElement.style.setProperty('--on-accent', lum > .5 ? '#1a1a1a' : '#ffffff');
  document.documentElement.dataset.reduce = settings.reduce ? '1' : '0';
  $$('#theme-seg button').forEach(b => b.classList.toggle('active', b.dataset.v === settings.theme));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => settings.theme === 'auto' && applyTheme());

/* =========================== OFFICIAL INSTRUCTIONS (LEGO.com) =========================== */
// Same GraphQL query LEGO's own building-instructions page runs (www.lego.com/service/building-instructions/<set>).
const LEGO_GQL = 'https://www.lego.com/api/graphql';
const LEGO_QUERY = 'query getSetBuildingInstructions($setNumber: String!) { customerService { getBuildingInstructionsForSet(setNumber: $setNumber) { status data { name setNumber year ageRating setImage { src alt } setPieceCount theme { themeName } buildingInstructions { isAdditionalInfoBooklet sequence { total element } pdf { coverImage { src alt } pdfUrl fileSize } } } } } }';
const LEGO_SEARCH = 'https://www.lego.com/en-us/service/building-instructions';
const legoPage = num => `${LEGO_SEARCH}/${num}`;
const proxied = url => { const p = (settings.proxy || '').trim(); if (!p) return url; return p + (p.includes('?') ? '&' : '?') + 'url=' + encodeURIComponent(url); };
const status = m => { const el = $('#build-empty p'); if (el) el.innerHTML = m; };
const legoCache = LS('lego', {});
const fmtMB = bytes => bytes ? (bytes / 1e6).toFixed(bytes > 20e6 ? 0 : 1) + ' MB' : '';
const clone = o => JSON.parse(JSON.stringify(o));
const isLocalFile = location.protocol === 'file:';

async function legoLookup(num) {
  const body = JSON.stringify({ operationName: 'getSetBuildingInstructions', variables: { setNumber: num }, query: LEGO_QUERY });
  const urls = [LEGO_GQL]; if (settings.proxy) urls.push(proxied(LEGO_GQL));
  let lastErr = null;
  for (const url of urls) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); const res = j && j.data && j.data.customerService && j.data.customerService.getBuildingInstructionsForSet;
      if (!res) throw new Error('Unexpected response from LEGO.com');
      return res;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('LEGO.com unreachable');
}
function normalizeLego(d) {
  const booklets = (d.buildingInstructions || []).filter(b => b.pdf && b.pdf.pdfUrl).map(b => ({
    seq: +(b.sequence && b.sequence.element) || 1, total: +(b.sequence && b.sequence.total) || 1, extra: !!b.isAdditionalInfoBooklet,
    pdf: b.pdf.pdfUrl, cover: (b.pdf.coverImage && b.pdf.coverImage.src) || '', size: +b.pdf.fileSize || 0, pages: 0
  }));
  booklets.sort((a, b) => (a.extra - b.extra) || (a.seq - b.seq));
  return { num: String(d.setNumber), name: d.name || 'Set ' + d.setNumber, year: d.year || '', theme: (d.theme && d.theme.themeName) || 'LEGO®', pieces: +d.setPieceCount || 0, age: d.ageRating || '', img: (d.setImage && d.setImage.src) || '', booklets };
}
function persistPages() {
  const c = state.set && legoCache[state.set.num]; if (!c || !c.set) return;
  c.set.booklets.forEach((b, i) => { const m = state.set.booklets[i]; if (m && m.pages) b.pages = m.pages; });
  try { SAVE('lego', legoCache); } catch { }
}
const pageCounts = () => state.set ? state.set.booklets.map(b => b.pages || 0) : [];

/* =========================== REBRICKABLE (optional: piece inventory) =========================== */
const RB = 'https://rebrickable.com/api/v3/lego/';
const partsCache = LS('parts', {});
const rbKey = () => settings.rbKey || state.sharedKey || '';
async function rb(path) {
  const key = rbKey(); if (!key) throw new Error('NOKEY');
  const r = await fetch(RB + path + (path.includes('?') ? '&' : '?') + 'key=' + key);
  if (r.status === 401) throw new Error('BADKEY');
  if (r.status === 404) throw new Error('NOTFOUND');
  if (r.status === 429) throw new Error('RATE');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function fetchParts(num) {
  const key = num + '-1'; if (partsCache[key]) return partsCache[key];
  let parts = [], url = `sets/${key}/parts/?page_size=1000&inc_minifig_parts=1`;
  while (url) { const p = await rb(url.replace(RB, '')); parts.push(...p.results); url = p.next ? p.next.replace(RB, '') : null; }
  const out = parts.filter(p => !p.is_spare).map(p => ({ name: p.part.name, num: p.part.part_num, img: p.part.part_img_url, color: '#' + p.color.rgb, colorName: p.color.name, qty: p.quantity }));
  out.sort((a, b) => a.colorName.localeCompare(b.colorName) || a.name.localeCompare(b.name));
  partsCache[key] = out; try { SAVE('parts', partsCache); } catch { } // may overflow; fine
  return out;
}

/* =========================== BUILD FLOW =========================== */
async function loadSet(numRaw, opts = {}) {
  const num = String(numRaw).trim().replace(/-1$/, '');
  if (!/^\d{3,7}$/.test(num)) { SFX.error(); toast('Enter a set number, e.g. 42171', '⚠️'); return; }
  showTab('build'); $('#build-empty').classList.remove('hidden'); $('#build-ui').classList.add('hidden'); status(`Looking up set ${num} on LEGO.com…`);
  stopPlay();
  const builtin = window.BUILTIN_SETS && window.BUILTIN_SETS[num];
  let set = null, source = 'lego';
  const cached = legoCache[num];
  if (cached && cached.set && Date.now() - cached.t < 7 * 864e5) set = clone(cached.set);
  else {
    try {
      const res = await legoLookup(num);
      if (res.status === 'ok' && res.data && res.data.buildingInstructions && res.data.buildingInstructions.length) {
        set = normalizeLego(res.data); legoCache[num] = { set: clone(set), t: Date.now() }; try { SAVE('lego', legoCache); } catch { }
      } else if (builtin) set = clone(builtin);
      else { status(`LEGO.com has no digital instructions for set <b>${esc(num)}</b>. Double-check the number, or <a href="${LEGO_SEARCH}" target="_blank" rel="noopener">search on LEGO.com ↗</a>.`); SFX.error(); return; }
    } catch (e) {
      console.warn('LEGO lookup failed', e);
      if (builtin) { set = clone(builtin); source = 'builtin'; }
      else { status(unreachableMsg(num)); SFX.error(); return; }
    }
  }
  if (builtin) { builtin.booklets.forEach(bb => { const m = set.booklets.find(b => b.pdf === bb.pdf); if (m && !m.pages) m.pages = bb.pages; }); ['model', 'modelSteps', 'modelCredit'].forEach(k => { if (builtin[k]) set[k] = clone(builtin[k]); }); }
  if (opts.pages) opts.pages.forEach((p, i) => { if (set.booklets[i] && p && !set.booklets[i].pages) set.booklets[i].pages = p; });
  // free booklets from the previous set
  Object.entries(docs).forEach(([url, e]) => { if (set.booklets.some(b => b.pdf === url)) return; try { if (e.task) e.task.destroy(); else if (e.doc) e.doc.destroy(); } catch { } delete docs[url]; });
  state.set = set; state.parts = null; state.partsLoading = false; state.booklet = -1; state.zoom = 1; state.dots = null;
  const saved = collection[num]; const savedStep = saved && saved.status !== 'wish' ? (saved.step || 0) : 0;
  const use3d = !!set.model && (opts.mode ? opts.mode === '3d' : true);
  state.mode = 'pages'; state.pos = { pages: use3d ? 0 : savedStep, '3d': use3d ? savedStep : 0 };
  rebuildSteps(false); state.step = Math.min(state.pos.pages, state.steps.length - 1);
  state.buildStart = Date.now();
  $('#build-empty').classList.add('hidden'); $('#build-ui').classList.remove('hidden');
  $('#mode-switch').classList.toggle('hidden', !set.model);
  renderHeader(); updateCollectButtons(); renderBooklets();
  setMode(use3d ? '3d' : 'pages'); peekOthers(set);
  SFX.whoosh(); revealSet(set);
  if (source === 'builtin') toast('LEGO.com unreachable — using built-in data for this set', '📦');
  if (rbKey()) {
    state.partsLoading = true; if (state.role === 'parts') renderPartsView();
    fetchParts(num).then(p => { if (state.set && state.set.num === num) { state.parts = p; state.partsLoading = false; if (state.role === 'parts') renderPartsView(); } })
      .catch(e => { console.warn('parts', e); if (state.set && state.set.num === num) { state.partsLoading = false; if (state.role === 'parts') renderPartsView(); } });
  }
  const inNetRoom = state.room && state.room.mode !== 'hotseat'; $('#role-switch').classList.toggle('hidden', !inNetRoom);
  if (inNetRoom && !state.roleAsked) { state.roleAsked = true; setTimeout(askRole, 600); }
  if (state.room && state.room.isHost) net.broadcast({ t: 'set', num, pages: pageCounts(), mode: state.mode });
  if (state.room && state.room.mode === 'divided') assignSteps();
}
function unreachableMsg(num) {
  const link = `<a href="${legoPage(num)}" target="_blank" rel="noopener">Open set ${esc(num)} on LEGO.com ↗</a>`;
  if (isLocalFile) return `Couldn't reach LEGO.com: browsers block web requests from pages opened as files. Start a local server (see README) and open <b>http://localhost:8080</b>, or try a built-in set such as <a href="#" onclick="loadSet('42171');return false">42171</a>.<br>${link}`;
  return `Couldn't reach LEGO.com from this site — the browser blocks cross-site requests from hosted pages. Add an instructions proxy in <a href="#" onclick="document.querySelector('[data-tab=settings]').click();return false">Settings</a> (see README), or run the site locally.<br>${link}`;
}
function renderHeader() {
  const s = state.set;
  $('#set-img').src = s.img || ''; $('#set-num').textContent = s.num; $('#set-name').textContent = s.name; $('#lnk-lego').href = legoPage(s.num);
  refreshSub();
}
function refreshSub() {
  const s = state.set; if (!s) return;
  const main = s.booklets.filter(b => !b.extra); const pages = main.reduce((a, b) => a + (b.pages || 0), 0); const known = main.length && main.every(b => b.pages);
  const bits = [s.theme, s.year, s.pieces ? s.pieces.toLocaleString() + ' pieces' : '', s.age ? 'Ages ' + s.age : '', s.model ? `${(m3.url === s.model && m3.steps.length) || s.modelSteps || ''} steps in 3D` : '', `${s.booklets.length} booklet${s.booklets.length === 1 ? '' : 's'}`, known ? pages + ' pages' : ''].filter(Boolean);
  $('#set-sub').textContent = bits.join(' · ');
}
// One step = one page of an official booklet (main booklets first, extra-info booklets after).
// Until a booklet's page count is known it is a single placeholder step (p = 0).
function rebuildSteps(keepPos = true) {
  const inPages = state.mode === 'pages'; const oldPos = inPages ? state.step : state.pos.pages;
  const cur = state.pageSteps[oldPos];
  const order = [...state.set.booklets.filter(b => !b.extra), ...state.set.booklets.filter(b => b.extra)];
  const steps = [];
  order.forEach(b => { const i = state.set.booklets.indexOf(b); const n = b.pages || 1; for (let p = 1; p <= n; p++) steps.push({ b: i, p: b.pages ? p : 0 }); });
  state.pageSteps = steps;
  let pos = Math.min(oldPos, steps.length - 1);
  if (keepPos && cur) { let idx = steps.findIndex(s => s.b === cur.b && s.p === cur.p); if (idx < 0) idx = steps.findIndex(s => s.b === cur.b); if (idx >= 0) pos = idx; }
  if (inPages) { state.steps = steps; state.step = Math.max(0, pos); } else state.pos.pages = Math.max(0, pos);
  refreshSub();
}
const bookletLabel = b => b.extra ? 'Extra info' : `Booklet ${b.seq}${b.total > 1 ? ' of ' + b.total : ''}`;
function renderBooklets() {
  const s = state.set; if (!s) return; const box = $('#booklets');
  $('#booklet-pill').textContent = s.booklets.length + (s.booklets.length === 1 ? ' booklet' : ' booklets');
  box.innerHTML = s.booklets.map((b, i) => {
    const d = docs[b.pdf] || {}; const meta = [b.pages ? b.pages + ' pages' : '', fmtMB(b.size), d.cached ? '💾 saved here' : ''].filter(Boolean).join(' · ');
    return `<div class="booklet ${i === state.booklet ? 'active' : ''}" data-i="${i}" title="Read ${esc(bookletLabel(b)).toLowerCase()}"><img src="${esc(b.cover || s.img || '')}" alt="" onerror="this.style.visibility='hidden'"><div class="bi"><b>${esc(bookletLabel(b))}</b><small>${esc(meta)}</small></div><a href="${esc(b.pdf)}" target="_blank" rel="noopener" class="icon-btn" title="Open the PDF in a new tab">↗</a></div>`;
  }).join('');
  $$('#booklets .booklet').forEach(el => el.onclick = e => { if (e.target.closest('a')) return; const idx = state.pageSteps.findIndex(st => st.b === +el.dataset.i); if (idx < 0) return; if (state.mode !== 'pages') { state.pos.pages = idx; setMode('pages'); } else showStep(idx); });
}

/* ---- PDF booklets (pdf.js) ---- */
const docs = {}; // pdfUrl -> { loading, task, doc, error, progress, cached }
let pdfjs = null;
async function pdfLib() {
  if (pdfjs) return pdfjs;
  const lib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  pdfjs = lib; return lib;
}
async function openBooklet(i) {
  const s = state.set; const b = s && s.booklets[i]; if (!b) return;
  state.booklet = i; renderBooklets();
  const entry = docs[b.pdf] || (docs[b.pdf] = { loading: false, task: null, doc: null, error: null, progress: 0, cached: false });
  if (entry.doc) { renderPage(); return; }
  if (entry.error) { showFallback(b); return; }
  if (entry.loading) { showLoading(b, entry); return; }
  entry.loading = true; showLoading(b, entry);
  try {
    const lib = await pdfLib();
    let params = null;
    try { if (window.caches) { const c = await caches.open('bah-booklets'); const hit = await c.match(b.pdf); if (hit) { params = { data: new Uint8Array(await hit.arrayBuffer()) }; entry.cached = true; showLoading(b, entry); } } } catch { }
    const sources = params ? [params] : [{ url: b.pdf }, ...(settings.proxy ? [{ url: proxied(b.pdf) }] : [])];
    let doc = null, lastErr = null;
    for (const src of sources) {
      try {
        const task = lib.getDocument({ ...src, withCredentials: false, isEvalSupported: false });
        entry.task = task;
        task.onProgress = ({ loaded, total }) => { entry.progress = Math.min(1, loaded / (total || b.size || loaded || 1)); updateLoading(b, entry); };
        doc = await task.promise; break;
      } catch (e) { lastErr = e; entry.task = null; }
    }
    if (!doc) throw lastErr || new Error('Booklet failed to load');
    if (state.set !== s) { doc.destroy(); return; }
    entry.doc = doc; entry.loading = false; entry.task = null;
    if (b.pages !== doc.numPages) { b.pages = doc.numPages; rebuildSteps(); renderStepUI(); persistPages(); if (state.room && state.room.isHost) net.broadcast({ t: 'pages', pages: pageCounts() }); }
    renderBooklets();
    if (state.steps[state.step] && state.steps[state.step].b === i) renderPage();
    if (!entry.cached) doc.getData().then(bytes => saveBooklet(b, entry, bytes)).catch(() => { });
  } catch (e) {
    console.warn('booklet load failed', e); entry.loading = false; entry.task = null; entry.error = e;
    if (state.set === s && state.steps[state.step] && state.steps[state.step].b === i) showFallback(b);
    renderBooklets();
  }
}
async function saveBooklet(b, entry, bytes) {
  try {
    if (!window.caches) return; const c = await caches.open('bah-booklets');
    await c.put(b.pdf, new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-length': String(bytes.length) } }));
    entry.cached = true; renderBooklets();
  } catch (e) { console.warn('booklet cache', e); }
}
// Page counts for booklets we haven't opened yet: read the linearization header from the first few KB.
async function peekOthers(s) {
  for (const b of s.booklets) {
    if (state.set !== s) return; if (b.pages || (docs[b.pdf] && docs[b.pdf].doc)) continue;
    const n = await peekPages(b.pdf).catch(() => 0);
    if (n && state.set === s) { b.pages = n; rebuildSteps(); renderStepUI(); renderBooklets(); persistPages(); if (state.room && state.room.isHost) net.broadcast({ t: 'pages', pages: pageCounts() }); }
  }
}
async function peekPages(url) {
  const urls = [url]; if (settings.proxy) urls.push(proxied(url));
  for (const u of urls) {
    try {
      const r = await fetch(u); if (!r.ok || !r.body) continue;
      const reader = r.body.getReader(); const dec = new TextDecoder('latin1'); let text = '', lin = null;
      while (text.length < 1048576) {
        const { value, done } = await reader.read(); if (done) break; text += dec.decode(value, { stream: true });
        if (text.length >= 16384 && lin === null) { const m = text.match(/\/Linearized[\s\S]{0,200}?\/N\s+(\d+)/); lin = m ? +m[1] : 0; if (lin) break; }
      }
      reader.cancel().catch(() => { });
      if (lin === null) { const m = text.match(/\/Linearized[\s\S]{0,200}?\/N\s+(\d+)/); if (m) return +m[1]; }
      if (lin) return lin;
      let best = 0; for (const m of text.matchAll(/\/Count\s+(\d+)/g)) best = Math.max(best, +m[1]); return best; // page-tree root is usually near the start
    } catch { }
  }
  return 0;
}
function showLoading(b, entry) {
  $('#pdf-fallback').classList.add('hidden'); $('#pdf-loading').classList.remove('hidden');
  $('#pl-cover').src = b.cover || state.set.img || ''; $('#pl-title').textContent = entry.cached ? 'Opening the saved booklet…' : `Downloading ${bookletLabel(b).toLowerCase()} from LEGO.com…`;
  $('#pl-open').href = b.pdf; updateLoading(b, entry);
}
function updateLoading(b, entry) {
  if (!entry.loading) return; const pct = Math.round(entry.progress * 100);
  $('#pl-bar').style.width = pct + '%';
  $('#pl-sub').textContent = entry.cached ? 'No download needed — it was kept on this device.' : b.size ? `${fmtMB(entry.progress * b.size)} of ${fmtMB(b.size)} · the first pages appear as soon as they arrive` : pct + '%';
}
function hideLoading() { $('#pdf-loading').classList.add('hidden'); $('#pdf-fallback').classList.add('hidden'); }
function showFallback(b) {
  $('#pdf-loading').classList.add('hidden'); $('#pdf-fallback').classList.remove('hidden');
  $('#pf-cover').src = b.cover || state.set.img || ''; $('#pf-title').textContent = `${bookletLabel(b)}${b.pages ? ' · ' + b.pages + ' pages' : ''}${b.size ? ' · ' + fmtMB(b.size) : ''}`;
  $('#pf-sub').textContent = 'The official booklet opens in a new tab.'; $('#pf-open').href = b.pdf; $('#pf-lego').href = legoPage(state.set.num);
  $('#pf-hint').textContent = isLocalFile ? 'To read booklets right here, start a local server (see README) and open http://localhost:8080.'
    : settings.proxy ? 'The proxy didn\'t return the PDF — check the URL in Settings → Data sources.'
    : 'To read booklets right here on a hosted site, add an instructions proxy in Settings (see README). Running the site locally needs no proxy.';
}
let renderTask = null, renderSeq = 0;
async function renderPage() {
  if (state.mode === '3d') return;
  const st = state.steps[state.step]; if (!st || !state.set) return; const b = state.set.booklets[st.b]; const entry = docs[b.pdf];
  if (!entry || !entry.doc) { if (entry && entry.error) showFallback(b); return; }
  const pageNo = Math.min(Math.max(1, st.p || 1), entry.doc.numPages); const seq = ++renderSeq;
  let page; try { page = await entry.doc.getPage(pageNo); } catch (e) { console.warn(e); return; }
  if (seq !== renderSeq) return;
  const box = $('#page-box'); const bw = box.clientWidth - 24, bh = box.clientHeight - 24; if (bw < 10 || bh < 10) return;
  const v1 = page.getViewport({ scale: 1 }); const fit = Math.min(bw / v1.width, bh / v1.height);
  const vp = page.getViewport({ scale: fit * state.zoom });
  let dpr = Math.min(window.devicePixelRatio || 1, 2); if (Math.max(vp.width, vp.height) * dpr > 4096) dpr = 4096 / Math.max(vp.width, vp.height);
  if (renderTask) { try { renderTask.cancel(); } catch { } renderTask = null; }
  const tmp = document.createElement('canvas'); tmp.width = Math.floor(vp.width * dpr); tmp.height = Math.floor(vp.height * dpr);
  const task = page.render({ canvasContext: tmp.getContext('2d', { alpha: false }), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }); renderTask = task;
  try { await task.promise; } catch (e) { if (!e || e.name !== 'RenderingCancelledException') console.warn(e); return; }
  if (seq !== renderSeq) return;
  renderTask = null;
  const canvas = $('#page-canvas'); canvas.width = tmp.width; canvas.height = tmp.height; canvas.style.width = Math.floor(vp.width) + 'px'; canvas.style.height = Math.floor(vp.height) + 'px';
  canvas.getContext('2d').drawImage(tmp, 0, 0);
  hideLoading();
  if (pageNo < entry.doc.numPages) entry.doc.getPage(pageNo + 1).catch(() => { }); // warm the next page
}

function showStep(idx, animate = true, fromNet = false) {
  if (!state.set || !state.steps.length) return;
  idx = Math.max(0, Math.min(state.steps.length - 1, idx));
  if (state.mySteps && !state.mySteps.includes(idx) && !fromNet && state.room && state.room.mode === 'divided' && Object.keys(net.peers).length > 1) { toast(state.mode === '3d' ? 'That step belongs to another builder' : 'That page belongs to another builder', '👥'); return; }
  const forward = idx > state.step, moved = idx !== state.step; state.step = idx;
  if (state.mode === '3d') show3dStep(idx, animate && moved);
  else {
    const st = state.steps[idx]; const b = state.set.booklets[st.b]; const entry = docs[b.pdf];
    if (entry && entry.doc) { if (state.booklet !== st.b) { state.booklet = st.b; renderBooklets(); } renderPage(); }
    else openBooklet(st.b);
    if (moved && animate && !settings.reduce) { const w = $('#page-wrap'); w.classList.remove('flip-fwd', 'flip-back'); void w.offsetWidth; w.classList.add(forward ? 'flip-fwd' : 'flip-back'); }
  }
  if (!forward && moved && animate) SFX.back();
  const pill = $('.step-pill'); pill.classList.remove('pop'); void pill.offsetWidth; pill.classList.add('pop');
  renderStepUI();
  const c = collection[state.set.num]; if (c && c.status === 'building') { c.step = idx; c.total = state.steps.length; c.mode = state.mode; SAVE('collection', collection); }
  if (!fromNet && state.room) net.broadcast({ t: 'step', idx, mode: state.mode, who: net.id, progress: idx / (state.steps.length - 1 || 1) });
}
function renderStepUI() {
  const total = state.steps.length, idx = state.step; const st = state.steps[idx]; if (!st) return; const is3d = state.mode === '3d'; const b = is3d ? null : state.set.booklets[st.b];
  if (is3d) { $('#hud-label').textContent = st.bag ? `Bag ${st.bag} · Step` : 'Step'; $('#hud-step').textContent = idx + 1; $('#hud-total').textContent = total; }
  else {
    $('#hud-label').textContent = st.p ? (state.set.booklets.length > 1 ? `${b.extra ? 'Extra' : 'Booklet ' + b.seq} · Page` : 'Page') : 'Booklet';
    $('#hud-step').textContent = st.p || (st.b + 1); $('#hud-total').textContent = st.p ? (b.pages || '?') : state.set.booklets.length;
  }
  $('#step-slider').max = total; $('#step-slider').value = idx + 1;
  $('#progress-bar').style.width = ((idx + 1) / total * 100) + '%';
  $('#btn-prev').disabled = $('#btn-first').disabled = idx === 0; $('#btn-next').disabled = $('#btn-last').disabled = idx >= total - 1;
  $('#step-count-pill').textContent = total > 1 ? `${idx + 1} / ${total}` : '';
  const list = $('#step-list'); const multi = state.set.booklets.length > 1; const key = state.set.num + '|' + state.mode;
  if (!state.dots || state.dots.length !== total || list.dataset.key !== key) {
    list.innerHTML = ''; list.dataset.key = key; const frag = document.createDocumentFragment(); state.dots = [];
    for (let i = 0; i < total; i++) {
      const s = state.steps[i]; const d = document.createElement('div'); d.className = 'step-dot';
      if (is3d) {
        if (s.bag && (i === 0 || state.steps[i - 1].bag !== s.bag)) { const h = document.createElement('div'); h.className = 'step-sep'; h.textContent = 'Bag ' + s.bag; frag.appendChild(h); }
        d.textContent = i + 1; d.title = `Step ${i + 1}${s.bag ? ' · bag ' + s.bag : ''}${s.parts && s.parts.length ? '' : ' · no new pieces'}`; if (!s.parts || !s.parts.length) d.dataset.nopart = '1';
      } else {
        const bk = state.set.booklets[s.b];
        if (multi && (i === 0 || state.steps[i - 1].b !== s.b)) { const h = document.createElement('div'); h.className = 'step-sep'; h.textContent = bookletLabel(bk); frag.appendChild(h); }
        d.textContent = s.p || (s.b + 1); d.title = multi ? `${bookletLabel(bk)} · page ${s.p || 1}` : `Page ${s.p || 1}`;
      }
      d.onclick = () => showStep(i); frag.appendChild(d); state.dots.push(d);
    }
    list.appendChild(frag);
  }
  state.dots.forEach((d, i) => { d.className = 'step-dot' + (i < idx ? ' done' : i === idx ? ' cur' : '') + (d.dataset.nopart ? ' nopart' : '') + (state.mySteps ? (state.mySteps.includes(i) ? ' mine' : ' other') : ''); });
  if (is3d) renderStepParts();
  const cur = state.dots[idx];
  if (cur && (cur.offsetTop < list.scrollTop || cur.offsetTop > list.scrollTop + list.clientHeight - 40)) list.scrollTop = Math.max(0, cur.offsetTop - list.clientHeight / 2);
  if (state.role === 'parts') renderPartsView();
  const ap = $('#hud-assign'); if (state.mySteps) { ap.classList.remove('hidden'); ap.style.background = settings.avatar; ap.textContent = `Your pages: ${state.mySteps.length}`; } else ap.classList.add('hidden');
}
function nextStep() { if (state.step >= state.steps.length - 1) return finishBuild(); showStep(state.step + 1); SFX.step(); }
function finishBuild() {
  stopPlay();
  SFX.fanfare(); confetti(); $('#step-complete-flash').classList.add('go'); setTimeout(() => $('#step-complete-flash').classList.remove('go'), 700);
  const c = collection[state.set.num]; const ms = Date.now() - state.buildStart;
  if (c) { c.status = 'done'; c.step = state.steps.length - 1; c.ms = (c.ms || 0) + ms; saveCollection(); }
  if (state.room) net.broadcast({ t: 'finish', who: net.id, name: settings.name });
  modal(`<h3>🎉 Build complete!</h3><p>${esc(state.set.name)} — ${state.set.pieces.toLocaleString()} pieces.</p>${c ? '' : '<p class="muted small">Add it to your collection to flex it on the Home shelf.</p>'}`,
    [c ? { label: 'View collection', cls: 'primary', fn: () => showTab('home') } : { label: 'Add to collection', cls: 'primary', fn: () => { addToCollection('done'); showTab('home'); } }, { label: 'Close' }]);
}
function stopPlay() { state.playing = false; clearTimeout(state.playT); $('#btn-play').textContent = '▶'; }
function togglePlay() {
  if (state.playing) { stopPlay(); return; }
  state.playing = true; $('#btn-play').textContent = '⏸';
  const tick = () => { if (!state.playing) return; if (state.step >= state.steps.length - 1) { finishBuild(); return; } showStep(state.step + 1); state.playT = setTimeout(tick, settings.autoSecs * 1000); };
  state.playT = setTimeout(tick, settings.autoSecs * 1000);
}
$('#btn-next').onclick = () => { showStep(state.step + 1); SFX.step(); };
$('#btn-prev').onclick = () => showStep(state.step - 1);
$('#btn-first').onclick = () => showStep(0);
$('#btn-last').onclick = () => showStep(state.steps.length - 1);
$('#btn-play').onclick = togglePlay;
$('#btn-done-step').onclick = () => { if (!settings.autoAdv) { toast('Page marked done', '✓'); return; } nextStep(); };
$('#step-slider').oninput = e => showStep(+e.target.value - 1, false);
$('#speed').oninput = e => { settings.autoSecs = +e.target.value; saveSettings(); syncAutoLabels(); };
function syncAutoLabels() { $('#speed').value = settings.autoSecs; $('#speed-label').textContent = settings.autoSecs + 's'; $('#s-autosecs').value = settings.autoSecs; $('#autosecs-label').textContent = settings.autoSecs + 's'; }
function zoomTo(z) { state.zoom = Math.max(1, Math.min(3, z)); renderPage(); SFX.click(); }
$('#btn-zoom-in').onclick = () => state.mode === '3d' ? zoom3d(.78) : zoomTo(state.zoom * 1.25); $('#btn-zoom-out').onclick = () => state.mode === '3d' ? zoom3d(1.28) : zoomTo(state.zoom / 1.25); $('#btn-fit').onclick = () => state.mode === '3d' ? frame3d(true) : zoomTo(1);
$$('#mode-switch button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('#btn-fullscreen').onclick = () => { const v = $('#viewer'); document.fullscreenElement ? document.exitFullscreen() : v.requestFullscreen(); };
document.addEventListener('fullscreenchange', () => setTimeout(() => { resizeHero(); resize3d(); renderPage(); }, 120));
let rzT = null; addEventListener('resize', () => { resizeHero(); resize3d(); clearTimeout(rzT); rzT = setTimeout(() => state.set && renderPage(), 150); });
document.addEventListener('keydown', e => {
  if (!$('#tab-build').classList.contains('active') || !state.set || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); nextStep(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); showStep(state.step - 1); }
  else if (e.key === 'Home') showStep(0); else if (e.key === 'End') showStep(state.steps.length - 1);
  else if (e.key === 'p') togglePlay();
  else if (e.key === '+' || e.key === '=') $('#btn-zoom-in').click(); else if (e.key === '-') $('#btn-zoom-out').click(); else if (e.key === '0') $('#btn-fit').click();
  else if (e.key === 'f') $('#btn-fullscreen').click();
});

/* =========================== 3D BUILD (three.js + LDraw model with official steps) =========================== */
const m3 = { renderer: null, scene: null, camera: null, controls: null, root: null, parts: [], steps: [], names: {}, colors: {}, loaded: false, loading: false, url: '', anims: [], hi: [], hiCache: new Map(), clock: null, mods: null, firstFrame: true };
const hex2rgb = h => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const cdist = (a, b) => { const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return dr * dr * .3 + dg * dg * .59 + db * db * .11; };
async function threeMods() {
  if (m3.mods) return m3.mods;
  const [T, O, L] = await Promise.all([import('three'), import('three/addons/controls/OrbitControls.js'), import('three/addons/loaders/LDrawLoader.js')]);
  THREE = T; m3.mods = { T, OrbitControls: O.OrbitControls, LDrawLoader: L.LDrawLoader }; return m3.mods;
}
function parseLDConfig(text) { const out = {}; text.split('\n').forEach(l => { const m = l.match(/^0\s+!COLOUR\s+(\S+)\s+CODE\s+(\d+)\s+VALUE\s+(#[0-9A-Fa-f]{6})/); if (m) out[+m[2]] = { name: m[1].replace(/_/g, ' '), hex: m[3] }; }); return out; }
// The main model of the MPD: one entry per official step (0 STEP), parts as { file, color }, bag numbers from Studio's markers.
function parseLdrawModel(text) {
  const lines = text.split('\n'); const steps = [{ parts: [] }]; const names = {}; const bagAt = {}; const prim = new Set(); let fileIdx = 0, curFile = '';
  const canon = f => { f = f.replace(/\\/g, '/').toLowerCase(); return f.replace(/^parts\/s\//, 's/').replace(/^p\/48\//, '48/'); };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim(); if (!l) continue;
    if (l.startsWith('0 FILE ')) { fileIdx++; curFile = canon(l.slice(7).trim()); names[curFile] = (lines[i + 1] || '').trim().replace(/^0\s*/, ''); continue; }
    if (fileIdx > 1 && /^0 !LDRAW_ORG\s+\S*(primitive|subpart)/i.test(l)) prim.add(curFile);
  }
  fileIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim(); if (!l) continue;
    if (l.startsWith('0 FILE ')) { fileIdx++; continue; }
    if (fileIdx !== 1) continue;
    if (l.startsWith('1 ')) { const t = l.split(/\s+/); const file = canon(t.slice(14).join(' ')); if (prim.has(file) || /^(s\/|48\/|8\/)/.test(file)) continue; steps[steps.length - 1].parts.push({ file, color: +t[1] }); }
    else if (l === '0 STEP') steps.push({ parts: [] });
    else if (l.startsWith('0 STUDIOSTEPDESC')) { const m = l.match(/(\d+)___(\d+)/); if (m) bagAt[+m[2] - 1] = +m[1]; }
  }
  if (steps.length > 1 && !steps[steps.length - 1].parts.length) steps.pop();
  let bag = 0; steps.forEach((s, i) => { if (bagAt[i]) bag = bagAt[i]; s.bag = bag; });
  return { steps, names };
}
const scriptText = url => new Promise((res, rej) => { // models/<file>.js sets window.BAH_FILES[url]; works from file:// where fetch() is blocked
  window.BAH_FILES = window.BAH_FILES || {}; if (window.BAH_FILES[url]) return res(window.BAH_FILES[url]);
  const sc = document.createElement('script'); sc.src = url + '.js'; sc.onload = () => window.BAH_FILES[url] ? res(window.BAH_FILES[url]) : rej(new Error('no data in ' + url + '.js')); sc.onerror = () => rej(new Error('cannot load ' + url)); document.head.appendChild(sc);
});
async function fetchText(url, onP) {
  let r = null; try { r = await fetch(url, { cache: 'no-cache' }); } catch (e) { r = null; }
  if (!r) return scriptText(url);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
  if (!r.body) return r.text();
  const total = +r.headers.get('content-length') || 0; const reader = r.body.getReader(); const chunks = []; let got = 0;
  for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); got += value.length; if (onP && total) onP(Math.min(1, got / total)); }
  const dec = new TextDecoder(); return chunks.map(c => dec.decode(c, { stream: true })).join('') + dec.decode();
}
function showModelLoading(title, p) {
  const ov = $('#model-loading'); ov.classList.remove('hidden'); $('#ml-cover').src = state.set ? state.set.img || '' : ''; $('#ml-title').textContent = title;
  $('#ml-sub').textContent = state.set && state.set.pieces ? `${state.set.pieces.toLocaleString()} pieces · ${m3.steps.length || state.set.modelSteps || '?'} official steps` : ''; $('#ml-bar').style.width = Math.round(p * 100) + '%';
}
function init3d() {
  if (m3.renderer) return; const T = m3.mods.T; const canvas = $('#model-canvas');
  m3.renderer = new T.WebGLRenderer({ canvas, antialias: true }); m3.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); m3.renderer.setClearColor(0xf4f4f4, 1);
  m3.scene = new T.Scene(); m3.camera = new T.PerspectiveCamera(35, 1, 1, 40000); m3.camera.position.set(600, 450, 600);
  m3.scene.add(new T.HemisphereLight(0xffffff, 0x99a3b3, 1.1));
  const d1 = new T.DirectionalLight(0xffffff, 1.5); d1.position.set(600, 900, 500); m3.scene.add(d1);
  const d2 = new T.DirectionalLight(0xffffff, .55); d2.position.set(-500, 300, -600); m3.scene.add(d2);
  m3.controls = new m3.mods.OrbitControls(m3.camera, canvas); m3.controls.enableDamping = true; m3.controls.dampingFactor = .08; m3.controls.minDistance = 30; m3.controls.maxDistance = 8000;
  m3.root = new T.Group(); m3.root.rotation.x = Math.PI; m3.scene.add(m3.root); // LDraw is -Y up
  m3.clock = new T.Clock();
  (function loop() { requestAnimationFrame(loop); if (state.mode !== '3d' || canvas.classList.contains('hidden')) return; const dt = Math.min(.1, m3.clock.getDelta()); m3.anims = m3.anims.filter(a => { a.t += dt; const p = Math.min(1, a.t / a.dur); a.fn(ease(Math.max(0, p)), p); return p < 1; }); m3.controls.update(); m3.renderer.render(m3.scene, m3.camera); })();
}
function resize3d() { if (!m3.renderer) return; const v = $('#viewer'); const w = v.clientWidth, h = v.clientHeight; if (!w || !h) return; m3.renderer.setSize(w, h, false); m3.camera.aspect = w / h; m3.camera.updateProjectionMatrix(); }
async function fetchBinary(url, onP) {
  let r = null; try { r = await fetch(url, { cache: 'no-cache' }); } catch (e) { r = null; }
  if (r && r.ok) {
    if (!r.body) return new Uint8Array(await r.arrayBuffer());
    const total = +r.headers.get('content-length') || 0; const reader = r.body.getReader(); const chunks = []; let got = 0;
    for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); got += value.length; if (onP && total) onP(Math.min(1, got / total)); }
    const out = new Uint8Array(got); let o = 0; chunks.forEach(c => { out.set(c, o); o += c.length; }); return out;
  }
  const b64 = await scriptText(url); const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
}
// Baked model: header JSON + quantised, indexed geometry (see models/ and README). Decoding is milliseconds, no LDraw parsing.
function decodeBaked(u8) {
  if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'BAH2') throw new Error('unknown model format');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); const hlen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hlen)));
  const pad = n => (4 - (n % 4)) % 4; const B = header.blocks;
  let off = 8 + hlen; off += pad(off); const posOff = off; off += B.pos * 2; off += pad(off); const i16Off = off; off += B.i16 * 2; off += pad(off); const i32Off = off; off += B.i32 * 4; const nrmOff = off;
  const ab = u8.buffer, base = u8.byteOffset;
  return { header, pos: new Int16Array(ab, base + posOff, B.pos), i16: new Uint16Array(ab, base + i16Off, B.i16), i32: new Uint32Array(ab, base + i32Off, B.i32), nrm: new Int8Array(ab, base + nrmOff, B.nrm) };
}
function buildBaked(data) {
  const T = m3.mods.T; const { header, pos, i16, i32, nrm } = data; const inv = 1 / header.scale;
  const geoms = []; let po = 0, no = 0, a16 = 0, a32 = 0;
  header.geoms.forEach(g => {
    const geo = new T.BufferGeometry(); const n = g.n * 3; const p = new Float32Array(n); for (let i = 0; i < n; i++) p[i] = pos[po + i] * inv; po += n;
    geo.setAttribute('position', new T.BufferAttribute(p, 3));
    if (g.k === 'm') { geo.setAttribute('normal', new T.BufferAttribute(new Int8Array(nrm.buffer, nrm.byteOffset + no, n), 3, true)); no += n; }
    if (g.w === 2) { geo.setIndex(new T.BufferAttribute(new Uint16Array(i16.buffer, i16.byteOffset + a16 * 2, g.i), 1)); a16 += g.i; }
    else { geo.setIndex(new T.BufferAttribute(new Uint32Array(i32.buffer, i32.byteOffset + a32 * 4, g.i), 1)); a32 += g.i; }
    geoms.push(geo);
  });
  const mats = {}; Object.entries(header.mats).forEach(([k, m]) => { mats[k] = new T.MeshStandardMaterial({ color: new T.Color(m.hex), roughness: m.roughness, metalness: m.metalness, transparent: !!m.transparent || m.opacity < 1, opacity: m.opacity }); });
  const lineMats = {}; const lineMat = hex => lineMats[hex] || (lineMats[hex] = new T.LineBasicMaterial({ color: new T.Color(hex) }));
  const model = new T.Group(); const mtx = new T.Matrix4();
  const baseHex = c => ((header.colors[c] || {}).hex || '').toLowerCase();
  const parts = [];
  header.placements.forEach(p => {
    if (!p.g.length && !p.l.length) return; // geometry lives in a merged step group (mosaics)
    const g = new T.Group(); g.name = p.f; g.userData.fileName = p.f; g.userData.colorCode = p.c; g.userData.step = p.s;
    mtx.fromArray(p.m); mtx.decompose(g.position, g.quaternion, g.scale); g.userData.home = g.position.clone();
    p.g.forEach(([gi, mk, t]) => { const mesh = new T.Mesh(geoms[gi], mats[mk]); mesh.userData.passthrough = (header.mats[mk] || {}).hex && (header.mats[mk].hex.toLowerCase() === baseHex(p.c)); if (t) { mtx.fromArray(t); mtx.decompose(mesh.position, mesh.quaternion, mesh.scale); } g.add(mesh); });
    p.l.forEach(([gi, hex, t]) => { const line = new T.LineSegments(geoms[gi], lineMat(hex)); if (t) { mtx.fromArray(t); mtx.decompose(line.position, line.quaternion, line.scale); } g.add(line); });
    model.add(g); parts.push(g);
  });
  (header.merged || []).forEach(m => {
    const g = new T.Group(); g.name = 'step-' + m.s; g.userData.step = m.s; g.userData.merged = true; g.userData.home = g.position.clone();
    m.g.forEach(([gi, mk]) => g.add(new T.Mesh(geoms[gi], mats[mk]))); (m.l || []).forEach(([gi, hex]) => g.add(new T.LineSegments(geoms[gi], lineMat(hex))));
    model.add(g); parts.push(g);
  });
  (header.instanced || []).forEach(e => {
    const im = new T.InstancedMesh(geoms[e.g], mats[e.k], e.n); e.m.forEach((arr, i) => { mtx.fromArray(arr); im.setMatrixAt(i, mtx); }); im.instanceMatrix.needsUpdate = true; im.computeBoundingBox();
    const g = new T.Group(); g.name = 'instanced-' + e.s; g.userData.step = e.s; g.userData.merged = true; g.userData.home = g.position.clone(); g.add(im); model.add(g); parts.push(g);
  });
  m3.matFor = c => { const hex = baseHex(c) || '#9a9a9a'; const k = Object.keys(header.mats).find(k => header.mats[k].hex.toLowerCase() === hex && header.mats[k].opacity >= 1) || Object.keys(header.mats).find(k => header.mats[k].hex.toLowerCase() === hex); return k ? mats[k] : new T.MeshStandardMaterial({ color: new T.Color(hex), roughness: .7 }); };
  const steps = header.steps.map(st => ({ bag: st.bag, parts: [] })); header.placements.forEach(p => { if (steps[p.s]) steps[p.s].parts.push({ file: p.f, color: p.c }); });
  return { model, parts, steps, names: header.names, colors: header.colors };
}
async function buildModel(set, onP) { // fetch + parse + build geometry into m3 (no UI). Shared by the boot-time preload and the Build tab.
  const url = set.model; if (!url) throw new Error('no model');
  if (onP) m3.onP = onP;
  if (m3.loaded && m3.url === url) return; if (m3.loading && m3.url === url) return m3.promise;
  while (m3.loading && m3.promise) { try { await m3.promise; } catch (e) { } } // one build at a time: never reset a model that is still being built
  if (m3.loaded && m3.url === url) return;
  m3.loading = true; m3.loaded = false; m3.url = url; m3.steps = []; m3.parts = []; m3.hi = []; m3.anims = []; m3.lastBag = undefined;
  m3.promise = (async () => {
    const t0 = performance.now();
    if (/\.bin$/i.test(url)) {
      const [mods, bin] = await Promise.all([threeMods(), fetchBinary(url, p => m3.onP && m3.onP('fetch', p))]);
      m3.onP && m3.onP('build', 0); await new Promise(r => setTimeout(r, 30));
      init3d(); const built = buildBaked(decodeBaked(bin));
      m3.steps = built.steps; m3.names = built.names; m3.colors = built.colors; m3.parts = built.parts;
      while (m3.root.children.length) m3.root.remove(m3.root.children[0]);
      m3.root.add(built.model); m3.root.updateMatrixWorld(true);
      m3.loaded = true; m3.loading = false; m3.firstFrame = true; m3.buildMs = Math.round(performance.now() - t0);
      console.log(`3D model ready (baked): ${m3.parts.length} pieces, ${m3.steps.length} steps, ${m3.buildMs} ms`);
      return;
    }
    const dir = url.replace(/[^/]*$/, '');
    const [mods, text0, cfg] = await Promise.all([threeMods(), fetchText(url, p => m3.onP && m3.onP('fetch', p)), fetchText(dir + 'LDConfig.ldr')]);
    m3.colors = parseLDConfig(cfg);
    const parsed = parseLdrawModel(text0); m3.steps = parsed.steps; m3.names = parsed.names;
    // The model's main file carries no colour table, so give it LDConfig's: parts then resolve their colour codes.
    const nl = text0.indexOf('\n'); const text = text0.slice(0, nl + 1) + cfg.split(/\r?\n/).filter(l => /^0 !COLOUR/.test(l)).join('\n') + '\n' + text0.slice(nl + 1);
    m3.onP && m3.onP('build', 0);
    init3d(); await new Promise(r => setTimeout(r, 30));
    const loader = new mods.LDrawLoader(); loader.smoothNormals = true;
    await loader.preloadMaterials('data:text/plain;charset=utf-8,' + encodeURIComponent(cfg));
    const group = await loader.partsCache.parseModel(text);
    loader.applyMaterialsToMesh(group, 16, loader.materialLibrary, true); loader.computeBuildingSteps(group);
    const kids = group.children.filter(c => c.isGroup); const flat = []; m3.steps.forEach((st, si) => st.parts.forEach(pp => flat.push({ ...pp, step: si })));
    const nonEmpty = []; m3.steps.forEach((st, si) => { if (st.parts.length) nonEmpty.push(si); });
    const aligned = kids.length === flat.length;
    if (!aligned) console.warn('3D model: placed parts', kids.length, 'vs listed', flat.length, '— using loader step numbers');
    kids.forEach((g, i) => { g.userData.step = aligned ? flat[i].step : (nonEmpty[g.userData.buildingStep] ?? 0); g.userData.home = g.position.clone(); });
    m3.parts = kids;
    while (m3.root.children.length) m3.root.remove(m3.root.children[0]);
    m3.root.add(group); m3.root.updateMatrixWorld(true);
    m3.loaded = true; m3.loading = false; m3.firstFrame = true; m3.buildMs = Math.round(performance.now() - t0);
    console.log(`3D model ready: ${kids.length} pieces, ${m3.steps.length} steps, ${m3.buildMs} ms`);
  })();
  try { await m3.promise; } catch (e) { m3.loading = false; m3.loaded = false; throw e; } finally { m3.promise = null; m3.onP = null; }
}
async function loadModel(set) {
  const url = set.model; if (!url) return;
  if (m3.loaded && m3.url === url) { resize3d(); show3dStep(state.step, false); renderModelCredit(); return; }
  showModelLoading('Fetching the 3D model…', 0);
  try {
    await buildModel(set, (phase, p) => { if (state.set !== set || state.mode !== '3d') return; if (phase === 'fetch') showModelLoading('Fetching the 3D model…', p * .4); else showModelLoading(`Building ${set.pieces.toLocaleString()} pieces in 3D…`, .45); if (m3.steps.length && state.steps !== m3.steps) { state.steps = m3.steps; state.step = Math.min(state.step, state.steps.length - 1); state.dots = null; renderStepUI(); refreshSub(); } });
    if (state.set !== set) return;
    $('#model-loading').classList.add('hidden');
    if (state.mode === '3d') { state.steps = m3.steps; state.step = Math.min(state.step, state.steps.length - 1); state.dots = null; resize3d(); show3dStep(state.step, false); renderStepUI(); refreshSub(); }
    renderModelCredit();
  } catch (e) {
    console.warn('3D model failed', e); $('#model-loading').classList.add('hidden');
    if (m3.failed !== url) toast('3D model unavailable (' + esc((e && e.message) || String(e)).slice(0, 90) + ') — showing the booklet', '⚠️'); m3.failed = url; if (state.set === set) setMode('pages');
  }
}
function hiMat(m) { if (!m3.hiCache.has(m)) { const c = m.clone(); if (c.emissive) { c.emissive = c.color.clone(); c.emissiveIntensity = .55; } m3.hiCache.set(m, c); } return m3.hiCache.get(m); }
function hiLine() { if (!m3.hiLineMat) m3.hiLineMat = new m3.mods.T.LineBasicMaterial({ color: 0xff6a00 }); return m3.hiLineMat; }
function bagFlash(n) {
  if (settings.reduce) return; const el = $('#bag-flash');
  el.innerHTML = `<div class="bag-card"><div class="bag-shape"><b>${n}</b></div><div class="bag-label">Open bag ${n}</div></div>`;
  el.classList.remove('hidden'); clearTimeout(m3.bagT); m3.bagT = setTimeout(() => el.classList.add('hidden'), 1900); SFX.bag();
}
function show3dStep(idx, animate) {
  if (!m3.loaded) return; const T = m3.mods.T;
  const bag = (m3.steps[idx] || {}).bag || 0; if (bag && bag !== m3.lastBag && (animate || m3.lastBag === undefined)) bagFlash(bag); m3.lastBag = bag;
  m3.hi.forEach(h => { h.mesh.material = h.mat; }); m3.hi = []; m3.anims = m3.anims.filter(a => !a.part);
  const cur = [];
  m3.parts.forEach(g => { const s = g.userData.step; g.visible = s <= idx; g.position.copy(g.userData.home); if (s === idx) { cur.push(g); g.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { m3.hi.push({ mesh: o, mat: o.material }); o.material = hiMat(o.material); } else if (o.isLineSegments && o.material) { m3.hi.push({ mesh: o, mat: o.material }); o.material = hiLine(); } }); } });
  if (animate && !settings.reduce && cur.length) {
    cur.forEach((g, i) => { const to = g.userData.home, from = to.clone().add(new T.Vector3(0, -90, 0)); g.position.copy(from); m3.anims.push({ part: true, t: -i * .06, dur: .55, fn: (e, p) => { if (p < 0) return; g.position.lerpVectors(from, to, e); } }); });
    setTimeout(() => SFX.snap(), 400);
  }
  frame3d(animate || m3.firstFrame); m3.firstFrame = false;
}
function frame3d(animate = true) {
  if (!m3.loaded) return; const T = m3.mods.T; m3.root.updateMatrixWorld(true);
  const box = new T.Box3(); const tmp = new T.Box3(); let any = false;
  m3.parts.forEach(g => { if (!g.visible) return; tmp.setFromObject(g); if (!tmp.isEmpty()) { box.union(tmp); any = true; } });
  if (!any) return;
  const center = box.getCenter(new T.Vector3()); const sz = box.getSize(new T.Vector3()); const radius = Math.max(24, Math.max(sz.x, sz.y, sz.z) * .52, sz.length() * .33);
  const dist = radius / Math.sin((m3.camera.fov * Math.PI / 180) / 2) * 1.0 + 6;
  const dir = m3.camera.position.clone().sub(m3.controls.target); if (dir.lengthSq() < 1 || m3.firstFrame) dir.set(1, .75, 1.1); dir.normalize();
  const toPos = center.clone().add(dir.multiplyScalar(dist)); const fromPos = m3.camera.position.clone(), fromT = m3.controls.target.clone();
  m3.anims = m3.anims.filter(a => !a.cam);
  if (!animate || settings.reduce) { m3.camera.position.copy(toPos); m3.controls.target.copy(center); m3.controls.update(); return; }
  m3.anims.push({ cam: true, t: 0, dur: .6, fn: e => { m3.camera.position.lerpVectors(fromPos, toPos, e); m3.controls.target.lerpVectors(fromT, center, e); } });
}
function zoom3d(f) {
  if (!m3.loaded) return; const dir = m3.camera.position.clone().sub(m3.controls.target); const len = dir.length() * f;
  if (len < m3.controls.minDistance || len > m3.controls.maxDistance) return;
  const to = m3.controls.target.clone().add(dir.normalize().multiplyScalar(len)); const from = m3.camera.position.clone();
  m3.anims = m3.anims.filter(a => !a.cam); m3.anims.push({ cam: true, t: 0, dur: .3, fn: e => m3.camera.position.lerpVectors(from, to, e) }); SFX.click();
}
// Real piece pictures: render the piece's own geometry (in the requested colour) to a small offscreen canvas.
const thumbs = new Map();
function partThumb(file, color) {
  const key = file + '|' + color; if (thumbs.has(key)) return thumbs.get(key);
  if (!m3.loaded || !m3.mods) return '';
  const T = m3.mods.T; const tpl = m3.parts.find(g => !g.userData.merged && (g.userData.fileName || '').toLowerCase() === file);
  if (!tpl) { thumbs.set(key, ''); return ''; }
  try {
    if (!m3.thumb) {
      const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 270;
      const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true }); renderer.setClearColor(0xf7f7f7, 1);
      const scene = new T.Scene(); scene.add(new T.HemisphereLight(0xffffff, 0xb8c0cc, 1.7));
      const d = new T.DirectionalLight(0xffffff, 2.0); d.position.set(2.5, 4, 3); scene.add(d); const d2 = new T.DirectionalLight(0xffffff, .8); d2.position.set(-3, 1.5, -2); scene.add(d2);
      const camera = new T.PerspectiveCamera(26, 360 / 270, .1, 5000); const holder = new T.Group(); holder.rotation.x = Math.PI; scene.add(holder);
      m3.thumb = { renderer, scene, camera, holder };
    }
    const { renderer, scene, camera, holder } = m3.thumb; while (holder.children.length) holder.remove(holder.children[0]);
    const mat = m3.matFor ? m3.matFor(color) : null; const g = new T.Group();
    const hexc = ((m3.colors[color] || {}).hex || '#888888'); const dark = hex2rgb(hexc).reduce((a, b) => a + b, 0) < 200;
    tpl.children.forEach(o => { if (o.isMesh) { const m = new T.Mesh(o.geometry, o.userData.passthrough && mat ? mat : o.material); m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale); g.add(m); } else if (o.isLineSegments) { const l = new T.LineSegments(o.geometry, new T.LineBasicMaterial({ color: dark ? 0x8a8a8a : 0x333333 })); l.position.copy(o.position); l.quaternion.copy(o.quaternion); l.scale.copy(o.scale); g.add(l); } });
    holder.add(g); holder.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(g); const center = box.getCenter(new T.Vector3()); const size = box.getSize(new T.Vector3()); const radius = Math.max(8, Math.max(size.x, size.y, size.z) * .6, size.length() * .43);
    const dist = radius / Math.sin((camera.fov * Math.PI / 180) / 2) * 1.14; camera.position.copy(center).add(new T.Vector3(1, .8, 1.15).normalize().multiplyScalar(dist)); camera.lookAt(center); camera.updateProjectionMatrix();
    renderer.render(scene, camera); const url = renderer.domElement.toDataURL('image/png'); thumbs.set(key, url); return url;
  } catch (e) { console.warn('thumb', e); thumbs.set(key, ''); return ''; }
}
function rbPart(num, hex) {
  if (!state.parts) return null; const cands = state.parts.filter(p => p.num.toLowerCase() === num.toLowerCase()); if (!cands.length) return null;
  const rgb = hex2rgb(hex); let best = cands[0], bd = 1e12; cands.forEach(p => { const d = cdist(rgb, hex2rgb(p.color)); if (d < bd) { bd = d; best = p; } }); return best;
}
function renderStepParts() {
  const st = state.steps[state.step]; const box = $('#step-parts'); if (!st) return;
  if (!m3.loaded || m3.url !== state.set.model) { $('#step-parts-pill').textContent = ''; box.innerHTML = '<div class="hint">Loading the 3D model…</div>'; return; }
  const n = st.parts.length; $('#step-parts-pill').textContent = n ? `${n} piece${n === 1 ? '' : 's'}` : 'no new pieces';
  if (!n) { box.innerHTML = '<div class="hint">No new pieces in this step: turn the model or attach the sub-assembly you just built, as shown in the booklet.</div>'; return; }
  const grouped = {}; st.parts.forEach(p => { const k = p.file + '|' + p.color; (grouped[k] = grouped[k] || { ...p, q: 0 }).q++; });
  box.innerHTML = Object.values(grouped).map((g, i) => {
    const c = m3.colors[g.color] || { name: 'Colour ' + g.color, hex: '#9a9a9a' }; const num = g.file.replace(/\.dat$/, ''); const rbp = rbPart(num, c.hex); const name = (m3.names[g.file] || num).replace(/^[~_=]+/, '');
    const th = partThumb(g.file, g.color);
    return `<div class="part now" style="animation-delay:${i * 40}ms">${th ? `<img class="part-pic" src="${th}" alt="">` : rbp && rbp.img ? `<img class="part-pic" src="${esc(rbp.img)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'sw',style:'background:${c.hex}'}))">` : `<span class="sw" style="background:${c.hex}"></span>`}<div class="pn">${esc(name)}<br><small class="muted">${esc(c.name)} · ${esc(num)}</small></div><div class="pq">×${g.q}</div></div>`;
  }).join('');
}
function renderModelCredit() {
  const el = $('#model-credit'); const s = state.set; if (!s || !s.model || state.mode !== '3d') { el.classList.add('hidden'); return; }
  const c = s.modelCredit; el.classList.remove('hidden');
  el.innerHTML = `3D model: ${c ? `${esc(c.author)} via <a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.source)}</a>` : 'community LDraw model'} · ${m3.steps.length || s.modelSteps || ''} official steps. Orange pieces are the ones added in this step; drag to orbit, scroll to zoom.`;
}
const placeholderSteps = n => Array.from({ length: Math.max(1, n) }, () => ({ parts: [], bag: 0 }));
function setMode(mode, fromNet = false) {
  if (!state.set) return; if (mode === '3d' && !state.set.model) mode = 'pages';
  if (state.mode !== mode) state.pos[state.mode] = state.step;
  state.mode = mode; state.dots = null; stopPlay();
  $$('#mode-switch button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const is3d = mode === '3d';
  $('#page-box').classList.toggle('hidden', is3d); $('#model-canvas').classList.toggle('hidden', !is3d); $('#step-parts-box').classList.toggle('hidden', !is3d);
  hideLoading(); $('#model-loading').classList.add('hidden');
  if (is3d) {
    state.steps = (m3.url === state.set.model && m3.steps.length) ? m3.steps : placeholderSteps(state.set.modelSteps || 1);
    state.step = Math.min(state.pos['3d'], state.steps.length - 1);
    if (m3.loaded && m3.url === state.set.model) { resize3d(); show3dStep(state.step, false); } else loadModel(state.set);
  } else {
    state.steps = state.pageSteps; state.step = Math.min(state.pos.pages, state.steps.length - 1);
    const st = state.steps[state.step]; if (st) { const entry = docs[state.set.booklets[st.b].pdf]; if (entry && entry.doc) renderPage(); else openBooklet(st.b); }
  }
  renderModelCredit(); renderStepUI();
  if (state.room && state.room.isHost && !fromNet) { net.broadcast({ t: 'mode', mode }); if (state.room.mode === 'divided') assignSteps(); }
}

/* =========================== SET REVEAL =========================== */
function countUp(el, to, dur = 900, fmt = v => Math.round(v).toLocaleString()) { if (!el) return; const t0 = performance.now(); const tick = () => { if (!el.isConnected) return; const p = Math.min(1, (performance.now() - t0) / dur); el.textContent = fmt(to * ease(p)); if (p < 1) requestAnimationFrame(tick); }; tick(); }
const ease = p => 1 - Math.pow(1 - p, 3);
function revealSet(set) {
  if (settings.reduce) return;
  const pages = set.booklets.filter(b => !b.extra).reduce((a, b) => a + (b.pages || 0), 0);
  const ov = $('#reveal'); ov.innerHTML = `<div class="rv-box"><img src="${esc(set.img || '')}" alt="" onerror="this.style.display='none'"></div><div class="rv-num">${String(set.num).split('').map((ch, i) => `<span class="digit" style="animation-delay:${i * 90}ms"><i>${ch}</i></span>`).join('')}</div><div class="rv-name">${esc(set.name)}</div><div class="rv-meta"><b id="rv-pieces">0</b> pieces${pages ? ' · <b id="rv-pages">0</b> pages' : ''}</div>`;
  ov.classList.remove('hidden'); ov.classList.remove('out');
  setTimeout(() => { countUp($('#rv-pieces'), set.pieces || 0, 1100); if (pages) countUp($('#rv-pages'), pages, 900); }, 500);
  [0, 90, 180, 270, 360].forEach((d, i) => setTimeout(() => tone(500 + i * 90, .07, 'square', .12), 350 + d));
  clearTimeout(state.revealT); state.revealT = setTimeout(() => { ov.classList.add('out'); setTimeout(() => ov.classList.add('hidden'), 500); }, 2400);
  ov.onclick = () => { ov.classList.add('out'); setTimeout(() => ov.classList.add('hidden'), 400); };
}

/* =========================== ROLES (build / find pieces) =========================== */
// Job rule: with two people, one builds and one finds pieces; with more, any mix, but every job needs at least one person.
const jobName = r => r === 'build' ? 'building' : 'finding pieces';
function roleBlocked(role) {
  if (!state.room || state.room.mode === 'hotseat') return null;
  const others = Object.entries(net.peers).filter(([id]) => id !== net.id); if (!others.length) return null;
  const other = role === 'build' ? 'parts' : 'build';
  if (others.length === 1) { const o = others[0][1]; return o.role === role ? `${o.name} is already ${jobName(role)} — with two of you, one does each job` : null; }
  const allPicked = others.every(([, p]) => p.role); const otherCovered = others.some(([, p]) => p.role === other);
  return allPicked && !otherCovered ? `Someone has to keep ${jobName(other)} — you're the only one` : null;
}
function jobCounts() { const c = { build: 0, parts: 0, none: 0 }; Object.values(net.peers).forEach(p => { c[p.role === 'build' ? 'build' : p.role === 'parts' ? 'parts' : 'none']++; }); return c; }
function setRole(role, silent) {
  const why = silent ? null : roleBlocked(role); if (why) { SFX.error(); toast(esc(why), '🚫'); const other = role === 'build' ? 'parts' : 'build'; if (state.role !== other && !roleBlocked(other)) return setRole(other, true); return; }
  state.role = role; $$('#role-switch button').forEach(b => b.classList.toggle('active', b.dataset.role === role));
  $('#parts-view').classList.toggle('hidden', role !== 'parts'); $('.viewer-wrap').classList.toggle('hidden', role === 'parts'); $('.controls').classList.toggle('hidden', role === 'parts');
  if (role === 'parts') renderPartsView(); else setTimeout(() => { if (!state.set) return; resize3d(); if (state.mode === '3d') show3dStep(state.step, false); else renderPage(); }, 50);
  if (!silent) { toast(role === 'parts' ? 'You are finding pieces' : 'You are building', role === 'parts' ? '🔍' : '🧱'); SFX.whoosh(); }
  if (state.room && net.peers[net.id]) { net.peers[net.id].role = role; net.broadcast({ t: 'role', who: net.id, role }); renderRoom(); }
}
$$('#role-switch button').forEach(b => b.onclick = () => setRole(b.dataset.role));
function askRole() {
  const n = Object.keys(net.peers).length;
  modal(`<h3>Pick your job</h3><p class="muted">${n <= 2 ? 'With two builders, one builds and one finds pieces.' : 'Any mix of jobs, as long as every job has someone.'} You can switch any time from the Build tab.</p><div class="role-grid"><div class="role" data-r="build"><div class="ic">🧱</div><b>Build</b><span>Follow the steps and assemble</span></div><div class="role" data-r="parts"><div class="ic">🔍</div><b>Find pieces</b><span>Sort the bricks and hand them over</span></div></div>`, []);
  $$('#modal .role').forEach(r => { const why = roleBlocked(r.dataset.r); if (why) { r.classList.add('taken'); r.querySelector('span').textContent = why; } r.onclick = () => { if (why) { SFX.error(); toast(esc(why), '🚫'); return; } closeModal(); setRole(r.dataset.r); }; });
}
function renderPartsView() {
  if (!state.set) return; const s = state.set; $('#pv-name').textContent = s.name;
  const grid = $('#pv-grid'), msg = $('#pv-msg');
  $('#pv-ahead').classList.toggle('hidden', !(state.mode === '3d' && m3.loaded && m3.url === s.model));
  if (state.mode === '3d' && m3.loaded && m3.url === s.model) { renderStepPieces(grid, msg); return; }
  $('#pv-phase').classList.add('hidden'); $('#pv-intro').textContent = 'Sort the pieces by colour and tap each kind once it\'s in its pile.'; $('#pv-ready').textContent = 'All pieces sorted ✓';
  if (!state.parts) {
    grid.innerHTML = ''; $('#pv-count').textContent = ''; msg.classList.remove('hidden');
    msg.innerHTML = state.partsLoading ? 'Loading the piece list from Rebrickable…' : rbKey() ? 'Couldn\'t load the piece list from Rebrickable for this set. The last pages of the booklet list every piece.' : 'Add a free Rebrickable API key in <a href="#" onclick="document.querySelector(\'[data-tab=settings]\').click();return false">Settings</a> to see every piece in this set here. The last pages of the booklet list them too.';
    return;
  }
  msg.classList.add('hidden');
  const got = state.gotParts[s.num] || (state.gotParts[s.num] = {}); const parts = state.parts; const total = parts.reduce((a, p) => a + p.qty, 0);
  const count = () => { const d = parts.filter(p => got[p.num + '|' + p.color]).length; $('#pv-count').textContent = `${d} / ${parts.length} kinds · ${total.toLocaleString()} pieces`; };
  count();
  grid.innerHTML = parts.map((p, i) => { const k = p.num + '|' + p.color; return `<div class="pv-card ${got[k] ? 'got' : ''}" data-k="${esc(k)}" style="animation-delay:${Math.min(i, 40) * 15}ms"><div class="pic-wrap"><div class="sw" style="background:${esc(p.color)}"></div>${p.img ? `<img class="photo" src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div><div class="q">×${p.qty}</div><div class="n">${esc(p.name)}</div><div class="cn">${esc(p.colorName)}</div></div>`; }).join('');
  $$('.pv-card').forEach(c => c.onclick = () => { got[c.dataset.k] = !got[c.dataset.k]; c.classList.toggle('got', !!got[c.dataset.k]); SFX.snap(); count(); });
}
// Find pieces has two phases per set: 1) sort ALL the pieces (whole inventory, by bag), 2) get & give the pieces for the
// current step plus the next 1-3 steps to the builder(s).
const pvPhases = LS('pvphase', {});
const pvPhase = () => (state.set && pvPhases[state.set.num]) || 'sort';
function setPvPhase(ph) { if (!state.set) return; pvPhases[state.set.num] = ph; try { SAVE('pvphase', pvPhases); } catch { } renderPartsView(); }
$$('#pv-phase .ph').forEach(el => el.onclick = () => setPvPhase(el.dataset.ph));
function fillThumbs(root) { // fill piece pictures a few per frame so long lists never freeze the page
  const imgs = [...root.querySelectorAll('img[data-thumb]')]; let i = 0;
  const tick = () => { const end = Math.min(imgs.length, i + 12); for (; i < end; i++) { const im = imgs[i]; const [f, c] = im.dataset.thumb.split('|'); const u = partThumb(f, +c); if (u) im.src = u; else im.remove(); im.removeAttribute('data-thumb'); } if (i < imgs.length && root.isConnected) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function renderStepPieces(grid, msg) {
  $('#pv-phase').classList.remove('hidden'); $$('#pv-phase .ph').forEach(el => el.classList.toggle('active', el.dataset.ph === pvPhase()));
  if (pvPhase() === 'sort') return renderSortAll(grid, msg);
  $('#pv-ahead').classList.remove('hidden'); $('#pv-intro').textContent = 'Get these pieces and give them to the builder(s). Tap each kind once it\'s handed over; use Look ahead to prepare the next steps.'; $('#pv-ready').textContent = 'Handed over ✓';
  const ahead = settings.pvAhead || 2; const first = state.step, last = Math.min(state.steps.length - 1, state.step + ahead);
  msg.classList.add('hidden'); const got = state.gotParts[state.set.num] || (state.gotParts[state.set.num] = {});
  let html = '', total = 0, done = 0;
  for (let i = first; i <= last; i++) {
    const st = state.steps[i]; const grouped = {}; (st.parts || []).forEach(p => { const k = p.file + '|' + p.color; (grouped[k] = grouped[k] || { ...p, q: 0 }).q++; });
    const items = Object.values(grouped); total += items.length;
    html += `<div class="pv-step"><div class="pv-step-head"><b>Step ${i + 1}</b>${i === first ? '<span class="pill">now</span>' : ''}${st.bag ? `<span class="muted small">bag ${st.bag}</span>` : ''}</div>`;
    if (!items.length) html += '<div class="hint">No new pieces in this step.</div>';
    html += '<div class="pv-grid">' + items.map((g, j) => { const k = 's' + i + '|' + g.file + '|' + g.color; if (got[k]) done++; const c = m3.colors[g.color] || { name: 'Colour ' + g.color, hex: '#9a9a9a' }; const num = g.file.replace(/\.dat$/, ''); const rbp = rbPart(num, c.hex); const name = (m3.names[g.file] || num).replace(/^[~_=]+/, '');
      return `<div class="pv-card ${got[k] ? 'got' : ''}" data-k="${esc(k)}" style="animation-delay:${Math.min(j, 20) * 20}ms"><div class="pic-wrap"><div class="sw" style="background:${c.hex}"></div><img class="photo" data-thumb="${esc(g.file)}|${g.color}" alt=""></div><div class="q">×${g.q}</div><div class="n">${esc(name)}</div><div class="cn">${esc(c.name)} · ${esc(num)}</div></div>`; }).join('') + '</div></div>';
  }
  grid.innerHTML = html; fillThumbs(grid); $('#pv-count').textContent = `${done} / ${total} kinds · steps ${first + 1}–${last + 1}`;
  $$('#pv-grid .pv-card').forEach(c => c.onclick = () => { got[c.dataset.k] = !got[c.dataset.k]; c.classList.toggle('got', !!got[c.dataset.k]); SFX.snap(); const d = $$('#pv-grid .pv-card.got').length; $('#pv-count').textContent = `${d} / ${total} kinds · steps ${first + 1}–${last + 1}`; });
}
function renderSortAll(grid, msg) {
  $('#pv-ahead').classList.add('hidden'); msg.classList.add('hidden');
  $('#pv-intro').textContent = 'Empty the bags and sort ALL the pieces into piles by shape and colour. Tap each kind when its pile is ready, then start handing pieces to the builder(s).';
  $('#pv-ready').textContent = 'All pieces sorted → start handing out';
  const got = state.gotParts[state.set.num] || (state.gotParts[state.set.num] = {}); const kinds = {};
  m3.steps.forEach(st => st.parts.forEach(p => { const k = p.file + '|' + p.color; const e = kinds[k] || (kinds[k] = { ...p, q: 0, bag: st.bag || 0 }); e.q++; }));
  const list = Object.values(kinds); const byBag = {}; list.forEach(e => (byBag[e.bag] = byBag[e.bag] || []).push(e));
  const bags = Object.keys(byBag).map(Number).sort((a, b) => a - b); const total = list.length; let done = 0; let html = '';
  bags.forEach(bag => {
    const items = byBag[bag].sort((a, b) => a.color - b.color || a.file.localeCompare(b.file)); const pieces = items.reduce((a, e) => a + e.q, 0);
    html += `<div class="pv-step"><div class="pv-bag"><b>${bag ? 'Bag ' + bag : 'All pieces'}</b><span class="muted small">${items.length} kinds · ${pieces} pieces</span></div><div class="pv-grid">` + items.map((g, j) => {
      const k = 'all|' + g.file + '|' + g.color; if (got[k]) done++; const c = m3.colors[g.color] || { name: 'Colour ' + g.color, hex: '#9a9a9a' }; const num = g.file.replace(/\.dat$/, ''); const name = (m3.names[g.file] || num).replace(/^[~_=]+/, '');
      return `<div class="pv-card ${got[k] ? 'got' : ''}" data-k="${esc(k)}"><div class="pic-wrap"><div class="sw" style="background:${c.hex}"></div><img class="photo" data-thumb="${esc(g.file)}|${g.color}" alt=""></div><div class="q">×${g.q}</div><div class="n">${esc(name)}</div><div class="cn">${esc(c.name)} · ${esc(num)}</div></div>`; }).join('') + '</div></div>';
  });
  grid.innerHTML = html; fillThumbs(grid);
  const count = () => { const d = $$('#pv-grid .pv-card.got').length; $('#pv-count').textContent = `${d} / ${total} kinds sorted · ${list.reduce((a, e) => a + e.q, 0).toLocaleString()} pieces`; }; count();
  $$('#pv-grid .pv-card').forEach(c => c.onclick = () => { got[c.dataset.k] = !got[c.dataset.k]; c.classList.toggle('got', !!got[c.dataset.k]); SFX.snap(); count(); });
}
$$('#pv-ahead button').forEach(b => b.onclick = () => { settings.pvAhead = +b.dataset.n; saveSettings(); $$('#pv-ahead button').forEach(x => x.classList.toggle('active', x === b)); renderPartsView(); });
$('#pv-ready').onclick = () => { if (state.mode === '3d' && m3.loaded && pvPhase() === 'sort') { const got = state.gotParts[state.set.num] || (state.gotParts[state.set.num] = {}); $$('#pv-grid .pv-card').forEach(c => got[c.dataset.k] = true); setPvPhase('give'); SFX.fanfare(); confetti(40); toast('Sorted! Now hand the pieces to the builder(s), step by step', '🧱'); if (state.room) net.broadcast({ t: 'ready', who: net.id, name: settings.name }); return; }
  if (state.mode === '3d' && m3.loaded) { const got = state.gotParts[state.set.num] || (state.gotParts[state.set.num] = {}); $$('#pv-grid .pv-card').forEach(c => got[c.dataset.k] = true); renderPartsView(); SFX.step(); toast('Pieces sorted for the next steps', '✅'); if (state.room) net.broadcast({ t: 'ready', who: net.id, name: settings.name }); return; } if (!state.parts) { toast('No piece list to tick off', '🔍'); return; } const got = state.gotParts[state.set.num] || (state.gotParts[state.set.num] = {}); state.parts.forEach(p => got[p.num + '|' + p.color] = true); renderPartsView(); SFX.step(); toast('All pieces sorted', '✅'); if (state.room) net.broadcast({ t: 'ready', who: net.id, name: settings.name }); };

/* =========================== COLLECTION =========================== */
function addToCollection(status = 'building') {
  const s = state.set; if (!s) return;
  const existing = collection[s.num];
  collection[s.num] = { num: s.num, name: s.name, img: s.img, pieces: s.pieces, theme: s.theme, year: s.year, status, step: existing?.step || state.step, total: state.steps.length, mode: existing?.mode || state.mode, ms: existing?.ms || 0, added: existing?.added || Date.now() };
  saveCollection(); updateCollectButtons(); toast(status === 'wish' ? 'Added to wishlist' : 'Added to your collection', status === 'wish' ? '♡' : '🧱');
}
function updateCollectButtons() {
  const c = state.set && collection[state.set.num];
  $('#btn-collect').textContent = c && c.status !== 'wish' ? (c.status === 'done' ? '✓ Completed' : '✓ In collection') : '＋ Add to collection';
  $('#btn-wish').textContent = c && c.status === 'wish' ? '♥ Wishlisted' : '♡ Wishlist';
}
$('#btn-collect').onclick = () => { const c = collection[state.set.num]; if (c && c.status !== 'wish') { modal(`<h3>Remove ${esc(state.set.name)}?</h3><p class="muted">Progress will be lost.</p>`, [{ label: 'Remove', cls: 'danger', fn: () => { delete collection[state.set.num]; saveCollection(); updateCollectButtons(); toast('Removed'); } }, { label: 'Cancel' }]); } else addToCollection('building'); };
$('#btn-wish').onclick = () => { const c = collection[state.set.num]; if (c && c.status === 'wish') { delete collection[state.set.num]; saveCollection(); updateCollectButtons(); toast('Removed from wishlist'); } else addToCollection('wish'); };
let collFilter = 'all';
$$('#coll-filter button').forEach(b => b.onclick = () => { $$('#coll-filter button').forEach(x => x.classList.remove('active')); b.classList.add('active'); collFilter = b.dataset.f; renderCollection(); });
function renderCollection() {
  const items = Object.values(collection).sort((a, b) => b.added - a.added).filter(c => collFilter === 'all' || c.status === collFilter);
  const owned = Object.values(collection).filter(c => c.status !== 'wish');
  countUp($('#stat-sets'), owned.length, 600); countUp($('#stat-pieces'), owned.reduce((s, c) => s + (c.pieces || 0), 0), 900);
  countUp($('#stat-built'), owned.filter(c => c.status === 'done').length, 600);
  const h = owned.reduce((s, c) => s + (c.ms || 0), 0) / 3600000; $('#stat-hours').textContent = h < 1 ? Math.round(h * 60) + 'm' : h.toFixed(1) + 'h';
  $('#collection-empty').classList.toggle('hidden', items.length > 0);
  $('#collection').innerHTML = items.map((c, i) => { const pct = c.status === 'done' ? 100 : c.total ? Math.round((c.step + 1) / c.total * 100) : 0;
    return `<div class="set-card" data-num="${esc(c.num)}" style="animation-delay:${i * 40}ms"><span class="status ${c.status}">${c.status === 'done' ? 'BUILT' : c.status === 'wish' ? 'WISHLIST' : pct + '%'}</span><button class="rm" data-rm="${esc(c.num)}" title="Remove">✕</button><img src="${esc(c.img || '')}" onerror="this.style.opacity=.2" alt=""><div class="body"><div class="num">${esc(c.num)} · ${esc(c.theme || 'LEGO')}</div><div class="name">${esc(c.name)}</div><div class="bar"><i style="width:${pct}%"></i></div></div></div>`; }).join('');
  $$('.set-card').forEach(card => card.onclick = e => { if (e.target.dataset.rm) { delete collection[e.target.dataset.rm]; saveCollection(); toast('Removed'); return; } loadSet(card.dataset.num); });
}

/* =========================== HOME: FEATURED SET + 3D HERO =========================== */
function initFeatured() {
  const f = window.BUILTIN_SETS && window.BUILTIN_SETS[window.FEATURED_SET]; const box = $('#featured');
  if (!f) { box.classList.add('hidden'); return; }
  const pages = f.booklets.filter(b => !b.extra).reduce((a, b) => a + (b.pages || 0), 0);
  $('#feat-img').src = f.img; $('#feat-name').textContent = `${f.num} · ${f.name}`;
  $('#feat-sub').textContent = [f.theme, f.year, f.pieces.toLocaleString() + ' pieces', f.age ? 'Ages ' + f.age : '', pages ? pages + ' pages of official instructions' : ''].filter(Boolean).join(' · ');
  $('#btn-featured').textContent = `Build ${f.num} →`; $('#feat-lego').href = legoPage(f.num);
  $('#btn-featured').onclick = () => loadSet(f.num);
}
const STUD = 1, PLATE = 0.4;
let hero = null; const brickGeoCache = {}, edgeCache = {}, matCache = {}; let _outlineMat = null;
function mergeGeos(geos) { let pos = [], nor = []; geos.forEach(g => { const ng = g.toNonIndexed(); pos.push(...ng.attributes.position.array); nor.push(...ng.attributes.normal.array); }); const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return out; }
function brickGeometry(w, d, h) {
  const k = `${w}_${d}_${h}`; if (brickGeoCache[k]) return brickGeoCache[k];
  const H = h * PLATE, g = []; const body = new THREE.BoxGeometry(w - .12, H - .03, d - .12); body.translate(0, H / 2, 0); g.push(body);
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) { const s = new THREE.CylinderGeometry(.24, .24, .17, 16); s.translate(i - w / 2 + .5, H + .085, j - d / 2 + .5); g.push(s); }
  return brickGeoCache[k] = mergeGeos(g);
}
function edgeGeo(w, d, h) { const k = `${w}_${d}_${h}`; if (edgeCache[k]) return edgeCache[k]; const H = h * PLATE - .03; const g = new THREE.BoxGeometry(w - .12, H, d - .12); g.translate(0, H / 2, 0); return edgeCache[k] = new THREE.EdgesGeometry(g, 30); }
function outlineMat() { if (!_outlineMat) _outlineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: .28 }); return _outlineMat; }
function brickMaterial(color) { if (matCache[color]) return matCache[color]; return matCache[color] = new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: 0 }); }
function brickMesh(b) { const m = new THREE.Mesh(brickGeometry(b.w, b.d, b.h), brickMaterial(b.c)); m.castShadow = m.receiveShadow = true; const line = new THREE.LineSegments(edgeGeo(b.w, b.d, b.h), outlineMat()); line.renderOrder = 1; m.add(line); return m; }
function makeViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(40, 1, .1, 2000); camera.position.set(30, 28, 30);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.6); dir.position.set(40, 60, 30); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048); dir.shadow.camera.left = dir.shadow.camera.bottom = -60; dir.shadow.camera.right = dir.shadow.camera.top = 60; scene.add(dir);
  const group = new THREE.Group(); scene.add(group);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .18 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const v = { renderer, scene, camera, group, anims: [] }; const clock = new THREE.Clock();
  (function loop() { const dt = clock.getDelta(); v.anims = v.anims.filter(a => { a.t += dt * a.speed; const p = Math.min(1, a.t / a.dur); a.fn(ease(p), p); return p < 1; }); group.rotation.y += dt * .35; renderer.render(scene, camera); requestAnimationFrame(loop); })();
  return v;
}
function resizeHero() { if (!hero) return; const c = hero.renderer.domElement; const w = c.clientWidth || c.parentElement.clientWidth, h = c.clientHeight || c.parentElement.clientHeight; if (!w || !h) return; hero.renderer.setSize(w, h, false); hero.camera.aspect = w / h; hero.camera.updateProjectionMatrix(); }
async function initHero() {
  THREE = await import('three');
  hero = makeViewer($('#hero-canvas'));
  const cols = ['#e3000b', '#0055bf', '#ffd500', '#237841', '#fe8a18', '#ffffff'];
  const layout = [[0,0,0,4,2],[4,0,0,2,2],[0,2,0,2,2],[2,2,0,4,2],[1,0,1,2,4],[3,0,1,2,2],[3,2,1,2,2],[0,0,2,4,2],[4,1,2,2,2],[0,2,2,2,2],[1,1,3,4,2],[1,3,3,2,1],[2,0,4,2,4],[0,1,4,2,2],[1,1,5,4,2],[2,1,6,2,2],[2,1,7,1,2],[3,1,7,1,1]];
  const bricks = layout.map(([x, z, l, w, d], i) => ({ x, z, y: l * 3, w, d, h: 3, c: cols[i % cols.length] }));
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; bricks.forEach(b => { minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w); minZ = Math.min(minZ, b.z); maxZ = Math.max(maxZ, b.z + b.d); });
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  bricks.forEach((b, i) => { const m = brickMesh(b); const target = new THREE.Vector3(b.x + b.w / 2 - cx, b.y * PLATE, b.z + b.d / 2 - cz); m.position.copy(target).add(new THREE.Vector3(0, 30, 0)); hero.group.add(m); hero.anims.push({ t: -i * .07 - .8, dur: .7, speed: 1, fn: (e, p) => { if (p < 0) return; m.position.y = target.y + 30 * (1 - e); } }); });
  hero.camera.position.set(13, 11, 13); hero.camera.lookAt(0, 4.5, 0);
  (function bob() { hero.group.position.y = Math.sin(performance.now() / 900) * .3; requestAnimationFrame(bob); })();
  resizeHero();
}

/* =========================== NETWORK (PeerJS) =========================== */
const net = {
  peer: null, conns: {}, id: null, hostId: null, peers: {}, // id -> {name, avatar, progress, finished, role}
  code() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join(''); },
  prefix: 'bricksahoy-',
  async host(mode, max) {
    const code = this.code(); await this.init(this.prefix + code);
    state.room = { code, mode, max, isHost: true }; this.hostId = this.id;
    this.peers = { [this.id]: { name: settings.name, avatar: settings.avatar, progress: 0, isHost: true } };
    this.peer.on('connection', c => this.onConn(c));
    this.onRoomChange(); SFX.join(); toast(`Room ${code} created`, '🏠');
  },
  async join(code) {
    code = code.toUpperCase().trim(); await this.init();
    const c = this.peer.connect(this.prefix + code, { reliable: true, metadata: { name: settings.name, avatar: settings.avatar } });
    const timeout = setTimeout(() => { if (!state.room) { SFX.error(); toast('Room not found or host offline', '⚠️'); } }, 8000);
    c.on('open', () => { clearTimeout(timeout); this.hostId = c.peer; this.conns[c.peer] = c; c.send({ t: 'hello', name: settings.name, avatar: settings.avatar, key: settings.rbKey || null }); });
    c.on('data', d => this.onData(c, d)); c.on('close', () => this.onLeave(c.peer));
    c.on('error', () => { clearTimeout(timeout); SFX.error(); toast('Connection failed'); });
  },
  init(id) { return new Promise((res, rej) => { if (this.peer) this.peer.destroy(); const cfg = { debug: 1, config: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }, { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }] } }; this.peer = id ? new Peer(id, cfg) : new Peer(cfg); this.peer.on('open', pid => { this.id = pid; res(); }); this.peer.on('error', e => { if (e.type === 'unavailable-id') { toast('Code collision, retry'); } else if (e.type === 'peer-unavailable') { SFX.error(); toast('Room not found', '⚠️'); } else console.warn(e); rej(e); }); }); },
  onConn(c) {
    c.on('open', () => { if (Object.keys(this.peers).length >= state.room.max) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; } this.conns[c.peer] = c; });
    c.on('data', d => this.onData(c, d)); c.on('close', () => this.onLeave(c.peer));
  },
  onData(c, d) {
    switch (d.t) {
      case 'hello': // host receives
        if (Object.keys(this.peers).length >= state.room.max) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; }
        this.peers[c.peer] = { name: d.name, avatar: d.avatar, progress: 0 }; SFX.join(); toast(`${esc(d.name)} joined`, '👋');
        if (d.key && !rbKey()) { state.sharedKey = d.key; toast(`${esc(d.name)} shared their Rebrickable key with the room (not saved)`, '🔑'); this.broadcast({ t: 'key', key: d.key, from: d.name }); }
        c.send({ t: 'welcome', room: state.room, peers: this.peers, set: state.set?.num, pages: pageCounts(), mode: state.mode, step: state.step, hostId: this.id, key: rbKey() || null });
        this.broadcast({ t: 'peers', peers: this.peers }); this.onRoomChange(); if (state.room.mode === 'divided') assignSteps(); break;
      case 'welcome': if (d.key && !settings.rbKey) { state.sharedKey = d.key; toast('Using the room\'s shared Rebrickable key (not saved on this device)', '🔑'); } state.room = { ...d.room, isHost: false }; this.peers = d.peers; this.hostId = d.hostId; this.onRoomChange(); SFX.join(); toast(`Joined room ${d.room.code}`, '🎉'); if (d.set) loadSet(d.set, { pages: d.pages, mode: d.mode }).then(() => { if (d.room.mode === 'together') showStep(d.step, false, true); }); showTab('collab'); break;
      case 'peers': this.peers = d.peers; this.onRoomChange(); break;
      case 'full': SFX.error(); toast('Room is full', '🚫'); break;
      case 'set': if (!state.room.isHost) loadSet(d.num, { pages: d.pages, mode: d.mode }); break;
      case 'pages': if (state.set && Array.isArray(d.pages)) { let changed = false; d.pages.forEach((p, i) => { const b = state.set.booklets[i]; if (b && p && !b.pages) { b.pages = p; changed = true; } }); if (changed) { rebuildSteps(); renderStepUI(); renderBooklets(); } } if (state.room.isHost) this.relay(c.peer, d); break;
      case 'step':
        if (this.peers[d.who]) this.peers[d.who].progress = d.progress;
        if (state.room.mode === 'together' && d.who !== this.id) { if (d.mode && d.mode !== state.mode && state.set && (d.mode === 'pages' || state.set.model)) setMode(d.mode, true); showStep(d.idx, true, true); }
        if (state.room.isHost) this.relay(c.peer, d); this.onRoomChange(); break;
      case 'mode': if (state.set && d.mode && d.mode !== state.mode && (d.mode === 'pages' || state.set.model)) setMode(d.mode, true); if (state.room.isHost) this.relay(c.peer, d); break;
      case 'assign': state.mySteps = d.map[this.id] || null; state.assignMap = d.map; renderStepUI(); toast(`You have ${state.mySteps ? state.mySteps.length : 0} pages`, '🧩'); break;
      case 'finish': if (this.peers[d.who]) { this.peers[d.who].finished = Date.now(); this.peers[d.who].progress = 1; } if (state.room.mode === 'race' && d.who !== this.id) toast(`${esc(d.name)} finished! 🏁`); if (state.room.isHost) this.relay(c.peer, d); this.onRoomChange(); break;
      case 'role': if (this.peers[d.who]) this.peers[d.who].role = d.role; if (state.room.isHost) this.relay(c.peer, d); this.onRoomChange(); break;
      case 'ready': if (d.who !== this.id) { toast(`${esc(d.name)} has the pieces sorted`, '✅'); SFX.join(); } if (state.room.isHost) this.relay(c.peer, d); break;
      case 'key': if (!settings.rbKey) { state.sharedKey = d.key; toast(`${esc(d.from)} shared a Rebrickable key with the room (not saved)`, '🔑'); } break;
      case 'chat': toast(`${esc(d.name)}: ${esc(d.msg)}`, '💬'); if (state.room.isHost) this.relay(c.peer, d); break;
    }
  },
  relay(from, d) { Object.entries(this.conns).forEach(([id, c]) => id !== from && c.open && c.send(d)); },
  broadcast(d) { Object.values(this.conns).forEach(c => c.open && c.send(d)); if (d.t === 'step' && this.peers[this.id]) { this.peers[this.id].progress = d.progress; renderRoom(); } },
  onLeave(id) { const p = this.peers[id]; delete this.conns[id]; delete this.peers[id]; if (id === this.hostId && state.room && !state.room.isHost) { toast('Host left the room', '👋'); this.leave(false); return; } if (p) toast(`${esc(p.name)} left`); if (state.room?.isHost) { this.broadcast({ t: 'peers', peers: this.peers }); if (state.room.mode === 'divided') assignSteps(); } this.onRoomChange(); },
  leave(notify = true) { if (this.peer) this.peer.destroy(); this.peer = null; this.conns = {}; this.peers = {}; state.room = null; state.mySteps = null; state.assignMap = null; state.sharedKey = null; this.onRoomChange(); if (notify) toast('Left room'); if (state.set) renderStepUI(); },
  onRoomChange() { renderRoom(); if (!state.room) { state.roleAsked = false; setRole('build', true); $('#role-switch').classList.add('hidden'); } }
};
window.net = net;
function assignSteps() { // divided mode: contiguous page ranges per builder
  if (!state.set || !state.room?.isHost) return;
  const ids = Object.keys(net.peers); const map = {}; ids.forEach(id => map[id] = []); const total = state.steps.length;
  for (let i = 0; i < total; i++) map[ids[Math.min(ids.length - 1, Math.floor(i * ids.length / total))]].push(i);
  state.assignMap = map; state.mySteps = map[net.id]; renderStepUI(); net.broadcast({ t: 'assign', map });
}

/* --- hot-seat (same device) --- */
const hot = { players: [], turn: 0 };
function renderRoom() {
  const r = state.room; $('#room-card').classList.toggle('hidden', !r); $('#room-badge').classList.toggle('hidden', !r);
  if (!r) return;
  $('#role-switch').classList.toggle('hidden', r.mode === 'hotseat' || !state.set);
  if (state.set && r.mode !== 'hotseat' && !state.roleAsked) { state.roleAsked = true; setTimeout(askRole, 400); }
  $('#room-badge').textContent = r.mode === 'hotseat' ? '👥 Same device' : '👥 ' + r.code;
  $('#room-code').textContent = r.mode === 'hotseat' ? 'LOCAL' : r.code;
  $('#room-mode-label').textContent = { together: 'Together — everyone sees the same page in sync.', divided: 'Divided — pages split across builders.', race: 'Race — first to the last page wins.', hotseat: 'Same device — take turns.' }[r.mode];
  $('#hotseat-add').classList.toggle('hidden', r.mode !== 'hotseat');
  const list = $('#peer-list'); list.innerHTML = '';
  if (r.mode === 'hotseat') {
    hot.players.forEach((p, i) => { const el = document.createElement('div'); el.className = 'peer' + (i === hot.turn ? ' turn' : ''); el.innerHTML = `<div class="av" style="background:${p.avatar}">${esc(p.name[0].toUpperCase())}</div><span>${esc(p.name)}</span>${i === hot.turn ? '<span class="host">YOUR TURN</span>' : ''}`; el.onclick = () => { hot.turn = i; renderRoom(); }; list.appendChild(el); });
    $('#peer-count').textContent = hot.players.length + '/' + r.max;
  } else {
    Object.entries(net.peers).forEach(([id, p]) => { const el = document.createElement('div'); el.className = 'peer'; el.innerHTML = `<div class="av" style="background:${esc(p.avatar)}">${esc((p.name || '?')[0].toUpperCase())}</div><span>${esc(p.name)}${id === net.id ? ' (you)' : ''}</span>${p.isHost ? '<span class="host">HOST</span>' : ''}${p.role === 'parts' ? '🔍' : p.role === 'build' ? '🧱' : ''}<span class="prog">${Math.round((p.progress || 0) * 100)}%</span>`; list.appendChild(el); });
    $('#peer-count').textContent = Object.keys(net.peers).length + '/' + r.max;
    const jc = jobCounts(); const total = Object.keys(net.peers).length; const jobs = $('#job-hint');
    if (jobs) { if (total < 2) jobs.classList.add('hidden'); else { jobs.classList.remove('hidden'); const missing = jc.none === 0 && (jc.build === 0 || jc.parts === 0); jobs.innerHTML = `Jobs: <b>${jc.build}</b> building · <b>${jc.parts}</b> finding pieces${jc.none ? ` · ${jc.none} not picked yet` : ''}${missing ? ` — <span class="warn-inline">someone should switch to ${jc.build === 0 ? 'Build' : 'Find pieces'}</span>` : ''}. ${total === 2 ? 'With two of you, one does each job.' : 'Every job needs at least one person.'}`; } }
  }
  const race = $('#race-board'); race.classList.toggle('hidden', r.mode !== 'race');
  if (r.mode === 'race') { $('#race-list').innerHTML = Object.values(net.peers).sort((a, b) => (b.progress || 0) - (a.progress || 0)).map((p, i) => `<div class="race-row"><b>${i + 1}.</b><div class="av peer" style="background:${esc(p.avatar)};padding:0;width:26px;height:26px;justify-content:center">${esc(p.name[0])}</div><span style="min-width:100px">${esc(p.name)}</span><div class="bar"><i style="width:${(p.progress || 0) * 100}%;background:${esc(p.avatar)}"></i></div>${p.finished ? '🏁' : ''}</div>`).join(''); }
}
$('#max-builders').oninput = e => $('#max-label').textContent = e.target.value;
$('#btn-host').onclick = async () => {
  const mode = $('input[name=mode]:checked').value, max = +$('#max-builders').value;
  if (mode === 'hotseat') { state.room = { code: 'LOCAL', mode, max, isHost: true }; hot.players = [{ name: settings.name, avatar: settings.avatar }]; hot.turn = 0; renderRoom(); toast('Same-device room ready — add builders', '👥'); return; }
  $('#btn-host').disabled = true; $('#btn-host').textContent = 'Creating…';
  try { await net.host(mode, max); } catch (e) { toast('Could not reach PeerJS server', '⚠️'); }
  $('#btn-host').disabled = false; $('#btn-host').textContent = 'Create room';
};
$('#btn-join').onclick = async () => { const code = $('#join-code').value.trim(); if (code.length !== 6) { SFX.error(); toast('Code is 6 characters'); return; } $('#btn-join').disabled = true; try { await net.join(code); } catch { } $('#btn-join').disabled = false; };
$('#btn-leave').onclick = () => { if (state.room?.mode === 'hotseat') { state.room = null; renderRoom(); return; } net.leave(); };
$('#btn-copy-code').onclick = () => { navigator.clipboard?.writeText(state.room.code); toast('Code copied', '📋'); };
$('#btn-goto-build').onclick = () => showTab(state.set ? 'build' : 'home');
$('#btn-hotseat-add').onclick = () => { const n = $('#hotseat-name').value.trim(); if (!n) return; if (hot.players.length >= state.room.max) { toast('Room full'); return; } hot.players.push({ name: n, avatar: AVATARS[hot.players.length % AVATARS.length] }); $('#hotseat-name').value = ''; SFX.join(); renderRoom(); };
$('#btn-share-room').onclick = () => { showTab('collab'); if (!state.room) toast('Create a room, then share the code', '👥'); };
// hotseat: rotate turn after each "Done"
const _origDone = $('#btn-done-step').onclick;
$('#btn-done-step').onclick = () => { _origDone(); if (state.room?.mode === 'hotseat' && hot.players.length > 1) { hot.turn = (hot.turn + 1) % hot.players.length; renderRoom(); toast(`${esc(hot.players[hot.turn].name)}'s turn`, '🔄'); } };

/* =========================== SETTINGS UI =========================== */
function initSettings() {
  $('#s-name').value = settings.name; $('#s-name').onchange = e => { settings.name = e.target.value.trim() || settings.name; saveSettings(); toast('Name saved'); };
  const sw = (container, colors, key) => { container.innerHTML = ''; colors.forEach(c => { const d = document.createElement('div'); d.className = 'swatch' + (settings[key] === c ? ' active' : ''); d.style.background = c; d.onclick = () => { settings[key] = c; saveSettings(); applyTheme(); sw(container, colors, key); }; container.appendChild(d); }); };
  sw($('#avatar-swatches'), AVATARS, 'avatar'); sw($('#accent-swatches'), ACCENTS, 'accent');
  $$('#theme-seg button').forEach(b => b.onclick = () => { settings.theme = b.dataset.v; saveSettings(); applyTheme(); });
  const bind = (id, key, after) => { const el = $(id); if (el.type === 'checkbox') { el.checked = settings[key]; el.onchange = () => { settings[key] = el.checked; saveSettings(); after && after(); }; } else { el.value = settings[key]; el.oninput = () => { settings[key] = +el.value; saveSettings(); after && after(); }; } };
  bind('#s-reduce', 'reduce', applyTheme);
  bind('#s-sound', 'sound', () => $('#sound-toggle').textContent = settings.sound ? '🔊' : '🔇'); bind('#s-volume', 'volume', () => $('#vol-label').textContent = settings.volume + '%'); $('#vol-label').textContent = settings.volume + '%';
  bind('#s-autosecs', 'autoSecs', syncAutoLabels); syncAutoLabels();
  bind('#s-autoadv', 'autoAdv');
  $('#btn-test-sound').onclick = () => SFX.fanfare();
  $('#sound-toggle').textContent = settings.sound ? '🔊' : '🔇';
  $('#sound-toggle').onclick = () => { settings.sound = !settings.sound; saveSettings(); $('#s-sound').checked = settings.sound; $('#sound-toggle').textContent = settings.sound ? '🔊' : '🔇'; if (settings.sound) SFX.click(); };
  const keyStatus = () => {
    $('#rb-status').textContent = settings.rbKey ? `Key saved (…${settings.rbKey.slice(-4)}) — the "Find pieces" helper can list every piece.` : 'No key — the "Find pieces" helper won\'t show a piece list. Instructions work without it.';
    $('#proxy-status').textContent = settings.proxy ? `Proxy set: ${settings.proxy} — used when LEGO.com can't be reached directly.` : 'Only needed when the site is hosted on another domain — see README for the 2-minute Cloudflare Worker.';
  };
  keyStatus();
  $('#btn-save-rb').onclick = async () => { const k = $('#s-rb-key').value.trim(); if (!k) { settings.rbKey = ''; saveSettings(); keyStatus(); toast('Key cleared'); return; } const r = await fetch(RB + 'colors/?page_size=1&key=' + k).catch(() => null); if (r && r.ok) { settings.rbKey = k; saveSettings(); $('#s-rb-key').value = ''; keyStatus(); toast('Rebrickable key verified', '✅'); } else { SFX.error(); toast('Key rejected by Rebrickable', '⚠️'); } };
  $('#s-proxy').value = settings.proxy || '';
  $('#btn-save-proxy').onclick = () => { const v = $('#s-proxy').value.trim().replace(/\/+$/, ''); if (v && !/^https?:\/\/[^\s]+$/.test(v)) { SFX.error(); toast('Enter the full worker URL, e.g. https://name.workers.dev', '⚠️'); return; } settings.proxy = v; saveSettings(); keyStatus(); toast(v ? 'Proxy saved' : 'Proxy cleared'); };
  $('#btn-clear-cache').onclick = async () => { ['bah_lego', 'bah_parts', 'bah_cache'].forEach(k => localStorage.removeItem(k)); Object.keys(legoCache).forEach(k => delete legoCache[k]); Object.keys(partsCache).forEach(k => delete partsCache[k]); try { if (window.caches) await caches.delete('bah-booklets'); } catch { } Object.values(docs).forEach(e => { e.cached = false; }); if (state.set) renderBooklets(); toast('Cached sets and booklets cleared'); };
  $('#btn-reset').onclick = () => modal('<h3>Reset everything?</h3><p class="muted">Collection, settings, keys and saved booklets will be erased.</p>', [{ label: 'Reset', cls: 'danger', fn: async () => { Object.keys(localStorage).filter(k => k.startsWith('bah_')).forEach(k => localStorage.removeItem(k)); try { if (window.caches) await caches.delete('bah-booklets'); } catch { } location.reload(); } }, { label: 'Cancel' }]);
}

/* =========================== SEARCH / BOOT =========================== */
$('#search-form').onsubmit = e => { e.preventDefault(); loadSet($('#search-input').value); };
$$('.chip').forEach(c => c.onclick = () => loadSet(c.dataset.set));
window.loadSet = loadSet; window.showStep = showStep; window.setMode = setMode; window.m3 = m3; window.buildModel = buildModel; window.setRole = setRole; window.partThumb = partThumb;

initSettings(); applyTheme(); renderCollection(); initFeatured();
initHero().catch(e => { console.warn('3D hero unavailable (no WebGL or CDN blocked) — hiding it', e); $('.hero-3d').classList.add('hidden'); });
const initialTab = location.hash.replace('#', ''); if (['home', 'build', 'collab', 'settings'].includes(initialTab)) showTab(initialTab);
setTimeout(() => { $('#splash').classList.add('out'); resizeHero(); }, 1400);
// Pre-build the featured set's 3D model in the background so opening it is instant.
setTimeout(() => { const f = window.BUILTIN_SETS && window.BUILTIN_SETS[window.FEATURED_SET]; if (f && f.model && !state.set) buildModel(f).catch(e => console.warn('3D preload skipped', e)); }, 1800);
})().catch(e => { console.error(e); const p = document.querySelector('#splash p'); if (p) p.innerHTML = 'Failed to start: ' + e.message; document.querySelector('#splash').classList.remove('out'); });
