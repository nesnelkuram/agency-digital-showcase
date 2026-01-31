import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { runDataNormalizer, startDeepResearch, buildDeepResearchPrompt } from './_lib/pipeline-bundle.mjs';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const { contact, sector, wizard, requestedServices, leadId, adminNotes } = req.body;

    if (!contact || !sector || !wizard) {
      return res.status(400).json({ error: 'Missing required fields: contact, sector, wizard' });
    }

    // Extract business context from wizard data (v2.0+)
    const businessContext = wizard.businessContext || undefined;

    const input = {
      contact: {
        name: contact.name || '',
        businessName: contact.businessName || '',
        email: contact.email || '',
      },
      sector,
      wizard: {
        answers: wizard.answers || {},
        scores: wizard.scores || {},
        stageResults: wizard.stageResults || [],
      },
      requestedServices: requestedServices || [],
      leadId: leadId || 'unknown',
      mode: 'full',
      adminNotes: adminNotes || undefined,
      businessContext,
    };

    // Phase 1: Run data normalizer
    console.log('analyze-start: Running dataNormalizer...');
    const normalizedData = await runDataNormalizer(input);
    console.log(`analyze-start: dataNormalizer complete`);

    // Phase 2: Start Deep Research (no polling — returns immediately)
    const prompt = buildDeepResearchPrompt(contact.businessName || '', sector, businessContext);
    console.log('analyze-start: Starting Deep Research interaction...');
    const drInteractionId = await startDeepResearch(prompt);
    console.log(`analyze-start: DR interaction=${drInteractionId || 'FAILED'}`);

    return res.status(200).json({
      status: drInteractionId ? 'researching' : 'dr_failed',
      drInteractionId: drInteractionId || null,
      normalizedData,
      input, // pass back for continue endpoint
    });
  } catch (error: any) {
    console.error('analyze-start error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Start phase failed'),
    });
  }
}
