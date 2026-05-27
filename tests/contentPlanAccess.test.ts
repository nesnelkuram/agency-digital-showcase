import { describe, it, expect } from 'vitest';
import {
  matchPlanForClient,
  filterPlansForClient,
  normalizeEmail,
  CLIENT_VISIBLE_STATUSES,
} from '@/shared/services/contentPlanAccess';

// ─── Test fixtures ──────────────────────────────────────────────────────────
const CLIENT = {
  uid: 'user-seray-123',
  email: 'seray@ornek.com',
  assignedProjectIds: ['proj-racle'],
};

const BASE_PLAN = {
  status: 'pending_approval' as const,
  assignedClientId: undefined as string | undefined,
  assignedClientEmail: undefined as string | undefined,
  projectId: 'proj-racle',
};

// ─── normalizeEmail ─────────────────────────────────────────────────────────
describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  SERAY@Ornek.Com  ')).toBe('seray@ornek.com');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail('')).toBe('');
  });

  it('leaves already-normalized email alone', () => {
    expect(normalizeEmail('seray@ornek.com')).toBe('seray@ornek.com');
  });
});

// ─── matchPlanForClient: visibility rules ───────────────────────────────────
describe('matchPlanForClient', () => {
  it('matches by assignedClientId (uid)', () => {
    const plan = { ...BASE_PLAN, assignedClientId: CLIENT.uid, projectId: 'other' };
    const result = matchPlanForClient(plan, { ...CLIENT, assignedProjectIds: [] });
    expect(result.visible).toBe(true);
    expect(result.reason).toBe('uid');
    expect(result.details.byUid).toBe(true);
  });

  it('matches by assignedClientEmail even when uid is different', () => {
    const plan = {
      ...BASE_PLAN,
      assignedClientId: 'someone-else',
      assignedClientEmail: 'seray@ornek.com',
      projectId: 'other',
    };
    const result = matchPlanForClient(plan, { ...CLIENT, assignedProjectIds: [] });
    expect(result.visible).toBe(true);
    expect(result.reason).toBe('email');
  });

  it('matches by project assignment when no uid/email match', () => {
    const plan = { ...BASE_PLAN, projectId: 'proj-racle' };
    const result = matchPlanForClient(plan, CLIENT);
    expect(result.visible).toBe(true);
    expect(result.reason).toBe('project');
  });

  it('does NOT match when plan is draft', () => {
    const plan = { ...BASE_PLAN, status: 'draft' as const, assignedClientId: CLIENT.uid };
    const result = matchPlanForClient(plan, CLIENT);
    expect(result.visible).toBe(false);
    expect(result.reason).toBe('status_hidden');
  });

  it('does NOT match when plan is internal_review', () => {
    const plan = {
      ...BASE_PLAN,
      status: 'internal_review' as const,
      assignedClientEmail: 'seray@ornek.com',
    };
    const result = matchPlanForClient(plan, CLIENT);
    expect(result.visible).toBe(false);
    expect(result.reason).toBe('status_hidden');
  });

  it('matches when plan is approved', () => {
    const plan = { ...BASE_PLAN, status: 'approved' as const, assignedClientId: CLIENT.uid };
    const result = matchPlanForClient(plan, CLIENT);
    expect(result.visible).toBe(true);
  });

  it('matches when plan is revision_requested', () => {
    const plan = {
      ...BASE_PLAN,
      status: 'revision_requested' as const,
      assignedClientEmail: 'seray@ornek.com',
    };
    const result = matchPlanForClient(plan, { ...CLIENT, assignedProjectIds: [] });
    expect(result.visible).toBe(true);
  });

  it('matches when plan is partially_approved', () => {
    const plan = {
      ...BASE_PLAN,
      status: 'partially_approved' as const,
      projectId: 'proj-racle',
    };
    const result = matchPlanForClient(plan, CLIENT);
    expect(result.visible).toBe(true);
  });

  it('is case-insensitive for email matching', () => {
    const plan = { ...BASE_PLAN, assignedClientEmail: 'SERAY@Ornek.COM' };
    const result = matchPlanForClient(plan, {
      ...CLIENT,
      email: '  seray@ornek.com  ',
      assignedProjectIds: [],
    });
    expect(result.visible).toBe(true);
    expect(result.reason).toBe('email');
  });

  it('does NOT match when user has no uid/email/project overlap', () => {
    const plan = {
      status: 'pending_approval' as const,
      assignedClientId: 'another-user',
      assignedClientEmail: 'someone@else.com',
      projectId: 'proj-other',
    };
    const result = matchPlanForClient(plan, CLIENT);
    expect(result.visible).toBe(false);
    expect(result.reason).toBe('no_match');
  });

  it('handles missing projectId gracefully', () => {
    const plan = { ...BASE_PLAN, projectId: undefined as any };
    const result = matchPlanForClient(plan, CLIENT);
    expect(result.details.byProject).toBe(false);
  });

  it('handles undefined assignedClientId without matching null-to-empty', () => {
    const plan = { ...BASE_PLAN, assignedClientId: undefined };
    const result = matchPlanForClient(plan, { ...CLIENT, uid: '' });
    expect(result.details.byUid).toBe(false);
  });

  it('prefers uid match over email/project in reason', () => {
    const plan = {
      status: 'pending_approval' as const,
      assignedClientId: CLIENT.uid,
      assignedClientEmail: CLIENT.email,
      projectId: 'proj-racle',
    };
    const result = matchPlanForClient(plan, CLIENT);
    expect(result.visible).toBe(true);
    expect(result.reason).toBe('uid');
  });
});

