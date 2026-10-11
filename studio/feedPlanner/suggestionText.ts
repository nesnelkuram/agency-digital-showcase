import type { Candidate, SlotText, TextRole } from './types';

/**
 * YALNIZ TEST/QA deterministik metin şablonları (model/API çalışmaz); normal üretimde kullanılmaz. Metinler TÜRKÇE'dir.
 * Dil Rehberi: "Kanıtsız cümle yazılmaz; uydurma yasağı." Bu yüzden şablonlar ürün özelliği, içerik, süre,
 * menşe veya menü adı iddia etmez; yalnız Marka Personası'nda kayıtlı kanaatlerin (bölüm 0, 3, 8) İngilizce
 * asıllarıdır (Türkçe). Nihai metin değildir; yetkili seçim ve metin ayrı bir adımın işidir.
 */
interface Tpl {
  id: string;
  register: 'Harry Dry' | 'Gastro-şairane' | 'Menefreghista';
  headline: string;
  body: string;
}

const T: Record<string, Tpl> = {
  t1: { id: 't1', register: 'Harry Dry', headline: 'Pazarlamada serseri, mutfakta beyefendi.', body: 'Kuralları biz koyarız, sen sadece tadını çıkarırsın.' },
  t2: { id: 't2', register: 'Menefreghista', headline: 'Biz susacağız... tabaklar konuşacak.', body: 'Kontrolü bize devredin.' },
  t3: { id: 't3', register: 'Menefreghista', headline: 'Biz çoktan seçtik.', body: 'Siz sadece masaya oturun.' },
  t4: { id: 't4', register: 'Gastro-şairane', headline: 'Bazı şeyler sabrınızı hak eder.', body: 'Acele yok.' },
  t5: { id: 't5', register: 'Gastro-şairane', headline: 'Mükemmellik terlemez.', body: 'Sadece fısıldar.' },
  t6: { id: 't6', register: 'Menefreghista', headline: 'İradeni kapıda bırak.', body: 'Gerisini bize bırak.' },
  t7: { id: 't7', register: 'Menefreghista', headline: 'Tesadüflere inanmıyoruz.', body: 'Her tabak seçildi.' },
  t8: { id: 't8', register: 'Harry Dry', headline: 'Standartlarını düşürme.', body: 'Ne tabakta, ne masada.' },
};

/** Grup → öncelikli şablonlar. Eşleşme yoksa genel döngü. */
const BY_GROUP: Record<string, string[]> = {
  pizza: ['t2', 't8', 't3'],
  makarna: ['t4', 't3', 't2'],
  katlanmis_focaccia: ['t5', 't4'],
  kahvalti_meze: ['t6', 't3'],
  kokteyl_icecek: ['t3', 't6'],
  mekan_atmosfer: ['t7', 't1'],
  corba_kase: ['t4', 't6'],
  hazirlik_el: ['t1', 't5'],
  et_carpaccio: ['t8', 't2'],
  ekmek_hamur: ['t4', 't5'],
  genel_yemek_tabagi: ['t2', 't8', 't3'],
  marka_ogesi: ['t1', 't7'],
};
const FALLBACK = ['t3', 't8', 't2', 't7'];

export const hashString = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
};

export const TEMPLATE_LABEL = 'Şablon metni · demo (model çalışmadı)';

/** Aday ve role göre tek sürümlü öneri metni. Aynı girdi her zaman aynı metni verir. */
export function suggestionFor(c: Candidate, role: TextRole, avoid: string[] = []): SlotText | null {
  if (c.kind === 'video_cover' && role !== 'caption') return null;
  const preferred = (BY_GROUP[c.group] ?? FALLBACK).filter((id) => !avoid.includes(id));
  // Önceki metinden farklı şablon: önce grubun alternatifleri, yoksa tüm bankadan; hiçbiri yoksa varsayılan.
  const pool = preferred.length ? preferred : Object.keys(T).filter((id) => !avoid.includes(id));
  const ids = pool.length ? pool : BY_GROUP[c.group] ?? FALLBACK;
  const tpl = T[ids[hashString(c.id) % ids.length]];
  const base = { source: 'template' as const, lang: 'tr' as const, templateId: tpl.id, register: tpl.register };
  switch (role) {
    case 'caption':
      return { ...base, caption: `${tpl.headline} ${tpl.body}` };
    case 'headline':
      return { ...base, headline: tpl.headline };
    case 'body':
      return { ...base, body: tpl.body };
    default:
      return null;
  }
}

export const templateIds = (): string[] => Object.keys(T);

/**
 * YALNIZ TEST/QA: planlayıcıya (PlanCtx.textFor) verilebilen şablon sağlayıcısı. NORMAL üretim yolunda KULLANILMAZ;
 * gerçek metin yalnız model hattından gelir (shared/planner/copyContract + api/studio/plan-copy).
 */
export const templateTextFor = (c: Candidate, role: TextRole, prev: SlotText | null): SlotText | null => suggestionFor(c, role, templateIdsOf(prev));

/** Verilen metnin hangi şablonlardan geldiğini bulur (şablon kimliği veya cümle eşleşmesi). */
export function templateIdsOf(text: SlotText | null | undefined): string[] {
  if (!text) return [];
  const hay = `${text.headline ?? ''} ${text.body ?? ''} ${text.caption ?? ''}`;
  return Object.values(T)
    .filter((t) => t.id === text.templateId || (hay.includes(t.headline) && t.headline.length > 0))
    .map((t) => t.id);
}
