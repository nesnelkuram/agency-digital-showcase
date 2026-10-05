const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const saveData = navigator.connection?.saveData === true;
let manuallyPaused = false;
let scene;
let sceneLoading = false;
let activeLayer = 0;
const shouldAnimate = () => !reducedMotion.matches && !saveData && !manuallyPaused && !document.hidden;

/* ───────── Gezinme ve okuma çubuğu ───────── */
const nav = $('#nav');
const bar = $('#progress');
const navLinks = $$('ol a', nav);
const navTargets = navLinks.map(link => document.getElementById(link.hash.slice(1)));
let scrollQueued = false;
const hero = $('#top');
function updateScroll() {
  const vh = innerHeight;
  nav.classList.toggle('is-solid', hero.getBoundingClientRect().bottom <= 64);
  updateHero();
  updateCrossroad();
  const max = document.documentElement.scrollHeight - vh;
  bar.style.width = (max > 0 ? Math.min(100, (scrollY / max) * 100) : 0) + '%';
  let active = -1;
  navTargets.forEach((target, i) => { if (target && target.getBoundingClientRect().top <= vh * 0.4) active = i; });
  navLinks.forEach((link, i) => {
    link.classList.toggle('is-active', i === active);
    if (i === active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  });
  scrollQueued = false;
}
addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScroll); } }, { passive: true });
addEventListener('resize', updateScroll);

/* ───────── Kahraman: kaydırmayla dönen şişe ───────── */
const root = document.documentElement;
const heroSteps = $$('.hero-step', hero);
const heroImg = $('.hero-bottle-img', hero);
// Açılış (başlık + teklif adı) kaydırmanın başında görünür; ardından üç metin adımı gelir.
// WebGL yokken fotoğraf şişe aynı yatay konumları izler (bottle.js ana kareleriyle aynı).
const STEP_WINDOWS = [[0.22, 0.47], [0.53, 0.77], [0.83, 2]];
const START_END = 0.17;
const IMG_KEYS = [[0, 0, 0.98], [0.34, -21, 1.12], [0.64, 21, 1.06], [1, -20, 1]];
const pageStart = performance.now();
let bottle;
let bottleLoading = false;
function heroProgress() {
  const rect = hero.getBoundingClientRect();
  const span = rect.height - innerHeight;
  return span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
}
function updateHero() {
  if (!root.classList.contains('hero-scrolly')) {
    heroSteps.forEach(step => step.classList.remove('is-on'));
    return;
  }
  const p = heroProgress();
  heroSteps.forEach((step, i) => step.classList.toggle('is-on', p >= STEP_WINDOWS[i][0] && p < STEP_WINDOWS[i][1]));
  hero.classList.toggle('is-start', p < START_END);
  hero.classList.toggle('is-scrolled', p > 0.02);
  let k = 0;
  while (k < IMG_KEYS.length - 2 && p > IMG_KEYS[k + 1][0]) k++;
  const [p0, x0, s0] = IMG_KEYS[k], [p1, x1, s1] = IMG_KEYS[k + 1];
  const t = Math.min(1, Math.max(0, (p - p0) / (p1 - p0)));
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  heroImg.style.setProperty('--bx', (x0 + (x1 - x0) * e) + 'vw');
  heroImg.style.setProperty('--bs', s0 + (s1 - s0) * e);
  heroImg.style.setProperty('--by', (p < START_END ? 50 : 35) + '%');
  bottle?.setProgress(p);
}
async function loadBottle() {
  if (bottle || bottleLoading || !root.classList.contains('hero-scrolly')) return;
  bottleLoading = true;
  const holder = $('.hero-bottle');
  holder.classList.add('is-loading');
  try {
    const { createBottleScene } = await import('/orodimilas/scene.bundle.js');
    const intro = !manuallyPaused && scrollY < innerHeight;
    bottle = await createBottleScene($('#bottle-canvas'), $('.hero-bottle'), {
      intro,
      // Önce başlık görünsün; şişe yaklaşık bir saniye sonra aşağıdan gelir.
      introDelay: intro ? Math.max(0, 1000 - (performance.now() - pageStart)) : 0,
      onIntroDone: () => hero.classList.add('intro-done'),
    });
    bottle.setMotion(!manuallyPaused && !document.hidden);
    bottle.setProgress(heroProgress());
  } catch {
    /* Fotoğraf şişe yükselir, metin adımları WebGL olmadan da çalışır. */
    setTimeout(() => hero.classList.add('intro-done'), 2200);
  }
  finally { bottleLoading = false; holder.classList.remove('is-loading'); }
}
// Şişe hiç gelmezse (yavaş bağlantı) teklif adı yine de görünür.
setTimeout(() => hero.classList.add('intro-done'), 6000);
function setHeroMode() {
  const animated = !reducedMotion.matches && !saveData;
  const y = scrollY;
  const wasScrolly = root.classList.contains('hero-scrolly');
  root.classList.toggle('hero-scrolly', animated);
  if (wasScrolly !== animated && y > 0) document.getElementById('icerik').scrollIntoView();
  updateHero();
  if (animated) loadBottle();
}
/* ───────── Geçiş: ajansınız mı, satış ortağınız mı ───────── */
const crossroad = $('#iki-yol');
const smooth = t => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
function updateCrossroad() {
  if (!root.classList.contains('hero-scrolly')) return;
  const rect = crossroad.getBoundingClientRect();
  const span = rect.height - innerHeight;
  const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 1;
  // Klavye odağı geçişteyse iki yol hemen görünür.
  const focused = crossroad.matches(':focus-within');
  const a = focused ? 1 : smooth((p - 0.02) / 0.2);
  const b = focused ? 1 : smooth((p - 0.2) / 0.2);
  const c = focused ? 1 : smooth((p - 0.42) / 0.22);
  const d = focused ? 1 : smooth((p - 0.6) / 0.22);
  crossroad.style.setProperty('--a', a.toFixed(3));
  crossroad.style.setProperty('--b', b.toFixed(3));
  crossroad.style.setProperty('--c', c.toFixed(3));
  crossroad.style.setProperty('--d', d.toFixed(3));
  crossroad.classList.toggle('paths-on', d > 0.6);
}
crossroad.addEventListener('focusin', updateCrossroad);
crossroad.addEventListener('focusout', () => requestAnimationFrame(updateCrossroad));

