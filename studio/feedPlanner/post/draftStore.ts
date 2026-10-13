import type { TempTone } from '../../../shared/planner/copyContract';
import type { Entry } from './creativeState';
import type { PostPlan } from './postPlan';

/**
 * Post planı taslağı — YALNIZ bu tarayıcı sekmesinin belleğinde (Studio düzeni sayfalar arasında tutar).
 * Studio içinde Marka Kiti/ayarlara gidip dönünce plan, yaratıcı durum ve insan metni korunur.
 * Sayfa yenilenince, sekme kapanınca veya oturum kapanınca KAYBOLUR; kalıcı kayıt yoktur (ayrı onay bekler).
 * Anahtar: tenant|proje|uid — başka kapsamın taslağı asla okunmaz.
 */
export interface PostDraft {
  plan: PostPlan;
  entries: Record<string, Entry>;
  tone: TempTone;
  count: string;
  sel: string | null;
  doneSig: string | null;
  savedAt: number;
  /** Ayrılırken yarıda kalıp İPTAL edilen postlar (dürüst bildirim için) */
  interrupted: string[];
}

export interface PostDraftStore {
  get(key: string): PostDraft | undefined;
  set(key: string, draft: PostDraft): void;
  clear(key: string): void;
  /** Tüm taslakları bilinçli olarak at (onaylı çıkış / oturum kapatma) */
  clearAll(): void;
  /** Bellekte kaybolacak, plan içeren herhangi bir taslak var mı (yenileme/kapatma uyarısı için) */
  hasWork(): boolean;
}

export function createPostDraftStore(): PostDraftStore {
  const m = new Map<string, PostDraft>();
  return {
    get: (k) => m.get(k),
    set: (k, d) => void m.set(k, d),
    clear: (k) => void m.delete(k),
    clearAll: () => m.clear(),
    hasWork: () => [...m.values()].some((d) => d.plan.posts.length > 0),
  };
}
