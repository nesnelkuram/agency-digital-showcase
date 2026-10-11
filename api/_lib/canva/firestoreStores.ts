/**
 * Canva entegrasyonu — Firestore (Admin SDK) depoları. Yalnız sunucu.
 * Koleksiyonlar istemci kurallarında tanımlı DEĞİL → istemci erişimi varsayılan olarak reddedilir:
 *   integration_secrets/canva_{tenantId}     şifreli token'lar (platform_accounts KULLANILMAZ)
 *   canva_oauth_states/{sha256(state)}       tek kullanımlık, 10 dk
 *   canva_folder_mappings/{tenantId}_{projectId}
 *   canva_sync_jobs/{jobId}
 *   canva_content_index/{key}
 */

import { open, seal, type SealedValue } from '../integrations/secretBox.js';
import { refreshTokens, type CanvaTokenSet, CanvaOAuthError } from './oauth.js';
import { decideReservation, type SyncJob, type SyncStore } from './syncEngine.js';

type Db = any;

export const COL = {
  secrets: 'integration_secrets',
  states: 'canva_oauth_states',
  mappings: 'canva_folder_mappings',
  jobs: 'canva_sync_jobs',
  contentIndex: 'canva_content_index',
} as const;

export const secretDocId = (tenantId: string) => `canva_${tenantId}`;
export const mappingDocId = (tenantId: string, projectId: string) => `${tenantId}_${projectId}`;

export interface CanvaFolderMapping {
  tenantId: string;
  projectId: string;
  connectionId: string;
  canvaFolderId: string;
  /** Studio → Canva kopyalama açık mı (yazma izni doğrulanmadan açılmamalı) */
  toCanva: boolean;
  /** Canva → Studio metadata/önizleme listeleme */
  fromCanva: boolean;
  verifiedAt: number;
  createdBy: string;
  updatedAt: number;
}

export interface CanvaConnection {
  tenantId: string;
  connectionId: string;
  status: 'connected' | 'reauth_required' | 'error';
  scopes: string;
  connectedBy: string;
  connectedAt: number;
  accessExpiresAt: number;
  tokens: SealedValue;
  refreshLockUntil?: number | null;
  lastError?: string | null;
}

/** Bağlantının dışarıya açılabilir özeti (token yok) */
export function publicConnection(c: CanvaConnection | null) {
  if (!c) return { connected: false as const };
  return { connected: c.status === 'connected', status: c.status, connectedAt: c.connectedAt, connectedBy: c.connectedBy, scopes: c.scopes };
}

export function firestoreSyncStore(db: Db): SyncStore {
  const ref = (id: string) => db.collection(COL.jobs).doc(id);
  return {
    async get(id) {
      const s = await ref(id).get();
      return s.exists ? (s.data() as SyncJob) : null;
    },
    async createIfAbsent(job) {
      return db.runTransaction(async (tx: any) => {
        const s = await tx.get(ref(job.id));
        if (s.exists) return s.data() as SyncJob;
        tx.set(ref(job.id), job);
        return job;
      });
    },
    async claim(id, owner, now, leaseMs) {
      return db.runTransaction(async (tx: any) => {
        const s = await tx.get(ref(id));
        if (!s.exists) return null;
        const j = s.data() as SyncJob;
        if (j.leaseOwner && j.leaseOwner !== owner && (j.leaseUntil || 0) > now) return null;
        tx.update(ref(id), { leaseOwner: owner, leaseUntil: now + leaseMs });
        return { ...j, leaseOwner: owner, leaseUntil: now + leaseMs };
      });
    },
    async update(id, owner, patch) {
      await db.runTransaction(async (tx: any) => {
        const s = await tx.get(ref(id));
        if (!s.exists || (s.data() as SyncJob).leaseOwner !== owner) throw new Error('lease_lost');
        tx.update(ref(id), patch);
      });
    },
    async release(id, owner) {
      await db.runTransaction(async (tx: any) => {
        const s = await tx.get(ref(id));
        if (s.exists && (s.data() as SyncJob).leaseOwner === owner) tx.update(ref(id), { leaseOwner: null, leaseUntil: null });
      });
    },
    async getContentIndex(key) {
      const s = await db.collection(COL.contentIndex).doc(key).get();
      return s.exists ? { canvaAssetId: s.data().canvaAssetId } : null;
    },
    async setContentIndex(key, value) {
      await db.collection(COL.contentIndex).doc(key).set({ ...value, reservedBy: null, reservedUntil: null, held: false });
    },
    async reserveContent(key, jobId, now, ttlMs) {
      const r = db.collection(COL.contentIndex).doc(key);
      return db.runTransaction(async (tx: any) => {
        const s = await tx.get(r);
        const d = decideReservation(s.exists ? s.data() : null, jobId, now);
        if (d.kind === 'reserved') tx.set(r, { reservedBy: jobId, reservedUntil: now + ttlMs, held: false }, { merge: true });
        return d;
      });
    },
    async markContent(key, jobId, action) {
      const r = db.collection(COL.contentIndex).doc(key);
      await db.runTransaction(async (tx: any) => {
        const s = await tx.get(r);
        if (!s.exists || s.data().reservedBy !== jobId || s.data().canvaAssetId) return;
        if (action === 'release') tx.update(r, { reservedBy: null, reservedUntil: null, held: false });
        else tx.update(r, { held: true });
      });
    },
  };
}

