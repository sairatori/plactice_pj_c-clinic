/* Motion controller: independent of navigation; content is visible without JS. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.querySelector('.hero-canvas');
  if (!canvas) return;
  const pending = new Set();
  const running = new Map();
  const introAnimations = new Map();
  let observer;
  let floatObserver;
  let opening;
  let openingTimer;
  let openingFinished = true;
  let photoInView = false;
  let printing = false;
  const css = getComputedStyle(document.documentElement);
  const entranceMs = parseFloat(css.getPropertyValue('--motion-enter')) || 1100;
  const entranceEase = css.getPropertyValue('--ease-enter').trim() || 'cubic-bezier(.22,1,.36,1)';

  function updateFloat() {
    canvas.classList.toggle('is-floating', photoInView && openingFinished && !document.hidden && !reduced.matches && !printing);
  }
  function finishOpening() {
    clearTimeout(openingTimer);
    introAnimations.forEach(animation => animation.cancel());
    introAnimations.clear();
    opening?.remove();
    opening = null;
    openingFinished = true;
    updateFloat();
  }
  function show(element) {
    pending.delete(element);
    observer?.unobserve(element);
    element.classList.remove('reveal-pending');
    const animation = running.get(element);
    running.delete(element);
    animation?.cancel();
  }
  function showAll() {
    [...pending, ...running.keys()].forEach(show);
    observer?.disconnect();
  }
  function enter(element, delay) {
    pending.delete(element);
    observer.unobserve(element);
    try {
      // Create the animation before removing the pending state: no visible-then-hidden frame.
      const animation = element.animate(
        [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: entranceMs, delay, easing: entranceEase, fill: 'both' }
      );
      running.set(element, animation);
      element.classList.remove('reveal-pending');
      animation.onfinish = () => show(element);
      animation.oncancel = () => { running.delete(element); element.classList.remove('reveal-pending'); };
    } catch { show(element); }
  }
  function revealDestination(event) {
    const anchor = event.target.closest('a[href^="#"]');
    const id = anchor?.hash.slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    [...pending, ...running.keys()].forEach(element => {
      if (element.contains(target) || target.contains(element)) show(element);
    });
  }
  try {
    const navigation = performance.getEntriesByType('navigation')[0];
    const atTop = (!location.hash || location.hash === '#top') && scrollY === 0;
    // A delayed script must not cover a photograph that has already been painted.
    const alreadyPainted = performance.getEntriesByType('paint').some(entry => entry.name === 'first-contentful-paint');
    if (!alreadyPainted && !reduced.matches && !document.hidden && atTop && navigation?.type !== 'back_forward') {
      openingFinished = false;
      opening = document.createElement('div');
      opening.className = 'hero-opening';
      opening.setAttribute('aria-hidden', 'true');
      opening.innerHTML = '<div class="opening-scene"><span class="opening-shape opening-shape--one"></span><span class="opening-shape opening-shape--two"></span><span class="opening-shape opening-shape--three"></span><img src="IMG/ロゴ_たなか子どもクリニック.svg" alt="" width="542" height="47"></div>';
      // Fixed, bounded timeline. Input never dismisses the opening.
      openingTimer = setTimeout(finishOpening, 2900);
      document.body.append(opening);
      if (Element.prototype.animate) {
        const intro = [canvas, ...document.querySelectorAll('.hero-copy > *')];
        intro.forEach((element, index) => {
          const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: index === 0 ? 1600 : 1100,
            delay: 1000 + index * 160,
            easing: entranceEase, fill: 'backwards'
          });
          introAnimations.set(element, animation);
          animation.onfinish = () => introAnimations.delete(element);
        });
      }
    }
    if ('IntersectionObserver' in window) {
      floatObserver = new IntersectionObserver(entries => {
        photoInView = entries[0].isIntersecting;
        updateFloat();
      });
      floatObserver.observe(canvas);
    }
    if (!reduced.matches && 'IntersectionObserver' in window && Element.prototype.animate) {
      observer = new IntersectionObserver(entries => {
        if (reduced.matches || document.hidden || printing) { showAll(); return; }
        const visible = entries.filter(entry => entry.isIntersecting && pending.has(entry.target));
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
        let rowTop = -Infinity, rowIndex = 0;
        visible.forEach(entry => {
          if (Math.abs(entry.boundingClientRect.top - rowTop) > 8) { rowTop = entry.boundingClientRect.top; rowIndex = 0; }
          enter(entry.target, Math.min(rowIndex++, 2) * 160);
        });
      }, { threshold: 0.08 });
      const destination = document.getElementById(location.hash.slice(1));
      const elements = document.querySelectorAll('.news .section-heading, .news-list, .services .section-heading, .service-card, .about > .container > .section-heading, .feature, .initiatives, .director, .access .section-heading, .access-layout');
      elements.forEach(element => {
        // Above-fold and deep-link content never flashes or waits for the observer.
        if (element.getBoundingClientRect().top <= innerHeight || (destination && (destination.contains(element) || element.contains(destination)))) return;
        pending.add(element);
        element.classList.add('reveal-pending');
        observer.observe(element);
      });
    }
    document.addEventListener('click', revealDestination, true);
    document.addEventListener('focusin', event => {
      [...pending, ...running.keys()].forEach(element => { if (element.contains(event.target)) show(element); });
    });
    reduced.addEventListener('change', () => {
      if (reduced.matches) { finishOpening(); showAll(); }
      updateFloat();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { finishOpening(); showAll(); }
      updateFloat();
    });
    window.addEventListener('pagehide', () => { photoInView = false; finishOpening(); showAll(); });
    window.addEventListener('pageshow', () => {
      const rect = canvas.getBoundingClientRect();
      photoInView = rect.bottom > 0 && rect.top < innerHeight;
      updateFloat();
    });
    window.addEventListener('beforeprint', () => { printing = true; finishOpening(); showAll(); });
    window.addEventListener('afterprint', () => { printing = false; updateFloat(); });
    window.addEventListener('error', () => { finishOpening(); showAll(); });
  } catch {
    finishOpening(); showAll(); floatObserver?.disconnect();
    canvas.classList.remove('is-floating');
  }
})();
