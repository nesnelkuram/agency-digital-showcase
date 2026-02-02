import React, { useEffect, useState } from 'react';
import { Lightbulb, RefreshCw } from 'lucide-react';
import type { OptimizationSuggestion } from '@/shared/types/marketing';
import {
  getOptimizationSuggestions,
  applyOptimization,
} from '@/shared/services/marketingService';
import OptimizationCard from './OptimizationCard';

interface OptimizationPanelProps {
  campaignId: string;
  onOptimizationApplied?: () => void;
}

const OptimizationPanel: React.FC<OptimizationPanelProps> = ({ campaignId, onOptimizationApplied }) => {
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, [campaignId]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const data = await getOptimizationSuggestions(campaignId);
      setSuggestions(data);
    } catch (err) {
      console.error('Failed to load optimization suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (id: string) => {
    setActionLoading(true);
    try {
      await applyOptimization(id);
      setSuggestions(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'applied' as const } : s
      ));
      onOptimizationApplied?.();
    } catch (err) {
      console.error('Failed to apply optimization:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(true);
    try {
      // Update status in Firestore — use the service
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase/config');
      if (db) {
        await updateDoc(doc(db, 'optimization_suggestions', id), { status: 'rejected' });
      }
      setSuggestions(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'rejected' as const } : s
      ));
    } catch (err) {
      console.error('Failed to reject optimization:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-commons font-semibold text-[#171717]">
            Optimizasyon Onerileri
          </h3>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-commons font-medium">
              {pendingCount} bekleyen
            </span>
          )}
        </div>
        <button
          onClick={loadSuggestions}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-commons text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Yenile
        </button>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-8">
          <Lightbulb className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm font-commons text-neutral-500">
            Henuz optimizasyon onerisi yok
          </p>
          <p className="text-xs font-commons text-neutral-400 mt-1">
            "AI Optimizasyon" butonunu kullanarak analiz baslatin
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions
            .sort((a, b) => {
              // pending first, then by impact
              if (a.status === 'pending' && b.status !== 'pending') return -1;
              if (a.status !== 'pending' && b.status === 'pending') return 1;
              const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
              return (impactOrder[a.impact] || 1) - (impactOrder[b.impact] || 1);
            })
            .map(s => (
              <OptimizationCard
                key={s.id}
                suggestion={s}
                onApply={handleApply}
                onReject={handleReject}
                loading={actionLoading}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default OptimizationPanel;
