/** Canva senkronu ve AI kataloglama — istemci çağrıları (token/secret istemciye hiç gelmez) */
import { authenticatedFetch } from '@/lib/firebase/apiClient';

async function json(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.error || `İstek başarısız (${res.status})`), { status: res.status, code: body?.code });
  return body;
}

const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

export const getCanvaStatus = (projectId: string) => authenticatedFetch(`/api/canva/folder?${q({ projectId })}`).then(json);
export const listCanvaFolder = (projectId: string, cursor?: string) =>
  authenticatedFetch(`/api/canva/folder?${q({ projectId, list: '1', ...(cursor ? { cursor } : {}) })}`).then(json);
export const getCanvaSync = (projectId: string, assetId: string) => authenticatedFetch(`/api/canva/sync?${q({ projectId, assetId })}`).then(json);
export const runCanvaSync = (projectId: string, assetId: string, command?: unknown) =>
  authenticatedFetch('/api/canva/sync', { method: 'POST', body: JSON.stringify({ projectId, assetId, ...(command ? { command } : {}) }) }).then(json);
/** Studio yüklemesi tamamlandı bildirimi: sunucu koşulları kontrol eder; kapalı/eşlemesizse dış çağrı yapmaz.
 *  Bildirim kaybolsa da (sayfa kapandı) sunucu işçisi uzlaştırır — Studio yüklemesi bu çağrının sonucuna bağlı DEĞİL. */
export const notifyCanvaUploadComplete = (projectId: string, assetId: string) =>
  authenticatedFetch('/api/canva/sync', { method: 'POST', body: JSON.stringify({ projectId, assetId, trigger: 'upload_complete' }) }).then(json);
/** Yükleme tamamlandı → AI kataloglama işi (Canva'dan BAĞIMSIZ; kapalıysa sunucu yazma/çağrı yapmaz) */
export const notifyMediaUploadComplete = (projectId: string, assetId: string) =>
  authenticatedFetch('/api/media/analyze', { method: 'POST', body: JSON.stringify({ projectId, assetId, trigger: 'upload_complete' }) }).then(json);
/** İnsan katalog düzeltmesi (AI yeniden analizi ezmez; onay kapısı değildir) */
export const saveCatalogCorrection = (projectId: string, assetId: string, correction: unknown) =>
  authenticatedFetch('/api/media/analyze', { method: 'POST', body: JSON.stringify({ projectId, assetId, correction }) }).then(json);
/** Haftalık plan TASLAK önerisi (insan mevcut akışta draft olarak ekler); geçmiş ayarları kullanıcıdan */
export interface PlanHistorySettings {
  lookbackDays: number;
  repeatGapDays: number;
  countPending: boolean;
}
export const requestPlanSuggestion = (projectId: string, weekStart: string, count: number, history?: PlanHistorySettings) =>
  authenticatedFetch('/api/studio/plan-suggest', { method: 'POST', body: JSON.stringify({ projectId, weekStart, count, ...(history ? { history } : {}) }) }).then(json);

/** AI öneri reddi sebebi (actor/zaman sunucuda; öneri saklanmış kümeden doğrulanır; aynı idempotencyKey tekrarında yeni kayıt yok).
 *  Post Düzeltilsin/Revizyona al sebebi bu çağrıyla DEĞİL, runApprovalAction({ feedback }) ile geçişle birlikte gider. */
export interface SuggestionFeedbackSubmission {
  target: { kind: 'suggestion'; suggestionSetId: string; index: number };
  category: string;
  note: string;
  scope: 'content_only' | 'brand_context';
  idempotencyKey: string;
  expectedContentHash: string;
}
export const submitFeedback = (f: SuggestionFeedbackSubmission) => authenticatedFetch('/api/studio/feedback', { method: 'POST', body: JSON.stringify(f) }).then(json);
export const newIdempotencyKey = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`).slice(0, 64);
/** Yükleme sonrası iki bağımsız bildirim; biri reddedilse de diğeri gider (Promise.allSettled), hata fırlatmaz */
export async function notifyUploadComplete(
  projectId: string,
  assetId: string,
  calls: { canva: typeof notifyCanvaUploadComplete; analysis: typeof notifyMediaUploadComplete } = { canva: notifyCanvaUploadComplete, analysis: notifyMediaUploadComplete }
) {
  const [canva, analysis] = await Promise.allSettled([calls.canva(projectId, assetId), calls.analysis(projectId, assetId)]);
  return { canva: canva.status, analysis: analysis.status };
}
export const getMediaAnalysis = (projectId: string, assetId: string) => authenticatedFetch(`/api/media/analyze?${q({ projectId, assetId })}`).then(json);
export const runMediaAnalysis = (projectId: string, assetId: string) =>
  authenticatedFetch('/api/media/analyze', { method: 'POST', body: JSON.stringify({ projectId, assetId }) }).then(json);

export const SYNC_STATE_LABEL: Record<string, string> = {
  pending: 'Sırada',
  upload_started: 'Yükleniyor',
  upload_submitted: "Canva'da işleniyor",
  uploaded: "Canva'ya yüklendi (klasöre taşınacak)",
  moving: 'Klasöre taşınıyor',
  done: "Canva klasöründe",
  unsupported: 'Desteklenmiyor (yalnız JPEG/PNG, 50 MB altı)',
  failed: 'Başarısız',
  needs_review: "Belirsiz — Canva'da kontrol gerekli",
  move_failed: 'Klasöre taşınamadı',
};

export const QUALITY_LABEL: Record<string, string> = {
  original: 'orijinal dosyadan',
  derived_resize: 'küçültülmüş türevden',
  studio_preview: "Studio önizlemesinden (orijinal kalite DEĞİL)",
  canva_preview: "Canva önizlemesinden (orijinal kalite DEĞİL)",
};
