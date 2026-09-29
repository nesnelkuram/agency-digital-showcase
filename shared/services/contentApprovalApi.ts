/**
 * İçerik onay API istemcisi.
 * Onay durumları yalnızca sunucudan değişir; istemci doğrudan Firestore'a durum yazmaz.
 */

import { Timestamp } from 'firebase/firestore';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import type { ContentPlan, ContentPlanStatus, PostApprovalSummary, SocialMediaPost, ApprovalConfig } from '@/shared/types/socialMedia';

export type ApprovalActionName =
  | 'submit_for_review'
  | 'internal_approve'
  | 'internal_reject'
  | 'submit_to_client'
  | 'resubmit'
  | 'reopen'
  | 'client_approve'
  | 'client_reject'
  | 'client_undo'
  | 'comment'
  | 'update_approval_config';

export interface ApprovalResponse {
  success: true;
  updatedPosts: { postId: string; fromStatus: string; newStatus: string }[];
  planStatus: ContentPlanStatus;
  postApprovalSummary: PostApprovalSummary;
  reviewRequestId: string | null;
}

export class ApprovalApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = 'ApprovalApiError';
  }
  /** Müşteri eski bir inceleme turunu görüyor — sayfa yenilenmeli */
  get isStale() {
    return this.code === 'STALE_REVIEW';
  }
}

async function parse(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApprovalApiError(body?.error || `İstek başarısız (${res.status})`, body?.code, res.status);
  return body;
}

export async function runApprovalAction(params: {
  planId: string;
  action: ApprovalActionName;
  postIds?: string[];
  comment?: string;
  reviewRequestId?: string | null;
  assignee?: { clientId?: string; clientName: string; clientEmail: string };
  approvalConfig?: Partial<ApprovalConfig>;
}): Promise<ApprovalResponse> {
  const res = await authenticatedFetch('/api/content-approval/transition', {
    method: 'POST',
    body: JSON.stringify({ ...params, reviewRequestId: params.reviewRequestId || undefined }),
  });
  return parse(res);
}

/** Portal: tek post kararı */
export async function reviewSinglePost(params: {
  postId: string;
  /** Eski kayıtlarda post'ta contentPlanId olmayabilir — portalın gördüğü plan */
  planId?: string;
  action: 'approve' | 'revise' | 'undo';
  comment?: string;
  reviewRequestId?: string | null;
}): Promise<ApprovalResponse> {
  const res = await authenticatedFetch('/api/social-media/client-review-post', {
    method: 'POST',
    body: JSON.stringify({ ...params, reviewRequestId: params.reviewRequestId || undefined }),
  });
  return parse(res);
}

/** Paylaşım linki (oturumsuz) müşteri kararı */
export async function shareClientAction(params: {
  shareToken: string;
  action: 'client_approve' | 'client_reject' | 'comment';
  clientName: string;
  comment?: string;
  postIds?: string[];
  reviewRequestId?: string | null;
}): Promise<ApprovalResponse> {
  const res = await fetch('/api/content-approval/client-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, reviewRequestId: params.reviewRequestId || undefined }),
  });
  return parse(res);
}

/** {__ts: millis} → Firestore Timestamp (sunucu serileştirmesinin tersi) */
export function reviveTimestamps<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  const v: any = value;
  if (typeof v.__ts === 'number' && Object.keys(v).length === 1) return Timestamp.fromMillis(v.__ts) as any;
  if (Array.isArray(v)) return v.map(reviveTimestamps) as any;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) out[k] = reviveTimestamps(val);
  return out as T;
}

/** Paylaşım linki ile plan + post'ları okur (token sunucuda doğrulanır) */
export async function getSharedPlan(shareToken: string): Promise<{ plan: ContentPlan; posts: SocialMediaPost[] } | null> {
  const res = await fetch(`/api/content-approval/share?token=${encodeURIComponent(shareToken)}`);
  if (res.status === 404) return null;
  const body = await parse(res);
  return reviveTimestamps(body) as { plan: ContentPlan; posts: SocialMediaPost[] };
}

export interface PortalProject {
  id: string;
  name?: string;
  status?: string;
  clientName?: string;
  clientId?: string;
  description?: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  createdAt?: Timestamp;
}

/** Müşteri portalı verisi — sunucuda filtrelenmiş projeler, planlar ve müşteriye açık post'lar */
export async function getPortalData(planId?: string): Promise<{
  projects: PortalProject[];
  plans: ContentPlan[];
  posts: SocialMediaPost[];
}> {
  const url = planId ? `/api/portal/data?planId=${encodeURIComponent(planId)}` : '/api/portal/data';
  const res = await authenticatedFetch(url);
  return reviveTimestamps(await parse(res));
}
