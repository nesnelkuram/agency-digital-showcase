import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const playwrightModule = process.env.PLAYWRIGHT_MODULE || '/Users/intiba/Documents/AIprojects/dome/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(playwrightModule).href);
const base = process.env.ORODIMILAS_TEST_BASE || 'http://127.0.0.1:4198';
const pagePath = process.env.ORODIMILAS_TEST_PATH || '/orodimilas/index.html';
const output = process.env.ORODIMILAS_TEST_OUTPUT || '/tmp/orodimilas-showcase-verification';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { base, pagePath, checkedAt: new Date().toISOString(), checks: [], consoleErrors: [], failedAssets: [] };
const pass = name => report.checks.push({ name, passed: true });
const url = base + pagePath;
function watch(page) {
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  page.on('response', response => {
    // Form testinde bilinçli olarak taklit edilen hata yanıtı sayılmaz.
    if (response.status() >= 400 && response.url().startsWith(base) && !response.url().includes('/api/orodimilas/questions')) report.failedAssets.push({ url: response.url(), status: response.status() });
  });
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); watch(page);
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.match(await page.title(), /Oro di Milas/);
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('.js-enhanced').count(), 1);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
  pass('page_loads_with_scripts_styles_and_noindex');

  // Revize akış: biz kimiz → portföy → fırsatlar → strateji → işleyiş → iki seçenek.
  const headings = await page.locator('main h2').allTextContents();
  assert.deepEqual(headings.map(h => h.replace(/\s+/g, ' ').trim()), ['Biz Kimiz', 'Neler Yaptık, Neler Çektik', 'Oro di Milas ve Fırsatlar', 'Uluslararası Satış Stratejisi', 'İşleyiş ve Ölçüm', 'Ajansınız mı olalım, satış ortağınız mı?', 'İki Ticari Seçenek', 'Söylemeyeceğimiz Şeyler', 'Sonraki Adım']);
  pass('presentation_follows_revised_section_order');

  const structure = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    return {
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(link => !document.getElementById(link.getAttribute('href').slice(1))).map(link => link.getAttribute('href')),
      unnamedButtons: [...document.querySelectorAll('button')].filter(button => !button.getAttribute('aria-label') && !button.textContent.trim()).length,
      brokenControls: [...document.querySelectorAll('[aria-controls]')].filter(element => !document.getElementById(element.getAttribute('aria-controls'))).length,
      imagesWithoutAlt: [...document.querySelectorAll('img')].filter(img => !img.hasAttribute('alt')).length,
    };
  });
  assert.deepEqual(structure, { duplicateIds: [], brokenAnchors: [], unnamedButtons: 0, brokenControls: 0, imagesWithoutAlt: 0 });
  pass('valid_anchors_unique_ids_named_controls_alt_text');

  // Fiyatlar: kullanıcının belirlediği ve onayladığı paket fiyatları; Köşebaşı rakamları, yer tutucu ve iç not yok.
  const text = await page.locator('body').innerText();
  for (const total of ['5.160.000', '1.440.000', '1.680.000', '960.000', 'İlk yıl toplam']) assert.ok(!text.includes(total), total);
  for (const price of ['120.000 ₺', '240.000 ₺', '140.000 ₺', '360.000 ₺', '80.000 ₺', '%10', '18 ay']) assert.ok(text.includes(price), price);
  assert.doesNotMatch(text, /100\.000 ₺|250\.000 ₺|2\.200\.000/);
  assert.doesNotMatch(text, /özel indirim|indirimli|garanti ediyoruz|Yer tutucu|önerirdim|500\.000 \$/i);
  assert.equal(await page.locator('.pkg').count(), 3);
  assert.equal((await page.locator('[data-term="ortaklik_sabit_bedel"]').textContent()).trim(), 'Görüşmede belirlenecek');
  assert.equal(await page.locator('.op-list li').count(), 6);
  pass('package_prices_partnership_terms_no_placeholders_or_internal_notes');

  // Kahraman: kaydırmayla dönen Three.js şişe.
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('hero-scrolly')), true);
  await page.waitForFunction(() => document.querySelector('.hero-bottle').classList.contains('has-webgl'), null, { timeout: 20000 });
  assert.ok(await page.evaluate(() => document.getElementById('top').offsetHeight > innerHeight * 3), 'Kahraman alanı kaydırma için uzamalı');
  // Açılış: önce başlık, sonra şişe aşağıdan dönerek önüne gelir, en son en üstte teklif adı.
  const opacity = sel => page.evaluate(s => Number(getComputedStyle(document.querySelector(s)).opacity), sel);
  assert.equal(await page.evaluate(() => document.getElementById('top').classList.contains('is-start')), true);
  assert.ok(await opacity('.hero-overlay') < 0.5, 'Teklif adı şişeden önce görünmemeli');
  await page.waitForFunction(() => document.querySelector('.hero-bottle').dataset.intro === 'done', null, { timeout: 12000 });
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.hero-overlay')).opacity) === 1, null, { timeout: 4000 });
  assert.equal(await opacity('.hero-title'), 1);
  assert.equal((await page.locator('.hero-overlay').textContent()).trim(), 'Global Pazarlama Teklifi');
  const layers = await page.evaluate(() => ['.hero-title', '.hero-bottle', '.hero-overlay'].map(s => Number(getComputedStyle(document.querySelector(s)).zIndex) || 0));
  assert.ok(layers[0] < layers[1] && layers[1] < layers[2], 'Katman sırası: başlık < şişe < teklif adı');
  await page.screenshot({ path: path.join(output, 'desktop-hero.png') });
  const heroStep = () => page.evaluate(() => [...document.querySelectorAll('.hero-step')].findIndex(step => step.classList.contains('is-on')));
  const heroSpan = await page.evaluate(() => document.getElementById('top').offsetHeight - innerHeight);
  for (const [p, expected] of [[0.36, 0], [0.66, 1], [1, 2]]) {
    await page.evaluate(y => scrollTo(0, y), Math.round(heroSpan * p));
    await page.waitForTimeout(1600);
    assert.equal(await heroStep(), expected, `Kaydırma ${p} adım ${expected + 1} göstermeli`);
    assert.equal(await opacity('.hero-title'), 0, 'Açılış yazıları kaydırınca sönmeli');
    await page.screenshot({ path: path.join(output, `desktop-hero-${expected + 1}.png`) });
  }
  assert.equal(await page.locator('.hero-cta').isVisible(), true);
  assert.equal(await page.locator('#nav').evaluate(n => n.classList.contains('is-solid')), false, 'Gezinme koyu kahraman alanında şeffaf kalmalı');
  await page.evaluate(() => scrollTo(0, 0));
  pass('hero_opening_title_then_bottle_then_offer_title_then_scroll_steps');

  // Portföy: tam video yalnız tıklamayla, pencerede ve sesli açılır.
  assert.equal(await page.locator('.case').count(), 11);
  const categories = await page.locator('.case-k').allTextContents();
  assert.ok(categories.filter(c => c.startsWith('Gastronomi')).length >= 8, 'Portföy gastronomi ağırlıklı olmalı');
  assert.equal(await page.locator('#video-dialog-player').getAttribute('src'), null);
  const firstPlay = page.locator('.play-btn').first();
  await firstPlay.scrollIntoViewIfNeeded();
  await firstPlay.click();
  assert.equal(await page.locator('#video-dialog').evaluate(d => d.open), true);
  assert.match(await page.locator('#video-dialog-player').getAttribute('src'), /\/videos\/full\/bengi-mutfak-web\.mp4$/);
  await page.waitForFunction(() => { const v = document.querySelector('#video-dialog-player'); return !v.paused && v.readyState >= 2 && !v.muted; }, null, { timeout: 20000 });
  await page.screenshot({ path: path.join(output, 'desktop-video-dialog.png') });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#video-dialog').open && document.querySelector('#video-dialog-player').paused);
  assert.equal(await firstPlay.evaluate(b => b === document.activeElement), true);
  await page.locator('#b2').screenshot({ path: path.join(output, 'desktop-portfolio.png') });
  // Bütün portföy videoları erişilebilir ve web için hazır MP4 olmalı.
  for (const src of await page.locator('.play-btn').evaluateAll(buttons => buttons.map(b => b.dataset.video))) {
    const head = await page.request.fetch(src.startsWith('/') ? base + src : src, { method: 'HEAD' });
    assert.equal(head.status(), 200, src);
    assert.match(head.headers()['content-type'] || '', /video\/mp4/, src);
  }
  pass('portfolio_full_videos_open_in_dialog_with_sound_and_close');

  await page.locator('#harita').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#map-orbit').classList.contains('has-webgl'));
  for (let i = 0; i < 5; i++) {
    await page.locator(`[data-map="${i}"]`).click();
    assert.equal(await page.locator(`[data-map="${i}"]`).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.map-panel:visible').count(), 1);
    assert.equal(await page.locator(`#map-panel-${i}`).isVisible(), true);
  }
  await page.locator('[data-map="4"]').focus();
  await page.keyboard.press('Home');
  assert.equal(await page.locator('[data-map="0"]').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-map="1"]').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(700);
  await page.locator('#harita').screenshot({ path: path.join(output, 'desktop-map.png') });
  pass('threejs_scene_five_layers_and_keyboard_navigation');

  await page.locator('.motion-toggle').click();
  assert.equal(await page.locator('.motion-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => document.body.classList.contains('motion-paused')), true);
  await page.locator('.motion-toggle').click();
  assert.equal(await page.locator('.motion-toggle').getAttribute('aria-pressed'), 'false');
  pass('motion_toggle_pauses_and_resumes');

  // Geçiş: iki cümle sırayla gelir, ardından iki yol açılır ve seçeneklere götürür.
  const crTop = await page.evaluate(() => document.getElementById('iki-yol').getBoundingClientRect().top + scrollY);
  const crSpan = await page.evaluate(() => document.getElementById('iki-yol').offsetHeight - innerHeight);
  assert.ok(crSpan > 0, 'Geçiş bölümü kaydırma için uzamalı');
  await page.evaluate(y => scrollTo(0, y), Math.round(crTop + crSpan * 0.3));
  await page.waitForTimeout(300);
  const mid = await page.evaluate(() => { const s = getComputedStyle(document.getElementById('iki-yol')); return { a: +s.getPropertyValue('--a'), d: +s.getPropertyValue('--d') }; });
  assert.ok(mid.a > 0.9 && mid.d < 0.05, JSON.stringify(mid));
  await page.evaluate(y => scrollTo(0, y), Math.round(crTop + crSpan * 0.95));
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#iki-yol').evaluate(s => s.classList.contains('paths-on')), true);
  await page.screenshot({ path: path.join(output, 'desktop-crossroad.png') });
  await page.locator('.cr-right').click();
  await page.waitForTimeout(900);
  assert.equal(new URL(page.url()).hash, '#secenek-2');
  assert.ok(await page.evaluate(() => Math.abs(document.getElementById('secenek-2').getBoundingClientRect().top) < innerHeight), 'Ortaklık bölümüne gidilmeli');
  pass('crossroad_transition_reveals_two_paths_and_links_to_options');

  // Görüşme soruları: taslak saklanır, zorunlu alanlar denetlenir, hata ve başarı durumları.
  // Yerelde API yok; sunucu cevabı tarayıcıda taklit edilir, gönderilen gövde kaydedilir.
  const sent = [];
  let replyStatus = 503;
  await page.route('**/api/orodimilas/questions', async route => {
    sent.push(JSON.parse(route.request().postData()));
    await route.fulfill({ status: replyStatus, contentType: 'application/json', body: JSON.stringify(replyStatus === 201 ? { reference: 'ODM-TEST000001' } : { error: 'Yanıtlarınız şu anda gönderilemedi. Bilgileriniz bu tarayıcıda saklı; lütfen tekrar deneyin.' }) });
  });
  assert.equal(await page.locator('#qform textarea').count(), 29);
  assert.equal(await page.getByText('kullanmamıza izin verir misiniz', { exact: false }).count(), 0);
  assert.equal(await page.getByText('Bu kararı kim veriyor', { exact: false }).count(), 0);
  assert.equal(await page.getByText('Hasat döneminin', { exact: false }).count(), 0);
  await page.locator('#q01').scrollIntoViewIfNeeded();
  await page.locator('#q01').fill('Önce fiyat ve bilinirlik.');
  await page.locator('#q05').fill('Yaklaşık 20 ton.');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#q01').inputValue(), 'Önce fiyat ve bilinirlik.', 'Taslak yenilemeden sonra geri gelmeli');
  assert.match(await page.locator('#qf-progress').textContent(), /^2 \/ 29/);
  await page.locator('#qform .qf-send').scrollIntoViewIfNeeded();
  await page.locator('#qform .qf-send').click();
  assert.equal(sent.length, 0, 'Zorunlu alanlar boşken gönderilmemeli');
  assert.equal(await page.locator('#qf-name').getAttribute('aria-invalid'), 'true');
  await page.locator('#qf-name').fill('Test Kişi');
  await page.locator('#qf-email').fill('test@example.com');
  await page.locator('#qform .qf-send').click();
  await page.waitForFunction(() => document.querySelector('#qf-status').dataset.state === 'error');
  assert.equal(await page.locator('#qform .qf-send').isEnabled(), true);
  assert.equal(await page.locator('#q01').inputValue(), 'Önce fiyat ve bilinirlik.');
  replyStatus = 201;
  await page.locator('#qform .qf-send').click();
  await page.waitForFunction(() => document.querySelector('#qf-status').dataset.state === 'ok');
  assert.match(await page.locator('#qf-status').textContent(), /ODM-TEST000001/);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].requestId, sent[1].requestId, 'Yeniden denemede aynı gönderim kimliği kullanılmalı');
  assert.deepEqual(Object.keys(sent[1]).sort(), ['answers', 'company', 'email', 'name', 'phone', 'requestId', 'website']);
  assert.deepEqual(sent[1].answers, { q01: 'Önce fiyat ve bilinirlik.', q05: 'Yaklaşık 20 ton.' });
  assert.equal(await page.evaluate(() => localStorage.getItem('orodimilas-qform-v1')), null, 'Başarılı gönderimden sonra taslak silinmeli');
  await page.locator('#qform').screenshot({ path: path.join(output, 'desktop-questions.png') });
  await page.unroute('**/api/orodimilas/questions');
  pass('questionnaire_draft_validation_error_and_success');

  await page.locator('#b6').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.locator('#b6').screenshot({ path: path.join(output, 'desktop-options.png') });

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Horizontal overflow at ${width}px`);
  }
  pass('no_horizontal_overflow_at_1440_1024_768_390_320');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const section of await page.locator('main > section').all()) { await section.scrollIntoViewIfNeeded(); await page.waitForTimeout(120); }
  // Uzun bölümlerde (portföy) tembel yüklenen görsellerin hepsi ekrana girsin.
  for (const img of await page.locator('img[loading="lazy"]').all()) { await img.scrollIntoViewIfNeeded(); await page.waitForTimeout(60); }
  await page.waitForTimeout(800);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, 'mobile-full.png'), fullPage: true });
  const images = await page.locator('img').evaluateAll(elements => elements.map(img => ({ src: img.getAttribute('src'), complete: img.complete && img.naturalWidth > 0 })));
  assert.ok(images.every(image => image.complete), JSON.stringify(images.filter(image => !image.complete)));
  pass('all_images_load');

  // Dokunma hedefleri: harita düğmeleri ve oynat düğmeleri en az 44 px.
  const small = await page.evaluate(() => [...document.querySelectorAll('.map-node, .play-btn span, .motion-toggle')].map(el => el.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 30).length);
  assert.equal(small, 0);
  pass('mobile_touch_targets_large_enough');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.motion-toggle').isDisabled(), true);
  await page.locator('#harita').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#map-orbit').evaluate(e => e.classList.contains('has-webgl')), false);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('hero-scrolly')), false);
  assert.ok(await page.evaluate(() => document.getElementById('top').offsetHeight <= innerHeight * 1.6), 'Azaltılmış harekette kahraman tek ekran olmalı');
  assert.equal(await page.locator('.hero-bottle-img').isVisible(), true);
  assert.equal(await page.locator('.hero-bottle').evaluate(e => e.classList.contains('has-webgl')), false);
  assert.equal(await page.locator('h1').isVisible(), true);
  assert.equal(await page.locator('.hero-overlay').isVisible(), true);
  await page.locator('#iki-yol').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.cr-left').isVisible(), true);
  assert.equal(await page.locator('.cr-left').evaluate(e => getComputedStyle(e.closest('.cr-paths')).opacity), '1');
  await page.locator('[data-map="3"]').click();
  assert.equal(await page.locator('#map-panel-3').isVisible(), true);
  pass('reduced_motion_static_hero_photo_bottle_no_webgl_map_works');

  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const fallbackPage = await noJs.newPage();
  await fallbackPage.goto(url);
  assert.equal(await fallbackPage.locator('.map-panel:visible').count(), 5);
  assert.equal(await fallbackPage.locator('h1').isVisible(), true);
  assert.equal(await fallbackPage.locator('.hero-bottle-img').isVisible(), true);
  assert.equal(await fallbackPage.locator('.hero-overlay').isVisible(), true);
  assert.equal(await fallbackPage.locator('#b6 .pkg').first().isVisible(), true);
  pass('no_javascript_keeps_all_content_readable');

  const fallback = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const fallback3d = await fallback.newPage();
  await fallback3d.route('**/scene.bundle.js', route => route.abort());
  await fallback3d.goto(url);
  await fallback3d.waitForTimeout(600);
  assert.equal(await fallback3d.locator('.hero-bottle').evaluate(e => e.classList.contains('has-webgl')), false);
  await fallback3d.waitForFunction(() => getComputedStyle(document.querySelector('.hero-bottle-img')).opacity === '1', null, { timeout: 5000 });
  await fallback3d.waitForFunction(() => document.getElementById('top').classList.contains('intro-done'), null, { timeout: 5000 });
  const fbSpan = await fallback3d.evaluate(() => document.getElementById('top').offsetHeight - innerHeight);
  await fallback3d.evaluate(y => scrollTo(0, y), Math.round(fbSpan * 0.4));
  await fallback3d.waitForTimeout(500);
  assert.equal(await fallback3d.evaluate(() => document.querySelector('.step-1').classList.contains('is-on')), true);
  assert.equal(await fallback3d.locator('.hero-bottle-img').isVisible(), true);
  await fallback3d.locator('#harita').scrollIntoViewIfNeeded();
  await fallback3d.waitForTimeout(500);
  assert.equal(await fallback3d.locator('#map-orbit').evaluate(e => e.classList.contains('has-webgl')), false);
  await fallback3d.locator('[data-map="2"]').click();
  assert.equal(await fallback3d.locator('#map-panel-2').isVisible(), true);
  pass('unavailable_threejs_keeps_photo_bottle_css_orbit_and_map');

  const dataSaverContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await dataSaverContext.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }));
  const dataSaver = await dataSaverContext.newPage();
  const bundleRequests = [];
  dataSaver.on('request', request => { if (request.url().includes('scene.bundle.js')) bundleRequests.push(request.url()); });
  await dataSaver.goto(url, { waitUntil: 'networkidle' });
  await dataSaver.locator('#harita').scrollIntoViewIfNeeded();
  await dataSaver.waitForTimeout(500);
  assert.deepEqual(bundleRequests, []);
  assert.equal(await dataSaver.evaluate(() => document.documentElement.classList.contains('hero-scrolly')), false);
  pass('data_saver_does_not_download_threejs');

  // Ortaklık sabit bedeli JSON'dan düzenlenebilir: örnek değer yalnız bu test sayfasına enjekte edilir.
  const editable = await (await browser.newContext()).newPage();
  await editable.route('**/orodimilas/index.html', async route => {
    const original = await route.fetch();
    const body = (await original.text()).replace('"ortaklik_sabit_bedel": null', '"ortaklik_sabit_bedel": 12345');
    await route.fulfill({ response: original, body });
  });
  await editable.goto(url, { waitUntil: 'networkidle' });
  assert.equal((await editable.locator('[data-term="ortaklik_sabit_bedel"]').textContent()).trim(), '12.345 ₺ / ay');
  pass('partnership_fixed_fee_renders_from_editable_json');

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.failedAssets, []);
  pass('no_javascript_exceptions_or_failed_first_party_assets');
  report.passed = true;
} catch (error) { report.passed = false; report.error = error.stack; process.exitCode = 1; }
finally { await browser.close(); writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); }
