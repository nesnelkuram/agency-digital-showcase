import { Check, Circle, ArrowRight } from 'lucide-react';

interface ApprovalStep {
  key: string;
  label: string;
  completedBy?: string;
}

interface ApprovalFlowIndicatorProps {
  currentStatus: string;
  requireInternalReview: boolean;
  internalReviewedByName?: string;
  approvedByName?: string;
}

const STEPS_WITH_INTERNAL: ApprovalStep[] = [
  { key: 'draft', label: 'Taslak' },
  { key: 'internal_review', label: 'Dahili Inceleme' },
  { key: 'pending_approval', label: 'Musteri Onayi' },
  { key: 'approved', label: 'Onaylandi' },
];

const STEPS_WITHOUT_INTERNAL: ApprovalStep[] = [
  { key: 'draft', label: 'Taslak' },
  { key: 'pending_approval', label: 'Musteri Onayi' },
  { key: 'approved', label: 'Onaylandi' },
];

function getStepIndex(steps: ApprovalStep[], status: string): number {
  // Map intermediate statuses to their parent step
  const statusMap: Record<string, string> = {
    draft: 'draft',
    internal_review: 'internal_review',
    revision_requested_internal: 'internal_review',
    pending_approval: 'pending_approval',
    revision_requested: 'pending_approval',
    partially_approved: 'pending_approval',
    approved: 'approved',
    scheduled: 'approved',
    published: 'approved',
  };

  const mapped = statusMap[status] || 'draft';
  return steps.findIndex((s) => s.key === mapped);
}

export default function ApprovalFlowIndicator({
  currentStatus,
  requireInternalReview,
  internalReviewedByName,
  approvedByName,
}: ApprovalFlowIndicatorProps) {
  const steps = requireInternalReview ? STEPS_WITH_INTERNAL : STEPS_WITHOUT_INTERNAL;
  const currentIndex = getStepIndex(steps, currentStatus);

  const isRevision =
    currentStatus === 'revision_requested' || currentStatus === 'revision_requested_internal';

  return (
    <div className="flex items-center gap-1 font-grotesk">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isUpcoming = index > currentIndex;

        let completedBy: string | undefined;
        if (step.key === 'internal_review' && isCompleted) completedBy = internalReviewedByName;
        if (step.key === 'approved' && isCompleted) completedBy = approvedByName;

        return (
          <div key={step.key} className="flex items-center gap-1">
            {index > 0 && (
              <ArrowRight
                size={14}
                className={isCompleted ? 'text-green-500' : 'text-neutral-300'}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isCompleted
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : isCurrent
                    ? isRevision
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-neutral-50 text-neutral-400 border border-neutral-100'
              }`}
            >
              {isCompleted ? (
                <Check size={12} className="text-green-600" />
              ) : isCurrent ? (
                <Circle size={12} className={isRevision ? 'text-red-500' : 'text-amber-500'} fill="currentColor" />
              ) : (
                <Circle size={12} className="text-neutral-300" />
              )}
              <span>{step.label}</span>
              {completedBy && (
                <span className="text-[10px] opacity-70">({completedBy})</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
