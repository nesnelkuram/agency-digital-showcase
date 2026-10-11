import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';
import { getAdminDb, getAdminStorage } from '../_lib/firebaseAdmin.js';
import { canvaSyncState } from '../_lib/integrations/config.js';
import { CanvaClient } from '../_lib/canva/client.js';
import { getAccessToken } from '../_lib/canva/firestoreStores.js';
import { processDueJobs, reconcileRecentAssets } from '../_lib/canva/autoSync.js';
import { CANVA_IMAGE_MAX_BYTES, CANVA_SYNC_MIME } from '../_lib/canva/client.js';

export const config = { maxDuration: 60 };

const { Timestamp } = await import('firebase-admin/firestore');
/**
 * 60 sn sınırı: uzlaştırma ilk 10 sn; yeni Canva işi yalnız ilk 15 sn içinde BAŞLATILIR. Kalan ~45 sn tek işin
 * en kötü süresine (token ≤20 sn + POST ≤30 sn zaman aşımı) ayrılır. Yine de POST ortasında kesilirse iş
 * upload_started kalır → sonraki tur needs_review (kör tekrar yok). Kalanlar cursor/kuyrukla sonraki turda sürer.
 */
const RECONCILE_BUDGET_MS = 10_000;
const WORK_START_DEADLINE_MS = 15_000;

/**
 * Canva senkron işçisi (kalıcı kuyruk). vercel.json cron: her 30 dk. CANVA_SYNC_ENABLED="true" ve Canva env'leri
 * yoksa hiçbir şey yapmaz (200 enabled:false) — varsayılan KAPALI.
 * GET, Authorization: Bearer CRON_SECRET (secret tanımlı ve boş değil olmalı; aksi halde 401 — fail-closed).
 * 1) Uzlaştırma: kaybolan "upload_complete" bildirimleri için yeni fotoğraflara iş açar (backfill yok)
 * 2) İşleme: zamanı gelen işleri mevcut motorla ilerletir (lease/rezervasyon/needs_review/yalnız taşıma)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret || req.headers['authorization'] !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  const feature = canvaSyncState();
  if (!feature.enabled) return res.status(200).json({ enabled: false, reason: feature.reason });
  try {
    const db = getAdminDb();
    const now = Date.now;
    const startedAt = now();
    const reconcile = await reconcileRecentAssets(db, {
      featureEnabled: true,
      now: startedAt,
      clock: now,
      deadline: startedAt + RECONCILE_BUDGET_MS,
      timeValue: (ms) => Timestamp.fromMillis(ms),
    });
    const storage = await getAdminStorage();
    const work = await processDueJobs(
      db,
      {
        owner: `cron:${now()}`,
        now,
        canvaFor: (tenantId, connectionId) =>
          new CanvaClient(
            () => getAccessToken(db, tenantId, { clientId: process.env.CANVA_CLIENT_ID!, clientSecret: process.env.CANVA_CLIENT_SECRET!, fetchImpl: fetch, expectedConnectionId: connectionId }),
            fetch as any
          ),
        readSourceFor: async (a) => {
          if (!CANVA_SYNC_MIME.has(a.storage.contentType) || !(a.storage.size < CANVA_IMAGE_MAX_BYTES)) {
            return { bytes: Buffer.alloc(0), sha256: '', contentType: a.storage.contentType, size: a.storage.size };
          }
          if (!a.storage.path.startsWith(`brand-media/${a.tenantId}/${a.projectId}/${a.id}/`)) throw new Error('Kaynak yolu varlığa ait değil');
          const [bytes] = await storage.bucket(process.env.FIREBASE_STORAGE_BUCKET).file(a.storage.path).download();
          return { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), contentType: a.storage.contentType, size: bytes.length };
        },
      },
      { featureEnabled: true, limit: 50, deadline: startedAt + WORK_START_DEADLINE_MS }
    );
    return res.status(200).json({ enabled: true, reconcile, work });
  } catch (error: any) {
    console.error('cron/canva-sync error:', error?.code || error?.message);
    return res.status(500).json({ error: 'Canva senkron işçisi başarısız' });
  }
}
