document.documentElement.classList.add('js');

const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#main-nav');
const mobileViewport = window.matchMedia('(max-width: 959px)');
const smallMotionViewport = window.matchMedia('(max-width: 767px)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function closeMenu(returnFocus = false) {
  menuButton.setAttribute('aria-expanded', 'false');
  menu.classList.remove('is-open');
  menu.inert = mobileViewport.matches;
  if (mobileViewport.matches) menu.setAttribute('aria-hidden', 'true');
  else menu.removeAttribute('aria-hidden');
  if (returnFocus) menuButton.focus();
}

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menu.classList.toggle('is-open', open);
  menu.inert = !open;
  menu.setAttribute('aria-hidden', String(!open));
});

menu.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link || !mobileViewport.matches) return;
  closeMenu();
  const href = link.getAttribute('href');
  const target = href?.startsWith('#') && href.length > 1
    ? document.getElementById(href.slice(1))
    : null;
  if (target) {
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') closeMenu(true);
});

// The dropdown is non-modal; focus can leave it freely.
function closeMenuOutside(event) {
  if (mobileViewport.matches && !menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
}
document.addEventListener('pointerdown', closeMenuOutside);
document.addEventListener('focusin', closeMenuOutside);

mobileViewport.addEventListener('change', () => {
  const focusWillHide = mobileViewport.matches && menu.contains(document.activeElement);
  closeMenu(focusWillHide);
});

// Anchor destinations account for the actual header height at every width.
const header = document.querySelector('.site-header');
function updateHeaderHeight() {
  document.documentElement.style.setProperty('--header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
}
updateHeaderHeight();
if ('ResizeObserver' in window) new ResizeObserver(updateHeaderHeight).observe(header);
else window.addEventListener('resize', updateHeaderHeight);
closeMenu();

// Animate height and its matching spacer together, preserving the FV boundary.
(() => {
  const hero = document.querySelector('.hero');
  let normalHeight = 0;
  let compact = false;
  function update() {
    const heroBottom = hero.getBoundingClientRect().bottom + scrollY;
    const next = scrollY >= heroBottom - normalHeight;
    if (next === compact) return;
    compact = next;
    header.classList.toggle('is-compact', compact);
  }
  function measure() {
    header.classList.add('is-measuring');
    header.classList.remove('is-compact');
    header.style.removeProperty('--header-expanded');
    header.style.removeProperty('--header-collapsed');
    normalHeight = header.getBoundingClientRect().height;
    header.classList.add('is-compact');
    const smallHeight = header.getBoundingClientRect().height;
    header.style.setProperty('--header-expanded', `${normalHeight}px`);
    header.style.setProperty('--header-collapsed', `${smallHeight}px`);
    header.classList.remove('is-compact');
    compact = false;
    update();
    // Commit target geometry before re-enabling transitions after a resize.
    header.getBoundingClientRect();
    header.classList.remove('is-measuring');
    updateHeaderHeight();
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('pageshow', update);
  document.fonts?.ready.then(measure);
  header.querySelector('.brand img')?.addEventListener('load', measure);
  measure();
})();

// Destination URLs can be added later without changing layout or interactions.
document.querySelectorAll('[data-placeholder]').forEach((link) => {
  link.addEventListener('click', (event) => event.preventDefault());
});

// Content is visible by default, including without JS or animation support.
// Only animate on first entry; returning to a section never hides it again.
const revealTargets = document.querySelectorAll([
  '.section-heading', '.news-list', '.services .section-title', '.service-card',
  '.symptoms', '.about .section-title', '.feature-photo', '.feature-copy', '.initiatives > h3',
  '.initiative', '.director', '.access .section-title', '.access-contact',
  '.schedule', '.access-location', '.reservation-links',
].join(', '));
const revealed = new WeakSet();
const activeReveals = new Map();
let revealObserver;
let revealSuppressedUntil = location.hash ? performance.now() + 1100 : 0;

function stopReveals() {
  revealObserver?.disconnect();
  activeReveals.forEach((animation) => animation.cancel());
  activeReveals.clear();
}

function setupReveals() {
  stopReveals();
  if (document.hidden || reducedMotion.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;

  revealObserver = new IntersectionObserver((entries) => {
    if (reducedMotion.matches) return;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      revealObserver.unobserve(element);
      revealed.add(element);
      // Anchor navigation and keyboard focus should show content immediately.
      if (performance.now() < revealSuppressedUntil || entry.boundingClientRect.top < 0 || element.contains(document.activeElement)) return;

      let delay = 0;
      if (element.matches('.service-card, .initiative')) {
        const siblings = [...element.parentElement.children];
        const sameRow = siblings.filter((sibling) => sibling.offsetTop === element.offsetTop);
        delay = Math.max(0, sameRow.indexOf(element)) * 100;
      }
      const photo = element.matches('.feature-photo');
      const heading = element.matches('.section-heading, .section-title, .initiatives > h3');
      const duration = photo ? 800 : heading ? 600 : 700;
      const distance = photo ? 24 : heading ? 12 : 20;
      if (element.matches('.feature-copy')) delay = 120;
      const animation = element.animate([
        { opacity: 0, transform: `translateY(${distance}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration, delay, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
      activeReveals.set(element, animation);
      animation.onfinish = animation.oncancel = () => activeReveals.delete(element);
    });
  }, { threshold: 0.06 });
  revealTargets.forEach((element) => {
    if (!revealed.has(element)) revealObserver.observe(element);
  });
}

document.addEventListener('focusin', (event) => {
  activeReveals.forEach((animation, element) => {
    if (element.contains(event.target)) animation.cancel();
  });
});
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.getAttribute('href') === '#') return;
  revealSuppressedUntil = performance.now() + 1100;
  activeReveals.forEach(animation => animation.cancel());
}, true);
window.addEventListener('beforeprint', stopReveals);
window.addEventListener('afterprint', setupReveals);
reducedMotion.addEventListener('change', setupReveals);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopReveals();
  else setupReveals();
});
setupReveals();

// Pause the existing FV float while it is off screen or the tab is hidden.
const hero = document.querySelector('.hero');
let heroVisible = true;
function updateHeroMotion() {
  hero.classList.toggle('motion-paused', document.hidden || !heroVisible);
}
document.addEventListener('visibilitychange', updateHeroMotion);
if ('IntersectionObserver' in window) {
  const heroObserver = new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    updateHeroMotion();
  });
  heroObserver.observe(hero);
}
updateHeroMotion();

// One frame loop for background drift and the one-way about colour reveal.
(() => {
  const targets = [...document.querySelectorAll('.services, .feature, .access')];
  const about = document.querySelector('.about');
  const backdrop = document.querySelector('.about-backdrop');
  const states = targets.map(element => ({ element, a: 0, b: 0 }));
  let frame = 0;
  let previousTime = 0;
  let aboutProgress = 0;
  let printing = false;
  let failed = false;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }
  function showStatic() {
    stop();
    states.forEach(state => {
      state.a = state.b = 0;
      state.element.style.removeProperty('--drift-a');
      state.element.style.removeProperty('--drift-b');
    });
    backdrop.style.removeProperty('--about-opacity');
    aboutProgress = 1;
  }
  function disabled() { return failed || printing || reducedMotion.matches; }
  function tick(time) {
    frame = 0;
    if (disabled() || document.hidden) { stop(); return; }
    try {
      const height = innerHeight;
      const limit = smallMotionViewport.matches ? 40 : 100;
      const dt = previousTime ? Math.min(64, time - previousTime) : 16;
      previousTime = time;
      const blend = 1 - Math.exp(-dt / 240);
      // All geometry reads precede writes; the content itself never translates.
      const boxes = states.map(state => state.element.getBoundingClientRect());
      const aboutTop = about.getBoundingClientRect().top;
      const progress = clamp((height * .85 - aboutTop) / (height * .45), 0, 1);
      aboutProgress = Math.max(aboutProgress, progress);
      backdrop.style.setProperty('--about-opacity', aboutProgress.toFixed(3));
      let unsettled = false;
      states.forEach((state, index) => {
        const box = boxes[index];
        if (box.bottom < -80 || box.top > height + 80) return;
        const travel = clamp((height / 2 - (box.top + box.height / 2)) / ((height + box.height) / 2), -1, 1);
        const goalA = travel * limit * (index === 1 || index === 2 ? -.7 : 1);
        const goalB = -travel * limit * .65;
        state.a += (goalA - state.a) * blend;
        state.b += (goalB - state.b) * blend;
        if (Math.abs(goalA - state.a) < .05) state.a = goalA;
        if (Math.abs(goalB - state.b) < .05) state.b = goalB;
        unsettled ||= state.a !== goalA || state.b !== goalB;
        state.element.style.setProperty('--drift-a', `${state.a.toFixed(2)}px`);
        state.element.style.setProperty('--drift-b', `${state.b.toFixed(2)}px`);
      });
      if (unsettled) frame = requestAnimationFrame(tick);
      else previousTime = 0;
    } catch { failed = true; showStatic(); }
  }
  function requestFrame() {
    if (disabled()) { showStatic(); return; }
    if (!document.hidden && !frame) frame = requestAnimationFrame(tick);
  }
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame);
  window.addEventListener('pageshow', requestFrame);
  window.addEventListener('pagehide', stop);
  window.addEventListener('error', () => { failed = true; showStatic(); });
  window.addEventListener('beforeprint', () => { printing = true; showStatic(); });
  window.addEventListener('afterprint', () => { printing = false; requestFrame(); });
  reducedMotion.addEventListener('change', requestFrame);
  mobileViewport.addEventListener('change', () => { stop(); requestFrame(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else requestFrame();
  });
  requestFrame();
})();
