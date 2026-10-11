import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, getAdminStorage } from '../_lib/firebaseAdmin.js';
import { mediaAnalysisSinceMs, mediaAnalysisState } from '../_lib/integrations/config.js';
import { processAnalysisQueue, reconcileNewMedia, RECONCILE_BUDGET_MS, WORK_START_DEADLINE_MS } from '../_lib/mediaAnalysis/autoQueue.js';
import { firestoreAnalysisStore, type BrandMediaLike } from '../_lib/mediaAnalysis/runner.js';
import { anthropicModelCall } from '../_lib/mediaAnalysis/anthropicCall.js';

export const config = { maxDuration: 300 };

const { Timestamp } = await import('firebase-admin/firestore');


/**
 * Medya AI kataloglama işçisi (kalıcı kuyruk). vercel.json cron: her 30 dk. MEDIA_AI_ANALYSIS_ENABLED="true"
 * ve ANTHROPIC_API_KEY yoksa hiçbir şey yapmaz (200 enabled:false). Kaybolan bildirimler için uzlaştırma yalnız
 * MEDIA_AI_ANALYSIS_SINCE (açık aktivasyon anı) ayarlıysa çalışır; öncesi için backfill yok.
 * GET, Authorization: Bearer CRON_SECRET (dolu olmalı; aksi halde 401).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret || req.headers['authorization'] !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  const feature = mediaAnalysisState();
  if (!feature.enabled) return res.status(200).json({ enabled: false, reason: feature.reason });
  try {
    const db = getAdminDb();
    const now = Date.now;
    const startedAt = now();
    const reconcile = await reconcileNewMedia(db, {
      featureEnabled: true,
      sinceMs: mediaAnalysisSinceMs(),
      now: startedAt,
      clock: now,
      deadline: startedAt + RECONCILE_BUDGET_MS,
      timeValue: (ms) => Timestamp.fromMillis(ms),
    });
    const storage = await getAdminStorage();
    const callModel = anthropicModelCall();
    const work = await processAnalysisQueue(
      db,
      {
        owner: `cron:${startedAt}`,
        now,
        analysisDeps: (asset: BrandMediaLike) => ({
          store: firestoreAnalysisStore(db),
          readBytes: async (path: string) => {
            if (!path.startsWith(`brand-media/${asset.tenantId}/${asset.projectId}/${asset.id}/`)) throw new Error('Kaynak yolu varlığa ait değil');
            const [buf] = await storage.bucket(process.env.FIREBASE_STORAGE_BUCKET).file(path).download();
            return buf;
          },
          callModel,
        }),
      },
      { featureEnabled: true, limit: 20, deadline: startedAt + WORK_START_DEADLINE_MS }
    );
    return res.status(200).json({ enabled: true, reconcile, work });
  } catch (error: any) {
    console.error('cron/media-analysis error:', error?.code || error?.message);
    return res.status(500).json({ error: 'Medya analiz işçisi başarısız' });
  }
}
