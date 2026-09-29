import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, Upload, Trash2, ArrowLeft, ArrowRight, MessageSquareWarning } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { MediaItem, SocialMediaPost } from '@/shared/types/socialMedia';
import { POST_TYPE_LABELS, SOCIAL_PLATFORM_LABELS } from '@/shared/types/socialMedia';
import { useMediaUpload } from '@/shared/hooks/useMediaUpload';
import { STUDIO_STATUS_COLOR, STUDIO_STATUS_LABEL, formatDate } from '../studioData';

/** Metni/medyası düzenlenebilir durumlar (firestore.rules ile aynı) */
export const EDITABLE_STATUSES = new Set(['draft', 'internal_review', 'revision_requested_internal', 'revision_requested']);

/** media yoksa eski mediaUrls kayıtlarından görüntülenebilir öğeler üretir */
function initialMedia(post: SocialMediaPost): MediaItem[] {
  if (post.media && post.media.length > 0) return [...post.media].sort((a, b) => a.order - b.order);
  return (post.mediaUrls || []).map((url, i) => {
    const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(decodeURIComponent(url));
    return { id: `legacy-${i}`, url, type: isVideo ? 'video' : 'image', mimeType: isVideo ? 'video/mp4' : 'image/*', size: 0, order: i } as MediaItem;
  });
}

