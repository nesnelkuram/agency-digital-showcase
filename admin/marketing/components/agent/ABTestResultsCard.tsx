import React from 'react';
import { GitBranch, Trophy, TrendingUp, TrendingDown } from 'lucide-react';

interface VariantResult {
  asset?: string;
  name?: string;
  treatmentPercentage?: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  spend: number;
}

interface ABTestResultsCardProps {
  data: {
    testType: string;
    testId: string;
    name?: string;
    startTime?: string;
    endTime?: string;
    variants?: VariantResult[];
    cells?: VariantResult[];
    winner?: VariantResult | null;
    results?: any;
  };
}

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const ABTestResultsCard: React.FC<ABTestResultsCardProps> = ({ data }) => {
  const items = data.variants || data.cells || [];
  const winnerName = data.winner?.name || data.winner?.asset;

  if (items.length === 0) {
    return (
      <div className="my-2 p-4 rounded-xl border border-neutral-200 bg-white text-center">
        <GitBranch className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-commons text-neutral-500">Test sonuclari henuz mevcut degil</p>
      </div>
    );
  }

  return (
    <div className="my-2 p-4 rounded-xl border border-neutral-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-commons font-bold text-[#171717]">
            {data.name || 'A/B Test Sonuclari'}
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-commons font-medium bg-violet-100 text-violet-700">
          {data.testType === 'dynamic_creative' ? 'Dynamic Creative' : 'Ad Study'}
        </span>
      </div>

      {/* Date range */}
      {(data.startTime || data.endTime) && (
        <p className="text-[10px] font-commons text-neutral-400 mb-3">
          {data.startTime && new Date(data.startTime).toLocaleDateString('tr-TR')}
          {data.endTime && ` — ${new Date(data.endTime).toLocaleDateString('tr-TR')}`}
        </p>
      )}

      {/* Results table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-commons">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="text-left py-2 pr-2 text-neutral-500 font-medium">Varyant</th>
              <th className="text-right py-2 px-2 text-neutral-500 font-medium">Gosterim</th>
              <th className="text-right py-2 px-2 text-neutral-500 font-medium">Tiklama</th>
              <th className="text-right py-2 px-2 text-neutral-500 font-medium">CTR</th>
              <th className="text-right py-2 px-2 text-neutral-500 font-medium">CPC</th>
              <th className="text-right py-2 pl-2 text-neutral-500 font-medium">Harcama</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const itemName = item.name || item.asset || `Varyant ${idx + 1}`;
              const isWinner = winnerName && itemName === winnerName;
              return (
                <tr
                  key={idx}
                  className={`border-b border-neutral-50 ${isWinner ? 'bg-emerald-50' : ''}`}
                >
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1.5">
                      {isWinner && <Trophy className="w-3 h-3 text-amber-500" />}
                      <span className={`font-medium ${isWinner ? 'text-emerald-700' : 'text-[#171717]'}`}>
                        {itemName}
                      </span>
                      {item.treatmentPercentage && (
                        <span className="text-[9px] text-neutral-400">(%{item.treatmentPercentage})</span>
                      )}
                    </div>
                  </td>
                  <td className="text-right py-2 px-2 text-neutral-600">{formatNumber(item.impressions)}</td>
                  <td className="text-right py-2 px-2 text-neutral-600">{formatNumber(item.clicks)}</td>
                  <td className="text-right py-2 px-2">
                    <span className={`inline-flex items-center gap-0.5 ${isWinner ? 'text-emerald-600 font-medium' : 'text-neutral-600'}`}>
                      {isWinner && <TrendingUp className="w-3 h-3" />}
                      %{(item.ctr * 100).toFixed(2)}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2 text-neutral-600">{item.cpc.toFixed(2)} TL</td>
                  <td className="text-right py-2 pl-2 text-neutral-600">{item.spend.toFixed(2)} TL</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Winner highlight */}
      {data.winner && winnerName && (
        <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-xs font-commons font-medium text-emerald-700">
              Kazanan: {winnerName}
            </p>
            <p className="text-[10px] font-commons text-emerald-600">
              En yuksek CTR: %{((data.winner.ctr || 0) * 100).toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ABTestResultsCard;
