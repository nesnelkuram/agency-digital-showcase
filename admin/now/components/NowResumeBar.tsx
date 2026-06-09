/**
 * NowResumeBar — bilgisayardan uzaklaşınca otomatik duraklatılan görev için
 * geri dönüşte gösterilen "devam edelim mi?" bandı.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Play, X, PauseCircle } from 'lucide-react';

interface Props {
  taskTitle: string;
  onResume: () => void;
  onDismiss: () => void;
  busy?: boolean;
}

const NowResumeBar: React.FC<Props> = ({ taskTitle, onResume, onDismiss, busy }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', damping: 24, stiffness: 260 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md"
    >
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#171717] text-white shadow-lg shadow-black/20 border border-white/10">
        <PauseCircle className="w-5 h-5 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-commons text-xs font-medium leading-tight">
            Uzaklaştın, sayaç durduruldu
          </p>
          <p className="font-commons text-[11px] text-white/60 truncate">{taskTitle}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onResume}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 transition-colors font-commons text-xs font-medium shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          Devam Et
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 text-white/40 hover:text-white/80 transition-colors shrink-0"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

export default NowResumeBar;
