import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Loader2, Film, X, Archive, ArchiveRestore, Images } from 'lucide-react';
import { useStudio } from '../StudioLayout';
import { useLibraryUpload } from '../hooks/useLibraryUpload';
import {
  ASSET_USAGE_LIMIT,
  LIBRARY_PAGE_SIZE,
  getAssetUsage,
  getUsedAssetIds,
  listBrandMedia,
  setBrandMediaArchived,
  updateBrandMediaInfo,
  type AssetUsage,
} from '../brandMediaData';
import { formatDate, STUDIO_STATUS_LABEL } from '../studioData';
import {
  formatBytesDecimal,
  normalizeTag,
  normalizeTags,
  LIBRARY_MAX_FILE_BYTES,
  type BrandMediaAsset,
  type BrandMediaKind,
  type BrandMediaStatus,
} from '@/shared/types/brandMedia';
import ReadinessNotice from '../components/ReadinessNotice';
import { AssetIntegrations, CanvaFolderPanel } from '../components/MediaIntegrations';
import { checkInstagramReadiness } from '@/shared/social/instagramReadiness';

type KindFilter = 'all' | BrandMediaKind;
type UsageFilter = 'all' | 'used' | 'unused';

const AssetDetail: React.FC<{
  asset: BrandMediaAsset;
  tenantId: string;
  projectId: string;
  onClose: () => void;
  onChanged: () => void;
}> = ({ asset, tenantId, projectId, onClose, onChanged }) => {
  const [title, setTitle] = useState(asset.title);
  const [tags, setTags] = useState(asset.tags.join(', '));
  const [usage, setUsage] = useState<AssetUsage[] | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setUsage(null);
    setUsageError(false);
    getAssetUsage(tenantId, projectId, asset.id)
      .then((u) => alive && setUsage(u))
      .catch((err) => {
        console.error('[Studio] Kullanım geçmişi yüklenemedi:', err);
        if (alive) setUsageError(true);
      });
    return () => {
      alive = false;
    };
  }, [asset.id, tenantId, projectId]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err: any) {
      console.error('[Studio] Kütüphane kaydı güncellenemedi:', err);
      setError(err?.code === 'permission-denied' ? 'Bu işlem için yetkiniz yok.' : 'Kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  const s = asset.storage;
  const sample = checkInstagramReadiness(asset.kind === 'video' ? 'reels' : 'static', [
    { type: asset.kind === 'video' ? 'video' : 'image', mimeType: s.contentType, size: s.size, width: s.width, height: s.height, duration: s.duration },
  ]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-xl h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-neutral-100 px-4 py-3 flex items-center justify-between">
          <p className="font-grotesk text-sm font-semibold text-[#171717] truncate">{asset.title || asset.fileName}</p>
          <button onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-neutral-900 rounded-xl overflow-hidden aspect-square flex items-center justify-center">
            {asset.kind === 'video' ? (
              <video src={s.downloadUrl} poster={s.thumbUrl} controls playsInline preload="metadata" className="max-h-full max-w-full" />
            ) : (
              <img src={s.downloadUrl} alt={asset.title} className="max-h-full max-w-full object-contain" />
            )}
          </div>
          <p className="font-grotesk text-xs text-neutral-500">
            {asset.kind === 'video' ? 'Video' : 'Fotoğraf'} · {formatBytesDecimal(s.size)} · {s.contentType}
            {s.width && s.height ? ` · ${s.width}×${s.height}` : ''}
            {s.duration ? ` · ${Math.round(s.duration)} sn` : ''}
            {asset.createdAt && ` · Eklendi: ${formatDate(asset.createdAt)}`}
          </p>

          <div className="space-y-2">
            <label className="block font-grotesk text-xs font-medium text-neutral-500">Başlık</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm" />
            <label className="block font-grotesk text-xs font-medium text-neutral-500">Etiketler (virgülle)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="urun, kampanya" className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm" />
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => run(() => updateBrandMediaInfo(asset.id, { title: title.trim(), tags: normalizeTags(tags) }))}
                className="px-3 py-1.5 bg-[#111] text-white rounded-full font-grotesk text-sm disabled:opacity-50"
              >
                Kaydet
              </button>
              <button
                disabled={busy}
                onClick={() => run(() => setBrandMediaArchived(asset.id, asset.status !== 'archived'))}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-200 rounded-full font-grotesk text-sm disabled:opacity-50"
              >
                {asset.status === 'archived' ? (
                  <>
                    <ArchiveRestore className="w-4 h-4" /> Arşivden çıkar
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" /> Arşivle
                  </>
                )}
              </button>
            </div>
            {error && <p className="font-grotesk text-sm text-red-600">{error}</p>}
          </div>

          <div>
            <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">
              Instagram ön kontrolü ({asset.kind === 'video' ? 'Reels olarak' : 'tekli gönderi olarak'})
            </p>
            <ReadinessNotice result={sample} />
          </div>

          <div>
            <button onClick={() => setShowIntegrations((v) => !v)} className="font-grotesk text-xs underline text-neutral-600">
              {showIntegrations ? 'AI katalog ve Canva kopyasını gizle' : 'AI katalog ve Canva kopyası'}
            </button>
            {showIntegrations && (
              <div className="mt-2">
                <AssetIntegrations projectId={projectId} assetId={asset.id} kind={asset.kind} />
              </div>
            )}
          </div>

          <div>
            <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">Kullanım geçmişi (kaydedilmiş içerikler)</p>
            {usageError ? (
              <p className="font-grotesk text-sm text-amber-700">Kullanım geçmişi alınamadı; bu dosyanın kullanılıp kullanılmadığı şu an bilinmiyor.</p>
            ) : usage === null ? (
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            ) : usage.length === 0 ? (
              <p className="font-grotesk text-sm text-neutral-500">Henüz bir içerikte kullanılmadı.</p>
            ) : (
              <ul className="space-y-1">
                {usage.map((u) => (
                  <li key={u.postId} className="font-grotesk text-sm text-neutral-700">
                    {STUDIO_STATUS_LABEL[u.status] || u.status}
                    {u.publishedAt ? ` · yayın: ${formatDate(u.publishedAt, true)}` : u.scheduledAt ? ` · planlanan: ${formatDate(u.scheduledAt, true)}` : ''}
                    {u.contentPlanId && (
                      <>
                        {' · '}
                        <Link to={`/studio/${projectId}/planlar/${u.contentPlanId}`} className="underline">
                          plan
                        </Link>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {usage && usage.length >= ASSET_USAGE_LIMIT && (
              <p className="font-grotesk text-[11px] text-neutral-500 mt-1">İlk {ASSET_USAGE_LIMIT} kullanım gösteriliyor; daha fazlası olabilir.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Marka medya kütüphanesi — yalnız paylaşılmaya hazır final fotoğraf/video */
const StudioLibraryPage: React.FC = () => {
  const { project, tenantId } = useStudio();
  const projectId = project?.id;
  const [status, setStatus] = useState<BrandMediaStatus>('active');
  const [assets, setAssets] = useState<BrandMediaAsset[]>([]);
  // null: kullanım bilgisi alınamadı → kullanılmış/kullanılmamış kesin gösterilmez
  const [used, setUsed] = useState<Set<string> | null>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<KindFilter>('all');
  const [usage, setUsage] = useState<UsageFilter>('all');
  const [tag, setTag] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [detail, setDetail] = useState<BrandMediaAsset | null>(null);
  const [showCanva, setShowCanva] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    if (!projectId) return;
    const id = ++request.current;
    setError(null);
    try {
      const list = await listBrandMedia(tenantId, projectId, { status });
      if (id !== request.current) return;
      setAssets(list);
      const usedIds = await getUsedAssetIds(tenantId, projectId, list.map((a) => a.id)).catch((err) => {
        console.error('[Studio] Kullanım bilgisi alınamadı:', err);
        return null;
      });
      if (id !== request.current) return;
      setUsed(usedIds);
    } catch (err) {
      console.error('[Studio] Kütüphane yüklenemedi:', err);
      if (id === request.current) setError('Kütüphane yüklenemedi.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [projectId, tenantId, status]);

  // Marka değişimi: eski liste/ayrıntı gösterilmez
  useEffect(() => {
    setLoading(true);
    setAssets([]);
    setDetail(null);
    setUploadErrors([]);
    load();
  }, [load]);

  // Kuyruk uygulama düzeyinde yaşar (UploadTray); Canva/AI kataloglama bildirimi de orada, sayfadan bağımsız gider.
  const upload = useLibraryUpload({
    tenantId,
    projectId,
    projectName: project?.name,
    onAssetCreated: () => load(),
  });

  const tagFilter = normalizeTag(tag);
  const visible = useMemo(
    () =>
      assets.filter(
        (a) =>
          (kind === 'all' || a.kind === kind) &&
          (!tagFilter || a.tags.some((t) => t.startsWith(tagFilter))) &&
          (usage === 'all' || (used !== null && (usage === 'used' ? used.has(a.id) : !used.has(a.id))))
      ),
    [assets, kind, tagFilter, usage, used]
  );

  if (!project) return null;

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full font-grotesk text-xs ${active ? 'bg-[#171717] text-white' : 'glass-chip text-[#171717]'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-grotesk text-xl font-semibold text-[#171717]">Medya kütüphanesi</h1>
          <p className="font-grotesk text-sm text-neutral-500">
            Yalnız paylaşılmaya hazır final fotoğraf ve videolar. Dosya başına yükleme sınırı {formatBytesDecimal(LIBRARY_MAX_FILE_BYTES)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={uploadTags}
            onChange={(e) => setUploadTags(e.target.value)}
            placeholder="Yüklenenlere etiket (ops.)"
            className="px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm w-48"
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            data-testid="library-file-input"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              if (files.length) setUploadErrors(upload.enqueue(files, normalizeTags(uploadTags)));
            }}
          />
          <button
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#111] text-white rounded-full font-grotesk text-sm hover:bg-neutral-800"
          >
            <Upload className="w-4 h-4" /> Final yükle
          </button>
        </div>
      </div>

      {uploadErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 space-y-0.5">
          {uploadErrors.map((e, i) => (
            <p key={i} className="font-grotesk text-sm text-red-700">
              {e}
            </p>
          ))}
        </div>
      )}

      {upload.items.length > 0 && (
        <p className="font-grotesk text-xs text-neutral-500" data-testid="upload-moved-note">
          {upload.items.filter((i) => ['queued', 'uploading', 'paused', 'saving'].includes(i.status)).length > 0
            ? 'Yüklemeler sağ alttaki tek ilerleme çubuğunda sürüyor; sayfadan veya markadan ayrılabilirsiniz.'
            : 'Bu markanın yüklemeleri sağ alttaki çubukta listelenir.'}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'photo', 'video'] as KindFilter[]).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={chip(kind === k)}>
            {k === 'all' ? 'Tümü' : k === 'photo' ? 'Fotoğraf' : 'Video'}
          </button>
        ))}
        <span className="w-px h-5 bg-neutral-200 mx-1" />
        {(['all', 'unused', 'used'] as UsageFilter[]).map((u) => (
          <button
            key={u}
            onClick={() => setUsage(u)}
            disabled={used === null && u !== 'all'}
            title={used === null && u !== 'all' ? 'Kullanım bilgisi alınamadı' : undefined}
            className={`${chip(usage === u)} disabled:opacity-40`}
          >
            {u === 'all' ? 'Hepsi' : u === 'unused' ? 'Kullanılmamış' : 'Kullanılmış'}
          </button>
        ))}
        <span className="w-px h-5 bg-neutral-200 mx-1" />
        <button onClick={() => setStatus(status === 'active' ? 'archived' : 'active')} className={chip(status === 'archived')}>
          {status === 'archived' ? 'Arşiv gösteriliyor' : 'Arşivi göster'}
        </button>
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Etiket ara"
          className="ml-auto px-3 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-sm"
        />
      </div>

      <div className="glass-tile p-3">
        <button onClick={() => setShowCanva((v) => !v)} className="font-grotesk text-sm font-medium text-[#171717]">
          {showCanva ? '▾' : '▸'} Canva klasörü (yalnız önizleme)
        </button>
        {showCanva && (
          <div className="mt-3">
            <CanvaFolderPanel projectId={project.id} />
          </div>
        )}
      </div>

      {error && <p className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 font-grotesk text-sm text-red-700">{error}</p>}
      {!error && used === null && (
        <p className="font-grotesk text-xs text-amber-700">Kullanım bilgisi alınamadı; dosyaların kullanılıp kullanılmadığı şu an bilinmiyor.</p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <Images className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="font-grotesk text-sm text-neutral-500 mt-2">
            {assets.length === 0 ? (status === 'archived' ? 'Arşivde dosya yok.' : 'Henüz final dosya yok. "Final yükle" ile ekleyin.') : 'Filtreye uyan dosya yok.'}
          </p>
        </div>
      ) : (
        <>
        {assets.length >= LIBRARY_PAGE_SIZE && (
          <p className="font-grotesk text-xs text-neutral-500">
            En yeni {LIBRARY_PAGE_SIZE} dosya gösteriliyor; daha eskileri bu sürümde listelenmez. Filtreler yalnız bu dosyalar üzerinde çalışır.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {visible.map((a) => (
            <button key={a.id} onClick={() => setDetail(a)} className="text-left glass-tile overflow-hidden hover:border-neutral-300">
              <div className="aspect-square bg-neutral-100 flex items-center justify-center relative">
                {a.storage.thumbUrl || a.kind === 'photo' ? (
                  <img src={a.storage.thumbUrl || a.storage.downloadUrl} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Film className="w-6 h-6 text-neutral-400" />
                )}
                {a.kind === 'video' && <span className="absolute top-1 left-1 px-1 rounded bg-black/60 text-white font-grotesk text-[10px]">Video</span>}
                {used?.has(a.id) && (
                  <span className="absolute top-1 right-1 px-1 rounded bg-white/90 text-[#171717] font-grotesk text-[10px]">Kullanıldı</span>
                )}
              </div>
              <div className="p-2">
                <p className="font-grotesk text-xs text-[#171717] truncate">{a.title || a.fileName}</p>
                {a.tags.length > 0 && <p className="font-grotesk text-[10px] text-neutral-500 truncate">{a.tags.map((t) => `#${t}`).join(' ')}</p>}
              </div>
            </button>
          ))}
        </div>
        </>
      )}

      {detail && projectId && (
        <AssetDetail
          key={detail.id}
          asset={detail}
          tenantId={tenantId}
          projectId={projectId}
          onClose={() => setDetail(null)}
          onChanged={() => {
            setDetail(null);
            load();
          }}
        />
      )}
    </div>
  );
};

export default StudioLibraryPage;
