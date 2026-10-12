import { getBlob, ref } from 'firebase/storage';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import { storage } from '@/lib/firebase/config';
import type { Candidate } from '../types';
import { PortError, type CopyPort, type CopyResponse, type PersistencePort } from '../ports';
import type { CopyRequest } from '../../../shared/planner/copyContract';
import type { InventoryDTO } from '../integration/fromInventory';

/** Sunucu yanıtını okur; hata gövdesini TÜRKÇE mesaj + kodla PortError'a çevirir (sessiz yutma yok). */
async function call(path: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await authenticatedFetch(path, init);
  } catch (e: any) {
    throw new PortError(e?.message === 'Not authenticated' ? 'Oturum açık değil.' : `Sunucuya ulaşılamadı: ${e?.message ?? e}`, 'network');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PortError(body?.error || `İstek başarısız (${res.status})`, body?.code || `http_${res.status}`, res.status, body?.details);
  return body;
}

/** Gerçek model hattı: /api/studio/plan-copy. Şablon fallback YOK; sunucu kapalıysa (503 feature_disabled) açık hata. */
export const createCopyPort = (): CopyPort => ({
  available: true,
  generate: async (req: CopyRequest): Promise<CopyResponse> => {
    const b = await call('/api/studio/plan-copy', { method: 'POST', body: JSON.stringify(req) });
    return { accepted: b.accepted ?? [], rejected: b.rejected ?? [], notes: b.notes ?? [], model: b.model, promptVersion: b.promptVersion, responseId: b.responseId ?? null, provider: b.provider ?? null, requestedModel: b.requestedModel, requestId: b.requestId ?? null, usage: b.usage, voice: b.voice };
  },
});

/** Kalıcı taslak: /api/studio/planner-draft (sürüm + idempotency sunucuda doğrulanır). */
export const createPersistencePort = (projectId: string): PersistencePort => ({
  load: async (weekStart) => {
    const b = await call(`/api/studio/planner-draft?${new URLSearchParams({ projectId, weekStart })}`);
    return b.exists ? { version: b.version, draft: b.draft } : null;
  },
  save: async ({ weekStart, expectedVersion, idempotencyKey, draft }) => {
    const b = await call('/api/studio/planner-draft', { method: 'PUT', body: JSON.stringify({ projectId, weekStart, expectedVersion, idempotencyKey, draft }) });
    return { version: b.version, replayed: !!b.replayed };
  },
});

export interface InventoryLoad {
  items: InventoryDTO[];
  excluded: Array<{ id: string; reason: string }>;
  pages: number;
}
export const MAX_INVENTORY_PAGES = 500;

/** Katalog sayfalaması: sunucu imleci tükenene kadar sayfa ister. Sessiz kırpma YOK: imleç döngüsü veya sayfa üst sınırı AÇIK hatadır. */
export async function fetchInventory(projectId: string, onProgress?: (loaded: number, pages: number) => void, fetchPage = (cursor: string | null) => call(`/api/studio/planner-inventory?${new URLSearchParams({ projectId, limit: '100', ...(cursor ? { cursor } : {}) })}`)): Promise<InventoryLoad> {
  const items: InventoryDTO[] = [];
  const excluded: InventoryLoad['excluded'] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  for (let pages = 1; pages <= MAX_INVENTORY_PAGES; pages++) {
    const page: { items: InventoryDTO[]; excluded: InventoryLoad['excluded']; nextCursor: string | null } = await fetchPage(cursor);
    items.push(...page.items);
    excluded.push(...page.excluded);
    onProgress?.(items.length, pages);
    if (!page.nextCursor) return { items, excluded, pages };
    if (seenCursors.has(page.nextCursor)) throw new PortError('Katalog sayfalaması döngüye girdi (aynı imleç tekrar döndü); liste eksik olabilir.', 'cursor_loop');
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  throw new PortError(`Katalog ${MAX_INVENTORY_PAGES} sayfadan uzun; yükleme tamamlanamadı (liste eksik).`, 'page_limit');
}

/** Yetkili Storage okuması → blob URL (herkese açık URL/token yok). Eşzamanlılık sınırlı, sonuçlar önbellekte; dispose() URL'leri serbest bırakır. */
export function createBlobResolver(concurrency = 4) {
  const cache = new Map<string, Promise<string>>();
  const urls: string[] = [];
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    while (active < concurrency && queue.length) {
      active++;
      queue.shift()!();
    }
  };
  const resolve = (c: Candidate): Promise<string> => {
    let p = cache.get(c.imageKey);
    if (!p) {
      p = new Promise<string>((res, rej) => {
        queue.push(() => {
          if (!storage) { active--; rej(new Error('Depolama hazır değil')); next(); return; }
          getBlob(ref(storage, c.imageKey))
            .then((b) => { const u = URL.createObjectURL(b); urls.push(u); res(u); })
            .catch(rej)
            .finally(() => { active--; next(); });
        });
        next();
      });
      cache.set(c.imageKey, p);
      p.catch(() => cache.delete(c.imageKey)); // hata kalıcı önbelleğe yazılmaz
    }
    return p;
  };
  return { resolve, dispose: () => { urls.splice(0).forEach((u) => URL.revokeObjectURL(u)); cache.clear(); } };
}
