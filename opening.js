// Independent from the menu / scroll code; no overlay exists without JavaScript.
(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // TOP visits and reloads replay; deep links and restored reading positions do not.
  if (motion.matches || document.hidden || (location.hash && location.hash !== '#top') ||
      scrollY > 0 || !Element.prototype.animate) return;

  let overlay;
  let finished = false;
  let started = false;
  const animations = new Set();
  const began = performance.now();
  const events = ['pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown', 'focusin'];
  // Register the fail-open guard before touching the document.
  const deadline = setTimeout(finish, 2900);
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(deadline);
    animations.forEach(animation => animation.cancel());
    overlay?.remove();
    document.documentElement.classList.remove('opening-active');
    events.forEach(event => window.removeEventListener(event, finish, true));
    window.removeEventListener('pagehide', finish);
    window.removeEventListener('beforeprint', finish);
    window.removeEventListener('error', finish);
    document.removeEventListener('visibilitychange', visibility);
    motion.removeEventListener('change', finish);
  }
  function visibility() { if (document.hidden) finish(); }
  function animate(element, frames, options) {
    const animation = element.animate(frames, { easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards', ...options });
    animations.add(animation);
    animation.onfinish = animation.oncancel = () => animations.delete(animation);
    return animation;
  }
  function reveal() {
    if (finished || started) return;
    started = true;
    overlay.classList.add('is-leaving');
    const canvas = document.querySelector('.hero-canvas');
    animate(canvas, [{ opacity: 0 }, { opacity: 1 }], { duration: 1600 });
    document.querySelectorAll('.hero-copy, .hero-badges li').forEach((element, index) => {
      animate(element, [{ opacity: 0 }, { opacity: 1 }],
        { duration: 1100, delay: 160 * (index + 1) });
    });
    setTimeout(finish, 1800);
  }
  try {
    events.forEach(event => window.addEventListener(event, finish, { capture: true, passive: true }));
    window.addEventListener('pagehide', finish);
    window.addEventListener('beforeprint', finish);
    window.addEventListener('error', finish);
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', finish);
    overlay = document.createElement('div');
    overlay.className = 'opening';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="opening-scene"><span class="opening-shape opening-shape--one"></span><span class="opening-shape opening-shape--two"></span><span class="opening-shape opening-shape--three"></span><img src="IMG/ロゴ_たなか子どもクリニック.svg" alt="" width="542" height="47"></div>';
    document.body.append(overlay);
    document.documentElement.classList.add('opening-active');
    const images = [...document.querySelectorAll('.hero-layer')];
    Promise.allSettled(images.map(image => image.decode())).then(() => {
      if (!finished) setTimeout(reveal, Math.max(0, 1000 - (performance.now() - began)));
    });
  } catch { finish(); }
})();
