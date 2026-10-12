/** Konuşmalı marka rehberi istemcisi (/api/studio/brand-guide) ve marka dili durumu. Hata gövdesi Türkçe mesaj + kodla fırlatılır; sessiz yutma yok. */
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import type { BrandBrief, BrandGuide } from '@/shared/planner/brandGuide';

export class GuideApiError extends Error {
  constructor(message: string, public code: string, public status: number, public details?: unknown) {
    super(message);
  }
}

export interface GuideDraftDTO {
  version: number;
  guide: BrandGuide;
  contentKey: string;
  origin: 'ai' | 'human';
  baseApprovedVersion: number | null;
  assumptions: string[];
  droppedFacts: string[];
  updatedAt: number;
}
export interface GuideApprovedDTO { version: number; guide: BrandGuide; contentKey: string; approvedAt: number; approvedBy: string }
export interface GuideState { draft: GuideDraftDTO | null; approved: GuideApprovedDTO | null; bundleExists: boolean; aiEnabled: boolean }

async function call(init?: RequestInit, query?: string): Promise<any> {
  let res: Response;
  try {
    res = await authenticatedFetch(`/api/studio/brand-guide${query ?? ''}`, init);
  } catch (e: any) {
    throw new GuideApiError(e?.message === 'Not authenticated' ? 'Oturum açık değil.' : `Sunucuya ulaşılamadı: ${e?.message ?? e}`, 'network', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new GuideApiError(body?.error || `İstek başarısız (${res.status})`, body?.code || `http_${res.status}`, res.status, body?.details);
  return body;
}

export const getGuideState = (projectId: string): Promise<GuideState> => call(undefined, `?${new URLSearchParams({ projectId })}`);
const post = (b: Record<string, unknown>) => call({ method: 'POST', body: JSON.stringify(b) });
export const generateGuideDraft = (a: { projectId: string; brief: BrandBrief; expectedDraftVersion: number; idempotencyKey: string }): Promise<{ draft: GuideDraftDTO; replayed: boolean }> => post({ ...a, action: 'generate' });
export const saveGuideDraft = (a: { projectId: string; guide: BrandGuide; expectedDraftVersion: number; idempotencyKey: string }): Promise<{ draft: GuideDraftDTO; replayed: boolean }> => post({ ...a, action: 'save' });
export const approveGuide = (a: { projectId: string; expectedDraftVersion: number; contentKey: string; expectedApprovedVersion: number | null; idempotencyKey: string }): Promise<{ approved: GuideApprovedDTO; replayed: boolean }> => post({ ...a, action: 'approve', confirm: true });

export const newGuideKey = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}-${Math.random().toString(36).slice(2, 14)}`).slice(0, 64);

/** Marka dili durumu (planlayıcı için): onaylı bir kaynak (yüklü paket veya onaylı rehber) var mı? Okunamazsa approved=null (sunucu karar verir). */
export interface VoiceState { approved: boolean | null; bundle: boolean; guideVersion: number | null; loading: boolean; error?: string }
export async function loadVoiceState(projectId: string): Promise<VoiceState> {
  const [bundle, guide] = await Promise.allSettled([
    authenticatedFetch(`/api/studio/brand-voice?${new URLSearchParams({ projectId })}`).then(async (r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }),
    getGuideState(projectId),
  ]);
  const hasBundle = bundle.status === 'fulfilled' ? !!bundle.value?.exists && bundle.value?.valid !== false : null;
  const gv = guide.status === 'fulfilled' ? guide.value.approved?.version ?? null : null;
  if (hasBundle === true || gv !== null) return { approved: true, bundle: hasBundle === true, guideVersion: gv, loading: false };
  if (bundle.status === 'rejected' || guide.status === 'rejected') return { approved: null, bundle: false, guideVersion: null, loading: false, error: 'Marka dili durumu okunamadı; sunucu karar verecek.' };
  return { approved: false, bundle: false, guideVersion: null, loading: false };
}
