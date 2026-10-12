// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { AnalysisOutputSchema, VisualDecisionSchema, checkBox, parseAnalysisOutput, validateVisual, ANALYSIS_USER_PROMPT, VISUAL_SYSTEM_PROMPT } from '@/api/_lib/mediaAnalysis/visualSpec';
import { analysisJsonSchema, ANALYSIS_SYSTEM_PROMPT } from '@/api/_lib/mediaAnalysis/openrouterVisionCall';
import { CATALOG_SYSTEM_PROMPT } from '@/api/_lib/mediaAnalysis/spec';
import { visual, unknownVisual } from './helpers/visualFixture';

const catalog = {
  subject: 'masada tatlı', description: 'Beyaz tabakta bir dilim tatlı.', tags: ['tatlı'], visibleObjects: ['tabak'], foodCategories: ['tatlı'],
  composition: { shotType: 'yakın_çekim', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true },
  productIdentity: { status: 'genel_kategori', note: 'tür görünmüyor' }, usageSuggestions: ['story'], peoplePresent: false,
  uncertainties: ['içerik görünmüyor'], planningNotes: ['dikey kadraj'], overallConfidence: 'orta',
};

describe('görsel karar şeması: kompozisyon soruları kapsanır, kaynak/belirsizlik açık', () => {
  it('tüm soru başlıkları şemada ayrı alan olarak var', () => {
    const keys = Object.keys(VisualDecisionSchema.shape);
    for (const k of ['subject', 'weight', 'negativeSpace', 'focus', 'directions', 'balance', 'color', 'tone', 'lighting', 'density', 'textSafe', 'technical', 'purpose', 'confidence', 'fieldConfidence', 'fieldNotes', 'uncertainties']) expect(keys).toContain(k);
    expect(Object.keys(VisualDecisionSchema.shape.subject.shape)).toEqual(['box', 'boxConfidence', 'scale']); // konum + kapladığı alan (kutu), yakın/geniş kadraj
    expect(Object.keys(VisualDecisionSchema.shape.negativeSpace.shape)).toEqual(['zone', 'amount', 'regions']); // konum + miktar + oran için bölgeler
    expect(Object.keys(VisualDecisionSchema.shape.focus.shape)).toEqual(['competition', 'competingElements']);
    expect(Object.keys(VisualDecisionSchema.shape.directions.shape)).toEqual(['gaze', 'motion', 'leadingLines']); // bakış/hareket/çizgi yönleri
    expect(Object.keys(VisualDecisionSchema.shape.color.shape)).toEqual(['main', 'accents', 'attention', 'temperature']);
    expect(Object.keys(VisualDecisionSchema.shape.lighting.shape)).toEqual(['direction', 'brightZone', 'darkZone', 'blownHighlights', 'crushedShadows']); // ışık yönü, patlayan/ezilen bölgeler
    expect(Object.keys(VisualDecisionSchema.shape.technical.shape)).toEqual(['sharpness', 'exposure', 'noise', 'compression', 'issues']);
  });

  it('bilinmeyen için "belirsiz" seçeneği zorunlu olarak vardır (uydurma yerine); güven + belirsizlik listesi var', () => {
    const js: any = z.toJSONSchema(VisualDecisionSchema, { target: 'draft-7', reused: 'inline' });
    for (const path of [js.properties.subject.properties.scale, js.properties.weight.properties.direction, js.properties.negativeSpace.properties.zone, js.properties.balance, js.properties.density, js.properties.tone.properties.light]) {
      expect(path.enum, JSON.stringify(path)).toContain('belirsiz');
    }
    expect(js.properties.confidence.enum).toEqual(['düşük', 'orta', 'yüksek']);
    // kutu BİLİNMEYEBİLİR: null ile temsil edilir (sayı zorunlu değil); alan bazında güven 'belirsiz' alabilir
    expect(JSON.stringify(js.properties.subject.properties.box)).toMatch(/"type":"null"/);
    expect(js.properties.fieldConfidence.properties.lighting.enum).toContain('belirsiz');
    expect(js.properties.lighting.properties.direction.enum).toContain('belirsiz');
    expect(js.properties.uncertainties.type).toBe('array');
  });

  it('JSON Schema (strict) iki ayrı alan taşır; her nesne additionalProperties:false ve tüm alanlar zorunlu; sayı aralığı anahtar sözcüğü yok', () => {
    const js: any = analysisJsonSchema();
    expect(js.$schema).toBeUndefined();
    expect(Object.keys(js.properties).sort()).toEqual(['catalog', 'visual']);
    expect(js.required.sort()).toEqual(['catalog', 'visual']);
    const walk = (n: any, path: string) => {
      if (n && typeof n === 'object') {
        if (n.type === 'object' && n.properties) {
          expect(n.additionalProperties, path).toBe(false);
          expect([...n.required].sort(), path).toEqual(Object.keys(n.properties).sort());
        }
        expect('minimum' in n || 'maximum' in n, path).toBe(false);
        for (const [k, v] of Object.entries(n)) walk(v, `${path}.${k}`);
      }
    };
    walk(js, '$');
  });
});

