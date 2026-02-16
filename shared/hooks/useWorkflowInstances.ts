import { useState, useEffect, useCallback } from 'react';
import { useTenantId } from '@/shared/hooks/useTenant';
import {
  getWorkflowInstances,
  getWorkflowInstance,
  getInstancesByProject,
  getActiveStepsForUser
} from '@/shared/services/workflowInstanceService';
import type { WorkflowInstance, StepInstance } from '@/shared/types/workflow';

interface UseWorkflowInstancesReturn {
  instances: WorkflowInstance[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseWorkflowInstanceReturn {
  instance: WorkflowInstance | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseMyWorkflowStepsReturn {
  steps: Array<{ instance: WorkflowInstance; nodeId: string; step: StepInstance }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseWorkflowInstancesFilters {
  projectId?: string;
  status?: string;
}

export function useWorkflowInstances(filters?: UseWorkflowInstancesFilters): UseWorkflowInstancesReturn {
  const tenantId = useTenantId();
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let data: WorkflowInstance[];
      if (filters?.projectId) {
        data = await getInstancesByProject(tenantId, filters.projectId);
        // Apply status filter if provided
        if (filters.status) {
          data = data.filter(instance => instance.status === filters.status);
        }
      } else {
        data = await getWorkflowInstances(tenantId, filters);
      }

      setInstances(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workflow instances');
      console.error('Error fetching workflow instances:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, filters?.projectId, filters?.status]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  return {
    instances,
    loading,
    error,
    refetch: fetchInstances,
  };
}

export function useWorkflowInstance(instanceId: string | undefined): UseWorkflowInstanceReturn {
  const tenantId = useTenantId();
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstance = useCallback(async () => {
    if (!tenantId || !instanceId) {
      setLoading(false);
      setInstance(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getWorkflowInstance(tenantId, instanceId);
      setInstance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workflow instance');
      console.error('Error fetching workflow instance:', err);
      setInstance(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, instanceId]);

  useEffect(() => {
    fetchInstance();
  }, [fetchInstance]);

  return {
    instance,
    loading,
    error,
    refetch: fetchInstance,
  };
}

export function useMyWorkflowSteps(userId: string | undefined): UseMyWorkflowStepsReturn {
  const tenantId = useTenantId();
  const [steps, setSteps] = useState<Array<{ instance: WorkflowInstance; nodeId: string; step: StepInstance }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSteps = useCallback(async () => {
    if (!tenantId || !userId) {
      setLoading(false);
      setSteps([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getActiveStepsForUser(tenantId, userId);
      setSteps(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch active workflow steps');
      console.error('Error fetching active workflow steps:', err);
      setSteps([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  return {
    steps,
    loading,
    error,
    refetch: fetchSteps,
  };
}
