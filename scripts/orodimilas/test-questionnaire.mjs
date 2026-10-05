// Görüşme soruları iş mantığının birim testi: gerçek e-posta ya da veritabanı kullanmaz.
// Kullanım: node scripts/orodimilas/test-questionnaire.mjs
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(process.env.TMPDIR || '/tmp', `orodimilas-questionnaire-${process.pid}.mjs`);
await build({ absWorkingDir: root, entryPoints: ['api/_lib/orodimilasQuestionnaire.ts'], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const lib = await import(pathToFileURL(outfile).href);

const results = [];
const check = async (name, fn) => { await fn(); results.push(name); };
const base = () => ({ requestId: crypto.randomUUID(), name: 'Emine Colin', email: 'Test@Example.com', answers: { q01: 'Fiyat ve bilinirlik' } });
function fakes({ failMail = false } = {}) {
  const docs = new Map(); const mails = [];
  return {
    docs, mails,
    deps: {
      store: { async create(id, data) { if (docs.has(id)) return 'exists'; docs.set(id, data); return 'created'; } },
      mail: async message => { if (failMail) throw new Error('down'); mails.push(message); },
    },
  };
}

await check('soru_listesi_30_ve_html_ile_ayni', () => {
  assert.equal(lib.QUESTION_IDS.length, 29);
  const html = readFileSync(path.join(root, 'public/orodimilas/index.html'), 'utf8');
  const json = JSON.parse(readFileSync(path.join(root, 'api/_lib/orodimilasQuestions.json'), 'utf8'));
  for (const group of json.groups) for (const q of group.questions) {
    assert.ok(html.includes(`name="${q.id}"`), `${q.id} formda yok`);
    assert.ok(html.includes(q.text.replaceAll("'", '&#39;')) || html.includes(q.text), `${q.id} metni formdakiyle aynı değil`);
  }
});
await check('gecerli_gonderim_kaydedilir_ve_eposta_gider', async () => {
  const f = fakes(); const input = lib.questionnaireSchema.parse(base());
  const r = await lib.submitQuestionnaire(input, f.deps);
  assert.match(r.reference, /^ODM-[0-9A-F]{10}$/); assert.equal(r.emailed, true);
  assert.equal(f.docs.size, 1); assert.equal(f.mails.length, 1);
  assert.equal(f.mails[0].to, lib.NOTIFY_TO); assert.equal(f.mails[0].replyTo, 'test@example.com');
  assert.match(f.mails[0].subject, /Emine Colin/); assert.match(f.mails[0].text, /1 \/ 29 soru yanıtlandı/);
});
await check('ayni_istek_tekrar_gelirse_ikinci_eposta_gitmez', async () => {
  const f = fakes(); const input = lib.questionnaireSchema.parse(base());
  await lib.submitQuestionnaire(input, f.deps);
  const again = await lib.submitQuestionnaire(input, f.deps);
  assert.equal(again.duplicate, true); assert.equal(f.mails.length, 1);
});
await check('eposta_hatasinda_cevap_kaybolmaz', async () => {
  const f = fakes({ failMail: true }); const input = lib.questionnaireSchema.parse(base());
  const r = await lib.submitQuestionnaire(input, f.deps);
  assert.equal(r.emailed, false); assert.equal(f.docs.size, 1);
});
await check('bot_tuzagi_ve_bos_gonderim_reddedilir', async () => {
  const f = fakes();
  await assert.rejects(lib.submitQuestionnaire(lib.questionnaireSchema.parse({ ...base(), website: 'x' }), f.deps), e => e.status === 400);
  await assert.rejects(lib.submitQuestionnaire(lib.questionnaireSchema.parse({ ...base(), answers: { q01: '   ' } }), f.deps), e => e.status === 400);
  assert.equal(f.docs.size, 0);
});
await check('gecersiz_alanlar_ve_bilinmeyen_sorular_reddedilir', () => {
  assert.equal(lib.questionnaireSchema.safeParse({ ...base(), email: 'gecersiz' }).success, false);
  assert.equal(lib.questionnaireSchema.safeParse({ ...base(), name: 'A' }).success, false);
  assert.equal(lib.questionnaireSchema.safeParse({ ...base(), answers: { q99: 'x' } }).success, false);
  assert.equal(lib.questionnaireSchema.safeParse({ ...base(), extra: 1 }).success, false);
  assert.equal(lib.questionnaireSchema.safeParse({ ...base(), answers: { q01: 'x'.repeat(4001) } }).success, false);
});
await check('eposta_html_kacisi', () => {
  const input = lib.questionnaireSchema.parse({ ...base(), name: '<script>x</script>', answers: { q01: '<img src=x onerror=1>' } });
  const { html } = lib.buildEmail(input, 'ODM-TEST');
  assert.ok(!html.includes('<script>') && !html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
});
console.log(JSON.stringify({ passed: true, checks: results }, null, 2));
