import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import type { WorkflowInstance } from '@/shared/types/workflow/instance';
import { useWorkflowTemplate } from '@/shared/hooks/useWorkflowTemplates';
import WorkflowInstanceCard from './WorkflowInstanceCard';

interface ServiceWorkflowSectionProps {
  instances: WorkflowInstance[];
  hasTemplates: boolean;
  onAddWorkflow: () => void;
  onRefetch: () => Promise<void>;
  onViewDetail?: (instanceId: string) => void;
}

// Wrapper to get template for each instance
const InstanceWithTemplate: React.FC<{
  instance: WorkflowInstance;
  onRefetch: () => Promise<void>;
  onViewDetail?: (instanceId: string) => void;
}> = ({ instance, onRefetch, onViewDetail }) => {
  const { template } = useWorkflowTemplate(instance.templateId);
  return (
    <WorkflowInstanceCard
      instance={instance}
      template={template}
      onRefetch={onRefetch}
      onViewDetail={onViewDetail ? (instanceId) => onViewDetail(instanceId) : undefined}
    />
  );
};

const ServiceWorkflowSection: React.FC<ServiceWorkflowSectionProps> = ({
  instances,
  hasTemplates,
  onAddWorkflow,
  onRefetch,
  onViewDetail,
}) => {
  const [showCompleted, setShowCompleted] = useState(false);

  const activeInstances = instances.filter(i => i.status === 'active' || i.status === 'pending' || i.status === 'paused');
  const completedInstances = instances.filter(i => i.status === 'completed' || i.status === 'cancelled');

  if (activeInstances.length === 0 && completedInstances.length === 0 && !hasTemplates) {
    return null;
  }

  return (
    <div className="mt-3">
      {/* Action bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {activeInstances.length > 0 && (
            <span className="font-grotesk text-xs text-neutral-400">
              {activeInstances.length} aktif is akisi
            </span>
          )}
        </div>
        {hasTemplates && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddWorkflow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 text-neutral-600 font-grotesk text-xs font-medium hover:border-neutral-400 hover:bg-neutral-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Yeni Produksiyon Ekle
          </motion.button>
        )}
      </div>

      {/* Active instances */}
      {activeInstances.length > 0 ? (
        <div className="space-y-3">
          {activeInstances.map((instance) => (
            <InstanceWithTemplate
              key={instance.id}
              instance={instance}
              onRefetch={onRefetch}
              onViewDetail={onViewDetail}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 border border-dashed border-neutral-200">
          <GitBranch className="w-5 h-5 text-neutral-300" />
          <div>
            <p className="font-grotesk text-sm text-neutral-500">
              Henuz is akisi yok
            </p>
            {hasTemplates && (
              <p className="font-grotesk text-xs text-neutral-400 mt-0.5">
                "Yeni Produksiyon Ekle" ile baslatabilirsiniz
              </p>
            )}
          </div>
        </div>
      )}

      {/* Completed instances (collapsible) */}
      {completedInstances.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-1.5 font-grotesk text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            {showCompleted ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {completedInstances.length} tamamlanmis is akisi
          </button>
          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 mt-2 opacity-60">
                  {completedInstances.map((instance) => (
                    <InstanceWithTemplate
                      key={instance.id}
                      instance={instance}
                      onRefetch={onRefetch}
                      onViewDetail={onViewDetail}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default ServiceWorkflowSection;
