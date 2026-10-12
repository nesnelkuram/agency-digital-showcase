/**
 * Etkin katalog → plan metni/envanter için kısa "CatalogLite". Kaynak açıkça taşınır:
 *  - ai       : yalnız model gözlemi
 *  - ai_human : model gözlemi + insan düzeltmesi (insan alanları kazanır)
 *  - human    : AI analizi YOK; yalnız insanın yazdığı konu/açıklama (kaybolmaz, ama görsel analizi gibi sunulmaz)
 */
import type { CatalogLite } from '../../../shared/planner/copyContract.js';
import type { CatalogOverrides, EffectiveCatalog, ImageCatalog, MediaCatalogCorrection } from './spec.js';

export type CatalogSource = 'ai' | 'ai_human' | 'human';

export const HUMAN_ONLY_NOTE = 'AI görsel analizi yok; yalnız insanın yazdığı açıklama var';

/** İnsan düzeltmesinden görsel analizi OLMADAN kullanılabilir anlamsal alanlar; konu ve açıklamadan hiçbiri yoksa null */
export function humanSemanticOf(c: Pick<MediaCatalogCorrection, 'overrides'> | null): { subject: string; description: string; tags: string[]; foodCategories: string[]; peoplePresent?: boolean; usageSuggestions?: string[] } | null {
  const o: CatalogOverrides = c?.overrides || {};
  const subject = (o.subject ?? '').trim();
  const description = (o.description ?? '').trim();
  if (!subject && !description) return null;
  return {
    subject,
    description,
    tags: (o.tags ?? []).map((t) => t.toLocaleLowerCase('tr')),
    foodCategories: o.foodCategories ?? [],
    ...(o.peoplePresent !== undefined ? { peoplePresent: o.peoplePresent } : {}),
    ...(o.usageSuggestions?.length ? { usageSuggestions: [...o.usageSuggestions] } : {}),
  };
}

const arr = (a: unknown): string[] => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : []);

export function toCatalogLite(c: ImageCatalog | Record<string, any>, source: 'ai' | 'ai_human', humanKeys: string[] = []): CatalogLite & { source: CatalogSource; purposes: string[] } {
  return {
    subject: String(c.subject ?? ''),
    description: String(c.description ?? ''),
    tags: arr(c.tags),
    foodCategories: arr(c.foodCategories),
    visibleObjects: arr(c.visibleObjects),
    uncertainties: arr(c.uncertainties),
    shotType: c.composition?.shotType,
    subjectPlacement: c.composition?.subjectPlacement,
    negativeSpace: !!c.composition?.negativeSpace,
    peoplePresent: !!c.peoplePresent,
    source,
    purposes: arr(c.usageSuggestions),
    ...(arr(c.usageSuggestions).length ? { purposesSource: humanKeys.includes('usageSuggestions') ? ('human' as const) : ('ai' as const) } : {}),
  };
}

export function humanCatalogLite(h: NonNullable<ReturnType<typeof humanSemanticOf>>): CatalogLite & { source: CatalogSource; purposes: string[] } {
  return {
    subject: h.subject,
    description: h.description,
    tags: h.tags,
    foodCategories: h.foodCategories,
    visibleObjects: [],
    uncertainties: [HUMAN_ONLY_NOTE],
    peoplePresent: h.peoplePresent,
    source: 'human',
    purposes: h.usageSuggestions ?? [],
    ...(h.usageSuggestions?.length ? { purposesSource: 'human' as const } : {}),
  };
}

/** Etkin kataloğu (AI + insan) veya yalnız insan açıklamasını CatalogLite'a çevirir; ikisi de yoksa null */
export function liteOfEffective(eff: Pick<EffectiveCatalog, 'catalog' | 'sources'> & { human?: ReturnType<typeof humanSemanticOf> }): (CatalogLite & { source: CatalogSource; purposes: string[] }) | null {
  if (eff.catalog) return toCatalogLite(eff.catalog, Object.keys(eff.sources).length ? 'ai_human' : 'ai', Object.keys(eff.sources));
  return eff.human ? humanCatalogLite(eff.human) : null;
}