setHeroMode();
updateScroll();

/* ───────── Bölümlerin belirmesi ───────── */
const revealEls = $$('.rv');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); revealObserver.unobserve(entry.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  revealEls.forEach(el => revealObserver.observe(el));
} else revealEls.forEach(el => el.classList.add('in'));

/* ───────── Hareket kontrolü ───────── */
const motionButton = $('.motion-toggle');
function updateMotion() {
  const paused = manuallyPaused || reducedMotion.matches || saveData;
  document.body.classList.toggle('motion-paused', paused);
  scene?.setMotion(shouldAnimate());
  bottle?.setMotion(!manuallyPaused && !document.hidden && !videoDialog?.open);
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.setAttribute('aria-label', reducedMotion.matches ? 'Sistem tercihi: azaltılmış hareket' : saveData ? 'Sistem tercihi: veri tasarrufu' : paused ? 'Hareketli görselleri oynat' : 'Hareketli görselleri duraklat');
  $('.motion-label', motionButton).textContent = reducedMotion.matches ? 'Hareket azaltıldı' : saveData ? 'Veri tasarrufu' : paused ? 'Hareketi oynat' : 'Hareketi durdur';
  $('.motion-symbol', motionButton).textContent = paused ? '▷' : 'Ⅱ';
  motionButton.disabled = reducedMotion.matches || saveData;
}
motionButton.addEventListener('click', () => { manuallyPaused = !manuallyPaused; updateMotion(); if (!manuallyPaused) maybeLoadScene(); });
reducedMotion.addEventListener('change', () => { setHeroMode(); updateMotion(); maybeLoadScene(); });
document.addEventListener('visibilitychange', updateMotion);

/* ───────── Bütünleşik harita ───────── */
const nodes = $$('.map-node');
const panels = $$('.map-panel');
function selectLayer(index) {
  activeLayer = index;
  nodes.forEach((node, i) => {
    node.classList.toggle('is-active', i === index);
    node.setAttribute('aria-pressed', String(i === index));
  });
  panels.forEach((panel, i) => { panel.hidden = i !== index; panel.classList.remove('is-entering'); });
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
    selectLayer(next);
    nodes[next].focus();
  });
});
selectLayer(0);

let mapNear = false;
async function maybeLoadScene() {
  if (!mapNear || scene || sceneLoading || !shouldAnimate()) return;
  sceneLoading = true;
  try {
    const { createChannelScene } = await import('/orodimilas/scene.bundle.js');
    scene = createChannelScene($('#channel-canvas'), $('#map-orbit'));
    scene.setLayer(activeLayer);
    scene.setMotion(shouldAnimate());
  } catch { /* CSS yörüngesi ve HTML harita WebGL olmadan da eksiksiz çalışır. */ }
  finally { sceneLoading = false; }
}
const sceneObserver = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) { mapNear = true; maybeLoadScene(); sceneObserver.disconnect(); }
}, { rootMargin: '200px' });
sceneObserver.observe($('#harita'));

