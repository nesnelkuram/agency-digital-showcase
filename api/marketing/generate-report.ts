import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const config = {
  maxDuration: 300,
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
      throw new Error('FIREBASE_SERVICE_ACCOUNT veya FIREBASE_PROJECT_ID ortam degiskeni gerekli');
    }
  }

  return getFirestore();
}

// ============================================
// POST /api/marketing/generate-report
// ============================================

/**
 * POST /api/marketing/generate-report
 *
 * Pazarlama performans raporu olusturur.
 * 1. Firestore'da rapor dokumani olusturur (status: generating)
 * 2. Kampanya verilerini ve performans snapshot'larini ceker
 * 3. KPI'lari hesaplar: toplam harcama, gosterim, tiklama, donusum, CTR, CPA, ROAS
 * 4. Onceki donemle karsilastirarak degisim yuzdeleri hesaplar
 * 5. Platform bazli kirilim yapar
 * 6. Kampanya bazli kirilim yapar
 * 7. AI ile Turkce yonetici ozeti ve oneriler uretir
 * 8. Tum verileri rapor dokumanina kaydeder (status: ready)
 *
 * Body: { reportId, projectId?, dateRange, sections, campaignIds?, userId, userName }
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
      reportId,
      projectId,
      dateRange,
      sections,
      campaignIds,
      userId,
      userName,
    } = req.body;

    // Validate required fields
    if (!reportId || !dateRange?.startDate || !dateRange?.endDate) {
      return res.status(400).json({
        success: false,
        error: 'Zorunlu alanlar eksik: reportId, dateRange.startDate, dateRange.endDate',
      });
    }

    console.log(`[generate-report] Rapor olusturuluyor: reportId=${reportId}, tarih=${dateRange.startDate} - ${dateRange.endDate}`);
    const startTime = Date.now();

    // 1. Firebase Admin ile Firestore'a ulas
    const adminDb = getAdminDb();

    // 2. Kampanyalari cek
    let campaignsQuery;
    if (campaignIds?.length) {
      // Belirli kampanyalar
      campaignsQuery = adminDb
        .collection('marketing_campaigns')
        .where('__name__', 'in', campaignIds);
    } else if (projectId) {
      // Proje kapsamindaki tum kampanyalar
      campaignsQuery = adminDb
        .collection('marketing_campaigns')
        .where('projectId', '==', projectId);
    } else {
      // Tum kampanyalar
      campaignsQuery = adminDb.collection('marketing_campaigns');
    }

    const campaignsSnap = await campaignsQuery.get();
    const campaigns = campaignsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    console.log(`[generate-report] ${campaigns.length} kampanya bulundu`);

    // 3. Performans snapshot'larini cek (tarih araligi icin)
    const allSnapshots: any[] = [];

    for (const camp of campaigns) {
      const snapQuery = await adminDb
        .collection('performance_snapshots')
        .where('campaignId', '==', camp.id)
        .where('date', '>=', dateRange.startDate)
        .where('date', '<=', dateRange.endDate)
        .orderBy('date', 'asc')
        .get();

      snapQuery.docs.forEach((d) => {
        allSnapshots.push({
          ...d.data(),
          campaignId: camp.id,
          campaignName: (camp as any).name || 'Isimsiz',
        });
      });
    }

    console.log(`[generate-report] ${allSnapshots.length} performans snapshot'i bulundu`);

    // 4. KPI'lari hesapla
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalReach = 0;

    allSnapshots.forEach((snap) => {
      totalSpend += snap.spend || 0;
      totalImpressions += snap.impressions || 0;
      totalClicks += snap.clicks || 0;
      totalConversions += snap.conversions || 0;
      totalReach += snap.reach || 0;
    });

    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const overallROAS = totalSpend > 0 ? (totalConversions * avgCPA) / totalSpend : 0;

    // 5. Onceki donem ile karsilasma (ayni uzunluktaki onceki donem)
    const startMs = new Date(dateRange.startDate).getTime();
    const endMs = new Date(dateRange.endDate).getTime();
    const periodLengthMs = endMs - startMs;
    const prevStart = new Date(startMs - periodLengthMs).toISOString().split('T')[0];
    const prevEnd = new Date(startMs - 86400000).toISOString().split('T')[0]; // 1 gun once

    let prevSpend = 0;
    let prevImpressions = 0;
    let prevClicks = 0;
    let prevConversions = 0;

    for (const camp of campaigns) {
      const prevSnapQuery = await adminDb
        .collection('performance_snapshots')
        .where('campaignId', '==', camp.id)
        .where('date', '>=', prevStart)
        .where('date', '<=', prevEnd)
        .get();

      prevSnapQuery.docs.forEach((d) => {
        const data = d.data();
        prevSpend += data.spend || 0;
        prevImpressions += data.impressions || 0;
        prevClicks += data.clicks || 0;
        prevConversions += data.conversions || 0;
      });
    }

    const prevCTR = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
    const prevCPA = prevConversions > 0 ? prevSpend / prevConversions : 0;

    function calcChange(current: number, previous: number): number | undefined {
      if (previous === 0) return current > 0 ? 100 : undefined;
      return ((current - previous) / previous) * 100;
    }

    const kpis = [
      {
        label: 'Toplam Harcama',
        value: totalSpend,
        previousValue: prevSpend,
        change: calcChange(totalSpend, prevSpend),
        unit: 'TL',
      },
      {
        label: 'Gosterim',
        value: totalImpressions,
        previousValue: prevImpressions,
        change: calcChange(totalImpressions, prevImpressions),
        unit: '',
      },
      {
        label: 'Tiklama',
        value: totalClicks,
        previousValue: prevClicks,
        change: calcChange(totalClicks, prevClicks),
        unit: '',
      },
      {
        label: 'Donusum',
        value: totalConversions,
        previousValue: prevConversions,
        change: calcChange(totalConversions, prevConversions),
        unit: '',
      },
      {
        label: 'CTR',
        value: Number(avgCTR.toFixed(2)),
        previousValue: Number(prevCTR.toFixed(2)),
        change: calcChange(avgCTR, prevCTR),
        unit: '%',
      },
      {
        label: 'CPA',
        value: Number(avgCPA.toFixed(2)),
        previousValue: Number(prevCPA.toFixed(2)),
        change: calcChange(avgCPA, prevCPA),
        unit: 'TL',
      },
    ];

    // 6. Platform bazli kirilim
    const platformMap: Record<string, {
      spend: number; impressions: number; clicks: number; conversions: number;
    }> = {};

    allSnapshots.forEach((snap) => {
      const plat = snap.platform || 'unknown';
      if (!platformMap[plat]) {
        platformMap[plat] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      }
      platformMap[plat].spend += snap.spend || 0;
      platformMap[plat].impressions += snap.impressions || 0;
      platformMap[plat].clicks += snap.clicks || 0;
      platformMap[plat].conversions += snap.conversions || 0;
    });

    const platformBreakdown = Object.entries(platformMap).map(([platform, data]) => ({
      platform,
      spend: data.spend,
      spendPercentage: totalSpend > 0 ? (data.spend / totalSpend) * 100 : 0,
      impressions: data.impressions,
      clicks: data.clicks,
      conversions: data.conversions,
      ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
      cpa: data.conversions > 0 ? data.spend / data.conversions : 0,
    }));

    // 7. Kampanya bazli kirilim
    const campaignMap: Record<string, {
      name: string; platform: string;
      spend: number; impressions: number; clicks: number; conversions: number;
    }> = {};

    allSnapshots.forEach((snap) => {
      const cId = snap.campaignId;
      if (!campaignMap[cId]) {
        campaignMap[cId] = {
          name: snap.campaignName,
          platform: snap.platform || 'unknown',
          spend: 0, impressions: 0, clicks: 0, conversions: 0,
        };
      }
      campaignMap[cId].spend += snap.spend || 0;
      campaignMap[cId].impressions += snap.impressions || 0;
      campaignMap[cId].clicks += snap.clicks || 0;
      campaignMap[cId].conversions += snap.conversions || 0;
    });

    const campaignResults = Object.entries(campaignMap).map(([id, data]) => ({
      campaignId: id,
      campaignName: data.name,
      platform: data.platform,
      spend: data.spend,
      impressions: data.impressions,
      clicks: data.clicks,
      conversions: data.conversions,
      ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
      cpa: data.conversions > 0 ? data.spend / data.conversions : 0,
      roas: data.spend > 0 ? (data.conversions * (data.spend / Math.max(data.conversions, 1))) / data.spend : 0,
    }));

    // 8. AI ile ozet ve oneriler olustur
    let summary = '';
    let highlights: string[] = [];
    let recommendations: string[] = [];

    const includedSectionIds = (sections || [])
      .filter((s: any) => s.included)
      .map((s: any) => s.id);

    const needsAI =
      includedSectionIds.includes('executive_summary') ||
      includedSectionIds.includes('recommendations');

    if (needsAI) {
      try {
        const { generateJSON } = await import('../../src/pipeline/geminiClient');

        const aiPrompt = `
Sen bir dijital pazarlama uzmanisisn. Asagidaki kampanya performans verilerini analiz et ve Turkce olarak rapor icerigi olustur.

DONEM: ${dateRange.startDate} - ${dateRange.endDate}

KPI'LAR:
- Toplam Harcama: ${totalSpend.toFixed(2)} TL (onceki donem: ${prevSpend.toFixed(2)} TL)
- Toplam Gosterim: ${totalImpressions.toLocaleString()} (onceki: ${prevImpressions.toLocaleString()})
- Toplam Tiklama: ${totalClicks.toLocaleString()} (onceki: ${prevClicks.toLocaleString()})
- Toplam Donusum: ${totalConversions} (onceki: ${prevConversions})
- Ortalama CTR: %${avgCTR.toFixed(2)} (onceki: %${prevCTR.toFixed(2)})
- Ortalama CPA: ${avgCPA.toFixed(2)} TL (onceki: ${prevCPA.toFixed(2)} TL)

PLATFORM KIRILIMI:
${platformBreakdown.map((p) => `- ${p.platform}: ${p.spend.toFixed(2)} TL harcama, ${p.impressions} gosterim, ${p.clicks} tiklama, ${p.conversions} donusum`).join('\n')}

KAMPANYA SAYISI: ${campaigns.length}

${campaignResults.length > 0 ? `EN IYI KAMPANYALAR:\n${campaignResults.slice(0, 5).map((c) => `- ${c.campaignName} (${c.platform}): ${c.spend.toFixed(2)} TL, ${c.conversions} donusum, CTR %${c.ctr.toFixed(2)}`).join('\n')}` : ''}

Asagidaki JSON yapisinda yanit ver:
{
  "summary": "2-3 paragraflik yonetici ozeti (profesyonel ve ozetleyici ton, performansi degerlendir)",
  "highlights": ["3-5 adet temel bulgu - kisa ve etkili cumleler"],
  "recommendations": ["3-5 adet uygulanabilir oneri - spesifik ve aksiyona donuk"]
}

KURALLAR:
- Turkce yaz
- Profesyonel ve veri odakli ton kullan
- Somut rakamlar ve yuzdelere yer ver
- Negatif trendler icin iyilestirme onerileri sun
- Pozitif trendleri vurgula
`;

        const aiResult = await generateJSON<{
          summary: string;
          highlights: string[];
          recommendations: string[];
        }>('flash', aiPrompt, 'reportGenerator', {
          temperature: 0.6,
          maxOutputTokens: 4096,
        });

        summary = aiResult.summary || '';
        highlights = aiResult.highlights || [];
        recommendations = aiResult.recommendations || [];

        console.log(`[generate-report] AI icerigi olusturuldu: ozet=${summary.length} karakter, ${highlights.length} bulgu, ${recommendations.length} oneri`);
      } catch (aiError: any) {
        console.error('[generate-report] AI hatasi:', aiError.message);
        // AI basarisiz olsa bile raporu mevcut verilerle tamamla
        summary = `${dateRange.startDate} - ${dateRange.endDate} donemi icin performans raporu. Toplam ${totalSpend.toFixed(2)} TL harcama ile ${totalConversions} donusum elde edilmistir.`;
        highlights = [
          `Toplam harcama: ${totalSpend.toFixed(2)} TL`,
          `Toplam gosterim: ${totalImpressions.toLocaleString()}`,
          `Toplam donusum: ${totalConversions}`,
        ];
        recommendations = ['Detayli analiz icin verileri inceleyin.'];
      }
    }

    // 9. Rapor dokumanini guncelle (status: ready)
    const reportRef = adminDb.collection('marketing_reports').doc(reportId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 gun sonra

    await reportRef.update({
      status: 'ready',
      summary,
      highlights,
      kpis,
      campaignResults,
      platformBreakdown,
      recommendations,
      completedAt: now,
      expiresAt,
    });

    const totalDuration = Date.now() - startTime;

    console.log(
      `[generate-report] Rapor tamamlandi: ${totalDuration}ms, ` +
      `${campaigns.length} kampanya, ${allSnapshots.length} snapshot`
    );

    return res.status(200).json({
      success: true,
      reportId,
      summary: {
        campaignsAnalyzed: campaigns.length,
        snapshotsProcessed: allSnapshots.length,
        kpiCount: kpis.length,
        platformCount: platformBreakdown.length,
      },
      metadata: {
        agentsRun: needsAI ? ['reportGenerator'] : [],
        totalDuration,
      },
    });
  } catch (error: any) {
    console.error('[generate-report] Hata:', error.message);

    // Rapor basarisiz olursa durumunu guncelle
    try {
      const { reportId } = req.body;
      if (reportId) {
        const adminDb = getAdminDb();
        await adminDb.collection('marketing_reports').doc(reportId).update({
          status: 'failed',
        });
      }
    } catch (updateErr: any) {
      console.error('[generate-report] Durum guncelleme hatasi:', updateErr.message);
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Rapor olusturma basarisiz',
    });
  }
}
