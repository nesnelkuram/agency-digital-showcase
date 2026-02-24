import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkflowInstances } from '@/shared/hooks/useWorkflowInstances';
import { getWorkflowTemplates } from '@/shared/services/workflowTemplateService';
import { instantiateWorkflow } from '@/shared/services/workflowEngineService';
import { activateService } from '@/shared/services/projectService';
import type { WorkflowInstance } from '@/shared/types/workflow/instance';
import type { WorkflowTemplate } from '@/shared/types/workflow/template';
import type { Project } from '@/shared/types/project';
import type { ServiceCategory } from '@/shared/types/pricing/services';

interface UseProjectWorkflowsReturn {
  instancesByCategory: Record<string, WorkflowInstance[]>;
  templatesByCategory: Record<string, WorkflowTemplate[]>;
  allInstances: WorkflowInstance[];
  allTemplates: WorkflowTemplate[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  startWorkflow: (templateId: string, category: ServiceCategory, customName?: string) => Promise<string | null>;
}

export function useProjectWorkflows(projectId: string, project: Project | null): UseProjectWorkflowsReturn {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { instances, loading: instancesLoading, error: instancesError, refetch: refetchInstances } = useWorkflowInstances({ projectId });

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // Fetch published templates for the project's service categories
  const fetchTemplates = useCallback(async () => {
    if (!tenantId || !project) {
      setTemplatesLoading(false);
      return;
    }

    try {
      setTemplatesLoading(true);
      setTemplatesError(null);

      // Fetch all root templates (depth=0) without a status filter.
      // Filtering by status in the Firestore query requires a composite index
      // (tenantId + isLatest + status + createdAt) that may not be deployed yet.
      // Instead we fetch all and filter client-side to include both published and
      // draft templates so that teams can start workflows without first publishing.
      const data = await getWorkflowTemplates(tenantId, {});
      // Root-level only (exclude child/subprocess templates)
      setTemplates(data.filter(t => (t.depth ?? 0) === 0 && t.status !== 'archived'));
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : 'Failed to fetch workflow templates');
      console.error('Error fetching workflow templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  }, [tenantId, project]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Group instances by serviceCategory
  const instancesByCategory = useMemo(() => {
    const grouped: Record<string, WorkflowInstance[]> = {};
    for (const instance of instances) {
      const cat = instance.serviceCategory || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(instance);
    }
    return grouped;
  }, [instances]);

  // Group published templates by serviceCategory
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, WorkflowTemplate[]> = {};
    for (const template of templates) {
      const cat = template.serviceCategory;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(template);
    }
    return grouped;
  }, [templates]);

  const refetch = useCallback(async () => {
    await Promise.all([refetchInstances(), fetchTemplates()]);
  }, [refetchInstances, fetchTemplates]);

  const startWorkflow = useCallback(async (
    templateId: string,
    category: ServiceCategory,
    customName?: string
  ): Promise<string | null> => {
    if (!tenantId || !project || !user) return null;

    try {
      // Check if the service is not_started, then activate it
      const service = project.services.find(s => s.category === category);
      if (service && service.status === 'not_started') {
        await activateService(
          tenantId,
          project.id,
          category,
          user.uid,
          user.displayName || user.email || 'Unknown'
        );
      }

      // Instantiate the workflow
      const instanceId = await instantiateWorkflow(
        tenantId,
        templateId,
        project.id,
        customName || project.name,
        project.clientName,
        user.uid,
      );

      // Refetch data
      await refetch();

      return instanceId;
    } catch (err) {
      console.error('Error starting workflow:', err);
      return null;
    }
  }, [tenantId, project, user, refetch]);

  return {
    instancesByCategory,
    templatesByCategory,
    allInstances: instances,
    allTemplates: templates,
    loading: instancesLoading || templatesLoading,
    error: instancesError || templatesError,
    refetch,
    startWorkflow,
  };
}
