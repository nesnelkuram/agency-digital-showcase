/**
 * Studio veri erişimi. Marka yöneticisi yalnızca atanmış projeleri okuyabilir (firestore.rules);
 * bu yüzden her sorgu tenantId + projectId filtresi taşır.
 */

import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import type { ContentPlan, SocialMediaPost } from '@/shared/types/socialMedia';

export interface StudioProject {
  id: string;
  name: string;
  clientName?: string;
  clientEmail?: string;
  description?: string;
}

function toProject(id: string, data: any): StudioProject {
  return {
    id,
    name: data?.name || 'Marka',
    clientName: data?.clientName,
    clientEmail: data?.clientEmail,
    description: data?.description,
  };
}

/** Marka yöneticisi: atanmış projeler. Yönetici önizlemesi: tenant'taki projeler. */
export async function getStudioProjects(params: {
  tenantId: string;
  role: string;
  assignedProjectIds: string[];
}): Promise<StudioProject[]> {
  if (!db) return [];
  if (params.role === 'brand_manager') {
    const docs = await Promise.all(
      params.assignedProjectIds.map((id) => getDoc(doc(db!, 'projects', id)).catch(() => null))
    );
    return docs.filter((d): d is NonNullable<typeof d> => !!d && d.exists()).map((d) => toProject(d.id, d.data()));
  }
  const snap = await getDocs(query(collection(db, 'projects'), where('tenantId', '==', params.tenantId), limit(100)));
  return snap.docs.map((d) => toProject(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

export async function getProjectPosts(tenantId: string, projectId: string): Promise<SocialMediaPost[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(
      collection(db, 'social_media_posts'),
      where('tenantId', '==', tenantId),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc'),
      limit(300)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SocialMediaPost);
}

/**
 * Planın tüm üyeleri — proje genelindeki son-kayıt sınırından bağımsız.
 * contentPlanId bağı + eski plan.postIds; tenant/proje uyumlu olanlar.
 */
export async function getPlanPosts(tenantId: string, plan: ContentPlan): Promise<SocialMediaPost[]> {
  if (!db) return [];
  const byId = new Map<string, SocialMediaPost>();
  const snap = await getDocs(
    query(
      collection(db, 'social_media_posts'),
      where('tenantId', '==', tenantId),
      where('projectId', '==', plan.projectId),
      where('contentPlanId', '==', plan.id)
    )
  );
  snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() } as SocialMediaPost));
  const legacyIds = (plan.postIds || []).filter((id) => !byId.has(id));
  const legacy = await Promise.all(legacyIds.map((id) => getDoc(doc(db!, 'social_media_posts', id)).catch(() => null)));
  for (const d of legacy) {
    if (!d || !d.exists()) continue;
    const data = d.data() as any;
    if (data.projectId !== plan.projectId || (data.tenantId && data.tenantId !== tenantId)) continue;
    if (data.contentPlanId && data.contentPlanId !== plan.id) continue;
    byId.set(d.id, { id: d.id, ...data } as SocialMediaPost);
  }
  return Array.from(byId.values());
}

export async function getProjectPlans(tenantId: string, projectId: string): Promise<ContentPlan[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(
      collection(db, 'content_plans'),
      where('tenantId', '==', tenantId),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc'),
      limit(100)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContentPlan);
}

export async function getPlan(planId: string): Promise<ContentPlan | null> {
  if (!db) return null;
  const d = await getDoc(doc(db, 'content_plans', planId));
  return d.exists() ? ({ id: d.id, ...d.data() } as ContentPlan) : null;
}

export interface BrandKit {
  project: { id: string; name: string; description: string; clientName: string; clientEmail: string };
  brand: {
    brandName: string;
    voiceSummary: string;
    hasAnalysis: boolean;
    sourceFields: Record<string, any>;
  } | null;
}

export async function getBrandKit(projectId: string): Promise<BrandKit> {
  const res = await authenticatedFetch(`/api/studio/brand-kit?projectId=${encodeURIComponent(projectId)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Marka kiti yüklenemedi');
  return body as BrandKit;
}

/**
 * Bildirim hedefi Studio'da: Studio linki olduğu gibi; plan hedefi varsa Studio plan sayfası;
 * eski admin linkleri (ör. /admin/social-media) → Studio ana sayfası.
 */
export function studioLinkFor(n: { link?: string; projectId?: string; planId?: string }): string {
  if (n.link?.startsWith('/studio')) return n.link;
  if (n.projectId && n.planId) return `/studio/${n.projectId}/planlar/${n.planId}`;
  if (n.projectId) return `/studio/${n.projectId}`;
  return '/studio';
}

// ── Post durum grupları (Şeyma'nın yapacağı işe göre) ──

/** Şeyma'dan aksiyon bekleyenler */
export const NEEDS_ME = new Set(['draft', 'internal_review', 'revision_requested_internal', 'revision_requested']);
/** Firmada bekleyenler */
export const WITH_CLIENT = new Set(['pending_approval']);
/** Onaylı / yayına hazır */
export const DONE = new Set(['approved', 'scheduled', 'published']);

export const STUDIO_STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  internal_review: 'Kontrolünde',
  revision_requested_internal: 'Düzeltilecek',
  revision_requested: 'Firma revizyon istedi',
  pending_approval: 'Firmada',
  approved: 'Onaylandı',
  scheduled: 'Zamanlandı',
  published: 'Yayında',
  failed: 'Hata',
};

export const STUDIO_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-600',
  internal_review: 'bg-sky-100 text-sky-700',
  revision_requested_internal: 'bg-orange-100 text-orange-700',
  revision_requested: 'bg-red-100 text-red-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  scheduled: 'bg-emerald-100 text-emerald-700',
  published: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-700',
};

export function postThumb(post: SocialMediaPost): string | null {
  const m = post.media?.[0];
  if (m) return m.thumbnailUrl || (m.type === 'video' ? null : m.url) || null;
  return post.mediaUrls?.[0] || null;
}

export function formatDate(ts: any, withTime = false): string {
  const d: Date | undefined = ts?.toDate?.();
  if (!d) return '';
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function daysSince(ts: any): number | null {
  const d: Date | undefined = ts?.toDate?.();
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}
