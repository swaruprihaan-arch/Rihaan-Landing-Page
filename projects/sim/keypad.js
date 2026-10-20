/* CONTRAIL — on-screen mini keyboard. Shows what each key does, lights up keys you are pressing,
   pulses the key you should press next, and doubles as touch buttons. Used by flight (ext.js) and racing (race.js). */
(function () {
  const NAMES = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', Slash: '/' };
  const keyName = c => !c ? '—' : NAMES[c] || c.replace(/^Key/, '').replace(/^Digit/, '');
  window.CT_KEYNAME = keyName;

  /* keys: [{ code, label, row, col, w }] — row/col in key units. opts: { title, corner, visible } */
  window.CT_KEYPAD = function (root, keys, opts) {
    opts = opts || {};
    const U = 46, G = 4;
    const main = keys.filter(k => !k.more), extra = keys.filter(k => k.more);
    const dims = list => ({ w: list.length ? Math.max(...list.map(k => k.col + (k.w || 1))) * U - G : 0, h: list.length ? Math.max(...list.map(k => k.row + 1)) * U - G : 0 });
    const el = document.createElement('div');
    el.className = 'keypad'; el.setAttribute('aria-label', 'Keyboard controls');
    const dm = dims(main), dx = dims(extra);
    el.innerHTML = `<div class="kp-head"><span>${opts.title || 'Controls'}</span>${extra.length ? '<button type="button" class="kp-more" aria-expanded="false">More keys ▸</button>' : ''}<span class="kp-hide">K hide</span></div>
      <div class="kp-grid" data-g="main" style="width:${dm.w}px;height:${dm.h}px"></div>
      ${extra.length ? `<div class="kp-sub">More controls</div><div class="kp-grid kp-extra" data-g="more" style="width:${dx.w}px;height:${dx.h}px"></div>` : ''}
      <div class="kp-now"><span class="muted">Pressing:</span> <b>nothing</b></div>`;
    const now = el.querySelector('.kp-now b');
    const nodes = {};
    const releases = [];
    const releaseAll = () => releases.forEach(release => release());
    const releasePointer = e => releases.forEach(release => release(e));
    const onVisibility = () => { if (document.hidden) releaseAll(); };
    keys.forEach(k => {
      const grid = el.querySelector(`.kp-grid[data-g="${k.more ? 'more' : 'main'}"]`);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kp-key'; b.dataset.code = k.code; b.tabIndex = -1;
      b.style.cssText = `left:${k.col * U}px;top:${k.row * U}px;width:${(k.w || 1) * U - G}px;height:${U - G}px`;
      b.innerHTML = `<b>${k.cap || keyName(k.code)}</b><small>${k.label}</small>`;
      b.setAttribute('aria-label', `${k.cap || keyName(k.code)}: ${k.label}`);
      const fire = type => window.dispatchEvent(new KeyboardEvent(type, { code: k.code, key: k.key || k.code, bubbles: true }));
      let held = false, pointerId;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (held || (e.button != null && e.button !== 0)) return; held = true; pointerId = e.pointerId; try { b.setPointerCapture && b.setPointerCapture(e.pointerId); } catch (_) { } fire('keydown'); });
      const up = e => { if (!held || (e && e.pointerId !== pointerId)) return; held = false; pointerId = undefined; fire('keyup'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      releases.push(up);
      grid.appendChild(b); nodes[k.code] = { b, k, up };
    });
    window.addEventListener('blur', releaseAll);
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    document.addEventListener('visibilitychange', onVisibility);
    el.addEventListener('mousedown', e => e.stopPropagation());
    let more = false; try { more = localStorage.getItem('contrail.kpMore') === '1'; } catch (e) { }
    const setMore = v => { more = v; if (!more) Object.values(nodes).forEach(n => { if (n.k.more) n.up(); }); el.classList.toggle('kp-open', more); const mb = el.querySelector('.kp-more'); if (mb) { mb.setAttribute('aria-expanded', more); mb.textContent = more ? 'Fewer keys ▾' : 'More keys ▸'; } try { localStorage.setItem('contrail.kpMore', more ? '1' : '0'); } catch (e) { } };
    const mb = el.querySelector('.kp-more'); if (mb) mb.addEventListener('click', e => { e.stopPropagation(); setMore(!more); });
    setMore(more);
    root.appendChild(el);
    let visible = opts.visible !== false; el.style.display = visible ? '' : 'none';
    let lastSig = '';
    return {
      el,
      update(pressed, suggest, active) {
        if (!visible) return;
        const sug = new Set(suggest || []), act = active || {}; const on = [];
        let sig = '';
        for (const code in nodes) { const d = !!pressed[code], h = sug.has(code) && !d, a = !!act[code]; sig += (d ? 1 : 0) + '' + (h ? 1 : 0) + (a ? 1 : 0); if (d) on.push(nodes[code].k.label); }
        if (sig === lastSig) return; lastSig = sig;
        for (const code in nodes) { const n = nodes[code]; n.b.classList.toggle('down', !!pressed[code]); n.b.classList.toggle('hint', sug.has(code) && !pressed[code]); n.b.classList.toggle('active', !!act[code]); }
        now.textContent = on.length ? on.join(' + ') : 'nothing';
      },
      setMore, toggle(v) { visible = v === undefined ? !visible : v; if (!visible) releaseAll(); el.style.display = visible ? '' : 'none'; lastSig = ''; return visible; },
      get visible() { return visible; },
      dispose() { releaseAll(); window.removeEventListener('blur', releaseAll); window.removeEventListener('pointerup', releasePointer); window.removeEventListener('pointercancel', releasePointer); document.removeEventListener('visibilitychange', onVisibility); el.remove(); }
    };
  };
})();
