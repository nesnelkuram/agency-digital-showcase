import type { VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';

export const config = {
  maxDuration: 10,
};

const SUGGESTED_CATEGORIES = [
  { key: 'video_production', label: 'Video Produksiyon', prompt: 'Bir video produksiyon hizmeti sablonu olusturmak istiyorum' },
  { key: 'photography', label: 'Fotograf Cekimi', prompt: 'Profesyonel fotograf cekimi sablonu olusturalim' },
  { key: 'social_media', label: 'Sosyal Medya', prompt: 'Sosyal medya icerik uretim sablonu olusturalim' },
  { key: 'drone_shooting', label: 'Drone Cekimi', prompt: 'Drone cekim hizmeti sablonu tasarlayalim' },
  { key: 'scriptwriting', label: 'Senaryo Yazimi', prompt: 'Senaryo yazim hizmeti sablonu olusturalim' },
  { key: 'ecommerce_content', label: 'E-Ticaret Icerik', prompt: 'E-ticaret urun cekimi sablonu tasarlayalim' },
  { key: 'graphic_design', label: 'Grafik Tasarim', prompt: 'Grafik tasarim hizmeti sablonu olusturalim' },
];

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[service-design-start] userId:', req.userId, 'tenantId:', req.tenantId);
    const sessionId = randomUUID();
    const db = getAdminDb();

    await db.collection('service_design_sessions').doc(sessionId).set({
      id: sessionId,
      tenantId: req.tenantId || '',
      userId: req.userId || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      currentDraft: null,
    });

    console.log('[service-design-start] Session created:', sessionId);
    return res.status(200).json({
      sessionId,
      suggestedCategories: SUGGESTED_CATEGORIES,
    });
  } catch (error: any) {
    console.error('service-catalog/design-start error:', error?.message, error?.stack);
    return res.status(500).json({
      error: String(error?.message || 'Failed to start design session'),
    });
  }
});
