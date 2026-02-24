import { useState, useEffect, useCallback } from 'react';
import { useTenantId } from '@/shared/hooks/useTenant';
import {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
} from '@/shared/services/agentService';
import type { AIAgent } from '@/shared/types/agent';

interface UseAgentsFilters {
  agentType?: string;
  status?: string;
}

interface UseAgentsReturn {
  agents: AIAgent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createAgent: (data: Parameters<typeof createAgent>[1]) => Promise<string | null>;
  updateAgent: (id: string, data: Partial<Omit<AIAgent, 'id' | 'tenantId' | 'createdAt'>>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
}

interface UseAgentReturn {
  agent: AIAgent | null;
  loading: boolean;
  error: string | null;
}

export function useAgents(filters?: UseAgentsFilters): UseAgentsReturn {
  const tenantId = useTenantId();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getAgents(tenantId, filters);
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ajanlar yuklenemedi');
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, filters?.agentType, filters?.status]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreate = useCallback(
    async (data: Parameters<typeof createAgent>[1]): Promise<string | null> => {
      if (!tenantId) {
        setError('Tenant ID bulunamadi');
        return null;
      }
      try {
        setError(null);
        const id = await createAgent(tenantId, data);
        await fetchAgents();
        return id;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ajan olusturulamadi');
        console.error('Error creating agent:', err);
        return null;
      }
    },
    [tenantId, fetchAgents]
  );

  const handleUpdate = useCallback(
    async (
      id: string,
      data: Partial<Omit<AIAgent, 'id' | 'tenantId' | 'createdAt'>>
    ): Promise<void> => {
      if (!tenantId) {
        setError('Tenant ID bulunamadi');
        return;
      }
      try {
        setError(null);
        setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
        await updateAgent(tenantId, id, data);
        await fetchAgents();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ajan guncellenemedi');
        console.error('Error updating agent:', err);
        await fetchAgents();
      }
    },
    [tenantId, fetchAgents]
  );

  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!tenantId) {
        setError('Tenant ID bulunamadi');
        return;
      }
      try {
        setError(null);
        setAgents((prev) => prev.filter((a) => a.id !== id));
        await deleteAgent(tenantId, id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ajan silinemedi');
        console.error('Error deleting agent:', err);
        await fetchAgents();
      }
    },
    [tenantId, fetchAgents]
  );

  return {
    agents,
    loading,
    error,
    refetch: fetchAgents,
    createAgent: handleCreate,
    updateAgent: handleUpdate,
    deleteAgent: handleDelete,
  };
}

export function useAgent(agentId: string | undefined): UseAgentReturn {
  const tenantId = useTenantId();
  const [agent, setAgent] = useState<AIAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgent = useCallback(async () => {
    if (!tenantId || !agentId) {
      setLoading(false);
      setAgent(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getAgent(tenantId, agentId);
      setAgent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ajan yuklenemedi');
      console.error('Error fetching agent:', err);
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, agentId]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  return { agent, loading, error };
}
