import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, TrendingUp, Target, Search,
  ArrowUpRight, ArrowDownRight, DollarSign, Eye,
  ChevronUp, ChevronDown, AlertTriangle, Trophy,
} from 'lucide-react';
import { getProjects } from '@/shared/services/projectService';
import { getCampaigns } from '@/shared/services/marketingService';
import type { CampaignSummary, AdPlatform } from '@/shared/types/marketing';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/shared/types/marketing';
import type { ProjectSummary } from '@/shared/types/project';

// ============================================
// YARDIMCI FONKSIYONLAR
// ============================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('tr-TR');
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M TL`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K TL`;
  return `${n.toLocaleString('tr-TR')} TL`;
}

function getRoasColor(roas: number): string {
  if (roas >= 3.0) return 'text-emerald-600';
  if (roas >= 1.0) return 'text-amber-600';
  return 'text-red-600';
}

function getRoasBg(roas: number): string {
  if (roas >= 3.0) return 'bg-emerald-50';
  if (roas >= 1.0) return 'bg-amber-50';
  return 'bg-red-50';
}

// Platform bar chart colors (Tailwind background classes)
const PLATFORM_BAR_COLORS: Record<AdPlatform, string> = {
  meta: 'bg-blue-500',
  google: 'bg-red-500',
  tiktok: 'bg-pink-500',
  linkedin: 'bg-sky-500',
  email: 'bg-emerald-500',
};

// ============================================
// TIPLER
// ============================================

type PeriodKey = 'week' | 'month' | 'thisMonth' | 'quarter';

interface PeriodOption {
  key: PeriodKey;
  label: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: 'week', label: 'Son 7 Gun' },
  { key: 'month', label: 'Son 30 Gun' },
  { key: 'thisMonth', label: 'Bu Ay' },
  { key: 'quarter', label: 'Son 3 Ay' },
];

type SortKey = 'name' | 'activeCampaigns' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'conversions' | 'cpa' | 'roas';

interface ClientData {
  projectId: string;
  projectName: string;
  campaigns: CampaignSummary[];
  activeCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCTR: number;
  avgCPA: number;
  avgROAS: number;
  platformSpend: Partial<Record<AdPlatform, number>>;
}

interface CampaignWithClient {
  campaign: CampaignSummary;
  clientName: string;
}

// ============================================
// ANA COMPONENT
// ============================================

