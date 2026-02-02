import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const config = {
  maxDuration: 120,
};

// ============================================
// Firebase Admin baslat
// ============================================

function getAdminDb() {
  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } else if (projectId) {
      initializeApp({ projectId });
    } else {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT veya FIREBASE_PROJECT_ID ortam degiskeni gerekli'
      );
    }
  }

  return getFirestore();
}

// ============================================
// POST /api/marketing/analyze-competitor
// ============================================

/**
 * POST /api/marketing/analyze-competitor
 *
 * Rakip firma icin AI tabanli reklam stratejisi analizi yapar ve
 * sonuclari Firestore'a kaydeder.
 *
 * Body:
 *  - competitorId: string (zorunlu)
 *  - competitorName: string (zorunlu)
 *  - website?: string
 *  - sector?: string
 *  - platforms: string[] (zorunlu)
 *  - projectId?: string
 *  - clientName?: string
 *  - clientSector?: string
 *
 * Akis:
 *  1. Girdi dogrulamasi
 *  2. competitorAnalyzer ajanini calistir
 *  3. Analiz sonucunu competitor_analyses koleksiyonuna kaydet
 *  4. Rakibin lastAnalyzedAt alanini guncelle
 *  5. Analiz sonucunu dondur
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const {
      competitorId,
      competitorName,
      website,
      sector,
      platforms,
      projectId,
      clientName,
      clientSector,
    } = req.body;

    // 1. Girdi dogrulamasi
    if (!competitorId || !competitorName) {
      return res.status(400).json({
        success: false,
        error: 'Zorunlu alanlar eksik: competitorId, competitorName',
      });
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Zorunlu alan eksik: platforms (en az 1 platform gerekli)',
      });
    }

    console.log(
      `[analyze-competitor] Analiz baslatiliyor: competitor=${competitorName}, ` +
        `platforms=[${platforms.join(', ')}]`
    );
    const startTime = Date.now();

    // 2. Firebase Admin ile Firestore'a ulas
    const adminDb = getAdminDb();

    // 3. AI ajanini calistir
    const { runCompetitorAnalyzer } = await import(
      '../../src/pipeline/marketing/agents/competitorAnalyzer'
    );

    const aiResult = await runCompetitorAnalyzer({
      competitorName,
      competitorWebsite: website,
      sector,
      platforms,
      clientName,
      clientSector,
    });

    // 4. Analiz sonucunu Firestore'a kaydet
    const now = new Date();
    const analysisData = {
      competitorId,
      competitorName,
      projectId: projectId || null,
      analyzedAt: now,
      adStrategySummary: aiResult.adStrategySummary,
      estimatedMonthlySpend: aiResult.estimatedMonthlySpend || null,
      primaryPlatforms: aiResult.primaryPlatforms,
      targetAudience: aiResult.targetAudience,
      messagingThemes: aiResult.messagingThemes,
      creativeApproach: aiResult.creativeApproach,
      strengths: aiResult.strengths,
      weaknesses: aiResult.weaknesses,
      opportunities: aiResult.opportunities,
      threats: aiResult.threats,
      adExamples: aiResult.adExamples,
      recommendations: aiResult.recommendations,
      overallThreatLevel: aiResult.overallThreatLevel,
      confidence: aiResult.confidence,
    };

    const analysisRef = await adminDb
      .collection('competitor_analyses')
      .add(analysisData);

    // 5. Rakibin lastAnalyzedAt alanini guncelle
    await adminDb
      .collection('competitors')
      .doc(competitorId)
      .update({ lastAnalyzedAt: now });

    const totalDuration = Date.now() - startTime;

    console.log(
      `[analyze-competitor] Analiz tamamlandi: ${totalDuration}ms, ` +
        `threat=${aiResult.overallThreatLevel}, confidence=${aiResult.confidence}`
    );

    return res.status(200).json({
      success: true,
      analysis: {
        id: analysisRef.id,
        ...analysisData,
      },
      metadata: {
        agentsRun: ['competitorAnalyzer'],
        totalDuration,
      },
    });
  } catch (error: any) {
    console.error('[analyze-competitor] Hata:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Rakip analizi basarisiz',
    });
  }
}
