import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Filter, Search, Megaphone } from 'lucide-react';
import type { CampaignSummary, CampaignStatus, AdPlatform } from '@/shared/types/marketing';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  OBJECTIVE_LABELS,
} from '@/shared/types/marketing';
import { getCampaigns } from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';

const CampaignsPage: React.FC = () => {
  const { projectId, basePath } = useProjectScope();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('');

  useEffect(() => {
    loadCampaigns();
  }, [statusFilter, projectId]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const filters = statusFilter ? { status: [statusFilter], projectId } : projectId ? { projectId } : undefined;
      const result = await getCampaigns(filters);
      setCampaigns(result.campaigns);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">Kampanyalar</h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Tum dijital reklam kampanyalariniz
          </p>
        </div>
        <Link
          to={`${basePath}/proposals`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm"
        >
          <Plus className="w-4 h-4" />
          Yeni Kampanya
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Kampanya ara..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | '')}
          className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="">Tum Durumlar</option>
          {Object.entries(CAMPAIGN_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Campaign List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <Megaphone className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="font-commons text-neutral-500">Henuz kampanya bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              to={`${basePath}/campaigns/${campaign.id}`}
              className="block bg-white rounded-xl border border-neutral-200/50 p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-commons font-semibold text-[#171717]">
                      {campaign.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-commons ${CAMPAIGN_STATUS_COLORS[campaign.status]}`}>
                      {CAMPAIGN_STATUS_LABELS[campaign.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-commons text-neutral-500">
                    <span>{OBJECTIVE_LABELS[campaign.objective]}</span>
                    <span>{campaign.totalBudget.toLocaleString()} TL</span>
                    <div className="flex gap-1">
                      {campaign.platforms.map((p) => (
                        <span key={p} className={`px-1.5 py-0.5 rounded text-xs ${PLATFORM_COLORS[p]}`}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {campaign.performance && (
                  <div className="text-right">
                    <p className="text-sm font-commons font-semibold text-[#171717]">
                      ROAS: {campaign.performance.roas.toFixed(1)}x
                    </p>
                    <p className="text-xs font-commons text-neutral-500">
                      {campaign.performance.conversions} donusum
                    </p>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;
