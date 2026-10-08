import { authenticatedFetch } from '@/lib/firebase/apiClient';

async function request(path: string, body: Record<string, unknown>) {
  const response = await authenticatedFetch(`/api/workflow/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'İş akışı işlemi tamamlanamadı.');
  return result;
}

export function completeWorkflowStep(instanceId: string, nodeId: string, formData: Record<string, unknown>) {
  return request('complete-step', { instanceId, nodeId, formData });
}

export function reviewWorkflowOutput(
  instanceId: string, nodeId: string, executionId: string,
  decision: 'approved' | 'rejected' | 'retry', reason?: string,
) {
  return request('review-output', { instanceId, nodeId, executionId, decision, reason });
}
