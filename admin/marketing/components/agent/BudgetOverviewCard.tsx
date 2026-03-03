import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, AlertTriangle } from 'lucide-react';

interface CampaignBudget {
  id: string;
  name: string;
  budget: number;
  spent: number;
  remaining: number;
  utilizationPercent: number;
  status?: string;
}

interface BudgetAlert {
  campaignId: string;
  campaignName: string;
  utilizationPercent: number;
  level: 'warning' | 'critical';
}

interface BudgetOverviewCardProps {
  data: {
    totalBudget?: number;
    totalSpent?: number;
    totalRemaining?: number;
    totalUtilization?: number;
    campaigns?: CampaignBudget[];
    alerts?: BudgetAlert[];
    alertCount?: number;
  };
}

function barColor(pct: number): string {
  if (pct > 95) return 'bg-red-500';
  if (pct > 85) return 'bg-amber-500';
  return 'bg-indigo-500';
}

const BudgetOverviewCard: React.FC<BudgetOverviewCardProps> = ({ data }) => {
  const {
    totalBudget = 0,
    totalSpent = 0,
    totalRemaining = 0,
    totalUtilization = 0,
    campaigns = [],
    alerts = [],
  } = data;

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Wallet className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-commons font-medium text-neutral-600">
          Butce Durumu
        </span>
      </div>

      {/* Total bar */}
      {totalBudget > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl border border-neutral-150 bg-white mb-2"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-commons font-medium text-[#171717]">Toplam</span>
            <span className="text-xs font-commons text-neutral-500">
              {totalSpent.toLocaleString('tr-TR')} / {totalBudget.toLocaleString('tr-TR')} TL
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full transition-all ${barColor(totalUtilization)}`}
              style={{ width: `${Math.min(totalUtilization, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] font-commons text-neutral-400">
              %{totalUtilization.toFixed(1)} kullanildi
            </span>
            <span className="text-[10px] font-commons text-neutral-400">
              Kalan: {totalRemaining.toLocaleString('tr-TR')} TL
            </span>
          </div>
        </motion.div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {alerts.map((alert) => (
            <div
              key={alert.campaignId}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-commons ${
                alert.level === 'critical'
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-amber-50 border border-amber-200 text-amber-700'
              }`}
            >
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium">{alert.campaignName}</span>
              <span>— %{alert.utilizationPercent.toFixed(1)} kullanim</span>
            </div>
          ))}
        </div>
      )}

      {/* Per-campaign bars */}
      {campaigns.length > 0 && (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {campaigns.map((camp, i) => (
            <motion.div
              key={camp.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.4) }}
              className="p-2.5 rounded-lg border border-neutral-100 bg-white"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-commons font-medium text-[#171717] truncate max-w-[55%]">
                  {camp.name}
                </span>
                <span className="text-[10px] font-commons text-neutral-400">
                  {camp.spent.toLocaleString('tr-TR')} / {camp.budget.toLocaleString('tr-TR')} TL
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${barColor(camp.utilizationPercent)}`}
                  style={{ width: `${Math.min(camp.utilizationPercent, 100)}%` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BudgetOverviewCard;
