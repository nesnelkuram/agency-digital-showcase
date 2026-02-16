import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface CategoryOption {
  key: string;
  label: string;
  prompt: string;
}

interface Props {
  categories: CategoryOption[];
  onSelect: (prompt: string) => void;
}

const DesignSuggestedOptions: React.FC<Props> = ({ categories, onSelect }) => {
  if (categories.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-500" />
        <span className="font-grotesk text-sm text-neutral-500">
          Bir kategori secerek baslayabilirsiniz
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat, i) => (
          <motion.button
            key={cat.key}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => onSelect(cat.prompt)}
            className="px-3 py-2 rounded-xl bg-white border border-neutral-200 hover:border-violet-300 hover:bg-violet-50 transition-colors font-grotesk text-sm text-neutral-700 text-left"
          >
            {cat.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default DesignSuggestedOptions;
