import { beforeEach, describe, expect, it, vi } from 'vitest';
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: fetchMock }));
import { completeWorkflowStep, reviewWorkflowOutput } from '@/shared/services/workflowApi';

describe('workflow server requests', () => {
  beforeEach(() => fetchMock.mockReset());
  it('sends form input to the authenticated server, without client-supplied scope or AI config', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await completeWorkflowStep('workflow', 'brief', { subject: 'Yeni koleksiyon' });
    expect(fetchMock).toHaveBeenCalledWith('/api/workflow/complete-step', {
      method: 'POST', body: JSON.stringify({ instanceId: 'workflow', nodeId: 'brief', formData: { subject: 'Yeni koleksiyon' } }),
    });
  });
  it('binds human approval to the reviewed execution and surfaces rejection', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'İnceleme güncel değil' }) });
    await expect(reviewWorkflowOutput('workflow', 'copy', 'old-run', 'approved')).rejects.toThrow('İnceleme güncel değil');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).executionId).toBe('old-run');
  });
});
