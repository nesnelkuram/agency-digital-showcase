// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { validateBrandVoiceBundle } from '@/shared/planner/brandVoice';
import { sha256Hex } from '@/shared/planner/sha256';
import { buildBrandVoiceBundle, parseVerifiedProducts } from '../../scripts/lib/brandVoiceBundle.mjs';
import { bundle } from './helpers';

const LONG = 'x'.repeat(300);
const GUIDE_LANG = `${LONG}\nDoğrulanmış menü adları (persona bölüm 7): The Ghosting (espresso), Lovebombing (tiramisu), Mixed Signals (yarı tatlı yarı tuzlu kahvaltı), The Red Flag (Diavola), Quattro Formaggi + acı bal.\nAlkol markası açıkça anılmaz.`;
const ev = (id: string, owner: string, over: Record<string, unknown> = {}) => ({ evidence_id: id, owner_username: owner, included_in_voice_analysis: true, publication_istanbul: '2026-10-04T22:07:24+03:00', format: 'Image', language_order: 'TR', theme: 'Ürün', cta: 'x', caption: `metin ${id}`, ...over });
const build = (evidence: any[], over: Record<string, unknown> = {}) =>
  buildBrandVoiceBundle({ evidence, persona: LONG, languageGuide: GUIDE_LANG, shareStyles: LONG, account: 'diecimoda', ...over });

describe('marka sesi paketi: kurma', () => {
  it('yalnız doğrulanmış hesaba ait kayıtlar girer; başka hesap, sesten çıkarılmış ve boş metin nedenle dışarıda', () => {
    const b = build([ev('P01', 'diecimoda'), ev('P10', 'idfineporcelain', { included_in_voice_analysis: false }), ev('P11', 'diecimoda', { included_in_voice_analysis: false }), ev('P12', 'diecimoda', { caption: '   ' }), ev('P13', undefined as any)]);
    expect(b.captions.map((c: any) => c.id)).toEqual(['P01']);
    expect(b.builtFrom.excluded).toEqual([
      { id: 'P10', reason: 'başka_hesap', owner: 'idfineporcelain' },
      { id: 'P11', reason: 'sesten_çıkarılmış', owner: 'diecimoda' },
      { id: 'P12', reason: 'boş_metin', owner: 'diecimoda' },
      { id: 'P13', reason: 'başka_hesap', owner: null },
    ]);
    expect(b.captions[0].date).toBe('2026-10-04');
  });
  it('hesap yoksa, kanıt boşsa, hesaba ait caption yoksa veya rehber eksikse ürün/paket UYDURULMAZ (hata)', () => {
    expect(() => build([ev('P01', 'baska')])).toThrow(/caption yok/);
    expect(() => build([])).toThrow(/boş/);
    expect(() => build([ev('P01', 'diecimoda')], { account: '' })).toThrow(/account/);
    expect(() => build([ev('P01', 'diecimoda')], { persona: 'kısa' })).toThrow(/persona/);
    expect(() => build([ev('P01', 'diecimoda')], { languageGuide: LONG })).toThrow(/Doğrulanmış menü adları/);
  });
  it('doğrulanmış ürünler Dil Rehberi satırından ayrıştırılır (parantez içi virgül bölmez)', () => {
    const p = parseVerifiedProducts(GUIDE_LANG);
    expect(p.map((x) => x.id)).toEqual(['the-ghosting', 'lovebombing', 'mixed-signals', 'the-red-flag', 'quattro-formaggi-aci-bal']);
    expect(p[2]).toEqual({ id: 'mixed-signals', name: 'Mixed Signals', note: 'yarı tatlı yarı tuzlu kahvaltı' });
    expect(p[4].note).toBe('');
  });
  it('kurulan paket TS doğrulayıcısından geçer ve rehber özetleri eşleşir', () => {
    const b = build([ev('P01', 'diecimoda')]);
    expect(validateBrandVoiceBundle(b, sha256Hex).ok).toBe(true);
  });
});

