import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, GripVertical, Image as ImageIcon, Film } from 'lucide-react';
import type { MediaItem } from '@/shared/types/socialMedia';

interface MediaDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  existingMedia?: MediaItem[];
  onRemoveMedia?: (mediaId: string) => void;
  onReorderMedia?: (fromIndex: number, toIndex: number) => void;
  uploading?: boolean;
  fileProgress?: Map<string, number>;
}

const MediaDropZone: React.FC<MediaDropZoneProps> = ({
  onFilesSelected,
  accept = 'image/*,video/*',
  maxFiles = 10,
  existingMedia = [],
  onRemoveMedia,
  onReorderMedia,
  uploading = false,
  fileProgress,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
      );

      if (files.length > 0) {
        onFilesSelected(files.slice(0, maxFiles - existingMedia.length));
      }
    },
    [onFilesSelected, maxFiles, existingMedia.length]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onFilesSelected(files.slice(0, maxFiles - existingMedia.length));
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onFilesSelected, maxFiles, existingMedia.length]
  );

  const handleItemDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleItemDragOver = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== targetIndex && onReorderMedia) {
        onReorderMedia(dragIndex, targetIndex);
        setDragIndex(targetIndex);
      }
    },
    [dragIndex, onReorderMedia]
  );

  const handleItemDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  const canAddMore = existingMedia.length < maxFiles;

  return (
    <div className="space-y-3">
      {/* Existing Media Grid */}
      {existingMedia.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {existingMedia.map((media, index) => (
            <div
              key={media.id}
              draggable={!!onReorderMedia}
              onDragStart={() => handleItemDragStart(index)}
              onDragOver={(e) => handleItemDragOver(e, index)}
              onDragEnd={handleItemDragEnd}
              className={`relative group aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                dragIndex === index
                  ? 'border-[#171717] opacity-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              {media.type === 'image' ? (
                <img
                  src={media.thumbnailUrl || media.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                  <Film className="w-8 h-8 text-neutral-400" />
                </div>
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                {onReorderMedia && (
                  <GripVertical className="w-5 h-5 text-white cursor-grab absolute top-2 left-2" />
                )}
                {onRemoveMedia && (
                  <button
                    type="button"
                    onClick={() => onRemoveMedia(media.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>

              {/* Type badge */}
              <div className="absolute bottom-2 left-2">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-grotesk text-white">
                  {media.type === 'image' ? (
                    <ImageIcon className="w-3 h-3" />
                  ) : (
                    <Film className="w-3 h-3" />
                  )}
                  {media.type === 'image' ? 'Gorsel' : 'Video'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {uploading && fileProgress && fileProgress.size > 0 && (
        <div className="space-y-2 bg-neutral-50 rounded-xl p-4">
          {Array.from(fileProgress.entries()).map(([fileName, prog]) => (
            <div key={fileName} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-grotesk text-xs text-neutral-600 truncate max-w-[200px]">
                  {fileName}
                </span>
                <span className="font-grotesk text-xs text-neutral-500">
                  {prog === -1 ? 'Hata' : `${prog}%`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    prog === -1 ? 'bg-red-500' : prog === 100 ? 'bg-emerald-500' : 'bg-[#171717]'
                  }`}
                  style={{ width: `${Math.max(0, prog)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop Zone */}
      {canAddMore && !uploading && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${
              isDragOver
                ? 'border-[#171717] bg-neutral-50'
                : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50/50'
            }
          `}
        >
          <Upload
            className={`w-8 h-8 mx-auto mb-3 transition-colors ${
              isDragOver ? 'text-[#171717]' : 'text-neutral-400'
            }`}
          />
          <p className="font-grotesk text-sm font-medium text-neutral-600">
            {isDragOver ? 'Birakin...' : 'Surukle birak veya sec'}
          </p>
          <p className="font-grotesk text-xs text-neutral-400 mt-1">
            Gorsel (max 10MB) veya Video (max 100MB) - En fazla {maxFiles} dosya
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};

export default MediaDropZone;
