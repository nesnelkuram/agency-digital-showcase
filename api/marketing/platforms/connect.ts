import '../../_lib/env';
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
 * No auth header needed — this is a browser redirect, security is
 * enforced by the OAuth state parameter and the callback endpoint.
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
        const appId = process.env.META_APP_ID?.trim();
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
      case 'google': {
        const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
        if (!clientId) {
          return res.status(500).json({ error: 'GOOGLE_ADS_CLIENT_ID not configured' });
        }
        const scopes = [
          'https://www.googleapis.com/auth/adwords',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ].join(' ');
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', callbackUri);
        url.searchParams.set('scope', scopes);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('access_type', 'offline');
        url.searchParams.set('prompt', 'consent');
        url.searchParams.set('state', String(state || '{}'));
        authUrl = url.toString();
        break;
      }
      case 'tiktok': {
        const appId = process.env.TIKTOK_APP_ID?.trim();
        if (!appId) {
          return res.status(500).json({ error: 'TIKTOK_APP_ID not configured' });
        }
        const url = new URL('https://business-api.tiktok.com/portal/auth');
        url.searchParams.set('app_id', appId);
        url.searchParams.set('redirect_uri', callbackUri);
        url.searchParams.set('state', String(state || '{}'));
        authUrl = url.toString();
        break;
      }
      case 'linkedin': {
        const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
        if (!clientId) {
          return res.status(500).json({ error: 'LINKEDIN_CLIENT_ID not configured' });
        }
        const scopes = [
          'r_ads',
          'r_ads_reporting',
          'rw_ads',
          'r_basicprofile',
          'r_organization_social',
        ].join(' ');
        const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
        url.searchParams.set('client_id', clientId);
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
