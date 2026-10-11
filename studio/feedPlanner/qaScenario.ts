import type { Candidate } from './types';
import { coverage, ratioOf } from './crop';

/**
 * YALNIZ yerel QA senaryosu (?qa=exhausted / ?qa=error), açık etiketli. Ana 447 havuzuna dokunmaz:
 * gerçek adaylardan, bellekte, "tek tur yeter ama alternatif yok" havuzu kurar. Normal akışta kullanılmaz.
 */
export type QaMode = 'exhausted' | 'error';

export const QA_LABEL: Record<QaMode, string> = {
  exhausted: 'QA senaryosu: alternatif yok. Bellek fixture: yalnız 9 uygun gerçek aday var; ana havuz değişmedi.',
  error: 'QA senaryosu: hata. "Ele ve yenisini getir" bilerek hata verir; mevcut öneri korunmalı.',
};

export const parseQa = (search: string, hostname: string): QaMode | null => {
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hostname)) return null;
  const v = new URLSearchParams(search).get('qa');
  return v === 'exhausted' || v === 'error' ? v : null;
};

/** Hikâye kareleri + feed'e uygun TAM 9 gerçek fotoğraf (kimliğe göre ilk 9). */
export function exhaustedPool(candidates: Candidate[], storyIds: string[], brand = 'dieci', n = 9): Candidate[] {
  const story = new Set(storyIds);
  const eligible = candidates
    .filter((c) => !story.has(c.id) && c.brand === brand && !c.published && c.kind === 'photo' && coverage(c.dims, ratioOf('feed-4x5')) >= 0.5)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, n);
  return [...candidates.filter((c) => story.has(c.id)), ...eligible];
}

/** Hata senaryosu: aday havuzu taranırken özellikle hata verir (yalnız "Ele ve yenisini getir" yolunda kullanılır). */
export class ThrowingMap<K, V> extends Map<K, V> {
  override values(): MapIterator<V> {
    throw new Error('QA: bilerek üretilen hata');
  }
}
