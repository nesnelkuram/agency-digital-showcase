import React, { useEffect, useState } from 'react';
import {
  Wallet, DollarSign, TrendingUp, TrendingDown,
  PieChart, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  CampaignSummary,
  MarketingDashboardStats,
  AdPlatform,
} from '@/shared/types/marketing';
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
} from '@/shared/types/marketing';
import {
  getCampaigns,
  getMarketingStats,
} from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';

const BudgetPage: React.FC = () => {
  const { projectId, basePath, isProjectScoped } = useProjectScope();
  const [stats, setStats] = useState<MarketingDashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMarketingStats(projectId),
      getCampaigns(projectId ? { projectId } : undefined, 50),
    ]).then(([statsData, campData]) => {
      setStats(statsData);
      setCampaigns(campData.campaigns);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Compute totals
  const totalBudget = campaigns.reduce((s, c) => s + c.totalBudget, 0);
  const totalSpend = campaigns.reduce((s, c) => s + c.totalSpend, 0);
  const budgetRemaining = totalBudget - totalSpend;
  const utilizationRate = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;

  // Platform spend breakdown
  const platformSpendMap: Record<AdPlatform, number> = { meta: 0, google: 0, tiktok: 0, linkedin: 0, email: 0 };
  stats?.platformBreakdown.forEach(pb => {
    platformSpendMap[pb.platform] = pb.spend;
  });

  // Campaigns sorted by spend
  const sortedCampaigns = [...campaigns].sort((a, b) => b.totalSpend - a.totalSpend);

  return (
    <div className="space-y-6">
      {/* Header */}
      {isProjectScoped && projectId && <ProjectBreadcrumb projectId={projectId} currentPage="Butce" />}
      <div>
        <h1 className="text-2xl font-commons font-bold text-[#171717]">Butce Yonetimi</h1>
        <p className="text-sm font-commons text-neutral-500 mt-1">
          Kampanya butce dagilimi ve harcama takibi
        </p>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200/50 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-xs font-commons text-neutral-500">Toplam Butce</p>
          <p className="text-xl font-commons font-bold text-[#171717]">{totalBudget.toLocaleString()} TL</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200/50 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-xs font-commons text-neutral-500">Toplam Harcama</p>
          <p className="text-xl font-commons font-bold text-[#171717]">{totalSpend.toLocaleString()} TL</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200/50 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-xs font-commons text-neutral-500">Kalan Butce</p>
          <p className="text-xl font-commons font-bold text-[#171717]">{budgetRemaining.toLocaleString()} TL</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200/50 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              utilizationRate > 90 ? 'bg-red-50' : utilizationRate > 70 ? 'bg-amber-50' : 'bg-emerald-50'
            }`}>
              <PieChart className={`w-5 h-5 ${
                utilizationRate > 90 ? 'text-red-600' : utilizationRate > 70 ? 'text-amber-600' : 'text-emerald-600'
              }`} />
            </div>
          </div>
          <p className="text-xs font-commons text-neutral-500">Kullanim Orani</p>
          <p className="text-xl font-commons font-bold text-[#171717]">{utilizationRate.toFixed(1)}%</p>
          <div className="mt-2 w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                utilizationRate > 90 ? 'bg-red-500' : utilizationRate > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(utilizationRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Platform Budget Distribution */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
        <h2 className="text-lg font-commons font-semibold text-[#171717] mb-4">
          Platform Butce Dagilimi
        </h2>
        <div className="space-y-3">
          {(Object.entries(platformSpendMap) as [AdPlatform, number][])
            .filter(([, spend]) => spend > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([platform, spend]) => {
              const share = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;
              return (
                <div key={platform} className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-commons w-40 text-center ${PLATFORM_COLORS[platform]}`}>
                    {PLATFORM_LABELS[platform]}
                  </span>
                  <div className="flex-1">
                    <div className="w-full h-3 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-32 text-right">
                    <span className="text-sm font-commons font-semibold text-[#171717]">
                      {spend.toLocaleString()} TL
                    </span>
                    <span className="text-xs font-commons text-neutral-400 ml-2">
                      ({share.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          {totalSpend === 0 && (
            <p className="text-sm font-commons text-neutral-400 text-center py-4">
              Henuz harcama verisi yok
            </p>
          )}
        </div>
      </div>

      {/* Campaign Budget Table */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
        <h2 className="text-lg font-commons font-semibold text-[#171717] mb-4">
          Kampanya Bazli Butce
        </h2>
        {sortedCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm font-commons text-neutral-500">Kampanya bulunmuyor</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  {['Kampanya', 'Durum', 'Butce', 'Harcama', 'Kalan', 'Kullanim', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-commons font-semibold text-neutral-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedCampaigns.map((camp) => {
                  const remaining = camp.totalBudget - camp.totalSpend;
                  const util = camp.totalBudget > 0 ? (camp.totalSpend / camp.totalBudget) * 100 : 0;
                  return (
                    <tr key={camp.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-commons font-semibold text-[#171717]">{camp.name}</p>
                          <div className="flex gap-1 mt-0.5">
                            {camp.platforms.map(p => (
                              <span key={p} className={`px-1 py-0.5 rounded text-[10px] font-commons ${PLATFORM_COLORS[p]}`}>{p}</span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-commons ${CAMPAIGN_STATUS_COLORS[camp.status]}`}>
                          {CAMPAIGN_STATUS_LABELS[camp.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-commons font-semibold">{camp.totalBudget.toLocaleString()} TL</td>
                      <td className="px-4 py-3 text-sm font-commons">{camp.totalSpend.toLocaleString()} TL</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-commons ${remaining < 0 ? 'text-red-600 font-semibold' : 'text-neutral-600'}`}>
                          {remaining.toLocaleString()} TL
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                util > 90 ? 'bg-red-500' : util > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(util, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-commons text-neutral-500">{util.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`${basePath}/campaigns/${camp.id}`}
                          className="text-indigo-600 hover:underline text-sm font-commons"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Budget Alerts */}
      {sortedCampaigns.some(c => c.totalBudget > 0 && (c.totalSpend / c.totalBudget) > 0.85) && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-commons font-semibold text-amber-800">Butce Uyarilari</h3>
          </div>
          <div className="space-y-2">
            {sortedCampaigns
              .filter(c => c.totalBudget > 0 && (c.totalSpend / c.totalBudget) > 0.85)
              .map(c => (
                <p key={c.id} className="text-sm font-commons text-amber-700">
                  <strong>{c.name}</strong> kampanyasi butcesinin{' '}
                  {((c.totalSpend / c.totalBudget) * 100).toFixed(0)}%'ini kullanmis durumda.
                </p>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetPage;
