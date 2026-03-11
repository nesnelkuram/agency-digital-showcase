import type { VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import {
  runSectorResearch,
  extractResearchJSON,
  pollDeepResearch,
  runBrandStrategist,
  runBrandChallenger,
  runBlogStrategyAdvisor,
  runStrategySynthesizer,
  runConsultantIntroWriter,
  runDigitalPresenceAnalyzer,
  runCompetitorDiscovery,
  runBrandStrategistRevision,
  runConsumerTest,
} from './_bundles/pipeline-bundle.mjs';
import {
  loadCheckpoint,
  markAgentRunning,
  checkpointAgent,
  markAgentFailed,
  markAgentSkipped,
  completeRun,
  failRun,
} from './_lib/checkpointManager.js';
import { withAuthOptional, OptionalAuthRequest } from './_lib/withAuth.js';

export const config = {
  maxDuration: 300,
};

const BUDGET_MS = 290_000; // 10s safety margin
const PIPELINE_BUDGET_MS = 150_000; // strategist(50s) + challenger(27s) + synthesizer(67s) + buffer(6s)

export default withAuthOptional(async (req: OptionalAuthRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const startTime = Date.now();
  const remaining = () => BUDGET_MS - (Date.now() - startTime);

  try {
    const { drInteractionId, drText, normalizedData, researchFindings: existingFindings, input, websiteData, runId } = req.body;

    if (!normalizedData || !input) {
      return res.status(400).json({ error: 'Missing required fields: normalizedData, input' });
    }

    const timings: Record<string, number> = {};
    const errors: Array<{ agent: string; error: string; timestamp: number }> = [];
    const agentsRun: string[] = [];
    const effectiveLeadId = input.leadId || 'unknown';

    // Load checkpoint for resume (best-effort — null if unavailable)
    const existingRun = runId ? await loadCheckpoint(effectiveLeadId) : null;
    const cp = existingRun?.checkpoint;
    const hasCheckpoint = !!cp && existingRun?.runId === runId;
    if (hasCheckpoint) {
      console.log(`analyze-continue: Checkpoint loaded for runId=${runId}, completed agents: ${
        Object.entries(existingRun!.agents).filter(([, a]) => a.status === 'completed').map(([n]) => n).join(', ') || 'none'
      }`);
    }

    console.log(`analyze-continue: START — existingFindings=${!!existingFindings}, drInteractionId=${drInteractionId || 'none'}, runId=${runId || 'none'}`);

    // ============================
    // PHASE A: Research (if needed)
    // ============================
    // Resume: use checkpointed research if available
    let researchFindings = (hasCheckpoint && cp?.researchFindings) || existingFindings || null;
    if (hasCheckpoint && cp?.researchFindings) {
      console.log('analyze-continue: Using checkpointed researchFindings (skipping research phase)');
      agentsRun.push('sectorResearch');
    }

    if (!researchFindings) {
      const researchStart = Date.now();

      if (drText && typeof drText === 'string' && drText.length > 200) {
        // --- DR text pre-fetched by client (via check-dr-status) ---
        console.log(`analyze-continue: Using pre-fetched DR text (${drText.length} chars), extracting JSON...`);
        const extractStart = Date.now();
        researchFindings = await extractResearchJSON(drText, [], [], -1, input.sector);
        timings.researchExtraction = Date.now() - extractStart;
        agentsRun.push('sectorResearch');
        const rc = researchFindings;
        console.log(`analyze-continue: DR extraction done in ${timings.researchExtraction}ms — competitors=${rc?.competitors?.length || 0}, sourcesUsed=${rc?.sourcesUsed}`);
        if (runId && researchFindings) {
          await checkpointAgent(effectiveLeadId, runId, 'sectorResearch', 'researchFindings', researchFindings, Date.now() - researchStart);
        }
      } else if (drInteractionId) {
        // --- DR interaction exists: poll it, fall back to grounding on timeout ---
        // Reserve 100s for grounding fallback + extraction if DR fails
        const drPollTimeout = Math.min(180_000, remaining() - 100_000);
        console.log(`analyze-continue: Polling DR (${drInteractionId}), timeout=${Math.max(drPollTimeout, 30_000)}ms, remaining=${remaining()}ms`);

        try {
          const drResult = await pollDeepResearch(drInteractionId, Math.max(drPollTimeout, 30_000));
          timings.drPoll = Date.now() - researchStart;

          if (drResult.status === 'completed' && drResult.text.length > 200) {
            // DR tamamlandi → JSON extraction
            console.log(`analyze-continue: DR completed (${drResult.text.length} chars), extracting JSON...`);
            const extractStart = Date.now();
            researchFindings = await extractResearchJSON(drResult.text, [], [], -1, input.sector);
            timings.researchExtraction = Date.now() - extractStart;
            agentsRun.push('sectorResearch');
            const rc = researchFindings;
            console.log(`analyze-continue: Research extraction done in ${timings.researchExtraction}ms — competitors=${rc?.competitors?.length || 0}, sourcesUsed=${rc?.sourcesUsed}, marketSize=${rc?.marketData?.marketSize?.slice?.(0, 50) || 'N/A'}`);
            if (runId && researchFindings) {
              await checkpointAgent(effectiveLeadId, runId, 'sectorResearch', 'researchFindings', researchFindings, Date.now() - researchStart);
            }
          } else if (drResult.status === 'timeout') {
            // DR poll timeout — fall back to grounding instead of infinite retry loop
            console.log(`analyze-continue: DR poll timeout after ${timings.drPoll}ms — falling back to grounding (DR stuck or too slow)`);
            try {
              if (runId) await markAgentRunning(effectiveLeadId, runId, 'sectorResearch');
              researchFindings = await runSectorResearch(input, { drTimeout: 0, startTimeMs: startTime, budgetMs: BUDGET_MS });
              timings.sectorResearch = Date.now() - researchStart;
              agentsRun.push('sectorResearch');
              if (runId && researchFindings) await checkpointAgent(effectiveLeadId, runId, 'sectorResearch', 'researchFindings', researchFindings, timings.sectorResearch);
              const rc = researchFindings;
              console.log(`analyze-continue: Grounding fallback (after DR timeout) done in ${timings.sectorResearch}ms — competitors=${rc?.competitors?.length || 0}, sourcesUsed=${rc?.sourcesUsed}`);
            } catch (error: any) {
              timings.sectorResearch = Date.now() - researchStart;
              errors.push({ agent: 'sectorResearch', error: error.message, timestamp: Date.now() });
              if (runId) await markAgentFailed(effectiveLeadId, runId, 'sectorResearch', error.message, timings.sectorResearch);
              console.error('analyze-continue: Grounding fallback (after DR timeout) failed:', error.message);
            }
          } else {
            // DR GERCEKTEN BASARISIZ (failed/cancelled) → grounding fallback
            console.log(`analyze-continue: DR failed (${drResult.status}), falling back to grounding...`);
            try {
              if (runId) await markAgentRunning(effectiveLeadId, runId, 'sectorResearch');
              researchFindings = await runSectorResearch(input, { drTimeout: 0, startTimeMs: startTime, budgetMs: BUDGET_MS });
              timings.sectorResearch = Date.now() - researchStart;
              agentsRun.push('sectorResearch');
              if (runId && researchFindings) await checkpointAgent(effectiveLeadId, runId, 'sectorResearch', 'researchFindings', researchFindings, timings.sectorResearch);
              const rc = researchFindings;
              console.log(`analyze-continue: Grounding fallback done in ${timings.sectorResearch}ms — competitors=${rc?.competitors?.length || 0}, sourcesUsed=${rc?.sourcesUsed}`);
            } catch (error: any) {
              timings.sectorResearch = Date.now() - researchStart;
              errors.push({ agent: 'sectorResearch', error: error.message, timestamp: Date.now() });
              if (runId) await markAgentFailed(effectiveLeadId, runId, 'sectorResearch', error.message, timings.sectorResearch);
              console.error('analyze-continue: Grounding fallback failed:', error.message);
            }
          }
        } catch (error: any) {
          timings.drPoll = Date.now() - researchStart;
          errors.push({ agent: 'drPoll', error: error.message, timestamp: Date.now() });
          console.error('analyze-continue: DR poll error:', error.message);
        }
      } else {
        // --- drInteractionId yok → dogrudan grounding ---
        console.log('analyze-continue: No DR interaction, running grounding research...');
        if (runId) await markAgentRunning(effectiveLeadId, runId, 'sectorResearch');
        try {
          researchFindings = await runSectorResearch(input, { drTimeout: 0, startTimeMs: startTime, budgetMs: BUDGET_MS });
          timings.sectorResearch = Date.now() - researchStart;
          agentsRun.push('sectorResearch');
          if (runId && researchFindings) await checkpointAgent(effectiveLeadId, runId, 'sectorResearch', 'researchFindings', researchFindings, timings.sectorResearch);
          const rc = researchFindings;
          console.log(`analyze-continue: Grounding research done in ${timings.sectorResearch}ms — competitors=${rc?.competitors?.length || 0}, sourcesUsed=${rc?.sourcesUsed}`);
        } catch (error: any) {
          timings.sectorResearch = Date.now() - researchStart;
          errors.push({ agent: 'sectorResearch', error: error.message, timestamp: Date.now() });
          if (runId) await markAgentFailed(effectiveLeadId, runId, 'sectorResearch', error.message, timings.sectorResearch);
          console.error('analyze-continue: Grounding research failed:', error.message);
        }
      }

      // Not enough time for pipeline? Return research and let client call again
      if (researchFindings && remaining() < PIPELINE_BUDGET_MS) {
        console.log(`analyze-continue: Not enough time for pipeline (${remaining()}ms remaining < ${PIPELINE_BUDGET_MS}ms needed), returning research for next call`);
        return res.status(200).json({
          status: 'research_complete',
          researchFindings,
          debug: { timings, errors, agentsRun, remainingMs: remaining() },
        });
      }
    } else {
      console.log(`analyze-continue: Using pre-existing research — competitors=${existingFindings?.competitors?.length || 0}, sourcesUsed=${existingFindings?.sourcesUsed}`);
    }

    // ============================
    // PHASE B: Pipeline agents
    // ============================

    // Research quality router — no extra LLM call
    const researchQuality: 'high' | 'medium' | 'low' | 'none' =
      !researchFindings ? 'none'
      : (researchFindings.sourcesUsed === 0 && researchFindings.competitors.length === 0) ? 'low'
      : researchFindings.competitors.length < 3 ? 'medium'
      : 'high';

    console.log(`analyze-continue: ROUTER — researchQuality=${researchQuality}, competitors=${researchFindings?.competitors?.length || 0}, sources=${researchFindings?.sourcesUsed || 0}`);
    console.log(`analyze-continue: PHASE B START — remaining=${remaining()}ms, hasResearch=${!!researchFindings}, sourcesUsed=${researchFindings?.sourcesUsed}`);

    // Agent 3 + 7 + 8: Brand Strategist + Digital Presence + Competitor Discovery — PARALLEL
    // Resume: use checkpointed outputs if available
    let strategistOutput = (hasCheckpoint && cp?.strategistOutput) || null;
    let digitalPresence = (hasCheckpoint && cp?.digitalPresence) || null;
    let competitorDiscovery = (hasCheckpoint && cp?.competitorDiscovery) || null;

    if (strategistOutput) {
      console.log('analyze-continue: Using checkpointed strategistOutput');
      agentsRun.push('brandStrategist');
    }
    if (digitalPresence) {
      console.log('analyze-continue: Using checkpointed digitalPresence');
      agentsRun.push('digitalPresenceAnalyzer');
    }
    if (competitorDiscovery) {
      console.log('analyze-continue: Using checkpointed competitorDiscovery');
      agentsRun.push('competitorDiscovery');
    }

    // Only run agents that don't have checkpointed output
    const needsStrategist = !strategistOutput;
    const needsDP = !digitalPresence;
    const needsCD = !competitorDiscovery;

    if ((needsStrategist || needsDP || needsCD) && remaining() > 10_000) {
      console.log(`analyze-continue: Running parallel group 1 — strategist=${needsStrategist}, dp=${needsDP}, cd=${needsCD}`);
      const parallelPhaseStart = Date.now();

      const [stratResult, dpResult, cdResult] = await Promise.all([
        // Agent 3: Brand Strategist (required — only if not checkpointed)
        (async () => {
          if (!needsStrategist) return strategistOutput;
          if (runId) await markAgentRunning(effectiveLeadId, runId, 'brandStrategist');
          const s = Date.now();
          try {
            const r = await runBrandStrategist(normalizedData, researchFindings, input.businessContext);
            timings.brandStrategist = Date.now() - s;
            agentsRun.push('brandStrategist');
            if (runId) await checkpointAgent(effectiveLeadId, runId, 'brandStrategist', 'strategistOutput', r, timings.brandStrategist);
            console.log(`analyze-continue: brandStrategist done in ${timings.brandStrategist}ms — archetype=${r?.archetype}`);
            return r;
          } catch (error: any) {
            timings.brandStrategist = Date.now() - s;
            errors.push({ agent: 'brandStrategist', error: error.message, timestamp: Date.now() });
            if (runId) await markAgentFailed(effectiveLeadId, runId, 'brandStrategist', error.message, timings.brandStrategist);
            console.error(`analyze-continue: brandStrategist failed in ${timings.brandStrategist}ms: ${error.message}`);
            return null;
          }
        })(),
        // Agent 7: Digital Presence Analyzer (optional — only if not checkpointed)
        (async () => {
          if (!needsDP) return digitalPresence;
          if (remaining() < 20_000) {
            if (runId) await markAgentSkipped(effectiveLeadId, runId, 'digitalPresenceAnalyzer');
            return null;
          }
          if (runId) await markAgentRunning(effectiveLeadId, runId, 'digitalPresenceAnalyzer');
          const s = Date.now();
          try {
            const r = await runDigitalPresenceAnalyzer(normalizedData, researchFindings, input.businessContext, websiteData);
            timings.digitalPresenceAnalyzer = Date.now() - s;
            agentsRun.push('digitalPresenceAnalyzer');
            if (runId) await checkpointAgent(effectiveLeadId, runId, 'digitalPresenceAnalyzer', 'digitalPresence', r, timings.digitalPresenceAnalyzer);
            console.log(`analyze-continue: digitalPresenceAnalyzer done in ${timings.digitalPresenceAnalyzer}ms — score=${r?.overallDigitalScore}`);
            return r;
          } catch (error: any) {
            timings.digitalPresenceAnalyzer = Date.now() - s;
            errors.push({ agent: 'digitalPresenceAnalyzer', error: error.message, timestamp: Date.now() });
            if (runId) await markAgentFailed(effectiveLeadId, runId, 'digitalPresenceAnalyzer', error.message, timings.digitalPresenceAnalyzer);
            console.error(`analyze-continue: digitalPresenceAnalyzer failed in ${timings.digitalPresenceAnalyzer}ms: ${error.message}`);
            return null;
          }
        })(),
        // Agent 8: Competitor Discovery (optional — only if not checkpointed)
        (async () => {
          if (!needsCD) return competitorDiscovery;
          if (remaining() < 20_000) {
            if (runId) await markAgentSkipped(effectiveLeadId, runId, 'competitorDiscovery');
            return null;
          }
          if (runId) await markAgentRunning(effectiveLeadId, runId, 'competitorDiscovery');
          const s = Date.now();
          try {
            const r = await runCompetitorDiscovery(normalizedData, researchFindings, input.businessContext);
            timings.competitorDiscovery = Date.now() - s;
            agentsRun.push('competitorDiscovery');
            if (runId) await checkpointAgent(effectiveLeadId, runId, 'competitorDiscovery', 'competitorDiscovery', r, timings.competitorDiscovery);
            console.log(`analyze-continue: competitorDiscovery done in ${timings.competitorDiscovery}ms — known=${r?.knownCompetitors?.length}, discovered=${r?.discoveredCompetitors?.length}`);
            return r;
          } catch (error: any) {
            timings.competitorDiscovery = Date.now() - s;
            errors.push({ agent: 'competitorDiscovery', error: error.message, timestamp: Date.now() });
            if (runId) await markAgentFailed(effectiveLeadId, runId, 'competitorDiscovery', error.message, timings.competitorDiscovery);
            console.error(`analyze-continue: competitorDiscovery failed in ${timings.competitorDiscovery}ms: ${error.message}`);
            return null;
          }
        })(),
      ]);

      strategistOutput = stratResult;
      digitalPresence = dpResult;
      competitorDiscovery = cdResult;
      console.log(`analyze-continue: parallel phase done in ${Date.now() - parallelPhaseStart}ms — strategist=${!!stratResult}, digitalPresence=${!!dpResult}, competitorDiscovery=${!!cdResult}`);
    } else if (needsStrategist) {
      console.log(`analyze-continue: SKIPPING brandStrategist — remaining=${remaining()}ms`);
      if (runId) {
        await markAgentSkipped(effectiveLeadId, runId, 'brandStrategist');
        await markAgentSkipped(effectiveLeadId, runId, 'digitalPresenceAnalyzer');
        await markAgentSkipped(effectiveLeadId, runId, 'competitorDiscovery');
      }
    }

    if (!strategistOutput) {
      console.error('analyze-continue: brandStrategist produced no output, returning failed');
      return res.status(200).json({
        status: 'failed',
        error: 'Brand strategist failed',
        researchFindings,
        debug: { timings, errors, agentsRun },
      });
    }

    // Agent 4a + 4b + 9: Challenger + Blog Advisor + Consumer Test (PARALLEL, optional)
    // Resume: use checkpointed outputs if available
    let challengerOutput = (hasCheckpoint && cp?.challengerOutput) || null;
    let blogAdvisorOutput = (hasCheckpoint && cp?.blogAdvisorOutput) || null;
    let consumerTestResult = (hasCheckpoint && cp?.consumerTest) || null;

    if (challengerOutput) { console.log('analyze-continue: Using checkpointed challengerOutput'); agentsRun.push('brandChallenger'); }
    if (blogAdvisorOutput) { console.log('analyze-continue: Using checkpointed blogAdvisorOutput'); agentsRun.push('blogStrategyAdvisor'); }
    if (consumerTestResult) { console.log('analyze-continue: Using checkpointed consumerTest'); agentsRun.push('consumerTest'); }

    const needsChallenger = !challengerOutput;
    const needsBlog = !blogAdvisorOutput;
    const needsConsumerTest = !consumerTestResult;

    if ((needsChallenger || needsBlog || needsConsumerTest) && remaining() > 30_000) {
      const parallelStart = Date.now();
      console.log(`analyze-continue: Running parallel group 2 — challenger=${needsChallenger}, blog=${needsBlog}, consumerTest=${needsConsumerTest}`);

      const [challResult, blogResult, ctResult] = await Promise.all([
        (async () => {
          if (!needsChallenger) return challengerOutput;
          if (runId) await markAgentRunning(effectiveLeadId, runId, 'brandChallenger');
          const s = Date.now();
          try {
            const r = await runBrandChallenger(normalizedData, researchFindings, strategistOutput, input.businessContext);
            timings.brandChallenger = Date.now() - s;
            agentsRun.push('brandChallenger');
            if (runId) await checkpointAgent(effectiveLeadId, runId, 'brandChallenger', 'challengerOutput', r, timings.brandChallenger);
            console.log(`analyze-continue: brandChallenger done in ${timings.brandChallenger}ms`);
            return r;
          } catch (error: any) {
            timings.brandChallenger = Date.now() - s;
            errors.push({ agent: 'brandChallenger', error: error.message, timestamp: Date.now() });
            if (runId) await markAgentFailed(effectiveLeadId, runId, 'brandChallenger', error.message, timings.brandChallenger);
            console.error(`analyze-continue: brandChallenger failed in ${timings.brandChallenger}ms: ${error.message}`);
            return null;
          }
        })(),
        (async () => {
          if (!needsBlog) return blogAdvisorOutput;
          if (runId) await markAgentRunning(effectiveLeadId, runId, 'blogStrategyAdvisor');
          const s = Date.now();
          try {
            const r = await runBlogStrategyAdvisor(normalizedData, researchFindings, strategistOutput);
            timings.blogStrategyAdvisor = Date.now() - s;
            agentsRun.push('blogStrategyAdvisor');
            if (runId) await checkpointAgent(effectiveLeadId, runId, 'blogStrategyAdvisor', 'blogAdvisorOutput', r, timings.blogStrategyAdvisor);
            console.log(`analyze-continue: blogStrategyAdvisor done in ${timings.blogStrategyAdvisor}ms`);
            return r;
          } catch (error: any) {
            timings.blogStrategyAdvisor = Date.now() - s;
            errors.push({ agent: 'blogStrategyAdvisor', error: error.message, timestamp: Date.now() });
            if (runId) await markAgentFailed(effectiveLeadId, runId, 'blogStrategyAdvisor', error.message, timings.blogStrategyAdvisor);
            console.error(`analyze-continue: blogStrategyAdvisor failed in ${timings.blogStrategyAdvisor}ms: ${error.message}`);
            return null;
          }
        })(),
        // Agent 9: Consumer Test (moved here from Group 3 — tests strategy BEFORE synthesis)
        (async () => {
          if (!needsConsumerTest) return consumerTestResult;
          if (remaining() < 25_000) {
            if (runId) await markAgentSkipped(effectiveLeadId, runId, 'consumerTest');
            console.log(`analyze-continue: SKIPPING consumerTest — remaining=${remaining()}ms`);
            return null;
          }
          if (runId) await markAgentRunning(effectiveLeadId, runId, 'consumerTest');
          const s = Date.now();
          try {
            const r = await runConsumerTest(normalizedData, strategistOutput, researchFindings, input.businessContext);
            timings.consumerTest = Date.now() - s;
            agentsRun.push('consumerTest');
            if (runId) await checkpointAgent(effectiveLeadId, runId, 'consumerTest', 'consumerTest', r, timings.consumerTest);
            console.log(`analyze-continue: consumerTest done in ${timings.consumerTest}ms — viability=${r?.overallViabilityScore}, personas=${r?.personas?.length}`);
            return r;
          } catch (error: any) {
            timings.consumerTest = Date.now() - s;
            errors.push({ agent: 'consumerTest', error: error.message, timestamp: Date.now() });
            if (runId) await markAgentFailed(effectiveLeadId, runId, 'consumerTest', error.message, timings.consumerTest);
            console.error(`analyze-continue: consumerTest failed in ${timings.consumerTest}ms: ${error.message}`);
            return null;
          }
        })(),
      ]);

      challengerOutput = challResult;
      blogAdvisorOutput = blogResult;
      consumerTestResult = ctResult;
      console.log(`analyze-continue: parallel group 2 done in ${Date.now() - parallelStart}ms — challenger=${!!challResult}, blogAdvisor=${!!blogResult}, consumerTest=${!!ctResult}`);
    } else if (needsChallenger && needsBlog) {
      console.log(`analyze-continue: SKIPPING challenger+blogAdvisor+consumerTest — remaining=${remaining()}ms`);
      if (runId) {
        await markAgentSkipped(effectiveLeadId, runId, 'brandChallenger');
        await markAgentSkipped(effectiveLeadId, runId, 'blogStrategyAdvisor');
        await markAgentSkipped(effectiveLeadId, runId, 'consumerTest');
      }
    }

    // NEW: Strategist Revision — give strategist a chance to defend/revise based on challenger critique
    let effectiveStrategistOutput = strategistOutput;
    const hasRevisionCheckpoint = hasCheckpoint && cp?.revisedStrategistOutput;
    if (hasRevisionCheckpoint) {
      effectiveStrategistOutput = cp.revisedStrategistOutput;
      console.log('analyze-continue: Using checkpointed revisedStrategistOutput');
      agentsRun.push('strategistRevision');
    } else if (challengerOutput && remaining() > 100_000) {
      if (runId) await markAgentRunning(effectiveLeadId, runId, 'strategistRevision');
      const revStart = Date.now();
      try {
        console.log(`analyze-continue: Running strategistRevision (remaining=${remaining()}ms)...`);
        const revisedOutput = await runBrandStrategistRevision(normalizedData, strategistOutput, challengerOutput, researchFindings, consumerTestResult);
        timings.strategistRevision = Date.now() - revStart;
        agentsRun.push('strategistRevision');
        if (revisedOutput) {
          effectiveStrategistOutput = revisedOutput;
          if (runId) await checkpointAgent(effectiveLeadId, runId, 'strategistRevision', 'revisedStrategistOutput', revisedOutput, timings.strategistRevision);
        }
        console.log(`analyze-continue: strategistRevision done in ${timings.strategistRevision}ms — archetype=${revisedOutput?.archetype}`);
      } catch (error: any) {
        timings.strategistRevision = Date.now() - revStart;
        errors.push({ agent: 'strategistRevision', error: error.message, timestamp: Date.now() });
        if (runId) await markAgentFailed(effectiveLeadId, runId, 'strategistRevision', error.message, timings.strategistRevision);
        console.error(`analyze-continue: strategistRevision failed in ${timings.strategistRevision}ms: ${error.message}`);
        // Fall back to original strategist output (already the default)
      }
    } else if (challengerOutput && runId) {
      // Not enough time for revision + synth + group3 — defer to next call via checkpoint
      console.log(`analyze-continue: Deferring pipeline — remaining=${remaining()}ms < 100s needed for revision+synth+group3`);
      return res.status(200).json({
        status: 'pipeline_partial',
        phase: 'awaiting_revision',
        debug: { timings, errors, agentsRun, remainingMs: remaining() },
      });
    } else if (challengerOutput) {
      // No runId, can't checkpoint — skip revision (legacy behavior)
      console.log(`analyze-continue: SKIPPING strategistRevision — no runId for checkpoint deferral`);
    }

    // Agent 5: Strategy Synthesizer (optional with fallback)
    // Resume: use checkpointed output if available
    let synthesizedAnalysis = (hasCheckpoint && cp?.synthesizedAnalysis) || null;
    if (synthesizedAnalysis) { console.log('analyze-continue: Using checkpointed synthesizedAnalysis'); agentsRun.push('strategySynthesizer'); }

    if (!synthesizedAnalysis && remaining() > 10_000) {
      if (runId) await markAgentRunning(effectiveLeadId, runId, 'strategySynthesizer');
      const synthStart = Date.now();
      try {
        console.log('analyze-continue: Running strategySynthesizer...');
        synthesizedAnalysis = await runStrategySynthesizer(normalizedData, researchFindings, effectiveStrategistOutput, challengerOutput, blogAdvisorOutput, input.businessContext, digitalPresence, competitorDiscovery);
        timings.strategySynthesizer = Date.now() - synthStart;
        agentsRun.push('strategySynthesizer');
        if (runId) await checkpointAgent(effectiveLeadId, runId, 'strategySynthesizer', 'synthesizedAnalysis', synthesizedAnalysis, timings.strategySynthesizer);
        console.log(`analyze-continue: strategySynthesizer done in ${timings.strategySynthesizer}ms`);
      } catch (error: any) {
        timings.strategySynthesizer = Date.now() - synthStart;
        errors.push({ agent: 'strategySynthesizer', error: error.message, timestamp: Date.now() });
        if (runId) await markAgentFailed(effectiveLeadId, runId, 'strategySynthesizer', error.message, timings.strategySynthesizer);
        console.error(`analyze-continue: strategySynthesizer failed in ${timings.strategySynthesizer}ms: ${error.message}`);
      }
    } else if (!synthesizedAnalysis) {
      console.log(`analyze-continue: SKIPPING strategySynthesizer — remaining=${remaining()}ms`);
      if (runId) await markAgentSkipped(effectiveLeadId, runId, 'strategySynthesizer');
    }

    // ============================
    // Agent 6: Consultant Intro Writer
    // ============================
    let consultantIntroText = (hasCheckpoint && cp?.consultantIntro) || '';
    if (consultantIntroText) { console.log('analyze-continue: Using checkpointed consultantIntro'); agentsRun.push('consultantIntroWriter'); }

    const synthesizedForIntro = synthesizedAnalysis || buildFallbackSynthesis(effectiveStrategistOutput);

    if (!consultantIntroText) {
      if (remaining() < 8_000) {
        if (runId) await markAgentSkipped(effectiveLeadId, runId, 'consultantIntroWriter');
        console.log(`analyze-continue: SKIPPING consultantIntroWriter — remaining=${remaining()}ms`);
      } else {
        if (runId) await markAgentRunning(effectiveLeadId, runId, 'consultantIntroWriter');
        const s = Date.now();
        try {
          consultantIntroText = await runConsultantIntroWriter(
            normalizedData,
            researchFindings,
            synthesizedForIntro,
            blogAdvisorOutput,
            input.businessContext,
          );
          timings.consultantIntroWriter = Date.now() - s;
          agentsRun.push('consultantIntroWriter');
          if (runId) await checkpointAgent(effectiveLeadId, runId, 'consultantIntroWriter', 'consultantIntro', consultantIntroText, timings.consultantIntroWriter);
          console.log(`analyze-continue: consultantIntroWriter done in ${timings.consultantIntroWriter}ms — ${consultantIntroText.length} chars`);
        } catch (error: any) {
          timings.consultantIntroWriter = Date.now() - s;
          errors.push({ agent: 'consultantIntroWriter', error: error.message, timestamp: Date.now() });
          if (runId) await markAgentFailed(effectiveLeadId, runId, 'consultantIntroWriter', error.message, timings.consultantIntroWriter);
          console.error(`analyze-continue: consultantIntroWriter failed in ${timings.consultantIntroWriter}ms: ${error.message}`);
        }
      }
    }

    // ============================
    // FORMAT ANALYSIS
    // ============================
    const usedFallback = !synthesizedAnalysis;
    const synthesized = synthesizedAnalysis || synthesizedForIntro;
    const totalDuration = Date.now() - startTime;
    timings.total = totalDuration;

    console.log(`analyze-continue: FORMAT — fallback=${usedFallback}, agents=[${agentsRun.join(',')}], total=${totalDuration}ms, remaining=${remaining()}ms`);

    const analysis = {
      brandPersonality: synthesized.brandPersonality,
      visualWorld: synthesized.visualWorld,
      contentStrategy: synthesized.contentStrategy,
      analysis: synthesized.analysis,
      positioning: synthesized.positioning,

      sectorResearch: researchFindings
        ? {
            competitors: researchFindings.competitors,
            marketData: researchFindings.marketData,
            targetAudienceInsights: researchFindings.targetAudienceInsights,
            marketTrends: researchFindings.marketData?.consumerTrends || [],
            sectorBenchmarks: researchFindings.sectorBenchmarks,
            searchQueries: researchFindings.searchQueries,
            sourcesUsed: researchFindings.sourcesUsed,
            sourceUrls: researchFindings.sourceUrls,
            // Pass through sector-specific data (e.g. hospitalityData, retailData, etc.)
            ...Object.fromEntries(
              Object.entries(researchFindings)
                .filter(([k]) => k.endsWith('Data') && k !== 'marketData')
            ),
          }
        : undefined,

      actionPlan: synthesized.actionPlan,
      evidenceSummary: synthesized.evidenceSummary,
      consultantIntro: consultantIntroText || synthesized.consultantIntro || undefined,

      debate: effectiveStrategistOutput
        ? {
            strategistPosition: `${effectiveStrategistOutput.archetype}: ${effectiveStrategistOutput.positioningStatement}`,
            challengerPosition: challengerOutput
              ? `${challengerOutput.alternativeArchetype}: ${challengerOutput.counterPosition}`
              : 'Muhalif degerlendirmesi yapilmadi',
            blogAdvisorPosition: blogAdvisorOutput
              ? `Felsefi uyum: ${blogAdvisorOutput.philosophicalAlignment.score}/10 — ${blogAdvisorOutput.philosophicalAlignment.rationale}`
              : 'Stratejik felsefe degerlendirmesi yapilmadi',
            challengerAlternatives: challengerOutput?.alternativePositionings || [],
            synthesisRationale: synthesized.synthesisRationale || '',
            debateCompleted: !!challengerOutput,
            blogAdvisorCompleted: !!blogAdvisorOutput,
          }
        : undefined,

      blogAdvisorInsights: blogAdvisorOutput
        ? {
            philosophicalAlignmentScore: blogAdvisorOutput.philosophicalAlignment.score,
            alignedPrinciples: blogAdvisorOutput.philosophicalAlignment.alignedPrinciples,
            conflictingPrinciples: blogAdvisorOutput.philosophicalAlignment.conflictingPrinciples,
            keyRecommendations: blogAdvisorOutput.strategicRecommendations.map(
              (r: any) => `[${r.area}] ${r.recommendation}`
            ),
            contentPillars: blogAdvisorOutput.contentStrategyInsights.contentPillars,
            topicSuggestions: blogAdvisorOutput.contentStrategyInsights.topicSuggestions,
            narrativeApproach: blogAdvisorOutput.contentStrategyInsights.narrativeApproach,
            unconventionalInsights: blogAdvisorOutput.unconventionalInsights,
            authorPerspective: blogAdvisorOutput.authorPerspective,
          }
        : undefined,

      digitalPresence: digitalPresence || undefined,
      competitorDiscovery: competitorDiscovery || undefined,
      consumerTest: consumerTestResult || undefined,

      // Faz 2 — Strategic depth outputs
      brandNarrative: synthesized.brandNarrative || undefined,
      intibaEngagement: synthesized.intibaEngagement || undefined,
      perceptualMap: synthesized.perceptualMap || undefined,
      brandMaturity: normalizedData?.brandMaturity || undefined,

      // Faz 3 — Yapaylıktan uzaklaşma çıktıları
      strategicDepth: synthesized.strategicDepth || undefined,
      brandCharacter: synthesized.brandCharacter || undefined,
      qualityMetrics: synthesized.qualityMetrics || undefined,

      dataQuality: normalizedData
        ? {
            completeness: normalizedData.dataQualityScore,
            contradictions: normalizedData.contradictions,
            patterns: normalizedData.detectedPatterns,
            missingAreas: normalizedData.missingAreas,
          }
        : undefined,

      pipelineMetadata: {
        version: '3.6.0',
        agentsRun,
        totalDuration,
        agentDurations: Object.fromEntries(
          Object.entries(timings).filter(([k]) => k !== 'total')
        ),
        researchAvailable: !!researchFindings && (researchFindings.sourcesUsed !== 0),
        researchMethod: researchFindings?.sourcesUsed === -1 ? 'deep-research' : researchFindings?.sourcesUsed ? 'grounding' : 'none',
        researchQuality,
        fallbackUsed: usedFallback,
        strategistRevised: effectiveStrategistOutput !== strategistOutput,
        consumerTestedBeforeRevision: !!consumerTestResult,
        asyncPipeline: true,
      },

      analyzedBy: 'gemini-multi-agent' as const,
      modelVersion: 'pipeline-v1.0',
      confidence: normalizedData?.dataQualityScore ?? 0.5,
    };

    // Mark pipeline run as completed (checkpoint data cleaned up)
    if (runId) await completeRun(effectiveLeadId, runId);

    return res.status(200).json({
      status: 'completed',
      analysis,
      debug: { timings, errors, agentsRun },
    });
  } catch (error: any) {
    console.error('analyze-continue error:', error);
    // Mark pipeline run as failed
    const { runId: rid, input: inp } = req.body || {};
    if (rid && inp?.leadId) await failRun(inp.leadId, rid, String(error?.message || 'Continue phase failed')).catch(() => {});
    try {
      return res.status(500).json({
        status: 'failed',
        error: String(error?.message || 'Continue phase failed'),
        details: String(error?.stack || '').split('\n').slice(0, 3),
      });
    } catch {
      return res.status(500).end(JSON.stringify({ status: 'failed', error: 'Internal server error' }));
    }
  }
});

// Fallback synthesis when synthesizer is skipped
function buildFallbackSynthesis(strategistOutput: any) {
  const taObj = strategistOutput.targetAudience;
  const taSummary = typeof taObj === 'string'
    ? taObj
    : `${taObj?.primarySegment?.demographics || ''} davranissal segment`;

  return {
    brandPersonality: {
      archetype: strategistOutput.archetype,
      traits: strategistOutput.traits,
      tone: strategistOutput.tone,
      voice: strategistOutput.voice,
    },
    positioning: {
      statement: strategistOutput.positioningStatement,
      targetAudience: taSummary,
      valuePropositionReasoning: strategistOutput.valuePropositionReasoning || {
        whatBusinessProduces: '', coreBenefit: '', whoBenefits: '', pricePositioning: '', willingToPayProfile: '',
      },
      targetSegments: [taObj?.primarySegment, taObj?.secondarySegment].filter(Boolean),
      differentiator: strategistOutput.differentiator,
      competitiveAdvantage: strategistOutput.competitiveAdvantage,
      competitiveLandscape: '',
      alternativePositions: [],
    },
    visualWorld: { moodKeywords: [], colorPalette: [], typographyStyle: '', imageryStyle: '' },
    contentStrategy: { pillars: [], toneGuidelines: [], keyMessages: [], hashtags: [] },
    analysis: { strengths: [], opportunities: [], challenges: [], recommendations: [] },
    actionPlan: { immediate: [], shortTerm: [], mediumTerm: [] },
    evidenceSummary: {
      sourcesConsulted: 0,
      keySourceUrls: [],
      dataFreshness: 'Veri mevcut degil',
      confidenceLevel: 'Dusuk — Sentez asamasi atlanmistir',
    },
    consultantIntro: '',
    synthesisRationale: 'Sentez asamasi atlanmistir, stratejist ciktisi dogrudan kullanilmistir.',
  };
}
