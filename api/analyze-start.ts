import type { VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { startDeepResearch, buildDeepResearchPrompt } from './_bundles/pipeline-bundle.mjs';
import { initRun, checkpointDrInteractionId } from './_lib/checkpointManager.js';
import { withAuthOptional, OptionalAuthRequest } from './_lib/withAuth.js';

export const config = {
  maxDuration: 30, // reduced — only starts DR, no agent work
};

export default withAuthOptional(async (req: OptionalAuthRequest, res: VercelResponse) => {
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
      mode: 'full' as const,
      ...(adminNotes ? { adminNotes } : {}),
      ...(businessContext ? { businessContext } : {}),
    };

    const effectiveLeadId = leadId || 'unknown';
    const { runId } = await initRun(effectiveLeadId, input);
    console.log(`analyze-start: run initialized runId=${runId}`);

    // Start Deep Research async — all agent work happens on Hetzner in analyze-continue
    const prompt = buildDeepResearchPrompt(contact.businessName || '', sector, businessContext, adminNotes);
    const drInteractionId = await startDeepResearch(prompt);
    if (drInteractionId) {
      await checkpointDrInteractionId(effectiveLeadId, runId, drInteractionId);
    }
    console.log(`analyze-start: DR started — drInteractionId=${drInteractionId || 'FAILED'}`);

    return res.status(200).json({
      status: drInteractionId ? 'researching' : 'dr_failed',
      drInteractionId: drInteractionId || null,
      input,
      runId,
    });
  } catch (error: any) {
    console.error('analyze-start error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Start phase failed'),
    });
  }
});