const MultiClientDashboard: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [clientData, setClientData] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ============================================
  // VERI YUKLEME
  // ============================================

  useEffect(() => {
    loadAllData();
  }, [period]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Tum projeleri getir
      const { projects: allProjects } = await getProjects(undefined, 100);
      setProjects(allProjects);

      // 2. Her proje icin kampanyalari getir
      const allClientData: ClientData[] = [];

      await Promise.all(
        allProjects.map(async (project) => {
          try {
            const { campaigns } = await getCampaigns({ projectId: project.id }, 100);

            // Performans verilerini topla
            let totalSpend = 0;
            let totalImpressions = 0;
            let totalClicks = 0;
            let totalConversions = 0;
            let roasSum = 0;
            let roasCount = 0;
            let activeCampaigns = 0;
            const platformSpend: Partial<Record<AdPlatform, number>> = {};

            campaigns.forEach((c) => {
              if (c.status === 'active') activeCampaigns++;
              totalSpend += c.totalSpend || 0;

              if (c.performance) {
                totalImpressions += c.performance.impressions || 0;
                totalClicks += c.performance.clicks || 0;
                totalConversions += c.performance.conversions || 0;

                if (c.performance.roas > 0) {
                  roasSum += c.performance.roas;
                  roasCount++;
                }
              }

              // Platform bazli harcama tahmini
              c.platforms?.forEach((platform) => {
                const share = c.totalSpend / (c.platforms?.length || 1);
                platformSpend[platform] = (platformSpend[platform] || 0) + share;
              });
            });

            const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
            const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
            const avgROAS = roasCount > 0 ? roasSum / roasCount : 0;

            allClientData.push({
              projectId: project.id,
              projectName: project.name,
              campaigns,
              activeCampaigns,
              totalSpend,
              totalImpressions,
              totalClicks,
              totalConversions,
              avgCTR,
              avgCPA,
              avgROAS,
              platformSpend,
            });
          } catch (err) {
            console.error(`Failed to load campaigns for project ${project.id}:`, err);
          }
        })
      );

      setClientData(allClientData);
    } catch (err) {
      console.error('Failed to load multi-client data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HESAPLANMIS DEGERLER
  // ============================================

  // Filtrelenmis ve siralanmis musteri verileri
  const filteredClients = useMemo(() => {
    let filtered = clientData;

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      filtered = filtered.filter((c) =>
        c.projectName.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortBy) {
        case 'name':
          aVal = a.projectName.toLowerCase();
          bVal = b.projectName.toLowerCase();
          return sortDir === 'asc'
            ? (aVal as string).localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal as string);
        case 'activeCampaigns':
          aVal = a.activeCampaigns;
          bVal = b.activeCampaigns;
          break;
        case 'spend':
          aVal = a.totalSpend;
          bVal = b.totalSpend;
          break;
        case 'impressions':
          aVal = a.totalImpressions;
          bVal = b.totalImpressions;
          break;
        case 'clicks':
          aVal = a.totalClicks;
          bVal = b.totalClicks;
          break;
        case 'ctr':
          aVal = a.avgCTR;
          bVal = b.avgCTR;
          break;
        case 'conversions':
          aVal = a.totalConversions;
          bVal = b.totalConversions;
          break;
        case 'cpa':
          aVal = a.avgCPA;
          bVal = b.avgCPA;
          break;
        case 'roas':
          aVal = a.avgROAS;
          bVal = b.avgROAS;
          break;
      }

      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [clientData, searchQuery, sortBy, sortDir]);

  // Toplam KPI degerleri
  const aggregateKPIs = useMemo(() => {
    const totalSpend = clientData.reduce((sum, c) => sum + c.totalSpend, 0);
    const totalImpressions = clientData.reduce((sum, c) => sum + c.totalImpressions, 0);
    const activeCampaigns = clientData.reduce((sum, c) => sum + c.activeCampaigns, 0);

    const roasValues = clientData.filter((c) => c.avgROAS > 0).map((c) => c.avgROAS);
    const avgROAS = roasValues.length > 0
      ? roasValues.reduce((sum, r) => sum + r, 0) / roasValues.length
      : 0;

    return { totalSpend, totalImpressions, avgROAS, activeCampaigns };
  }, [clientData]);

  // En iyi ve en kotu performansli kampanyalar
  const topPerformers = useMemo((): CampaignWithClient[] => {
    const all: CampaignWithClient[] = [];
    clientData.forEach((client) => {
      client.campaigns.forEach((campaign) => {
        if (campaign.performance && campaign.performance.roas > 0) {
          all.push({ campaign, clientName: client.projectName });
        }
      });
    });
    all.sort((a, b) => (b.campaign.performance?.roas || 0) - (a.campaign.performance?.roas || 0));
    return all.slice(0, 3);
  }, [clientData]);

  const needsAttention = useMemo((): CampaignWithClient[] => {
    const all: CampaignWithClient[] = [];
    clientData.forEach((client) => {
      client.campaigns.forEach((campaign) => {
        if (campaign.performance && campaign.status === 'active') {
          const ctr = campaign.performance.impressions > 0
            ? (campaign.performance.clicks / campaign.performance.impressions) * 100
            : 0;
          all.push({ campaign, clientName: client.projectName });
        }
      });
    });

    // CTR'ye gore sirala (en dusuk basta)
    all.sort((a, b) => {
      const aCTR = a.campaign.performance?.impressions
        ? (a.campaign.performance.clicks / a.campaign.performance.impressions) * 100
        : 0;
      const bCTR = b.campaign.performance?.impressions
        ? (b.campaign.performance.clicks / b.campaign.performance.impressions) * 100
        : 0;
      return aCTR - bCTR;
    });

    return all.slice(0, 3);
  }, [clientData]);

  // ============================================
  // SIRALAMA HANDLER
  // ============================================

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const SortIcon: React.FC<{ column: SortKey }> = ({ column }) => {
    if (sortBy !== column) {
      return <ChevronDown className="w-3 h-3 text-neutral-300" />;
    }
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-indigo-600" />
      : <ChevronDown className="w-3 h-3 text-indigo-600" />;
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-commons text-neutral-500 mt-3">
            Musteri verileri yukleniyor...
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* ========== HEADER ========== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">
            Musteri Genel Gorunumu
          </h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Tum musterilerin reklam performansi
          </p>
        </div>

        {/* Donem secici */}
        <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-commons font-medium transition-colors ${
                period === opt.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========== AGGREGATE KPI BAR ========== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Harcama */}
        <div className="bg-white rounded-xl border border-neutral-200/50 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-commons text-neutral-500">Toplam Harcama</p>
              <p className="text-lg font-commons font-bold text-[#171717] truncate">
                {formatCurrency(aggregateKPIs.totalSpend)}
              </p>
            </div>
          </div>
        </div>

        {/* Toplam Gosterim */}
        <div className="bg-white rounded-xl border border-neutral-200/50 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-commons text-neutral-500">Toplam Gosterim</p>
              <p className="text-lg font-commons font-bold text-[#171717] truncate">
                {formatNumber(aggregateKPIs.totalImpressions)}
              </p>
            </div>
          </div>
        </div>

        {/* Ortalama ROAS */}
        <div className="bg-white rounded-xl border border-neutral-200/50 p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${getRoasBg(aggregateKPIs.avgROAS)} rounded-lg flex items-center justify-center`}>
              <TrendingUp className={`w-5 h-5 ${getRoasColor(aggregateKPIs.avgROAS)}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-commons text-neutral-500">Ortalama ROAS</p>
              <p className={`text-lg font-commons font-bold ${getRoasColor(aggregateKPIs.avgROAS)}`}>
                {aggregateKPIs.avgROAS.toFixed(1)}x
              </p>
            </div>
          </div>
        </div>

        {/* Aktif Kampanya Sayisi */}
        <div className="bg-white rounded-xl border border-neutral-200/50 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-commons text-neutral-500">Aktif Kampanya Sayisi</p>
              <p className="text-lg font-commons font-bold text-[#171717]">
                {aggregateKPIs.activeCampaigns}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========== CLIENT PERFORMANCE TABLE ========== */}
      <div className="bg-white rounded-xl border border-neutral-200/50">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-neutral-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-commons font-semibold text-[#171717]">
                Musteri Performansi
              </h2>
              <span className="text-xs font-commons text-neutral-400 ml-1">
                ({filteredClients.length} musteri)
              </span>
            </div>

            {/* Arama */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Musteri ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-commons text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100">
                {[
                  { key: 'name' as SortKey, label: 'Musteri' },
                  { key: 'activeCampaigns' as SortKey, label: 'Aktif Kampanya' },
                  { key: 'spend' as SortKey, label: 'Harcama' },
                  { key: 'impressions' as SortKey, label: 'Gosterim' },
                  { key: 'clicks' as SortKey, label: 'Tiklama' },
                  { key: 'ctr' as SortKey, label: 'CTR' },
                  { key: 'conversions' as SortKey, label: 'Donusum' },
                  { key: 'cpa' as SortKey, label: 'CPA' },
                  { key: 'roas' as SortKey, label: 'ROAS' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-4 py-3 text-left text-xs font-commons font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon column={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <BarChart3 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                    <p className="text-sm font-commons text-neutral-500">
                      {searchQuery ? 'Aramayla eslesen musteri bulunamadi' : 'Henuz musteri verisi yok'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr
                    key={client.projectId}
                    onClick={() => navigate(`/admin/projects/${client.projectId}/marketing`)}
                    className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                          <span className="text-xs font-commons font-bold text-indigo-600">
                            {client.projectName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-commons font-medium text-[#171717] truncate max-w-[160px]">
                          {client.projectName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-commons text-neutral-700">
                        {client.activeCampaigns}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-commons font-medium text-[#171717]">
                        {formatCurrency(client.totalSpend)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-commons text-neutral-700">
                        {formatNumber(client.totalImpressions)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-commons text-neutral-700">
                        {formatNumber(client.totalClicks)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-commons text-neutral-700">
                        %{client.avgCTR.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-commons text-neutral-700">
                        {formatNumber(client.totalConversions)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-commons text-neutral-700">
                        {client.avgCPA > 0 ? formatCurrency(client.avgCPA) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-commons font-semibold ${getRoasBg(client.avgROAS)} ${getRoasColor(client.avgROAS)}`}>
                        {client.avgROAS > 0 ? `${client.avgROAS.toFixed(1)}x` : '-'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== PLATFORM DISTRIBUTION SECTION ========== */}
      {clientData.some((c) => c.totalSpend > 0) && (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-commons font-semibold text-[#171717]">
              Platform Dagilimi
            </h2>
          </div>

          {/* Platform legend */}
          <div className="flex flex-wrap items-center gap-4 mb-5">
            {(['meta', 'google', 'tiktok', 'linkedin'] as AdPlatform[]).map((platform) => (
              <div key={platform} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-sm ${PLATFORM_BAR_COLORS[platform]}`} />
                <span className="text-xs font-commons text-neutral-600">
                  {PLATFORM_LABELS[platform]}
                </span>
              </div>
            ))}
          </div>

          {/* Horizontal bar chart */}
          <div className="space-y-3">
            {filteredClients
              .filter((c) => c.totalSpend > 0)
              .map((client) => {
                const platforms = (['meta', 'google', 'tiktok', 'linkedin'] as AdPlatform[]);
                const totalClientSpend = client.totalSpend || 1;

                return (
                  <div key={client.projectId} className="flex items-center gap-3">
                    {/* Musteri adi */}
                    <div className="w-32 sm:w-40 shrink-0 text-right">
                      <span className="text-xs font-commons font-medium text-neutral-700 truncate block">
                        {client.projectName}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 flex items-center h-7 bg-neutral-100 rounded-lg overflow-hidden">
                      {platforms.map((platform) => {
                        const spend = client.platformSpend[platform] || 0;
                        const percentage = (spend / totalClientSpend) * 100;
                        if (percentage <= 0) return null;

                        return (
                          <div
                            key={platform}
                            className={`${PLATFORM_BAR_COLORS[platform]} h-full transition-all duration-300 relative group`}
                            style={{ width: `${percentage}%`, minWidth: percentage > 0 ? '2px' : '0px' }}
                          >
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-neutral-800 text-white text-[10px] font-commons rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {PLATFORM_LABELS[platform]}: {formatCurrency(spend)} (%{percentage.toFixed(0)})
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Toplam */}
                    <div className="w-20 shrink-0 text-right">
                      <span className="text-xs font-commons text-neutral-500">
                        {formatCurrency(client.totalSpend)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Hicbir musteride harcama yoksa */}
          {filteredClients.filter((c) => c.totalSpend > 0).length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm font-commons text-neutral-500">
                Gosterilecek harcama verisi bulunamadi
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========== TOP / BOTTOM PERFORMERS ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* En Iyi Performans */}
        <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Trophy className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-commons font-semibold text-[#171717]">
                En Iyi Performans
              </h3>
              <p className="text-xs font-commons text-neutral-400">
                ROAS'a gore en basarili 3 kampanya
              </p>
            </div>
          </div>

          {topPerformers.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm font-commons text-neutral-400">
                Performans verisi olan kampanya bulunamadi
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {topPerformers.map((item, idx) => {
                const roas = item.campaign.performance?.roas || 0;
                return (
                  <div
                    key={item.campaign.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-100/50"
                  >
                    {/* Siralama */}
                    <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-commons font-bold text-emerald-700">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Kampanya bilgisi */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-commons font-medium text-[#171717] truncate">
                        {item.campaign.name}
                      </p>
                      <p className="text-xs font-commons text-neutral-500 truncate">
                        {item.clientName}
                      </p>
                    </div>

                    {/* Platform badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.campaign.platforms?.slice(0, 1).map((platform) => (
                        <span
                          key={platform}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-commons font-medium ${PLATFORM_COLORS[platform]}`}
                        >
                          {PLATFORM_LABELS[platform].split(' ')[0]}
                        </span>
                      ))}
                    </div>

                    {/* ROAS */}
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-sm font-commons font-bold text-emerald-600">
                          {roas.toFixed(1)}x
                        </span>
                      </div>
                      <p className="text-[10px] font-commons text-neutral-400">ROAS</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dikkat Gerektiren */}
        <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-commons font-semibold text-[#171717]">
                Dikkat Gerektiren
              </h3>
              <p className="text-xs font-commons text-neutral-400">
                CTR'ye gore en dusuk performansli 3 kampanya
              </p>
            </div>
          </div>

          {needsAttention.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm font-commons text-neutral-400">
                Aktif kampanya bulunamadi
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {needsAttention.map((item, idx) => {
                const ctr = item.campaign.performance?.impressions
                  ? (item.campaign.performance.clicks / item.campaign.performance.impressions) * 100
                  : 0;
                return (
                  <div
                    key={item.campaign.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/50 border border-amber-100/50"
                  >
                    {/* Siralama */}
                    <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-commons font-bold text-amber-700">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Kampanya bilgisi */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-commons font-medium text-[#171717] truncate">
                        {item.campaign.name}
                      </p>
                      <p className="text-xs font-commons text-neutral-500 truncate">
                        {item.clientName}
                      </p>
                    </div>

                    {/* Platform badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.campaign.platforms?.slice(0, 1).map((platform) => (
                        <span
                          key={platform}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-commons font-medium ${PLATFORM_COLORS[platform]}`}
                        >
                          {PLATFORM_LABELS[platform].split(' ')[0]}
                        </span>
                      ))}
                    </div>

                    {/* CTR */}
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1">
                        <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-sm font-commons font-bold text-red-500">
                          %{ctr.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[10px] font-commons text-neutral-400">CTR</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========== EMPTY STATE ========== */}
      {clientData.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <Users className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-commons font-semibold text-[#171717] mb-2">
            Henuz musteri verisi yok
          </h3>
          <p className="text-sm font-commons text-neutral-500 max-w-md mx-auto">
            Projelerinize kampanya ekledikten sonra tum musterilerin performansi burada goruntulenecektir.
          </p>
        </div>
      )}
    </div>
  );
};

export default MultiClientDashboard;
