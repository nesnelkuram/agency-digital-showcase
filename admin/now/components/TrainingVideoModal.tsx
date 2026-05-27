import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlayCircle, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface TrainingResource {
  id: string;
  type: 'video' | 'document' | 'checklist' | 'link';
  title: string;
  description?: string;
  url: string;
  durationMinutes?: number;
}

interface TrainingVideoModalProps {
  open: boolean;
  resourceId: string | null;
  onClose: () => void;
}

// YouTube / Vimeo URL'sini embed'e dönüştür
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube watch?v=XYZ veya youtu.be/XYZ
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    // Embed denenmedi — direkt link
    return null;
  } catch {
    return null;
  }
}

const TrainingVideoModal: React.FC<TrainingVideoModalProps> = ({ open, resourceId, onClose }) => {
  const [resource, setResource] = useState<TrainingResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !resourceId || !db) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResource(null);

    getDoc(doc(db, 'training_resources', resourceId))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setError('Eğitim kaynağı bulunamadı.');
        } else {
          setResource({ id: snap.id, ...snap.data() } as TrainingResource);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Yüklenemedi');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, resourceId]);

  const embedUrl = resource?.url ? toEmbedUrl(resource.url) : null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <PlayCircle className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-commons text-sm font-semibold text-[#171717] truncate">
                    {resource?.title || 'Eğitim Videosu'}
                  </h2>
                  {resource?.durationMinutes && (
                    <p className="font-commons text-[11px] text-neutral-500">
                      {resource.durationMinutes} dk
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="aspect-video bg-black flex items-center justify-center">
              {loading && <Loader2 className="w-6 h-6 text-white animate-spin" />}
              {error && (
                <div className="text-center px-6">
                  <AlertCircle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
                  <p className="font-commons text-sm text-white/80">{error}</p>
                </div>
              )}
              {!loading && !error && resource && embedUrl && (
                <iframe
                  src={embedUrl}
                  title={resource.title}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
              {!loading && !error && resource && !embedUrl && (
                <div className="text-center px-6">
                  <ExternalLink className="w-6 h-6 text-white/60 mx-auto mb-3" />
                  <p className="font-commons text-sm text-white/80 mb-4">
                    Bu kaynak embed edilemiyor.
                  </p>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-[#171717] font-commons text-sm hover:bg-neutral-100 transition-colors"
                  >
                    Yeni sekmede aç
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Description */}
            {resource?.description && (
              <div className="px-5 py-3 border-t border-neutral-100">
                <p className="font-commons text-xs text-neutral-600 leading-relaxed">
                  {resource.description}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TrainingVideoModal;
