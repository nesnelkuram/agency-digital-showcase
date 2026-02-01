import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, RotateCcw, Cpu, Target,
  Users, Palette, Wallet, TrendingUp, Globe, ChevronDown,
  ChevronRight, AlertTriangle, Clock, MessageSquare, Send,
} from 'lucide-react';
import type {
  CampaignProposal,
  AdPlatform,
  ProposalStatus,
} from '@/shared/types/marketing';
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  OBJECTIVE_LABELS,
} from '@/shared/types/marketing';
import {
  getProposal,
  updateProposalStatus,
} from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';

const ProposalReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { basePath } = useProjectScope();
  const [proposal, setProposal] = useState<CampaignProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    strategy: true,
    audience: false,
    creatives: false,
    budget: false,
    outcomes: false,
  });

  useEffect(() => {
    if (id) {
      getProposal(id)
        .then(setProposal)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleAction = async (action: 'approved' | 'rejected' | 'revision') => {
    if (!proposal || !id) return;
    if (action === 'rejected' && !notes.trim()) {
      alert('Red gerekceleri zorunludur');
      return;
    }

    setActionLoading(true);
    try {
      await updateProposalStatus(
        id,
        action as ProposalStatus,
        'admin',
        'Admin',
        notes.trim() || undefined
      );
      // Refresh
      const updated = await getProposal(id);
      setProposal(updated);
      setNotes('');
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="text-center py-16">
        <Cpu className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="font-commons text-neutral-500">Oneri bulunamadi</p>
        <button
          onClick={() => navigate(`${basePath}/proposals`)}
          className="mt-4 text-sm font-commons text-indigo-600 hover:underline"
        >
          Onerilere don
        </button>
      </div>
    );
  }

  const strategy = proposal.strategy;
  const isPending = proposal.status === 'pending';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`${basePath}/proposals`)}
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-commons font-bold text-[#171717]">
              Kampanya Onerisi Inceleme
            </h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-commons ${PROPOSAL_STATUS_COLORS[proposal.status]}`}>
              {PROPOSAL_STATUS_LABELS[proposal.status]}
            </span>
          </div>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Olusturulma: {proposal.createdAt?.toDate?.()?.toLocaleDateString('tr-TR') || ''}
            {proposal.pipelineMetadata && (
              <span className="ml-3">
                AI suresi: {((proposal.pipelineMetadata.totalDuration || 0) / 1000).toFixed(1)}s
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Strategy Overview */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
        <h2 className="text-lg font-commons font-semibold text-[#171717] mb-3">
          Strateji Ozeti
        </h2>
        <p className="text-sm font-commons text-neutral-600 leading-relaxed mb-4">
          {proposal.rationale}
        </p>

        {/* Platform badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {strategy?.platforms?.map((p: AdPlatform) => (
            <span key={p} className={`px-3 py-1 rounded-full text-sm font-commons ${PLATFORM_COLORS[p]}`}>
              {PLATFORM_LABELS[p]}
            </span>
          ))}
        </div>

        {/* Objective + Budget summary */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-neutral-50 rounded-lg p-3">
            <p className="text-xs font-commons text-neutral-500">Hedef</p>
            <p className="text-sm font-commons font-semibold text-[#171717]">
              {OBJECTIVE_LABELS[strategy?.objective] || strategy?.objective}
            </p>
          </div>
          <div className="bg-neutral-50 rounded-lg p-3">
            <p className="text-xs font-commons text-neutral-500">Aylik Butce</p>
            <p className="text-sm font-commons font-semibold text-[#171717]">
              {proposal.budgetPlan?.totalMonthly?.toLocaleString() || 0} TL
            </p>
          </div>
          <div className="bg-neutral-50 rounded-lg p-3">
            <p className="text-xs font-commons text-neutral-500">Platform Sayisi</p>
            <p className="text-sm font-commons font-semibold text-[#171717]">
              {strategy?.platforms?.length || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-3">
        {/* Campaign Strategies per Platform */}
        <CollapsibleSection
          title="Platform Stratejileri"
          icon={Globe}
          expanded={expandedSections.strategy}
          onToggle={() => toggleSection('strategy')}
        >
          {(proposal as any)?.strategy?.approach && (
            <p className="text-sm font-commons text-neutral-600 mb-4">
              {(proposal as any).strategy.approach}
            </p>
          )}
          <div className="space-y-3">
            {proposal.campaigns?.map((camp, i) => (
              <div key={i} className="border border-neutral-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-commons ${PLATFORM_COLORS[camp.platform]}`}>
                    {PLATFORM_LABELS[camp.platform]}
                  </span>
                  <span className="text-sm font-commons font-semibold text-[#171717]">
                    {camp.campaignName}
                  </span>
                </div>
                <p className="text-sm font-commons text-neutral-500 mb-2">
                  Tip: {camp.campaignType} | Hedef: {OBJECTIVE_LABELS[camp.objective]}
                </p>
                {camp.estimatedResults && (
                  <div className="grid grid-cols-5 gap-2 mt-2">
                    {Object.entries(camp.estimatedResults).map(([key, val]) => (
                      <div key={key} className="text-center bg-neutral-50 rounded p-2">
                        <p className="text-[10px] font-commons text-neutral-400 uppercase">{key}</p>
                        <p className="text-xs font-commons font-semibold">{val}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Audience Targeting */}
        <CollapsibleSection
          title="Hedef Kitle"
          icon={Users}
          expanded={expandedSections.audience}
          onToggle={() => toggleSection('audience')}
        >
          {proposal.campaigns?.map((camp, i) => (
            <div key={i} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-commons ${PLATFORM_COLORS[camp.platform]}`}>
                  {camp.platform}
                </span>
              </div>
              {camp.targeting && (
                <div className="text-sm font-commons text-neutral-600 space-y-1">
                  {camp.targeting.ageRange && (
                    <p>Yas: {camp.targeting.ageRange.min}-{camp.targeting.ageRange.max}</p>
                  )}
                  {camp.targeting.locations && (
                    <p>Konum: {camp.targeting.locations.map(l => l.name).join(', ')}</p>
                  )}
                  {camp.targeting.meta?.interests && (
                    <p>Ilgi: {camp.targeting.meta.interests.join(', ')}</p>
                  )}
                  {camp.targeting.google?.keywords && (
                    <p>Anahtar Kelimeler: {camp.targeting.google.keywords.map(k => k.text).join(', ')}</p>
                  )}
                  {camp.targeting.linkedin?.jobTitles && (
                    <p>Pozisyon: {camp.targeting.linkedin.jobTitles.join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </CollapsibleSection>

        {/* Creatives */}
        <CollapsibleSection
          title="Reklam Icerikleri"
          icon={Palette}
          expanded={expandedSections.creatives}
          onToggle={() => toggleSection('creatives')}
        >
          {proposal.campaigns?.map((camp, i) => (
            <div key={i} className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded text-xs font-commons ${PLATFORM_COLORS[camp.platform]}`}>
                  {PLATFORM_LABELS[camp.platform]}
                </span>
              </div>
              <div className="space-y-3">
                {camp.creatives?.map((creative, ci) => (
                  <div key={ci} className="border border-neutral-100 rounded-lg p-4">
                    <p className="text-sm font-commons font-semibold text-[#171717] mb-1">
                      {creative.headline}
                    </p>
                    <p className="text-sm font-commons text-neutral-600 mb-2">
                      {creative.primaryText}
                    </p>
                    {creative.description && (
                      <p className="text-xs font-commons text-neutral-400 mb-2">
                        {creative.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs font-commons text-neutral-500">
                      <span>CTA: {creative.callToAction}</span>
                      <span>URL: {creative.destinationUrl}</span>
                    </div>
                    {creative.variants && creative.variants.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-commons text-neutral-400 font-semibold">A/B Varyantlari:</p>
                        {creative.variants.map((v, vi) => (
                          <div key={vi} className="bg-neutral-50 rounded p-2">
                            <p className="text-xs font-commons font-semibold">{v.label}: {v.headline}</p>
                            <p className="text-xs font-commons text-neutral-500">{v.primaryText}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CollapsibleSection>

        {/* Budget Plan */}
        <CollapsibleSection
          title="Butce Plani"
          icon={Wallet}
          expanded={expandedSections.budget}
          onToggle={() => toggleSection('budget')}
        >
          {proposal.budgetPlan && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs font-commons text-neutral-500">Toplam Aylik</p>
                  <p className="text-sm font-commons font-semibold">{proposal.budgetPlan.totalMonthly?.toLocaleString()} TL</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs font-commons text-neutral-500">Test Butcesi</p>
                  <p className="text-sm font-commons font-semibold">{proposal.budgetPlan.testPhaseBudget?.toLocaleString()} TL</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs font-commons text-neutral-500">Test Suresi</p>
                  <p className="text-sm font-commons font-semibold">{proposal.budgetPlan.testPhaseDuration} gun</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs font-commons text-neutral-500">Platform Sayisi</p>
                  <p className="text-sm font-commons font-semibold">{proposal.budgetPlan.platforms?.length || 0}</p>
                </div>
              </div>

              {/* Per-platform budget */}
              <div className="space-y-2">
                {proposal.budgetPlan.platforms?.map((pb, i) => (
                  <div key={i} className="flex items-center justify-between border border-neutral-100 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-commons ${PLATFORM_COLORS[pb.platform]}`}>
                        {PLATFORM_LABELS[pb.platform]}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm font-commons">
                      <span className="text-neutral-500">Gunluk: <strong className="text-[#171717]">{pb.dailyBudget?.toLocaleString()} TL</strong></span>
                      <span className="text-neutral-500">Aylik: <strong className="text-[#171717]">{pb.monthlyBudget?.toLocaleString()} TL</strong></span>
                      <span className="text-neutral-500">CPC: <strong className="text-[#171717]">{pb.estimatedCPC?.toFixed(2)} TL</strong></span>
                      <span className="text-neutral-500">ROAS: <strong className="text-emerald-600">{pb.expectedROAS?.toFixed(1)}x</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              {proposal.budgetPlan.rationale && (
                <p className="mt-4 text-sm font-commons text-neutral-500 italic">
                  {proposal.budgetPlan.rationale}
                </p>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* Expected Outcomes */}
        <CollapsibleSection
          title="Beklenen Sonuclar"
          icon={TrendingUp}
          expanded={expandedSections.outcomes}
          onToggle={() => toggleSection('outcomes')}
        >
          <div className="space-y-2">
            {proposal.expectedOutcomes?.map((outcome, i) => (
              <div key={i} className="flex items-center justify-between border border-neutral-100 rounded-lg p-3">
                <div>
                  <p className="text-sm font-commons font-semibold text-[#171717]">{outcome.metric}</p>
                  <p className="text-xs font-commons text-neutral-500">Hedef: {outcome.target}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-commons text-neutral-500">{outcome.timeline}</p>
                  <span className={`text-xs font-commons ${
                    outcome.confidence === 'high' ? 'text-green-600' :
                    outcome.confidence === 'medium' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    Guven: {outcome.confidence === 'high' ? 'Yuksek' : outcome.confidence === 'medium' ? 'Orta' : 'Dusuk'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Review History */}
      {proposal.reviewedBy && (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
          <h3 className="text-sm font-commons font-semibold text-[#171717] mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Inceleme Gecmisi
          </h3>
          <div className="text-sm font-commons text-neutral-600">
            <p>
              {proposal.reviewedByName || proposal.reviewedBy} tarafindan{' '}
              <span className={`font-semibold ${
                proposal.status === 'approved' ? 'text-green-600' :
                proposal.status === 'rejected' ? 'text-red-600' : 'text-orange-600'
              }`}>
                {PROPOSAL_STATUS_LABELS[proposal.status]}
              </span>
            </p>
            {proposal.reviewNotes && (
              <p className="mt-2 bg-neutral-50 rounded-lg p-3 italic">{proposal.reviewNotes}</p>
            )}
          </div>
        </div>
      )}

      {/* Action Area */}
      {isPending && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6">
          <h3 className="text-sm font-commons font-semibold text-[#171717] mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Karar Ver
          </h3>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notlar (red/revizyon icin zorunlu)..."
            rows={3}
            className="w-full border border-neutral-200 rounded-lg p-3 font-commons text-sm focus:outline-none focus:border-indigo-400 mb-4 resize-none"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleAction('approved')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-commons text-sm disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Onayla
            </button>
            <button
              onClick={() => handleAction('revision')}
              disabled={actionLoading || !notes.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-commons text-sm disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Revizyon Iste
            </button>
            <button
              onClick={() => handleAction('rejected')}
              disabled={actionLoading || !notes.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-commons text-sm disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reddet
            </button>
          </div>

          {actionLoading && (
            <div className="flex items-center gap-2 mt-3 text-sm font-commons text-neutral-500">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              Islem yapiliyor...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ElementType;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title, icon: Icon, expanded, onToggle, children,
}) => (
  <div className="bg-white rounded-xl border border-neutral-200/50">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-5 hover:bg-neutral-50 transition-colors rounded-xl"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-indigo-600" />
        <span className="font-commons font-semibold text-[#171717]">{title}</span>
      </div>
      {expanded ? (
        <ChevronDown className="w-5 h-5 text-neutral-400" />
      ) : (
        <ChevronRight className="w-5 h-5 text-neutral-400" />
      )}
    </button>
    {expanded && (
      <div className="px-5 pb-5">
        {children}
      </div>
    )}
  </div>
);

export default ProposalReviewPage;
