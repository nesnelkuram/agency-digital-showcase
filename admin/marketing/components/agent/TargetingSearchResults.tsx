import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Users, Check } from 'lucide-react';

interface TargetingItem {
  id: string;
  name: string;
  audience_size?: number;
  path?: string;
  description?: string;
}

interface TargetingSearchResultsProps {
  data: {
    results: TargetingItem[];
    searchType: string;
    query?: string;
    demographicClass?: string;
  };
  onSendMessage: (text: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  interests: 'Ilgi Alanlari',
  behaviors: 'Davranislar',
  demographics: 'Demografikler',
};

function formatAudienceSize(size: number): string {
  if (size >= 1_000_000_000) return `${(size / 1_000_000_000).toFixed(1)}B`;
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)}M`;
  if (size >= 1_000) return `${(size / 1_000).toFixed(0)}K`;
  return String(size);
}

const TargetingSearchResults: React.FC<TargetingSearchResultsProps> = ({ data, onSendMessage }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { results, searchType, query } = data;

  if (!results || results.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Sonuc bulunamadi.
      </div>
    );
  }

  const toggleItem = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    const items = results.filter(r => selected.has(r.id));
    const formatted = items.map(i => `${i.id}:${i.name}`).join(', ');
    onSendMessage(`Su ${TYPE_LABELS[searchType] || searchType} secildi: [${formatted}]`);
  };

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Search className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          {TYPE_LABELS[searchType] || searchType}
          {query && <span className="text-neutral-400"> — "{query}"</span>}
          <span className="text-neutral-400 ml-1">({results.length} sonuc)</span>
        </span>
      </div>

      {/* Chip grid */}
      <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto pr-1">
        {results.map((item, i) => {
          const isSelected = selected.has(item.id);
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              onClick={() => toggleItem(item.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-commons transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:border-indigo-200 hover:bg-indigo-50/50'
              }`}
            >
              {isSelected && <Check className="w-3 h-3 text-indigo-600" />}
              <span className="font-medium">{item.name}</span>
              {item.audience_size != null && item.audience_size > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-neutral-400">
                  <Users className="w-2.5 h-2.5" />
                  {formatAudienceSize(item.audience_size)}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Submit button */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2"
        >
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-commons font-medium hover:bg-indigo-700 transition-colors"
          >
            Secilenleri Kullan ({selected.size})
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default TargetingSearchResults;
