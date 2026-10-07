/* Rihaan projects page: renders a static gallery of website previews.
   The list is embedded below (not fetched) so the gallery never depends on
   a second network request that could fail on some devices/networks.
   Each entry points at a folder under ./projects/ containing that
   project's own index.html, served as a sandboxed iframe. */
(function () {
  'use strict';

  const PROJECTS = [
    { slug: 'rihaan-landing-page', title: 'Rihaan Landing Page', desc: "This site's landing page — soccer-inspired hero, AI integrations row and the animated wordmark reveal.", repo: 'https://github.com/swaruprihaan-arch/Rihaan-Landing-Page' },
    { slug: 'tower-defence-2', title: 'Tower Defence 2', desc: 'A browser tower-defense game with escalating waves, built to be tough from the very first level.' },
    { slug: 'kathleen', title: 'Kathleen Treseder Campaign', desc: 'A student campaign site for Irvine City Council, District 6 — every claim links to a public source.', repo: 'https://github.com/swaruprihaan-arch/Kathleen_BioGlow' },
    { slug: 'mama-recipe-finder', title: 'Recipe Finder', desc: 'Search and discover recipes with an AI Chef assistant, pulling live data from TheMealDB.', repo: 'https://github.com/swaruprihaan-arch/Recipe-Finder' },
    { slug: 'workflow-pipeline', title: 'Brick Route', desc: 'An interactive, LEGO-themed walkthrough of an analysis workflow pipeline.' },
    { slug: 'lego-brickforge', title: 'BrickForge', desc: '3D LEGO build instructions viewer powered by the Rebrickable API.', repo: 'https://github.com/swaruprihaan-arch/Lego_Bricks' },
    { slug: 'math', title: 'Math Lab', desc: 'Brick-themed math practice for kids — whole numbers, fractions, decimals, order of operations, word problems and K-8 grade-level math.', path: './math/', repo: 'https://github.com/swaruprihaan-arch/Math' },
    { slug: 'mrs-hill-owl', title: 'Owls: Calm & Mystical Encyclopedia', desc: 'A species guide to owls with scrollable, fullscreen galleries.', path: './mrs-hill-owl/' }
  ];
  const PREVIEW_WIDTH = 1280;

  const els = {
    status: document.getElementById('projects-status'),
    count: document.getElementById('projects-count'),
    grid: document.getElementById('projects-grid')
  };
  if (!els.grid) return;

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

  function setStatus(message, tone) {
    if (!els.status) return;
    els.status.textContent = message || '';
    if (tone) els.status.setAttribute('data-tone', tone);
    else els.status.removeAttribute('data-tone');
  }

  function absUrl(url) {
    return new URL(url.replace(/index\.html$/, ''), window.location.href).href;
  }

  function copyLink(url, btn) {
    const href = absUrl(url);
    const done = (ok) => {
      if (!btn) return;
      const label = btn.getAttribute('data-label') || btn.textContent;
      btn.setAttribute('data-label', label);
      btn.textContent = ok ? 'Copied!' : 'Copy failed';
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.textContent = label; }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(href).then(() => done(true), () => done(fallbackCopy(href)));
    } else {
      done(fallbackCopy(href));
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function makeBtn(tag, cls, text) {
    const b = document.createElement(tag);
    b.className = 'project-card__btn' + (cls ? ' ' + cls : '');
    b.textContent = text;
    if (tag === 'button') b.type = 'button';
    return b;
  }

  /* ---------- Preview modal: full-size, interactive, stays on this page ---------- */
  const modal = (function buildModal() {
    const root = document.createElement('div');
    root.className = 'preview-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'preview-modal-title');
    root.hidden = true;
    root.innerHTML =
      '<div class="preview-modal__scrim" data-close></div>' +
      '<div class="preview-modal__panel">' +
        '<div class="preview-modal__bar">' +
          '<h2 class="preview-modal__title" id="preview-modal-title"></h2>' +
          '<div class="preview-modal__actions"></div>' +
          '<button type="button" class="preview-modal__close" aria-label="Close preview" data-close>&times;</button>' +
        '</div>' +
        '<div class="preview-modal__stage"><iframe class="preview-modal__frame" title="Website preview" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"></iframe></div>' +
        '<p class="preview-modal__summary"></p>' +
      '</div>';
    document.body.appendChild(root);
    const title = root.querySelector('.preview-modal__title');
    const actions = root.querySelector('.preview-modal__actions');
    const frame = root.querySelector('.preview-modal__frame');
    const summary = root.querySelector('.preview-modal__summary');
    let lastFocus = null;

    function close() {
      if (root.hidden) return;
      root.hidden = true;
      frame.src = 'about:blank';
      document.documentElement.classList.remove('preview-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    root.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    function open(project, url) {
      lastFocus = document.activeElement;
      title.textContent = project.title;
      summary.textContent = project.desc || '';
      actions.textContent = '';
      const tab = makeBtn('a', 'project-card__btn--primary', 'Open in new tab');
      tab.href = url; tab.target = '_blank'; tab.rel = 'noopener';
      const copy = makeBtn('button', '', 'Copy link');
      copy.addEventListener('click', () => copyLink(url, copy));
      actions.appendChild(tab);
      actions.appendChild(copy);
      frame.src = url;
      root.hidden = false;
      document.documentElement.classList.add('preview-open');
      root.querySelector('.preview-modal__close').focus();
    }
    return { open, close };
  })();

  /* Previews only start loading when the card is near the viewport: six live
     sites at once is too heavy for phones. */
  const loadObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const frame = entry.target.querySelector('.project-card__frame');
          if (frame && !frame.src) frame.src = frame.getAttribute('data-src');
          loadObserver.unobserve(entry.target);
        });
      }, { rootMargin: '300px 0px' })
    : null;

  function buildCard(project) {
    const url = project.path ? project.path : './projects/' + project.slug + '/index.html';
    const li = document.createElement('li');
    li.className = 'card project-card';

    const preview = document.createElement('div');
    preview.className = 'project-card__preview';
    const frame = document.createElement('iframe');
    frame.className = 'project-card__frame';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('title', 'Preview of ' + project.title);
    /* Safari paints a not-yet-loaded lazy frame white, so keep it invisible
       until it has loaded (with a fallback in case load never fires). */
    const reveal = () => frame.classList.add('is-loaded');
    frame.addEventListener('load', reveal);
    setTimeout(reveal, 15000);
    frame.setAttribute('data-src', url);
    if (!loadObserver) frame.src = url;
    preview.appendChild(frame);
    const badge = document.createElement('span');
    badge.className = 'project-card__badge';
    badge.textContent = 'Live preview';
    preview.appendChild(badge);
    preview.setAttribute('role', 'button');
    preview.setAttribute('tabindex', '0');
    preview.setAttribute('aria-label', 'Preview ' + project.title);
    preview.addEventListener('click', () => modal.open(project, url));
    preview.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); modal.open(project, url); }
    });

    const body = document.createElement('div');
    body.className = 'project-card__body';
    const title = document.createElement('h3');
    title.className = 'project-card__title';
    title.textContent = project.title;
    const meta = document.createElement('p');
    meta.className = 'project-card__meta';
    meta.textContent = project.desc || '';
    const actions = document.createElement('div');
    actions.className = 'project-card__actions';
    const previewBtn = makeBtn('button', 'project-card__btn--primary', 'Preview');
    previewBtn.addEventListener('click', () => modal.open(project, url));
    actions.appendChild(previewBtn);
    const tabBtn = makeBtn('a', '', 'Open in new tab');
    tabBtn.href = url;
    tabBtn.target = '_blank';
    tabBtn.rel = 'noopener';
    actions.appendChild(tabBtn);
    const copyBtn = makeBtn('button', '', 'Copy link');
    copyBtn.addEventListener('click', () => copyLink(url, copyBtn));
    actions.appendChild(copyBtn);
    if (project.repo) {
      const repoBtn = makeBtn('a', '', 'Source');
      repoBtn.href = project.repo;
      repoBtn.target = '_blank';
      repoBtn.rel = 'noopener';
      actions.appendChild(repoBtn);
    }
    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(actions);

    li.appendChild(preview);
    li.appendChild(body);
    return li;
  }

  function mountCard(card) {
    els.grid.appendChild(card);
    const preview = card.querySelector('.project-card__preview');
    if (preview) {
      fitFrame(preview);
      if (frameObserver) frameObserver.observe(preview);
      if (loadObserver) loadObserver.observe(preview);
    }
  }

  function updateCount(n) {
    if (els.count) els.count.textContent = n + (n === 1 ? ' website' : ' websites');
  }

  PROJECTS.forEach((project) => mountCard(buildCard(project)));
  updateCount(PROJECTS.length);
})();
