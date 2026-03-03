import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';

interface Suggestion {
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  category?: string;
}

interface OptimizationSuggestionsCardProps {
  data: {
    suggestions: Suggestion[];
    campaignCount?: number;
    message?: string;
  };
}

const IMPACT_BADGES: Record<string, { color: string; label: string }> = {
  high: { color: 'bg-red-100 text-red-700', label: 'Yuksek Etki' },
  medium: { color: 'bg-amber-100 text-amber-700', label: 'Orta Etki' },
  low: { color: 'bg-blue-100 text-blue-700', label: 'Dusuk Etki' },
};

const CATEGORY_LABELS: Record<string, string> = {
  budget: 'Butce',
  targeting: 'Hedefleme',
  creative: 'Kreatif',
  bidding: 'Teklif',
  general: 'Genel',
};

const OptimizationSuggestionsCard: React.FC<OptimizationSuggestionsCardProps> = ({ data }) => {
  const { suggestions, campaignCount } = data;

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        Optimizasyon onerisi bulunamadi.
      </div>
    );
  }

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Optimizasyon Onerileri
          {campaignCount != null && (
            <span className="text-neutral-400 ml-1">({campaignCount} kampanya analiz edildi)</span>
          )}
        </span>
      </div>

      {/* Suggestions */}
      <div className="space-y-2">
        {suggestions.map((suggestion, i) => {
          const impact = IMPACT_BADGES[suggestion.impact] || IMPACT_BADGES.medium;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.08, 0.4) }}
              className="p-3 rounded-xl border border-neutral-150 bg-white"
            >
              <div className="flex items-start gap-2 mb-1">
                <div className="flex-1">
                  <p className="text-sm font-commons font-semibold text-[#171717]">
                    {suggestion.title}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {suggestion.category && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-commons font-medium bg-neutral-100 text-neutral-500">
                      {CATEGORY_LABELS[suggestion.category] || suggestion.category}
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-commons font-medium ${impact.color}`}>
                    {impact.label}
                  </span>
                </div>
              </div>
              <p className="text-xs font-commons text-neutral-600 leading-relaxed">
                {suggestion.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default OptimizationSuggestionsCard;
