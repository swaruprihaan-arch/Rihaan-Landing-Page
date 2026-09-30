/* Rihaan projects page: drop website files, keep them in the browser, show them
   as a gallery with live previews. Optional passcode lock encrypts what is
   stored. No dependencies, runs from file://. */
(function () {
  'use strict';

  const DB_NAME = 'rihaan-projects';
  const DB_STORE = 'projects';
  const LOCAL_KEY = 'rihaan-projects';
  const TITLE_KEY = 'rihaan-landing-title';
  const LOCK_KEY = 'rihaan-projects-lock';
  const SESSION_KEY = 'rihaan-projects-key';
  const LOCK_VERIFIER = 'rihaan-lock-ok';
  const PBKDF2_ITERATIONS = 200000;
  const MIN_PASSCODE = 4;
  const MAX_ASSET_BYTES = 8 * 1024 * 1024;
  const MAX_PROJECT_BYTES = 25 * 1024 * 1024;
  const MAX_FOLDER_FILES = 4000;
  const PREVIEW_WIDTH = 1280;
  const DEFAULT_DOC_TITLE = 'Projects | Rihaan';
  const SKIP_NAMES = ['.git', '.svn', '.hg', 'node_modules', '.DS_Store', 'Thumbs.db', 'desktop.ini'];

  const els = {
    main: document.getElementById('main'),
    heading: document.getElementById('landing-heading'),
    titleInput: document.getElementById('landing-title'),
    zone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    chooseFiles: document.getElementById('choose-files'),
    status: document.getElementById('projects-status'),
    count: document.getElementById('projects-count'),
    galleryHead: document.getElementById('projects-head'),
    grid: document.getElementById('projects-grid'),
    empty: document.getElementById('projects-empty'),
    privacy: document.getElementById('privacy'),
    lockActions: document.getElementById('lock-actions'),
    lockWarning: document.getElementById('lock-warning'),
    lockUnavailable: document.getElementById('lock-unavailable'),
    lockForm: document.getElementById('lock-form'),
    lockPasscode: document.getElementById('lock-passcode'),
    lockConfirm: document.getElementById('lock-confirm'),
    lockSave: document.getElementById('lock-save'),
    lockCancel: document.getElementById('lock-cancel'),
    lockError: document.getElementById('lock-error'),
    lockScreen: document.getElementById('lock-screen'),
    unlockForm: document.getElementById('unlock-form'),
    unlockPasscode: document.getElementById('unlock-passcode'),
    unlockSubmit: document.getElementById('unlock-submit'),
    unlockError: document.getElementById('unlock-error')
  };
  if (!els.zone || !els.grid || !els.fileInput) return;

  let storage = null;
  let projects = [];
  let idCounter = 0;
  let busy = false;      /* an import is running */
  let lockBusy = false;  /* the lock is being set, removed or opened */

  /* ======================================================================
     Small helpers
     ====================================================================== */
  class ImportError extends Error {
    constructor(message) { super(message); this.name = 'ImportError'; }
  }

  function setStatus(message, tone) {
    if (!els.status) return;
    els.status.textContent = message || '';
    if (tone) els.status.setAttribute('data-tone', tone);
    else els.status.removeAttribute('data-tone');
  }

  function errorMessage(err) {
    if (!err) return 'Something went wrong.';
    if (err instanceof ImportError) return err.message;
    const name = err.name || '';
    if (name === 'QuotaExceededError' || err.code === 22) return 'this browser has run out of storage space. Remove a website to make room.';
    return err.message || String(err);
  }

  function makeId() {
    idCounter += 1;
    return Date.now().toString(36) + '-' + idCounter.toString(36);
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    const kb = n / 1024;
    if (kb < 1024) return trimNumber(kb) + ' KB';
    return trimNumber(kb / 1024) + ' MB';
  }
  function trimNumber(value) {
    const fixed = value < 10 ? value.toFixed(1) : value.toFixed(0);
    return fixed.replace(/\.0$/, '');
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function byteLength(str) {
    return new Blob([str]).size;
  }

  function dirname(path) {
    const i = path.lastIndexOf('/');
    return i === -1 ? '' : path.slice(0, i);
  }
  function baseName(path) {
    return path.slice(path.lastIndexOf('/') + 1);
  }
  function extensionOf(name) {
    const base = baseName(name).toLowerCase();
    const i = base.lastIndexOf('.');
    return i === -1 ? '' : base.slice(i + 1);
  }
  function stripExtension(name) {
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(0, i) : name;
  }
  function isHtmlName(name) {
    const ext = extensionOf(name);
    return ext === 'html' || ext === 'htm';
  }
  function isSkippedName(name) {
    return SKIP_NAMES.indexOf(name) !== -1;
  }
  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  function readText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Could not read ' + file.name));
      reader.readAsText(file);
    });
  }

  function readDataUrl(file, mime) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || '');
        resolve(url.replace(/^data:[^;,]*/, 'data:' + mime));
      };
      reader.onerror = () => reject(reader.error || new Error('Could not read ' + file.name));
      reader.readAsDataURL(file);
    });
  }

  const MIME_BY_EXT = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon', bmp: 'image/bmp',
    css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
    mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
    vtt: 'text/vtt', txt: 'text/plain', html: 'text/html', htm: 'text/html', pdf: 'application/pdf', wasm: 'application/wasm'
  };
  function mimeFor(path, declared) {
    if (declared && declared !== 'application/octet-stream') return declared;
    return MIME_BY_EXT[extensionOf(path)] || 'application/octet-stream';
  }

  function titleOf(doc) {
    const el = doc.querySelector('title');
    const text = el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    return text.slice(0, 120);
  }

  /* ======================================================================
     Storage: IndexedDB, with a localStorage fallback
     ====================================================================== */
  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(label + ' timed out')), ms);
      promise.then((value) => { clearTimeout(timer); resolve(value); }, (err) => { clearTimeout(timer); reject(err); });
    });
  }

  function openIndexedDb() {
    return new Promise((resolve, reject) => {
      let request;
      try { request = window.indexedDB.open(DB_NAME, 1); }
      catch (err) { reject(err); return; }
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('IndexedDB could not open')); };
      request.onblocked = function () { reject(new Error('IndexedDB is blocked')); };
    });
  }

  function createIdbStorage(db) {
    db.onversionchange = function () { db.close(); };
    /* Resolves on the transaction's complete event, not on the request's
       success, so a caller that awaits a write knows it has been committed. */
    function run(mode, fn) {
      return new Promise((resolve, reject) => {
        let tx;
        let request;
        let result;
        try {
          tx = db.transaction(DB_STORE, mode);
          request = fn(tx.objectStore(DB_STORE));
        } catch (err) { reject(err); return; }
        request.onsuccess = function () { result = request.result; };
        request.onerror = function () { reject(request.error || new Error('Storage request failed')); };
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error || new Error('Storage transaction failed')); };
        tx.onabort = function () { reject(tx.error || new Error('Storage transaction aborted')); };
      });
    }
    return {
      mode: 'indexeddb',
      getAll: () => run('readonly', (store) => store.getAll()),
      put: (record) => run('readwrite', (store) => store.put(record)),
      remove: (id) => run('readwrite', (store) => store.delete(id))
    };
  }

  function localStorageWorks() {
    try {
      const probe = '__rihaan_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) { return false; }
  }

  function createLocalStorage() {
    const usable = localStorageWorks();
    let memory = [];
    function read() {
      if (!usable) return memory.slice();
      try {
        const raw = window.localStorage.getItem(LOCAL_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
      } catch (err) { return []; }
    }
    function write(list) {
      if (!usable) { memory = list; return; }
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    }
    return {
      mode: usable ? 'local' : 'memory',
      getAll: () => Promise.resolve(read()),
      put: (record) => new Promise((resolve, reject) => {
        try {
          const list = read().filter((r) => r.id !== record.id);
          list.push(record);
          write(list);
          resolve();
        } catch (err) { reject(err); }
      }),
      remove: (id) => new Promise((resolve, reject) => {
        try { write(read().filter((r) => r.id !== id)); resolve(); }
        catch (err) { reject(err); }
      })
    };
  }

  async function initStorage() {
    if (window.indexedDB) {
      try {
        const db = await withTimeout(openIndexedDb(), 4000, 'IndexedDB');
        const idb = createIdbStorage(db);
        await withTimeout(idb.getAll(), 4000, 'IndexedDB');
        return idb;
      } catch (err) { /* fall through to localStorage */ }
    }
    return createLocalStorage();
  }

  /* ======================================================================
     Passcode lock: PBKDF2 -> AES-GCM, everything stays in this browser
     ====================================================================== */
  const subtle = window.crypto && window.crypto.subtle ? window.crypto.subtle : null;
  const cryptoOk = !!(subtle && typeof subtle.deriveKey === 'function' && typeof window.TextEncoder === 'function'
    && typeof window.crypto.getRandomValues === 'function');

  let lockSettings = null; /* { v: 1, salt, verifier: { iv, data } } or null when there is no lock */
  let sessionKey = null;   /* CryptoKey while a lock exists and the page is unlocked */
  let locked = false;

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return window.btoa(binary);
  }
  function base64ToBytes(b64) {
    const binary = window.atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  function deriveKey(passcode, salt) {
    return subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveKey'])
      .then((material) => subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      ));
  }

  async function encryptText(key, text) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const data = await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(data)) };
  }

  async function decryptText(key, enc) {
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(enc.iv) }, key, base64ToBytes(enc.data));
    return new TextDecoder().decode(plain);
  }

  function readLockSettings() {
    let raw = '';
    try { raw = window.localStorage.getItem(LOCK_KEY) || ''; }
    catch (err) { raw = ''; }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1 && typeof parsed.salt === 'string' && parsed.verifier
        && typeof parsed.verifier.iv === 'string' && typeof parsed.verifier.data === 'string') return parsed;
    } catch (err) { /* unreadable settings count as no lock */ }
    return null;
  }

  async function verifyKey(key) {
    try { return (await decryptText(key, lockSettings.verifier)) === LOCK_VERIFIER; }
    catch (err) { return false; }
  }

  async function restoreSessionKey() {
    let raw = '';
    try { raw = window.sessionStorage.getItem(SESSION_KEY) || ''; }
    catch (err) { raw = ''; }
    if (!raw) return null;
    try {
      const key = await subtle.importKey('raw', base64ToBytes(raw), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
      return (await verifyKey(key)) ? key : null;
    } catch (err) { return null; }
  }

  async function saveSessionKey(key) {
    try {
      const raw = await subtle.exportKey('raw', key);
      window.sessionStorage.setItem(SESSION_KEY, bytesToBase64(new Uint8Array(raw)));
    } catch (err) { /* the page stays unlocked for this visit only */ }
  }

  function clearSessionKey() {
    try { window.sessionStorage.removeItem(SESSION_KEY); } catch (err) { /* ignore */ }
  }

  /* A project in memory is always plain. In storage it is plain without a
     lock and { id, addedAt, enc: { iv, data } } with one. */
  async function toStored(project) {
    if (!lockSettings) return project;
    if (!sessionKey) throw new Error('The page is locked.');
    const payload = { title: project.title, fileName: project.fileName, html: project.html, bytes: project.bytes, source: project.source };
    const enc = await encryptText(sessionKey, JSON.stringify(payload));
    return { id: project.id, addedAt: project.addedAt, enc };
  }

  async function fromStored(record) {
    if (!record || typeof record.id !== 'string') return null;
    if (record.enc) {
      if (!sessionKey) throw new Error('The page is locked.');
      const fields = JSON.parse(await decryptText(sessionKey, record.enc));
      return {
        id: record.id,
        addedAt: record.addedAt,
        title: fields.title,
        fileName: fields.fileName,
        html: fields.html,
        bytes: fields.bytes,
        source: fields.source
      };
    }
    return typeof record.html === 'string' ? record : null;
  }

  async function persist(project) {
    const record = await toStored(project);
    await storage.put(record);
  }

  async function loadProjects() {
    const list = await storage.getAll();
    const out = [];
    let unreadable = 0;
    for (let i = 0; i < list.length; i++) {
      try {
        const project = await fromStored(list[i]);
        if (project) out.push(project);
      } catch (err) { unreadable += 1; }
    }
    return { projects: out, unreadable };
  }

  /* ======================================================================
     Rendering
     ====================================================================== */
  const frameObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => { entries.forEach((entry) => fitFrame(entry.target)); })
    : null;
  if (!frameObserver) {
    window.addEventListener('resize', () => {
      els.grid.querySelectorAll('.project-card__preview').forEach(fitFrame);
    });
  }

  function fitFrame(preview) {
    const frame = preview.querySelector('.project-card__frame');
    const width = preview.clientWidth;
    if (!frame || !width) return;
    frame.style.setProperty('--scale', String(width / PREVIEW_WIDTH));
  }

  function sortProjects() {
    projects.sort((a, b) => {
      if (a.addedAt !== b.addedAt) return a.addedAt < b.addedAt ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    });
  }

  function findProject(id) {
    for (let i = 0; i < projects.length; i++) if (projects[i].id === id) return projects[i];
    return null;
  }

  function metaText(project) {
    return project.fileName + ' · ' + formatBytes(project.bytes) + ' · Added ' + formatDate(project.addedAt);
  }

  function actionButton(action, label, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('data-action', action);
    button.textContent = label;
    return button;
  }

  function buildCard(project) {
    const li = document.createElement('li');
    li.className = 'card project-card';
    li.setAttribute('data-id', project.id);

    const preview = document.createElement('div');
    preview.className = 'project-card__preview';
    const frame = document.createElement('iframe');
    frame.className = 'project-card__frame';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('title', 'Preview of ' + project.title);
    /* Safari paints a not-yet-loaded lazy frame white, so keep it invisible
       until it has loaded (with a fallback in case load never fires). */
    const reveal = () => frame.classList.add('is-loaded');
    frame.addEventListener('load', reveal);
    setTimeout(reveal, 12000);
    frame.srcdoc = project.html;
    preview.appendChild(frame);

    const body = document.createElement('div');
    body.className = 'project-card__body';
    const title = document.createElement('h3');
    title.className = 'project-card__title';
    title.textContent = project.title;
    const meta = document.createElement('p');
    meta.className = 'project-card__meta';
    meta.textContent = metaText(project);
    const actions = document.createElement('div');
    actions.className = 'project-card__actions';
    actions.appendChild(actionButton('open', 'Open', 'project-card__btn project-card__btn--primary'));
    actions.appendChild(actionButton('rename', 'Rename', 'project-card__btn'));
    actions.appendChild(actionButton('remove', 'Remove', 'project-card__btn project-card__btn--danger'));
    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(actions);

    li.appendChild(preview);
    li.appendChild(body);
    return li;
  }

  function mountCard(card, atTop) {
    if (atTop && els.grid.firstChild) els.grid.insertBefore(card, els.grid.firstChild);
    else els.grid.appendChild(card);
    const preview = card.querySelector('.project-card__preview');
    if (preview) {
      fitFrame(preview);
      if (frameObserver) frameObserver.observe(preview);
    }
  }

  function unmountCard(card) {
    const preview = card.querySelector('.project-card__preview');
    if (preview && frameObserver) frameObserver.unobserve(preview);
    card.remove();
  }

  function clearCards() {
    els.grid.querySelectorAll('.project-card').forEach(unmountCard);
  }

  function renderAll() {
    clearCards();
    sortProjects();
    projects.forEach((project) => mountCard(buildCard(project), false));
    updateCount();
  }

  function updateCount() {
    const n = projects.length;
    if (els.count) els.count.textContent = n + (n === 1 ? ' website' : ' websites');
    if (els.empty) els.empty.hidden = locked || n > 0;
  }

  function applyTitle(card, project) {
    const title = card.querySelector('.project-card__title');
    if (title) title.textContent = project.title;
    const frame = card.querySelector('.project-card__frame');
    if (frame) frame.setAttribute('title', 'Preview of ' + project.title);
    const meta = card.querySelector('.project-card__meta');
    if (meta) meta.textContent = metaText(project);
  }

  /* ======================================================================
     Card actions: open, rename, remove
     ====================================================================== */
  function openProject(project) {
    const blob = new Blob([project.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    let win = null;
    let lostFocus = false;
    const onAway = () => { lostFocus = true; };
    window.addEventListener('blur', onAway);
    document.addEventListener('visibilitychange', onAway);
    try { win = window.open(url, '_blank', 'noopener'); }
    catch (err) { win = null; }
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (err) { /* ignore */ } }, 60000);
    /* With "noopener" most browsers return null even when the tab opened, so
       wait a moment and see whether this page lost focus. */
    setTimeout(() => {
      window.removeEventListener('blur', onAway);
      document.removeEventListener('visibilitychange', onAway);
      const opened = !!win || lostFocus || document.hidden || !document.hasFocus();
      if (opened) setStatus('Opened ' + project.title + ' in a new tab.', 'ok');
      else setStatus('The new tab may have been blocked. Allow pop-ups for this page and press Open again.', 'error');
    }, 700);
  }

  let activeRename = null;

  function startRename(card, project) {
    const title = card.querySelector('.project-card__title');
    if (!title || card.querySelector('.project-card__rename')) return;
    if (activeRename) activeRename.cancel();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'project-card__rename';
    input.value = project.title;
    input.maxLength = 120;
    input.setAttribute('aria-label', 'New name for ' + project.title);
    input.setAttribute('autocomplete', 'off');
    title.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    function restore(refocus) {
      if (input.parentNode) input.replaceWith(title);
      if (refocus) {
        const button = card.querySelector('[data-action="rename"]');
        if (button) button.focus({ preventScroll: true });
      }
    }
    /* Enter, Escape and blur all land here; the first call wins, so the
       write below happens exactly once. The input stays in place (read-only)
       until storage has committed the new name: the heading only ever shows
       a name that is already saved, so a reload right after cannot lose it. */
    async function finish(commit, refocus) {
      if (done) return;
      done = true;
      if (activeRename && activeRename.input === input) activeRename = null;
      const next = input.value.trim();
      if (!commit || !next || next === project.title) { restore(refocus); return; }
      input.readOnly = true;
      input.setAttribute('aria-busy', 'true');
      const previous = project.title;
      project.title = next;
      try {
        await persist(project);
      } catch (err) {
        project.title = previous;
        restore(refocus);
        applyTitle(card, project);
        setStatus('Could not save the new name: ' + errorMessage(err), 'error');
        return;
      }
      restore(refocus);
      applyTitle(card, project);
      setStatus('Renamed to ' + next + '.', 'ok');
    }
    activeRename = { input, cancel: () => finish(false, false) };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true, true); }
      else if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); finish(false, true); }
    });
    input.addEventListener('blur', () => { finish(true, false); });
  }

  async function removeProject(card, project) {
    if (!window.confirm('Remove ' + project.title + ' from your landing page?')) return;
    try {
      await storage.remove(project.id);
    } catch (err) {
      setStatus('Could not remove ' + project.title + ': ' + errorMessage(err), 'error');
      return;
    }
    projects = projects.filter((p) => p.id !== project.id);
    const next = card.nextElementSibling || card.previousElementSibling;
    unmountCard(card);
    updateCount();
    setStatus('Removed ' + project.title + '.', 'ok');
    const target = next ? next.querySelector('[data-action="open"]') : els.zone;
    if (target) target.focus({ preventScroll: true });
  }

  els.grid.addEventListener('click', (e) => {
    const card = e.target.closest('.project-card');
    if (!card || !els.grid.contains(card)) return;
    const project = findProject(card.getAttribute('data-id'));
    if (!project) return;
    const button = e.target.closest('button[data-action]');
    if (button) {
      const action = button.getAttribute('data-action');
      if (action === 'open') openProject(project);
      else if (action === 'rename') startRename(card, project);
      else if (action === 'remove') removeProject(card, project);
      return;
    }
    if (e.target.closest('.project-card__preview')) openProject(project);
  });

  /* ======================================================================
     Landing page title
     ====================================================================== */
  function setDefaultHeading() {
    if (!els.heading) return;
    els.heading.textContent = '';
    els.heading.appendChild(document.createTextNode('Your websites, on one '));
    const span = document.createElement('span');
    span.className = 'grad-text';
    span.textContent = 'page';
    els.heading.appendChild(span);
    els.heading.appendChild(document.createTextNode('.'));
  }

  function applyLandingTitle(value) {
    const text = (value || '').trim();
    if (text) {
      if (els.heading) els.heading.textContent = text;
      document.title = text + ' | Rihaan';
    } else {
      setDefaultHeading();
      document.title = DEFAULT_DOC_TITLE;
    }
  }

  function saveLandingTitle(value) {
    const text = (value || '').trim();
    try {
      if (text) window.localStorage.setItem(TITLE_KEY, text);
      else window.localStorage.removeItem(TITLE_KEY);
    } catch (err) { /* storage unavailable: the title still applies for this visit */ }
  }

  function loadLandingTitle() {
    let stored = '';
    try { stored = window.localStorage.getItem(TITLE_KEY) || ''; }
    catch (err) { stored = ''; }
    if (els.titleInput && stored) els.titleInput.value = stored.slice(0, 60);
    applyLandingTitle(stored);
  }

  if (els.titleInput) {
    els.titleInput.addEventListener('input', () => {
      applyLandingTitle(els.titleInput.value);
      saveLandingTitle(els.titleInput.value);
    });
  }

  /* ======================================================================
     Bundling a folder (or a flat Finder selection) into one document
     ====================================================================== */
  function isExternalRef(ref) {
    return /^[a-z][a-z0-9+.\-]*:/i.test(ref) || ref.indexOf('//') === 0 || ref.charAt(0) === '#';
  }

  /* Resolve a reference relative to a directory inside the folder. Returns the
     folder-relative path, or null for external or empty references. */
  function resolveRef(ref, fromDir) {
    if (typeof ref !== 'string') return null;
    let value = ref.trim();
    if (!value || isExternalRef(value)) return null;
    const hash = value.indexOf('#');
    if (hash !== -1) value = value.slice(0, hash);
    const query = value.indexOf('?');
    if (query !== -1) value = value.slice(0, query);
    if (!value) return null;
    const joined = value.charAt(0) === '/' ? value.slice(1) : (fromDir ? fromDir + '/' + value : value);
    const out = [];
    joined.split('/').forEach((segment) => {
      if (!segment || segment === '.') return;
      if (segment === '..') { out.pop(); return; }
      out.push(segment);
    });
    return out.length ? out.join('/') : null;
  }

  /* flat: the files came from the Finder picker as a flat list, so a
     reference like assets/ball.png may only match a selected ball.png. */
  function createBundleContext(name, files, flat) {
    const lower = new Map();
    const byBase = new Map();
    files.forEach((file, path) => {
      lower.set(path.toLowerCase(), file);
      const base = baseName(path).toLowerCase();
      if (!byBase.has(base)) byBase.set(base, file);
    });
    return { name, files, lower, byBase, flat: !!flat, cache: new Map(), budget: 0, skipped: [] };
  }

  function lookupFile(ctx, path) {
    if (ctx.files.has(path)) return ctx.files.get(path);
    let decoded = path;
    try { decoded = decodeURIComponent(path); } catch (err) { decoded = path; }
    if (ctx.files.has(decoded)) return ctx.files.get(decoded);
    const loose = ctx.lower.get(decoded.toLowerCase()) || ctx.lower.get(path.toLowerCase()) || null;
    if (loose || !ctx.flat) return loose;
    return ctx.byBase.get(baseName(decoded).toLowerCase()) || ctx.byBase.get(baseName(path).toLowerCase()) || null;
  }

  function addToBudget(ctx, bytes) {
    ctx.budget += bytes;
    if (ctx.budget > MAX_PROJECT_BYTES) {
      throw new ImportError(ctx.name + ' is larger than 25 MB once bundled. Remove some large files and try again.');
    }
  }

  async function assetDataUrl(ctx, path) {
    if (ctx.cache.has(path)) return ctx.cache.get(path);
    const file = lookupFile(ctx, path);
    if (!file) return null;
    if (file.size > MAX_ASSET_BYTES) {
      ctx.skipped.push(path);
      ctx.cache.set(path, null);
      return null;
    }
    const url = await readDataUrl(file, mimeFor(path, file.type));
    addToBudget(ctx, url.length);
    ctx.cache.set(path, url);
    return url;
  }

  async function replaceAsync(str, regex, fn) {
    const parts = [];
    let last = 0;
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(str)) !== null) {
      parts.push(str.slice(last, match.index));
      parts.push(fn.apply(null, match));
      last = match.index + match[0].length;
      if (!match[0].length) regex.lastIndex += 1;
    }
    parts.push(str.slice(last));
    const resolved = await Promise.all(parts);
    return resolved.join('');
  }

  const CSS_IMPORT = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*([^;]*);/g;
  const CSS_URL = /url\(\s*(['"]?)([^'")]*)\1\s*\)/g;

  async function inlineCss(ctx, css, cssDir, depth) {
    if (depth < 5) {
      css = await replaceAsync(css, CSS_IMPORT, async (whole, q1, ref1, q2, ref2, media) => {
        const path = resolveRef(ref1 || ref2, cssDir);
        const file = path ? lookupFile(ctx, path) : null;
        if (!file || file.size > MAX_ASSET_BYTES) return whole;
        const text = await readText(file);
        addToBudget(ctx, text.length);
        const inner = await inlineCss(ctx, text, dirname(path), depth + 1);
        const conditions = (media || '').trim();
        return conditions ? '@media ' + conditions + ' {\n' + inner + '\n}' : inner;
      });
    }
    return replaceAsync(css, CSS_URL, async (whole, quote, ref) => {
      const path = resolveRef(ref, cssDir);
      if (!path) return whole;
      const data = await assetDataUrl(ctx, path);
      return data ? 'url("' + data + '")' : whole;
    });
  }

  async function rewriteSrcset(ctx, value, baseDir) {
    if (!value || value.indexOf('data:') !== -1) return value;
    const candidates = value.split(',');
    const out = [];
    for (let i = 0; i < candidates.length; i++) {
      const parts = candidates[i].trim().split(/\s+/);
      if (!parts[0]) continue;
      const path = resolveRef(parts[0], baseDir);
      const data = path ? await assetDataUrl(ctx, path) : null;
      out.push((data || parts[0]) + (parts.length > 1 ? ' ' + parts.slice(1).join(' ') : ''));
    }
    return out.join(', ');
  }

  async function rewriteAttribute(ctx, el, attr, baseDir) {
    const path = resolveRef(el.getAttribute(attr), baseDir);
    if (!path) return;
    const data = await assetDataUrl(ctx, path);
    if (data) el.setAttribute(attr, data);
  }

  async function rewriteDocument(ctx, doc, baseDir) {
    const withSrc = doc.querySelectorAll('img[src], source[src], video[src], audio[src], track[src], input[type="image"][src]');
    for (let i = 0; i < withSrc.length; i++) await rewriteAttribute(ctx, withSrc[i], 'src', baseDir);

    const posters = doc.querySelectorAll('video[poster]');
    for (let i = 0; i < posters.length; i++) await rewriteAttribute(ctx, posters[i], 'poster', baseDir);

    const icons = doc.querySelectorAll('link[rel~="icon"][href], link[rel~="apple-touch-icon"][href]');
    for (let i = 0; i < icons.length; i++) await rewriteAttribute(ctx, icons[i], 'href', baseDir);

    const withSrcset = doc.querySelectorAll('img[srcset], source[srcset]');
    for (let i = 0; i < withSrcset.length; i++) {
      const el = withSrcset[i];
      el.setAttribute('srcset', await rewriteSrcset(ctx, el.getAttribute('srcset'), baseDir));
    }

    const sheets = doc.querySelectorAll('link[rel~="stylesheet"][href]');
    for (let i = 0; i < sheets.length; i++) {
      const link = sheets[i];
      const path = resolveRef(link.getAttribute('href'), baseDir);
      const file = path ? lookupFile(ctx, path) : null;
      if (!file) continue;
      if (file.size > MAX_ASSET_BYTES) { ctx.skipped.push(path); continue; }
      const text = await readText(file);
      addToBudget(ctx, text.length);
      const css = await inlineCss(ctx, text, dirname(path), 0);
      const style = doc.createElement('style');
      if (link.getAttribute('media')) style.setAttribute('media', link.getAttribute('media'));
      style.textContent = css.replace(/<\/style/gi, '<\\/style');
      link.replaceWith(style);
    }

    const styles = doc.querySelectorAll('style');
    for (let i = 0; i < styles.length; i++) {
      const style = styles[i];
      if (!style.textContent || style.textContent.indexOf('url(') === -1) continue;
      const css = await inlineCss(ctx, style.textContent, baseDir, 0);
      style.textContent = css.replace(/<\/style/gi, '<\\/style');
    }

    const styled = doc.querySelectorAll('[style]');
    for (let i = 0; i < styled.length; i++) {
      const el = styled[i];
      const value = el.getAttribute('style');
      if (!value || value.indexOf('url(') === -1) continue;
      el.setAttribute('style', await inlineCss(ctx, value, baseDir, 5));
    }

    const scripts = doc.querySelectorAll('script[src]');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const path = resolveRef(script.getAttribute('src'), baseDir);
      const file = path ? lookupFile(ctx, path) : null;
      if (!file) continue;
      if (file.size > MAX_ASSET_BYTES) { ctx.skipped.push(path); continue; }
      const text = await readText(file);
      addToBudget(ctx, text.length);
      script.removeAttribute('src');
      script.removeAttribute('integrity');
      script.removeAttribute('crossorigin');
      script.textContent = text.replace(/<\/script/gi, '<\\/script');
    }
  }

  function serializeDocument(doc) {
    let out = '';
    const dt = doc.doctype;
    if (dt) {
      out = '<!DOCTYPE ' + (dt.name || 'html');
      if (dt.publicId) out += ' PUBLIC "' + dt.publicId + '"';
      if (dt.systemId) out += (dt.publicId ? ' ' : ' SYSTEM ') + '"' + dt.systemId + '"';
      out += '>\n';
    }
    return out + doc.documentElement.outerHTML;
  }

  function pickEntryHtml(files) {
    let best = null;
    let bestScore = Infinity;
    files.forEach((file, path) => {
      if (!isHtmlName(path)) return;
      const base = baseName(path).toLowerCase();
      const depth = path.split('/').length - 1;
      const score = (base === 'index.html' || base === 'index.htm' ? 0 : 100000) + depth;
      if (score < bestScore) { best = path; bestScore = score; }
    });
    return best;
  }

  function makeRecord(fields) {
    return {
      id: makeId(),
      title: fields.title,
      fileName: fields.fileName,
      html: fields.html,
      bytes: byteLength(fields.html),
      source: fields.source,
      addedAt: new Date().toISOString()
    };
  }

  async function importSingleFile(file) {
    if (file.size > MAX_PROJECT_BYTES) throw new ImportError(file.name + ' is larger than 25 MB.');
    const html = await readText(file);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = titleOf(doc) || stripExtension(file.name) || file.name;
    return { record: makeRecord({ title, fileName: file.name, html, source: 'file' }), skipped: [] };
  }

  async function bundle(name, files, entryPath, flat) {
    const entryFile = files.get(entryPath);
    if (entryFile.size > MAX_PROJECT_BYTES) throw new ImportError(name + ' is larger than 25 MB.');
    const source = await readText(entryFile);
    const ctx = createBundleContext(name, files, flat);
    addToBudget(ctx, source.length);
    const doc = new DOMParser().parseFromString(source, 'text/html');
    await rewriteDocument(ctx, doc, dirname(entryPath));
    const html = serializeDocument(doc);
    if (byteLength(html) > MAX_PROJECT_BYTES) {
      throw new ImportError(name + ' is larger than 25 MB once bundled. Remove some large files and try again.');
    }
    return { doc, html, skipped: ctx.skipped };
  }

  async function importFolder(name, files) {
    const entryPath = pickEntryHtml(files);
    if (!entryPath) throw new ImportError('No .html file found in ' + name + '.');
    const out = await bundle(name, files, entryPath, false);
    const title = titleOf(out.doc) || name;
    return { record: makeRecord({ title, fileName: name + '/' + entryPath, html: out.html, source: 'folder' }), skipped: out.skipped };
  }

  /* One .html file chosen together with its images, styles and scripts. */
  async function importSelection(job) {
    const out = await bundle(job.name, job.files, job.entry, true);
    const title = titleOf(out.doc) || stripExtension(job.name) || job.name;
    return { record: makeRecord({ title, fileName: job.name, html: out.html, source: 'files' }), skipped: out.skipped };
  }

  /* ======================================================================
     Collecting dropped and chosen files into import jobs
     ====================================================================== */
  function readAllEntries(reader) {
    return new Promise((resolve, reject) => {
      const out = [];
      (function next() {
        reader.readEntries((batch) => {
          if (!batch.length) { resolve(out); return; }
          for (let i = 0; i < batch.length; i++) out.push(batch[i]);
          next();
        }, reject);
      })();
    });
  }

  function entryToFile(entry) {
    return new Promise((resolve, reject) => { entry.file(resolve, reject); });
  }

  async function walkDirectory(dirEntry, prefix, files, counter) {
    const children = await readAllEntries(dirEntry.createReader());
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (isSkippedName(child.name)) continue;
      const rel = prefix ? prefix + '/' + child.name : child.name;
      if (child.isDirectory) {
        await walkDirectory(child, rel, files, counter);
      } else if (child.isFile) {
        counter.n += 1;
        if (counter.n > MAX_FOLDER_FILES) throw new ImportError('That folder has more than ' + MAX_FOLDER_FILES + ' files. Drop just the website folder.');
        files.set(rel, await entryToFile(child));
      }
    }
  }

  /* Must run synchronously inside the drop handler: the items are gone afterwards.
     Directories are only reachable through webkitGetAsEntry(); plain files come
     from getAsFile(), which works for real and synthetic drops in every engine. */
  function readDropped(dt) {
    const dirs = [];
    const files = [];
    const fileEntries = [];
    if (dt.items && dt.items.length) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind !== 'file') continue;
        let entry = null;
        try { entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null; }
        catch (err) { entry = null; }
        if (entry && entry.isDirectory) { dirs.push(entry); continue; }
        const file = item.getAsFile();
        if (file) files.push(file);
        else if (entry && entry.isFile) fileEntries.push(entry);
      }
    }
    if (!dirs.length && !files.length && !fileEntries.length && dt.files) {
      for (let i = 0; i < dt.files.length; i++) files.push(dt.files[i]);
    }
    return { dirs, files, fileEntries };
  }

  /* Loose files (a Finder selection, or files dropped without a folder):
     every .html file becomes a website. When other files came along, each
     website is bundled with them, matching references by path and then by
     base name. Without any .html file nothing can be made. */
  function groupLooseFiles(list, jobs, notes) {
    const files = new Map();
    const pages = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      if (!file || isSkippedName(file.name)) continue;
      const rel = file.webkitRelativePath || file.name;
      files.set(rel, file);
      if (isHtmlName(file.name)) pages.push({ path: rel, file });
    }
    if (!pages.length) {
      files.forEach((file) => {
        if (extensionOf(file.name) === 'zip') notes.zip += 1;
        else notes.other += 1;
      });
      return;
    }
    const withAssets = files.size > pages.length;
    pages.forEach((page) => {
      if (withAssets) jobs.push({ kind: 'files', name: page.file.name, entry: page.path, files });
      else jobs.push({ kind: 'file', name: page.file.name, file: page.file });
    });
  }

  async function jobsFromDrop(dropped) {
    const jobs = [];
    const notes = { zip: 0, other: 0, picker: false };
    for (let i = 0; i < dropped.dirs.length; i++) {
      const entry = dropped.dirs[i];
      setStatus('Reading ' + entry.name + '…');
      const files = new Map();
      await walkDirectory(entry, '', files, { n: 0 });
      jobs.push({ kind: 'folder', name: entry.name, files });
    }
    const loose = dropped.files.slice();
    for (let i = 0; i < dropped.fileEntries.length; i++) loose.push(await entryToFile(dropped.fileEntries[i]));
    groupLooseFiles(loose, jobs, notes);
    return { jobs, notes };
  }

  function jobsFromFileList(list) {
    const jobs = [];
    const notes = { zip: 0, other: 0, picker: true };
    groupLooseFiles(Array.prototype.slice.call(list), jobs, notes);
    return { jobs, notes };
  }

  /* ======================================================================
     Running imports
     ====================================================================== */
  function importJob(job) {
    if (job.kind === 'folder') return importFolder(job.name, job.files);
    if (job.kind === 'files') return importSelection(job);
    return importSingleFile(job.file);
  }

  async function runImport(work) {
    const jobs = work.jobs;
    const notes = work.notes;
    if (!jobs.length) {
      if (notes.picker) setStatus('Include the page’s .html file in your selection.', 'error');
      else if (notes.zip) setStatus('Unzip it first, then drop the folder.', 'error');
      else setStatus('Drop an .html file or a website folder.', 'error');
      return;
    }
    if (locked) { setStatus('Unlock your websites first.', 'error'); return; }
    if (busy || lockBusy) { setStatus('Still importing. One moment.', 'error'); return; }
    busy = true;
    els.zone.setAttribute('aria-busy', 'true');
    let added = 0;
    const problems = [];
    let skippedAssets = 0;
    try {
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        if (jobs.length > 1) setStatus('Importing ' + (i + 1) + ' of ' + jobs.length + '…');
        else setStatus('Importing ' + job.name + '…');
        try {
          const result = await importJob(job);
          await persist(result.record);
          projects.push(result.record);
          mountCard(buildCard(result.record), true);
          added += 1;
          skippedAssets += result.skipped.length;
        } catch (err) {
          problems.push(job.name + ': ' + errorMessage(err));
        }
      }
    } finally {
      busy = false;
      els.zone.removeAttribute('aria-busy');
    }
    updateCount();
    const extras = [];
    if (skippedAssets) extras.push(plural(skippedAssets, 'file') + ' over 8 MB skipped.');
    if (notes.zip) extras.push('Unzip archives first, then drop the folder.');
    if (notes.other) extras.push(plural(notes.other, 'file') + ' skipped: drop an .html file or a website folder.');
    if (added && !problems.length) {
      setStatus('Added ' + plural(added, 'website') + (extras.length ? '. ' + extras.join(' ') : ''), 'ok');
    } else if (added) {
      setStatus('Added ' + plural(added, 'website') + '. ' + problems.join(' ') + (extras.length ? ' ' + extras.join(' ') : ''), 'error');
    } else {
      setStatus(problems.join(' ') + (extras.length ? ' ' + extras.join(' ') : ''), 'error');
    }
  }

  /* ======================================================================
     Drop zone and the Finder picker
     ====================================================================== */
  function dragHasFiles(dt) {
    if (!dt || !dt.types) return false;
    const types = dt.types;
    if (typeof types.contains === 'function') return types.contains('Files');
    return Array.prototype.indexOf.call(types, 'Files') !== -1;
  }

  let dragDepth = 0;
  function setDragover(on) {
    els.zone.classList.toggle('is-dragover', on);
  }

  els.zone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth += 1;
    setDragover(true);
  });
  els.zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setDragover(true);
  });
  els.zone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setDragover(false);
  });
  els.zone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    setDragover(false);
    if (!e.dataTransfer) return;
    const dropped = readDropped(e.dataTransfer);
    jobsFromDrop(dropped).then(runImport, (err) => setStatus('Could not read what was dropped: ' + errorMessage(err), 'error'));
  });
  document.addEventListener('dragend', () => { dragDepth = 0; setDragover(false); });

  /* Files dropped anywhere else must not navigate the page away. */
  document.addEventListener('dragover', (e) => {
    if (els.zone.contains(e.target) || !dragHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'none';
  });
  document.addEventListener('drop', (e) => {
    if (els.zone.contains(e.target)) return;
    e.preventDefault();
  });

  /* The hidden file input's click() opens the native Finder picker. */
  function openFilePicker() { els.fileInput.click(); }

  els.zone.addEventListener('click', (e) => {
    if (e.target.closest('button, input, a')) return;
    openFilePicker();
  });
  els.zone.addEventListener('keydown', (e) => {
    if (e.target !== els.zone) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      openFilePicker();
    }
  });
  if (els.chooseFiles) els.chooseFiles.addEventListener('click', (e) => { e.stopPropagation(); openFilePicker(); });
  document.querySelectorAll('[data-pick="files"]').forEach((el) => { el.addEventListener('click', openFilePicker); });

  els.fileInput.addEventListener('change', () => {
    const work = jobsFromFileList(els.fileInput.files || []);
    els.fileInput.value = '';
    runImport(work);
  });

  /* ======================================================================
     Lock UI: privacy controls, the set-passcode form and the lock screen
     ====================================================================== */
  function showLockError(message) {
    if (els.lockError) els.lockError.textContent = message || '';
  }

  function showUnlockError(message) {
    if (els.unlockError) els.unlockError.textContent = message || '';
  }

  function setFormBusy(form, on) {
    if (!form) return;
    form.classList.toggle('is-busy', on);
    form.querySelectorAll('input, button').forEach((el) => { el.disabled = on; });
  }

  function makeLockButton(id, label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.className = 'btn btn--ghost btn--small';
    button.textContent = label;
    button.hidden = locked;
    button.addEventListener('click', onClick);
    return button;
  }

  /* The row of small buttons under the privacy note reflects the lock state:
     no lock -> "Lock with a passcode"; lock -> "Lock now" and "Remove
     passcode". While the page is locked the buttons carry the hidden attribute. */
  function renderLockControls() {
    if (!els.lockActions) return;
    els.lockActions.textContent = '';
    if (!cryptoOk) {
      els.lockActions.hidden = true;
      if (els.lockUnavailable) els.lockUnavailable.hidden = false;
      if (els.lockWarning) els.lockWarning.hidden = true;
      return;
    }
    if (els.lockUnavailable) els.lockUnavailable.hidden = true;
    els.lockActions.hidden = false;
    if (!lockSettings) {
      els.lockActions.appendChild(makeLockButton('lock-enable', 'Lock with a passcode', showLockForm));
    } else {
      els.lockActions.appendChild(makeLockButton('lock-now', 'Lock now', lockNow));
      els.lockActions.appendChild(makeLockButton('lock-remove', 'Remove passcode', removeLockFromUi));
    }
    if (els.lockWarning) els.lockWarning.hidden = !lockSettings;
  }

  function showLockForm() {
    if (!els.lockForm) return;
    showLockError('');
    els.lockForm.hidden = false;
    if (els.lockActions) els.lockActions.hidden = true;
    if (els.lockPasscode) { els.lockPasscode.value = ''; els.lockPasscode.focus({ preventScroll: true }); }
    if (els.lockConfirm) els.lockConfirm.value = '';
  }

  function hideLockForm() {
    if (!els.lockForm) return;
    els.lockForm.hidden = true;
    showLockError('');
    if (els.lockPasscode) els.lockPasscode.value = '';
    if (els.lockConfirm) els.lockConfirm.value = '';
    if (els.lockActions && cryptoOk) els.lockActions.hidden = false;
  }

  function setLocked(isLocked) {
    locked = isLocked;
    if (els.main) els.main.classList.toggle('is-locked', isLocked);
    els.zone.hidden = isLocked;
    if (els.galleryHead) els.galleryHead.hidden = isLocked;
    els.grid.hidden = isLocked;
    if (els.lockScreen) els.lockScreen.hidden = !isLocked;
    renderLockControls();
    /* Every button in the privacy block carries the hidden attribute while
       locked, including the ones inside the (already hidden) passcode form. */
    if (els.privacy) els.privacy.querySelectorAll('button').forEach((button) => { button.hidden = isLocked; });
    updateCount();
    if (isLocked && els.unlockPasscode) {
      els.unlockPasscode.value = '';
      showUnlockError('');
      els.unlockPasscode.focus({ preventScroll: true });
    }
  }

  async function enableLock(passcode) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(passcode, salt);
    const verifier = await encryptText(key, LOCK_VERIFIER);
    const settings = { v: 1, salt: bytesToBase64(salt), verifier };
    /* Settings first: if re-encrypting stops halfway, every record is still
       readable after an unlock (plain ones as they are, encrypted ones with
       the key). The other order could leave encrypted records with no lock. */
    window.localStorage.setItem(LOCK_KEY, JSON.stringify(settings));
    lockSettings = settings;
    sessionKey = key;
    await saveSessionKey(key);
    for (let i = 0; i < projects.length; i++) await persist(projects[i]);
  }

  async function removeLock() {
    const saved = lockSettings;
    lockSettings = null; /* so persist() writes plain records */
    try {
      for (let i = 0; i < projects.length; i++) await persist(projects[i]);
    } catch (err) {
      lockSettings = saved;
      throw err;
    }
    try { window.localStorage.removeItem(LOCK_KEY); } catch (err) { /* ignore */ }
    clearSessionKey();
    sessionKey = null;
  }

  function lockNow() {
    if (busy || lockBusy) { setStatus('Still importing. One moment.', 'error'); return; }
    if (activeRename) activeRename.cancel();
    clearSessionKey();
    sessionKey = null;
    projects = [];
    clearCards();
    hideLockForm();
    setStatus('');
    setLocked(true);
  }

  async function removeLockFromUi() {
    if (busy || lockBusy) { setStatus('Still importing. One moment.', 'error'); return; }
    if (!window.confirm('Remove the passcode? Your websites will be stored unencrypted in this browser.')) return;
    lockBusy = true;
    els.lockActions.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    setStatus('Decrypting your websites…');
    try {
      await removeLock();
    } catch (err) {
      setStatus('Could not remove the passcode: ' + errorMessage(err), 'error');
      lockBusy = false;
      renderLockControls();
      return;
    }
    lockBusy = false;
    renderLockControls();
    setStatus('Passcode removed. Your websites are stored unencrypted in this browser.', 'ok');
    const enable = document.getElementById('lock-enable');
    if (enable) enable.focus({ preventScroll: true });
  }

  if (els.lockForm) {
    els.lockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!cryptoOk) return;
      const passcode = els.lockPasscode ? els.lockPasscode.value : '';
      const confirmation = els.lockConfirm ? els.lockConfirm.value : '';
      if (passcode.length < MIN_PASSCODE) {
        showLockError('Use at least ' + MIN_PASSCODE + ' characters.');
        if (els.lockPasscode) els.lockPasscode.focus();
        return;
      }
      if (passcode !== confirmation) {
        showLockError('Passcodes do not match.');
        if (els.lockConfirm) els.lockConfirm.focus();
        return;
      }
      if (busy || lockBusy) { showLockError('Still importing. One moment.'); return; }
      lockBusy = true;
      showLockError('');
      setFormBusy(els.lockForm, true);
      setStatus('Encrypting your websites…');
      try {
        await enableLock(passcode);
      } catch (err) {
        lockBusy = false;
        setFormBusy(els.lockForm, false);
        setStatus('', null);
        if (lockSettings) {
          /* settings were written but a record could not be encrypted */
          hideLockForm();
          renderLockControls();
          setStatus('Passcode set, but not every website could be encrypted: ' + errorMessage(err), 'error');
        } else {
          showLockError('Could not set the passcode: ' + errorMessage(err));
        }
        return;
      }
      lockBusy = false;
      setFormBusy(els.lockForm, false);
      hideLockForm();
      renderLockControls();
      setStatus('Passcode set. Your websites are now encrypted.', 'ok');
      const now = document.getElementById('lock-now');
      if (now) now.focus({ preventScroll: true });
    });
  }
  if (els.lockCancel) {
    els.lockCancel.addEventListener('click', () => {
      hideLockForm();
      const enable = document.getElementById('lock-enable');
      if (enable) enable.focus({ preventScroll: true });
    });
  }

  async function unlock(passcode) {
    if (!lockSettings) return;
    if (!cryptoOk) { showUnlockError('The passcode lock needs a secure context and is not available here.'); return; }
    if (lockBusy) return;
    lockBusy = true;
    showUnlockError('');
    setFormBusy(els.unlockForm, true);
    let key = null;
    try {
      key = await deriveKey(passcode, base64ToBytes(lockSettings.salt));
      if (!(await verifyKey(key))) key = null;
    } catch (err) { key = null; }
    if (!key) {
      lockBusy = false;
      setFormBusy(els.unlockForm, false);
      showUnlockError('That passcode is not right.');
      if (els.unlockPasscode) { els.unlockPasscode.focus({ preventScroll: true }); els.unlockPasscode.select(); }
      return;
    }
    sessionKey = key;
    await saveSessionKey(key);
    let unreadable = 0;
    try {
      const loaded = await loadProjects();
      projects = loaded.projects;
      unreadable = loaded.unreadable;
    } catch (err) {
      projects = [];
      setStatus('Could not load your saved websites: ' + errorMessage(err), 'error');
    }
    lockBusy = false;
    setFormBusy(els.unlockForm, false);
    if (els.unlockPasscode) els.unlockPasscode.value = '';
    setLocked(false);
    renderAll();
    if (unreadable) setStatus(plural(unreadable, 'website') + ' could not be decrypted and ' + (unreadable === 1 ? 'was' : 'were') + ' left out.', 'error');
    els.zone.focus({ preventScroll: true });
  }

  if (els.unlockForm) {
    els.unlockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      unlock(els.unlockPasscode ? els.unlockPasscode.value : '');
    });
  }

  /* ======================================================================
     Startup
     ====================================================================== */
  loadLandingTitle();

  initStorage().then(async (store) => {
    storage = store;
    lockSettings = cryptoOk ? readLockSettings() : null;
    if (!cryptoOk) {
      /* No WebCrypto: the lock cannot work here. Any encrypted records stay
         untouched in storage and are simply not shown. */
      renderLockControls();
    }
    if (lockSettings) {
      sessionKey = await restoreSessionKey();
      if (!sessionKey) {
        setLocked(true);
        if (storage.mode === 'memory') setStatus('Storage is not available in this browser, so websites will be gone when you leave the page.', 'error');
        return;
      }
    }
    let unreadable = 0;
    try {
      const loaded = await loadProjects();
      projects = loaded.projects;
      unreadable = loaded.unreadable;
    } catch (err) {
      projects = [];
      setStatus('Could not load your saved websites: ' + errorMessage(err), 'error');
    }
    setLocked(false);
    renderAll();
    if (unreadable) setStatus(plural(unreadable, 'website') + ' could not be decrypted and ' + (unreadable === 1 ? 'was' : 'were') + ' left out.', 'error');
    else if (storage.mode === 'local') setStatus('Storage is limited in this browser, so websites are kept in local storage.');
    else if (storage.mode === 'memory') setStatus('Storage is not available in this browser, so websites will be gone when you leave the page.', 'error');
  });
})();
