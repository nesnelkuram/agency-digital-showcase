import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';

interface NowEmptyStateProps {
  onAdd?: () => void;
}

const NowEmptyState: React.FC<NowEmptyStateProps> = ({ onAdd }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: 'spring', damping: 24, stiffness: 200 }}
    className="text-center max-w-md px-6"
  >
    <div className="inline-flex w-14 h-14 rounded-full bg-emerald-50 items-center justify-center mb-6">
      <Sparkles className="w-6 h-6 text-emerald-600" />
    </div>

    <h1 className="font-commons text-3xl font-semibold text-[#171717] mb-3 leading-tight">
      Şimdilik her şey kapalı.
    </h1>

    <p className="font-commons text-sm text-neutral-500 mb-8 leading-relaxed">
      Yapılacak aktif görevin yok. Yeni bir iş ekle ya da backlog'a göz at.
    </p>

    <div className="flex flex-col items-center gap-3">
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#171717] text-white hover:bg-neutral-800 transition-colors font-commons text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Yeni Görev
          <span className="font-mono text-[10px] opacity-60 ml-1">N</span>
        </button>
      )}
      <Link
        to="/admin/tasks"
        className="font-commons text-xs text-neutral-500 hover:text-neutral-700 underline decoration-dotted underline-offset-4"
      >
        Backlog'a git
      </Link>
      <p className="font-commons text-xs text-neutral-400">
        Telegram'dan da yeni iş yakalayabilirsin: <span className="font-mono">/gorev</span>
      </p>
    </div>
  </motion.div>
);

export default NowEmptyState;
