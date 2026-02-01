import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 10,
};

/**
 * GET /api/marketing/platforms/connect
 *
 * Initiates the OAuth flow for a given ad platform.
 * Redirects the user to the platform's OAuth authorization page.
 *
 * Query params:
 *  - platform: 'meta' | 'google' | 'tiktok' | 'linkedin'
 *  - state: JSON-encoded { platform, redirectPath, projectId? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { platform, state } = req.query;

    if (!platform) {
      return res.status(400).json({ error: 'Missing platform parameter' });
    }

    const { getAdapter } = await import('../../../src/platforms/registry');
    const adapter = getAdapter(String(platform) as any);

    if (!adapter) {
      return res.status(400).json({ error: `Unsupported platform: ${platform}` });
    }

    // Build callback URI
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const callbackUri = `${protocol}://${host}/api/marketing/platforms/callback`;

    // Get the platform's OAuth URL
    const authUrl = adapter.getAuthUrl(callbackUri);

    // Append our state parameter to the auth URL
    const separator = authUrl.includes('?') ? '&' : '?';
    const fullAuthUrl = `${authUrl}${separator}state=${encodeURIComponent(String(state || '{}'))}`;

    console.log(`[platform-connect] Redirecting to ${String(platform)} OAuth`);

    return res.redirect(fullAuthUrl);
  } catch (error: any) {
    console.error('[platform-connect] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to initiate OAuth' });
  }
}
