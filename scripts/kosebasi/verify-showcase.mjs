import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const playwrightModule = process.env.PLAYWRIGHT_MODULE || '/Users/intiba/Documents/AIprojects/dome/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(playwrightModule).href);
const base = process.env.KOSEBASI_TEST_BASE || 'http://127.0.0.1:4197';
const output = process.env.KOSEBASI_TEST_OUTPUT || '/tmp/kosebasi-showcase-verification';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { base, checkedAt: new Date().toISOString(), checks: [], consoleErrors: [], failedAssets: [] };
const pass = name => report.checks.push({ name, passed: true });
function watch(page) {
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(base)) report.failedAssets.push({ url: response.url(), status: response.status() });
  });
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); watch(page);
  for (const suffix of ['', '/', '/index.html']) {
    const response = await page.goto(base + '/kosebasi/strateji' + suffix, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    assert.match(await page.title(), /Köşebaşı — Ustalığın/);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('.js-enhanced').count(), 1);
  }
  pass('all_three_route_variants_load_the_showcase_with_scripts_and_styles');
  await page.goto(base + '/kosebasi/strateji/', { waitUntil: 'networkidle' });
  const structure = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    return {
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(link => !document.getElementById(link.getAttribute('href').slice(1))).map(link => link.getAttribute('href')),
      unnamedButtons: [...document.querySelectorAll('button')].filter(button => !button.getAttribute('aria-label') && !button.textContent.trim()).length,
      brokenControls: [...document.querySelectorAll('[aria-controls]')].filter(element => !document.getElementById(element.getAttribute('aria-controls'))).length,
    };
  });
  assert.deepEqual(structure, { duplicateIds: [], brokenAnchors: [], unnamedButtons: 0, brokenControls: 0 });
  pass('valid_anchor_targets_unique_ids_named_controls_and_aria_references');
  await page.waitForTimeout(1700);
  await page.screenshot({ path: path.join(output, 'desktop-hero.png') });
  await page.waitForFunction(() => !document.querySelector('.hero video').paused && document.querySelector('.hero video').readyState >= 2);
  await page.locator('.motion-toggle').click();
  assert.equal(await page.locator('.motion-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ambient-video')].every(v => v.paused)), true);
  await page.locator('.motion-toggle').click();
  pass('muted_inline_autoplay_and_global_pause_resume');
  await page.locator('[data-open-film]').click();
  assert.equal(await page.locator('#film-dialog').evaluate(d => d.open), true);
  await page.waitForFunction(() => document.querySelector('#full-film').readyState >= 2);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ambient-video')].every(v => v.paused)), true);
  await page.keyboard.press('Escape');
  // Native dialog close events are queued; wait for the close handler to run.
  await page.waitForFunction(() => !document.querySelector('#film-dialog').open && document.querySelector('#full-film').paused);
  assert.equal(await page.locator('#film-dialog').evaluate(d => d.open), false);
  assert.equal(await page.locator('#full-film').evaluate(v => v.paused), true);
  assert.equal(await page.locator('[data-open-film]').evaluate(b => b === document.activeElement), true);
  pass('film_opens_plays_closes_with_escape_and_restores_focus');
  await page.locator('#harita').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#map-orbit').classList.contains('has-webgl'));
  for (let i = 0; i < 6; i++) {
    await page.locator(`[data-map="${i}"]`).click();
    assert.equal(await page.locator(`[data-map="${i}"]`).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.map-panel:visible').count(), 1);
    assert.equal(await page.locator(`#map-panel-${i}`).isVisible(), true);
  }
  await page.locator('[data-map="5"]').focus();
  await page.keyboard.press('Home');
  assert.equal(await page.locator('[data-map="0"]').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-map="1"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-map="0"]').click();
  await page.waitForTimeout(650);
  await page.locator('#harita').screenshot({ path: path.join(output, 'desktop-map.png') });
  pass('threejs_scene_six_map_layers_and_keyboard_navigation');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Horizontal overflow at ${width}px`);
  }
  pass('no_horizontal_overflow_at_1440_1024_768_390_320');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.evaluate(() => { window.__showcaseNavigationCheck = 'same-document'; });
  await page.locator('.menu-toggle').click();
  assert.equal(await page.locator('#mobile-nav').isVisible(), true);
  await page.locator('#mobile-nav a[href="#hikaye"]').click();
  assert.equal(await page.locator('#mobile-nav').isVisible(), false);
  assert.equal(new URL(page.url()).hash, '#hikaye');
  assert.equal(await page.evaluate(() => window.__showcaseNavigationCheck), 'same-document', 'Chapter navigation must not reload the page.');
  await page.waitForTimeout(1100);
  pass('mobile_menu_opens_navigates_and_closes');
  for (const section of await page.locator('main > section').all()) {
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1100);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, 'mobile-full.png'), fullPage: true });
  await page.screenshot({ path: path.join(output, 'mobile-hero.png') });
  const images = await page.locator('img').evaluateAll(elements => elements.map(img => ({ src: img.getAttribute('src'), complete: img.complete && img.naturalWidth > 0 })));
  assert.ok(images.every(image => image.complete), JSON.stringify(images.filter(image => !image.complete)));
  pass('all_poster_and_logo_images_load');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ambient-video')].every(video => !video.getAttribute('src') && video.paused)), true);
  assert.equal(await page.locator('.motion-toggle').isDisabled(), true);
  await page.locator('#harita').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#map-orbit').evaluate(e => e.classList.contains('has-webgl')), false);
  await page.locator('[data-map="4"]').click();
  assert.equal(await page.locator('#map-panel-4').isVisible(), true);
  pass('reduced_motion_has_no_autoplay_or_webgl_but_map_still_works');
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const fallbackPage = await noJs.newPage();
  await fallbackPage.goto(base + '/kosebasi/strateji/');
  assert.equal(await fallbackPage.locator('.map-panel:visible').count(), 6);
  assert.equal(await fallbackPage.locator('h1').isVisible(), true);
  pass('no_javascript_keeps_all_strategy_content_readable');
  const fallback = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const fallback3d = await fallback.newPage();
  await fallback3d.route('**/scene.bundle.js', route => route.abort());
  await fallback3d.goto(base + '/kosebasi/strateji/');
  await fallback3d.locator('#harita').scrollIntoViewIfNeeded();
  await fallback3d.locator('[data-map="3"]').click();
  assert.equal(await fallback3d.locator('#map-panel-3').isVisible(), true);
  pass('unavailable_threejs_keeps_css_orbit_and_interactive_map');
  const dataSaverContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await dataSaverContext.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }));
  const dataSaver = await dataSaverContext.newPage();
  await dataSaver.goto(base + '/kosebasi/strateji/', { waitUntil: 'networkidle' });
  await dataSaver.locator('#harita').scrollIntoViewIfNeeded();
  assert.equal(await dataSaver.evaluate(() => [...document.querySelectorAll('.ambient-video')].every(video => !video.getAttribute('src'))), true);
  assert.equal(await dataSaver.locator('#map-orbit').evaluate(element => element.classList.contains('has-webgl')), false);
  pass('data_saver_does_not_download_ambient_video_or_threejs');
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.failedAssets, []);
  pass('no_javascript_exceptions_or_failed_first_party_assets');
  report.passed = true;
} catch (error) { report.passed = false; report.error = error.stack; process.exitCode = 1; }
finally { await browser.close(); writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); }
