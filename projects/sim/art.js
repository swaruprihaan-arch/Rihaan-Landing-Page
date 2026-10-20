/* CONTRAIL — procedural aircraft art: plan-view silhouettes and side-view livery profiles (SVG strings). */
(function () {
  const P = (d, extra) => `<path d="${d}" ${extra || ''}></path>`;
  const sym = pts => { // mirror a right-half polygon (x>=120) around x=120
    const r = pts.map(p => p.join(',')).join(' ');
    const l = pts.slice().reverse().map(p => [240 - p[0], p[1]].join(',')).join(' ');
    return `<polygon points="${r} ${l}"></polygon>`;
  };
  function plan(ac) {
    const g = ac.geo, n = ac.nEng || 0, parts = [];
    const fus = (nose, tail, w) => `<path d="M120 ${nose} C ${120 + w} ${nose + 14} ${120 + w} ${nose + 30} ${120 + w} ${nose + 44} L ${120 + w * .7} ${tail - 10} L 120 ${tail} L ${120 - w * .7} ${tail - 10} L ${120 - w} ${nose + 44} C ${120 - w} ${nose + 30} ${120 - w} ${nose + 14} 120 ${nose} Z"></path>`;
    if (g === 'airliner') {
      const sweep = ac.id === 'b52' ? 26 : 34;
      parts.push(sym([[126, 86], [230, 86 + sweep + 10], [230, 86 + sweep + 18], [126, 118]]));
      parts.push(sym([[124, 168], [166, 182], [166, 188], [124, 184]]));
      const eng = n >= 8 ? [150, 172, 196, 216] : n >= 4 ? [154, 194] : [160];
      eng.forEach(x => { const y = 86 + (x - 126) * (sweep + 10) / 104 + 4; parts.push(`<rect x="${x - 5}" y="${y}" width="10" height="20" rx="4"></rect><rect x="${235 - x}" y="${y}" width="10" height="20" rx="4"></rect>`); });
      parts.push(fus(10, 192, 9));
    } else if (g === 'bizjet') {
      parts.push(sym([[124, 96], [214, 120], [214, 128], [124, 122]]));
      parts.push(sym([[122, 170], [160, 178], [160, 184], [122, 182]]));
      parts.push(`<rect x="132" y="138" width="11" height="26" rx="5"></rect><rect x="97" y="138" width="11" height="26" rx="5"></rect>`);
      parts.push(fus(22, 188, 8));
    } else if (g === 'turboprop') {
      const hi = ac.highWing;
      parts.push(fus(14, 190, hi ? 12 : 9));
      parts.push(sym([[124, 82], [232, 88], [232, 102], [124, 106]]));
      parts.push(sym([[122, 168], [168, 172], [168, 182], [122, 182]]));
      const eng = n >= 4 ? [150, 190] : [156];
      eng.forEach(x => parts.push(`<rect x="${x - 6}" y="70" width="12" height="36" rx="4"></rect><rect x="${234 - x}" y="70" width="12" height="36" rx="4"></rect><line x1="${x - 14}" y1="70" x2="${x + 14}" y2="70"></line><line x1="${226 - x}" y1="70" x2="${254 - x}" y2="70"></line>`));
    } else if (g === 'fighter') {
      parts.push(sym([[124, 96], [202, 140], [202, 152], [128, 150]]));
      parts.push(sym([[124, 162], [168, 186], [168, 194], [124, 190]]));
      parts.push(`<path d="M120 8 L 128 44 L 130 120 L 128 194 L 112 194 L 110 120 L 112 44 Z"></path>`);
      if (ac.twinTail) parts.push(`<line x1="132" y1="160" x2="140" y2="186"></line><line x1="108" y1="160" x2="100" y2="186"></line>`);
      parts.push(`<ellipse cx="120" cy="58" rx="4" ry="12"></ellipse>`);
    } else if (g === 'delta') {
      parts.push(sym([[126, 76], [206, 168], [206, 178], [126, 182]]));
      parts.push(sym([[124, 58], [148, 70], [148, 76], [124, 74]]));
      parts.push(`<path d="M120 8 L 127 40 L 128 186 L 112 186 L 113 40 Z"></path><ellipse cx="120" cy="46" rx="4" ry="11"></ellipse>`);
    } else if (g === 'attack') {
      parts.push(sym([[124, 84], [228, 92], [228, 108], [124, 112]]));
      parts.push(sym([[122, 174], [166, 176], [166, 188], [122, 188]]));
      parts.push(`<rect x="128" y="140" width="14" height="28" rx="6"></rect><rect x="98" y="140" width="14" height="28" rx="6"></rect>`);
      parts.push(fus(20, 190, 9));
    } else if (g === 'heli') {
      parts.push(`<ellipse cx="120" cy="80" rx="22" ry="40"></ellipse><rect x="117" y="116" width="6" height="72" rx="3"></rect><rect x="108" y="180" width="24" height="5" rx="2"></rect>`);
      parts.push(`<circle cx="120" cy="80" r="86" fill="none" stroke-dasharray="6 6" opacity=".55"></circle><line x1="34" y1="80" x2="206" y2="80"></line><line x1="120" y1="-6" x2="120" y2="166"></line><circle cx="120" cy="80" r="6"></circle>`);
    } else if (g === 'glider') {
      parts.push(sym([[123, 74], [238, 80], [238, 86], [123, 90]]));
      parts.push(sym([[121, 178], [146, 180], [146, 186], [121, 186]]));
      parts.push(`<path d="M120 30 C 128 38 127 60 126 80 L 122 190 L 118 190 L 114 80 C 113 60 112 38 120 30 Z"></path><ellipse cx="120" cy="54" rx="4" ry="12"></ellipse>`);
    } else if (g === 'warbird') {
      parts.push(`<path d="M124 82 C 170 78 220 86 226 98 C 222 108 170 112 124 112 Z"></path><path d="M116 82 C 70 78 20 86 14 98 C 18 108 70 112 116 112 Z"></path>`);
      parts.push(`<path d="M122 170 C 140 168 160 172 162 180 C 160 186 140 186 122 186 Z"></path><path d="M118 170 C 100 168 80 172 78 180 C 80 186 100 186 118 186 Z"></path>`);
      parts.push(fus(24, 192, 10));
      parts.push(`<line x1="96" y1="20" x2="144" y2="20"></line><ellipse cx="120" cy="96" rx="4" ry="10"></ellipse>`);
    } else { // ga
      const span = ac.id === 'dc3' ? 226 : 222;
      parts.push(fus(26, 188, 10));
      parts.push(sym([[124, 72], [span, 74], [span, 94], [124, 96]]));
      parts.push(sym([[122, 166], [164, 168], [164, 182], [122, 184]]));
      if (n >= 2) parts.push(`<rect x="150" y="56" width="12" height="34" rx="5"></rect><rect x="78" y="56" width="12" height="34" rx="5"></rect>`);
      else parts.push(`<line x1="100" y1="26" x2="140" y2="26"></line>`);
      if (ac.floats) parts.push(`<rect x="134" y="44" width="10" height="110" rx="5" fill="none" stroke-dasharray="4 3"></rect><rect x="96" y="44" width="10" height="110" rx="5" fill="none" stroke-dasharray="4 3"></rect>`);
    }
    return `<svg viewBox="0 0 240 200" fill="var(--sil-fill,#10151C)" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" role="img" aria-label="${ac.name} plan view">${parts.join('')}</svg>`;
  }

  // Side profile, nose LEFT, viewBox 0 0 420 150. c = livery colours {body,belly,accent,tail,engine,logo,wing}
  function profile(ac, c, reg) {
    const g = ac.geo, out = [];
    const st = 'stroke="#0A0D12" stroke-width="1.2" stroke-linejoin="round"';
    reg = String(reg || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    if (g === 'heli') {
      out.push(`<path d="M60 70 C 60 46 92 38 130 38 L 200 40 C 226 42 238 56 238 74 L 236 96 C 232 108 214 112 196 112 L 104 112 C 78 112 60 98 60 70 Z" fill="${c.body}" ${st}></path>`);
      out.push(`<path d="M62 84 L 236 84 L 234 100 C 230 110 214 112 196 112 L 104 112 C 80 112 66 102 62 84 Z" fill="${c.belly}" ${st}></path>`);
      out.push(`<path d="M232 66 L 360 76 L 360 84 L 232 90 Z" fill="${c.body}" ${st}></path><path d="M346 50 L 368 50 L 372 88 L 356 92 Z" fill="${c.tail}" ${st}></path>`);
      out.push(`<path d="M76 64 C 80 50 100 46 124 46 L 128 70 L 74 72 Z" fill="#1E2733" ${st}></path>`);
      out.push(`<rect x="120" y="30" width="80" height="10" rx="4" fill="${c.engine}" ${st}></rect><line x1="20" y1="24" x2="300" y2="24" stroke="#A3AFBC" stroke-width="3"></line><rect x="152" y="22" width="16" height="10" fill="#394655"></rect>`);
      out.push(`<path d="M120 60 L 210 60" stroke="${c.accent}" stroke-width="5"></path>`);
      out.push(`<line x1="90" y1="126" x2="220" y2="126" stroke="#7B8999" stroke-width="3"></line><line x1="110" y1="112" x2="104" y2="126" stroke="#7B8999" stroke-width="2"></line><line x1="200" y1="112" x2="206" y2="126" stroke="#7B8999" stroke-width="2"></line>`);
      out.push(`<text x="280" y="102" font-family="IBM Plex Mono,monospace" font-size="9" fill="${c.logo}">${reg}</text>`);
    } else {
      const mil = ['fighter', 'delta', 'attack'].includes(g);
      const len = g === 'glider' ? 300 : 340, top = mil ? 62 : 52, bot = mil ? 92 : 98, x0 = 30, x1 = x0 + len;
      // fuselage
      const nose = mil ? `M${x0 - 10} 80 L ${x0 + 70} ${top}` : `M${x0} 80 C ${x0} ${top + 4} ${x0 + 30} ${top} ${x0 + 60} ${top}`;
      const fus = `${nose} L ${x1 - 60} ${top} L ${x1} ${top + 8} L ${x1} ${top + 20} L ${x1 - 70} ${bot} L ${x0 + 50} ${bot} C ${x0 + 14} ${bot} ${x0} ${bot - 6} ${x0} 80 Z`;
      out.push(`<path d="${fus}" fill="${c.body}" ${st}></path>`);
      out.push(`<clipPath id="fc-${ac.id}"><path d="${fus}"></path></clipPath>`);
      out.push(`<g clip-path="url(#fc-${ac.id})"><rect x="0" y="${(top + bot) / 2 + 4}" width="420" height="60" fill="${c.belly}"></rect><path d="M0 ${(top + bot) / 2 + 2} L 420 ${(top + bot) / 2 - 6} L 420 ${(top + bot) / 2 - 1} L 0 ${(top + bot) / 2 + 7} Z" fill="${c.accent}"></path></g>`);
      // tail
      const tt = g === 'glider' ? 22 : mil ? 18 : 10;
      out.push(`<path d="M${x1 - 70} ${top + 2} L ${x1 - 20} ${tt} L ${x1 + 4} ${tt} L ${x1} ${top + 12} Z" fill="${c.tail}" ${st}></path>`);
      out.push(`<circle cx="${x1 - 22}" cy="${tt + 22}" r="7" fill="${c.logo}"></circle>`);
      if (ac.twinTail) out.push(`<path d="M${x1 - 80} ${top + 2} L ${x1 - 36} ${tt + 6} L ${x1 - 18} ${tt + 6} L ${x1 - 16} ${top + 6} Z" fill="${c.tail}" opacity=".7" ${st}></path>`);
      out.push(`<path d="M${x1 - 46} ${top + 14} L ${x1 + 6} ${top + 10} L ${x1 + 6} ${top + 16} L ${x1 - 46} ${top + 20} Z" fill="${c.wing}" ${st}></path>`);
      // wing
      const wx = x0 + len * .38;
      out.push(`<path d="M${wx} ${bot - 10} L ${wx + 90} ${bot - 4} L ${wx + 96} ${bot} L ${wx - 6} ${bot - 2} Z" fill="${c.wing}" ${st}></path>`);
      // cockpit / windows
      if (mil) out.push(`<path d="M${x0 + 56} ${top + 2} C ${x0 + 70} ${top - 16} ${x0 + 110} ${top - 16} ${x0 + 130} ${top} Z" fill="${c.logo}" opacity=".9" ${st}></path>`);
      else if (g === 'glider') out.push(`<path d="M${x0 + 20} ${top + 8} C ${x0 + 40} ${top - 12} ${x0 + 90} ${top - 10} ${x0 + 110} ${top + 2} Z" fill="#1E2733" ${st}></path>`);
      else {
        out.push(`<path d="M${x0 + 18} ${top + 12} L ${x0 + 34} ${top + 6} L ${x0 + 40} ${top + 14} L ${x0 + 20} ${top + 18} Z" fill="#0A0D12"></path>`);
        if (g === 'airliner' || g === 'bizjet' || g === 'turboprop') {
          const n = g === 'bizjet' ? 6 : 26, step = (len - 150) / n;
          for (let i = 0; i < n; i++) out.push(`<rect x="${x0 + 70 + i * step}" y="${top + 9}" width="${g === 'bizjet' ? 8 : 4}" height="${g === 'bizjet' ? 7 : 5}" rx="1.5" fill="#0A0D12" opacity=".8"></rect>`);
        } else out.push(`<path d="M${x0 + 50} ${top} L ${x0 + 70} ${top - 18} L ${x0 + 120} ${top - 18} L ${x0 + 130} ${top} Z" fill="#1E2733" ${st}></path>`);
      }
      // engines
      if (g === 'airliner') { for (let i = 0; i < Math.min(2, Math.ceil((ac.nEng || 2) / 2)); i++) out.push(`<rect x="${wx + 6 + i * 40}" y="${bot - 2}" width="46" height="20" rx="9" fill="${c.engine}" ${st}></rect><rect x="${wx + 6 + i * 40}" y="${bot}" width="6" height="16" rx="2" fill="#394655"></rect>`); }
      if (g === 'bizjet') out.push(`<rect x="${x1 - 110}" y="${top - 2}" width="50" height="18" rx="8" fill="${c.engine}" ${st}></rect>`);
      if (g === 'turboprop') out.push(`<rect x="${wx - 20}" y="${bot - 26}" width="56" height="18" rx="7" fill="${c.engine}" ${st}></rect><line x1="${wx - 22}" y1="${bot - 50}" x2="${wx - 22}" y2="${bot + 12}" stroke="#A3AFBC" stroke-width="3"></line>`);
      if (g === 'attack') out.push(`<rect x="${x1 - 140}" y="${top - 14}" width="54" height="20" rx="9" fill="${c.engine}" ${st}></rect>`);
      if (g === 'ga' || g === 'warbird') out.push(`<line x1="${x0 - 4}" y1="${top - 22}" x2="${x0 - 4}" y2="${bot + 22}" stroke="#A3AFBC" stroke-width="3"></line><path d="M${x0 - 4} 72 L ${x0 + 6} 72 L ${x0 + 6} 88 L ${x0 - 4} 88 Z" fill="${c.engine}"></path>`);
      if (mil) out.push(`<path d="M${x1 - 4} ${top + 10} L ${x1 + 14} ${top + 12} L ${x1 + 14} ${top + 22} L ${x1 - 4} ${top + 22} Z" fill="#394655"></path><path d="M${x0 - 10} 80 L ${x0 + 20} ${top + 10} L ${x0 + 20} 86 Z" fill="${c.engine}"></path>`);
      // gear
      out.push(`<line x1="${x0 + 60}" y1="${bot}" x2="${x0 + 60}" y2="${bot + 22}" stroke="#7B8999" stroke-width="2"></line><circle cx="${x0 + 60}" cy="${bot + 24}" r="5" fill="#1E2733" stroke="#7B8999"></circle>`);
      out.push(`<line x1="${wx + 40}" y1="${bot}" x2="${wx + 40}" y2="${bot + 22}" stroke="#7B8999" stroke-width="2"></line><circle cx="${wx + 40}" cy="${bot + 24}" r="6" fill="#1E2733" stroke="#7B8999"></circle>`);
      out.push(`<text x="${x1 - 120}" y="${bot - 8}" font-family="IBM Plex Mono,monospace" font-size="9" fill="${c.logo}" opacity=".95">${reg}</text>`);
    }
    return `<svg viewBox="0 0 420 150" role="img" aria-label="${ac.name} side profile">${out.join('')}</svg>`;
  }

  const ICONS = {
    mark: '<path d="M3 17 L14 6 L25 17"></path><path d="M8 22 L14 16 L20 22"></path>',
    search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"></path>',
    plane: '<path d="M2 13l8-2 4-8h2l-1 8 6 1v2l-6 1 1 6h-2l-4-5-8-1z"></path>',
    play: '<path d="M7 4l13 8-13 8z"></path>',
    cog: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"></path>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z"></path>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"></path><path d="M9 4v14M15 6v14"></path>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"></path><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"></path>',
    brush: '<path d="M14 4l6 6-8 8H6v-6z"></path><path d="M4 20l2-2"></path>',
    back: '<path d="M15 5l-7 7 7 7"></path>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"></rect><circle cx="9" cy="9" r="1"></circle><circle cx="15" cy="15" r="1"></circle><circle cx="15" cy="9" r="1"></circle><circle cx="9" cy="15" r="1"></circle>'
  };
  const icon = (n, s) => `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 ${n === 'mark' ? 28 : 24} ${n === 'mark' ? 28 : 24}" fill="none" stroke="currentColor" stroke-width="${n === 'mark' ? 2 : 1.75}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  window.CT_ART = { plan, profile, icon };
})();
