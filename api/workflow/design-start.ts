import type { VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export const config = {
  maxDuration: 10,
};

const SUGGESTED_CATEGORIES = [
  { key: 'video_production', label: 'Video Produksiyon', prompt: 'Bir video produksiyon sureci tasarlamak istiyorum' },
  { key: 'social_media', label: 'Sosyal Medya Yonetimi', prompt: 'Sosyal medya icerik uretim ve yayinlama sureci olusturalim' },
  { key: 'photography', label: 'Fotograf Cekimi', prompt: 'Profesyonel fotograf cekimi workflow\'u tasarlayalim' },
  { key: 'digital_marketing', label: 'Dijital Pazarlama', prompt: 'Dijital pazarlama kampanya sureci olusturalim' },
  { key: 'brand_strategy', label: 'Marka Stratejisi', prompt: 'Marka stratejisi gelistirme sureci tasarlayalim' },
  { key: 'graphic_design', label: 'Grafik Tasarim', prompt: 'Grafik tasarim uretim sureci olusturalim' },
  { key: 'event_coverage', label: 'Etkinlik Cekimi', prompt: 'Etkinlik cekim ve teslimat sureci tasarlayalim' },
];

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[design-start] userId:', req.userId, 'tenantId:', req.tenantId);
    const { parentContext } = req.body || {};
    // parentContext?: { parentSessionId, nodeId, nodeLabel, parentWorkflowName }

    const sessionId = randomUUID();
    const db = getAdminDb();

    await db.collection('workflow_design_sessions').doc(sessionId).set({
      id: sessionId,
      tenantId: req.tenantId || '',
      userId: req.userId || '',
      title: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      currentDraft: null,
      savedTemplateId: null,
      parentContext: parentContext || null,
    });

    console.log('[design-start] Session created:', sessionId, parentContext ? '(subprocess)' : '(root)');
    return res.status(200).json({
      sessionId,
      suggestedCategories: parentContext ? [] : SUGGESTED_CATEGORIES,
    });
  } catch (error: any) {
    console.error('workflow/design-start error:', error?.message, error?.stack);
    return res.status(500).json({
      error: String(error?.message || 'Failed to start design session'),
    });
  }
});
