import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 300,
};

/**
 * POST /api/marketing/generate-ad-copy
 *
 * AI-powered ad copy generator. Produces 6 creative variants
 * for a given platform, objective, and tone using the adCopyWriter agent.
 *
 * Body:
 *  - productDescription: string (what the product/service is)
 *  - platform: string (meta, google, tiktok, linkedin)
 *  - objective: string (awareness, traffic, engagement, leads, sales)
 *  - tone: string (professional, casual, urgent, creative, informative)
 *  - targetAudience?: string
 *  - keywords?: string[]
 *  - brandName?: string
 *  - existingCopy?: string (for improvement / variation)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      productDescription,
      platform,
      objective,
      tone,
      targetAudience,
      keywords,
      brandName,
      existingCopy,
    } = req.body;

    // Validate required fields
    if (!productDescription || !platform || !objective || !tone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: productDescription, platform, objective, tone',
      });
    }

    // Validate platform value
    const validPlatforms = ['meta', 'google', 'tiktok', 'linkedin'];
    if (!validPlatforms.includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid platform "${platform}". Must be one of: ${validPlatforms.join(', ')}`,
      });
    }

    // Validate objective value
    const validObjectives = ['awareness', 'traffic', 'engagement', 'leads', 'sales'];
    if (!validObjectives.includes(objective.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid objective "${objective}". Must be one of: ${validObjectives.join(', ')}`,
      });
    }

    console.log(
      `[generate-ad-copy] Starting: platform=${platform}, objective=${objective}, tone=${tone}` +
      (brandName ? `, brand=${brandName}` : '')
    );

    const startTime = Date.now();

    // Dynamic import to avoid @/ alias issues on Vercel
    const { generateAdCopy } = await import(
      '../../src/pipeline/marketing/agents/adCopyWriter'
    );

    const result = await generateAdCopy({
      productDescription,
      platform: platform.toLowerCase(),
      objective: objective.toLowerCase(),
      tone: tone.toLowerCase(),
      targetAudience,
      keywords,
      brandName,
      existingCopy,
    });

    const totalDuration = Date.now() - startTime;

    console.log(
      `[generate-ad-copy] Generated ${result.variants.length} variants in ${totalDuration}ms`
    );

    return res.status(200).json({
      success: true,
      variants: result.variants,
      strategy: result.strategy,
      platformTips: result.platformTips,
      metadata: {
        platform,
        objective,
        tone,
        variantCount: result.variants.length,
        agentsRun: ['adCopyWriter'],
        totalDuration,
      },
    });
  } catch (error: any) {
    console.error('[generate-ad-copy] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Ad copy generation failed',
    });
  }
}
