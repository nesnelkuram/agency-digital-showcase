import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image as ImageIcon, Video, X, Loader2, CheckCircle } from 'lucide-react';
import type { PostType, SocialPlatform, MediaItem } from '@/shared/types/socialMedia';
import { useMediaUpload } from '@/shared/hooks/useMediaUpload';

interface PendingFile {
  id: string;
  file: File;
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number;
  postType: PostType;
  caption?: string;
}

interface BulkMediaUploaderProps {
  projectId: string;
  platform: SocialPlatform;
  onComplete: (
    posts: Array<{ media: MediaItem[]; postType: PostType; caption?: string; scheduledAt?: Date }>
  ) => void;
  onCancel?: () => void;
}

function todayAtTenAM(): string {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TYPE_OPTIONS: Array<{ value: PostType; label: string }> = [
  { value: 'static', label: 'Post (Statik)' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'reels', label: 'Reels' },
  { value: 'video', label: 'Video' },
  { value: 'story', label: 'Story' },
  { value: 'text', label: 'Sadece Metin' },
];

function inferDefaultType(file: File, dims: { width?: number; height?: number }): PostType {
  if (file.type.startsWith('video/')) return 'reels';
  const { width, height } = dims;
  if (width && height && height / width >= 1.6) return 'story'; // 9:16 ve üstü
  return 'static';
}

function readFileDims(file: File): Promise<{ width?: number; height?: number; duration?: number; thumbnail?: string }> {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 160;
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const thumb = canvas.toDataURL('image/jpeg', 0.6);
        resolve({ width: img.width, height: img.height, thumbnail: thumb });
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        resolve({});
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(file);
      const cleanup = () => URL.revokeObjectURL(objectUrl);
      const timeout = setTimeout(() => {
        cleanup();
        resolve({ width: video.videoWidth || undefined, height: video.videoHeight || undefined, duration: video.duration });
      }, 6000);

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
      };
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 240;
          const ratio = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
          canvas.width = video.videoWidth * ratio;
          canvas.height = video.videoHeight * ratio;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumb = canvas.toDataURL('image/jpeg', 0.6);
          clearTimeout(timeout);
          cleanup();
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
            thumbnail: thumb,
          });
        } catch (err) {
          clearTimeout(timeout);
          cleanup();
          resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
        }
      };
      video.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        resolve({});
      };
      video.src = objectUrl;
    } else {
      resolve({});
    }
  });
}

