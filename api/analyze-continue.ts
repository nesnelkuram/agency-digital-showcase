import type { VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import {
  runDataNormalizer,
  fetchAndParseWebsite,
  scrapeInstagramPublic,
  fetchGooglePlacesData,
  runSectorResearch,
  extractResearchJSON,
  pollDeepResearch,
  runBrandStrategist,
  runBrandChallenger,
  runBlogStrategyAdvisor,
  runStrategySynthesizer,
  runDigitalPresenceAnalyzer,
  runConsumerTest,
  generateIntibaRoadmap,
  buildPipelineEvidence,
  runPositioningConsensus,
} from './_bundles/pipeline-bundle.mjs';
// Removed: runConsultantIntroWriter, runBrandValueMaximizer, runDeliverableEnricher,
//          runFrictionAnalyzer, runBrandStrategistRevision, runCompetitorDiscovery
// These are now absorbed into strategySynthesizer or brandStrategist(revisionMode)
import {
  loadCheckpoint,
  markAgentRunning,
  checkpointAgent,
  markAgentFailed,
  markAgentSkipped,
  completeRun,
  failRun,
  pauseForApproval,
} from './_lib/checkpointManager.js';
import { withAuthOptional, OptionalAuthRequest } from './_lib/withAuth.js';
import { searchBlogArticles as hetznerSearchBlog, isHetznerConfigured } from './_lib/hetznerClient.js';

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
    const { drInteractionId, drText, researchFindings: existingFindings, input, runId } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Missing required field: input' });
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
    // PHASE 0: dataNormalizer + websiteFetch (Hetzner — all agents run here)
    // ============================
    let normalizedData = (hasCheckpoint && cp?.normalizedData) || null;
    let websiteData = (hasCheckpoint && cp?.websiteData) || null;
    let instagramData: any = null;
    let googlePlacesData: any = null;

    if (normalizedData) {
      console.log('analyze-continue: Using checkpointed normalizedData');
      agentsRun.push('dataNormalizer');
    } else {
      console.log('analyze-continue: Running Phase 0 — dataNormalizer + websiteFetch + instagramScrape + googlePlaces in parallel...');
      const phase0Start = Date.now();
      await markAgentRunning(effectiveLeadId, runId, 'dataNormalizer');

      const bc = input.businessContext;
      const [normResult, webResult, igResult, placesResult] = await Promise.all([
        // dataNormalizer (required)
        (async () => {
          try {
            const r = await runDataNormalizer(input);
            timings.dataNormalizer = Date.now() - phase0Start;
            agentsRun.push('dataNormalizer');
            if (runId) await checkpointAgent(effectiveLeadId, runId, 'dataNormalizer', 'normalizedData', r, timings.dataNormalizer);
            console.log(`analyze-continue: dataNormalizer done in ${timings.dataNormalizer}ms`);
            return r;
          } catch (error: any) {
            timings.dataNormalizer = Date.now() - phase0Start;
            if (runId) await markAgentFailed(effectiveLeadId, runId, 'dataNormalizer', error.message, timings.dataNormalizer);
            throw new Error(`dataNormalizer failed: ${error.message}`);
          }
        })(),
        // Website crawl (optional, non-fatal)
        (async () => {
          if (!bc?.websiteUrl) return null;
          try {
            const r = await fetchAndParseWebsite(bc.websiteUrl);
            if (r && runId) await checkpointAgent(effectiveLeadId, runId, 'dataNormalizer', 'websiteData', r, 0);
            console.log(`analyze-continue: websiteFetch done — pages=${r?.pagesScraped?.length || 0}, products=${r?.productListings?.length || 0}, social=${Object.keys(r?.businessIntel?.socialLinks || {}).length}`);
            return r;
          } catch {
            return null;
          }
        })(),
        // Instagram public data (optional, non-fatal)
        (async () => {
          const handle = bc?.instagramHandle;
          if (!handle) return null;
          try {
            const r = await scrapeInstagramPublic(handle);
            console.log(`analyze-continue: instagramScrape done — followers=${r?.followerCount}, maturity=${r?.accountMaturity}`);
            return r;
          } catch {
            return null;
          }
        })(),
        // Google Places data (optional, non-fatal)
        (async () => {
          const businessName = input.contact?.businessName;
          if (!businessName) return null;
          try {
            const r = await fetchGooglePlacesData(businessName, bc?.geoScope);
            console.log(`analyze-continue: googlePlaces done — rating=${r?.rating}, reviews=${r?.reviewCount}`);
            return r;
          } catch {
            return null;
          }
        })(),
      ]);

      normalizedData = normResult;
      websiteData = webResult;
      instagramData = igResult;
      googlePlacesData = placesResult;

      // Update dataGaps based on what was gathered
      if (normalizedData?.dataGaps) {
        for (const gap of normalizedData.dataGaps) {
          if (gap.field === 'websiteData' && websiteData) gap.status = 'complete';
          if (gap.field === 'priceRange' && websiteData?.businessIntel?.priceRange?.segment !== 'unknown') gap.status = 'complete';
          if (gap.field === 'instagramData' && instagramData) gap.status = 'complete';
          if (gap.field === 'googleReviews' && googlePlacesData) gap.status = 'complete';
        }
      }

      console.log(`analyze-continue: Phase 0 done in ${Date.now() - phase0Start}ms — normalizer=OK, website=${!!websiteData}, instagram=${!!instagramData}, places=${!!googlePlacesData}`);
    }

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
    // HETZNER DELEGATION: If Hetzner is configured, delegate the full pipeline
    // Research is already resolved at this point — send everything to Hetzner
    // ============================
    // Hetzner delegation temporarily disabled — Hetzner has old pipeline code, v2 runs on Vercel
    if (false && isHetznerConfigured() && input.mode === 'full' && researchFindings) {
      const HETZNER_URL = process.env.HETZNER_PIPELINE_URL!;
      const PIPELINE_SECRET = process.env.PIPELINE_API_SECRET!;
      try {
        console.log(`analyze-continue: DELEGATING to Hetzner (${HETZNER_URL})`);
        const hetznerRes = await fetch(`${HETZNER_URL}/api/pipeline/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-pipeline-secret': PIPELINE_SECRET },
          body: JSON.stringify({
            leadId: effectiveLeadId, input, normalizedData, researchFindings, websiteData,
          }),
        });
        if (hetznerRes.ok) {
          const { jobId } = await hetznerRes.json();
          console.log(`analyze-continue: Hetzner job enqueued: ${jobId}`);
          // Pipeline runs async on Hetzner — Firestore gets updated directly
          // Frontend watches pipelineRun via useAnalysisProgress hook
          return res.status(200).json({
            status: 'delegated_to_hetzner',
            jobId,
            debug: { timings, errors, agentsRun, delegatedAt: Date.now() },
          });
        }
        console.warn(`analyze-continue: Hetzner delegation failed (${hetznerRes.status}), falling back to Vercel`);
      } catch (err: any) {
        console.warn(`analyze-continue: Hetzner unreachable (${err.message}), falling back to Vercel`);
      }
    }

    // ============================
    // PHASE B: Pipeline agents (Vercel fallback)
    // ============================

    // Research quality router — no extra LLM call
    const usedDeepResearch = researchFindings?.sourcesUsed === -1 || (researchFindings?.sourcesUsed ?? 0) >= 5;
    const researchDegraded = !usedDeepResearch && !!researchFindings;
    const researchQuality: 'high' | 'medium' | 'low' | 'none' =
      !researchFindings ? 'none'
      : (researchFindings.sourcesUsed === 0 && researchFindings.competitors.length === 0) ? 'low'
      : researchFindings.competitors.length < 3 ? 'medium'
      : 'high';

    if (researchDegraded) {
      console.log(`analyze-continue: ⚠️ Research degraded — grounding fallback used instead of Deep Research. Report confidence will be reduced.`);
    }

    console.log(`analyze-continue: ROUTER — researchQuality=${researchQuality}, competitors=${researchFindings?.competitors?.length || 0}, sources=${researchFindings?.sourcesUsed || 0}`);
    console.log(`analyze-continue: PHASE B START — remaining=${remaining()}ms, hasResearch=${!!researchFindings}, sourcesUsed=${researchFindings?.sourcesUsed}`);

    // Semantic search via Hetzner Qdrant (non-blocking, fallback to null)
    const semanticQuery = `${input.contact.businessName} ${input.sector} marka stratejisi konumlandırma`;
    const semanticBlogResults = await hetznerSearchBlog(semanticQuery, 5).catch(() => null);
    if (semanticBlogResults) {
      console.log(`analyze-continue: Semantic search OK — ${semanticBlogResults.length} articles (top: ${semanticBlogResults[0]?.title}, score: ${semanticBlogResults[0]?.score?.toFixed(2)})`);
    } else {
      console.log('analyze-continue: Semantic search unavailable — falling back to keyword search');
    }

    // Agent 3 + 7 + 8: Brand Strategist + Digital Presence + Competitor Discovery — PARALLEL
    // Phase B: Brand Strategist + Digital Presence (PARALLEL)
    // competitorDiscovery removed — research already provides competitor data
    let strategistOutput = (hasCheckpoint && cp?.strategistOutput) || null;
    let digitalPresence = (hasCheckpoint && cp?.digitalPresence) || null;
    const competitorDiscovery = null; // removed — kept for type compat with synthesizer

    if (strategistOutput) {
      console.log('analyze-continue: Using checkpointed strategistOutput');
      agentsRun.push('brandStrategist');
    }
    if (digitalPresence) {
      console.log('analyze-continue: Using checkpointed digitalPresence');
      agentsRun.push('digitalPresenceAnalyzer');
    }

    const needsStrategist = !strategistOutput;
    const needsDP = !digitalPresence;

    if ((needsStrategist || needsDP) && remaining() > 10_000) {
      console.log(`analyze-continue: Running parallel group 1 — strategist=${needsStrategist}, dp=${needsDP}`);
      const parallelPhaseStart = Date.now();

      const [stratResult, dpResult] = await Promise.all([
        // Agent 3: Brand Strategist (required — only if not checkpointed)
        (async () => {
          if (!needsStrategist) return strategistOutput;
          if (runId) await markAgentRunning(effectiveLeadId, runId, 'brandStrategist');
          const s = Date.now();
          try {
            const r = await runBrandStrategist(normalizedData, researchFindings, input.businessContext, input.adminNotes, semanticBlogResults);
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
            const r = await runDigitalPresenceAnalyzer(normalizedData, researchFindings, input.businessContext, websiteData, instagramData, googlePlacesData);
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
        // competitorDiscovery removed — research provides competitor data
      ]);

      strategistOutput = stratResult;
      digitalPresence = dpResult;
      console.log(`analyze-continue: parallel phase done in ${Date.now() - parallelPhaseStart}ms — strategist=${!!stratResult}, digitalPresence=${!!dpResult}`);
    } else if (needsStrategist) {
      console.log(`analyze-continue: SKIPPING brandStrategist — remaining=${remaining()}ms`);
      if (runId) {
        await markAgentSkipped(effectiveLeadId, runId, 'brandStrategist');
        await markAgentSkipped(effectiveLeadId, runId, 'digitalPresenceAnalyzer');
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

    // ── Phase B.5: Multi-Model Consensus (MANDATORY) ─────────────────────────
    // Validates brandStrategist's positioning + archetype decision before Phase C.
    // If consensus fails (score < 60), revision becomes mandatory in Phase C.5
    // regardless of whether challenger ran.
    let consensusResult = (hasCheckpoint && cp?.consensusResult) || null;
    if (consensusResult) {
      console.log(`analyze-continue: Using checkpointed consensusResult (score=${consensusResult.consensusScore})`);
      agentsRun.push('multiModelConsensus');
    } else if (remaining() > 20_000) {
      if (runId) await markAgentRunning(effectiveLeadId, runId, 'multiModelConsensus');
      const consensusStart = Date.now();
      try {
        const contextStr = `Profil: ${normalizedData.overallProfile}. Farklilik: ${strategistOutput.differentiator}. Rekabet avantaji: ${strategistOutput.competitiveAdvantage}.${researchFindings ? ` Pazar: ${researchFindings.marketData.marketSize}. Rakipler: ${researchFindings.competitors.map((c: any) => c.name).join(', ')}.` : ''}`;
        consensusResult = await runPositioningConsensus(
          normalizedData.businessName,
          normalizedData.sector,
          strategistOutput.positioningStatement,
          strategistOutput.archetype,
          contextStr,
        );
        timings.multiModelConsensus = Date.now() - consensusStart;
        agentsRun.push('multiModelConsensus');
        if (runId) await checkpointAgent(effectiveLeadId, runId, 'multiModelConsensus', 'consensusResult', consensusResult, timings.multiModelConsensus);
        console.log(`analyze-continue: multiModelConsensus done in ${timings.multiModelConsensus}ms — score=${consensusResult.consensusScore}, revisionNeeded=${consensusResult.revisionNeeded}`);
      } catch (error: any) {
        timings.multiModelConsensus = Date.now() - consensusStart;
        errors.push({ agent: 'multiModelConsensus', error: error.message, timestamp: Date.now() });
        if (runId) await markAgentFailed(effectiveLeadId, runId, 'multiModelConsensus', error.message, timings.multiModelConsensus);
        console.error(`analyze-continue: multiModelConsensus failed — ${error.message}`);
        // Non-fatal: continue without consensus
      }
    }

    // Agent 4a + 4b + 9: Challenger + Blog Advisor + Consumer Test (PARALLEL, optional)
    // Resume: use checkpointed outputs if available
    // Phase C: Challenger + Blog Advisor + Consumer Test (PARALLEL)
    // frictionAnalyzer removed — its logic is distilled into strategySynthesizer prompt
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
            const r = await runBrandChallenger(normalizedData, researchFindings, strategistOutput, input.businessContext, input.adminNotes);
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
            const r = await runBlogStrategyAdvisor(normalizedData, researchFindings, strategistOutput, semanticBlogResults);
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
        // frictionAnalyzer removed — distilled into strategySynthesizer prompt
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

    // Phase C.5: Strategist Revision
    // Triggered by: (a) challenger critique OR (b) consensus failure (score < 60)
    // Consensus failure makes revision MANDATORY — cascade risk mitigation.
    const consensusFailed = consensusResult?.revisionNeeded === true;
    const shouldRevise = challengerOutput || consensusFailed;

    let effectiveStrategistOutput = strategistOutput;
    const hasRevisionCheckpoint = hasCheckpoint && cp?.revisedStrategistOutput;
    if (hasRevisionCheckpoint) {
      effectiveStrategistOutput = cp.revisedStrategistOutput;
      console.log('analyze-continue: Using checkpointed revisedStrategistOutput');
      agentsRun.push('strategistRevision');
    } else if (shouldRevise && remaining() > 100_000) {
      if (runId) await markAgentRunning(effectiveLeadId, runId, 'strategistRevision');
      const revStart = Date.now();
      const revisionTrigger = consensusFailed
        ? `consensus_failure(score=${consensusResult?.consensusScore})`
        : 'challenger_critique';
      try {
        console.log(`analyze-continue: Running strategistRevision via brandStrategist(revisionMode) — trigger=${revisionTrigger}, remaining=${remaining()}ms`);
        const revisedOutput = await runBrandStrategist(
          normalizedData,
          researchFindings,
          input.businessContext,
          input.adminNotes,
          semanticBlogResults,
          {
            originalOutput: strategistOutput,
            challengerOutput,
            consumerTestOutput: consumerTestResult,
            consensusRevisionReason: consensusResult?.revisionReason,
            consensusSuggestedWeakness: consensusResult?.suggestedWeakness,
          },
        );
        timings.strategistRevision = Date.now() - revStart;
        agentsRun.push('strategistRevision');
        if (revisedOutput) {
          effectiveStrategistOutput = revisedOutput;
          if (runId) await checkpointAgent(effectiveLeadId, runId, 'strategistRevision', 'revisedStrategistOutput', revisedOutput, timings.strategistRevision);
        }
        console.log(`analyze-continue: strategistRevision done in ${timings.strategistRevision}ms — trigger=${revisionTrigger}, archetype=${revisedOutput?.archetype}`);
      } catch (error: any) {
        timings.strategistRevision = Date.now() - revStart;
        errors.push({ agent: 'strategistRevision', error: error.message, timestamp: Date.now() });
        if (runId) await markAgentFailed(effectiveLeadId, runId, 'strategistRevision', error.message, timings.strategistRevision);
        console.error(`analyze-continue: strategistRevision failed in ${timings.strategistRevision}ms: ${error.message}`);
      }
    } else if (shouldRevise && runId) {
      console.log(`analyze-continue: Deferring pipeline — remaining=${remaining()}ms < 100s needed for revision+synth+group3`);
      return res.status(200).json({
        status: 'pipeline_partial',
        phase: 'awaiting_revision',
        debug: { timings, errors, agentsRun, remainingMs: remaining() },
      });
    } else if (shouldRevise) {
      console.log(`analyze-continue: SKIPPING strategistRevision — no runId for checkpoint deferral`);
    }

    // ============================
    // APPROVAL GATE: Pause for human review after revision (full mode only)
    // ============================
    const revisionHappened = effectiveStrategistOutput !== strategistOutput;
    const approvalAlreadyGiven = hasCheckpoint && existingRun?.approvalStatus === 'approved';
    const synthesizedCheckpointed = hasCheckpoint && cp?.synthesizedAnalysis;

    if (revisionHappened && !approvalAlreadyGiven && !synthesizedCheckpointed && input.mode === 'full') {
      const preview = {
        archetype: effectiveStrategistOutput.archetype,
        positioningStatement: effectiveStrategistOutput.positioningStatement,
        traits: effectiveStrategistOutput.traits,
        tone: effectiveStrategistOutput.tone,
        differentiator: effectiveStrategistOutput.differentiator,
        consumerViability: consumerTestResult?.overallViabilityScore,
      };
      await pauseForApproval(effectiveLeadId, runId, preview);
      console.log(`analyze-continue: PAUSED for approval — archetype=${preview.archetype}, viability=${preview.consumerViability}`);
      return res.status(200).json({
        status: 'awaiting_approval',
        strategyPreview: preview,
        debug: { timings, errors, agentsRun },
      });
    }

    // If approval has a note, inject it as admin notes for synthesizer
    const approvalNote = existingRun?.approvalNote;
    const effectiveAdminNotes = [input.adminNotes, approvalNote].filter(Boolean).join('\n\n');

    // ============================
    // Phase D: Synthesizer (now includes valueMaximizer + deliverableEnricher internally)
    // ============================
    let synthesizedAnalysis = (hasCheckpoint && cp?.synthesizedAnalysis) || null;
    if (synthesizedAnalysis) { console.log('analyze-continue: Using checkpointed synthesizedAnalysis'); agentsRun.push('strategySynthesizer'); }

    const synthesizedForIntro = buildFallbackSynthesis(effectiveStrategistOutput);

    if (!synthesizedAnalysis && remaining() > 10_000) {
      console.log(`analyze-continue: Running strategySynthesizer (remaining=${remaining()}ms)`);
      if (runId) await markAgentRunning(effectiveLeadId, runId, 'strategySynthesizer');
      const synthStart = Date.now();
      try {
        // Synthesizer internally runs valueMaximizer + deliverableEnricher as parallel Flash enrichment passes
        synthesizedAnalysis = await runStrategySynthesizer(
          normalizedData, researchFindings, effectiveStrategistOutput,
          challengerOutput, blogAdvisorOutput, input.businessContext,
          digitalPresence, competitorDiscovery, consumerTestResult,
          effectiveAdminNotes || input.adminNotes,
          null, // frictionAnalysis removed — distilled into synthesizer prompt
        );
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
      console.log(`analyze-continue: SKIPPING synthesizer — remaining=${remaining()}ms`);
      if (runId) await markAgentSkipped(effectiveLeadId, runId, 'strategySynthesizer');
    }

    // ============================
    // Phase E: Roadmap Generator (deliverableEnricher now internal to synthesizer)
    // ============================
    let intibaRoadmap: any = null;

    if (synthesizedAnalysis && effectiveStrategistOutput && remaining() > 10_000) {
      console.log(`analyze-continue: Running roadmapGenerator (remaining=${remaining()}ms)`);
      try {
        const s = Date.now();
        intibaRoadmap = await generateIntibaRoadmap(effectiveStrategistOutput, synthesizedAnalysis);
        timings.roadmapGenerator = Date.now() - s;
        agentsRun.push('roadmapGenerator');
        console.log(`analyze-continue: roadmapGenerator done in ${timings.roadmapGenerator}ms`);
      } catch (err: any) {
        errors.push({ agent: 'roadmapGenerator', error: err.message, timestamp: Date.now() });
        console.error(`analyze-continue: roadmapGenerator failed: ${err.message}`);
      }
    }

    // ============================
    // Build Evidence Summary (post-synthesis, zero-cost meta-extraction)
    // ============================
    let evidenceSummaryV2: any = undefined;
    let frameworkScores: any[] | undefined = undefined;
    try {
      const evidenceState: any = {
        input, normalizedData, researchFindings,
        strategistOutput: effectiveStrategistOutput,
        challengerOutput, blogAdvisorOutput, consumerTest: consumerTestResult,
        synthesizedAnalysis: synthesizedAnalysis || synthesizedForIntro,
        digitalPresence,
        consensusResults: consensusResult ? [{ question: 'positioning', consensusReached: consensusResult.consensusReached, consensusScore: consensusResult.consensusScore }] : undefined,
        errors, agentsRun, timings,
      };
      const evidenceResult = buildPipelineEvidence(evidenceState);
      evidenceSummaryV2 = evidenceResult.summary;
      frameworkScores = evidenceResult.frameworkScores;
      console.log(`analyze-continue: Evidence built — confidence=${evidenceSummaryV2?.overallConfidence}, frameworkScores=${frameworkScores?.length || 0}`);
    } catch (err: any) {
      console.error(`analyze-continue: Evidence building failed: ${err.message}`);
      errors.push({ agent: 'evidenceBuilder', error: err.message, timestamp: Date.now() });
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
      consultantIntro: synthesized.consultantIntro || undefined,

      // Pipeline upgrade v4 — evidence & confidence
      evidenceSummaryV2: evidenceSummaryV2 || synthesized.evidenceSummaryV2 || undefined,
      frameworkScores: frameworkScores || synthesized.frameworkScores || undefined,

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
      consumerTest: consumerTestResult || undefined,

      // Phase 0 gathered data (zero-LLM-cost intelligence)
      gatheredData: {
        websiteBusinessIntel: websiteData?.businessIntel || undefined,
        instagramPublicData: instagramData || undefined,
        googlePlacesData: googlePlacesData || undefined,
      },

      // Deliverable outputs (now internal to synthesizer)
      messagingArchitecture: synthesized.messagingArchitecture || undefined,
      customerJourney: synthesized.customerJourney || undefined,
      socialMediaTemplates: synthesized.socialMediaTemplates || undefined,

      // Intiba Yol Haritası
      intibaRoadmap: intibaRoadmap || undefined,

      // Faz 2 — Strategic depth outputs
      brandNarrative: synthesized.brandNarrative || undefined,
      intibaEngagement: synthesized.intibaEngagement || undefined,
      perceptualMap: synthesized.perceptualMap || undefined,
      brandMaturity: normalizedData?.brandMaturity || undefined,

      // Faz 3 — Yapaylıktan uzaklaşma çıktıları
      strategicDepth: synthesized.strategicDepth || undefined,
      brandCharacter: synthesized.brandCharacter || undefined,
      qualityMetrics: synthesized.qualityMetrics || undefined,

      // Marka İddiaası
      brandClaim: synthesized.brandClaim || undefined,

      // Faz 2 — KPI Framework & Senaryolar
      kpiFramework: synthesized.kpiFramework || undefined,
      strategyScenarios: synthesized.strategyScenarios || undefined,
      riskMitigationPlans: challengerOutput?.riskMitigationPlans || undefined,

      // ValueMaximizer outputs (now internal to synthesizer)
      diagnosisSummary: synthesized.diagnosisSummary || undefined,
      emotionalNarrative: synthesized.emotionalNarrative || undefined,
      revenueImpact: synthesized.revenueImpact || undefined,

      dataQuality: normalizedData
        ? {
            completeness: normalizedData.dataQualityScore,
            contradictions: normalizedData.contradictions,
            patterns: normalizedData.detectedPatterns,
            missingAreas: normalizedData.missingAreas,
          }
        : undefined,

      pipelineMetadata: {
        version: '5.0.0',
        agentsRun,
        totalDuration,
        agentDurations: Object.fromEntries(
          Object.entries(timings).filter(([k]) => k !== 'total')
        ),
        researchAvailable: !!researchFindings && (researchFindings.sourcesUsed !== 0),
        researchMethod: usedDeepResearch ? 'deep-research' : researchFindings?.sourcesUsed ? 'grounding' : 'none',
        researchQuality,
        researchDegraded,
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
    visualWorld: {
      moodKeywords: strategistOutput.visualMoodKeywords || strategistOutput.moodKeywords || [],
      colorPalette: strategistOutput.colorPalette || [],
      typographyStyle: strategistOutput.typographyStyle || '',
      imageryStyle: strategistOutput.imageryStyle || '',
    },
    contentStrategy: {
      pillars: strategistOutput.contentPillars || strategistOutput.contentStrategyPillars || [],
      toneGuidelines: strategistOutput.toneGuidelines || (strategistOutput.tone ? [strategistOutput.tone] : []),
      keyMessages: strategistOutput.keyMessages || [],
      hashtags: strategistOutput.hashtags || [],
    },
    analysis: {
      strengths: strategistOutput.brandStrengths || strategistOutput.strengths || [],
      opportunities: strategistOutput.marketOpportunities || strategistOutput.opportunities || [],
      challenges: strategistOutput.challenges || [],
      recommendations: strategistOutput.recommendations || [],
    },
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
