import { readFileSync } from 'fs';
import path from 'path';

export const T = 't1';
export const P = 'p1';
export const BUCKET = 'demo.appspot.com';
export const HOST = 'firebasestorage.googleapis.com';
export const POLICY = { buckets: [BUCKET], hosts: [HOST] };
export const dlUrl = (p: string) => `https://${HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(p)}?alt=media&token=x`;

export interface SeedOpts {
  w?: number;
  h?: number;
  kind?: 'photo' | 'video';
  createdAt?: number;
  tenantId?: string;
  projectId?: string;
  status?: string;
}

/** Gerçek brand_media belge biçimi (shared/types/brandMedia.ts) — bellek-içi sahte Firestore'a yazılır; canlı değil. */
export function seedAsset(db: any, id: string, o: SeedOpts = {}) {
  const tenantId = o.tenantId ?? T;
  const projectId = o.projectId ?? P;
  const kind = o.kind ?? 'photo';
  const p = `brand-media/${tenantId}/${projectId}/${id}/${id}.jpg`;
  db.data.set(`brand_media/${id}`, {
    tenantId, projectId, kind, status: o.status ?? 'active', title: id, fileName: `${id}.jpg`, tags: [], createdBy: 'u1', createdAt: o.createdAt ?? 2_000,
    storage: {
      path: p, downloadUrl: dlUrl(p), contentType: kind === 'video' ? 'video/mp4' : 'image/jpeg', size: 500_000,
      width: o.w ?? 1080, height: o.h ?? 1350, ...(kind === 'video' ? { duration: 20 } : {}),
    },
  });
}

export const assetsOf = (db: any) =>
  [...db.data.entries()].filter(([k]: [string, any]) => k.startsWith('brand_media/')).map(([k, v]: [string, any]) => ({ id: k.split('/')[1], ...v }));

const fx = JSON.parse(readFileSync(path.resolve(__dirname, '../../../studio/feedPlanner/review/fixture.json'), 'utf8'));
/** Gerçek 9 seçili orijinalin kaynak boyutları (manifest): fixture'dan */
export const REAL_STORY: Array<{ id: string; w: number; h: number }> = fx.weeklyStory.map((id: string) => {
  const c = fx.candidates.find((x: any) => x.id === id);
  return { id, w: c.dims.w, h: c.dims.h };
});