const BulkMediaUploader: React.FC<BulkMediaUploaderProps> = ({
  projectId,
  platform,
  onComplete,
  onCancel,
}) => {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [startDateTime, setStartDateTime] = useState<string>(todayAtTenAM());
  const [hourInterval, setHourInterval] = useState<number>(1);
  const [autoSchedule, setAutoSchedule] = useState<boolean>(true);
  const { uploadFiles, uploading, error } = useMediaUpload();

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const enriched: PendingFile[] = await Promise.all(
      arr.map(async (file) => {
        const dims = await readFileDims(file);
        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          file,
          thumbnail: dims.thumbnail,
          width: dims.width,
          height: dims.height,
          duration: dims.duration,
          postType: inferDefaultType(file, dims),
        };
      })
    );
    setPending((prev) => [...prev, ...enriched]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const updateType = (id: string, postType: PostType) => {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, postType } : p)));
  };

  const removePending = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUploadAll = async () => {
    if (pending.length === 0) return;
    const posts: Array<{
      media: MediaItem[];
      postType: PostType;
      caption?: string;
      scheduledAt?: Date;
    }> = [];

    const carouselFiles = pending.filter((p) => p.postType === 'carousel');
    const singleFiles = pending.filter((p) => p.postType !== 'carousel');

    // Otomatik zamanlama için başlangıç tarihi
    let nextSchedule: Date | null = null;
    if (autoSchedule && startDateTime) {
      nextSchedule = new Date(startDateTime);
    }

    const nextScheduledAt = (): Date | undefined => {
      if (!nextSchedule) return undefined;
      const at = new Date(nextSchedule);
      nextSchedule.setHours(nextSchedule.getHours() + Math.max(1, hourInterval));
      return at;
    };

    // Carousel: tek post, çoklu medya
    if (carouselFiles.length > 0) {
      setUploadingIdx(0);
      const media = await uploadFiles(carouselFiles.map((p) => p.file), projectId);
      if (media.length > 0) {
        posts.push({ media, postType: 'carousel', scheduledAt: nextScheduledAt() });
      }
    }

    for (let i = 0; i < singleFiles.length; i++) {
      setUploadingIdx(carouselFiles.length > 0 ? i + 1 : i);
      const pf = singleFiles[i];
      const media = await uploadFiles([pf.file], projectId);
      if (media.length > 0) {
        posts.push({
          media,
          postType: pf.postType,
          caption: pf.caption,
          scheduledAt: nextScheduledAt(),
        });
      }
    }
    setUploadingIdx(null);

    if (posts.length > 0) onComplete(posts);
    setPending([]);
  };

  const carouselCount = useMemo(() => pending.filter((p) => p.postType === 'carousel').length, [pending]);
  const postCount = useMemo(
    () => pending.filter((p) => p.postType !== 'carousel').length + (carouselCount > 0 ? 1 : 0),
    [pending, carouselCount]
  );

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
          isDragOver ? 'border-[#171717] bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
        }`}
      >
        <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
        <p className="font-grotesk text-sm font-medium text-[#171717]">
          Dosyaları sürükleyip bırakın veya tıklayın
        </p>
        <p className="font-grotesk text-xs text-neutral-500 mt-1">
          Resim (10MB'a kadar) · Video (100MB'a kadar) · max 10 dosya
        </p>
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {/* Pending list */}
      <AnimatePresence initial={false}>
        {pending.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {/* Scheduling */}
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSchedule}
                  onChange={(e) => setAutoSchedule(e.target.checked)}
                  className="rounded border-neutral-300"
                />
                <span className="font-grotesk text-xs font-medium text-[#171717]">
                  Yayın tarihlerini otomatik ata
                </span>
              </label>
              {autoSchedule && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block font-grotesk text-[11px] text-neutral-500 mb-1">
                      Başlangıç tarih/saat
                    </label>
                    <input
                      type="datetime-local"
                      value={startDateTime}
                      onChange={(e) => setStartDateTime(e.target.value)}
                      className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs bg-white focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block font-grotesk text-[11px] text-neutral-500 mb-1">
                      Aralık (saat)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={hourInterval}
                      onChange={(e) => setHourInterval(Number(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs bg-white focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>
              )}
              {!autoSchedule && (
                <p className="font-grotesk text-[11px] text-neutral-500">
                  Post'lar planlanmamış olarak kaydedilir; takvimin altındaki "Planlanmamış" alanından sürükleyerek yerleştirebilirsiniz.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="font-grotesk text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {pending.length} dosya — {postCount} post oluşacak
              </span>
              <button
                type="button"
                onClick={() => setPending([])}
                className="font-grotesk text-xs text-neutral-500 hover:text-red-500"
              >
                Hepsini temizle
              </button>
            </div>

            {pending.map((pf, idx) => (
              <div
                key={pf.id}
                className={`flex items-center gap-3 p-2 rounded-xl border ${
                  uploadingIdx === idx ? 'border-amber-300 bg-amber-50' : 'border-neutral-200 bg-white'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {pf.thumbnail ? (
                    <img src={pf.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : pf.file.type.startsWith('video/') ? (
                    <Video className="w-5 h-5 text-neutral-400" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-neutral-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-grotesk text-sm text-[#171717] truncate">{pf.file.name}</p>
                  <p className="font-grotesk text-[11px] text-neutral-500">
                    {(pf.file.size / 1024 / 1024).toFixed(1)} MB
                    {pf.width && pf.height && ` · ${pf.width}×${pf.height}`}
                    {pf.duration && ` · ${Math.round(pf.duration)}s`}
                  </p>
                </div>

                {/* Type dropdown */}
                <select
                  value={pf.postType}
                  onChange={(e) => updateType(pf.id, e.target.value as PostType)}
                  disabled={uploading}
                  className="px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs bg-white focus:outline-none focus:border-neutral-400"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removePending(pf.id)}
                  disabled={uploading}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg disabled:opacity-30"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>

                {uploadingIdx === idx && (
                  <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                )}
              </div>
            ))}

            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-grotesk text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={uploading}
                  className="px-4 py-2 font-grotesk text-sm text-neutral-600 hover:text-[#171717]"
                >
                  İptal
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleUploadAll}
                disabled={uploading || pending.length === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Yükleniyor...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Tümünü Yükle ({postCount} post)
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BulkMediaUploader;
