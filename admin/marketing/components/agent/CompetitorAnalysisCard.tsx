import React from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, TrendingUp, Target } from 'lucide-react';

interface CompetitorAnalysisCardProps {
  data: {
    competitorName?: string;
    adStrategySummary?: string;
    estimatedMonthlySpend?: string;
    primaryPlatforms?: string[];
    targetAudience?: string;
    messagingThemes?: string[];
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    threats?: string[];
    recommendations?: string[];
    overallThreatLevel?: string;
    confidence?: number;
    error?: string;
  };
}

const THREAT_BADGES: Record<string, { color: string; label: string }> = {
  low: { color: 'bg-emerald-100 text-emerald-700', label: 'Dusuk Tehdit' },
  medium: { color: 'bg-amber-100 text-amber-700', label: 'Orta Tehdit' },
  high: { color: 'bg-red-100 text-red-700', label: 'Yuksek Tehdit' },
};

const SWOT_CONFIG = [
  { key: 'strengths', label: 'Guclu Yonler', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', dotColor: 'text-emerald-500' },
  { key: 'weaknesses', label: 'Zayif Yonler', color: 'bg-red-50 border-red-200 text-red-700', dotColor: 'text-red-400' },
  { key: 'opportunities', label: 'Firsatlar', color: 'bg-blue-50 border-blue-200 text-blue-700', dotColor: 'text-blue-400' },
  { key: 'threats', label: 'Tehditler', color: 'bg-amber-50 border-amber-200 text-amber-700', dotColor: 'text-amber-500' },
] as const;

const CompetitorAnalysisCard: React.FC<CompetitorAnalysisCardProps> = ({ data }) => {
  if (data.error) {
    return (
      <div className="my-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm font-commons text-neutral-500">
        {data.error}
      </div>
    );
  }

  const threat = THREAT_BADGES[data.overallThreatLevel || 'medium'] || THREAT_BADGES.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-2"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Shield className="w-3.5 h-3.5 text-rose-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Rakip Analizi
          {data.competitorName && <span className="text-neutral-400 ml-1">— {data.competitorName}</span>}
        </span>
      </div>

      <div className="space-y-3">
        {/* Strategy Summary + Badges */}
        <div className="p-3 rounded-xl border border-neutral-150 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-lg text-xs font-commons font-medium ${threat.color}`}>
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              {threat.label}
            </span>
            {data.confidence != null && (
              <span className="text-[10px] font-commons text-neutral-400">
                Guven: %{(data.confidence * 100).toFixed(0)}
              </span>
            )}
            {data.estimatedMonthlySpend && (
              <span className="text-[10px] font-commons text-neutral-400 ml-auto">
                ~{data.estimatedMonthlySpend}/ay
              </span>
            )}
          </div>

          {data.adStrategySummary && (
            <p className="text-xs font-commons text-neutral-600 leading-relaxed mb-2">
              {data.adStrategySummary}
            </p>
          )}

          {/* Platforms + Audience */}
          <div className="flex items-center gap-3 text-[10px] font-commons text-neutral-400">
            {data.primaryPlatforms && data.primaryPlatforms.length > 0 && (
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                {data.primaryPlatforms.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Messaging Themes */}
        {data.messagingThemes && data.messagingThemes.length > 0 && (
          <div className="p-3 rounded-xl border border-neutral-150 bg-white">
            <p className="text-[10px] font-commons font-medium text-neutral-400 uppercase mb-1.5">Mesaj Temalari</p>
            <div className="flex flex-wrap gap-1.5">
              {data.messagingThemes.map((theme, i) => (
                <span key={i} className="px-2 py-0.5 rounded-lg bg-violet-50 text-xs font-commons text-violet-700">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SWOT Grid */}
        <div className="grid grid-cols-2 gap-2">
          {SWOT_CONFIG.map(({ key, label, color, dotColor }) => {
            const items = (data as any)[key] as string[] | undefined;
            if (!items || items.length === 0) return null;

            return (
              <div key={key} className={`p-2.5 rounded-xl border ${color}`}>
                <p className="text-[10px] font-commons font-semibold uppercase tracking-wide mb-1">{label}</p>
                <ul className="space-y-0.5">
                  {items.map((item, i) => (
                    <li key={i} className="text-xs font-commons flex items-start gap-1">
                      <span className={`${dotColor} mt-0.5`}>•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <div className="p-3 rounded-xl border border-neutral-150 bg-white">
            <p className="text-[10px] font-commons font-medium text-neutral-400 uppercase mb-1.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Stratejik Oneriler
            </p>
            <ul className="space-y-1">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="text-xs font-commons text-neutral-600 flex items-start gap-1.5">
                  <span className="text-indigo-400 mt-0.5 font-bold">{i + 1}.</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CompetitorAnalysisCard;
