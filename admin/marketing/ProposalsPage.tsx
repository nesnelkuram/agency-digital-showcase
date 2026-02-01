import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import type { ProposalSummary, ProposalStatus } from '@/shared/types/marketing';
import {
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from '@/shared/types/marketing';
import { getProposals } from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';

const statusIcons: Record<ProposalStatus, React.ElementType> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  revision: RotateCcw,
};

const ProposalsPage: React.FC = () => {
  const { projectId, basePath } = useProjectScope();
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | ''>('');

  useEffect(() => {
    loadProposals();
  }, [statusFilter, projectId]);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const filters = statusFilter ? { status: [statusFilter], projectId } : projectId ? { projectId } : undefined;
      const result = await getProposals(filters);
      setProposals(result.proposals);
    } catch (err) {
      console.error('Failed to load proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">AI Kampanya Onerileri</h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Yapay zeka tarafindan olusturulan kampanya onerileri
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-lg font-commons text-sm transition-colors ${
            statusFilter === '' ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          Tumu
        </button>
        {(Object.entries(PROPOSAL_STATUS_LABELS) as [ProposalStatus, string][]).map(([key, label]) => {
          const Icon = statusIcons[key];
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-commons text-sm transition-colors ${
                statusFilter === key ? PROPOSAL_STATUS_COLORS[key] : 'bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Proposals List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <Cpu className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="font-commons text-neutral-500 mb-2">Henuz oneri bulunmuyor</p>
          <p className="text-sm font-commons text-neutral-400">
            Bir lead'in marka analizinden kampanya onerisi olusturabilirsiniz
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal) => {
            const StatusIcon = statusIcons[proposal.status];
            return (
              <Link
                key={proposal.id}
                to={`${basePath}/proposals/${proposal.id}`}
                className="block bg-white rounded-xl border border-neutral-200/50 p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <StatusIcon className={`w-5 h-5 ${
                        proposal.status === 'approved' ? 'text-green-600' :
                        proposal.status === 'rejected' ? 'text-red-600' :
                        proposal.status === 'pending' ? 'text-amber-600' :
                        'text-orange-600'
                      }`} />
                      <h3 className="font-commons font-semibold text-[#171717]">
                        {proposal.businessName || 'Isimsiz Isletme'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-commons ${PROPOSAL_STATUS_COLORS[proposal.status]}`}>
                        {PROPOSAL_STATUS_LABELS[proposal.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-commons text-neutral-500">
                      <span>{proposal.totalBudget.toLocaleString()} TL/ay</span>
                      <span>{proposal.expectedOutcomeCount} beklenen sonuc</span>
                      <div className="flex gap-1">
                        {proposal.platforms.map((p) => (
                          <span key={p} className={`px-1.5 py-0.5 rounded text-xs ${PLATFORM_COLORS[p]}`}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs font-commons text-neutral-400">
                    {proposal.createdAt?.toDate?.()?.toLocaleDateString('tr-TR') || ''}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProposalsPage;