describe('kutu doğrulaması (model kutu tahmini kodla denetlenir; uydurma "düzeltme" yok)', () => {
  it('geçerli kutu kabul; ±0.001 taşma yuvarlanır; anlamlı taşma, sıfır/negatif boyut, NaN reddedilir', () => {
    expect(checkBox({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 })).toEqual({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
    expect(checkBox({ x: 0.5, y: 0.5, w: 0.5005, h: 0.5 })).toMatchObject({ w: 0.5 });
    for (const b of [{ x: 0.6, y: 0.1, w: 0.6, h: 0.3 }, { x: 0.1, y: 0.1, w: 0, h: 0.3 }, { x: -0.2, y: 0.1, w: 0.3, h: 0.3 }, { x: 0.1, y: 0.1, w: 0.01, h: 0.5 }, { x: NaN, y: 0, w: 0.3, h: 0.3 }, { x: 0.1, y: 0.1, w: 1.5, h: 0.3 }]) {
      expect(checkBox(b as any), JSON.stringify(b)).toBeNull();
    }
  });

  it('GEÇERSİZ konu kutusu görsel kararı DÜŞÜRMEZ: kutu bilinmiyor (null) olur, diğer geçerli alanlar KORUNUR, geometri uydurulmaz; durum partial', () => {
    const bad = visual({ subject: { box: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, boxConfidence: 'yüksek', scale: 'yakın' }, weight: { direction: 'sol', reasons: ['koyu_ton'] } });
    const r = parseAnalysisOutput({ catalog, visual: bad });
    expect(r).toMatchObject({ ok: true, visualStatus: 'partial', visualIssue: 'konu_kutusu_geçersiz_bilinmiyor_sayıldı' });
    if (r.ok) {
      expect(r.catalog.subject).toBe('masada tatlı');
      expect(r.visual!.subject).toEqual({ box: null, boxConfidence: 'belirsiz', scale: 'yakın' }); // kutu bilinmiyor; ölçek kaybolmadı
      expect(r.visual!.weight.direction).toBe('sol');
      expect(r.visual!.density).toBe('sakin');
    }
  });

  it('model kutuyu BİLMİYORSA (null) açıkça kabul edilir: partial, diğer alanlar korunur', () => {
    const r = parseAnalysisOutput({ catalog, visual: unknownVisual({ density: 'sakin', color: { main: 'bej', accents: [], attention: 'belirsiz', temperature: 'sıcak' } }) });
    expect(r).toMatchObject({ ok: true, visualStatus: 'partial', visualIssue: 'konu_kutusu_bilinmiyor' });
    if (r.ok) {
      expect(r.visual!.subject.box).toBeNull();
      expect(r.visual!.density).toBe('sakin');
      expect(r.visual!.color.main).toBe('bej');
    }
  });

  it('boş alan bölgesi / yazı alanı geçersizse YALNIZ o öğe düşer; durum partial; geçerli kutuyla ok', () => {
    const mixed = visual({
      textSafe: [{ box: { x: 0.1, y: 0.1, w: 0.5, h: 0.2 }, quality: 'iyi' }, { box: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, quality: 'iyi' }],
      negativeSpace: { zone: 'üst', amount: 'orta', regions: [{ x: 0, y: 0, w: 1, h: 0.2 }, { x: 0.8, y: 0.8, w: 0.9, h: 0.9 }] },
    });
    const v = validateVisual(VisualDecisionSchema.parse(mixed));
    expect(v).toMatchObject({ ok: true, status: 'partial' });
    if (v.ok) {
      expect(v.visual.textSafe).toHaveLength(1);
      expect(v.visual.negativeSpace.regions).toHaveLength(1);
      expect(v.issues).toEqual(expect.arrayContaining(['boş_alan_bölgesi_düşürüldü:1', 'yazı_alanı_düşürüldü:1']));
    }
    expect(validateVisual(VisualDecisionSchema.parse(visual()))).toMatchObject({ ok: true, status: 'ok', issues: [] });
  });

  it('katalog geçersizse tüm çıktı reddedilir; görsel şema geçersizse yalnız görsel karar yok sayılır (kısmi başarı dürüstçe işaretlenir)', () => {
    expect(parseAnalysisOutput({ catalog: { ...catalog, composition: { ...catalog.composition, shotType: 'selfie' } }, visual: visual() })).toEqual({ ok: false, issue: 'katalog_geçersiz' });
    expect(parseAnalysisOutput(null)).toEqual({ ok: false, issue: 'çıktı_nesne_değil' });
    const r = parseAnalysisOutput({ catalog, visual: { ...visual(), density: 'çok_kalabalık' } });
    expect(r).toMatchObject({ ok: true, visual: null, visualIssue: 'görsel_karar_şeması_geçersiz' });
    expect(parseAnalysisOutput({ catalog, visual: visual() })).toMatchObject({ ok: true, visualIssue: null, visual: { density: 'sakin' } });
  });

  it('normalleştirme: nedenler ≤4, vurgu renkleri ≤3, belirsizlikler kırpılır, tekilleştirilir', () => {
    const v = VisualDecisionSchema.parse(visual({
      weight: { direction: 'sol', reasons: ['büyük_obje', 'koyu_ton', 'parlak_nokta', 'doygun_renk', 'yüksek_kontrast', 'büyük_obje'] },
      color: { main: '  kırmızı  ', accents: ['a', 'b', 'c', 'd', 'a'], attention: 'kırmızı', temperature: 'sıcak' },
      fieldNotes: [{ field: 'directions', note: 'z'.repeat(400) }, { field: 'lighting', note: '   ' }],
      uncertainties: ['x'.repeat(500)],
    }));
    const out = validateVisual(v);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.visual.weight.reasons).toHaveLength(4);
      expect(out.visual.color.accents).toHaveLength(3);
      expect(out.visual.color.main).toBe('kırmızı');
      expect(out.visual.uncertainties[0]).toHaveLength(200);
      expect(out.visual.fieldNotes).toHaveLength(1); // boş not düşer
      expect(out.visual.fieldNotes[0].note).toHaveLength(160);
    }
  });
});

describe('istem: kompozisyon yargısı model gözlemi olarak sınırlanır', () => {
  it('kutu normalize, belirsizse "belirsiz", sayısal renk ölçümü kodda; ürün/kimlik uydurma yasağı katalog kurallarıyla birlikte', () => {
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/KUTU TAHMİNİDİR; kesin ölçüm değildir/);
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/"belirsiz" seç/);
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/sol-üst köşe orijin/);
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/subject\.box = null/); // bilinmeyen kutu uydurulmaz
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/Bilinmeyeni başka bir değere .* ÇEVİRME/);
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/Oranı SEN yazma; kodla hesaplanır/);
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/Sayısal renk\/parlaklık ölçümü kod tarafında/);
    expect(ANALYSIS_SYSTEM_PROMPT.startsWith(CATALOG_SYSTEM_PROMPT)).toBe(true);
    expect(ANALYSIS_SYSTEM_PROMPT).toMatch(/UYDURMA/);
    expect(ANALYSIS_USER_PROMPT).toMatch(/catalog.*visual/);
    expect(AnalysisOutputSchema.safeParse({ catalog, visual: visual() }).success).toBe(true);
  });
});
