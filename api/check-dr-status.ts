import type { VercelResponse } from '@vercel/node';
// @ts-ignore — pre-bundled by esbuild during vercel-build
import { pollDeepResearch } from './_bundles/pipeline-bundle.mjs';
import { withAuthOptional, OptionalAuthRequest } from './_lib/withAuth.js';

export const config = {
  maxDuration: 30,
};

/**
 * Lightweight DR status check — polls ONCE (no loop), returns immediately.
 * Client should call this every 30s instead of blocking analyze-continue for 250s.
 *
 * POST { drInteractionId: string }
 * Returns: { status: 'in_progress' | 'completed' | 'failed', text?: string }
 */
export default withAuthOptional(async (req: OptionalAuthRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { drInteractionId } = req.body;
  if (!drInteractionId) {
    return res.status(400).json({ error: 'Missing drInteractionId' });
  }

  try {
    // Poll with a very short timeout — just one check, no waiting loop
    const result = await pollDeepResearch(drInteractionId, 15_000);

    if (result.status === 'completed' && result.text.length > 200) {
      console.log(`check-dr-status: DR completed (${result.text.length} chars)`);
      return res.status(200).json({
        status: 'completed',
        text: result.text,
        chars: result.text.length,
      });
    }

    if (result.status === 'failed') {
      console.log('check-dr-status: DR failed');
      return res.status(200).json({ status: 'failed' });
    }

    // Still in progress (timeout after 15s = still running)
    console.log('check-dr-status: DR still in_progress');
    return res.status(200).json({ status: 'in_progress' });
  } catch (error: any) {
    console.error('check-dr-status error:', error.message);
    return res.status(200).json({ status: 'failed', error: error.message });
  }
});
