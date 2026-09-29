import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilePlus2, Loader2, ArrowRight } from 'lucide-react';
import type { ContentPlan } from '@/shared/types/socialMedia';
import { CONTENT_PLAN_STATUS_LABELS } from '@/shared/types/socialMedia';
import { useStudio } from '../StudioLayout';
import { formatDate, getProjectPlans } from '../studioData';

const PLAN_COLOR: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-600',
  internal_review: 'bg-sky-100 text-sky-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  partially_approved: 'bg-lime-100 text-lime-700',
  approved: 'bg-green-100 text-green-700',
  revision_requested: 'bg-red-100 text-red-700',
};

const StudioPlansPage: React.FC = () => {
  const { project, tenantId } = useStudio();
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    getProjectPlans(tenantId, project.id)
      .then(setPlans)
      .catch((err) => console.error('[Studio] Planlar yüklenemedi:', err))
      .finally(() => setLoading(false));
  }, [project?.id, tenantId]);

  if (!project) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">Planlar</h1>
        <Link
          to={`/studio/${project.id}/planlar/yeni`}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#171717] text-white rounded-lg font-grotesk text-sm hover:bg-neutral-800"
        >
          <FilePlus2 className="w-4 h-4" /> Haftalık plan
        </Link>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : plans.length === 0 ? (
        <p className="font-grotesk text-sm text-neutral-500 bg-white border border-neutral-200 rounded-xl p-6 text-center">
          Henüz plan yok. İlk haftalık planı oluşturun.
        </p>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              to={`/studio/${project.id}/planlar/${plan.id}`}
              className="flex items-center gap-3 bg-white border border-neutral-200 rounded-xl p-3 hover:border-neutral-300"
            >
              <div className="min-w-0 flex-1">
                <p className="font-grotesk text-sm font-medium text-[#171717] truncate">{plan.title}</p>
                <p className="font-grotesk text-xs text-neutral-500">
                  {formatDate(plan.weekStartDate)} – {formatDate(plan.weekEndDate)} · {plan.postIds?.length || 0} içerik
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full font-grotesk text-[11px] ${PLAN_COLOR[plan.status] || 'bg-neutral-100'}`}>
                {CONTENT_PLAN_STATUS_LABELS[plan.status] || plan.status}
              </span>
              <ArrowRight className="w-4 h-4 text-neutral-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudioPlansPage;
