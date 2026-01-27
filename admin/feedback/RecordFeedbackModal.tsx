import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Monitor,
  Camera,
  MonitorSmartphone,
  Circle,
  Pause,
  Play,
  Square,
  Upload,
  Loader2,
  Mic,
} from 'lucide-react';
import { useFeedbackRecorder } from '@/shared/hooks/useFeedbackRecorder';
import { useFeedbackUpload } from '@/shared/hooks/useFeedbackUpload';
import type { RecordingMode } from '@/shared/types/feedback';
import { formatDuration } from '@/shared/types/feedback';

interface RecordFeedbackModalProps {
  onClose: () => void;
  onComplete: () => void;
}

// Steps where modal is shown (recording uses floating bar instead)
type ModalStep = 'select' | 'preview' | 'details';

const RecordFeedbackModal: React.FC<RecordFeedbackModalProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState<ModalStep>('select');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Separate state for file uploads (not from recorder)
  const [uploadedBlob, setUploadedBlob] = useState<Blob | null>(null);
  const [uploadedDuration, setUploadedDuration] = useState(0);

  const recorder = useFeedbackRecorder();
  const uploader = useFeedbackUpload();

  // Determine the active blob/duration/mode (recorder or uploaded file)
  const activeBlob = recorder.recordedBlob || uploadedBlob;
  const activeDuration = recorder.recordedBlob ? recorder.duration : uploadedDuration;
  const activeMode: RecordingMode = recorder.recordingMode || 'camera';

  // Callback ref for preview video - solves AnimatePresence timing
  const setPreviewVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      if (previewVideoRef.current && previewVideoRef.current !== node) {
        if (previewVideoRef.current.src) {
          URL.revokeObjectURL(previewVideoRef.current.src);
        }
      }
      previewVideoRef.current = node;
      if (node && activeBlob) {
        const url = URL.createObjectURL(activeBlob);
        node.src = url;
      }
    },
    [activeBlob]
  );

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewVideoRef.current?.src) {
        URL.revokeObjectURL(previewVideoRef.current.src);
      }
    };
  }, []);

  const handleSelectMode = async (mode: RecordingMode) => {
    await recorder.startRecording(mode);
    // No setStep - recording uses floating bar, modal disappears
  };

  const handleStop = async () => {
    await recorder.stopRecording();
    setStep('preview');
  };

  const handleRetake = () => {
    recorder.cancelRecording();
    setUploadedBlob(null);
    setUploadedDuration(0);
    setStep('select');
  };

  const handleProceed = () => {
    setStep('details');
  };

  const handleSave = async () => {
    if (!activeBlob || !title.trim()) return;

    const video = await uploader.uploadRecording(
      activeBlob,
      title.trim(),
      activeMode,
      activeDuration
    );

    if (video) {
      onComplete();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const duration = await getVideoDuration(file);
    const blob = new Blob([file], { type: file.type });

    setUploadedBlob(blob);
    setUploadedDuration(duration);
    setStep('preview');
  };

  const handleCancel = () => {
    recorder.cancelRecording();
    setUploadedBlob(null);
    setUploadedDuration(0);
    onClose();
  };

  if (!recorder.isSupported) {
    return (
      <ModalWrapper onClose={onClose}>
        <div className="text-center py-8">
          <Camera className="w-12 h-12 text-neutral-300 mx-auto" />
          <p className="mt-4 text-lg font-commons font-medium text-neutral-600">
            Tarayiciniz video kaydi desteklemiyor
          </p>
          <p className="mt-2 text-sm font-commons text-neutral-400">
            Lutfen Chrome, Firefox veya Edge kullanin
          </p>
        </div>
      </ModalWrapper>
    );
  }

  // ── RECORDING STATE: Show floating bar, NO modal ──
  if (recorder.isRecording) {
    return (
      <FloatingRecordingBar
        duration={recorder.duration}
        isPaused={recorder.isPaused}
        recordingMode={recorder.recordingMode}
        onPause={recorder.pauseRecording}
        onResume={recorder.resumeRecording}
        onStop={handleStop}
        onCancel={handleCancel}
      />
    );
  }

  // ── NON-RECORDING: Show modal for select / preview / details ──
  return (
    <ModalWrapper onClose={handleCancel}>
      <AnimatePresence mode="wait">
        {/* Step 1: Select Mode */}
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-xl font-ramillas font-bold text-[#171717]">
                Yeni Kayit
              </h2>
              <p className="text-sm font-commons text-neutral-500 mt-1">
                Kayit modunu secin veya video yukleyin
              </p>
            </div>

            {recorder.error && (
              <div className="bg-red-50 text-red-700 text-sm font-commons px-4 py-3 rounded-xl">
                {recorder.error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { mode: 'screen' as RecordingMode, icon: Monitor, label: 'Ekran Kaydi', desc: 'Ekraninizi kaydedin' },
                { mode: 'camera' as RecordingMode, icon: Camera, label: 'Kamera', desc: 'Kameranizi kullanin' },
                { mode: 'screen_camera' as RecordingMode, icon: MonitorSmartphone, label: 'Ekran + Kamera', desc: 'Her ikisini birden' },
              ]).map(({ mode, icon: Icon, label, desc }) => (
                <motion.button
                  key={mode}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectMode(mode)}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-neutral-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-commons font-medium text-[#171717] text-sm">{label}</p>
                    <p className="font-commons text-xs text-neutral-400 mt-0.5">{desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* File upload option */}
            <div className="border-t border-neutral-100 pt-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-200 hover:border-indigo-400 text-neutral-500 hover:text-indigo-600 transition-colors font-commons text-sm"
              >
                <Upload className="w-4 h-4" />
                Video Dosyasi Yukle
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </motion.div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-ramillas font-bold text-[#171717] text-center">
              Onizleme
            </h2>

            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              <video
                ref={setPreviewVideoRef}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleRetake}
                className="px-4 py-2.5 rounded-full border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                Tekrar Kaydet
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleProceed}
                className="px-6 py-2.5 bg-[#171717] text-white rounded-full font-commons text-sm font-medium hover:bg-[#171717]/90 transition-colors"
              >
                Devam Et
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Details */}
        {step === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            <h2 className="text-lg font-ramillas font-bold text-[#171717] text-center">
              Video Detaylari
            </h2>

            {(uploader.error || recorder.error) && (
              <div className="bg-red-50 text-red-700 text-sm font-commons px-4 py-3 rounded-xl">
                {uploader.error || recorder.error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                  Baslik *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ornegin: Homepage tasarim incelemesi"
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-commons font-medium text-neutral-700 mb-1.5">
                  Aciklama (opsiyonel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kisaca ne hakkinda oldugunu yazin..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Upload progress */}
            {uploader.uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-commons">
                  <span className="text-neutral-500">Yukleniyor...</span>
                  <span className="text-indigo-600 font-medium">{uploader.uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-indigo-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploader.uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep('preview')}
                disabled={uploader.uploading}
                className="px-4 py-2.5 rounded-full border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                Geri
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={!title.trim() || !activeBlob || uploader.uploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#171717] text-white rounded-full font-commons text-sm font-medium hover:bg-[#171717]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploader.uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Yukleniyor
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Kaydet
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalWrapper>
  );
};

// ────────────────────────────────────────────────────────────
// Floating Recording Bar - Loom-style bottom control bar
// ────────────────────────────────────────────────────────────
const FloatingRecordingBar: React.FC<{
  duration: number;
  isPaused: boolean;
  recordingMode: RecordingMode | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}> = ({ duration, isPaused, recordingMode, onPause, onResume, onStop, onCancel }) => {
  const modeLabels: Record<string, string> = {
    screen: 'Ekran',
    camera: 'Kamera',
    screen_camera: 'Ekran + Kamera',
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9990] flex items-center gap-3 bg-[#171717] text-white px-5 py-3 rounded-2xl shadow-2xl shadow-black/30"
    >
      {/* Recording indicator */}
      <div className="flex items-center gap-2">
        <Circle className={`w-3 h-3 fill-red-500 text-red-500 ${isPaused ? '' : 'animate-pulse'}`} />
        <span className="font-commons text-xs text-neutral-400">
          {isPaused ? 'Duraklatildi' : (modeLabels[recordingMode || ''] || 'Kayit')}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Timer */}
      <span className="font-commons text-sm font-medium tabular-nums min-w-[48px] text-center">
        {formatDuration(duration)}
      </span>

      {/* Divider */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Pause / Resume */}
        {isPaused ? (
          <button
            onClick={onResume}
            className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center transition-colors"
            title="Devam Et"
          >
            <Play className="w-4 h-4 ml-0.5" />
          </button>
        ) : (
          <button
            onClick={onPause}
            className="w-9 h-9 rounded-full bg-neutral-600 hover:bg-neutral-500 flex items-center justify-center transition-colors"
            title="Duraklat"
          >
            <Pause className="w-4 h-4" />
          </button>
        )}

        {/* Stop */}
        <button
          onClick={onStop}
          className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
          title="Kaydi Durdur"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-9 h-9 rounded-full bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center transition-colors"
          title="Iptal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

// ────────────────────────────────────────────────────────────
// Modal Wrapper
// ────────────────────────────────────────────────────────────
const ModalWrapper: React.FC<{
  onClose: () => void;
  children: React.ReactNode;
}> = ({ onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50"
      onClick={onClose}
    />
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      {children}
    </motion.div>
  </div>
);

// ────────────────────────────────────────────────────────────
// Helper
// ────────────────────────────────────────────────────────────
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Math.round(video.duration));
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(0);
    };
    video.src = URL.createObjectURL(file);
  });
}

export default RecordFeedbackModal;
