import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, Film, Check } from 'lucide-react';
import { isConsistentAsset, normalizeTag, type BrandMediaAsset } from '@/shared/types/brandMedia';
import { listBrandMedia } from '../brandMediaData';
import { getClientMediaPolicy } from '../library/mediaPolicy';

interface Props {
  open: boolean;
  tenantId: string;
  projectId: string;
  /** Post'ta zaten olan varlıklar (tekrar seçilemez) */
  excludeAssetIds?: string[];
  maxSelect: number;
  onClose: () => void;
  /** Seçim yalnız post düzenleyicideki medyaya eklenir; kullanım geçmişine post kaydedilince girer */
  onConfirm: (assets: BrandMediaAsset[]) => void;
  /** Test için veri kaynağı */
  loadAssets?: typeof listBrandMedia;
}


/** Marka medya kütüphanesinden aktif final fotoğraf/video seçimi */
const LibraryPicker: React.FC<Props> = ({ open, tenantId, projectId, excludeAssetIds = [], maxSelect, onClose, onConfirm, loadAssets = listBrandMedia }) => {
  const [assets, setAssets] = useState<BrandMediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [tag, setTag] = useState('');
  const request = useRef(0);

  // Açılış veya marka değişimi: önceki seçim ve liste sıfırlanır; geç gelen eski yanıt yok sayılır
  useEffect(() => {
    setSelected([]);
    setAssets([]);
    setError(null);
    if (!open) return;
    const id = ++request.current;
    setLoading(true);
    loadAssets(tenantId, projectId, { status: 'active' })
      .then((list) => {
        const policy = getClientMediaPolicy();
        if (id === request.current) setAssets(list.filter((a) => isConsistentAsset(a, tenantId, projectId, policy)));
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
  }, [open, tenantId, projectId, loadAssets]);

  const tagFilter = normalizeTag(tag);
  const visible = useMemo(
    () => (tagFilter ? assets.filter((a) => a.tags.some((t) => t.startsWith(tagFilter))) : assets),
    [assets, tagFilter]
  );
  const excluded = useMemo(() => new Set(excludeAssetIds), [excludeAssetIds]);
  const remaining = Math.max(0, maxSelect);

  if (!open) return null;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= remaining ? prev : [...prev, id]));

  const confirm = () => {
    const policy = getClientMediaPolicy();
    const chosen = selected
      .map((id) => assets.find((a) => a.id === id))
      .filter((a): a is BrandMediaAsset => !!a && a.status === 'active' && isConsistentAsset(a, tenantId, projectId, policy));
    onConfirm(chosen);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Kütüphaneden seç">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <h3 className="font-grotesk text-base font-semibold text-[#171717]">Kütüphaneden seç</h3>
          <button onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
        <div className="px-4 py-2 flex items-center gap-2 border-b border-neutral-100">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Etikete göre filtrele"
            className="flex-1 px-3 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-sm"
          />
          <span className="font-grotesk text-xs text-neutral-500">
            {selected.length}/{remaining} seçili
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          ) : error ? (
            <p className="font-grotesk text-sm text-red-600">{error}</p>
          ) : visible.length === 0 ? (
            <p className="font-grotesk text-sm text-neutral-500">Bu markanın kütüphanesinde kullanılabilir final dosya yok.</p>
          ) : remaining === 0 ? (
            <p className="font-grotesk text-sm text-neutral-500">Bu içerik en fazla medya sayısına ulaştı.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {visible.map((a) => {
                const already = excluded.has(a.id);
                const order = selected.indexOf(a.id);
                return (
                  <button
                    key={a.id}
                    disabled={already}
                    onClick={() => toggle(a.id)}
                    title={a.title}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 bg-neutral-100 ${order >= 0 ? 'border-[#171717]' : 'border-transparent'} disabled:opacity-40`}
                  >
                    {a.storage.thumbUrl || a.kind === 'photo' ? (
                      <img src={a.storage.thumbUrl || a.storage.downloadUrl} alt={a.title} className="w-full h-full object-cover" />
                    ) : (
                      <Film className="w-6 h-6 text-neutral-400 m-auto" />
                    )}
                    {a.kind === 'video' && <span className="absolute top-1 left-1 px-1 rounded bg-black/60 text-white font-grotesk text-[10px]">Video</span>}
                    {order >= 0 && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#171717] text-white font-grotesk text-[11px] flex items-center justify-center">{order + 1}</span>
                    )}
                    {already && (
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white font-grotesk text-[10px] py-0.5 inline-flex items-center justify-center gap-0.5">
                        <Check className="w-3 h-3" /> Eklendi
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-100">
          <button onClick={onClose} className="px-4 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm">
            Vazgeç
          </button>
          <button onClick={confirm} disabled={selected.length === 0} className="px-4 py-2 bg-[#111] text-white rounded-full font-grotesk text-sm disabled:opacity-40">
            Ekle ({selected.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default LibraryPicker;
