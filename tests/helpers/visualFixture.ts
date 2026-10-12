import type { VisualDecision } from '@/shared/planner/visualDecision';

/** Geçerli bir kompozisyon kararı (v2 model çıktısı örneği). Alanlar kısmen geçersiz kılınarak kullanılır. */
export const visual = (over: Partial<VisualDecision> = {}): VisualDecision => ({
  subject: { box: { x: 0.3, y: 0.35, w: 0.4, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' },
  surroundings: { relation: 'ayrışan', setting: 'masa_yüzeyi' },
  weight: { direction: 'merkez', reasons: ['büyük_obje'] },
  negativeSpace: { zone: 'üst', amount: 'orta', regions: [{ x: 0.05, y: 0.02, w: 0.9, h: 0.25 }] },
  focus: { competition: 'tek_odak', competingElements: [] },
  directions: { gaze: 'yok', motion: 'yok', leadingLines: 'yok' },
  balance: 'simetrik',
  color: { main: 'bej', accents: ['kahverengi'], attention: 'kahverengi', temperature: 'sıcak' },
  tone: { light: 'orta', contrast: 'orta', detail: 'orta', subjectSeparation: 'iyi' },
  lighting: { direction: 'sol', brightZone: 'sol', darkZone: 'sağ', blownHighlights: 'yok', crushedShadows: 'yok' },
  density: 'sakin',
  textSafe: [{ box: { x: 0.05, y: 0.02, w: 0.9, h: 0.25 }, quality: 'iyi' }],
  technical: { sharpness: 'net', exposure: 'dengeli', noise: 'yok', compression: 'yok', issues: [] },
  purpose: ['ürün'],
  confidence: 'orta',
  fieldConfidence: { subject: 'orta', scale: 'orta', context: 'orta', weight: 'orta', negativeSpace: 'orta', focus: 'orta', directions: 'orta', balance: 'orta', color: 'orta', tone: 'orta', lighting: 'orta', density: 'orta', textSafe: 'orta', technical: 'orta', purpose: 'orta' },
  fieldNotes: [],
  uncertainties: [],
  ...over,
});

/** Bilinmeyen (belirsiz) bir görsel karar: kutu da bilinmiyor. Hiçbir alan "iyi puan" üretmemeli. */
export const unknownVisual = (over: Partial<VisualDecision> = {}): VisualDecision =>
  visual({
    subject: { box: null, boxConfidence: 'belirsiz', scale: 'belirsiz' },
    surroundings: { relation: 'belirsiz', setting: 'belirsiz' },
    weight: { direction: 'belirsiz', reasons: [] },
    negativeSpace: { zone: 'belirsiz', amount: 'belirsiz', regions: [] },
    focus: { competition: 'belirsiz', competingElements: [] },
    directions: { gaze: 'belirsiz', motion: 'belirsiz', leadingLines: 'belirsiz' },
    balance: 'belirsiz',
    color: { main: '', accents: [], attention: 'belirsiz', temperature: 'belirsiz' },
    tone: { light: 'belirsiz', contrast: 'belirsiz', detail: 'belirsiz', subjectSeparation: 'belirsiz' },
    lighting: { direction: 'belirsiz', brightZone: 'belirsiz', darkZone: 'belirsiz', blownHighlights: 'belirsiz', crushedShadows: 'belirsiz' },
    density: 'belirsiz',
    textSafe: [],
    technical: { sharpness: 'belirsiz', exposure: 'belirsiz', noise: 'belirsiz', compression: 'belirsiz', issues: [] },
    purpose: [],
    confidence: 'düşük',
    fieldConfidence: { subject: 'belirsiz', scale: 'belirsiz', context: 'belirsiz', weight: 'belirsiz', negativeSpace: 'belirsiz', focus: 'belirsiz', directions: 'belirsiz', balance: 'belirsiz', color: 'belirsiz', tone: 'belirsiz', lighting: 'belirsiz', density: 'belirsiz', textSafe: 'belirsiz', technical: 'belirsiz', purpose: 'belirsiz' },
    ...over,
  });

/** Modelin ham çıktısı: iki AYRI alan */
export const analysisOutput = (catalog: unknown, vis: unknown = visual()) => ({ catalog, visual: vis });
