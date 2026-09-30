/* Rihaan projects page: renders a static gallery of website previews from
   projects/manifest.json. Each entry points at a folder under ./projects/
   containing that project's own index.html, served as a sandboxed iframe. */
(function () {
  'use strict';

  const MANIFEST_URL = './projects/manifest.json';
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

  function openProject(url) {
    const win = window.open(url, '_blank', 'noopener');
    if (!win) setStatus('The new tab may have been blocked. Allow pop-ups for this page and try again.', 'error');
  }

  function buildCard(project) {
    const url = './projects/' + project.slug + '/index.html';
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
    setTimeout(reveal, 12000);
    frame.src = url;
    preview.appendChild(frame);
    preview.addEventListener('click', () => openProject(url));

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
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'project-card__btn project-card__btn--primary';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => openProject(url));
    actions.appendChild(openBtn);
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
    }
  }

  function updateCount(n) {
    if (els.count) els.count.textContent = n + (n === 1 ? ' website' : ' websites');
  }

  fetch(MANIFEST_URL)
    .then((res) => { if (!res.ok) throw new Error('Could not load the project list.'); return res.json(); })
    .then((list) => {
      const projects = Array.isArray(list) ? list : [];
      projects.forEach((project) => mountCard(buildCard(project)));
      updateCount(projects.length);
      if (!projects.length) setStatus('No projects yet.');
    })
    .catch((err) => {
      updateCount(0);
      setStatus('Could not load the project list: ' + (err && err.message ? err.message : err), 'error');
    });
})();
