import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Eye, MousePointer, Target,
  DollarSign, Megaphone, Zap, ArrowRight, Clock,
} from 'lucide-react';
import type { MarketingDashboardStats, AdPlatform } from '@/shared/types/marketing';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/shared/types/marketing';
import { getMarketingStats } from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';

const MarketingDashboard: React.FC = () => {
  const { projectId, basePath, isProjectScoped } = useProjectScope();
  const [stats, setStats] = useState<MarketingDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMarketingStats(projectId)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpis = stats ? [
    { label: 'Aktif Kampanyalar', value: stats.activeCampaigns, icon: Megaphone, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Bekleyen Oneriler', value: stats.pendingProposals, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Toplam Harcama', value: `${(stats.totalSpend / 1000).toFixed(1)}K TL`, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Toplam Gosterim', value: `${(stats.totalImpressions / 1000).toFixed(0)}K`, icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Toplam Tiklama', value: stats.totalClicks.toLocaleString(), icon: MousePointer, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Toplam Donusum', value: stats.totalConversions.toLocaleString(), icon: Target, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Ortalama ROAS', value: `${stats.averageROAS.toFixed(1)}x`, icon: stats.averageROAS >= 2 ? TrendingUp : TrendingDown, color: stats.averageROAS >= 2 ? 'text-emerald-600' : 'text-red-600', bg: stats.averageROAS >= 2 ? 'bg-emerald-50' : 'bg-red-50' },
    { label: 'Bagli Platform', value: stats.connectedPlatforms.length, icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      {isProjectScoped && projectId && <ProjectBreadcrumb projectId={projectId} currentPage="Pazarlama" />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">
            Pazarlama Dashboard
          </h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Dijital reklam kampanyalariniz ve AI onerileri
          </p>
        </div>
        <Link
          to={`${basePath}/proposals`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm"
        >
          AI Onerisi Olustur
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl border border-neutral-200/50 p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${kpi.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xs font-commons text-neutral-500">{kpi.label}</p>
                  <p className="text-lg font-commons font-bold text-[#171717]">{kpi.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Platform Breakdown */}
      {stats && stats.platformBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
          <h2 className="text-lg font-commons font-semibold text-[#171717] mb-4">
            Platform Performansi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {stats.platformBreakdown.map((pb) => (
              <div key={pb.platform} className="border border-neutral-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-commons ${PLATFORM_COLORS[pb.platform]}`}>
                    {PLATFORM_LABELS[pb.platform]}
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-commons text-neutral-500">Kampanyalar</p>
                    <p className="text-sm font-commons font-semibold">{pb.campaigns}</p>
                  </div>
                  <div>
                    <p className="text-xs font-commons text-neutral-500">Harcama</p>
                    <p className="text-sm font-commons font-semibold">{pb.spend.toLocaleString()} TL</p>
                  </div>
                  <div>
                    <p className="text-xs font-commons text-neutral-500">Donusumler</p>
                    <p className="text-sm font-commons font-semibold">{pb.conversions}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to={`${basePath}/campaigns`}
          className="bg-white rounded-xl border border-neutral-200/50 p-6 hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <Megaphone className="w-8 h-8 text-indigo-600 mb-3" />
          <h3 className="font-commons font-semibold text-[#171717]">Kampanyalar</h3>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Tum kampanyalarinizi goruntuleyip yonetin
          </p>
        </Link>

        <Link
          to={`${basePath}/platforms`}
          className="bg-white rounded-xl border border-neutral-200/50 p-6 hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <Zap className="w-8 h-8 text-amber-600 mb-3" />
          <h3 className="font-commons font-semibold text-[#171717]">Platform Baglantilari</h3>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Reklam hesaplarinizi baglayin ve yonetin
          </p>
        </Link>

        <Link
          to={`${basePath}/performance`}
          className="bg-white rounded-xl border border-neutral-200/50 p-6 hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <TrendingUp className="w-8 h-8 text-emerald-600 mb-3" />
          <h3 className="font-commons font-semibold text-[#171717]">Performans Raporlari</h3>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Cross-platform performans analizleri
          </p>
        </Link>
      </div>

      {/* Empty State */}
      {stats && stats.totalCampaigns === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <Megaphone className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-commons font-semibold text-[#171717] mb-2">
            Henuz kampanya yok
          </h3>
          <p className="text-sm font-commons text-neutral-500 mb-6 max-w-md mx-auto">
            Bir lead'in marka analizini kullanarak AI destekli kampanya onerisi olusturabilirsiniz.
            Oneriler onaylandiktan sonra otomatik olarak bagli platformlara gonderilir.
          </p>
          <Link
            to="/admin/leads"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm"
          >
            Basvurulara Git
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
};

export default MarketingDashboard;
