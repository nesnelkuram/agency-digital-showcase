import { useMemo, useCallback } from 'react';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkflowInstances } from '@/shared/hooks/useWorkflowInstances';
import { useWorkflowTemplates } from '@/shared/hooks/useWorkflowTemplates';
import { instantiateWorkflow } from '@/shared/services/workflowEngineService';
import { activateService } from '@/shared/services/projectService';
import type { WorkflowInstance } from '@/shared/types/workflow/instance';
import type { WorkflowTemplate } from '@/shared/types/workflow/template';
import type { Project } from '@/shared/types/project';
import type { ServiceCategory } from '@/shared/types/pricing/services';

interface UseServiceWorkflowsReturn {
  setupInstances: WorkflowInstance[];
  recurringInstances: WorkflowInstance[];
  onDemandInstances: WorkflowInstance[];
  templates: WorkflowTemplate[];
  recurringTemplates: WorkflowTemplate[];
  loading: boolean;
  error: string | null;
  startWorkflow: (templateId: string, customName?: string) => Promise<string | null>;
  refetch: () => Promise<void>;
}

export function useServiceWorkflows(
  projectId: string,
  category: ServiceCategory,
  project: Project | null
): UseServiceWorkflowsReturn {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const {
    instances: allInstances,
    loading: instancesLoading,
    error: instancesError,
    refetch: refetchInstances,
  } = useWorkflowInstances({ projectId });

  const {
    templates: allTemplates,
    loading: templatesLoading,
    error: templatesError,
    refetch: refetchTemplates,
  } = useWorkflowTemplates({ serviceCategory: category });

  // Filter instances by serviceCategory
  const categoryInstances = useMemo(
    () => allInstances.filter((i) => i.serviceCategory === category),
    [allInstances, category]
  );

  // Group by workflowType
  const setupInstances = useMemo(
    () =>
      categoryInstances.filter(
        (i) => i.workflowType === 'setup' || (!i.workflowType && !i.isRecurringInstance)
      ),
    [categoryInstances]
  );

  const recurringInstances = useMemo(
    () =>
      categoryInstances.filter(
        (i) => i.workflowType === 'recurring' || i.isRecurringInstance === true
      ),
    [categoryInstances]
  );

  const onDemandInstances = useMemo(
    () => categoryInstances.filter((i) => i.workflowType === 'on_demand'),
    [categoryInstances]
  );

  // Filter templates by category, root only
  const templates = useMemo(
    () =>
      allTemplates.filter(
        (t) =>
          t.serviceCategory === category &&
          (t.depth ?? 0) === 0 &&
          t.status !== 'archived'
      ),
    [allTemplates, category]
  );

  const recurringTemplates = useMemo(
    () => templates.filter((t) => t.recurringConfig?.enabled),
    [templates]
  );

  const refetch = useCallback(async () => {
    await Promise.all([refetchInstances(), refetchTemplates()]);
  }, [refetchInstances, refetchTemplates]);

  const startWorkflow = useCallback(
    async (templateId: string, customName?: string): Promise<string | null> => {
      if (!tenantId || !project || !user) return null;

      try {
        // Activate service if not started
        const service = project.services.find((s) => s.category === category);
        if (service && service.status === 'not_started') {
          await activateService(
            tenantId,
            project.id,
            category,
            user.uid,
            user.displayName || user.email || 'Unknown'
          );
        }

        const instanceId = await instantiateWorkflow(
          tenantId,
          templateId,
          project.id,
          customName || project.name,
          project.clientName,
          user.uid
        );

        await refetch();
        return instanceId;
      } catch (err) {
        console.error('Error starting workflow:', err);
        return null;
      }
    },
    [tenantId, project, user, category, refetch]
  );

  return {
    setupInstances,
    recurringInstances,
    onDemandInstances,
    templates,
    recurringTemplates,
    loading: instancesLoading || templatesLoading,
    error: instancesError || templatesError,
    startWorkflow,
    refetch,
  };
}
