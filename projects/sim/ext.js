/* CONTRAIL — in-flight extensions: AI traffic, quick menu (failures / environment / slew / teleport),
   ILS guidance, flight recorder + replay, autosave for "Resume flight". Hooks into sim.js via window.CT_EXT. */
(function () {
  const KT = 1.943844, FT = 3.28084, FPM = 196.8504, DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  window.CT_EXT = window.CT_EXT || [];

  /* ---------- AI traffic ---------- */
  window.CT_EXT.push(function traffic(S, T) {
    const n = S.st.aiTraffic === false ? 0 : (S.st.trafficDensity ?? 4);
    if (!n) return null;
    const D = window.CT_DATA, pool = D.AIRCRAFT.filter(a => ['Airliner', 'Business', 'General Aviation'].includes(a.cat));
    const planes = [];
    const L = S.rwyLen, dir = new T.Vector3(S.terrain.dir.x, 0, S.terrain.dir.z);
    for (let i = 0; i < n; i++) {
      const ac = pool[(i * 7 + 3) % pool.length], lvs = D.liverySetFor(ac), lv = lvs[(i * 3) % lvs.length];
      const m = window.CT_SIM.buildAircraftMesh(ac, lv.c); m.gear.visible = false; S.scene.add(m.group);
      planes.push({ ac, m, phase: (i / n) * Math.PI * 2, r: 6000 + i * 1800, alt: 600 + i * 450, spd: 70 + (i % 3) * 25, kind: i % 2 ? 'circuit' : 'cross' });
    }
    // one parked aircraft on the apron per two traffic planes
    const parked = [];
    for (let i = 0; i < Math.ceil(n / 2); i++) {
      const ac = pool[(i * 5) % pool.length], lv = D.liverySetFor(ac)[(i + 1) % D.liverySetFor(ac).length];
      const m = window.CT_SIM.buildAircraftMesh(ac, lv.c);
      const side = new T.Vector3(S.terrain.perp.x, 0, S.terrain.perp.z);
      const pos = side.clone().multiplyScalar(S.rwyW / 2 + 260 + (i % 2) * 70).addScaledVector(dir, (i - n / 4) * 90);
      m.group.position.set(pos.x, -m.bottom + .2, pos.z); m.group.rotation.y = -S.hdg + Math.PI / 2; S.scene.add(m.group); parked.push(m);
    }
    const labels = document.createElement('div'); labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    S.root.appendChild(labels);
    planes.forEach(p => { const l = document.createElement('div'); l.className = 'mono'; l.style.cssText = 'position:absolute;font-size:11px;color:#57C7DB;text-shadow:0 1px 3px #000;white-space:nowrap;transform:translate(-50%,-140%)'; labels.appendChild(l); p.label = l; });
    return {
      frame(dt, paused) {
        const w = S.hud.width / S.hdpr, h = S.hud.height / S.hdpr;
        planes.forEach(p => {
          if (!paused) p.phase += p.spd / p.r * dt * S.timeScale;
          let x, z, y, hd;
          if (p.kind === 'circuit') { x = Math.cos(p.phase) * p.r; z = Math.sin(p.phase) * p.r * .6; hd = Math.atan2(-Math.sin(p.phase) * p.r, Math.cos(p.phase) * p.r * .6); }
          else { const t = ((p.phase / (Math.PI * 2)) % 1) * 2 - 1; x = t * 30000; z = p.r - 15000; hd = Math.PI / 2; }
          y = p.alt + Math.max(0, S.terrain.h(x, z)) * .0 + Math.max(0, S.groundAt(x, z));
          p.m.group.position.set(x, y, z);
          p.m.group.rotation.set(0, -hd, p.kind === 'circuit' ? -.35 : 0, 'YXZ');
          p.m.props.forEach(q => q.rotation.z += 40 * dt);
          const d = S.s.p.distanceTo(p.m.group.position);
          const v = p.m.group.position.clone().project(S.camera);
          const show = S.st.trafficLabels !== false && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && d < 25000 && S.hudOn;
          p.label.style.display = show ? '' : 'none';
          if (show) { p.label.style.left = ((v.x * .5 + .5) * w) + 'px'; p.label.style.top = ((-v.y * .5 + .5) * h) + 'px'; p.label.textContent = `${p.ac.id.toUpperCase()} ${(d / 1852).toFixed(1)}nm ${Math.round((y + S.elevM) * FT / 100) * 100}ft`; }
          if (d < Math.max(20, S.model.span * .6) && !S.ended && (S.st.realism || {}).crashes !== false) S.crash('Mid-air collision with ' + p.ac.name);
        });
      },
      dispose() { labels.remove(); },
      planes
    };
  });

  /* ---------- ILS guidance ---------- */
  window.CT_EXT.push(function ils(S, T) {
    const box = document.createElement('div'); box.className = 'fpanel'; box.id = 'fl-ils';
    box.style.cssText = 'left:16px;top:50%;transform:translateY(-50%);width:150px;display:none;flex-direction:column;gap:6px;align-items:center';
    box.innerHTML = '<span class="muted" style="font-size:11px;letter-spacing:.08em">ILS</span><canvas width="260" height="260" style="width:130px;height:130px"></canvas><span id="fl-ilsd" style="font-size:12px"></span>';
    S.root.appendChild(box);
    const c = box.querySelector('canvas').getContext('2d'), info = box.querySelector('#fl-ilsd');
    return {
      frame() {
        const s = S.s, d = S.terrain.dir, pp = S.terrain.perp, L = S.rwyLen;
        const along = s.p.x * d.x + s.p.z * d.z, lat = s.p.x * pp.x + s.p.z * pp.z;
        const thr = -L / 2 + 300, dist = thr - along; // m before touchdown point
        const on = S.st.ils !== false && dist > 200 && dist < 30000 && Math.abs(lat) < dist * .35 && !s.onGround && !S.elecFail && S.hudOn;
        box.style.display = on ? 'flex' : 'none'; if (!on) return;
        const locDev = Math.atan2(lat, dist) / DEG / 2.5, gsDev = (Math.atan2(s.p.y, dist) / DEG - 3) / .7; // dots
        c.clearRect(0, 0, 260, 260); c.strokeStyle = '#394655'; c.lineWidth = 2; c.strokeRect(20, 20, 220, 220);
        c.fillStyle = '#7B8999'; for (let i = -2; i <= 2; i++) { if (!i) continue; c.beginPath(); c.arc(130 + i * 44, 130, 5, 0, 7); c.fill(); c.beginPath(); c.arc(130, 130 + i * 44, 5, 0, 7); c.fill(); }
        c.strokeStyle = '#E6EBF0'; c.beginPath(); c.moveTo(100, 130); c.lineTo(160, 130); c.moveTo(130, 100); c.lineTo(130, 160); c.stroke();
        c.lineWidth = 5; c.strokeStyle = '#F5B942';
        const lx = 130 - clamp(locDev, -2.5, 2.5) * 44, gy = 130 + clamp(gsDev, -2.5, 2.5) * 44;
        c.beginPath(); c.moveTo(lx, 25); c.lineTo(lx, 235); c.stroke();
        c.strokeStyle = '#57C7DB'; c.beginPath(); c.moveTo(25, gy); c.lineTo(235, gy); c.stroke();
        info.innerHTML = `DME <b class="cyan">${(dist / 1852).toFixed(1)}</b> · ${S.cfg.runway.id}`;
      },
      dispose() { box.remove(); }
    };
  });

  /* ---------- Quick menu: failures, environment, slew, teleport, autopilot ---------- */
  window.CT_EXT.push(function quick(S, T) {
    const st = S.st;
    const panel = document.createElement('div'); panel.className = 'overlay'; panel.id = 'fl-quick';
    panel.style.justifyContent = 'flex-end'; panel.style.background = 'rgba(5,7,10,.35)';
    S.root.appendChild(panel);
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn sec sm'; btn.id = 'fl-qbtn';
    btn.style.cssText = 'position:absolute;right:16px;top:200px;z-index:4'; btn.textContent = 'Menu (Tab)';
    S.root.appendChild(btn);
    let open = false, slew = false, ap = null;
    const sw = (id, label, on) => `<div class="row" style="padding:6px 0;min-height:40px"><span class="lbl">${label}</span><span class="ctl"><button class="switch" type="button" role="switch" aria-checked="${!!on}" data-q="${id}" aria-label="${label}"></button></span></div>`;
    const rng = (id, label, min, max, step, val, unit) => `<div class="row" style="padding:6px 0;min-height:40px"><label class="lbl" for="${id}">${label}</label><span class="ctl"><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="width:140px"><span class="val" id="${id}-v">${val}${unit}</span></span></div>`;
    function render() {
      const w = S.wx, wd = S.windBase, wsp = Math.round(wd.length() * KT);
      panel.innerHTML = `<div class="card" style="width:min(400px,94vw);height:100%;max-height:none;border-radius:0;overflow:auto;gap:12px">
        <div class="titlerow"><h2>Flight menu</h2><span class="r"><button class="ibtn" type="button" data-q="close" aria-label="Close">✕</button></span></div>
        <span class="eyebrow">Autopilot</span>
        <div class="seg">${[['off', 'Off'], ['lvl', 'Wing leveller'], ['alt', 'Alt + Hdg hold']].map(([k, l]) => `<button type="button" data-ap="${k}" aria-pressed="${(ap ? ap.mode : 'off') === k}">${l}</button>`).join('')}</div>
        <span class="eyebrow">Failures</span>
        ${sw('engMul', 'Engine failure', S.engMul < 1)}${sw('gearJam', 'Landing gear jammed', S.gearJam)}${sw('flapJam', 'Flaps jammed', S.flapJam)}${sw('elecFail', 'Electrical failure (HUD & nav)', S.elecFail)}
        <button class="btn sec sm" type="button" data-q="randfail">Random failure in the next 2 min</button>
        <span class="eyebrow">Environment</span>
        ${rng('q-tod', 'Time of day', 0, 24, .25, S.hour, ' h')}
        ${rng('q-wind', 'Wind speed', 0, 50, 1, wsp, ' kt')}
        ${rng('q-turb', 'Turbulence', 0, 100, 5, Math.round(S.turb * 100), ' %')}
        <span class="eyebrow">Position</span>
        <div class="hstack"><button class="btn sec sm" type="button" data-q="tp-final">6 nm final</button><button class="btn sec sm" type="button" data-q="tp-down">Downwind</button><button class="btn sec sm" type="button" data-q="tp-rwy">Runway</button><button class="btn sec sm" type="button" data-q="tp-high">10,000 ft</button></div>
        ${sw('slew', 'Slew mode (move freely: WASD, Space/Shift up/down)', slew)}
        <span class="eyebrow">Recorder</span>
        <div class="hstack"><button class="btn sec sm" type="button" data-q="replay">Instant replay (last 30 s)</button><button class="btn sec sm" type="button" data-q="save">Save &amp; exit</button></div>
        <p class="muted" style="margin:0;font-size:12px">Tab toggles this menu. The simulation keeps running while it is open.</p>
      </div>`;
      panel.querySelectorAll('[data-q]').forEach(b => b.onclick = () => act(b.dataset.q, b));
      panel.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => setAP(b.dataset.ap));
      const bind = (id, fn, unit) => { const i = panel.querySelector('#' + id); i.oninput = () => { panel.querySelector('#' + id + '-v').textContent = i.value + unit; fn(+i.value); }; };
      bind('q-tod', v => S.setTime(v), ' h');
      bind('q-wind', v => { const l = S.windBase.length() || 1; if (S.windBase.length() < .01) S.windBase.set(0, 0, 1); S.windBase.multiplyScalar(v / KT / (S.windBase.length() || 1)); }, ' kt');
      bind('q-turb', v => S.turb = v / 100, ' %');
    }
    function toggle(v) { open = v === undefined ? !open : v; panel.classList.toggle('on', open); if (open) render(); }
    function act(a, b) {
      const s = S.s, d = new T.Vector3(S.terrain.dir.x, 0, S.terrain.dir.z), pp = new T.Vector3(S.terrain.perp.x, 0, S.terrain.perp.z), L = S.rwyLen;
      if (a === 'close') return toggle(false);
      if (['engMul', 'gearJam', 'flapJam', 'elecFail', 'slew'].includes(a)) {
        const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', on);
        if (a === 'engMul') S.engMul = on ? (S.ac.nEng >= 2 ? .5 : 0) : 1; else if (a === 'slew') { slew = on; if (on) { s.v.set(0, 0, 0); } } else S[a] = on;
        if (on && a !== 'slew') S.message({ engMul: S.ac.nEng >= 2 ? 'Engine failure — one engine out' : 'Engine failure', gearJam: 'Gear jammed', flapJam: 'Flaps jammed', elecFail: 'Electrical failure' }[a], 2.5);
        return;
      }
      if (a === 'randfail') { const t = 10 + Math.random() * 110; S._failAt = s.t + t; S.message('A random failure is armed', 2); return; }
      if (a === 'replay') { toggle(false); rec && rec.replay(); return; }
      if (a === 'save') { saveSnapshot(S); S.message('Flight saved', 1.5); setTimeout(() => S.menu('exit'), 300); return; }
      const vapp = S.vref() * 1.25;
      const place = (pos, vel, hdg, gearDown, flaps) => { if (S.ended === 'crashed') return; S.ended = false; S.endShown = false; s.crashed = false; S.root.querySelector('#fl-end').classList.remove('on'); s.p.copy(pos); s.v.copy(vel); S.setAttitude(hdg, 1 * DEG, 0); s.onGround = false; s.airborne = true; s.gear = s.gearT = gearDown ? 1 : (S.retract ? 0 : 1); s.flaps = s.flapsT = flaps; S.camSmooth = null; if (S.smoke) { S.scene.remove(S.smoke); S.smoke = null; } if (S.fire) { S.scene.remove(S.fire); S.fire = null; } };
      if (a === 'tp-final') { const dd = 11100; const pos = d.clone().multiplyScalar(-L / 2 + 300 - dd); pos.y = dd * Math.tan(3 * DEG) + 15; place(pos, d.clone().multiplyScalar(vapp).setY(-vapp * .052), S.hdg, true, S.fm.flapCl > .3 ? 1 : .5); s.thr = S.trimThrottle(vapp, s.flaps, 1); }
      if (a === 'tp-down') { const pos = d.clone().multiplyScalar(0).addScaledVector(pp, -2800); pos.y = 300 + Math.max(0, S.groundAt(pos.x, pos.z)); place(pos, d.clone().multiplyScalar(-vapp * 1.2), S.hdg + Math.PI, false, .25); s.thr = S.trimThrottle(vapp * 1.2, .25, 0); }
      if (a === 'tp-rwy') { S.reset(); S.ended = false; }
      if (a === 'tp-high') { const pos = s.p.clone(); pos.y = 3048 - S.elevM; const sp = Math.max(vapp * 1.8, Math.min(S.fm.vne * .6, 220)); place(pos, S.attitude().f.setY(0).normalize().multiplyScalar(sp), S.attitude().heading, false, 0); s.thr = S.trimThrottle(sp, 0, 0); }
      S.message('Repositioned', 1.2);
    }
    function setAP(mode) {
      if (mode === 'off') ap = null; else { const a = S.attitude(); ap = { mode, alt: S.s.p.y, hdg: a.heading }; }
      S.message(mode === 'off' ? 'Autopilot off' : mode === 'lvl' ? 'Wing leveller on' : `Holding ${Math.round((S.s.p.y + S.elevM) * FT)} ft, heading ${String(Math.round(((ap.hdg / DEG) + 360) % 360)).padStart(3, '0')}`, 2);
      if (open) render();
    }
    btn.onclick = () => toggle();
    return {
      key(e) {
        if (e.code === 'Tab') { toggle(); return true; }
        if (e.code === 'KeyZ' && !e.repeat) { setAP(ap ? 'off' : 'alt'); return true; }
        return false;
      },
      escape() { if (open) { toggle(false); return true; } if (rec && rec.playing) { rec.stop(); return true; } return false; },
      frame(dt, paused) {
        const s = S.s;
        if (S._failAt && s.t > S._failAt) { S._failAt = 0; const f = ['engMul', 'gearJam', 'flapJam', 'elecFail'][Math.floor(Math.random() * 4)]; if (f === 'engMul') S.engMul = S.ac.nEng >= 2 ? .5 : 0; else S[f] = true; S.message({ engMul: 'ENGINE FAILURE', gearJam: 'GEAR FAILURE', flapJam: 'FLAP FAILURE', elecFail: 'ELECTRICAL FAILURE' }[f], 3); S.audio && S.audio.beep(660, .6, .3); }
        if (paused) return;
        if (slew) {
          const k = S.keys, kb = S.kb, a = S.attitude(), sp = (k.ShiftLeft ? 400 : 80) * dt;
          const f = a.f.clone().setY(0).normalize(), r = a.r.clone().setY(0).normalize();
          if (k[kb.throttleUp]) s.p.addScaledVector(f, sp); if (k[kb.throttleDown]) s.p.addScaledVector(f, -sp);
          if (k[kb.rollRight]) s.p.addScaledVector(r, sp); if (k[kb.rollLeft]) s.p.addScaledVector(r, -sp);
          if (k[kb.climb]) s.p.y += sp; if (k[kb.descend]) s.p.y = Math.max(S.groundAt(s.p.x, s.p.z) + S.gearH, s.p.y - sp);
          s.v.set(0, 0, 0); S.ctl = { pitch: 0, roll: 0, yaw: 0 };
        }
        if (ap && !S.ended) {
          const a = S.attitude(), c = S.ctl;
          if (Math.abs(c.pitch) > .3 || Math.abs(c.roll) > .3) { setAP('off'); return; }
          let tBank = 0;
          if (ap.mode === 'alt') {
            let dh = ap.hdg - a.heading; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
            tBank = clamp(dh * 1.5, -.45, .45);
            const tvs = clamp((ap.alt - s.p.y) * .1, -8, 8), dvs = tvs - s.v.y;
            const tPitch = clamp(a.pitch + dvs * .01, -.2, .25);
            const dq = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), clamp((tPitch - a.pitch) * 1.2, -.15, .15) * dt);
            s.q.multiply(dq);
          }
          const rq = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), clamp((a.bank - tBank) * 1.5, -.4, .4) * dt);
          s.q.multiply(rq).normalize();
        }
      },
      dispose() { panel.remove(); btn.remove(); },
      get ap() { return ap; }, setAP
    };
  });


  /* ---------- Controls help overlay (F1 / ?) ---------- */
  const kn = c => !c ? '—' : c.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ControlLeft', 'Ctrl').replace('Arrow', '').replace('Slash', '/').replace('Space', 'Space');
  window.CT_KEYNAME = kn;
  window.CT_EXT.push(function help(S) {
    const kb = S.kb, heli = !!S.fm.heli;
    const el = document.createElement('div'); el.className = 'overlay'; el.id = 'fl-help';
    const k = c => `<kbd>${kn(c)}</kbd>`;
    const rows = heli
      ? [[k(kb.throttleUp) + k(kb.throttleDown), 'Tilt forward / back (move)'], [k(kb.rollLeft) + k(kb.rollRight), 'Tilt left / right'], [k(kb.climb), 'Go up (collective)'], [k(kb.descend), 'Go down'], [k(kb.yawLeft) + k(kb.yawRight), 'Turn on the spot (pedals)']]
      : [[k(kb.throttleUp), 'Speed up'], [k(kb.throttleDown), 'Slow down'], [k(kb.rollLeft) + k(kb.rollRight), 'Turn left / right'], [k(kb.climb), 'Go up (nose up)'], [k(kb.descend), 'Go down (nose down)'], [k(kb.brakes), 'Brake (hold, on the ground)']];
    if (S.st.autoSystems === false) rows.push([k(kb.flapsDown) + k(kb.flapsUp), 'Flaps out / in'], [k(kb.gear), 'Landing gear'], [k(kb.yawLeft) + k(kb.yawRight), 'Rudder']);
    rows.push([k(kb.camera), 'Change camera'], ['<kbd>Z</kbd>', 'Autopilot'], ['<kbd>Tab</kbd>', 'Flight menu'], ['<kbd>K</kbd>', 'Show/hide the on-screen keyboard'], ['<kbd>Esc</kbd>', 'Pause']);
    el.innerHTML = `<div class="card"><div class="titlerow"><h2>Controls · ${heli ? 'Helicopter' : 'Aeroplane'}</h2><span class="r"><button class="ibtn" type="button" data-x aria-label="Close">✕</button></span></div>
      <div>${rows.map(r => `<div class="row" style="padding:6px 0;min-height:40px"><span class="lbl">${r[1]}</span><span class="ctl" style="gap:4px">${r[0]}</span></div>`).join('')}</div>
      <p class="muted" style="margin:0;font-size:13px">Press F1 or ? any time to show this again. Change keys in Settings → Controls.</p></div>`;
    S.root.appendChild(el);
    const show = v => { el.classList.toggle('on', v); S.paused = v || S.root.querySelector('#fl-pause').classList.contains('on'); };
    el.querySelector('[data-x]').onclick = () => show(false);
    el.onclick = e => { if (e.target === el) show(false); };
    if (S.st.helpShown !== true && !S.cfg.resume) { show(true); S.st.helpShown = true; try { const st = JSON.parse(localStorage.getItem('contrail.v1') || '{}'); st.settings = st.settings || {}; st.settings.helpShown = true; localStorage.setItem('contrail.v1', JSON.stringify(st)); } catch (e) { } }
    return {
      always: true,
      key(e) { if (e.code === 'F1' || e.key === '?') { show(!el.classList.contains('on')); return true; } return false; },
      escape() { if (el.classList.contains('on')) { show(false); return true; } return false; },
      dispose() { el.remove(); }
    };
  });

  /* ---------- Interactive training flight ---------- */
  window.CT_EXT.push(function tutorial(S) {
    if (!S.cfg.tutorial) return null;
    const kb = S.kb, k = c => `<kbd>${kn(c)}</kbd>`, FTm = 3.28084, KTm = 1.943844;
    const heli = !!S.fm.heli;
    const steps = heli ? [
      { t: `Hold ${k(kb.climb)} to raise the collective and lift off.`, ok: s => s.agl * FTm > 10 },
      { t: `Keep climbing to 100 ft with ${k(kb.climb)}. Tap ${k(kb.descend)} if you go too fast.`, ok: s => s.agl * FTm > 100 },
      { t: `Tilt forward with ${k(kb.throttleUp)} to fly forward. Reach 30 kt.`, ok: s => Math.hypot(s.v.x, s.v.z) * KTm > 30 },
      { t: `Turn with ${k(kb.rollLeft)} or ${k(kb.rollRight)}. Change heading by 90°.`, ok: (s, S) => S._tutTurn() > 80 },
      { t: `Slow down with ${k(kb.throttleDown)} and lower the collective with ${k(kb.descend)} to land gently.`, ok: s => s.onGround && Math.hypot(s.v.x, s.v.z) < 3 }
    ] : [
      { t: `Hold ${k(kb.throttleUp)} to push the throttle to 100%.`, ok: s => s.thr > .95 },
      { t: `Keep straight with ${k(kb.rollLeft)} / ${k(kb.rollRight)}. At 55 kt hold ${k(kb.climb)} to lift off.`, ok: s => !s.onGround && s.agl * FTm > 20 },
      { t: `Climb to 400 ft. Hold ${k(kb.climb)} gently — don't let the nose go too high or you will stall.`, ok: s => s.agl * FTm > 400 },
      { t: `Level off with ${k(kb.descend)}, then turn with ${k(kb.rollLeft)} or ${k(kb.rollRight)}. Change heading by 90°.`, ok: (s, S) => S._tutTurn() > 80 },
      { t: `Press ${k(kb.camera)} to try a different camera view.`, ok: (s, S) => S.camMode !== S._tutCam },
      { t: `Press <kbd>Tab</kbd> to open the flight menu, then close it again.`, ok: (s, S) => S._tutMenu },
      { t: `Reduce speed with ${k(kb.throttleDown)} and descend with ${k(kb.descend)}. Get below 200 ft.`, ok: s => s.agl * FTm < 200 && !s.onGround },
      { t: `Land! Flatten out just before touching down (tap ${k(kb.climb)}), then hold ${k(kb.brakes)} to stop.`, ok: s => s.onGround && s.ias * KTm < 5 }
    ];
    let i = 0, h0 = null;
    S._tutCam = S.camMode; S._tutMenu = false;
    S._tutTurn = () => { const h = S.attitude().heading / DEG; if (h0 === null) h0 = h; let d = Math.abs(h - h0) % 360; return d > 180 ? 360 - d : d; };
    const box = document.createElement('div'); box.className = 'fpanel'; box.id = 'fl-tut';
    box.style.cssText = 'left:50%;top:90px;transform:translateX(-50%);max-width:560px;font-family:Barlow,sans-serif;font-size:16px;display:flex;flex-direction:column;gap:6px;pointer-events:auto;border-color:rgba(245,185,66,.5)';
    S.root.appendChild(box);
    const draw = () => { box.innerHTML = i < steps.length ? `<span class="eyebrow">Training · step ${i + 1} of ${steps.length}</span><span>${steps[i].t}</span><div class="hstack" style="justify-content:space-between"><div class="meter" style="flex:1"><i style="width:${i / steps.length * 100}%;background:var(--amber)"></i></div><button class="btn ghost sm" type="button" id="fl-tutskip">Skip step (Enter)</button></div>` : `<span class="eyebrow green">Training complete</span><span>Great flying! You know the basics. Press <kbd>Esc</kbd> to exit or keep flying.</span>`; };
    const skip = () => { if (i < steps.length) { i++; h0 = null; S._tutCam = S.camMode; draw(); bindSkip(); } };
    const bindSkip = () => { const b = box.querySelector('#fl-tutskip'); if (b) b.onclick = skip; };
    draw(); bindSkip();
    return {
      key(e) { if (e.code === 'Enter' || e.code === 'NumpadEnter') { skip(); return true; } return false; },
      frame() {
        if (i >= steps.length || S.ended === 'crashed') return;
        if (document.querySelector('#fl-quick.on')) S._tutMenu = true;
        if (S._tutMenu === true && !document.querySelector('#fl-quick.on') && steps[i].t.includes('Tab')) S._tutMenu = 'done';
        const st = steps[i]; const okv = st.t.includes('Tab') ? S._tutMenu === 'done' : st.ok(S.s, S);
        if (okv) { i++; h0 = null; S._tutCam = S.camMode; S.audio && S.audio.beep(880, .2); if (i === steps.length && S.mission) S.finish('landed', 'Training complete', 1000); draw(); bindSkip(); }
      },
      reset() { i = 0; h0 = null; S._tutMenu = false; draw(); bindSkip(); },
      dispose() { box.remove(); },
      get step() { return i; }
    };
  });



  /* ---------- Landing lights + smoke trail ---------- */
  window.CT_EXT.push(function lightsSmoke(S, T) {
    const L = S.model.length, lamp = new T.SpotLight(0xfff4d8, 0, 900, .35, .5, 1.2);
    lamp.position.set(0, 0, -L * .3); const tgt = new T.Object3D(); tgt.position.set(0, -8, -L * .3 - 100);
    S.model.group.add(lamp, tgt); lamp.target = tgt;
    const glow = new T.Mesh(new T.SphereGeometry(.35 * (S.ac.scale || 1), 8, 6), new T.MeshBasicMaterial({ color: 0xfff4d8 })); glow.position.copy(lamp.position); glow.visible = false; S.model.group.add(glow);
    const MAX = 400, pos = new Float32Array(MAX * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setDrawRange(0, 0);
    const pts = new T.Points(geo, new T.PointsMaterial({ color: 0xffffff, size: 6, transparent: true, opacity: .55, depthWrite: false }));
    pts.frustumCulled = false; S.scene.add(pts);
    let n = 0, head = 0, acc = 0, colIdx = 0; const cols = [0xffffff, 0xff5040, 0x4080ff, 0x5BD68A, 0xF5B942];
    S.lightsOn = S.night; lamp.intensity = S.lightsOn ? 300 : 0; glow.visible = !!S.lightsOn;
    return {
      key(e) {
        if (e.repeat) return false;
        if (e.code === 'KeyL') { S.lightsOn = !S.lightsOn; lamp.intensity = S.lightsOn ? 300 : 0; glow.visible = S.lightsOn; S.message(S.lightsOn ? 'Landing lights on' : 'Landing lights off', 1.2); return true; }
        if (e.code === 'KeyN') { if (!S.smokeOn) { S.smokeOn = true; } else { colIdx++; if (colIdx >= cols.length) { S.smokeOn = false; colIdx = 0; } } pts.material.color.set(cols[colIdx]); S.message(S.smokeOn ? 'Smoke on — press N to change colour' : 'Smoke off', 1.4); return true; }
        return false;
      },
      frame(dt, paused) {
        if (paused || !S.smokeOn) return;
        acc += dt; if (acc < .04) return; acc = 0;
        const back = S.s.p.clone().addScaledVector(S.attitude().f, -L * .55);
        pos[head * 3] = back.x; pos[head * 3 + 1] = back.y; pos[head * 3 + 2] = back.z;
        head = (head + 1) % MAX; n = Math.min(MAX, n + 1); geo.setDrawRange(0, n); geo.attributes.position.needsUpdate = true;
      },
      reset() { n = 0; head = 0; geo.setDrawRange(0, 0); },
      dispose() { S.scene.remove(pts); geo.dispose(); }
    };
  });

  /* ---------- On-screen keyboard (flight) ---------- */
  window.CT_EXT.push(function keypadExt(S) {
    if (!window.CT_KEYPAD || S.st.keypad === false) return null;
    const kb = S.kb, heli = !!S.fm.heli;
    const keys = heli ? [
      { code: kb.yawLeft, label: 'spin L', row: 0, col: 0 }, { code: kb.throttleUp, label: 'forward', row: 0, col: 1 }, { code: kb.yawRight, label: 'spin R', row: 0, col: 2 },
      { code: kb.rollLeft, label: 'left', row: 1, col: 0 }, { code: kb.throttleDown, label: 'back', row: 1, col: 1 }, { code: kb.rollRight, label: 'right', row: 1, col: 2 },
      { code: kb.descend, label: 'down', row: 2, col: 0, w: 1.5 }, { code: kb.climb, label: 'up', row: 2, col: 1.5, w: 1.5 },
      { code: kb.camera, label: 'camera', row: 0, col: 3.3 }, { code: 'KeyZ', label: 'autopilot', row: 1, col: 3.3 }, { code: 'Escape', label: 'pause', row: 2, col: 3.3 }
    ] : [
      { code: kb.yawLeft, label: 'rudder', row: 0, col: 0 }, { code: kb.throttleUp, label: 'faster', row: 0, col: 1 }, { code: kb.yawRight, label: 'rudder', row: 0, col: 2 },
      { code: kb.rollLeft, label: 'left', row: 1, col: 0 }, { code: kb.throttleDown, label: 'slower', row: 1, col: 1 }, { code: kb.rollRight, label: 'right', row: 1, col: 2 },
      { code: kb.descend, label: 'go down', row: 2, col: 0, w: 1.5 }, { code: kb.climb, label: 'go up', row: 2, col: 1.5, w: 1.5 },
      { code: kb.brakes, label: 'brake', row: 0, col: 3.3 }, { code: kb.camera, label: 'camera', row: 1, col: 3.3 }, { code: 'Escape', label: 'pause', row: 2, col: 3.3 }
    ];
    const more = heli ? [
      { code: 'KeyL', label: 'lights', row: 0, col: 0, more: 1 }, { code: 'KeyN', label: 'smoke', row: 0, col: 1, more: 1 }, { code: kb.hud, label: 'HUD', row: 0, col: 2, more: 1 }, { code: 'KeyM', label: 'map', row: 0, col: 3, more: 1 },
      { code: kb.lookBack, label: 'look back', row: 1, col: 0, more: 1 }, { code: kb.timeAccel, label: 'sim ×2', row: 1, col: 1, more: 1 }, { code: 'Tab', label: 'menu', row: 1, col: 2, more: 1 }, { code: 'F1', label: 'help', row: 1, col: 3, more: 1 },
      { code: 'Digit1', label: 'cockpit', row: 2, col: 0, more: 1 }, { code: 'Digit2', label: 'chase', row: 2, col: 1, more: 1 }, { code: 'Digit3', label: 'orbit', row: 2, col: 2, more: 1 }, { code: 'Digit4', label: 'tower', row: 2, col: 3, more: 1 }
    ] : [
      { code: kb.gear, label: 'gear', row: 0, col: 0, more: 1 }, { code: kb.flapsDown, label: 'flaps +', row: 0, col: 1, more: 1 }, { code: kb.flapsUp, label: 'flaps −', row: 0, col: 2, more: 1 }, { code: kb.spoilers, label: 'air brake', row: 0, col: 3, more: 1 },
      { code: 'KeyZ', label: 'autopilot', row: 1, col: 0, more: 1 }, { code: 'KeyL', label: 'lights', row: 1, col: 1, more: 1 }, { code: 'KeyN', label: 'smoke', row: 1, col: 2, more: 1 }, { code: kb.hud, label: 'HUD', row: 1, col: 3, more: 1 },
      { code: 'BracketLeft', cap: '[', label: 'trim dn', row: 2, col: 0, more: 1 }, { code: 'BracketRight', cap: ']', label: 'trim up', row: 2, col: 1, more: 1 }, { code: kb.lookBack, label: 'look back', row: 2, col: 2, more: 1 }, { code: kb.timeAccel, label: 'sim ×2', row: 2, col: 3, more: 1 },
      { code: 'Digit1', label: 'cockpit', row: 3, col: 0, more: 1 }, { code: 'Digit2', label: 'chase', row: 3, col: 1, more: 1 }, { code: 'Digit3', label: 'orbit', row: 3, col: 2, more: 1 }, { code: 'Digit4', label: 'tower', row: 3, col: 3, more: 1 },
      { code: 'KeyM', label: 'map', row: 4, col: 0, more: 1 }, { code: 'Tab', label: 'menu', row: 4, col: 1, more: 1 }, { code: 'F1', label: 'help', row: 4, col: 2, more: 1 }, { code: kb.pause, label: 'pause', row: 4, col: 3, more: 1 }
    ];
    const pad = window.CT_KEYPAD(S.root, keys.concat(more), { title: heli ? 'Helicopter keys' : 'Flight keys' });
    S.activeKeys = () => { const o = {}, st = S.s, ap = (S.ext || []).find(x => x.ap !== undefined); o[kb.gear] = S.retract && st.gearT > .5; o[kb.flapsDown] = st.flapsT > 0; o[kb.spoilers] = !!st.spoiler; o.KeyZ = !!(ap && ap.ap); o.KeyL = !!S.lightsOn; o.KeyN = !!S.smokeOn; o[kb.hud] = S.hudOn; o.KeyM = S.mini && S.mini.style.display !== 'none'; o[kb.timeAccel] = S.timeScale > 1; o.Digit1 = S.camMode === 'cockpit'; o.Digit2 = S.camMode === 'chase'; o.Digit3 = S.camMode === 'orbit'; o.Digit4 = S.camMode === 'tower'; o.Tab = !!document.querySelector('#fl-quick.on'); return o; };
    S.keypad = pad;
    // move the minimap/ILS out of the keypad's corner
    const ils = S.root.querySelector('#fl-ils'); if (ils) ils.style.top = '35%';
    S.suggestKeys = () => {
      const s = S.s, FTm = 3.28084, KTm = 1.943844, out = [];
      if (S.ended || S.paused) return out;
      if (heli) { if (s.onGround) out.push(kb.climb); else if (s.agl * FTm < 30) out.push(kb.climb); return out; }
      const vr = S.fm.vr * .85;
      if (s.onGround && s.airT < 2) { if (s.thr < .9) out.push(kb.throttleUp); else if (s.ias > vr * .9) out.push(kb.climb); return out; }
      if (s.stallWarn) { out.push(kb.descend, kb.throttleUp); return out; }
      if (!s.onGround && s.agl * FTm < 300 && s.vs * 196.85 < -900) out.push(kb.climb);
      if (s.onGround && s.airT > 2 && s.ias > 3) out.push(kb.brakes);
      return out;
    };
    return { dispose() { pad.dispose(); S.keypad = null; } };
  });

  /* ---------- Recorder / instant replay ---------- */
  let rec = null;
  window.CT_EXT.push(function recorder(S, T) {
    const buf = [], MAX = 30 * 20; let acc = 0;
    const r = {
      playing: false, idx: 0,
      frame(dt, paused) {
        if (r.playing) {
          r.idx += dt * 20 * 1;
          const f = buf[Math.floor(r.idx)];
          if (!f) { r.stop(); return; }
          S.s.p.fromArray(f.p); S.s.q.fromArray(f.q); S.s.thr = f.t; S.s.gear = f.g;
          return;
        }
        if (paused || S.ended) return;
        acc += dt; if (acc < .05) return; acc = 0;
        buf.push({ p: S.s.p.toArray(), q: S.s.q.toArray(), t: S.s.thr, g: S.s.gear, v: S.s.v.toArray() });
        if (buf.length > MAX) buf.shift();
      },
      replay() {
        if (buf.length < 20) { S.message('Nothing recorded yet', 1.5); return; }
        r.saved = { p: S.s.p.clone(), v: S.s.v.clone(), q: S.s.q.clone(), ended: S.ended, cam: S.camMode, thr: S.s.thr, gear: S.s.gear, paused: S.paused };
        r.playing = true; r.idx = 0; S.paused = true; S.setCam('flyby'); S.message('Replay — Esc to return', 3);
      },
      stop() {
        if (!r.playing) return; r.playing = false; const v = r.saved;
        S.s.p.copy(v.p); S.s.v.copy(v.v); S.s.q.copy(v.q); S.s.thr = v.thr; S.s.gear = v.gear; S.paused = v.paused; S.setCam(v.cam === 'flyby' ? 'chase' : v.cam); S.message('Live', 1);
      },
      reset() { buf.length = 0; },
      dispose() { rec = null; }
    };
    rec = r; return r;
  });

  /* ---------- Autosave + resume ---------- */
  const SNAP = 'contrail.resume';
  function saveSnapshot(S) {
    const s = S.s; if (s.crashed || S.ended === 'crashed') return;
    const snap = { date: Date.now(), ac: S.ac.id, apt: S.cfg.airport.icao, rwy: S.cfg.runway.id, hour: S.hour, reg: S.cfg.reg, livery: S.cfg.livery, weather: { ...S.cfg.weather, windSpd: S.windBase.length() * KT, windDir: (Math.atan2(-S.windBase.x, S.windBase.z) / DEG + 360) % 360, turb: S.turb * 100 }, arr: S.cfg.arr || null,
      p: s.p.toArray(), v: s.v.toArray(), q: s.q.toArray(), thr: s.thr, collective: s.collective, payload: s.payload, trim: s.trim, spoiler: s.spoiler, gear: s.gearT, flaps: s.flapsT, fuel: s.fuel, t: s.t, dist: s.dist, alt: (s.p.y + S.elevM) * FT, ias: s.ias * KT, fuelCap: S.fm.fuelCap,
      mission: S.mission ? S.mission.id : null, onGround: s.onGround, hdg: (S.attitude().heading / DEG + 360) % 360 };
    try { localStorage.setItem(SNAP, JSON.stringify(snap)); } catch (e) { }
  }
  function readSnapshot() {
    try {
      const r = JSON.parse(localStorage.getItem(SNAP) || 'null'), D = window.CT_DATA;
      if (!r || !D.AIRCRAFT.some(a => a.id === r.ac)) return null;
      const ap = D.AIRPORTS.find(a => a.icao === r.apt);
      if (!ap || !ap.rwys.some(x => x.id === r.rwy)) return null;
      if (!['p','v','q'].every(k => Array.isArray(r[k]) && r[k].length === (k === 'q' ? 4 : 3) && r[k].every(Number.isFinite))) return null;
      if (!['hour','thr','gear','flaps','fuel','t','dist','date','alt','ias','hdg'].every(k => Number.isFinite(r[k]))) return null;
      if (!r.weather || !['windDir','windSpd','temp','clouds','vis'].every(k => Number.isFinite(r.weather[k]))) return null;
      if (Math.hypot(...r.q) < .001) return null;
      if (r.fuel < 0 || r.t < 0 || r.thr < 0 || r.thr > 1 || r.gear < 0 || r.gear > 1 || r.flaps < 0 || r.flaps > 1) return null;
      return r;
    } catch (e) { return null; }
  }
  window.CT_RESUME = { get: readSnapshot, clear: () => { try { localStorage.removeItem(SNAP); } catch (e) { } }, save: saveSnapshot };
  window.CT_EXT.push(function autosave(S, T) {
    const r = S.cfg.resume;
    if (r) {
      const s = S.s; s.p.fromArray(r.p); s.v.fromArray(r.v); s.q.fromArray(r.q).normalize(); s.thr = r.thr; s.collective = Number.isFinite(r.collective) ? clamp(r.collective, 0, 1) : (S.fm.heli && !r.onGround ? .58 : 0); s.payload = Number.isFinite(r.payload) ? clamp(r.payload, 0, 1) : s.payload; s.trim = Number.isFinite(r.trim) ? clamp(r.trim, -1, 1) : 0; s.spoiler = Number.isFinite(r.spoiler) ? clamp(r.spoiler, 0, 1) : 0; s.gear = s.gearT = r.gear; s.flaps = s.flapsT = r.flaps; s.fuel = r.fuel; s.t = r.t; s.dist = r.dist; s.onGround = r.onGround; s.airborne = !r.onGround;
      if (!r.onGround) { const a = S.attitude(); S._resumeHold = 1.5; }
      S.message('Flight resumed', 2);
    }
    let acc = 0;
    return {
      frame(dt, paused) { if (S._resumeHold > 0) { S._resumeHold -= dt; } acc += dt; if (acc > 5 && !paused && S.s.airborne && !S.s.onGround) { acc = 0; saveSnapshot(S); } },
      dispose() { if (S.ended === 'crashed' || (S.s.onGround && S.s.ias < 5) || S.ended) window.CT_RESUME.clear(); else saveSnapshot(S); }
    };
  });
})();
