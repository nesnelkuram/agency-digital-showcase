import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  Globe,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  ExternalLink,
  Trash2,
  Pause,
  Play,
  Eye,
  X,
  Zap,
  Target,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  ChevronRight,
  Megaphone,
  BarChart3,
} from 'lucide-react';
import type {
  Competitor,
  CompetitorAnalysis,
  CompetitorStatus,
  MonitorFrequency,
  CompetitorAdExample,
} from '@/shared/types/competitor';
import {
  COMPETITOR_STATUS_LABELS,
  COMPETITOR_STATUS_COLORS,
  MONITOR_FREQUENCY_LABELS,
  THREAT_LEVEL_LABELS,
  THREAT_LEVEL_COLORS,
} from '@/shared/types/competitor';
import {
  createCompetitor,
  getCompetitors,
  deleteCompetitor,
  toggleCompetitorStatus,
  getLatestAnalysis,
  getAllLatestAnalyses,
} from '@/shared/services/competitorService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// PLATFORM OPTIONS
// ============================================

const PLATFORM_OPTIONS = [
  { value: 'Meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'Google', label: 'Google Ads' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'LinkedIn', label: 'LinkedIn' },
];

// ============================================
// ADD COMPETITOR MODAL
// ============================================

interface AddCompetitorModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId?: string;
}

