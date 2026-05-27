import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SKIP_REASON_LABELS, type SkipReason } from '@/shared/services/nowService';

interface SkipReasonModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (reason: SkipReason) => void;
}

const REASONS: SkipReason[] = ['blocked', 'wrong_time', 'not_mine', 'dont_want'];

const SkipReasonModal: React.FC<SkipReasonModalProps> = ({ open, onClose, onSelect }) => {
  // Esc closes without action — handled here directly because parent's keyboard
  // hook is disabled while modal is open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      // 1-4 shortcuts for the four reasons
      const idx = parseInt(e.key, 10);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= REASONS.length) {
        e.preventDefault();
        onSelect(REASONS[idx - 1]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, onSelect]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-commons text-lg font-semibold text-[#171717] mb-1">
              Niye atlıyorsun?
            </h2>
            <p className="font-commons text-sm text-neutral-500 mb-5">
              Sistem öğrensin — bir sonraki öncelik daha iyi seçilsin.
            </p>

            <div className="flex flex-col gap-2">
              {REASONS.map((reason, idx) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onSelect(reason)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors text-left"
                >
                  <span className="font-commons text-sm text-[#171717]">
                    {SKIP_REASON_LABELS[reason]}
                  </span>
                  <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-white text-neutral-500 font-mono border border-neutral-200">
                    {idx + 1}
                  </kbd>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full mt-4 py-2 font-commons text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Vazgeç (Esc)
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SkipReasonModal;
