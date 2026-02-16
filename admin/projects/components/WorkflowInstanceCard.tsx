import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GitBranch } from 'lucide-react';
import type { WorkflowInstance } from '@/shared/types/workflow/instance';
import type { WorkflowTemplate } from '@/shared/types/workflow/template';
import WorkflowStepTimeline from './WorkflowStepTimeline';
import InlineStepActions from './InlineStepActions';

interface WorkflowInstanceCardProps {
  instance: WorkflowInstance;
  template: WorkflowTemplate | null;
  onRefetch: () => Promise<void>;
  onStepClick?: (nodeId: string) => void;
  onViewDetail?: (instanceId: string, nodeId: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Aktif', className: 'bg-green-100 text-green-700' },
  pending: { label: 'Bekliyor', className: 'bg-yellow-100 text-yellow-700' },
  paused: { label: 'Duraklatildi', className: 'bg-neutral-100 text-neutral-600' },
  completed: { label: 'Tamamlandi', className: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Iptal', className: 'bg-red-100 text-red-600' },
};

const WorkflowInstanceCard: React.FC<WorkflowInstanceCardProps> = ({
  instance,
  template,
  onRefetch,
  onStepClick,
  onViewDetail,
}) => {
  const badge = STATUS_BADGE[instance.status] || STATUS_BADGE.pending;

  // Find the first active step (ready or in_progress)
  const { activeNodeId, activeStep, activeNode } = useMemo(() => {
    // Prefer in_progress over ready
    let foundNodeId: string | null = null;
    let foundStep = null;

    for (const nodeId of instance.activeNodeIds) {
      const step = instance.steps[nodeId];
      if (step?.status === 'in_progress') {
        foundNodeId = nodeId;
        foundStep = step;
        break;
      }
      if (step?.status === 'ready' && !foundNodeId) {
        foundNodeId = nodeId;
        foundStep = step;
      }
    }

    const node = template?.nodes.find(n => n.id === foundNodeId) || null;

    return { activeNodeId: foundNodeId, activeStep: foundStep, activeNode: node };
  }, [instance, template]);

  return (
    <motion.div
      className="bg-white rounded-xl border border-neutral-100 p-4 hover:shadow-sm transition-shadow"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header: name + progress + status badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <h4 className="font-grotesk text-sm font-semibold text-[#171717] truncate">
            {instance.templateName}
          </h4>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-grotesk text-xs font-medium text-neutral-600">
            %{instance.progress}
          </span>
          <span className={`text-[10px] font-grotesk font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-neutral-100 rounded-full mb-3 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
          initial={{ width: 0 }}
          animate={{ width: `${instance.progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Step Timeline */}
      <WorkflowStepTimeline
        instance={instance}
        template={template}
        onStepClick={onStepClick}
      />

      {/* Inline actions for active step */}
      {instance.status === 'active' && (
        <InlineStepActions
          instance={instance}
          activeNode={activeNode}
          activeStep={activeStep}
          activeNodeId={activeNodeId}
          onRefetch={onRefetch}
          onViewDetail={onViewDetail}
        />
      )}
    </motion.div>
  );
};

export default WorkflowInstanceCard;
