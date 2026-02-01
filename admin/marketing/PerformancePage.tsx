import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Eye, MousePointer, Target,
  DollarSign, BarChart3, RefreshCw, Calendar,
} from 'lucide-react';
import type {
  CampaignSummary,
  MarketingDashboardStats,
  AdPlatform,
} from '@/shared/types/marketing';
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from '@/shared/types/marketing';
import {
  getCampaigns,
  getMarketingStats,
  syncCampaignsFromMeta,
  getPlatformAccounts,
  savePerformanceSnapshot,
} from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';

const PerformancePage: React.FC = () => {
  const { projectId, basePath, isProjectScoped } = useProjectScope();
  const [stats, setStats] = useState<MarketingDashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, campData] = await Promise.all([
        getMarketingStats(projectId),
        getCampaigns({ status: ['active'], projectId }),
      ]);
      setStats(statsData);
      setCampaigns(campData.campaigns);
    } catch (err) {
      console.error('Failed to load performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerOptimize = async () => {
    setOptimizing(true);
    try {
      const res = await fetch('/api/marketing/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    } catch (err) {
      console.error('Optimization trigger failed:', err);
    } finally {
      setOptimizing(false);
    }
  };

  const triggerSync = async () => {
    if (!projectId) return;
    setSyncing(true);
    setSyncMessage('Kampanyalar senkronize ediliyor...');
    try {
      // 1. Sync campaigns from Meta (includes aggregated performance)
      const campResult = await syncCampaignsFromMeta(projectId);
      if (campResult.error) {
        setSyncMessage(`Hata: ${campResult.error}`);
        return;
      }

      setSyncMessage(`${campResult.synced} kampanya senkronize edildi. Gunluk veriler aliniyor...`);

      // 2. Sync daily performance snapshots
      const accounts = await getPlatformAccounts(projectId);
      const metaAccount = accounts.find(a => a.platform === 'meta' && a.status === 'connected');
      if (metaAccount?.metadata?.accessToken) {
        // Get campaigns that have Meta IDs
        const { campaigns: allCamps } = await getCampaigns({ projectId });
        const metaCampaigns = allCamps.filter(c => c.platforms.includes('meta'));

        if (metaCampaigns.length > 0) {
          const perfRes = await fetch('/api/marketing/sync-performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: metaAccount.metadata.accessToken,
              campaigns: metaCampaigns.map(c => ({
                id: c.id,
                metaCampaignId: (c as any).platformCampaignIds?.meta || c.id,
              })),
            }),
          });

          const perfData = await perfRes.json();
          if (perfData.success && perfData.snapshots) {
            for (const snap of perfData.snapshots) {
              await savePerformanceSnapshot(snap);
            }
            setSyncMessage(`Tamamlandi! ${campResult.synced} kampanya, ${perfData.snapshotsCount} gunluk veri`);
          }
        }
      }

      // Reload dashboard data
      await loadData();
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err: any) {
      console.error('Sync failed:', err);
      setSyncMessage(`Senkronizasyon hatasi: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {isProjectScoped && projectId && <ProjectBreadcrumb projectId={projectId} currentPage="Performans" />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">Performans Raporlari</h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Cross-platform kampanya performans analizi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={triggerSync}
            disabled={syncing || !projectId}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-commons text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Senkronize Ediliyor...' : 'Verileri Guncelle'}
          </button>
          <button
            onClick={triggerOptimize}
            disabled={optimizing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${optimizing ? 'animate-spin' : ''}`} />
            AI Optimizasyon
          </button>
        </div>
      </div>

      {/* Sync status message */}
      {syncMessage && (
        <div className={`rounded-lg px-4 py-3 text-sm font-commons flex items-center gap-2 ${
          syncMessage.startsWith('Hata') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {syncing && <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />}
          {syncMessage}
        </div>
      )}

      {/* Main KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Toplam Harcama"
            value={`${(stats.totalSpend / 1000).toFixed(1)}K TL`}
            icon={DollarSign}
            color="text-blue-600"
            bg="bg-blue-50"
          />
          <KPICard
            label="Toplam Gosterim"
            value={stats.totalImpressions > 1_000_000
              ? `${(stats.totalImpressions / 1_000_000).toFixed(1)}M`
              : `${(stats.totalImpressions / 1000).toFixed(0)}K`
            }
            icon={Eye}
            color="text-purple-600"
            bg="bg-purple-50"
          />
          <KPICard
            label="Toplam Donusum"
            value={stats.totalConversions.toLocaleString()}
            icon={Target}
            color="text-green-600"
            bg="bg-green-50"
          />
          <KPICard
            label="Ortalama ROAS"
            value={`${stats.averageROAS.toFixed(1)}x`}
            icon={stats.averageROAS >= 2 ? TrendingUp : TrendingDown}
            color={stats.averageROAS >= 2 ? 'text-emerald-600' : 'text-red-600'}
            bg={stats.averageROAS >= 2 ? 'bg-emerald-50' : 'bg-red-50'}
          />
        </div>
      )}

      {/* Platform Comparison */}
      {stats && stats.platformBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
          <h2 className="text-lg font-commons font-semibold text-[#171717] mb-4">
            Platform Karsilastirmasi
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  {['Platform', 'Kampanya', 'Harcama', 'Donusum', 'CPA', 'Oran'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-commons font-semibold text-neutral-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {stats.platformBreakdown
                  .filter(pb => pb.campaigns > 0)
                  .sort((a, b) => b.spend - a.spend)
                  .map((pb) => {
                    const cpa = pb.conversions > 0 ? pb.spend / pb.conversions : 0;
                    const spendShare = stats.totalSpend > 0 ? (pb.spend / stats.totalSpend) * 100 : 0;
                    return (
                      <tr key={pb.platform} className="hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-commons ${PLATFORM_COLORS[pb.platform]}`}>
                            {PLATFORM_LABELS[pb.platform]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-commons">{pb.campaigns}</td>
                        <td className="px-4 py-3 text-sm font-commons font-semibold">{pb.spend.toLocaleString()} TL</td>
                        <td className="px-4 py-3 text-sm font-commons">{pb.conversions}</td>
                        <td className="px-4 py-3 text-sm font-commons">{cpa > 0 ? `${cpa.toFixed(0)} TL` : '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${spendShare}%` }}
                              />
                            </div>
                            <span className="text-xs font-commons text-neutral-500">{spendShare.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Campaign Performance */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
        <h2 className="text-lg font-commons font-semibold text-[#171717] mb-4">
          Aktif Kampanyalar
        </h2>
        {campaigns.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm font-commons text-neutral-500">Aktif kampanya bulunmuyor</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((camp) => (
              <div key={camp.id} className="flex items-center justify-between border border-neutral-100 rounded-lg p-4 hover:bg-neutral-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-commons font-semibold text-[#171717]">{camp.name}</span>
                    <div className="flex gap-1">
                      {camp.platforms.map(p => (
                        <span key={p} className={`px-1 py-0.5 rounded text-[10px] font-commons ${PLATFORM_COLORS[p]}`}>{p}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-commons text-neutral-500">
                    Butce: {camp.totalBudget.toLocaleString()} TL | Harcama: {camp.totalSpend.toLocaleString()} TL
                  </p>
                </div>
                {camp.performance && (
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs font-commons text-neutral-400">Gosterim</p>
                      <p className="text-sm font-commons font-semibold">{(camp.performance.impressions / 1000).toFixed(0)}K</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-commons text-neutral-400">Tiklama</p>
                      <p className="text-sm font-commons font-semibold">{camp.performance.clicks.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-commons text-neutral-400">Donusum</p>
                      <p className="text-sm font-commons font-semibold">{camp.performance.conversions}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-commons text-neutral-400">ROAS</p>
                      <p className={`text-sm font-commons font-semibold ${
                        camp.performance.roas >= 2 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {camp.performance.roas.toFixed(1)}x
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {stats && stats.totalCampaigns === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-commons font-semibold text-[#171717] mb-2">
            Performans verisi yok
          </h3>
          <p className="text-sm font-commons text-neutral-500 max-w-md mx-auto">
            Aktif kampanyalariniz olustuktan sonra performans verileri burada goruntulenir.
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================
// KPI CARD
// ============================================

interface KPICardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, icon: Icon, color, bg }) => (
  <div className="bg-white rounded-xl border border-neutral-200/50 p-4">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs font-commons text-neutral-500">{label}</p>
        <p className="text-lg font-commons font-bold text-[#171717]">{value}</p>
      </div>
    </div>
  </div>
);

export default PerformancePage;