interface Props {
  post: SocialMediaPost | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Post detayı: bütün medya (carousel görselleri, video oynatma), tam metin ve etiketler.
 * Düzenlenebilir durumda metin, etiketler ve medya (değiştir / ekle / çıkar / sırala) güncellenir.
 * Yeni medya yalnızca taslak alanına (write-once) yüklenir; müşteriye açılırken sunucu yeniden doğrular.
 */
const StudioPostDetail: React.FC<Props> = ({ post, onClose, onSaved }) => {
  const { uploadFiles, uploading, error: uploadError } = useMediaUpload();
  const fileInput = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | undefined>(undefined);
  // Medya yalnızca kullanıcı açıkça değiştirirse yazılır (eski kayıtlar korunur)
  const [mediaDirty, setMediaDirty] = useState(false);

  useEffect(() => {
    if (!post) return;
    setMedia(initialMedia(post));
    setMediaDirty(false);
    setCaption(post.caption || '');
    setHashtags((post.hashtags || []).join(' '));
    setActive(0);
    setError(null);
  }, [post?.id]);

  if (!post) return null;
  const editable = EDITABLE_STATUSES.has(post.status);
  const current = media[active];
  const note =
    post.status === 'revision_requested'
      ? post.lastRevisionComment
      : post.status === 'revision_requested_internal'
        ? post.lastInternalRevisionComment
        : undefined;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= media.length) return;
    const next = [...media];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setMedia(next.map((m, i) => ({ ...m, order: i })));
    setMediaDirty(true);
    setActive(to);
  };

  const remove = (index: number) => {
    const next = media.filter((_, i) => i !== index).map((m, i) => ({ ...m, order: i }));
    setMedia(next);
    setMediaDirty(true);
    setActive(Math.max(0, Math.min(active, next.length - 1)));
  };

  const addFiles = async (files: FileList | null, replaceIndex?: number) => {
    if (!files || files.length === 0) return;
    const uploaded = await uploadFiles(Array.from(files), post.projectId);
    if (uploaded.length === 0) return;
    let next = [...media];
    if (replaceIndex !== undefined) next.splice(replaceIndex, 1, uploaded[0], ...uploaded.slice(1));
    else next = [...next, ...uploaded];
    setMedia(next.map((m, i) => ({ ...m, order: i })));
    setMediaDirty(true);
    setActive(replaceIndex ?? next.length - uploaded.length);
  };

  const save = async () => {
    if (!db) return;
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'social_media_posts', post.id), {
        caption,
        hashtags: hashtags
          .split(/[\s,]+/)
          .map((h) => h.trim())
          .filter(Boolean)
          .map((h) => (h.startsWith('#') ? h : `#${h}`)),
        ...(mediaDirty ? { media, mediaUrls: media.map((m) => m.url) } : {}),
        updatedAt: serverTimestamp(),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('[Studio] Post kaydedilemedi:', err);
      setError(
        err?.code === 'permission-denied'
          ? 'Bu içerik şu an düzenlenemez (firmaya gönderilmiş veya onaylanmış olabilir).'
          : 'Kaydedilemedi.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 flex justify-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: 40 }}
          animate={{ x: 0 }}
          exit={{ x: 40 }}
          className="bg-white w-full max-w-2xl h-full overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-neutral-100 px-4 py-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full font-grotesk text-[11px] ${STUDIO_STATUS_COLOR[post.status] || 'bg-neutral-100'}`}>
                {STUDIO_STATUS_LABEL[post.status] || post.status}
              </span>
              <span className="font-grotesk text-xs text-neutral-500">
                {POST_TYPE_LABELS[post.postType] || post.postType} · {(post.platforms || []).map((p) => SOCIAL_PLATFORM_LABELS[p] || p).join(', ')}
                {post.scheduledAt && ` · ${formatDate(post.scheduledAt, true)}`}
              </span>
            </div>
            <button onClick={onClose} aria-label="Kapat">
              <X className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {note && (
              <p className="flex items-start gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-grotesk text-sm text-red-700">
                <MessageSquareWarning className="w-4 h-4 mt-0.5 shrink-0" />
                {note}
              </p>
            )}

            {/* Medya görüntüleyici */}
            <div className="bg-neutral-900 rounded-xl overflow-hidden aspect-square flex items-center justify-center">
              {current ? (
                current.type === 'video' ? (
                  <video key={current.id} src={current.url} controls playsInline className="max-h-full max-w-full" />
                ) : (
                  <img key={current.id} src={current.url} alt="" className="max-h-full max-w-full object-contain" />
                )
              ) : (
                <p className="font-grotesk text-sm text-neutral-400">Medya yok</p>
              )}
            </div>

            {media.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {media.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setActive(i)}
                    className={`relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 ${i === active ? 'border-[#171717]' : 'border-transparent'}`}
                  >
                    {m.thumbnailUrl || m.type === 'image' ? (
                      <img src={m.thumbnailUrl || m.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full bg-neutral-200 flex items-center justify-center font-grotesk text-[10px]">Video</span>
                    )}
                    <span className="absolute bottom-0.5 right-1 font-grotesk text-[10px] text-white drop-shadow">{i + 1}</span>
                  </button>
                ))}
              </div>
            )}

            {editable && (
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,video/*"
                  multiple={replaceIndex === undefined}
                  className="hidden"
                  onChange={async (e) => {
                    await addFiles(e.target.files, replaceIndex);
                    e.target.value = '';
                    setReplaceIndex(undefined);
                  }}
                />
                {current && (
                  <button
                    onClick={() => {
                      setReplaceIndex(active);
                      setTimeout(() => fileInput.current?.click(), 0);
                    }}
                    disabled={uploading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" /> Bu medyayı değiştir
                  </button>
                )}
                <button
                  onClick={() => {
                    setReplaceIndex(undefined);
                    setTimeout(() => fileInput.current?.click(), 0);
                  }}
                  disabled={uploading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" /> Medya ekle
                </button>
                {current && (
                  <>
                    <button onClick={() => move(active, active - 1)} className="px-2 py-1.5 border border-neutral-200 rounded-lg" aria-label="Sola taşı">
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => move(active, active + 1)} className="px-2 py-1.5 border border-neutral-200 rounded-lg" aria-label="Sağa taşı">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(active)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-700 rounded-lg font-grotesk text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Çıkar
                    </button>
                  </>
                )}
                {uploading && (
                  <span className="inline-flex items-center gap-1 font-grotesk text-xs text-neutral-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Yükleniyor…
                  </span>
                )}
              </div>
            )}

            <div>
              <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">Metin</p>
              {editable ? (
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm resize-y"
                />
              ) : (
                <p className="font-grotesk text-sm text-neutral-800 whitespace-pre-wrap">{post.caption || '—'}</p>
              )}
            </div>

            <div>
              <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">Etiketler</p>
              {editable ? (
                <input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#rakle #cam"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm"
                />
              ) : (
                <p className="font-grotesk text-sm text-neutral-600">{(post.hashtags || []).join(' ') || '—'}</p>
              )}
            </div>

            {!editable && post.status !== 'published' && (
              <p className="font-grotesk text-xs text-neutral-500">
                Bu içerik firmaya gönderildi. Değiştirmek için plan ekranından "Revizyona al".
              </p>
            )}

            {(error || uploadError) && <p className="font-grotesk text-sm text-red-600">{error || uploadError}</p>}

            {editable && (
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-4 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm">
                  Vazgeç
                </button>
                <button
                  onClick={save}
                  disabled={saving || uploading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#171717] text-white rounded-lg font-grotesk text-sm disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Kaydet
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StudioPostDetail;
