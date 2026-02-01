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
        const url = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
        url.searchParams.set('client_id', appId);
        url.searchParams.set('redirect_uri', callbackUri);
        url.searchParams.set('scope', scopes);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('state', String(state || '{}'));
        authUrl = url.toString();
        break;
      }
      default:
        return res.status(400).json({ error: `Unsupported platform: ${platform}` });
    }

    console.log(`[platform-connect] Redirecting to ${String(platform)} OAuth`);

    return res.redirect(authUrl);
  } catch (error: any) {
    console.error('[platform-connect] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to initiate OAuth' });
  }
}
