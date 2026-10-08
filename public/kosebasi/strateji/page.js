const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = navigator.connection?.saveData === true;
let manuallyPaused = false;
let scene;
let sceneLoading = false;
let activeLayer = 0;
const dialog = $('#film-dialog');
const fullFilm = $('#full-film');
const motionButton = $('.motion-toggle');
const ambientVideos = $$('.ambient-video');
const visibleVideos = new Set();
const shouldAnimate = () => !reducedMotion.matches && !saveData && !manuallyPaused && !document.hidden && !dialog.open;

function updateVideo(video) {
  if (visibleVideos.has(video) && shouldAnimate()) {
    if (!video.getAttribute('src')) {
      video.src = video.dataset.src;
      video.addEventListener('playing', () => video.classList.add('is-ready'), { once: true });
    }
    video.play().catch(() => { /* Poster remains available when autoplay is denied. */ });
  } else video.pause();
}

function updateMotion() {
  ambientVideos.forEach(updateVideo);
  scene?.setMotion(shouldAnimate());
  const paused = manuallyPaused || reducedMotion.matches || saveData;
  document.body.classList.toggle('motion-paused', paused);
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.setAttribute('aria-label', reducedMotion.matches ? 'Sistem tercihi: azaltılmış hareket' : saveData ? 'Sistem tercihi: veri tasarrufu' : paused ? 'Hareketli görselleri oynat' : 'Hareketli görselleri duraklat');
  $('.motion-label').textContent = reducedMotion.matches ? 'Hareket azaltıldı' : saveData ? 'Veri tasarrufu açık' : paused ? 'Hareketi oynat' : 'Hareketi durdur';
  $('.motion-symbol').textContent = paused ? '▷' : 'Ⅱ';
  motionButton.disabled = reducedMotion.matches || saveData;
}
motionButton.addEventListener('click', () => { manuallyPaused = !manuallyPaused; updateMotion(); if (!manuallyPaused) loadScene(); });
reducedMotion.addEventListener('change', () => { updateMotion(); if (!reducedMotion.matches) loadScene(); });
document.addEventListener('visibilitychange', updateMotion);
const videoObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) visibleVideos.add(entry.target); else visibleVideos.delete(entry.target);
    updateVideo(entry.target);
  }
}, { threshold: 0.08 });
ambientVideos.forEach(video => videoObserver.observe(video));

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -25px 0px' });
$$('[data-reveal]').forEach(element => revealObserver.observe(element));

const header = $('#site-header');
const progress = $('.reading-progress');
let scrollQueued = false;
function updateScroll() {
  const height = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${height > 0 ? scrollY / height : 0})`;
  header.classList.toggle('is-scrolled', scrollY > 90);
  scrollQueued = false;
}
addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScroll); } }, { passive: true });
addEventListener('resize', updateScroll);
updateScroll();

const menuToggle = $('.menu-toggle');
const mobileNav = $('#mobile-nav');
function closeMenu() {
  mobileNav.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Menüyü aç');
}
menuToggle.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') !== 'true';
  mobileNav.hidden = !expanded;
  menuToggle.setAttribute('aria-expanded', String(expanded));
  menuToggle.setAttribute('aria-label', expanded ? 'Menüyü kapat' : 'Menüyü aç');
});
$$('a', mobileNav).forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuToggle.focus(); }
});
const navObserver = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    $$('.desktop-nav a').forEach(link => link.classList.toggle('is-current', link.hash === '#' + entry.target.id));
  }
}, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
['mesele', 'harita', 'hikaye'].forEach(id => navObserver.observe(document.getElementById(id)));

const nodes = $$('.map-node');
const panels = $$('.map-panel');
function selectLayer(index) {
  activeLayer = index;
  nodes.forEach((node, i) => {
    node.classList.toggle('is-active', i === index);
    node.setAttribute('aria-pressed', String(i === index));
  });
  panels.forEach((panel, i) => {
    panel.hidden = i !== index;
    panel.classList.remove('is-entering');
  });
  void panels[index].offsetWidth;
  panels[index].classList.add('is-entering');
  scene?.setLayer(index);
}
nodes.forEach((node, index) => {
  node.addEventListener('click', () => selectLayer(index));
  node.addEventListener('keydown', event => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + nodes.length) % nodes.length;
    selectLayer(next); nodes[next].focus();
  });
});
selectLayer(0);

async function loadScene() {
  if (scene || sceneLoading || !shouldAnimate()) return;
  sceneLoading = true;
  try {
    const { createStrategyScene } = await import('./scene.bundle.js');
    scene = createStrategyScene($('#strategy-canvas'), $('#map-orbit'));
    scene.setLayer(activeLayer);
    scene.setMotion(shouldAnimate());
  } catch { /* The CSS orbit and HTML map are complete without WebGL. */ }
}
const sceneObserver = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) { loadScene(); sceneObserver.disconnect(); }
}, { rootMargin: '200px' });
sceneObserver.observe($('#harita'));

let filmTrigger;
$$('[data-open-film]').forEach(button => button.addEventListener('click', () => {
  filmTrigger = button;
  closeMenu();
  if (!fullFilm.getAttribute('src')) fullFilm.src = '/kosebasi/strateji/assets/film.mp4';
  dialog.showModal();
  document.body.classList.add('modal-open');
  updateMotion();
  fullFilm.play().catch(() => { /* Native controls allow user-initiated playback. */ });
}));
$('#close-film').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  fullFilm.pause();
  document.body.classList.remove('modal-open');
  updateMotion();
  filmTrigger?.focus({ preventScroll: true });
});
addEventListener('pagehide', () => { ambientVideos.forEach(video => video.pause()); fullFilm.pause(); scene?.setMotion(false); });
addEventListener('pageshow', updateMotion);
updateMotion();
document.documentElement.classList.add('js-enhanced');
