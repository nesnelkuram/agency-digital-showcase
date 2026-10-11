#!/usr/bin/env node
/**
 * Yerel Instagram planlama incelemesi için küçük fixture üretir.
 * Gerçek kaynaklardan YALNIZ metadata yazar (görsel baytı, mutlak yol, caption yok).
 * Görseller çalışma zamanında, loopback sunucu allowlist'i üzerinden okunur.
 *   DIECI_REVIEW_CODEX_DIR, DIECI_REVIEW_HISTORY_DIR: kaynak kök dizinler (varsayılan: Codex klasörleri)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CODEX = process.env.DIECI_REVIEW_CODEX_DIR || '/Users/intiba/Documents/Codex/2026-10-09/task/dieci-weekly-pilot-2026-10-12';
const HIST = process.env.DIECI_REVIEW_HISTORY_DIR || '/Users/intiba/Documents/Codex/2026-10-09/task/dieci-instagram-research-2026-10-10';
const OUT = fileURLToPath(new URL('../studio/feedPlanner/review/fixture.json', import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);

const plan = read(path.join(CODEX, 'plan-2026-10-12-18.json'));
const manifest = read(path.join(CODEX, 'dieci-selected-originals', 'manifest.json'));
const inv = read(path.join(CODEX, 'inventory-full.json')).items;
const evidence = read(path.join(HIST, 'evidence-43.json'));
const invById = new Map(inv.map((x) => [x.asset_id, x]));
const manById = new Map(manifest.items.map((x) => [x.asset_id, x]));

const assets = {};
let keyN = 0;
const key = (root, rel) => {
  const k = `a${String(++keyN).padStart(3, '0')}`;
  assets[k] = { root, rel };
  return k;
};
const aiMark = (s) => (s || '').startsWith('olası') ? 'olası' : s === 'belirsiz' ? 'belirsiz' : 'yok';
const human = (s) => (s || '').startsWith('evet') ? 'evet' : s === 'hayır' ? 'hayır' : 'bilinmiyor';
const semantic = (note) => {
  const n = (note || '').toLocaleLowerCase('tr-TR');
  let shotScale = 'bilinmiyor';
  if (/detay|yakın|yakından/.test(n)) shotScale = 'yakın';
  else if (/mekân|mekan|atmosfer|salon|geniş/.test(n)) shotScale = 'geniş';
  let subjectPos = 'bilinmiyor';
  if (/ortada|merkez/.test(n)) subjectPos = 'merkez';
  else if (/sol /.test(n + ' ')) subjectPos = 'sol';
  else if (/sağ /.test(n + ' ')) subjectPos = 'sağ';
  else if (/üst kısm|üst bölüm/.test(n)) subjectPos = 'üst';
  else if (/alt kısm|alt bölüm/.test(n)) subjectPos = 'alt';
  const source = shotScale !== 'bilinmiyor' || subjectPos !== 'bilinmiyor' ? 'nottan' : 'bilinmiyor';
  return { shotScale, subjectPos, source };
};
const slugify = (s) => s.toLocaleLowerCase('tr').replace(/â/g, 'a').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const orient = (w, h) => (w === h ? 'kare' : w > h ? 'yatay' : 'dikey');

// Haftalık plan: 9 hikâye karesi (copy/tarih değişmez; yalnız okunur)
const weeklyStory = [];
const candidates = [];
const selectedIds = new Set();
for (const day of plan.days) {
  for (const it of day.items) {
    const m = manById.get(it.asset_id);
    const meta = invById.get(it.asset_id) || {};
    selectedIds.add(it.asset_id);
    weeklyStory.push(it.asset_id);
    candidates.push({
      id: it.asset_id,
      imageKey: key('codex', path.join('web-previews', `${it.asset_id}.jpg`)),
      brand: 'dieci',
      kind: 'photo',
      origin: 'downloads',
      provenance: `Canva klasörü · haftalık plan ${day.gun} · kare ${it.frame} (indirilen orijinal, değiştirilmemiş)`,
      published: false,
      dims: { w: m.width_px, h: m.height_px },
      orientation: orient(m.width_px, m.height_px),
      dimsSource: 'kaynak',
      group: meta.grup || 'bilinmiyor',
      note: meta.konu || it.konu || '',
      aiMark: aiMark(meta.ai_isareti),
      humanPresence: human(meta.insan_kadraj),
      semantic: semantic(meta.konu || it.konu),
      weekFrame: { day: day.gun, frame: it.frame, copy: it.cover_text_tr || '', seriesKey: slugify(day.seri || '') || undefined },
    });
  }
}

// Havuz: Canva envanterinin TAMAMI (445 fotoğraf + 2 video kapağı). Haftalık hikâye kareleri ayrı tutulur.
const pool = inv.filter((x) => x.onizleme && exists(path.join(CODEX, x.onizleme)) && !selectedIds.has(x.asset_id));
const picked = [...pool].sort((a, b) => a.sira - b.sira).filter((x) => x.tur === 'fotoğraf');
const videoCovers = inv.filter((x) => x.tur === 'video' && x.onizleme && exists(path.join(CODEX, x.onizleme)));
const pilSize = (file) => JSON.parse(execFileSync('python3', ['-I', '-c', 'import sys,json;from PIL import Image;print(json.dumps(list(Image.open(sys.argv[1]).size)))', file]).toString());
for (const x of [...picked, ...videoCovers]) {
  const isVideo = x.tur === 'video';
  const [w, h] = isVideo ? pilSize(path.join(CODEX, x.onizleme)) : [x.thumb_w, x.thumb_h];
  candidates.push({
    id: isVideo ? `video-${x.sira}` : x.asset_id,
    imageKey: key('codex', x.onizleme),
    brand: 'dieci',
    kind: isVideo ? 'video_cover' : 'photo',
    origin: 'canva',
    provenance: `Canva klasörü · envanter #${x.sira}${isVideo ? ' · video kapağı (video izlenmedi)' : ''}`,
    published: false,
    dims: { w, h },
    dimsSource: 'önizleme',
    group: isVideo ? 'video_kapak' : x.grup,
    semantic: semantic(x.konu),
    orientation: orient(w, h),
    note: x.konu || '',
    aiMark: aiMark(x.ai_isareti),
    humanPresence: human(x.insan_kadraj),
  });
}

// Yayımlanmış geçmiş: ilk 9 kayıt (küçük görseli olanlar). 4 Ekim 2026'da biten arşiv, canlı senkron değil.
const published = [];
// Kapsam filtresi ilk 9 seçiminden ÖNCE: yalnız Dieci hesabı (diecimoda). Başka sahip (ör. P10) yayına karışmaz.
const ownScope = evidence.filter((ev) => ev.owner_username === 'diecimoda');
const skipped = [];
for (const ev of ownScope) {
  if (published.length >= 9) break;
  const thumb = path.join(HIST, 'thumbnails', `${ev.evidence_id}.jpg`);
  if (!exists(thumb)) {
    skipped.push(`${ev.evidence_id}: yerel görsel yok`);
    continue;
  }
  const dims = JSON.parse(execFileSync('python3', ['-I', '-c', 'import sys,json;from PIL import Image;im=Image.open(sys.argv[1]);print(json.dumps(list(im.size)))', thumb]).toString());
  published.push({
    id: `hist-${ev.evidence_id}`,
    imageKey: key('history', path.join('thumbnails', `${ev.evidence_id}.jpg`)),
    brand: 'dieci',
    kind: ev.format === 'Video' ? 'video_cover' : 'photo',
    origin: 'history',
    provenance: `Instagram arşivi · ${ev.evidence_id} · ${ev.format} · canlı senkron değil`,
    published: true,
    date: ev.publication_istanbul.slice(0, 10),
    dims: { w: dims[0], h: dims[1] },
    dimsSource: 'önizleme',
    orientation: orient(dims[0], dims[1]),
    group: 'arşiv',
    semantic: { shotScale: 'bilinmiyor', subjectPos: 'bilinmiyor', source: 'bilinmiyor' },
    note: `Arşiv kaydı (${ev.format})`,
    aiMark: 'belirsiz',
    humanPresence: 'bilinmiyor',
  });
}

const fixture = {
  title: 'Dieci · 12–18 Ekim 2026 · Yerel inceleme',
  dateLabel: '12–18 Ekim 2026',
  archiveNote: 'Yayımlanmış geçmiş: 30 Ekim 2025 – 4 Ekim 2026 · canlı senkron değil',
  weeklyStory,
  candidates,
  published,
  assets,
  counts: { inventory: inv.length, candidates: candidates.length, feedPool: candidates.filter((c) => !selectedIds.has(c.id)).length, published: published.length },
  scope: 'Canva klasörü (dieci) envanteri: 447 kayıt. Yerel snapshot; canlı kütüphane bağlı değil.',
  archiveScope: {
    owner: 'diecimoda',
    ownerExcluded: evidence.filter((ev) => ev.owner_username !== 'diecimoda').map((ev) => ev.evidence_id),
    firstNineFrom: `${ownScope.length} Dieci kaydı içinden, yerel görseli olanlar`,
    skipped,
  },
};
fs.writeFileSync(OUT, JSON.stringify(fixture, null, 1));
console.log(`fixture: ${OUT}`);
console.log(`aday ${candidates.length} (hikâye ${weeklyStory.length}), yayımlanmış ${published.length}, varlık ${Object.keys(assets).length}`);
