import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink, Sparkles, UploadCloud } from 'lucide-react';
import {
  QUALITY_LABEL,
  SYNC_STATE_LABEL,
  getCanvaStatus,
  getCanvaSync,
  getMediaAnalysis,
  listCanvaFolder,
  runCanvaSync,
  runMediaAnalysis,
} from '../mediaIntegrationsApi';

/** Bileşen kapandıktan (kimlik değişip yeniden kurulduktan) sonra gelen sonuçları yok saymak için */
function useAlive() {
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    []
  );
  return alive;
}

/** Kütüphane sayfası: eşlenen Canva klasöründeki görseller — yalnız önizleme, takvime eklenemez.
 *  Proje kimliğiyle anahtarlı: marka değişince durum sıfırlanır, eski yanıtlar yeni markaya yazılmaz. */
export const CanvaFolderPanel: React.FC<{ projectId: string }> = (p) => <CanvaFolderPanelInner key={p.projectId} {...p} />;

const CanvaFolderPanelInner: React.FC<{ projectId: string }> = ({ projectId }) => {
  const alive = useAlive();
  const [status, setStatus] = useState<any>(null);
  const [items, setItems] = useState<any[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCanvaStatus(projectId)
      .then((s) => alive.current && setStatus(s))
      .catch((e) => alive.current && setError(e.message));
  }, [projectId, alive]);

  const load = async (next?: string) => {
    setBusy(true);
    setError(null);
    try {
      const page = await listCanvaFolder(projectId, next);
      if (!alive.current) return;
      setItems((prev) => (next && prev ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch (e: any) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  if (error) return <p className="font-grotesk text-sm text-red-600">{error}</p>;
  if (!status) return <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />;
  if (!status.enabled) return <p className="font-grotesk text-sm text-neutral-500">Canva entegrasyonu kapalı: {status.reason}</p>;
  if (!status.connection?.connected) return <p className="font-grotesk text-sm text-neutral-500">Canva hesabı bağlı değil (yönetici bağlamalı).</p>;
  if (!status.mapping) return <p className="font-grotesk text-sm text-neutral-500">Bu marka için Canva klasörü eşlenmemiş.</p>;

  return (
    <div className="space-y-3" data-testid="canva-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="font-grotesk text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
          Yalnız önizleme: Canva orijinal indirme sunmaz; bu görseller takvime/posta eklenemez. Videolar listelenmez.
        </p>
        <a href={status.mapping.folderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-grotesk text-xs underline shrink-0">
          Canva klasörünü aç <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {items === null ? (
        <button onClick={() => load()} disabled={busy} className="px-3 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-sm disabled:opacity-50">
          {busy ? 'Yükleniyor…' : "Canva görsellerini göster"}
        </button>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {items.map((i) => (
              <div key={i.id} className="glass-tile overflow-hidden" title={i.name}>
                <div className="aspect-square bg-neutral-100">{i.thumbnail?.url && <img src={i.thumbnail.url} alt={i.name} className="w-full h-full object-cover" loading="lazy" />}</div>
                <p className="px-1.5 py-1 font-grotesk text-[10px] truncate">{i.name}</p>
              </div>
            ))}
          </div>
          {cursor && (
            <button onClick={() => load(cursor)} disabled={busy} className="px-3 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs">
              Daha fazla
            </button>
          )}
        </>
      )}
    </div>
  );
};

type AssetProps = { projectId: string; assetId: string; kind: 'photo' | 'video' };

/** Görsel ayrıntısı: AI katalog ve Canva kopyası durumu (her biri bağımsız; Studio kaydını etkilemez).
 *  Proje+varlık kimliğiyle anahtarlı: başka varlığa geçince durum sıfırlanır; geç gelen sonuç yazılmaz. */
export const AssetIntegrations: React.FC<AssetProps> = (p) => <AssetIntegrationsInner key={`${p.projectId}:${p.assetId}`} {...p} />;

const AssetIntegrationsInner: React.FC<AssetProps> = ({ projectId, assetId, kind }) => {
  const alive = useAlive();
  const [analysis, setAnalysis] = useState<any>(null);
  const [sync, setSync] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMediaAnalysis(projectId, assetId).then((r) => alive.current && setAnalysis(r)).catch(() => alive.current && setAnalysis({ enabled: false, analysis: null }));
    getCanvaSync(projectId, assetId).then((r) => alive.current && setSync(r)).catch(() => alive.current && setSync({ enabled: false, job: null }));
  }, [projectId, assetId, alive]);

  const act = async (name: string, fn: () => Promise<any>, set: (v: any) => void) => {
    setBusy(name);
    setError(null);
    try {
      const r = await fn();
      if (alive.current) set(r);
    } catch (e: any) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const a = analysis?.analysis;
  const job = sync?.job;
  return (
    <div className="space-y-3" data-testid="asset-integrations">
      <div>
        <p className="flex items-center gap-1 font-grotesk text-xs font-medium text-neutral-500 mb-1">
          <Sparkles className="w-3.5 h-3.5" /> AI katalog
        </p>
        {!analysis ? (
          <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
        ) : a?.status === 'done' ? (
          <div className="font-grotesk text-sm text-neutral-700 space-y-1">
            <p>{a.result.description}</p>
            {a.result.tags?.length > 0 && <p className="text-xs text-neutral-500">{a.result.tags.map((t: string) => `#${t}`).join(' ')}</p>}
            {a.result.uncertainties?.length > 0 && <p className="text-xs text-amber-700">Belirsiz: {a.result.uncertainties.join('; ')}</p>}
            <p className="text-[10px] text-neutral-400">
              {a.model} · {QUALITY_LABEL[a.sourceQuality] || a.sourceQuality} · {a.promptVersion}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {a?.status === 'failed' && <span className="font-grotesk text-xs text-red-600">{a.error?.message}</span>}
            {a?.status === 'unsupported' && <span className="font-grotesk text-xs text-neutral-500">{a.error?.message}</span>}
            {kind === 'photo' && (
              <button
                disabled={!analysis.enabled || busy !== null}
                title={analysis.enabled ? undefined : 'AI analizi kapalı'}
                onClick={() => act('analyze', () => runMediaAnalysis(projectId, assetId), setAnalysis)}
                className="px-2.5 py-1 border border-neutral-200 rounded-lg font-grotesk text-xs disabled:opacity-40"
              >
                {busy === 'analyze' ? 'Analiz ediliyor…' : 'Bu görseli analiz et'}
              </button>
            )}
          </div>
        )}
      </div>
      <div>
        <p className="flex items-center gap-1 font-grotesk text-xs font-medium text-neutral-500 mb-1">
          <UploadCloud className="w-3.5 h-3.5" /> Canva kopyası
        </p>
        {!sync ? (
          <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
        ) : !sync.enabled ? (
          <p className="font-grotesk text-xs text-neutral-500">Canva entegrasyonu kapalı.</p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-grotesk text-xs text-neutral-700">{job ? SYNC_STATE_LABEL[job.state] || job.state : 'Henüz gönderilmedi'}</span>
            {job?.lastError && <span className="font-grotesk text-xs text-red-600">{job.lastError.message}</span>}
            {(!job || ['pending', 'upload_submitted', 'uploaded'].includes(job.state)) && (
              <button
                disabled={busy !== null}
                onClick={() => act('sync', () => runCanvaSync(projectId, assetId), setSync)}
                className="px-2.5 py-1 border border-neutral-200 rounded-lg font-grotesk text-xs disabled:opacity-40"
              >
                {busy === 'sync' ? 'Gönderiliyor…' : job ? 'Devam et' : "Canva'ya kopyala"}
              </button>
            )}
            {job?.state === 'needs_review' && (
              <span className="font-grotesk text-[11px] text-amber-700">Yönetici Canva'da kontrol etmeli (otomatik yeniden yükleme yapılmaz).</span>
            )}
          </div>
        )}
      </div>
      {error && <p className="font-grotesk text-xs text-red-600">{error}</p>}
    </div>
  );
};
