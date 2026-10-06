// Kalis teklif sayfasının tarayıcı testi.
// Kullanım: KALIS_TEST_BASE=http://127.0.0.1:4198 KALIS_TEST_PATH=/kalis/index.html KALIS_TEST_OUTPUT=<klasör> node scripts/kalis/verify.mjs
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL('/Users/intiba/Documents/AIprojects/dome/node_modules/playwright/index.mjs').href);
const base = process.env.KALIS_TEST_BASE || 'http://127.0.0.1:4198';
const url = base + (process.env.KALIS_TEST_PATH || '/kalis/index.html');
const output = process.env.KALIS_TEST_OUTPUT || '/tmp/kalis-verify';
mkdirSync(output, { recursive: true });
const report = { passed: false, checks: [], consoleErrors: [], failedAssets: [] };
const pass = name => report.checks.push(name);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) report.failedAssets.push({ url: r.url(), status: r.status() }); });
  await page.goto(url, { waitUntil: 'networkidle' });

  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
  const text = await page.locator('body').innerText();
  for (const s of ['100.000 ₺', '350.000 ₺', '80.000 ₺', '4 taksit', 'İlk çekimin bedeli', 'Tek ödeme', 'Meta reklam', 'KDV dahil değildir']) assert.ok(text.includes(s), s);
  assert.ok(!/TikTok|Google reklam|Google İşletme Profili yönetimi|ertelen/i.test(text), 'Çıkarılan hizmetler ya da erteleme sayfada olmamalı');
  assert.ok(!/(^|[\s(])(toplam|yıllık)([\s:.,)]|$)/i.test(text), 'Toplam ya da yıllık tutar yazılmamalı');
  assert.ok(!/\bEge\b/.test(text), 'Ege vurgusu olmamalı');
  pass('fiyatlar_ve_odeme_plani_dogru_toplam_yok');

  const anchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.hash).filter(h => h.length > 1 && !document.querySelector(h)));
  assert.deepEqual(anchors, []);
  pass('baglantilar_gecerli');

  const items = page.locator('.pf-item');
  assert.equal(await items.count(), 6);
  await items.first().scrollIntoViewIfNeeded();
  await items.first().click();
  assert.equal(await page.locator('#vd').evaluate(d => d.open), true);
  await page.waitForFunction(() => { const v = document.querySelector('#vd-player'); return v.readyState >= 2 && !v.paused; }, null, { timeout: 20000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#vd').open && document.querySelector('#vd-player').paused);
  for (const src of await items.evaluateAll(list => list.map(b => b.dataset.video))) {
    const head = await page.request.fetch(src, { method: 'HEAD' });
    assert.equal(head.status(), 200, src);
  }
  pass('portfoy_videolari_aciliyor_ve_erisilebilir');

  await page.screenshot({ path: path.join(output, 'desktop-hero.png') });
  for (const id of ['teklif', 'odeme']) { await page.locator('#' + id).scrollIntoViewIfNeeded(); await page.locator('#' + id).screenshot({ path: path.join(output, `desktop-${id}.png`) }); }

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Yatay taşma: ${width}px`);
  }
  pass('yatay_tasma_yok');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const img of await page.locator('img').all()) { await img.scrollIntoViewIfNeeded(); await page.waitForTimeout(40); }
  await page.waitForTimeout(500);
  const broken = await page.locator('img').evaluateAll(list => list.filter(i => !(i.complete && i.naturalWidth)).map(i => i.getAttribute('src')));
  assert.deepEqual(broken, []);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, 'mobile-full.png'), fullPage: true });
  pass('tum_gorseller_yukleniyor');

  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.failedAssets, []);
  report.passed = true;
} catch (error) {
  report.error = String(error.stack || error);
} finally {
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
}
