import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, BarChart3, Globe, Users, Palette, Pencil,
  Wallet, Calendar, Clock, MessageSquare, Send, Tag, TrendingUp,
  AlertTriangle, CheckCircle, Eye, MousePointer, Target, DollarSign, Lightbulb,
} from 'lucide-react';
import type {
  MarketingCampaign,
  AdPlatform,
  MarketingTimelineEvent,
  PerformanceSnapshot,
} from '@/shared/types/marketing';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  OBJECTIVE_LABELS,
} from '@/shared/types/marketing';
import {
  getCampaign,
  updateCampaign,
  addNoteToCampaign,
  getPerformanceSnapshots,
} from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import SpendTrendChart from './components/charts/SpendTrendChart';
import FunnelChart from './components/charts/FunnelChart';
import { aggregateByDate } from '@/shared/utils/performanceAggregator';
import OptimizationPanel from './components/OptimizationPanel';

const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { basePath } = useProjectScope();
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'adsets' | 'timeline' | 'optimization'>('overview');

  useEffect(() => {
    if (id) {
      Promise.all([
        getCampaign(id),
        getPerformanceSnapshots(id),
      ]).then(([camp, snaps]) => {
        setCampaign(camp);
        setSnapshots(snaps);
      }).catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleToggleStatus = async () => {
    if (!campaign || !id) return;
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    await updateCampaign(id, { status: newStatus }, 'admin', 'Admin');
    setCampaign(prev => prev ? { ...prev, status: newStatus } : null);
  };

  const handleAddNote = async () => {
    if (!id || !noteText.trim()) return;
    setAddingNote(true);
    try {
      await addNoteToCampaign(id, noteText.trim(), 'admin', 'Admin');
      const updated = await getCampaign(id);
      setCampaign(updated);
      setNoteText('');
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="font-commons text-neutral-500">Kampanya bulunamadi</p>
      </div>
    );
  }

  // Aggregate performance
  const totalSpend = snapshots.reduce((s, snap) => s + snap.spend, 0);
  const totalImpressions = snapshots.reduce((s, snap) => s + snap.impressions, 0);
  const totalClicks = snapshots.reduce((s, snap) => s + snap.clicks, 0);
  const totalConversions = snapshots.reduce((s, snap) => s + snap.conversions, 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;

  // Aggregated metrics for charts
  const aggregatedMetrics = {
    impressions: totalImpressions,
    clicks: totalClicks,
    conversions: totalConversions,
  };

  const tabs = [
    { key: 'overview', label: 'Genel Bakis' },
    { key: 'performance', label: 'Performans' },
    { key: 'adsets', label: 'Reklam Setleri' },
    { key: 'timeline', label: 'Zaman Cizelgesi' },
    { key: 'optimization', label: 'Optimizasyon' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`${basePath}/campaigns`)}
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-commons font-bold text-[#171717]">
              {campaign.name}
            </h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-commons ${CAMPAIGN_STATUS_COLORS[campaign.status]}`}>
              {CAMPAIGN_STATUS_LABELS[campaign.status]}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm font-commons text-neutral-500">
            <span>{OBJECTIVE_LABELS[campaign.objective]}</span>
            <span>{campaign.budget.totalBudget.toLocaleString()} TL</span>
            <div className="flex gap-1">
              {campaign.platforms.map((p) => (
                <span key={p} className={`px-1.5 py-0.5 rounded text-xs ${PLATFORM_COLORS[p]}`}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Link
            to={`${basePath}/campaigns/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 font-commons text-sm transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Duzenle
          </Link>
          {(campaign.status === 'active' || campaign.status === 'paused') && (
            <button
              onClick={handleToggleStatus}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-commons text-sm transition-colors ${
                campaign.status === 'active'
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {campaign.status === 'active' ? (
                <><Pause className="w-4 h-4" /> Duraklat</>
              ) : (
                <><Play className="w-4 h-4" /> Devam Et</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-lg border border-neutral-200/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg font-commons text-sm transition-colors ${
              activeTab === tab.key
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Harcama', value: `${totalSpend.toLocaleString()} TL`, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Gosterim', value: totalImpressions.toLocaleString(), icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Tiklama', value: totalClicks.toLocaleString(), icon: MousePointer, color: 'text-cyan-600', bg: 'bg-cyan-50' },
              { label: 'Donusum', value: totalConversions.toLocaleString(), icon: Target, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'CTR', value: `${avgCTR.toFixed(2)}%`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'CPA', value: `${avgCPA.toFixed(0)} TL`, icon: Wallet, color: 'text-red-600', bg: 'bg-red-50' },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="bg-white rounded-xl border border-neutral-200/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 ${kpi.bg} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                  </div>
                  <p className="text-xs font-commons text-neutral-500">{kpi.label}</p>
                  <p className="text-lg font-commons font-bold text-[#171717]">{kpi.value}</p>
                </div>
              );
            })}
          </div>

          {/* Schedule & Budget info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
              <h3 className="text-sm font-commons font-semibold text-[#171717] flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4" />
                Zamanlama
              </h3>
              <div className="space-y-2 text-sm font-commons text-neutral-600">
                <p>Baslangic: {campaign.schedule.startDate}</p>
                {campaign.schedule.endDate && <p>Bitis: {campaign.schedule.endDate}</p>}
                <p>Zaman dilimi: {campaign.schedule.timezone}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
              <h3 className="text-sm font-commons font-semibold text-[#171717] flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4" />
                Butce Ozeti
              </h3>
              <div className="space-y-2 text-sm font-commons text-neutral-600">
                <p>Toplam: {campaign.budget.totalBudget.toLocaleString()} {campaign.budget.currency}</p>
                {campaign.budget.dailyLimit && <p>Gunluk limit: {campaign.budget.dailyLimit.toLocaleString()} TL</p>}
                <p>Harcanan: {totalSpend.toLocaleString()} TL ({campaign.budget.totalBudget > 0 ? ((totalSpend / campaign.budget.totalBudget) * 100).toFixed(1) : 0}%)</p>
              </div>
            </div>
          </div>

          {/* Platform Campaign IDs */}
          {Object.keys(campaign.platformCampaignIds).length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
              <h3 className="text-sm font-commons font-semibold text-[#171717] flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4" />
                Platform Kampanya ID'leri
              </h3>
              <div className="space-y-2">
                {Object.entries(campaign.platformCampaignIds).map(([platform, platformId]) => (
                  <div key={platform} className="flex items-center gap-3 text-sm font-commons">
                    <span className={`px-2 py-0.5 rounded text-xs ${PLATFORM_COLORS[platform as AdPlatform]}`}>
                      {PLATFORM_LABELS[platform as AdPlatform]}
                    </span>
                    <code className="text-neutral-500 bg-neutral-50 px-2 py-0.5 rounded">{platformId}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-4">
          {snapshots.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
              <BarChart3 className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="font-commons text-neutral-500">Henuz performans verisi yok</p>
              <p className="text-sm font-commons text-neutral-400 mt-1">
                Kampanya aktif olduktan sonra veriler otomatik toplanir
              </p>
            </div>
          ) : (
            <>
              {/* Performance Charts */}
              {snapshots.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  <SpendTrendChart data={aggregateByDate(snapshots)} height={220} />
                  <FunnelChart
                    impressions={aggregatedMetrics.impressions}
                    clicks={aggregatedMetrics.clicks}
                    conversions={aggregatedMetrics.conversions}
                  />
                </div>
              )}

              {/* Daily snapshots table */}
              <div className="bg-white rounded-xl border border-neutral-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50">
                      <tr>
                        {['Tarih', 'Platform', 'Harcama', 'Gosterim', 'Tiklama', 'CTR', 'Donusum', 'CPA', 'CPC'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-commons font-semibold text-neutral-500 uppercase">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {snapshots.slice(0, 30).map((snap, i) => (
                        <tr key={i} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 text-sm font-commons">{snap.date}</td>
                          <td className="px-4 py-3">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-commons ${PLATFORM_COLORS[snap.platform]}`}>
                              {snap.platform}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-commons">{snap.spend.toFixed(0)} TL</td>
                          <td className="px-4 py-3 text-sm font-commons">{snap.impressions.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm font-commons">{snap.clicks.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm font-commons">{snap.ctr.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-sm font-commons">{snap.conversions}</td>
                          <td className="px-4 py-3 text-sm font-commons">{snap.cpa.toFixed(0)} TL</td>
                          <td className="px-4 py-3 text-sm font-commons">{snap.cpc.toFixed(2)} TL</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'adsets' && (
        <div className="space-y-3">
          {campaign.adSets.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
              <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="font-commons text-neutral-500">Henuz reklam seti yok</p>
            </div>
          ) : (
            campaign.adSets.map((adSet, i) => (
              <div key={adSet.id || i} className="bg-white rounded-xl border border-neutral-200/50 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-commons ${PLATFORM_COLORS[adSet.platform]}`}>
                      {adSet.platform}
                    </span>
                    <h4 className="font-commons font-semibold text-[#171717]">{adSet.name}</h4>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-commons ${
                      adSet.status === 'active' ? 'bg-green-100 text-green-700' :
                      adSet.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {adSet.status}
                    </span>
                  </div>
                  <span className="text-sm font-commons text-neutral-500">
                    {adSet.budget.daily} TL/gun
                  </span>
                </div>
                <div className="text-sm font-commons text-neutral-500 space-y-1">
                  <p>Bid: {adSet.bidStrategy}{adSet.bidAmount ? ` (${adSet.bidAmount} TL)` : ''}</p>
                  <p>Tarih: {adSet.schedule.startDate}{adSet.schedule.endDate ? ` - ${adSet.schedule.endDate}` : ''}</p>
                </div>
                {/* Ads under this ad set */}
                {adSet.ads.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {adSet.ads.map((ad, ai) => (
                      <div key={ad.id || ai} className="bg-neutral-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Palette className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="text-sm font-commons font-semibold">{ad.name}</span>
                          <span className="text-xs font-commons text-neutral-400">({ad.type})</span>
                          {ad.variant && <span className="text-xs font-commons bg-indigo-50 text-indigo-600 px-1.5 rounded">{ad.variant}</span>}
                        </div>
                        <p className="text-sm font-commons text-neutral-600">{ad.creative.headline}</p>
                        <p className="text-xs font-commons text-neutral-400">{ad.creative.primaryText}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-4">
          {/* Add note */}
          <div className="bg-white rounded-xl border border-neutral-200/50 p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Not ekle..."
                className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 font-commons text-sm focus:outline-none focus:border-indigo-400"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button
                onClick={handleAddNote}
                disabled={addingNote || !noteText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Ekle
              </button>
            </div>
          </div>

          {/* Timeline events */}
          <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
            <div className="space-y-4">
              {[...(campaign.timeline || [])].reverse().map((event, i) => (
                <TimelineItem key={event.id || i} event={event} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'optimization' && campaign && (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
          <OptimizationPanel
            campaignId={campaign.id}
            onOptimizationApplied={async () => {
              if (id) {
                const updated = await getCampaign(id);
                setCampaign(updated);
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

// ============================================
// TIMELINE ITEM
// ============================================

const timelineIcons: Record<string, React.ElementType> = {
  created: Tag,
  status_change: Globe,
  approved: CheckCircle,
  rejected: AlertTriangle,
  revision_requested: MessageSquare,
  published: Globe,
  paused: Pause,
  resumed: Play,
  optimized: TrendingUp,
  completed: CheckCircle,
  note: MessageSquare,
  performance_alert: AlertTriangle,
};

const TimelineItem: React.FC<{ event: MarketingTimelineEvent }> = ({ event }) => {
  const Icon = timelineIcons[event.type] || Clock;
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
          <Icon className="w-4 h-4 text-neutral-500" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-commons font-semibold text-[#171717]">{event.title}</p>
        {event.description && (
          <p className="text-sm font-commons text-neutral-500">{event.description}</p>
        )}
        <p className="text-xs font-commons text-neutral-400 mt-1">
          {event.createdByName || event.createdBy} &middot; {event.createdAt?.toDate?.()?.toLocaleString('tr-TR') || ''}
        </p>
      </div>
    </div>
  );
};

export default CampaignDetailPage;