export async function saveConnection(db: Db, p: { tenantId: string; uid: string; tokens: CanvaTokenSet; now: number }) {
  const conn: CanvaConnection = {
    tenantId: p.tenantId,
    connectionId: `${p.tenantId}:${p.now}`,
    status: 'connected',
    scopes: p.tokens.scope || '',
    connectedBy: p.uid,
    connectedAt: p.now,
    accessExpiresAt: p.tokens.expiresAt,
    tokens: seal(JSON.stringify({ a: p.tokens.accessToken, r: p.tokens.refreshToken })),
    refreshLockUntil: null,
    lastError: null,
  };
  // Yeniden bağlanma: yeni connectionId + kilit alanları sıfırlanır (eski yenilemeler fencing ile yazamaz)
  await db.collection(COL.secrets).doc(secretDocId(p.tenantId)).set({ ...conn, refreshLockOwner: null });
  return conn;
}

export async function loadConnection(db: Db, tenantId: string): Promise<CanvaConnection | null> {
  const s = await db.collection(COL.secrets).doc(secretDocId(tenantId)).get();
  return s.exists ? (s.data() as CanvaConnection) : null;
}

export const REFRESH_LOCK_MS = 30_000;

/**
 * Geçerli erişim token'ı. Süresi dolmak üzereyse kilitli yeniler (refresh token tek kullanımlık).
 * Fencing: yenileme sonucu yalnız (a) kilit hâlâ bu çalıştırıcıdaysa ve (b) bağlantı değişmediyse
 * (connectionId) yazılır; aksi halde YAZILMAZ — eski bir yenileme yeni bağlantıyı veya kilidin yeni
 * sahibini ezemez. Token isteği zaman aşımı (20 sn) kilit süresinden (30 sn) kısadır.
 * Yanıt alınamazsa eski refresh token tüketilmiş olabilir → bağlantı "reauth_required" (fenced).
 */
export async function getAccessToken(
  db: Db,
  tenantId: string,
  deps: {
    clientId: string;
    clientSecret: string;
    fetchImpl: any;
    now?: () => number;
    lockOwner?: string;
    /** Bağlantı izolasyonu: belgedeki connectionId bu değilse token ÇÖZÜLMEDEN reddedilir (yeniden OAuth yarışı) */
    expectedConnectionId?: string;
  }
): Promise<string> {
  const now = deps.now || Date.now;
  const ref = db.collection(COL.secrets).doc(secretDocId(tenantId));
  const lockOwner = deps.lockOwner || `${now()}-${Math.random().toString(36).slice(2)}`;
  const claim = await db.runTransaction(async (tx: any) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new CanvaOAuthError('Canva bağlantısı yok', null, 'not_connected');
    const c = s.data() as CanvaConnection & { refreshLockOwner?: string | null };
    if (deps.expectedConnectionId !== undefined && c.connectionId !== deps.expectedConnectionId) {
      throw new CanvaOAuthError('Canva bağlantısı değişti; bu iş eski bağlantıya ait', null, 'connection_changed');
    }
    if (c.status !== 'connected') throw new CanvaOAuthError('Canva bağlantısı yeniden yetki istiyor', null, 'reauth_required');
    const t = JSON.parse(open(c.tokens));
    if (c.accessExpiresAt - 60_000 > now()) return { mode: 'use' as const, access: t.a as string };
    if ((c.refreshLockUntil || 0) > now()) return { mode: 'busy' as const };
    tx.update(ref, { refreshLockUntil: now() + REFRESH_LOCK_MS, refreshLockOwner: lockOwner });
    return { mode: 'refresh' as const, refresh: t.r as string, connectionId: c.connectionId };
  });
  if (claim.mode === 'use') return claim.access;
  if (claim.mode === 'busy') throw new CanvaOAuthError('Canva token yenileniyor; kısa süre sonra tekrar deneyin', null, 'refresh_in_progress');

  /** Yalnız kilit sahibi ve aynı bağlantı için yazar; değilse false */
  const fencedUpdate = (patch: Record<string, unknown>) =>
    db.runTransaction(async (tx: any) => {
      const s = await tx.get(ref);
      const c = s.exists ? s.data() : null;
      if (!c || c.refreshLockOwner !== lockOwner || c.connectionId !== claim.connectionId) return false;
      tx.update(ref, patch);
      return true;
    });

  let next: CanvaTokenSet;
  try {
    next = await refreshTokens({ refreshToken: claim.refresh, clientId: deps.clientId, clientSecret: deps.clientSecret }, deps.fetchImpl, now());
  } catch (e) {
    const ce = e as CanvaOAuthError;
    const fatal = ce.noResponse || ce.status === 400 || ce.status === 401;
    await fencedUpdate({ refreshLockUntil: null, refreshLockOwner: null, ...(fatal ? { status: 'reauth_required' } : {}), lastError: `${ce.code || 'refresh_failed'}` });
    throw ce;
  }
  const written = await fencedUpdate({
    tokens: seal(JSON.stringify({ a: next.accessToken, r: next.refreshToken })),
    accessExpiresAt: next.expiresAt,
    refreshLockUntil: null,
    refreshLockOwner: null,
    lastError: null,
  });
  if (!written) throw new CanvaOAuthError('Yenileme kilidi kaybedildi veya bağlantı değişti; token yazılmadı', null, 'lock_lost');
  return next.accessToken;
}
