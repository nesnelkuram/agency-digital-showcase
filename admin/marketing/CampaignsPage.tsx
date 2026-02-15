import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Megaphone, MoreVertical, ExternalLink,
  RefreshCw, FileDown, Eye, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import type { CampaignSummary, CampaignStatus, AdPlatform } from '@/shared/types/marketing';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  PLATFORM_COLORS,
  OBJECTIVE_LABELS,
} from '@/shared/types/marketing';
import { getCampaigns, deepSyncFromMeta } from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import SyncStatusBadge from './components/SyncStatusBadge';

type SortKey = 'name' | 'status' | 'totalBudget' | 'totalSpend' | 'impressions' | 'clicks' | 'ctr' | 'conversions';
type SortDir = 'asc' | 'desc';

const CampaignsPage: React.FC = () => {
  const { projectId, basePath } = useProjectScope();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, [statusFilter, projectId]);

  // Close menu on outside click
  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    if (openMenuId) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

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

  const handleSync = async (campaignId: string) => {
    if (!projectId || syncingId) return;
    setSyncingId(campaignId);
    try {
      await deepSyncFromMeta(projectId);
      await loadCampaigns();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let list = [...campaigns];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    // Sort
    list.sort((a, b) => {
      let va: any, vb: any;
      switch (sortKey) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case 'status': va = a.status; vb = b.status; break;
        case 'totalBudget': va = a.totalBudget; vb = b.totalBudget; break;
        case 'totalSpend': va = a.totalSpend; vb = b.totalSpend; break;
        case 'impressions': va = a.performance?.impressions ?? 0; vb = b.performance?.impressions ?? 0; break;
        case 'clicks': va = a.performance?.clicks ?? 0; vb = b.performance?.clicks ?? 0; break;
        case 'ctr':
          va = (a.performance?.impressions ?? 0) > 0 ? ((a.performance?.clicks ?? 0) / (a.performance?.impressions ?? 1)) : 0;
          vb = (b.performance?.impressions ?? 0) > 0 ? ((b.performance?.clicks ?? 0) / (b.performance?.impressions ?? 1)) : 0;
          break;
        case 'conversions': va = a.performance?.conversions ?? 0; vb = b.performance?.conversions ?? 0; break;
        default: va = a.name; vb = b.name;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [campaigns, searchQuery, sortKey, sortDir]);

  const SortIcon: React.FC<{ col: SortKey }> = ({ col }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-neutral-300" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-indigo-600" />
      : <ArrowDown className="w-3 h-3 text-indigo-600" />;
  };

  const budgetPct = (c: CampaignSummary) => c.totalBudget > 0 ? Math.min((c.totalSpend / c.totalBudget) * 100, 100) : 0;
  const budgetColor = (pct: number) => pct > 95 ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-emerald-500';

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
          to={`${basePath}/campaigns/new`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm"
        >
          <Plus className="w-4 h-4" />
          Yeni Kampanya
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Kampanya ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | '')}
          className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="">Tum Durumlar</option>
          <option value="active">Yayinda</option>
          <option value="paused">Duraklatildi</option>
          <option value="draft">Taslak</option>
          <option value="completed">Tamamlandi</option>
        </select>
        <span className="text-sm font-commons text-neutral-400">
          {filtered.length} kampanya
        </span>
      </div>

      {/* Campaign Table */}
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
        <div className="bg-white rounded-xl border border-neutral-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  {[
                    { key: 'name' as SortKey, label: 'Kampanya' },
                    { key: 'status' as SortKey, label: 'Durum' },
                    { key: 'totalBudget' as SortKey, label: 'Butce' },
                    { key: 'totalSpend' as SortKey, label: 'Harcama' },
                    { key: 'impressions' as SortKey, label: 'Gosterim' },
                    { key: 'clicks' as SortKey, label: 'Tiklama' },
                    { key: 'ctr' as SortKey, label: 'CTR' },
                    { key: 'conversions' as SortKey, label: 'Donusum' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-3 text-left text-xs font-commons font-semibold text-neutral-500 uppercase cursor-pointer hover:text-neutral-700 select-none"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col.key} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filtered.map((c) => {
                  const pct = budgetPct(c);
                  const ctr = (c.performance?.impressions ?? 0) > 0
                    ? ((c.performance?.clicks ?? 0) / (c.performance?.impressions ?? 1) * 100)
                    : 0;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`${basePath}/campaigns/${c.id}`)}
                      className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-commons font-semibold text-[#171717] truncate max-w-[240px]">{c.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs font-commons text-neutral-400">{OBJECTIVE_LABELS[c.objective]}</span>
                              {c.platforms.map(p => (
                                <span key={p} className={`px-1 py-0 rounded text-[10px] ${PLATFORM_COLORS[p]}`}>{p}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-commons ${CAMPAIGN_STATUS_COLORS[c.status]}`}>
                          {CAMPAIGN_STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      {/* Budget with pacing bar */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-commons text-[#171717]">{c.totalBudget.toLocaleString()} TL</p>
                        <div className="w-20 h-1.5 bg-neutral-100 rounded-full mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${budgetColor(pct)}`} style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      {/* Spend */}
                      <td className="px-4 py-3 text-sm font-commons text-[#171717]">
                        {c.totalSpend.toLocaleString()} TL
                      </td>
                      {/* Impressions */}
                      <td className="px-4 py-3 text-sm font-commons text-neutral-600">
                        {(c.performance?.impressions ?? 0).toLocaleString()}
                      </td>
                      {/* Clicks */}
                      <td className="px-4 py-3 text-sm font-commons text-neutral-600">
                        {(c.performance?.clicks ?? 0).toLocaleString()}
                      </td>
                      {/* CTR */}
                      <td className="px-4 py-3 text-sm font-commons text-neutral-600">
                        {ctr.toFixed(2)}%
                      </td>
                      {/* Conversions */}
                      <td className="px-4 py-3 text-sm font-commons font-semibold text-[#171717]">
                        {c.performance?.conversions ?? 0}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-neutral-400" />
                        </button>
                        {openMenuId === c.id && (
                          <div className="absolute right-4 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-20">
                            <button
                              onClick={() => { navigate(`${basePath}/campaigns/${c.id}`); setOpenMenuId(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-commons text-neutral-700 hover:bg-neutral-50"
                            >
                              <Eye className="w-4 h-4" /> Detaylari Gor
                            </button>
                            <button
                              onClick={() => { handleSync(c.id); setOpenMenuId(null); }}
                              disabled={syncingId === c.id}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-commons text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-4 h-4 ${syncingId === c.id ? 'animate-spin' : ''}`} /> Senkronize Et
                            </button>
                            <a
                              href={`https://business.facebook.com/adsmanager/manage/campaigns`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-commons text-neutral-700 hover:bg-neutral-50"
                            >
                              <ExternalLink className="w-4 h-4" /> Meta'da Ac
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;
