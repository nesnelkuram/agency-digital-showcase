import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, CheckCircle2, Eye, Loader2 } from 'lucide-react';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { startStep, completeStep } from '@/shared/services/workflowEngineService';
import type { WorkflowInstance, StepInstance } from '@/shared/types/workflow/instance';
import type { WorkflowNodeTemplate } from '@/shared/types/workflow/template';

interface InlineStepActionsProps {
  instance: WorkflowInstance;
  activeNode: WorkflowNodeTemplate | null;
  activeStep: StepInstance | null;
  activeNodeId: string | null;
  onRefetch: () => Promise<void>;
  onViewDetail?: (instanceId: string, nodeId: string) => void;
}

const InlineStepActions: React.FC<InlineStepActionsProps> = ({
  instance,
  activeNode,
  activeStep,
  activeNodeId,
  onRefetch,
  onViewDetail,
}) => {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!activeStep || !activeNodeId || !activeNode) return null;

  const handleStart = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await startStep(
        tenantId,
        instance.id,
        activeNodeId,
        user.uid,
        user.displayName || user.email || 'Unknown',
        'team_member'
      );
      await onRefetch();
    } catch (err) {
      console.error('Error starting step:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await completeStep(tenantId, instance.id, activeNodeId);
      await onRefetch();
    } catch (err) {
      console.error('Error completing step:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="font-grotesk text-xs text-neutral-500 mr-1">
        Aktif: <span className="font-medium text-neutral-700">{activeNode.label}</span>
        {activeStep.assignment && (
          <span className="text-neutral-400"> - {activeStep.assignment.userName}</span>
        )}
      </span>

      {activeStep.status === 'ready' && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStart}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-grotesk text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Basla
        </motion.button>
      )}

      {activeStep.status === 'in_progress' && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleComplete}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white font-grotesk text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Tamamla
        </motion.button>
      )}

      {onViewDetail && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onViewDetail(instance.id, activeNodeId)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 font-grotesk text-xs font-medium hover:bg-neutral-50 transition-colors"
        >
          <Eye className="w-3 h-3" />
          Detay
        </motion.button>
      )}
    </div>
  );
};

export default InlineStepActions;
