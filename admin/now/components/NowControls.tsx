import React from 'react';
import { Play, Pause, Check, SkipForward, Loader2 } from 'lucide-react';

interface NowControlsProps {
  isRunning: boolean;             // status === 'in_progress'
  isPaused: boolean;              // status === 'paused'
  busy: boolean;                  // async aksiyon sırasında tüm butonlar kilit
  onStart: () => void;            // BAŞLA / DEVAM
  onPause: () => void;            // DURAKLAT
  onDone: () => void;             // BİTTİ
  onSkip: () => void;             // ATLA
}

const NowControls: React.FC<NowControlsProps> = ({
  isRunning,
  isPaused,
  busy,
  onStart,
  onPause,
  onDone,
  onSkip,
}) => {
  // Space → toggle: çalışıyorsa duraklat, değilse başla/devam
  const handleSpace = () => {
    if (isRunning) onPause();
    else onStart();
  };

  // Sol buton dinamik: BAŞLA / DEVAM / DURAKLAT
  const leftLabel = isRunning ? 'Duraklat' : isPaused ? 'Devam' : 'Başla';
  const LeftIcon = isRunning ? Pause : busy ? Loader2 : Play;
  const leftColor = isRunning
    ? 'bg-amber-500 hover:bg-amber-600'   // duraklat
    : isPaused
    ? 'bg-violet-600 hover:bg-violet-700' // devam
    : 'bg-[#171717] hover:bg-neutral-800'; // başla

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        type="button"
        disabled={busy}
        onClick={handleSpace}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl ${leftColor} text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-commons text-xs font-medium`}
      >
        <LeftIcon className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
        {leftLabel}
        <kbd className="ml-1 px-1 py-0.5 text-[9px] rounded bg-white/20 font-mono">
          Space
        </kbd>
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={onDone}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-commons text-xs font-medium"
      >
        <Check className="w-3.5 h-3.5" />
        Bitti
        <kbd className="ml-1 px-1 py-0.5 text-[9px] rounded bg-white/20 font-mono">
          Enter
        </kbd>
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={onSkip}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-neutral-500 hover:text-neutral-700 hover:bg-white/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all font-commons text-xs"
      >
        <SkipForward className="w-3.5 h-3.5" />
        Atla
        <kbd className="ml-1 px-1 py-0.5 text-[9px] rounded bg-neutral-200 text-neutral-600 font-mono">
          Esc
        </kbd>
      </button>
    </div>
  );
};

export default NowControls;