// ─── filterPlansForClient ───────────────────────────────────────────────────
describe('filterPlansForClient', () => {
  it('filters only visible plans', () => {
    const plans = [
      { ...BASE_PLAN, status: 'draft' as const, assignedClientId: CLIENT.uid },
      { ...BASE_PLAN, status: 'pending_approval' as const, assignedClientId: CLIENT.uid },
      { ...BASE_PLAN, status: 'approved' as const, assignedClientEmail: CLIENT.email },
      { ...BASE_PLAN, status: 'pending_approval' as const, assignedClientId: 'other' },
    ];
    const filtered = filterPlansForClient(plans, { ...CLIENT, assignedProjectIds: [] });
    expect(filtered).toHaveLength(2);
  });

  it('returns empty array when nothing matches', () => {
    const plans = [
      {
        status: 'pending_approval' as const,
        assignedClientId: 'other',
        assignedClientEmail: 'other@x.com',
        projectId: 'proj-other',
      },
    ];
    const filtered = filterPlansForClient(plans, CLIENT);
    expect(filtered).toHaveLength(0);
  });

  it('returns all when all match', () => {
    const plans = [
      { ...BASE_PLAN, assignedClientId: CLIENT.uid },
      { ...BASE_PLAN, assignedClientEmail: CLIENT.email },
      { ...BASE_PLAN, projectId: 'proj-racle' },
    ];
    const filtered = filterPlansForClient(plans, CLIENT);
    expect(filtered).toHaveLength(3);
  });
});

// ─── CLIENT_VISIBLE_STATUSES ────────────────────────────────────────────────
describe('CLIENT_VISIBLE_STATUSES', () => {
  it('includes all approval-related statuses', () => {
    expect(CLIENT_VISIBLE_STATUSES.has('pending_approval')).toBe(true);
    expect(CLIENT_VISIBLE_STATUSES.has('partially_approved')).toBe(true);
    expect(CLIENT_VISIBLE_STATUSES.has('approved')).toBe(true);
    expect(CLIENT_VISIBLE_STATUSES.has('revision_requested')).toBe(true);
  });

  it('excludes draft and internal_review', () => {
    expect(CLIENT_VISIBLE_STATUSES.has('draft')).toBe(false);
    expect(CLIENT_VISIBLE_STATUSES.has('internal_review')).toBe(false);
  });
});
