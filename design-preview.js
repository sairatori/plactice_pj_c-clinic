/* Menu, anchor focus and placeholder feedback. Motion is independent. */
(() => {
  const root = document.documentElement;
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const mobile = matchMedia('(max-width: 959px)');
  const toast = document.querySelector('.preview-toast');
  let toastTimer;
  function setMenu(open, restoreFocus = false) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    nav.inert = mobile.matches && !open;
    if (restoreFocus) toggle.focus();
  }
  root.classList.add('js');
  setMenu(false);
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setMenu(false, true);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) setMenu(false);
    const placeholder = event.target.closest('[data-placeholder]');
    if (placeholder) {
      event.preventDefault();
      toast.textContent = 'デザイン確認用です。リンク先は準備中です。';
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3500);
      return;
    }
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor) return;
    const destination = document.getElementById(anchor.hash.slice(1));
    if (!destination) return;
    setMenu(false);
    // Focus the destination without competing with native anchor scrolling.
    destination.setAttribute('tabindex', '-1');
    destination.focus({ preventScroll: true });
    destination.addEventListener('blur', () => destination.removeAttribute('tabindex'), { once: true });
  });
  document.addEventListener('focusin', event => {
    if (!event.target.closest('.site-header')) setMenu(false);
  });
  mobile.addEventListener('change', () => setMenu(false));
})();
