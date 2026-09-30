/* Brick Route · the app. Renders one step at a time: up to four bricks fill the
   plate; choosing one pops the rest, adds the choice to the trail and drops in
   the next step. After the last step the route screen renders. */

(() => {
  Palette.inject();

  const $ = id => document.getElementById(id);
  const stage = $('stage'), trail = $('trail'), progress = $('progress');
  let step = 0, state = {}, history = [], selected = null, tab = 'stages';
  let pending = [], editingLabel = null;   /* choices kept while editing an earlier brick */

  /* ---------- brick factory ---------- */
  function brick(o) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'brick in' + (o.small ? ' sm' : '') + (Palette.isLight(o.color, o.shade) ? ' dk' : '');
    el.style.setProperty('--c', Palette.shade(o.color, o.shade));
    const studs = o.small ? 4 : 6;
    el.innerHTML = `<div class="studs">${'<i></i>'.repeat(studs)}</div>` +
      (o.key ? `<span class="key">${o.key}</span>` : '') +
      `<div class="label">${o.label}</div>` +
      (o.sub ? `<div class="sub">${o.sub}</div>` : '');
    if (o.delay) el.style.animationDelay = o.delay + 'ms';
    return el;
  }

  /* ---------- steps ---------- */
  function renderStep() {
    const s = STEPS[step];
    const opts = s.options(state);
    stage.innerHTML = `<div><h2>${s.title}</h2><p class="lead">${editingLabel ? `Editing your pick. Choose again, or click <b>${editingLabel}</b> to keep it. Later choices are kept when they still apply.` : s.lead}</p></div>`;
    const grid = document.createElement('div');
    grid.className = 'opts';
    const n = opts.length;
    grid.style.gridTemplateColumns = `repeat(${n <= 2 ? n : n === 4 ? 2 : n === 5 ? 5 : 3}, 1fr)`;
    stage.appendChild(grid);
    opts.forEach((o, i) => {
      const shade = 3 + i * 2;
      const b = brick({ label: o.label, sub: o.sub, color: s.color, shade, key: i + 1, delay: i * 70 });
      if (o.more) {
        const why = document.createElement('span');
        why.className = 'why'; why.textContent = '?'; why.title = 'Why this matters';
        why.addEventListener('click', e => { e.stopPropagation(); openDrawer(o.more, s.color, shade); });
        b.appendChild(why);
      }
      if (editingLabel && o.label === editingLabel) { b.classList.add('current'); b.insertAdjacentHTML('beforeend', '<span class="cur">Current pick</span>'); }
      b.addEventListener('click', () => choose(i, opts, s, shade));
      grid.appendChild(b);
    });
    renderTrail(); renderProgress(); $('hint').hidden = false;
  }

  function choose(i, opts, s, shade) {
    const grid = stage.querySelector('.opts');
    if (!grid || grid.dataset.busy) return;
    grid.dataset.busy = 1;
    const o = opts[i];
    Click.play('snap');
    [...grid.children].forEach((el, j) => el.classList.add(j === i ? 'pick' : 'out'));
    setTimeout(() => {
      history.push({ step, label: o.label, color: s.color, shade, prev: { ...state } });
      Object.assign(state, o.set || {});
      step += 1; editingLabel = null;
      replay();
    }, 280);
  }

  /* re-apply kept choices while they still exist on the new branch */
  function replay() {
    while (step < STEPS.length) {
      const h = pending.find(x => x.step === step);
      if (!h) break;
      const opts = STEPS[step].options(state);
      const idx = opts.findIndex(x => x.label === h.label);
      pending = pending.filter(x => x.step !== step);
      if (idx < 0) break;                                   /* branch changed: ask again */
      history.push({ step, label: h.label, color: STEPS[step].color, shade: 3 + idx * 2, prev: { ...state } });
      Object.assign(state, opts[idx].set || {});
      step += 1;
    }
    if (step < STEPS.length) { const nxt = pending.find(x => x.step === step); editingLabel = nxt ? nxt.label : null; renderStep(); }
    else { pending = []; editingLabel = null; renderResult(); }
  }

  /* click a trail brick: lift it, fade what follows, then reopen that step */
  function editAt(i) {
    if (i < 0 || i >= history.length) return;
    const bricks = trail.querySelectorAll('.brick');
    bricks.forEach((b, j) => { if (j === i) b.classList.add('lift'); else if (j > i) b.classList.add('future'); });
    Click.play('pop');
    setTimeout(() => {
      const h = history[i];
      pending = history.slice(i + 1).concat(pending.filter(x => x.step > h.step));
      history = history.slice(0, i);
      state = { ...h.prev }; step = h.step; selected = null; editingLabel = h.label;
      renderStep();
    }, 300);
  }

  function back() { if (history.length) editAt(history.length - 1); }

  function restart() { history = []; pending = []; editingLabel = null; state = {}; step = 0; selected = null; Click.play('pop'); renderStep(); }

  /* ---------- trail + progress ---------- */
  function renderTrail() {
    trail.innerHTML = '';
    history.forEach((h, i) => {
      const b = brick({ label: h.label, color: h.color, shade: h.shade, small: true });
      b.title = 'Click to change this choice';
      b.addEventListener('click', () => editAt(i));
      trail.appendChild(b);
      if (i < history.length - 1 || pending.length) { const a = document.createElement('span'); a.className = 'arrow'; a.textContent = '→'; trail.appendChild(a); }
    });
    /* choices waiting to be re-applied after an edit */
    pending.filter(h => h.step > step).sort((a, b) => a.step - b.step).forEach((h, i, arr) => {
      const b = brick({ label: h.label, color: h.color, shade: h.shade, small: true });
      b.classList.add('future'); b.title = 'Kept if it still applies';
      trail.appendChild(b);
      if (i < arr.length - 1) { const a = document.createElement('span'); a.className = 'arrow'; a.textContent = '→'; trail.appendChild(a); }
    });
  }
  function renderProgress() {
    progress.innerHTML = STEPS.map((s, i) => `<i class="${i < step ? 'done' : i === step ? 'now' : ''}" style="--c:${Palette.shade(s.color, 6)}" title="${s.title}"></i>`).join('') +
      `<span>${step < STEPS.length ? `Step ${step + 1} of ${STEPS.length}` : 'Route'}</span>`;
  }

  /* ---------- drawer ---------- */
  function openDrawer(more, color, shade) {
    $('drawerBody').innerHTML = `<div class="brick sm" style="--c:${Palette.shade(color, shade)};display:inline-flex;margin-bottom:14px;cursor:default" ><div class="studs"><i></i><i></i><i></i><i></i></div><div class="label">${more.title}</div></div><p>${more.text}</p><div class="src">${more.src || ''}</div>`;
    $('drawer').hidden = false;
  }
  $('drawerClose').addEventListener('click', () => $('drawer').hidden = true);
  $('drawer').addEventListener('click', e => { if (e.target === $('drawer')) $('drawer').hidden = true; });

  /* ---------- result ---------- */
  function renderResult() {
    const r = Route.compute(state);
    $('hint').hidden = true;
    renderTrail(); renderProgress();
    stage.innerHTML = `<div><h2>Your route</h2><p class="lead">${history.map(h => h.label).join(' → ')}</p></div>`;
    const wrap = document.createElement('div'); wrap.className = 'result'; stage.appendChild(wrap);

    /* tower */
    const tower = document.createElement('div'); tower.className = 'tower'; wrap.appendChild(tower);
    const visible = r.stages.filter(x => x.status !== 'NA').sort((a, b) => a.stage - b.stage);
    visible.forEach((m, i) => {
      const b = brick({ label: `${m.id} · ${m.name}`, sub: m.tools.slice(0, 3).join(' · '), color: m.family, shade: 6, small: true, delay: i * 90 });
      b.dataset.status = m.status;
      b.innerHTML += `<span class="badge ${m.status}">${STATUS[m.status].label}</span>`;
      if (selected === m.id) b.classList.add('sel');
      b.addEventListener('click', () => { selected = m.id; tab = 'stages'; Click.play('snap'); paintPanel(r); [...tower.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); });
      tower.appendChild(b);
    });

    /* panel */
    const panel = document.createElement('div'); panel.className = 'panel'; panel.id = 'panel'; wrap.appendChild(panel);
    paintPanel(r);

    if (r.verdict.ok && !r.stages.some(x => x.status === 'VAL')) { confetti(); Click.play('win'); }
  }

  function paintPanel(r) {
    const panel = $('panel'); if (!panel) return;
    const v = r.verdict;
    const sel = selected ? r.stages.find(x => x.id === selected) : null;
    const tabs = [['stages', 'Stages'], ['ledger', 'Ledger']];
    let body = '';
    if (tab === 'ledger') body = `<table class="ledger"><thead><tr><th>Module</th><th>Planned status</th><th>Execution unit</th><th>Reason</th></tr></thead><tbody>${r.ledger.map(l => `<tr><td>${l.id}</td><td><span class="tag ${Object.keys(STATUS).find(k => STATUS[k].ledger === l.status)}">${l.status}</span></td><td class="mono">${l.unit}</td><td>${l.reason}</td></tr>`).join('')}</tbody></table>`;
    else if (sel) body = `<div class="detail"><h4>${sel.id} · ${sel.name}</h4><span class="tag ${sel.status}">${STATUS[sel.status].label}</span><div class="kv"><div><b>Why here</b>${sel.reason}</div><div><b>Needs</b>${sel.needs}</div><div><b>Produces</b>${sel.produces}</div><div><b>Tools</b>${sel.tools.map(t => `<code>${t}</code>`).join(' ')}</div><div><b>Ledger status when planned</b><code>${STATUS[sel.status].ledger}</code></div></div></div>`;
    else body = `<div class="rows">${r.stages.filter(x => x.status !== 'NA').map(m => `<div class="row"><span><i style="background:${Palette.shade(m.family, 6)}"></i>${m.id} ${m.name}</span><span class="tag ${m.status}">${STATUS[m.status].label}</span></div>`).join('')}<p style="color:var(--ink-2);font-weight:800;font-size:13px;margin:14px 0 0">Click a brick in the tower for its inputs, outputs, tools and reason.</p></div>`;

    panel.innerHTML = `<div class="verdict"><div class="brick sm" style="--c:${v.ok ? 'var(--green-6)' : 'var(--red-6)'};cursor:default;min-width:70px"><div class="studs"><i></i><i></i></div><div class="label">${v.ok ? '✓' : '!'}</div></div><div><h3>${v.title}</h3><p>${v.text}</p></div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}<span style="flex:1"></span><button class="lbtn" id="dl" style="--c:var(--teal-6)">Download Markdown plan</button><button class="lbtn" id="again" style="--c:var(--red-6)">Start over</button></div>
      <div class="tabbody">${body}</div>`;
    panel.querySelectorAll('.tabs button[data-t]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; if (tab !== 'stages') selected = null; paintPanel(r); }));
    $('again').addEventListener('click', restart);
    $('dl').addEventListener('click', e => {
      Click.play('snap');
      const choices = history.map(h => ({ step: STEPS[h.step].title, choice: h.label }));
      const md = Route.markdown(state, r, choices);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
      a.download = `analysis-plan-${(state.assay || 'study')}-${(state.platform || '').replace(/[^a-z0-9]+/gi, '-')}.md`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      e.target.textContent = 'Downloaded';
    });
  }

  function confetti() {
    const c = $('confetti'); c.innerHTML = '';
    const fams = ['red', 'orange', 'yellow', 'green', 'blue', 'pink', 'purple', 'teal'];
    for (let i = 0; i < 36; i++) { const b = document.createElement('i'); b.style.left = Math.random() * 100 + '%'; b.style.background = Palette.shade(fams[i % fams.length], 4 + (i % 4)); b.style.animationDelay = Math.random() * 1.2 + 's'; b.style.animationDuration = 2 + Math.random() * 1.5 + 's'; c.appendChild(b); }
    setTimeout(() => c.innerHTML = '', 4500);
  }

  /* ---------- controls + keyboard ---------- */
  $('undo').addEventListener('click', () => back());
  $('restart').addEventListener('click', restart);
  const soundBtn = $('sound');
  const paintSound = () => soundBtn.classList.toggle('off', !Click.on);
  soundBtn.addEventListener('click', () => { Click.toggle(); paintSound(); Click.play('snap'); }); paintSound();

  document.addEventListener('keydown', e => {
    if (!$('drawer').hidden && e.key === 'Escape') { $('drawer').hidden = true; return; }
    if (e.key === 'Backspace') { e.preventDefault(); back(); }
    else if (e.key.toLowerCase() === 'r') restart();
    else if (e.key.toLowerCase() === 's') { Click.toggle(); paintSound(); }
    else if (/^[1-5]$/.test(e.key) && step < STEPS.length) { const b = stage.querySelectorAll('.opts .brick')[+e.key - 1]; if (b) b.click(); }
    else if (e.key === '?' && step < STEPS.length) { const w = stage.querySelector('.opts .brick .why'); if (w) w.click(); }
  });

  renderStep();
})();