/* ───────── Portföy: tam videolar ───────── */
// Video yalnız kullanıcı bir işe tıkladığında yüklenir ve sesli oynar; sayfada otomatik oynatma yok.
const videoDialog = $('#video-dialog');
const dialogPlayer = $('#video-dialog-player');
let videoTrigger;
$$('.play-btn').forEach(button => button.addEventListener('click', () => {
  videoTrigger = button;
  $('#video-dialog-title').textContent = button.dataset.title;
  dialogPlayer.poster = $('img', button.closest('.case-media')).currentSrc;
  if (dialogPlayer.getAttribute('src') !== button.dataset.video) dialogPlayer.src = button.dataset.video;
  videoDialog.showModal();
  document.body.classList.add('modal-open');
  bottle?.setMotion(false);
  dialogPlayer.play().catch(() => { /* Yerel denetimlerle başlatılabilir. */ });
}));
$('#video-dialog-close').addEventListener('click', () => videoDialog.close());
videoDialog.addEventListener('click', event => { if (event.target === videoDialog) videoDialog.close(); });
videoDialog.addEventListener('close', () => {
  dialogPlayer.pause();
  document.body.classList.remove('modal-open');
  updateMotion();
  videoTrigger?.focus({ preventScroll: true });
});

/* ───────── Ücret ve komisyon alanları ───────── */
let terms = {};
try { terms = JSON.parse($('#ticari-kosullar').textContent) || {}; } catch { terms = {}; }
const isNumber = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const money = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
$$('[data-term]').forEach(el => {
  const value = terms[el.dataset.term];
  if (!isNumber(value)) return;
  const unit = typeof terms[el.dataset.term + '_birim'] === 'string' ? ' ' + terms[el.dataset.term + '_birim'].trim() : '';
  el.textContent = el.dataset.format === 'percent' ? '%' + percent.format(value) : money.format(value) + ' ₺' + unit;
  el.classList.add('is-set');
});

/* ───────── Görüşme soruları ───────── */
// Taslak bu tarayıcıda saklanır; aynı gönderim kimliği yeniden denemelerde çift kaydı önler.
const qform = $('#qform');
const DRAFT_KEY = 'orodimilas-qform-v1';
const qStatus = $('#qf-status');
const qProgress = $('#qf-progress');
const qAreas = $$('textarea', qform);
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } };
const writeDraft = draft => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* Gizli pencere: taslak saklanamaz. */ } };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
let draft = readDraft() || { requestId: newId(), values: {} };
function grow(area) { area.style.height = 'auto'; area.style.height = Math.min(area.scrollHeight + 2, 480) + 'px'; }
function progress() {
  const done = qAreas.filter(area => area.value.trim()).length;
  qProgress.textContent = `${done} / ${qAreas.length} soru yanıtlandı`;
}
for (const field of qform.elements) {
  if (!field.name || field.name === 'website') continue;
  if (draft.values[field.name] !== undefined) field.value = draft.values[field.name];
  field.addEventListener('input', () => {
    draft.values[field.name] = field.value;
    writeDraft(draft);
    if (field.tagName === 'TEXTAREA') { grow(field); progress(); }
    field.removeAttribute('aria-invalid');
  });
}
qAreas.forEach(grow);
progress();
qform.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('.qf-send', qform);
  const name = qform.elements.name, email = qform.elements.email;
  const invalid = [];
  if (name.value.trim().length < 2) invalid.push(name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) invalid.push(email);
  invalid.forEach(field => field.setAttribute('aria-invalid', 'true'));
  if (invalid.length) { qStatus.textContent = 'Lütfen ad soyad ve geçerli bir e-posta adresi yazın.'; qStatus.dataset.state = 'error'; invalid[0].focus(); return; }
  const answers = Object.fromEntries(qAreas.filter(area => area.value.trim()).map(area => [area.name, area.value.trim()]));
  if (!Object.keys(answers).length) { qStatus.textContent = 'Lütfen en az bir soruyu yanıtlayın.'; qStatus.dataset.state = 'error'; qAreas[0].focus(); return; }
  button.disabled = true; button.textContent = 'Gönderiliyor…';
  qStatus.textContent = ''; qStatus.dataset.state = '';
  try {
    const response = await fetch('/api/orodimilas/questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: draft.requestId, name: name.value.trim(), email: email.value.trim(),
        phone: qform.elements.phone.value.trim(), company: qform.elements.company.value.trim(),
        answers, website: qform.elements.website.value,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Yanıtlarınız şu anda gönderilemedi. Lütfen tekrar deneyin.');
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* yok */ }
    qform.classList.add('is-sent');
    qStatus.dataset.state = 'ok';
    qStatus.textContent = `Teşekkürler, yanıtlarınız bize ulaştı. Referans: ${body.reference}`;
    button.textContent = 'Gönderildi';
  } catch (error) {
    qStatus.dataset.state = 'error';
    qStatus.textContent = error instanceof TypeError ? 'Bağlantı kurulamadı. Yanıtlarınız bu tarayıcıda saklı; lütfen tekrar deneyin.' : error.message;
    button.disabled = false; button.textContent = 'Gönder';
  }
});

addEventListener('pagehide', () => { scene?.setMotion(false); bottle?.setMotion(false); dialogPlayer.pause(); });
addEventListener('pageshow', updateMotion);
updateMotion();
document.documentElement.classList.add('js-enhanced');
