import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 30,
};

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * GET /api/marketing/platforms/callback
 *
 * OAuth callback handler for all ad platforms.
 * After the user authorizes on the platform (Meta, Google, etc.),
 * they are redirected here with an authorization code.
 *
 * For Meta: exchanges code for long-lived token, fetches all ad accounts
 * from Business Manager, and redirects to account picker if multiple exist.
 *
 * Query params:
 *  - code: authorization code from OAuth provider
 *  - state: JSON-encoded { platform, redirectPath, projectId? }
 *  - error: OAuth error (if any)
 *  - error_description: OAuth error description
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error(`[platform-callback] OAuth error: ${error} — ${error_description}`);
      let errorPath = '/admin/marketing/platforms';
      try {
        if (state) {
          const parsed = JSON.parse(String(state));
          if (parsed.redirectPath) errorPath = parsed.redirectPath;
        }
      } catch { /* use default */ }
      return res.redirect(
        `${errorPath}?error=${encodeURIComponent(String(error_description || error))}`
      );
    }

    if (!code || !state) {
      return res.redirect('/admin/marketing/platforms?error=missing_code');
    }

    // Parse state
    let stateData: { platform: string; redirectPath?: string; projectId?: string };
    try {
      stateData = JSON.parse(String(state));
    } catch {
      return res.redirect('/admin/marketing/platforms?error=invalid_state');
    }

    const { platform, redirectPath, projectId } = stateData;
    const fallbackPath = redirectPath || '/admin/marketing/platforms';

    console.log(`[platform-callback] Processing callback for platform=${platform}`);

    // Construct redirect URI (must match what was used for auth initiation)
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/marketing/platforms/callback`;

    // ── Meta OAuth token exchange (inlined) ──
    if (platform === 'meta') {
      const appId = process.env.META_APP_ID?.trim();
      const appSecret = process.env.META_APP_SECRET?.trim();
      if (!appId || !appSecret) {
        return res.redirect(
          `${fallbackPath}?error=${encodeURIComponent('META_APP_ID or META_APP_SECRET not configured')}`
        );
      }

      // 1. Exchange code for short-lived token
      const tokenUrl = `${META_API_BASE}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        throw new Error(`Meta OAuth error: ${tokenData.error.message}`);
      }

      // 2. Exchange for long-lived token (60 days)
      const longLivedUrl = `${META_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`;
      const llRes = await fetch(longLivedUrl);
      const llData = await llRes.json();

      if (llData.error) {
        throw new Error(`Meta long-lived token error: ${llData.error.message}`);
      }

      const accessToken = llData.access_token;
      const expiresInMs = (llData.expires_in || 5184000) * 1000; // default 60 days

      // 3. Get user info
      const meRes = await fetch(`${META_API_BASE}/me?access_token=${accessToken}&fields=name,id`);
      const meData = await meRes.json();
      const userName = meData.name || 'Meta Business Account';
      const userId = meData.id || '';

      console.log(`[platform-callback] Successfully connected Meta account: ${userName}`);

      // 4. Fetch all ad accounts from Business Manager
      const adAccountsRes = await fetch(
        `${META_API_BASE}/me/adaccounts?access_token=${accessToken}&fields=name,account_id,account_status&limit=100`
      );
      const adAccountsData = await adAccountsRes.json();
      const adAccounts: Array<{ id: string; name: string; account_id: string; account_status: number }> =
        adAccountsData.data || [];

      console.log(`[platform-callback] Found ${adAccounts.length} Meta ad account(s)`);

      if (adAccounts.length === 0) {
        return res.redirect(
          `${fallbackPath}?error=${encodeURIComponent('Bu hesapta reklam hesabi bulunamadi. Business Manager\'da reklam hesabi olusturun.')}`
        );
      }

      if (adAccounts.length === 1) {
        // Single account — auto-select
        const singleAccount = adAccounts[0];
        const encodedAccount = encodeURIComponent(JSON.stringify({
          platform: 'meta',
          accountId: singleAccount.account_id,
          accountName: singleAccount.name || userName,
          status: 'connected',
          permissions: ['ads_management', 'ads_read', 'business_management'],
          ...(projectId ? { projectId } : {}),
          metadata: {
            accessToken,
            adAccountId: singleAccount.account_id,
            userId,
            userName,
          },
        }));

        return res.redirect(`${fallbackPath}?connected=${encodedAccount}`);
      }

      // Multiple accounts — redirect to picker
      const pickerData = encodeURIComponent(JSON.stringify({
        platform: 'meta',
        accessToken,
        tokenExpiresAt: Date.now() + expiresInMs,
        userName,
        userId,
        permissions: ['ads_management', 'ads_read', 'business_management'],
        ...(projectId ? { projectId } : {}),
        accounts: adAccounts.map(acc => ({
          id: acc.account_id,
          name: acc.name || acc.account_id,
          status: acc.account_status,
        })),
      }));

      console.log(`[platform-callback] Redirecting to account picker with ${adAccounts.length} accounts`);
      return res.redirect(`${fallbackPath}?selectAccount=${pickerData}`);
    }

    // ── Non-Meta platforms (future) ──
    return res.redirect(
      `${fallbackPath}?error=${encodeURIComponent(`Unsupported platform: ${platform}`)}`
    );

  } catch (error: any) {
    console.error('[platform-callback] Error:', error.message);
    let errorRedirect = '/admin/marketing/platforms';
    try {
      const { state: rawState } = req.query;
      if (rawState) {
        const parsed = JSON.parse(String(rawState));
        if (parsed.redirectPath) errorRedirect = parsed.redirectPath;
      }
    } catch { /* ignore parse error, use default */ }
    return res.redirect(
      `${errorRedirect}?error=${encodeURIComponent(error.message || 'Connection failed')}`
    );
  }
}
