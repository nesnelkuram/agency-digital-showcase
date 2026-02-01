import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 10,
};

const META_API_VERSION = 'v21.0';

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

    // Build callback URI
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const callbackUri = `${protocol}://${host}/api/marketing/platforms/callback`;

    let authUrl: string;

    switch (String(platform)) {
      case 'meta': {
        const appId = process.env.META_APP_ID;
        if (!appId) {
          return res.status(500).json({ error: 'META_APP_ID not configured' });
        }
        const scopes = [
          'ads_management',
          'ads_read',
          'business_management',
          'pages_read_engagement',
        ].join(',');
        authUrl = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(callbackUri)}&scope=${scopes}&response_type=code`;
        break;
      }
      default:
        return res.status(400).json({ error: `Unsupported platform: ${platform}` });
    }

    // Append state parameter
    const separator = authUrl.includes('?') ? '&' : '?';
    const fullAuthUrl = `${authUrl}${separator}state=${encodeURIComponent(String(state || '{}'))}`;

    console.log(`[platform-connect] Redirecting to ${String(platform)} OAuth`);

    return res.redirect(fullAuthUrl);
  } catch (error: any) {
    console.error('[platform-connect] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to initiate OAuth' });
  }
}
