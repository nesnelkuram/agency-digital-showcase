import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp,
  Pause,
  Play,
  X,
  CheckCircle,
  AlertCircle,
  Upload,
  Minimize2,
} from 'lucide-react';
import { UploadItem } from '@/shared/hooks/useDriveUpload';

interface DriveUploadQueueProps {
  uploads: UploadItem[];
  onPause: (sessionId: string) => void;
  onResume: (sessionId: string) => void;
  onCancel: (sessionId: string) => void;
  onClearCompleted: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const DriveUploadQueue: React.FC<DriveUploadQueueProps> = ({
  uploads,
  onPause,
  onResume,
  onCancel,
  onClearCompleted,
}) => {
  const [expanded, setExpanded] = useState(true);

  if (uploads.length === 0) return null;

  const completed = uploads.filter((u) => u.status === 'completed').length;
  const total = uploads.length;
  const hasCompleted = completed > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center">
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        className="w-full max-w-lg mx-4 mb-4 bg-white rounded-xl shadow-2xl border border-neutral-200 pointer-events-auto"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-500" />
            <span className="font-grotesk text-sm font-medium text-[#171717]">
              Drive Yükleme — {completed}/{total} tamamlandı
            </span>
          </div>
          <div className="flex items-center gap-1">
            {hasCompleted && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearCompleted();
                }}
                className="px-2 py-1 font-grotesk text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                Temizle
              </button>
            )}
            {expanded ? (
              <Minimize2 className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            )}
          </div>
        </div>

        {/* Upload items */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden max-h-64 overflow-y-auto"
            >
              {uploads.map((upload) => {
                const percent =
                  upload.fileSize > 0
                    ? Math.round((upload.uploadedBytes / upload.fileSize) * 100)
                    : 0;

                return (
                  <div
                    key={upload.sessionId}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-50 last:border-0"
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {upload.status === 'completed' && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      {upload.status === 'failed' && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                      {upload.status === 'uploading' && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                      {upload.status === 'paused' && (
                        <Pause className="w-4 h-4 text-amber-500" />
                      )}
                      {upload.status === 'expired' && (
                        <AlertCircle className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>

                    {/* File info + progress */}
                    <div className="flex-1 min-w-0">
                      <p className="font-grotesk text-xs font-medium text-[#171717] truncate">
                        {upload.fileName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {(upload.status === 'uploading' || upload.status === 'paused') && (
                          <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                upload.status === 'paused' ? 'bg-amber-400' : 'bg-blue-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        )}
                        <span className="font-grotesk text-xs text-neutral-400 whitespace-nowrap">
                          {upload.status === 'completed'
                            ? formatBytes(upload.fileSize)
                            : upload.status === 'failed'
                            ? upload.error || 'Hata'
                            : `${percent}% • ${formatBytes(upload.uploadedBytes)} / ${formatBytes(upload.fileSize)}`}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {upload.status === 'uploading' && (
                        <button
                          onClick={() => onPause(upload.sessionId)}
                          className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors"
                          title="Durdur"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(upload.status === 'paused' || upload.status === 'failed') && (
                        <button
                          onClick={() => onResume(upload.sessionId)}
                          className="p-1 text-neutral-400 hover:text-green-600 rounded transition-colors"
                          title="Devam Et"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {upload.status !== 'completed' && (
                        <button
                          onClick={() => onCancel(upload.sessionId)}
                          className="p-1 text-neutral-400 hover:text-red-500 rounded transition-colors"
                          title="İptal"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default DriveUploadQueue;
