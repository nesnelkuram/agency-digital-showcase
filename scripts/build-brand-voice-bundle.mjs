#!/usr/bin/env node
/**
 * Marka sesi paketini yerel kaynaklardan üretir (ağ, .env, kimlik bilgisi YOK; yalnız dosya okur/yazar).
 *   node scripts/build-brand-voice-bundle.mjs --out <bundle.json> [--evidence f] [--persona f] [--language f] [--styles f] [--account diecimoda]
 * Paketi canlıya yazmaz. Yetkili Studio'daki "Marka sesi paketi" yükleme adımı bu dosyayı kullanır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildBrandVoiceBundle } from './lib/brandVoiceBundle.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const DIECI = '/Users/intiba/Documents/AIprojects/Dieci';
const RESEARCH = '/Users/intiba/Documents/Codex/2026-10-09/task/dieci-instagram-research-2026-10-10';
if (!args.out) { console.error('--out zorunlu'); process.exit(1); }
const read = (p) => fs.readFileSync(p, 'utf8');
const bundle = buildBrandVoiceBundle({
  evidence: JSON.parse(read(args.evidence || path.join(RESEARCH, 'evidence-43.json'))),
  persona: read(args.persona || path.join(DIECI, 'Dieci_Marka_Personasi.md')),
  languageGuide: read(args.language || path.join(DIECI, 'Dieci_Dil_Rehberi.md')),
  shareStyles: read(args.styles || path.join(DIECI, 'Dieci_Paylasim_Stilleri.md')),
  account: args.account || 'diecimoda',
});
fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
fs.writeFileSync(args.out, JSON.stringify(bundle, null, 1));
console.log(`paket: ${args.out}`);
console.log(`caption: ${bundle.captions.length}/${bundle.builtFrom.evidenceCount} (hesap: ${bundle.builtFrom.ownerFilter})`);
console.log('hariç:', bundle.builtFrom.excluded.map((e) => `${e.id}:${e.reason}${e.owner ? `(${e.owner})` : ''}`).join(', ') || '-');
console.log('doğrulanmış ürünler:', bundle.verifiedProducts.map((p) => `${p.id}`).join(', '));
console.log(`boyut: ${Math.round(fs.statSync(args.out).size / 1024)} KB`);
