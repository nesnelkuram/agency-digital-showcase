/**
 * Pure helper — bir müşteri kullanıcısının bir content_plan'ı görüp göremeyeceğini belirler.
 * Firestore bağımlılığı yok; unit test edilebilir.
 */

import type { ContentPlan, ContentPlanStatus } from '@/shared/types/socialMedia';

export const CLIENT_VISIBLE_STATUSES = new Set<ContentPlanStatus>([
  'pending_approval',
  'partially_approved',
  'approved',
  'revision_requested',
]);

export interface ClientContext {
  uid: string;
  email: string;
  assignedProjectIds: string[];
}

export interface PlanMatchResult {
  visible: boolean;
  reason: 'uid' | 'email' | 'project' | 'status_hidden' | 'no_match';
  details: {
    statusVisible: boolean;
    byUid: boolean;
    byEmail: boolean;
    byProject: boolean;
  };
}

/**
 * İki stringi normalize eder: trim + lowercase.
 */
export function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Plan'ın müşteriye görünür olup olmadığını ve nedenini döndürür.
 */
export function matchPlanForClient(
  plan: Pick<
    ContentPlan,
    'status' | 'assignedClientId' | 'assignedClientEmail' | 'projectId'
  >,
  client: ClientContext
): PlanMatchResult {
  const statusVisible = CLIENT_VISIBLE_STATUSES.has(plan.status);
  const byUid = Boolean(plan.assignedClientId && plan.assignedClientId === client.uid);
  const byEmail =
    Boolean(plan.assignedClientEmail) &&
    normalizeEmail(plan.assignedClientEmail) === normalizeEmail(client.email);
  const byProject = Boolean(
    plan.projectId && client.assignedProjectIds.includes(plan.projectId)
  );

  if (!statusVisible) {
    return {
      visible: false,
      reason: 'status_hidden',
      details: { statusVisible, byUid, byEmail, byProject },
    };
  }

  if (byUid)
    return {
      visible: true,
      reason: 'uid',
      details: { statusVisible, byUid, byEmail, byProject },
    };
  if (byEmail)
    return {
      visible: true,
      reason: 'email',
      details: { statusVisible, byUid, byEmail, byProject },
    };
  if (byProject)
    return {
      visible: true,
      reason: 'project',
      details: { statusVisible, byUid, byEmail, byProject },
    };

  return {
    visible: false,
    reason: 'no_match',
    details: { statusVisible, byUid, byEmail, byProject },
  };
}

/**
 * Bir liste içinden müşterinin görebileceği planları filtreler.
 */
export function filterPlansForClient<T extends Parameters<typeof matchPlanForClient>[0]>(
  plans: T[],
  client: ClientContext
): T[] {
  return plans.filter((p) => matchPlanForClient(p, client).visible);
}
