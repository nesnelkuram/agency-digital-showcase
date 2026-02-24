import { useState, useEffect, useCallback } from 'react';
import { useTenantId } from '@/shared/hooks/useTenant';
import {
  getWorkflowTemplates,
  getRootTemplates,
  getWorkflowTemplate,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  publishWorkflowTemplate,
  archiveWorkflowTemplate,
  deleteWorkflowTemplate
} from '@/shared/services/workflowTemplateService';
import type { WorkflowTemplate } from '@/shared/types/workflow';

interface UseWorkflowTemplatesReturn {
  templates: WorkflowTemplate[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTemplate: (data: Parameters<typeof createWorkflowTemplate>[1]) => Promise<string | null>;
  updateTemplate: (id: string, data: Partial<WorkflowTemplate>) => Promise<void>;
  publishTemplate: (id: string) => Promise<void>;
  archiveTemplate: (id: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

interface UseWorkflowTemplateReturn {
  template: WorkflowTemplate | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseWorkflowTemplatesFilters {
  serviceCategory?: string;
  status?: string;
  rootOnly?: boolean;
}

export function useWorkflowTemplates(filters?: UseWorkflowTemplatesFilters): UseWorkflowTemplatesReturn {
  const tenantId = useTenantId();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = filters?.rootOnly
        ? await getRootTemplates(tenantId, filters)
        : await getWorkflowTemplates(tenantId, filters);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workflow templates');
      console.error('Error fetching workflow templates:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, filters?.serviceCategory, filters?.status, filters?.rootOnly]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(async (data: Parameters<typeof createWorkflowTemplate>[1]): Promise<string | null> => {
    if (!tenantId) {
      setError('No tenant ID available');
      return null;
    }

    try {
      setError(null);
      const templateId = await createWorkflowTemplate(tenantId, data);
      await fetchTemplates();
      return templateId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow template');
      console.error('Error creating workflow template:', err);
      return null;
    }
  }, [tenantId, fetchTemplates]);

  const updateTemplate = useCallback(async (id: string, data: Partial<WorkflowTemplate>): Promise<void> => {
    if (!tenantId) {
      setError('No tenant ID available');
      return;
    }

    try {
      setError(null);
      // Optimistic update
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t));

      await updateWorkflowTemplate(tenantId, id, data);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workflow template');
      console.error('Error updating workflow template:', err);
      // Revert optimistic update
      await fetchTemplates();
    }
  }, [tenantId, fetchTemplates]);

  const publishTemplate = useCallback(async (id: string): Promise<void> => {
    if (!tenantId) {
      setError('No tenant ID available');
      return;
    }

    try {
      setError(null);
      // Optimistic update
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, status: 'published' as const, updatedAt: new Date().toISOString() } : t));

      await publishWorkflowTemplate(tenantId, id);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish workflow template');
      console.error('Error publishing workflow template:', err);
      // Revert optimistic update
      await fetchTemplates();
    }
  }, [tenantId, fetchTemplates]);

  const archiveTemplate = useCallback(async (id: string): Promise<void> => {
    if (!tenantId) {
      setError('No tenant ID available');
      return;
    }

    try {
      setError(null);
      // Optimistic update
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, status: 'archived' as const, updatedAt: new Date().toISOString() } : t));

      await archiveWorkflowTemplate(tenantId, id);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive workflow template');
      console.error('Error archiving workflow template:', err);
      // Revert optimistic update
      await fetchTemplates();
    }
  }, [tenantId, fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    if (!tenantId) {
      setError('No tenant ID available');
      return;
    }

    try {
      setError(null);
      // Optimistic update
      setTemplates(prev => prev.filter(t => t.id !== id));

      await deleteWorkflowTemplate(tenantId, id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workflow template');
      console.error('Error deleting workflow template:', err);
      // Revert optimistic update
      await fetchTemplates();
    }
  }, [tenantId, fetchTemplates]);

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    publishTemplate,
    archiveTemplate,
    deleteTemplate,
  };
}

export function useWorkflowTemplate(templateId: string | undefined): UseWorkflowTemplateReturn {
  const tenantId = useTenantId();
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplate = useCallback(async () => {
    if (!tenantId || !templateId) {
      setLoading(false);
      setTemplate(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getWorkflowTemplate(tenantId, templateId);
      setTemplate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workflow template');
      console.error('Error fetching workflow template:', err);
      setTemplate(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, templateId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  return {
    template,
    loading,
    error,
    refetch: fetchTemplate,
  };
}