describe('marka sesi paketi: doğrulayıcı (fırlatmaz)', () => {
  const bad: Array<[string, (b: any) => any]> = [
    ['null', () => null], ['dizi', () => []], ['metin', () => 'x'],
    ['schemaVersion', (b) => ({ ...b, schemaVersion: 2 })],
    ['hesap boş', (b) => ({ ...b, brand: { name: 'D', account: '' } })],
    ['ownerFilter farklı', (b) => ({ ...b, builtFrom: { ...b.builtFrom, ownerFilter: 'baska' } })],
    ['caption başka hesap', (b) => ({ ...b, captions: [{ ...b.captions[0], owner: 'idfineporcelain' }] })],
    ['hariç kayıt captions içinde', (b) => ({ ...b, builtFrom: { ...b.builtFrom, excluded: [{ id: 'P01', reason: 'x', owner: null }] } })],
    ['yinelenen id', (b) => ({ ...b, captions: [b.captions[0], { ...b.captions[0] }] })],
    ['kötü tarih', (b) => ({ ...b, captions: [{ ...b.captions[0], date: '4 Ekim' }] })],
    ['boş caption', (b) => ({ ...b, captions: [{ ...b.captions[0], caption: '' }] })],
    ['caption null eleman', (b) => ({ ...b, captions: [null] })],
    ['caption yok', (b) => ({ ...b, captions: [] })],
    ['rehber eksik', (b) => ({ ...b, guides: { ...b.guides, persona: 'kısa' } })],
    ['rehber özeti kötü', (b) => ({ ...b, guideHashes: { ...b.guideHashes, persona: 'z'.repeat(64) } })],
    ['ürün slug', (b) => ({ ...b, verifiedProducts: [{ id: 'Kötü Id', name: 'x', note: '' }] })],
    ['ürün yinelenmiş', (b) => ({ ...b, verifiedProducts: [b.verifiedProducts[0], b.verifiedProducts[0]] })],
    ['ürünler null', (b) => ({ ...b, verifiedProducts: null })],
    ['guides null', (b) => ({ ...b, guides: null })],
  ];
  it.each(bad)('%s reddedilir', (_n, mut) => {
    let r: ReturnType<typeof validateBrandVoiceBundle> | undefined;
    expect(() => { r = validateBrandVoiceBundle(mut(bundle()), sha256Hex); }).not.toThrow();
    expect(r!.ok).toBe(false);
  });
  it('geçerli paket kabul; çok büyük paket reddedilir', () => {
    expect(validateBrandVoiceBundle(bundle(), sha256Hex).ok).toBe(true);
    const g = 'a'.repeat(80_000);
    const big = bundle({ captions: Array.from({ length: 60 }, (_, i) => ({ ...bundle().captions[0], id: `P${i + 100}`, caption: 'a'.repeat(2200) })), guides: { persona: g, languageGuide: g, shareStyles: g } });
    const r = validateBrandVoiceBundle(big);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.join()).toMatch(/çok büyük/);
    const many = bundle({ builtFrom: { evidenceCount: 1, ownerFilter: 'diecimoda', excluded: Array.from({ length: 201 }, (_, i) => ({ id: `X${i}`, reason: 'r', owner: null })) } });
    expect(validateBrandVoiceBundle(many).ok).toBe(false);
  });
});

const REAL = '/Users/intiba/Documents/Codex/2026-10-09/task/dieci-brand-voice/bundle.json';
describe.skipIf(!existsSync(REAL))('gerçek yerel kaynaklardan üretilmiş paket (yerel dosya varsa)', () => {
  it('P10 dışarıda, 42 Dieci kaydı, rehber özetleri doğru, beş doğrulanmış ürün', () => {
    const raw = JSON.parse(readFileSync(REAL, 'utf8'));
    const v = validateBrandVoiceBundle(raw, sha256Hex);
    expect(v.ok).toBe(true);
    expect(raw.captions).toHaveLength(42);
    expect(raw.captions.map((c: any) => c.id)).not.toContain('P10');
    expect(raw.captions.every((c: any) => c.owner === 'diecimoda')).toBe(true);
    expect(raw.builtFrom.excluded).toEqual([{ id: 'P10', reason: 'başka_hesap', owner: 'idfineporcelain' }]);
    expect(raw.verifiedProducts.map((p: any) => p.id)).toEqual(['the-ghosting', 'lovebombing', 'mixed-signals', 'the-red-flag', 'quattro-formaggi-aci-bal']);
  });
});
