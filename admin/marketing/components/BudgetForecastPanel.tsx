import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Calendar,
  DollarSign,
  BarChart3,
  Clock,
  ChevronRight,
  Wallet,
  Activity,
} from 'lucide-react';
import type { BudgetForecast, BudgetForecastSummary, ForecastStatus } from '@/shared/types/budgetForecast';
import { FORECAST_STATUS_LABELS, FORECAST_STATUS_COLORS } from '@/shared/types/budgetForecast';
import { getForecasts, getForecastSummary } from '@/shared/services/budgetForecastService';

// ============================================
// PROPS
// ============================================

interface BudgetForecastPanelProps {
  projectId?: string;
  compact?: boolean;
}

// ============================================
// YARDIMCI FONKSIYONLAR
// ============================================

function formatCurrency(amount: number, decimals: number = 0): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '-';
  try {
    return new Date(isoDate).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

function getStatusDotColor(status: ForecastStatus): string {
  switch (status) {
    case 'current':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-amber-500';
    case 'critical':
      return 'bg-red-500';
    case 'depleted':
      return 'bg-neutral-400';
    default:
      return 'bg-neutral-400';
  }
}

function getProgressBarColor(status: ForecastStatus): string {
  switch (status) {
    case 'current':
      return 'bg-indigo-500';
    case 'warning':
      return 'bg-amber-500';
    case 'critical':
      return 'bg-red-500';
    case 'depleted':
      return 'bg-neutral-400';
    default:
      return 'bg-indigo-500';
  }
}

function getDaysRemainingBadge(days: number, status: ForecastStatus): string {
  switch (status) {
    case 'current':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'warning':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'critical':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'depleted':
      return 'bg-neutral-50 text-neutral-500 border-neutral-200';
    default:
      return 'bg-neutral-50 text-neutral-600 border-neutral-200';
  }
}

// ============================================
// MINI BURNDOWN CHART (CSS)
// ============================================

const BurndownMiniChart: React.FC<{ data: BudgetForecast['burndownData']; totalBudget: number }> = ({
  data,
  totalBudget,
}) => {
  if (!data || data.length === 0) return null;

  // Son 14 gun veya mevcut veri
  const displayData = data.slice(0, 14);
  const maxValue = totalBudget > 0 ? totalBudget : Math.max(...displayData.map((d) => d.projected));

  return (
    <div className="flex items-end gap-px h-10 mt-2">
      {displayData.map((d, i) => {
        const projectedHeight = maxValue > 0 ? (d.projected / maxValue) * 100 : 0;
        const actualHeight = d.actual != null && maxValue > 0 ? (d.actual / maxValue) * 100 : null;

        return (
          <div key={i} className="flex-1 flex items-end gap-px" title={`${d.date}: ${formatCurrency(d.projected)} TL`}>
            <div
              className="flex-1 bg-indigo-200 rounded-t-sm transition-all duration-200 min-w-[2px]"
              style={{ height: `${Math.max(projectedHeight, 2)}%` }}
            />
            {actualHeight != null && (
              <div
                className="flex-1 bg-indigo-500 rounded-t-sm transition-all duration-200 min-w-[2px]"
                style={{ height: `${Math.max(actualHeight, 2)}%` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// OZET KARTLARI
// ============================================

const SummaryCards: React.FC<{ summary: BudgetForecastSummary }> = ({ summary }) => {
  const spentPercentage =
    summary.totalBudgetAllCampaigns > 0
      ? ((summary.totalSpentAllCampaigns / summary.totalBudgetAllCampaigns) * 100).toFixed(1)
      : '0';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {/* Toplam Butce */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-commons text-neutral-500">Toplam Butce</span>
        </div>
        <p className="text-lg font-commons font-bold text-[#171717]">
          {formatCurrency(summary.totalBudgetAllCampaigns)} TL
        </p>
      </div>

      {/* Harcanan */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-commons text-neutral-500">Harcanan</span>
        </div>
        <p className="text-lg font-commons font-bold text-[#171717]">
          {formatCurrency(summary.totalSpentAllCampaigns)} TL
        </p>
        <p className="text-xs font-commons text-neutral-400 mt-0.5">
          %{spentPercentage} kullanildi
        </p>
      </div>

      {/* Riskli Kampanyalar */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-commons text-neutral-500">Riskli Kampanyalar</span>
        </div>
        <p className={`text-lg font-commons font-bold ${summary.campaignsAtRisk > 0 ? 'text-amber-600' : 'text-[#171717]'}`}>
          {summary.campaignsAtRisk}
        </p>
        {summary.campaignsDepleted > 0 && (
          <p className="text-xs font-commons text-red-500 mt-0.5">
            {summary.campaignsDepleted} tukenmis
          </p>
        )}
      </div>

      {/* Ortalama Burn Rate */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-commons text-neutral-500">Ort. Burn Rate</span>
        </div>
        <p className="text-lg font-commons font-bold text-[#171717]">
          %{summary.averageBurnRate.toFixed(1)}
        </p>
        <p className="text-xs font-commons text-neutral-400 mt-0.5">gunluk</p>
      </div>
    </div>
  );
};

// ============================================
// KAMPANYA TAHMIN KARTI
// ============================================

const ForecastCard: React.FC<{
  forecast: BudgetForecast;
  onRefresh: (campaignId: string) => void;
  refreshingId: string | null;
}> = ({ forecast, onRefresh, refreshingId }) => {
  const spentPercent =
    forecast.totalBudget > 0
      ? Math.min((forecast.spentToDate / forecast.totalBudget) * 100, 100)
      : 0;

  const isRefreshing = refreshingId === forecast.campaignId;

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-4 hover:border-indigo-200 transition-colors">
      {/* Ust kisim: isim + durum */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusDotColor(forecast.status)}`} />
            <h4 className="text-sm font-commons font-semibold text-[#171717] truncate">
              {forecast.campaignName}
            </h4>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-commons font-medium border ${getDaysRemainingBadge(
              forecast.daysRemaining,
              forecast.status
            )}`}
          >
            {forecast.daysRemaining > 0 ? `${forecast.daysRemaining} gun` : 'Tukendi'}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-commons font-medium ${
              FORECAST_STATUS_COLORS[forecast.status]
            }`}
          >
            {FORECAST_STATUS_LABELS[forecast.status]}
          </span>
        </div>
      </div>

      {/* Ilerleme cubugu */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-commons text-neutral-500">
            {formatCurrency(forecast.spentToDate)} / {formatCurrency(forecast.totalBudget)} TL
          </span>
          <span className="text-xs font-commons text-neutral-400">
            %{spentPercent.toFixed(0)}
          </span>
        </div>
        <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(forecast.status)}`}
            style={{ width: `${spentPercent}%` }}
          />
        </div>
      </div>

      {/* Detay satirlari */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3 text-neutral-400" />
          <span className="text-xs font-commons text-neutral-500">Gunluk Harcama:</span>
          <span className="text-xs font-commons font-medium text-[#171717]">
            {formatCurrency(forecast.dailySpendRate, 2)} TL
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-neutral-400" />
          <span className="text-xs font-commons text-neutral-500">Tahmini Bitis:</span>
          <span className="text-xs font-commons font-medium text-[#171717]">
            {formatDate(forecast.projectedDepletionDate)}
          </span>
        </div>
        {forecast.scheduledEndDate && (
          <div className="flex items-center gap-1.5 col-span-2">
            <Clock className="w-3 h-3 text-neutral-400" />
            <span className="text-xs font-commons text-neutral-500">Planlanan Bitis:</span>
            <span className="text-xs font-commons font-medium text-[#171717]">
              {formatDate(forecast.scheduledEndDate)}
            </span>
          </div>
        )}
      </div>

      {/* Burndown mini chart */}
      <BurndownMiniChart data={forecast.burndownData} totalBudget={forecast.totalBudget} />

      {/* Oneriler */}
      {forecast.recommendations && forecast.recommendations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <p className="text-xs font-commons font-medium text-neutral-500 mb-1.5">Oneriler</p>
          <ul className="space-y-1">
            {forecast.recommendations.slice(0, 2).map((rec, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 text-indigo-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs font-commons text-neutral-600 leading-relaxed">
                  {rec}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alt kisim: guven + guncelle butonu */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-3 h-3 text-neutral-400" />
          <span className="text-xs font-commons text-neutral-400">
            Guven: %{((forecast.confidence || 0) * 100).toFixed(0)}
          </span>
        </div>
        <button
          onClick={() => onRefresh(forecast.campaignId)}
          disabled={isRefreshing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-commons font-medium transition-colors ${
            isRefreshing
              ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Hesaplaniyor...' : 'Tahmin Guncelle'}
        </button>
      </div>
    </div>
  );
};

// ============================================
// ANA PANEL
// ============================================

const BudgetForecastPanel: React.FC<BudgetForecastPanelProps> = ({ projectId, compact = false }) => {
  const [forecasts, setForecasts] = useState<BudgetForecast[]>([]);
  const [summary, setSummary] = useState<BudgetForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Veri Yukleme ----
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [forecastsData, summaryData] = await Promise.all([
        getForecasts(projectId),
        getForecastSummary(projectId),
      ]);
      setForecasts(forecastsData);
      setSummary(summaryData);
    } catch (err: any) {
      console.error('[BudgetForecastPanel] Veri yukleme hatasi:', err);
      setError(err.message || 'Veriler yuklenirken hata olustu');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Tahmin Guncelle ----
  const handleRefreshForecast = useCallback(async (campaignId: string) => {
    setRefreshingId(campaignId);
    try {
      const res = await fetch('/api/marketing/forecast-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Tahmin guncellenemedi');
      }

      // Listeyi guncelle
      setForecasts((prev) =>
        prev.map((f) =>
          f.campaignId === campaignId
            ? { ...f, ...data.forecast, id: data.forecast.id || f.id }
            : f
        )
      );

      // Ozet'i yeniden hesapla
      const newSummary = await getForecastSummary(projectId);
      setSummary(newSummary);
    } catch (err: any) {
      console.error('[BudgetForecastPanel] Tahmin guncelleme hatasi:', err);
      setError(err.message || 'Tahmin guncellenirken hata olustu');
    } finally {
      setRefreshingId(null);
    }
  }, [projectId]);

  // ---- Siralama: riskli olanlar uste ----
  const sortedForecasts = [...forecasts].sort((a, b) => {
    const statusOrder: Record<ForecastStatus, number> = {
      critical: 0,
      warning: 1,
      depleted: 2,
      current: 3,
    };
    return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
  });

  // compact modda sadece ilk 3 riskli kampanyayi goster
  const displayForecasts = compact ? sortedForecasts.slice(0, 3) : sortedForecasts;

  // ---- Yukleniyor ----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-commons text-neutral-500">Butce tahminleri yukleniyor...</p>
        </div>
      </div>
    );
  }

  // ---- Hata ----
  if (error && forecasts.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <p className="text-sm font-commons font-medium text-red-700">Veri Yukleme Hatasi</p>
        </div>
        <p className="text-xs font-commons text-red-600">{error}</p>
        <button
          onClick={loadData}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-md text-xs font-commons font-medium hover:bg-red-200 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Tekrar Dene
        </button>
      </div>
    );
  }

  // ---- Bos Durum ----
  if (forecasts.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
        <p className="text-sm font-commons font-medium text-neutral-500">
          Henuz butce tahmini yok
        </p>
        <p className="text-xs font-commons text-neutral-400 mt-1">
          Aktif kampanyalariniz icin butce tahminleri burada gorunecek
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Baslik */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-commons font-semibold text-[#171717]">
            Butce Tahminleri
          </h3>
          {summary && summary.campaignsAtRisk > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-commons font-medium">
              {summary.campaignsAtRisk} riskli
            </span>
          )}
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-commons text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Yenile
        </button>
      </div>

      {/* Hata banner (veri varsa ama hata olustuysa) */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs font-commons text-amber-700">{error}</p>
        </div>
      )}

      {/* Ozet Kartlari */}
      {summary && <SummaryCards summary={summary} />}

      {/* Kampanya Tahmin Listesi */}
      <div className="space-y-3">
        {displayForecasts.map((forecast) => (
          <ForecastCard
            key={forecast.id}
            forecast={forecast}
            onRefresh={handleRefreshForecast}
            refreshingId={refreshingId}
          />
        ))}
      </div>

      {/* compact modda "Tumu" linki */}
      {compact && sortedForecasts.length > 3 && (
        <div className="mt-4 text-center">
          <span className="text-xs font-commons text-indigo-600 hover:text-indigo-700 cursor-pointer">
            Tum tahminleri gor ({sortedForecasts.length} kampanya)
          </span>
        </div>
      )}
    </div>
  );
};

export default BudgetForecastPanel;
