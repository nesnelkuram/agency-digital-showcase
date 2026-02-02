import React from 'react';
import {
  DollarSign, Target, MousePointer, Crosshair, Clock,
  Pause, TrendingUp, Zap, CheckCircle, X,
} from 'lucide-react';
import type { OptimizationSuggestion } from '@/shared/types/marketing';

interface OptimizationCardProps {
  suggestion: OptimizationSuggestion;
  onApply: (id: string) => void;
  onReject: (id: string) => void;
  loading?: boolean;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  budget_shift: { icon: DollarSign, label: 'Butce Kaydirma', color: 'text-blue-600 bg-blue-50' },
  targeting_narrow: { icon: Crosshair, label: 'Hedef Daraltma', color: 'text-violet-600 bg-violet-50' },
  targeting_expand: { icon: Target, label: 'Hedef Genisletme', color: 'text-purple-600 bg-purple-50' },
  creative_change: { icon: Zap, label: 'Kreatif Degisiklik', color: 'text-amber-600 bg-amber-50' },
  bid_adjustment: { icon: TrendingUp, label: 'Teklif Ayarlama', color: 'text-green-600 bg-green-50' },
  schedule_change: { icon: Clock, label: 'Zamanlama', color: 'text-indigo-600 bg-indigo-50' },
  pause_underperform: { icon: Pause, label: 'Durdur', color: 'text-red-600 bg-red-50' },
  scale_outperform: { icon: TrendingUp, label: 'Olceklendir', color: 'text-emerald-600 bg-emerald-50' },
};

const IMPACT_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

const IMPACT_LABELS: Record<string, string> = {
  high: 'Yuksek Etki',
  medium: 'Orta Etki',
  low: 'Dusuk Etki',
};

const OptimizationCard: React.FC<OptimizationCardProps> = ({ suggestion, onApply, onReject, loading }) => {
  const typeConfig = TYPE_CONFIG[suggestion.type] || TYPE_CONFIG.budget_shift;
  const Icon = typeConfig.icon;
  const impactStyle = IMPACT_STYLES[suggestion.impact] || IMPACT_STYLES.medium;
  const impactLabel = IMPACT_LABELS[suggestion.impact] || 'Orta Etki';

  return (
    <div className="border border-neutral-200/50 rounded-lg p-4 hover:bg-neutral-50/50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Type Icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeConfig.color}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-commons font-semibold text-[#171717] truncate">{suggestion.title}</h4>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-commons font-medium ${impactStyle}`}>
              {impactLabel}
            </span>
          </div>
          <p className="text-xs font-commons text-neutral-500 mb-2">{suggestion.description}</p>

          {/* Current vs Suggested */}
          <div className="flex items-center gap-4 text-xs font-commons mb-2">
            <div>
              <span className="text-neutral-400">Mevcut: </span>
              <span className="text-neutral-600 font-medium">{suggestion.currentValue}</span>
            </div>
            <span className="text-neutral-300">→</span>
            <div>
              <span className="text-neutral-400">Onerilen: </span>
              <span className="text-indigo-600 font-medium">{suggestion.suggestedValue}</span>
            </div>
          </div>

          {suggestion.expectedImprovement && (
            <p className="text-xs font-commons text-emerald-600 mb-2">
              Beklenen iyilesme: {suggestion.expectedImprovement}
            </p>
          )}

          {/* Confidence bar */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-20 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${(suggestion.confidence || 0) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-commons text-neutral-400">
              %{((suggestion.confidence || 0) * 100).toFixed(0)} guven
            </span>
          </div>

          {/* Actions */}
          {suggestion.status === 'pending' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onApply(suggestion.id)}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-commons hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-3 h-3" />
                Uygula
              </button>
              <button
                onClick={() => onReject(suggestion.id)}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-neutral-200 text-neutral-600 rounded-lg text-xs font-commons hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                Reddet
              </button>
            </div>
          )}

          {suggestion.status === 'applied' && (
            <span className="text-xs font-commons text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Uygulandi
            </span>
          )}

          {suggestion.status === 'rejected' && (
            <span className="text-xs font-commons text-neutral-400 flex items-center gap-1">
              <X className="w-3 h-3" /> Reddedildi
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OptimizationCard;
