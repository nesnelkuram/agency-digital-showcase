import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Film, Images } from 'lucide-react';
import { Link } from 'react-router-dom';
import { normalizeTag, type BrandMediaAsset } from '@/shared/types/brandMedia';
import { listBrandMedia } from '../brandMediaData';
import { DND_LIBRARY_ASSET } from './CalendarBoard';

interface Props {
  tenantId: string;
  projectId: string;
  /** Yüklenen (doğrulanmış) varlıklar — takvime bırakılan kimlik yalnız bunlardan çözülür */
  onAssets: (assets: BrandMediaAsset[]) => void;
  loadAssets?: typeof listBrandMedia;
}

/** Takvim yan paneli: final medya kütüphanesi — dosyayı bir saat hücresine sürükleyin */
const LibraryDrawer: React.FC<Props> = ({ tenantId, projectId, onAssets, loadAssets = listBrandMedia }) => {
  const [assets, setAssets] = useState<BrandMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState('');
  const request = useRef(0);
  const onAssetsRef = useRef(onAssets);
  onAssetsRef.current = onAssets;

  // Marka değişimi: eski liste sıfırlanır, geç gelen eski yanıt yok sayılır
  useEffect(() => {
    const id = ++request.current;
    setAssets([]);
    onAssetsRef.current([]);
    setLoading(true);
    setError(null);
    loadAssets(tenantId, projectId, { status: 'active' })
      .then((list) => {
        if (id !== request.current) return;
        setAssets(list);
        onAssetsRef.current(list);
      })
      .catch((err) => {
        console.error('[Studio] Kütüphane yüklenemedi:', err);
        if (id === request.current) setError('Kütüphane yüklenemedi.');
      })
      .finally(() => {
        if (id === request.current) setLoading(false);
      });
    return () => {
      request.current++;
    };
  }, [tenantId, projectId, loadAssets]);

  const f = normalizeTag(tag);
  const visible = useMemo(() => (f ? assets.filter((a) => a.tags.some((t) => t.startsWith(f))) : assets), [assets, f]);

  return (
    <div className="space-y-2" data-testid="library-drawer">
      <p className="font-grotesk text-[11px] text-neutral-500">Final dosyayı takvimde bir saat hücresine sürükleyin; o saatle yeni içerik açılır.</p>
      <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Etiket ara" className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs" />
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-neutral-400 mx-auto" />
      ) : error ? (
        <p className="font-grotesk text-xs text-red-600">{error}</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-4">
          <Images className="w-6 h-6 text-neutral-300 mx-auto" />
          <p className="font-grotesk text-xs text-neutral-500 mt-1">Kullanılabilir final dosya yok.</p>
          <Link to={`/studio/${projectId}/kutuphane`} className="font-grotesk text-xs underline text-neutral-700">
            Kütüphaneye git
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {visible.map((a) => (
            <div
              key={a.id}
              draggable
              title={a.title}
              data-testid={`drawer-asset-${a.id}`}
              onDragStart={(e) => {
                e.dataTransfer.setData(DND_LIBRARY_ASSET, a.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="relative aspect-square rounded-lg overflow-hidden bg-neutral-100 cursor-grab active:cursor-grabbing flex items-center justify-center"
            >
              {a.storage.thumbUrl || a.kind === 'photo' ? (
                <img src={a.storage.thumbUrl || a.storage.downloadUrl} alt={a.title} className="w-full h-full object-cover pointer-events-none" loading="lazy" />
              ) : (
                <Film className="w-5 h-5 text-neutral-400" />
              )}
              {a.kind === 'video' && <span className="absolute top-0.5 left-0.5 px-1 rounded bg-black/60 text-white font-grotesk text-[9px]">Video</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LibraryDrawer;
