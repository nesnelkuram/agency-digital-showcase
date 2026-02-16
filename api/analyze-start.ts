import type { VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { runDataNormalizer, startDeepResearch, buildDeepResearchPrompt, fetchAndParseWebsite } from './_lib/pipeline-bundle.mjs';
import { initRun, markAgentRunning, checkpointAgent, checkpointDrInteractionId, markAgentFailed } from './_lib/checkpointManager.js';
import { withAuthOptional, OptionalAuthRequest } from './_lib/withAuth';

export const config = {
  maxDuration: 60,
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
      mode: 'full' as const,
      adminNotes: adminNotes || undefined,
      businessContext,
    };

    // Initialize pipeline run checkpoint (best-effort — failure won't block pipeline)
    const effectiveLeadId = leadId || 'unknown';
    const { runId, resumed, checkpoint } = await initRun(effectiveLeadId, input);
    console.log(`analyze-start: Pipeline run initialized: runId=${runId}, resumed=${resumed}`);

    // If resuming from checkpoint with normalizedData already done, skip re-running
    if (resumed && checkpoint?.normalizedData) {
      console.log('analyze-start: Resuming from checkpoint — dataNormalizer already done');
      const existingDrId = checkpoint?.researchFindings ? null : undefined; // DR already done if research exists
      return res.status(200).json({
        status: checkpoint?.researchFindings ? 'research_complete' : 'researching',
        drInteractionId: existingDrId,
        normalizedData: checkpoint.normalizedData,
        websiteData: checkpoint.websiteData || null,
        input,
        runId,
        resumed: true,
        researchFindings: checkpoint.researchFindings || null,
      });
    }

    // Phase 1 + 2 + 3: Run dataNormalizer + DR start + website fetch in PARALLEL
    console.log('analyze-start: Running dataNormalizer + DR start + website fetch in parallel...');
    await markAgentRunning(effectiveLeadId, runId, 'dataNormalizer');

    const dataNormalizerStart = Date.now();
    const [normalizedData, drInteractionId, websiteData] = await Promise.all([
      (async () => {
        try {
          const result = await runDataNormalizer(input);
          await checkpointAgent(effectiveLeadId, runId, 'dataNormalizer', 'normalizedData', result, Date.now() - dataNormalizerStart);
          return result;
        } catch (error: any) {
          await markAgentFailed(effectiveLeadId, runId, 'dataNormalizer', error.message, Date.now() - dataNormalizerStart);
          throw error;
        }
      })(),
      (async () => {
        const prompt = buildDeepResearchPrompt(contact.businessName || '', sector, businessContext);
        const id = await startDeepResearch(prompt);
        if (id) {
          await checkpointDrInteractionId(effectiveLeadId, runId, id);
          await markAgentRunning(effectiveLeadId, runId, 'sectorResearch');
        }
        return id;
      })(),
      (async () => {
        if (!businessContext?.websiteUrl) return null;
        const result = await fetchAndParseWebsite(businessContext.websiteUrl);
        if (result) {
          await checkpointAgent(effectiveLeadId, runId, 'dataNormalizer', 'websiteData', result, 0);
        }
        return result;
      })(),
    ]);
    console.log(`analyze-start: dataNormalizer complete, DR=${drInteractionId || 'FAILED'}, website=${websiteData ? 'fetched' : 'none'}`);

    return res.status(200).json({
      status: drInteractionId ? 'researching' : 'dr_failed',
      drInteractionId: drInteractionId || null,
      normalizedData,
      websiteData: websiteData || null,
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
