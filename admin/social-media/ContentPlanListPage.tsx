import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Clock,
  CheckCircle,
  FileText,
  AlertCircle,
  Calendar,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { useTenantId } from '@/shared/hooks/useTenant';
import type { ContentPlanSummary, ContentPlanStatus } from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS, SOCIAL_PLATFORM_COLORS } from '@/shared/types/socialMedia';
import { getContentPlansForProject, deleteContentPlan } from '@/shared/services/contentPlanService';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';

const STATUS_CONFIG: Record<ContentPlanStatus, { label: string; icon: React.ReactNode; color: string }> = {
  draft: { label: 'Taslak', icon: <FileText className="w-3.5 h-3.5" />, color: 'bg-gray-100 text-gray-700' },
  pending_approval: { label: 'Onay Bekliyor', icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Onaylandi', icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-700' },
  revision_requested: { label: 'Revizyon', icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'bg-red-100 text-red-700' },
};

const ContentPlanListPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const tenantId = useTenantId();

  const [plans, setPlans] = useState<ContentPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContentPlanStatus | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const result = await getContentPlansForProject(tenantId, projectId);
      setPlans(result);
    } catch (err) {
      console.error('[ContentPlanListPage] Error loading plans:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, projectId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleDelete = async (planId: string) => {
    if (!confirm('Bu icerik planini silmek istediginize emin misiniz?')) return;
    try {
      await deleteContentPlan(tenantId, planId);
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err) {
      console.error('[ContentPlanListPage] Error deleting plan:', err);
    }
  };

  const filteredPlans = filter === 'all'
    ? plans
    : plans.filter((p) => p.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {projectId && (
        <ProjectBreadcrumb projectId={projectId} currentPage="Icerik Planlari" />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/admin/projects/${projectId}/social-media`)}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
              Icerik Planlari
            </h1>
            <p className="font-grotesk text-neutral-500 mt-1">
              Haftalik icerik planlari ve musteri onaylari
            </p>
          </div>
        </div>
        <Link
          to={`/admin/projects/${projectId}/social-media/plans/new`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yeni Plan
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['all', 'draft', 'pending_approval', 'approved', 'revision_requested'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-all whitespace-nowrap ${
              filter === status
                ? 'bg-[#171717] text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {status === 'all' ? 'Tumunu Goster' : STATUS_CONFIG[status].label}
            {status !== 'all' && (
              <span className="ml-1">
                ({plans.filter((p) => p.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Plan Cards */}
      {filteredPlans.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-100 p-12 text-center">
          <Calendar className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="font-grotesk text-xl font-bold text-neutral-400 mb-2">
            Henuz icerik plani yok
          </h3>
          <p className="font-grotesk text-neutral-400 mb-6 max-w-md mx-auto">
            Haftalik icerik planlarinizi olusturun ve musterilerinize gonderip onay alin.
          </p>
          <Link
            to={`/admin/projects/${projectId}/social-media/plans/new`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ilk Plani Olustur
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan, index) => {
            const statusConfig = STATUS_CONFIG[plan.status];

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Link
                  to={`/admin/projects/${projectId}/social-media/plans/${plan.id}`}
                  className="block bg-white rounded-xl border border-neutral-100 p-5 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-grotesk font-semibold text-[#171717] group-hover:text-blue-600 transition-colors truncate flex-1">
                      {plan.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(plan.id);
                      }}
                      className="p-1 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-grotesk text-[10px] font-medium ${statusConfig.color}`}>
                      {statusConfig.icon}
                      {statusConfig.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg font-grotesk text-[10px] font-medium ${SOCIAL_PLATFORM_COLORS[plan.platform]}`}>
                      {SOCIAL_PLATFORM_LABELS[plan.platform]}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-grotesk text-xs text-neutral-500">
                    <span>{plan.postCount} post</span>
                    <span>
                      {plan.weekStartDate?.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                      {' - '}
                      {plan.weekEndDate?.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContentPlanListPage;
