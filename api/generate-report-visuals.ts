import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from './_lib/firebaseAdmin.js';

export const config = { maxDuration: 60 };

const IMAGEN_MODEL = 'gemini-2.0-flash-preview-image-generation';

// Archetype → preset gradient fallback (hex pairs)
const ARCHETYPE_GRADIENTS: Record<string, [string, string]> = {
  Kahraman: ['#1a1a2e', '#16213e'],
  Explorer: ['#0f3460', '#533483'],
  Sage: ['#1b2a4a', '#2d4a7a'],
  Outlaw: ['#1a0a0a', '#3d1515'],
  Magician: ['#0d0221', '#1a0533'],
  Innocent: ['#f8f4f0', '#e8ddd0'],
  Creator: ['#1a1a1a', '#2d2d2d'],
  Ruler: ['#0a0a0a', '#1c1c1c'],
  Lover: ['#2d0a1a', '#4a1a2d'],
  Caregiver: ['#0a2d1a', '#1a4a2d'],
  Jester: ['#1a2d0a', '#2d4a0a'],
  Everyman: ['#1a1a2e', '#2e2e4a'],
};

function buildImagenPrompt(sectionId: string, analysis: any, _businessName: string, sector: string): string {
  const archetype = analysis?.brandPersonality?.archetype || 'modern brand';
  const mood = (analysis?.visualWorld?.moodKeywords || []).slice(0, 3).join(', ') || 'professional, elegant';
  const colors = (analysis?.visualWorld?.colorPalette || [])
    .slice(0, 2)
    .map((c: any) => c.name || c.hex)
    .join(', ') || 'neutral tones';
  const segment = analysis?.positioning?.targetSegments?.[0]?.demographics || 'urban professionals';

  const sectorEn = sector?.replace(/_/g, ' ') || 'business';

  const prompts: Record<string, string> = {
    cover: `Cinematic editorial photography, ${sectorEn} brand identity, ${mood} atmosphere, ${colors} color palette, luxury minimal composition, no text, no people, 16:9, ultra high quality`,
    currentstate: `${sectorEn} business analysis, data visualization concept, ${mood}, professional diagnostic, abstract charts, ${colors}, no text, 16:9`,
    identity: `${archetype} brand archetype visual mood, ${mood}, ${colors} color tones, abstract editorial photography, brand essence, no text, artistic, 16:9`,
    positioning: `Brand strategy visualization, ${sectorEn} market positioning, minimalist design, ${mood}, ${colors} gradient, strong composition concept, abstract, no text, 16:9`,
    messaging: `Brand communication concept, editorial design, ${mood}, ${colors}, creative typography art direction, abstract, no text, 16:9`,
    marketdigital: `${sectorEn} industry landscape, Turkish market, professional business photography, competitive environment, ${mood}, no text, 16:9`,
    actionplan: `Business growth journey, ${sectorEn} industry, milestone roadmap concept, ${mood}, ambitious, forward motion, no text, 16:9`,
  };

  return prompts[sectionId] || `${sectorEn} brand, ${mood}, professional, no text, 16:9`;
}

function buildFallbackGradient(sectionId: string, analysis: any): string {
  const palette = analysis?.visualWorld?.colorPalette || [];
  const archetype = analysis?.brandPersonality?.archetype || '';

  if (palette.length >= 2) {
    const c1 = palette[0]?.hex || '#1a1a2e';
    const c2 = palette[1]?.hex || '#16213e';
    return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
  }

  const presets = ARCHETYPE_GRADIENTS[archetype];
  if (presets) {
    return `linear-gradient(135deg, ${presets[0]} 0%, ${presets[1]} 100%)`;
  }

  // Section-based defaults
  const defaults: Record<string, string> = {
    cover:    'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
    identity: 'linear-gradient(135deg, #1a0a2e 0%, #2e1a4a 100%)',
    market:   'linear-gradient(135deg, #0a1a2e 0%, #1a2e4a 100%)',
    audience: 'linear-gradient(135deg, #0a2e1a 0%, #1a4a2e 100%)',
    strategy: 'linear-gradient(135deg, #2e0a0a 0%, #4a1a1a 100%)',
    language: 'linear-gradient(135deg, #1a2e0a 0%, #2e4a1a 100%)',
    action:   'linear-gradient(135deg, #0a2e2e 0%, #1a4a4a 100%)',
    intiba:   'linear-gradient(135deg, #1a1a1a 0%, #2e2e2e 100%)',
  };
  return defaults[sectionId] || 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)';
}

async function generateImagenImage(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const fullPrompt = `${prompt}, landscape wide composition 16:9, no text, no words, no letters, no people`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.warn(`Gemini image gen error ${response.status}: ${err.slice(0, 200)}`);
      return null;
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>
    };
    const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return b64 || null;
  } catch (err: any) {
    console.warn(`Gemini image gen failed: ${err.message}`);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { shareToken } = req.body || {};
  if (!shareToken) return res.status(400).json({ error: 'shareToken required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const db = getAdminDb();

    // Fetch lead by shareToken
    const snapshot = await db.collection('brand_leads')
      .where('shareToken', '==', shareToken)
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Report not found' });

    const doc = snapshot.docs[0];
    const lead = { id: doc.id, ...doc.data() };
    const analysis = (lead as any).aiAnalysis;
    const businessName: string = (lead as any).contact?.businessName || '';
    const sector: string = (lead as any).sector || '';

    // Check cache
    const cached = (lead as any).reportVisuals;
    if (cached && typeof cached === 'object' && Object.keys(cached).length >= 8) {
      return res.status(200).json({ visuals: cached, cached: true });
    }

    const SECTIONS = ['cover', 'identity', 'market', 'audience', 'strategy', 'language', 'action', 'intiba'];

    // Generate all images in parallel
    const results = await Promise.all(
      SECTIONS.map(async (sectionId) => {
        const prompt = buildImagenPrompt(sectionId, analysis, businessName, sector);
        const imageB64 = await generateImagenImage(prompt, apiKey);
        const fallbackGradient = buildFallbackGradient(sectionId, analysis);
        return { sectionId, imageB64, fallbackGradient, prompt };
      })
    );

    const visuals: Record<string, { imageB64?: string; fallbackGradient: string; prompt: string }> = {};
    for (const r of results) {
      visuals[r.sectionId] = {
        fallbackGradient: r.fallbackGradient,
        prompt: r.prompt,
        ...(r.imageB64 ? { imageB64: r.imageB64 } : {}),
      };
    }

    // Cache in Firestore (fire-and-forget, don't block response)
    doc.ref.update({ reportVisuals: visuals }).catch((e: any) =>
      console.warn('reportVisuals cache write failed:', e.message)
    );

    const imagenSuccess = results.filter(r => r.imageB64).length;
    console.log(`generate-report-visuals: ${imagenSuccess}/${SECTIONS.length} Imagen images generated`);

    return res.status(200).json({ visuals, cached: false, imagenSuccess });
  } catch (error: any) {
    console.error('generate-report-visuals error:', error);
    return res.status(500).json({ error: String(error?.message || 'Internal error') });
  }
}