const AddCompetitorModal: React.FC<AddCompetitorModalProps> = ({
  open,
  onClose,
  onCreated,
  projectId,
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [sector, setSector] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<MonitorFrequency>('weekly');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isValid = name.trim() && selectedPlatforms.length > 0;

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSubmit = async () => {
    if (!isValid || !user) return;
    setSubmitting(true);
    setError('');

    try {
      await createCompetitor(
        {
          projectId,
          name: name.trim(),
          website: website.trim() || undefined,
          sector: sector.trim() || undefined,
          platforms: selectedPlatforms,
          frequency,
        },
        user.uid
      );
      onCreated();
      resetForm();
    } catch (err) {
      console.error('Failed to create competitor:', err);
      setError('Rakip eklenirken bir hata olustu.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setWebsite('');
    setSector('');
    setSelectedPlatforms([]);
    setFrequency('weekly');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-commons font-bold text-[#171717]">
            Rakip Ekle
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Firma Adi *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Orn: Rakip Firma A.S."
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Web Sitesi
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.ornek.com"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Sector */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Sektor
            </label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Orn: E-ticaret, Gida, Teknoloji"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-2">
              Izlenecek Platformlar *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORM_OPTIONS.map((opt) => {
                const isSelected = selectedPlatforms.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => togglePlatform(opt.value)}
                    className={`px-3 py-2 rounded-lg border text-sm font-commons transition-colors text-left ${
                      isSelected
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Izleme Sikligi
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as MonitorFrequency)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            >
              {Object.entries(MONITOR_FREQUENCY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm font-commons text-red-600">{error}</p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Iptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-commons text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Ekleniyor...' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// STATS CARDS
// ============================================

interface StatsBarProps {
  competitors: Competitor[];
  analysisMap: Map<string, CompetitorAnalysis>;
}

const StatsBar: React.FC<StatsBarProps> = ({ competitors, analysisMap }) => {
  const activeCount = competitors.filter((c) => c.status === 'active').length;

  const highThreatCount = Array.from(analysisMap.values()).filter(
    (a) => a.overallThreatLevel === 'high'
  ).length;

  // Find most recent analysis date
  let latestDate: Date | null = null;
  analysisMap.forEach((analysis) => {
    const d = analysis.analyzedAt?.toDate?.();
    if (d && (!latestDate || d > latestDate)) {
      latestDate = d;
    }
  });

  const lastAnalysisText = latestDate
    ? latestDate.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Henuz analiz yok';

  const cards = [
    {
      label: 'Izlenen Rakipler',
      value: activeCount,
      icon: Search,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Yuksek Tehdit',
      value: highThreatCount,
      icon: ShieldAlert,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Son Analiz',
      value: lastAnalysisText,
      icon: Calendar,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-neutral-200/50 p-5 flex items-center gap-4"
        >
          <div className={`p-3 rounded-xl ${card.bg}`}>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <div>
            <p className="text-xs font-commons text-neutral-500 uppercase tracking-wide">
              {card.label}
            </p>
            <p className="text-lg font-commons font-bold text-[#171717] mt-0.5">
              {typeof card.value === 'number'
                ? card.value.toLocaleString('tr-TR')
                : card.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// COMPETITOR CARD
// ============================================

interface CompetitorCardProps {
  competitor: Competitor;
  analysis: CompetitorAnalysis | undefined;
  analyzing: boolean;
  onAnalyze: (id: string) => void;
  onView: (id: string) => void;
  onToggleStatus: (id: string, status: CompetitorStatus) => void;
  onDelete: (id: string) => void;
}

const CompetitorCard: React.FC<CompetitorCardProps> = ({
  competitor,
  analysis,
  analyzing,
  onAnalyze,
  onView,
  onToggleStatus,
  onDelete,
}) => {
  const lastAnalyzed = competitor.lastAnalyzedAt?.toDate?.();
  const lastAnalyzedText = lastAnalyzed
    ? lastAnalyzed.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Henuz analiz edilmedi';

  const threatLevel = analysis?.overallThreatLevel;

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 p-5 hover:shadow-sm transition-all">
      {/* Card Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-commons font-semibold text-[#171717] truncate">
              {competitor.name}
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-commons ${
                COMPETITOR_STATUS_COLORS[competitor.status]
              }`}
            >
              {COMPETITOR_STATUS_LABELS[competitor.status]}
            </span>
            {threatLevel && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-commons ${
                  THREAT_LEVEL_COLORS[threatLevel]
                }`}
              >
                {THREAT_LEVEL_LABELS[threatLevel]} Tehdit
              </span>
            )}
          </div>
          {competitor.website && (
            <a
              href={competitor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-commons text-indigo-600 hover:text-indigo-700 mt-1 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {competitor.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Platform Badges + Frequency */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {competitor.platforms.map((platform) => (
          <span
            key={platform}
            className="px-2 py-0.5 rounded bg-neutral-100 text-xs font-commons text-neutral-600"
          >
            {platform}
          </span>
        ))}
        <span className="text-xs font-commons text-neutral-400">
          {MONITOR_FREQUENCY_LABELS[competitor.frequency]}
        </span>
      </div>

      {/* Last Analysis */}
      <div className="flex items-center gap-1.5 mb-4">
        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
        <span className="text-xs font-commons text-neutral-500">
          Son analiz: {lastAnalyzedText}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap border-t border-neutral-100 pt-4">
        <button
          onClick={() => onAnalyze(competitor.id)}
          disabled={analyzing || competitor.status !== 'active'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-commons text-xs hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Analiz Ediliyor...
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              Analiz Et
            </>
          )}
        </button>

        {analysis && (
          <button
            onClick={() => onView(competitor.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 font-commons text-xs hover:bg-neutral-200 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Goruntule
          </button>
        )}

        <button
          onClick={() =>
            onToggleStatus(
              competitor.id,
              competitor.status === 'active' ? 'paused' : 'active'
            )
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-500 font-commons text-xs hover:bg-neutral-50 transition-colors"
        >
          {competitor.status === 'active' ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              Duraklat
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Aktifle
            </>
          )}
        </button>

        <button
          onClick={() => onDelete(competitor.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 font-commons text-xs hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Sil
        </button>
      </div>
    </div>
  );
};

// ============================================
// SWOT GRID
// ============================================

interface SWOTGridProps {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

const SWOTGrid: React.FC<SWOTGridProps> = ({
  strengths,
  weaknesses,
  opportunities,
  threats,
}) => {
  const quadrants = [
    {
      title: 'Guclu Yonler',
      items: strengths,
      icon: ShieldCheck,
      bg: 'bg-green-50',
      border: 'border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-800',
      dotColor: 'bg-green-400',
    },
    {
      title: 'Zayif Yonler',
      items: weaknesses,
      icon: AlertTriangle,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-800',
      dotColor: 'bg-amber-400',
    },
    {
      title: 'Firsatlar',
      items: opportunities,
      icon: TrendingUp,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-800',
      dotColor: 'bg-blue-400',
    },
    {
      title: 'Tehditler',
      items: threats,
      icon: ShieldAlert,
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-800',
      dotColor: 'bg-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {quadrants.map((q) => (
        <div
          key={q.title}
          className={`${q.bg} ${q.border} border rounded-xl p-4`}
        >
          <div className="flex items-center gap-2 mb-3">
            <q.icon className={`w-4 h-4 ${q.iconColor}`} />
            <h4 className={`font-commons font-semibold text-sm ${q.titleColor}`}>
              {q.title}
            </h4>
          </div>
          <ul className="space-y-1.5">
            {q.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${q.dotColor} mt-1.5 flex-shrink-0`}
                />
                <span className="text-sm font-commons text-neutral-700">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

// ============================================
// AD EXAMPLE CARD
// ============================================

interface AdExampleCardProps {
  example: CompetitorAdExample;
}

const AdExampleCard: React.FC<AdExampleCardProps> = ({ example }) => {
  const typeLabels: Record<string, string> = {
    image: 'Gorsel',
    video: 'Video',
    carousel: 'Carousel',
    text: 'Metin',
  };

  const engagementLabels: Record<string, string> = {
    low: 'Dusuk',
    medium: 'Orta',
    high: 'Yuksek',
  };

  const engagementColors: Record<string, string> = {
    low: 'text-neutral-500',
    medium: 'text-amber-600',
    high: 'text-green-600',
  };

  return (
    <div className="border border-neutral-200 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-commons">
          {example.platform}
        </span>
        <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 text-xs font-commons">
          {typeLabels[example.type] || example.type}
        </span>
        <span
          className={`text-xs font-commons ${
            engagementColors[example.estimatedEngagement] || 'text-neutral-500'
          }`}
        >
          Etkilesim:{' '}
          {engagementLabels[example.estimatedEngagement] ||
            example.estimatedEngagement}
        </span>
      </div>
      {example.headline && (
        <p className="font-commons font-semibold text-sm text-[#171717]">
          {example.headline}
        </p>
      )}
      {example.description && (
        <p className="font-commons text-sm text-neutral-600">
          {example.description}
        </p>
      )}
      {example.cta && (
        <p className="font-commons text-xs text-indigo-600">
          CTA: {example.cta}
        </p>
      )}
      {example.notes && (
        <p className="font-commons text-xs text-neutral-500 italic">
          {example.notes}
        </p>
      )}
    </div>
  );
};

// ============================================
// ANALYSIS DETAIL PANEL
// ============================================

interface AnalysisDetailPanelProps {
  competitor: Competitor;
  analysis: CompetitorAnalysis;
  onClose: () => void;
  onReanalyze: (id: string) => void;
  analyzing: boolean;
}

const AnalysisDetailPanel: React.FC<AnalysisDetailPanelProps> = ({
  competitor,
  analysis,
  onClose,
  onReanalyze,
  analyzing,
}) => {
  const analyzedDate = analysis.analyzedAt?.toDate?.();
  const analyzedText = analyzedDate
    ? analyzedDate.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="bg-white rounded-xl border border-neutral-200/50 overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-6 border-b border-neutral-200 bg-neutral-50/50">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-commons font-bold text-[#171717]">
              {competitor.name}
            </h2>
            {analysis.overallThreatLevel && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-commons font-medium ${
                  THREAT_LEVEL_COLORS[analysis.overallThreatLevel]
                }`}
              >
                {THREAT_LEVEL_LABELS[analysis.overallThreatLevel]} Tehdit
              </span>
            )}
          </div>
          {analyzedText && (
            <p className="text-sm font-commons text-neutral-500 mt-1">
              Analiz tarihi: {analyzedText}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onReanalyze(competitor.id)}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-commons text-xs hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Analiz Ediliyor...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Yeniden Analiz Et
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="p-6 space-y-6">
        {/* Confidence Meter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-neutral-400" />
            <span className="text-sm font-commons text-neutral-500">
              Guven Seviyesi:
            </span>
          </div>
          <div className="flex-1 max-w-xs">
            <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  analysis.confidence >= 0.7
                    ? 'bg-green-500'
                    : analysis.confidence >= 0.4
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${(analysis.confidence * 100).toFixed(0)}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-commons font-medium text-[#171717]">
            %{(analysis.confidence * 100).toFixed(0)}
          </span>
        </div>

        {/* Strategy Summary */}
        <div>
          <h3 className="text-sm font-commons font-semibold text-[#171717] mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-500" />
            Reklam Stratejisi Ozeti
          </h3>
          <p className="text-sm font-commons text-neutral-700 leading-relaxed bg-neutral-50 rounded-lg p-4">
            {analysis.adStrategySummary}
          </p>
        </div>

        {/* Estimated Spend + Target Audience + Creative Approach */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analysis.estimatedMonthlySpend && (
            <div className="bg-neutral-50 rounded-lg p-4">
              <p className="text-xs font-commons text-neutral-500 uppercase tracking-wide mb-1">
                Tahmini Aylik Harcama
              </p>
              <p className="text-sm font-commons font-semibold text-[#171717]">
                {analysis.estimatedMonthlySpend}
              </p>
            </div>
          )}
          <div className="bg-neutral-50 rounded-lg p-4">
            <p className="text-xs font-commons text-neutral-500 uppercase tracking-wide mb-1">
              Hedef Kitle
            </p>
            <p className="text-sm font-commons text-neutral-700">
              {analysis.targetAudience}
            </p>
          </div>
          <div className="bg-neutral-50 rounded-lg p-4">
            <p className="text-xs font-commons text-neutral-500 uppercase tracking-wide mb-1">
              Kreatif Yaklasim
            </p>
            <p className="text-sm font-commons text-neutral-700">
              {analysis.creativeApproach}
            </p>
          </div>
        </div>

        {/* Messaging Themes */}
        {analysis.messagingThemes.length > 0 && (
          <div>
            <h3 className="text-sm font-commons font-semibold text-[#171717] mb-2 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-indigo-500" />
              Mesaj Temalari
            </h3>
            <div className="flex flex-wrap gap-2">
              {analysis.messagingThemes.map((theme, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-commons"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Primary Platforms */}
        {analysis.primaryPlatforms.length > 0 && (
          <div>
            <h3 className="text-sm font-commons font-semibold text-[#171717] mb-2">
              Birincil Platformlar
            </h3>
            <div className="flex flex-wrap gap-2">
              {analysis.primaryPlatforms.map((platform, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-commons"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SWOT Grid */}
        <div>
          <h3 className="text-sm font-commons font-semibold text-[#171717] mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            SWOT Analizi
          </h3>
          <SWOTGrid
            strengths={analysis.strengths}
            weaknesses={analysis.weaknesses}
            opportunities={analysis.opportunities}
            threats={analysis.threats}
          />
        </div>

        {/* Ad Examples */}
        {analysis.adExamples.length > 0 && (
          <div>
            <h3 className="text-sm font-commons font-semibold text-[#171717] mb-3 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-indigo-500" />
              Reklam Ornekleri
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.adExamples.map((example, i) => (
                <AdExampleCard key={i} example={example} />
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div>
            <h3 className="text-sm font-commons font-semibold text-[#171717] mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Stratejik Oneriler
            </h3>
            <div className="space-y-2">
              {analysis.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-amber-50/50 border border-amber-100 rounded-lg p-3"
                >
                  <ChevronRight className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-commons text-neutral-700">
                    {rec}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN PAGE
// ============================================

const CompetitorMonitorPage: React.FC = () => {
  const { projectId } = useProjectScope();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [analysisMap, setAnalysisMap] = useState<
    Map<string, CompetitorAnalysis>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<
    string | null
  >(null);

  // ---- Load Data ----
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [comps, latestMap] = await Promise.all([
        getCompetitors(projectId),
        getAllLatestAnalyses(projectId),
      ]);
      setCompetitors(comps);
      setAnalysisMap(latestMap);
    } catch (err) {
      console.error('Failed to load competitors:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Handlers ----
  const handleAnalyze = async (competitorId: string) => {
    const comp = competitors.find((c) => c.id === competitorId);
    if (!comp) return;

    setAnalyzingIds((prev) => new Set(prev).add(competitorId));

    try {
      const response = await fetch('/api/marketing/analyze-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitorId: comp.id,
          competitorName: comp.name,
          website: comp.website,
          sector: comp.sector,
          platforms: comp.platforms,
          projectId,
        }),
      });

      const data = await response.json();

      if (data.success && data.analysis) {
        // Refresh the analysis for this competitor
        const freshAnalysis = await getLatestAnalysis(competitorId);
        if (freshAnalysis) {
          setAnalysisMap((prev) => {
            const next = new Map(prev);
            next.set(competitorId, freshAnalysis);
            return next;
          });
        }
        // Also refresh competitors to get updated lastAnalyzedAt
        const freshCompetitors = await getCompetitors(projectId);
        setCompetitors(freshCompetitors);
        // Auto-select this competitor to show results
        setSelectedCompetitorId(competitorId);
      } else {
        console.error('Analysis failed:', data.error);
        alert(`Analiz basarisiz: ${data.error || 'Bilinmeyen hata'}`);
      }
    } catch (err) {
      console.error('Failed to run analysis:', err);
      alert('Analiz sirasinda bir hata olustu.');
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(competitorId);
        return next;
      });
    }
  };

  const handleView = (competitorId: string) => {
    setSelectedCompetitorId(competitorId);
  };

  const handleToggleStatus = async (
    competitorId: string,
    status: CompetitorStatus
  ) => {
    try {
      await toggleCompetitorStatus(competitorId, status);
      setCompetitors((prev) =>
        prev.map((c) => (c.id === competitorId ? { ...c, status } : c))
      );
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDelete = async (competitorId: string) => {
    if (!window.confirm('Bu rakibi silmek istediginize emin misiniz?')) return;
    try {
      await deleteCompetitor(competitorId);
      setCompetitors((prev) => prev.filter((c) => c.id !== competitorId));
      setAnalysisMap((prev) => {
        const next = new Map(prev);
        next.delete(competitorId);
        return next;
      });
      if (selectedCompetitorId === competitorId) {
        setSelectedCompetitorId(null);
      }
    } catch (err) {
      console.error('Failed to delete competitor:', err);
    }
  };

  const handleCreated = () => {
    setModalOpen(false);
    loadData();
  };

  // Selected competitor & analysis
  const selectedCompetitor = selectedCompetitorId
    ? competitors.find((c) => c.id === selectedCompetitorId)
    : null;
  const selectedAnalysis = selectedCompetitorId
    ? analysisMap.get(selectedCompetitorId)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">
            Rakip Izleme
          </h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Rakiplerinizin reklam stratejilerini takip edin
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm"
        >
          <Plus className="w-4 h-4" />
          Rakip Ekle
        </button>
      </div>

      {/* Stats Bar */}
      {!loading && competitors.length > 0 && (
        <StatsBar competitors={competitors} analysisMap={analysisMap} />
      )}

      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : competitors.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <Search className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="font-commons text-neutral-500 mb-2">
            Henuz izlenen rakip bulunmuyor
          </p>
          <p className="font-commons text-sm text-neutral-400">
            Rakip ekleyerek AI destekli analiz baslatabilirsiniz
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Analysis Detail Panel */}
          {selectedCompetitor && selectedAnalysis && (
            <AnalysisDetailPanel
              competitor={selectedCompetitor}
              analysis={selectedAnalysis}
              onClose={() => setSelectedCompetitorId(null)}
              onReanalyze={handleAnalyze}
              analyzing={analyzingIds.has(selectedCompetitor.id)}
            />
          )}

          {/* Competitors Grid */}
          <div>
            <h2 className="text-base font-commons font-semibold text-[#171717] mb-3">
              Rakipler ({competitors.length})
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {competitors.map((comp) => (
                <CompetitorCard
                  key={comp.id}
                  competitor={comp}
                  analysis={analysisMap.get(comp.id)}
                  analyzing={analyzingIds.has(comp.id)}
                  onAnalyze={handleAnalyze}
                  onView={handleView}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Competitor Modal */}
      <AddCompetitorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        projectId={projectId}
      />
    </div>
  );
};

export default CompetitorMonitorPage;
