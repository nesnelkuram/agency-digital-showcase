import React, { useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { createSocialPost } from '@/shared/services/socialMediaService';
import type { MediaItem, PostType } from '@/shared/types/socialMedia';
import { newIdempotencyKey, requestPlanSuggestion, submitFeedback, type PlanHistorySettings } from '../mediaIntegrationsApi';
import FeedbackReasonFields, { EMPTY_REASON, type FeedbackReasonValue } from './FeedbackReasonFields';

export interface SuggestedPost {
  index: number;
  scheduledAt: string;
  postType: PostType;
  mediaIds: string[];
  media: MediaItem[];
  captionDraft: string;
  rationale: string;
  readinessWarnings: boolean;
  /** Sunucunun saklanmış öneri için hesapladığı hash (ret bu sürüme bağlanır) */
  contentHash?: string;
  /** Geçmiş/geri bildirim uyarıları (engellemez) */
  warnings?: string[];
}

export interface HistoryScopeView {
  available: boolean;
  source: string;
  windowStart: string;
  windowEnd: string;
  postsInWindow: number;
  undatedPosts: number;
  byBucket: Record<string, number>;
}

export interface SuggestionResponse {
  suggestionSetId?: string | null;
  historyScope?: HistoryScopeView;
  accepted: SuggestedPost[];
  rejected: Array<{ index: number; reasons: string[] }>;
  shortages: string[];
  inventory: { eligible: number; excluded: Array<{ mediaId: string; reason: string }>; /** Eski öneri uç noktası en yeni 200 medyayı görür; true ise daha eskiler değerlendirilmedi */ truncated?: boolean };
  modelCalled: boolean;
}

/**
 * Öneriyi mevcut post servisiyle TASLAK post'a çevirir (onay/yayın yok; plan oluşturma mevcut akışta).
 * Sıralı; her başarılı kayıt HEMEN onCreated ile bildirilir → kısmi hatada çağıran eklenenleri işaretler ve
 * yeniden deneme yalnız kalanları ekler (çoğalma yok). İlk hatada durur ve hatayı fırlatır.
 */
export async function addSuggestionsAsDrafts(
  p: { tenantId: string; projectId: string; uid: string; name: string; posts: SuggestedPost[]; onCreated?: (index: number, postId: string) => void },
  create: typeof createSocialPost = createSocialPost
): Promise<string[]> {
  const ids: string[] = [];
  for (const s of p.posts) {
    const id = await create(
        p.tenantId,
        {
          projectId: p.projectId,
          caption: s.captionDraft,
          aiGeneratedCaption: s.captionDraft,
          media: s.media,
          mediaUrls: s.media.map((m) => m.url),
          libraryAssetIds: s.mediaIds,
          postType: s.postType,
          platforms: ['instagram'],
          scheduledAt: Timestamp.fromDate(new Date(s.scheduledAt)),
          tags: ['ai-taslak'],
        },
        p.uid,
        p.name
      );
    ids.push(id);
    p.onCreated?.(s.index, id);
  }
  return ids;
}

const PanelInner: React.FC<{
  tenantId: string;
  projectId: string;
  weekStart: string;
  timeZone: string;
  uid: string;
  userName: string;
  onDraftsCreated: () => void;
}> = ({ tenantId, projectId, weekStart, timeZone, uid, userName, onDraftsCreated }) => {
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestionResponse | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  /** Bu öneri setinden taslak olarak KAYDEDİLMİŞ indeksler (yeniden denemede atlanır) */
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<PlanHistorySettings>({ lookbackDays: 28, repeatGapDays: 14, countPending: true });
  /** Reddedilen (sebebi kaydedilmiş) öneriler */
  const [rejectedByUser, setRejectedByUser] = useState<Set<number>>(new Set());
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<FeedbackReasonValue>(EMPTY_REASON);
  const [rejectError, setRejectError] = useState<string | null>(null);
  /** Öneri başına sabit gönderim anahtarı (çift tıklama/yeniden deneme tek kayıt) */
  const rejectKeys = useRef(new Map<number, string>());

  const keyFor = (index: number) => {
    if (!rejectKeys.current.has(index)) rejectKeys.current.set(index, newIdempotencyKey());
    return rejectKeys.current.get(index)!;
  };

  const submitReject = async (a: SuggestedPost) => {
    if (!result?.suggestionSetId || !a.contentHash) return;
    setBusy(true);
    setRejectError(null);
    try {
      await submitFeedback({
        target: { kind: 'suggestion', suggestionSetId: result.suggestionSetId, index: a.index },
        category: rejectReason.category,
        note: rejectReason.note.trim(),
        scope: rejectReason.scope,
        idempotencyKey: keyFor(a.index),
        expectedContentHash: a.contentHash,
      });
      setRejectedByUser((prev) => new Set(prev).add(a.index));
      setPicked((prev) => {
        const n = new Set(prev);
        n.delete(a.index);
        return n;
      });
      setRejecting(null);
      setRejectReason(EMPTY_REASON);
    } catch (e: any) {
      setRejectError(e?.message || 'Sebep kaydedilemedi; tekrar denerseniz aynı gönderim kullanılır.');
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r: SuggestionResponse = await requestPlanSuggestion(projectId, weekStart, count, history);
      setResult(r);
      setAdded(new Set());
      setRejectedByUser(new Set());
      rejectKeys.current = new Map();
      setPicked(new Set(r.accepted.map((a) => a.index)));
    } catch (e: any) {
      setError(e?.code === 'feature_disabled' ? 'AI plan önerisi bu ortamda kapalı.' : e?.message || 'Öneri alınamadı.');
    } finally {
      setBusy(false);
    }
  };

  const addDrafts = async () => {
    if (!result) return;
    setBusy(true);
    setError(null);
    const remaining = result.accepted.filter((a) => picked.has(a.index) && !added.has(a.index) && !rejectedByUser.has(a.index));
    let createdAny = false;
    try {
      await addSuggestionsAsDrafts({
        tenantId,
        projectId,
        uid,
        name: userName,
        posts: remaining,
        onCreated: (index) => {
          createdAny = true;
          setAdded((prev) => new Set(prev).add(index));
          setPicked((prev) => {
            const n = new Set(prev);
            n.delete(index);
            return n;
          });
        },
      });
      setResult(null);
      onDraftsCreated();
    } catch {
      setError('Bazı taslaklar eklenemedi. Eklenenler işaretlendi; tekrar denerseniz yalnız kalanlar eklenir.');
      if (createdAny) onDraftsCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card p-4 space-y-3" data-testid="plan-suggest-panel">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <p className="font-grotesk text-sm font-semibold text-[#171717] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> AI taslak önerisi
          </p>
          <p className="font-grotesk text-xs text-neutral-500">
            Yalnız bu markanın kütüphanesindeki uygun medya kullanılır. Öneriler taslak olarak eklenir; kontrol ve onay her zamanki gibi.
          </p>
        </div>
        <label className="font-grotesk text-xs text-neutral-600">
          Post sayısı
          <input type="number" min={1} max={14} value={count} onChange={(e) => setCount(Math.max(1, Math.min(14, Number(e.target.value) || 1)))} className="block mt-1 w-20 px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-sm" />
        </label>
        <label className="font-grotesk text-xs text-neutral-600" title="Geçmiş paylaşımlara kaç gün geriye bakılsın">
          Geriye bakış (gün)
          <input aria-label="Geriye bakış (gün)" type="number" min={7} max={180} value={history.lookbackDays} onChange={(e) => setHistory({ ...history, lookbackDays: Math.max(7, Math.min(180, Number(e.target.value) || 7)) })} className="block mt-1 w-20 px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-sm" />
        </label>
        <label className="font-grotesk text-xs text-neutral-600" title="Aynı medya en az kaç gün arayla kullanılsın; 0 = kontrol kapalı">
          Medya tekrar aralığı (gün)
          <input aria-label="Medya tekrar aralığı (gün)" type="number" min={0} max={90} value={history.repeatGapDays} onChange={(e) => setHistory({ ...history, repeatGapDays: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })} className="block mt-1 w-20 px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-sm" />
        </label>
        <label className="font-grotesk text-xs text-neutral-600 flex items-center gap-1.5 pb-2">
          <input type="checkbox" checked={history.countPending} onChange={(e) => setHistory({ ...history, countPending: e.target.checked })} />
          Onay sürecindekiler de tekrar sayılsın
        </label>
        <button onClick={ask} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Öneri al
        </button>
      </div>
      {error && <p className="font-grotesk text-sm text-red-600">{error}</p>}
      {result && (
        <div className="space-y-2">
          {result.historyScope && (
            <p className="font-grotesk text-[11px] text-neutral-500" data-testid="history-scope">
              {result.historyScope.available
                ? `Geçmiş (${result.historyScope.windowStart}–${result.historyScope.windowEnd}): ${result.historyScope.postsInWindow} paylaşım — yayınlandı ${result.historyScope.byBucket['yayınlandı'] || 0}, planlı ${result.historyScope.byBucket['planlı'] || 0}, onay sürecinde ${result.historyScope.byBucket['onay_sürecinde'] || 0}.`
                : `Geçmiş paylaşım verisi yok (${result.historyScope.windowStart}–${result.historyScope.windowEnd}).`}{' '}
              {result.historyScope.source}
            </p>
          )}
          {result.inventory.truncated && (
            <p className="font-grotesk text-[11px] text-amber-700" role="status" data-testid="inventory-truncated">
              Bu öneri yalnız kütüphanedeki en yeni 200 dosyayı değerlendirdi; daha eskileri dikkate alınmadı. Tüm katalogla çalışmak için Planlayıcı sayfasını kullanın (sayfalı).
            </p>
          )}
          {result.shortages.map((s, i) => (
            <p key={i} className="font-grotesk text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2" data-testid="plan-suggest-shortage">
              {s}
            </p>
          ))}
          {result.rejected.length > 0 && (
            <p className="font-grotesk text-[11px] text-neutral-500">{result.rejected.length} öneri doğrulamadan geçmedi ve gösterilmiyor.</p>
          )}
          {result.accepted.map((a) => {
            const done = added.has(a.index) || rejectedByUser.has(a.index);
            return (
              <div key={a.index} className="border border-neutral-100 rounded-lg p-2 space-y-2" data-testid={`suggestion-${a.index}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Öneri ${a.index + 1}`}
                    disabled={done}
                    checked={picked.has(a.index) && !done}
                    onChange={() => setPicked((prev) => { const n = new Set(prev); n.has(a.index) ? n.delete(a.index) : n.add(a.index); return n; })}
                    className="mt-1"
                  />
                  <div className="flex gap-1 shrink-0">
                    {a.media.slice(0, 3).map((m) => (
                      <img key={m.id} src={m.thumbnailUrl || m.url} alt="" className="w-12 h-12 object-cover rounded" />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-grotesk text-xs text-neutral-500">
                      {new Date(a.scheduledAt).toLocaleString('tr-TR', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {a.postType}
                      {a.readinessWarnings && ' · hazırlık uyarısı var'}
                      {added.has(a.index) && ' · taslak olarak eklendi'}
                      {rejectedByUser.has(a.index) && ' · reddedildi'}
                    </p>
                    <p className="font-grotesk text-sm text-[#171717] line-clamp-2">{a.captionDraft}</p>
                    <p className="font-grotesk text-[11px] text-neutral-400 line-clamp-1">{a.rationale}</p>
                    {!!a.warnings?.length && <p className="font-grotesk text-[11px] text-amber-700">{a.warnings.join(' · ')}</p>}
                  </div>
                  {!done && result.suggestionSetId && a.contentHash && rejecting !== a.index && (
                    <button onClick={() => { setRejecting(a.index); setRejectReason(EMPTY_REASON); setRejectError(null); }} className="px-2 py-1 border border-neutral-200 rounded-lg font-grotesk text-xs">
                      Reddet
                    </button>
                  )}
                </div>
                {rejecting === a.index && (
                  <div className="pl-7 space-y-2" data-testid={`reject-form-${a.index}`}>
                    <FeedbackReasonFields value={rejectReason} onChange={setRejectReason} notePlaceholder="Neden uygun değil?" />
                    {rejectError && <p className="font-grotesk text-xs text-red-600">{rejectError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => setRejecting(null)} className="px-2 py-1 border border-neutral-200 rounded-lg font-grotesk text-xs">Vazgeç</button>
                      <button disabled={busy || !rejectReason.category} onClick={() => submitReject(a)} className="px-2 py-1 bg-[#111] text-white rounded-full font-grotesk text-xs disabled:opacity-50">
                        Sebebi kaydet ve reddet
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {result.accepted.length > 0 && (
            <button onClick={addDrafts} disabled={busy || picked.size === 0} className="px-3 py-2 bg-[#111] text-white rounded-full font-grotesk text-sm disabled:opacity-50">
              Seçilenleri taslak olarak ekle ({picked.size})
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/** Hafta/proje değişince öneri durumu sıfırlansın (keyed remount) */
const PlanSuggestPanel: React.FC<React.ComponentProps<typeof PanelInner>> = (props) => <PanelInner key={`${props.projectId}:${props.weekStart}`} {...props} />;

export default PlanSuggestPanel;
