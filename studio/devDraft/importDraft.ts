/**
 * Yerel Dieci taslağını, GİRİŞ YAPMIŞ kullanıcının kendi oturumuyla native plan/post kayıtlarına aktarır.
 * Servis hesabı yok; yazımlar mevcut Firestore/Storage kurallarından geçer (yetkisiz kullanıcı yazamaz).
 * Idempotent: kimlikler deterministik; aynı içerik varsa atlanır, farklı içerik varsa HİÇBİR ŞEY yazılmaz.
 * Yayın/zamanlama/müşteri bildirimi yok; paylaşım tokenı yok; scheduledAt yazılmaz.
 */
import { Timestamp, collection, doc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getMetadata, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { buildNativeRecords, sha256Hex, validateNative, PLAN_COLLECTION, POST_COLLECTION } from '../../scripts/lib/dietiDraftImport.mjs';
import { DIECI_DRAFT_BASE } from './draftPaths';

export interface ImportDeps {
  fetchJson: (path: string) => Promise<any>;
  fetchBytes: (path: string) => Promise<Uint8Array>;
  /** Tenant+proje (+ isteğe bağlı eşitlik) filtreli SORGU: olmayan dokümanı doğrudan okumak kurallarca reddedilir. */
  listProjectDocs: (collection: string, tenantId: string, projectId: string, extra?: { field: string; value: string }) => Promise<Map<string, Record<string, any>>>;
  setDocData: (collection: string, id: string, data: Record<string, any>) => Promise<void>;
  updateDocData: (collection: string, id: string, data: Record<string, any>) => Promise<void>;
  storageExists: (path: string) => Promise<boolean>;
  storageUpload: (path: string, bytes: Uint8Array) => Promise<void>;
  makeTimestamp: (iso: string) => unknown;
  serverNow: () => unknown;
}

export const firebaseImportDeps = (): ImportDeps => ({
  fetchJson: async (p) => {
    const r = await fetch(`${DIECI_DRAFT_BASE}/${p}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${p}: ${r.status}`);
    return r.json();
  },
  fetchBytes: async (p) => {
    const r = await fetch(`${DIECI_DRAFT_BASE}/${p}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${p}: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  },
  listProjectDocs: async (c, tenantId, projectId, extra) => {
    const cons = [where('tenantId', '==', tenantId), where('projectId', '==', projectId), ...(extra ? [where(extra.field, '==', extra.value)] : []), limit(500)];
    const snap = await getDocs(query(collection(db!, c), ...cons));
    const out = new Map<string, Record<string, any>>();
    snap.forEach((d) => out.set(d.id, d.data() as Record<string, any>));
    return out;
  },
  setDocData: async (c, id, data) => { await setDoc(doc(db!, c, id), data); },
  updateDocData: async (c, id, data) => { await updateDoc(doc(db!, c, id), data); },
  storageExists: async (path) => {
    try { await getMetadata(ref(storage!, path)); return true; } catch (e: any) {
      if (e?.code === 'storage/object-not-found') return false;
      throw e;
    }
  },
  storageUpload: async (path, bytes) => { await uploadBytes(ref(storage!, path), bytes, { contentType: 'image/jpeg', cacheControl: 'private, no-store' }); },
  makeTimestamp: (iso) => Timestamp.fromDate(new Date(iso)),
  serverNow: () => serverTimestamp(),
});

export interface ImportParams {
  tenantId: string;
  projectId: string;
  uid: string;
  userName: string;
  onProgress?: (msg: string) => void;
  deps?: ImportDeps;
}
export interface ImportResult {
  planId: string;
  createdPlan: boolean;
  createdPosts: string[];
  alreadyPresent: number;
  uploaded: number;
  /** Önceki aktarımda önizlemesi eksik postlara önizleme eklendi */
  backfilled: number;
}

export class ImportConflictError extends Error {}

/** Hata mesajına hangi adımda durduğunu ekler (izin hatalarında kaynağı bulmak için). */
const step = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  try { return await fn(); } catch (e: any) {
    if (e instanceof ImportConflictError) throw e;
    throw new Error(`[${label}] ${e?.code ? e.code + ': ' : ''}${e?.message || e}`);
  }
};

/** Küçük JPEG baytlarını gömülü data URL yapar (Storage/CORS/token gerektirmez; veri yalnız yetkili Firestore dokümanında). */
export const toJpegDataUrl = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/jpeg;base64,${btoa(bin)}`;
};

const stripForWrite = (rec: Record<string, any>, deps: ImportDeps, p: ImportParams) => {
  const { id, weekStartISO, weekEndISO, ...rest } = rec;
  const out: Record<string, any> = { ...rest, createdBy: p.uid, createdAt: deps.serverNow(), updatedAt: deps.serverNow() };
  if (weekStartISO) { out.weekStartDate = deps.makeTimestamp(weekStartISO); out.weekEndDate = deps.makeTimestamp(weekEndISO); }
  if ('createdByName' in rest) out.createdByName = p.userName;
  return out;
};

export async function importDieciDraft(p: ImportParams): Promise<ImportResult> {
  const deps = p.deps || firebaseImportDeps();
  const say = p.onProgress || (() => {});
  if (!p.tenantId || !p.projectId || !p.uid) throw new Error('Oturum, tenant veya proje bilgisi eksik.');

  say('Kaynak plan ve manifest okunuyor…');
  const [plan, manifest] = await Promise.all([deps.fetchJson('plan.json'), deps.fetchJson('manifest.json')]);
  say('Önizlemeler okunuyor…');
  const thumbnails: Record<string, string> = {};
  for (const m of manifest.items) thumbnails[m.asset_id] = toJpegDataUrl(await deps.fetchBytes(`preview/${m.asset_id}.jpg`));
  const { planId, planDoc, posts, storage: files } = buildNativeRecords({ plan, manifest, tenantId: p.tenantId, projectId: p.projectId, createdBy: p.uid, thumbnails });
  const v = validateNative({ plan, manifest, planDoc, posts });
  if (!v.ok) throw new Error(`Doğrulama geçmedi: ${v.problems.join('; ')}`);

  say('Mevcut kayıtlar kontrol ediliyor…');
  const existingPlans = await step('plan kayıtları okunuyor', () => deps.listProjectDocs(PLAN_COLLECTION, p.tenantId, p.projectId));
  const existingPosts = await step('post kayıtları okunuyor', () => deps.listProjectDocs(POST_COLLECTION, p.tenantId, p.projectId, { field: 'contentPlanId', value: planId }));
  const planExisting = existingPlans.get(planId) ?? null;
  const postExisting = posts.map((x) => existingPosts.get(x.id) ?? null);
  const conflicts: string[] = [];
  if (planExisting && planExisting.contentHash !== planDoc.contentHash) conflicts.push(`${PLAN_COLLECTION}/${planId}`);
  postExisting.forEach((e, i) => { if (e && e.contentHash !== posts[i].contentHash) conflicts.push(`${POST_COLLECTION}/${posts[i].id}`); });
  if (conflicts.length) throw new ImportConflictError(`Farklı içerikli mevcut kayıt var; hiçbir şey yazılmadı: ${conflicts.join(', ')}`);

  let uploaded = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    say(`Fotoğraf ${i + 1}/${files.length} doğrulanıyor ve yükleniyor…`);
    const [orig, prev] = await Promise.all([deps.fetchBytes(`original/${f.assetId}.jpg`), deps.fetchBytes(`preview/${f.assetId}.jpg`)]);
    if (sha256Hex(orig) !== f.origSha256) throw new Error(`SHA-256 uyuşmuyor: ${f.assetId}`);
    for (const [dest, bytes] of [[f.origPath, orig], [f.prevPath, prev]] as const) {
      if (await step(`depolama kontrolü (${f.assetId})`, () => deps.storageExists(dest))) continue;
      await step(`dosya yükleme (${f.assetId})`, () => deps.storageUpload(dest, bytes));
      uploaded++;
    }
  }

  say('Plan ve taslak postlar yazılıyor…');
  let createdPlan = false;
  if (!planExisting) { await step('plan yazılıyor', () => deps.setDocData(PLAN_COLLECTION, planId, stripForWrite(planDoc, deps, p))); createdPlan = true; }
  const createdPosts: string[] = [];
  let backfilled = 0;
  for (let i = 0; i < posts.length; i++) {
    const ex = postExisting[i];
    if (ex) {
      // Aynı içerik: yalnız eksik önizleme varsa media alanı güncellenir (başka alan değişmez).
      if (!ex.media?.[0]?.thumbnailUrl) {
        await step(`önizleme tamamlanıyor (${posts[i].id})`, () => deps.updateDocData(POST_COLLECTION, posts[i].id, { media: posts[i].media, updatedAt: deps.serverNow() }));
        backfilled++;
      }
      continue;
    }
    await step(`post yazılıyor (${posts[i].id})`, () => deps.setDocData(POST_COLLECTION, posts[i].id, stripForWrite(posts[i], deps, p)));
    createdPosts.push(posts[i].id);
  }
  return { planId, createdPlan, createdPosts, alreadyPresent: posts.length - createdPosts.length, uploaded, backfilled };
}
