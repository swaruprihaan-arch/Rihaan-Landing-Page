/* Rihaan inner pages: mobile menu and reveal-on-scroll. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js'); /* reveal styling only applies when this script runs */

  /* ---------------- Mobile menu ---------------- */
  var burger = document.querySelector('.burger');
  var scrim = document.querySelector('.scrim');
  var sheet = document.getElementById('mobile-menu');
  var menuOpen = false;

  function setMenu(open) {
    if (!burger || !sheet) return;
    menuOpen = open;
    root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) {
      sheet.removeAttribute('inert');
      sheet.removeAttribute('aria-hidden');
      var first = sheet.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    } else {
      sheet.setAttribute('inert', '');
      sheet.setAttribute('aria-hidden', 'true');
    }
  }
  function closeMenu() {
    if (!menuOpen) return;
    setMenu(false);
    burger.focus({ preventScroll: true });
  }

  if (burger && sheet) {
    burger.addEventListener('click', function () { if (menuOpen) closeMenu(); else setMenu(true); });
    if (scrim) scrim.addEventListener('click', closeMenu);
    sheet.addEventListener('click', function (e) { if (e.target && e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (!menuOpen) return;
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); closeMenu(); return; }
      if (e.key === 'Tab') {
        /* Move focus ourselves so it can never land behind the scrim (Safari). */
        e.preventDefault();
        var items = [burger].concat(Array.prototype.slice.call(sheet.querySelectorAll('a[href], button')));
        var i = items.indexOf(document.activeElement);
        var next = i === -1 ? (e.shiftKey ? items.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + items.length) % items.length;
        items[next].focus({ preventScroll: true });
      }
    });
  }

  /* ---------------- Reveal on scroll ---------------- */
  var targets = document.querySelectorAll('[data-reveal]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!targets.length) return;
  if (reduce || typeof IntersectionObserver !== 'function') {
    targets.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach(function (el) { io.observe(el); });
  /* Safety net: anything still hidden after 1.5s (observer quirks on some
     mobile browsers / emulators) is revealed so content is never invisible. */
  setTimeout(function () {
    targets.forEach(function (el) {
      if (!el.classList.contains('is-in')) { el.classList.add('is-in'); io.unobserve(el); }
    });
  }, 1500);
})();
