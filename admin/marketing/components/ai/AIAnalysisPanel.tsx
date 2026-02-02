import React, { useState, useEffect } from 'react';
import {
  Brain, Lightbulb, RefreshCw, AlertTriangle, CheckCircle,
  TrendingUp, Target, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { CampaignAIAnalysis } from '@/shared/types/breakdown';
import type { MarketingCampaign } from '@/shared/types/marketing';
import {
  getLatestAIAnalysis,
  saveAIAnalysis,
} from '@/shared/services/marketingService';
import { Timestamp } from 'firebase/firestore';

interface AIAnalysisPanelProps {
  campaign: MarketingCampaign;
}

const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({ campaign }) => {
  // States
  const [setupAnalysis, setSetupAnalysis] = useState<CampaignAIAnalysis | null>(null);
  const [optimizationAnalysis, setOptimizationAnalysis] = useState<CampaignAIAnalysis | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [loadingOptimization, setLoadingOptimization] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);

  // Load cached analyses on mount
  useEffect(() => {
    getLatestAIAnalysis(campaign.id, 'setup_analysis').then(setSetupAnalysis);
    getLatestAIAnalysis(campaign.id, 'optimization_recommendations').then(setOptimizationAnalysis);
  }, [campaign.id]);

  // Run setup analysis
  const handleRunSetup = async () => {
    setLoadingSetup(true);
    setSetupError(null);
    try {
      // Build campaign data for API
      const campaignData = {
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
        platforms: campaign.platforms,
        budget: campaign.budget,
        schedule: campaign.schedule,
        adSets: campaign.adSets.map(as => ({
          name: as.name,
          status: as.status,
          budget: as.budget,
          bidStrategy: as.bidStrategy,
          optimizationGoal: as.optimizationGoal,
          targetingJson: as.targetingJson,
          adCount: as.ads.length,
          ads: as.ads.map(ad => ({
            name: ad.name,
            status: ad.status,
            type: ad.type,
            hasImage: !!ad.creative.imageUrl,
            hasVideo: !!ad.creative.videoUrl || !!ad.creative.thumbnailUrl,
            headline: ad.creative.headline,
            primaryText: ad.creative.primaryText,
            callToAction: ad.creative.callToAction,
          })),
        })),
        performance: campaign.performance ? {
          totalSpend: campaign.performance.totalSpend,
          totalImpressions: campaign.performance.totalImpressions,
          totalClicks: campaign.performance.totalClicks,
          totalConversions: campaign.performance.totalConversions,
          averageCTR: campaign.performance.averageCTR,
          averageCPA: campaign.performance.averageCPA,
        } : undefined,
      };

      const res = await fetch('/api/marketing/analyze-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id, campaignData }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Analiz basarisiz');

      // Save to Firestore
      const analysisDoc: Omit<CampaignAIAnalysis, 'id'> = {
        campaignId: campaign.id,
        type: 'setup_analysis',
        setupScore: data.analysis.setupScore,
        setupSummary: data.analysis.setupSummary,
        categories: data.analysis.categories,
        generatedAt: Timestamp.now(),
      };
      await saveAIAnalysis(analysisDoc);

      // Reload from Firestore
      const fresh = await getLatestAIAnalysis(campaign.id, 'setup_analysis');
      setSetupAnalysis(fresh);
    } catch (err: any) {
      setSetupError(err.message);
    } finally {
      setLoadingSetup(false);
    }
  };

  // Run optimization analysis (similar pattern)
  const handleRunOptimization = async () => {
    setLoadingOptimization(true);
    setOptimizationError(null);
    try {
      const campaignData = {
        name: campaign.name,
        objective: campaign.objective,
        budget: campaign.budget,
        adSets: campaign.adSets.map(as => ({
          name: as.name,
          metaAdSetId: as.metaAdSetId || '',
          budget: as.budget,
          bidStrategy: as.bidStrategy,
          optimizationGoal: as.optimizationGoal,
          performanceSummary: as.performanceSummary,
          ads: as.ads.map(ad => ({
            name: ad.name,
            metaAdId: ad.metaAdId || '',
            status: ad.status,
            performanceSummary: ad.performanceSummary,
          })),
        })),
      };

      const res = await fetch('/api/marketing/ai-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id, campaignData }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Optimizasyon basarisiz');

      const analysisDoc: Omit<CampaignAIAnalysis, 'id'> = {
        campaignId: campaign.id,
        type: 'optimization_recommendations',
        recommendations: data.analysis.recommendations,
        optimizationSummary: data.analysis.optimizationSummary,
        generatedAt: Timestamp.now(),
      };
      await saveAIAnalysis(analysisDoc);

      const fresh = await getLatestAIAnalysis(campaign.id, 'optimization_recommendations');
      setOptimizationAnalysis(fresh);
    } catch (err: any) {
      setOptimizationError(err.message);
    } finally {
      setLoadingOptimization(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Setup Analysis */}
      <div className="bg-white rounded-xl border border-neutral-200/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <h3 className="font-commons font-semibold text-[#171717]">Kampanya Kurulum Analizi</h3>
          </div>
          <button
            onClick={handleRunSetup}
            disabled={loadingSetup}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm disabled:opacity-50"
          >
            {loadingSetup ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Analiz Ediliyor...</>
            ) : (
              <><Brain className="w-4 h-4" /> Analizi Baslat</>
            )}
          </button>
        </div>

        <div className="p-6">
          {setupError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-commons text-red-700">{setupError}</p>
            </div>
          )}

          {!setupAnalysis && !loadingSetup && (
            <div className="text-center py-8">
              <Brain className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="font-commons text-neutral-500">Henuz analiz yapilmadi</p>
              <p className="text-sm font-commons text-neutral-400 mt-1">
                Kampanya kurulumunuzu analiz etmek icin butona tiklayin
              </p>
            </div>
          )}

          {setupAnalysis && (
            <div className="space-y-4">
              {/* Score gauge - large circular indicator */}
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24">
                  {/* SVG circular gauge */}
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={
                        (setupAnalysis.setupScore || 0) >= 80 ? '#22c55e' :
                        (setupAnalysis.setupScore || 0) >= 60 ? '#eab308' :
                        (setupAnalysis.setupScore || 0) >= 40 ? '#f97316' : '#ef4444'
                      }
                      strokeWidth="8"
                      strokeDasharray={`${((setupAnalysis.setupScore || 0) / 100) * 264} 264`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-commons font-bold text-[#171717]">
                      {setupAnalysis.setupScore || 0}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-commons text-sm text-neutral-500">Genel Skor</p>
                  <p className="font-commons text-[#171717]">{setupAnalysis.setupSummary}</p>
                </div>
              </div>

              {/* Category cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(setupAnalysis.categories || []).map((cat, i) => (
                  <CategoryCard key={i} category={cat} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Optimization Recommendations */}
      <div className="bg-white rounded-xl border border-neutral-200/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3 className="font-commons font-semibold text-[#171717]">Optimizasyon Onerileri</h3>
          </div>
          <button
            onClick={handleRunOptimization}
            disabled={loadingOptimization}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-commons text-sm disabled:opacity-50"
          >
            {loadingOptimization ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Analiz Ediliyor...</>
            ) : (
              <><Zap className="w-4 h-4" /> Optimizasyon Baslat</>
            )}
          </button>
        </div>

        <div className="p-6">
          {optimizationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-commons text-red-700">{optimizationError}</p>
            </div>
          )}

          {!optimizationAnalysis && !loadingOptimization && (
            <div className="text-center py-8">
              <Lightbulb className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="font-commons text-neutral-500">Henuz optimizasyon onerileri yok</p>
              <p className="text-sm font-commons text-neutral-400 mt-1">
                Performans verilerine dayali oneriler icin butona tiklayin
              </p>
            </div>
          )}

          {optimizationAnalysis && (
            <div className="space-y-4">
              {optimizationAnalysis.optimizationSummary && (
                <p className="font-commons text-[#171717] text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
                  {optimizationAnalysis.optimizationSummary}
                </p>
              )}

              {/* Recommendations list */}
              <div className="space-y-3">
                {(optimizationAnalysis.recommendations || []).map((rec, i) => (
                  <RecommendationCard key={i} recommendation={rec} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Category card sub-component
const CategoryCard: React.FC<{ category: any }> = ({ category }) => {
  const [expanded, setExpanded] = useState(false);
  const statusColors = {
    good: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    critical: 'border-red-200 bg-red-50',
  };
  const statusIcons = {
    good: <CheckCircle className="w-4 h-4 text-green-600" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-600" />,
    critical: <AlertTriangle className="w-4 h-4 text-red-600" />,
  };

  return (
    <div className={`rounded-lg border p-4 ${statusColors[category.status as keyof typeof statusColors] || 'border-neutral-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {statusIcons[category.status as keyof typeof statusIcons]}
          <span className="font-commons font-semibold text-sm">{category.category}</span>
        </div>
        <span className="font-commons font-bold text-lg">{category.score}</span>
      </div>
      {/* Findings (collapsible) */}
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs font-commons text-neutral-500 hover:text-neutral-700">
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {category.findings?.length || 0} bulgu, {category.recommendations?.length || 0} oneri
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {category.findings?.map((f: string, fi: number) => (
            <p key={fi} className="text-xs font-commons text-neutral-600">- {f}</p>
          ))}
          {category.recommendations?.map((r: string, ri: number) => (
            <p key={ri} className="text-xs font-commons text-indigo-600">&rarr; {r}</p>
          ))}
        </div>
      )}
    </div>
  );
};

// Recommendation card sub-component
const RecommendationCard: React.FC<{ recommendation: any; index: number }> = ({ recommendation, index }) => {
  const priorityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-blue-500',
  };
  const priorityLabels = {
    high: 'Yuksek',
    medium: 'Orta',
    low: 'Dusuk',
  };
  const typeIcons: Record<string, React.ElementType> = {
    budget_realloc: Target,
    targeting_refine: Target,
    creative_change: Lightbulb,
    pause_underperform: AlertTriangle,
    bid_adjust: TrendingUp,
    scale_winner: Zap,
  };
  const Icon = typeIcons[recommendation.type] || Lightbulb;

  return (
    <div className={`bg-white border border-neutral-200/50 border-l-4 ${priorityColors[recommendation.priority as keyof typeof priorityColors] || 'border-l-neutral-300'} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-neutral-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-commons font-semibold text-sm text-[#171717]">{recommendation.title}</h4>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-commons ${
              recommendation.priority === 'high' ? 'bg-red-100 text-red-700' :
              recommendation.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {priorityLabels[recommendation.priority as keyof typeof priorityLabels] || recommendation.priority}
            </span>
            {recommendation.confidence && (
              <span className="text-[10px] font-commons text-neutral-400">
                Guven: {Math.round(recommendation.confidence * 100)}%
              </span>
            )}
          </div>
          <p className="text-sm font-commons text-neutral-600 mb-2">{recommendation.description}</p>
          <div className="flex gap-4 text-xs font-commons">
            {recommendation.currentValue && (
              <span className="text-neutral-500">Mevcut: <span className="text-neutral-700">{recommendation.currentValue}</span></span>
            )}
            {recommendation.suggestedValue && (
              <span className="text-indigo-600">Onerilen: <span className="font-semibold">{recommendation.suggestedValue}</span></span>
            )}
            {recommendation.expectedImprovement && (
              <span className="text-green-600">Beklenen: {recommendation.expectedImprovement}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysisPanel;
