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
 * For Meta: fetches all ad accounts from Business Manager and redirects
 * to account picker if multiple accounts exist.
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
      return res.redirect(
        `/admin/marketing/platforms?error=${encodeURIComponent(String(error_description || error))}`
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

    console.log(`[platform-callback] Processing callback for platform=${platform}${projectId ? ` projectId=${projectId}` : ''}`);

    // Dynamic import adapter
    const { getAdapter } = await import('../../../src/platforms/registry');
    const adapter = getAdapter(platform as any);

    if (!adapter) {
      return res.redirect(
        `${fallbackPath}?error=${encodeURIComponent(`Unsupported platform: ${platform}`)}`
      );
    }

    // Construct redirect URI (must match what was used for auth initiation)
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/marketing/platforms/callback`;

    // Exchange code for tokens
    const accountData = await adapter.handleCallback(String(code), redirectUri);

    console.log(`[platform-callback] Successfully connected ${platform} account: ${accountData.accountName}`);

    // ── Meta: Fetch all ad accounts from Business Manager ──
    if (platform === 'meta' && accountData.metadata?.accessToken) {
      const accessToken = accountData.metadata.accessToken;

      try {
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
          // Single account — auto-select and save directly
          const singleAccount = adAccounts[0];
          const encodedAccount = encodeURIComponent(JSON.stringify({
            platform: accountData.platform,
            accountId: singleAccount.account_id,
            accountName: singleAccount.name || accountData.accountName,
            status: accountData.status,
            permissions: accountData.permissions,
            metadata: {
              accessToken,
              adAccountId: singleAccount.account_id,
              userId: accountData.accountId,
              userName: accountData.accountName,
            },
          }));

          return res.redirect(`${fallbackPath}?connected=${encodedAccount}`);
        }

        // Multiple accounts — redirect to picker
        const pickerData = encodeURIComponent(JSON.stringify({
          platform: 'meta',
          accessToken,
          tokenExpiresAt: accountData.tokenExpiresAt?.toMillis() || Date.now() + 5184000000,
          userName: accountData.accountName,
          userId: accountData.accountId,
          permissions: accountData.permissions,
          accounts: adAccounts.map(acc => ({
            id: acc.account_id,
            name: acc.name || acc.account_id,
            status: acc.account_status,
          })),
        }));

        console.log(`[platform-callback] Redirecting to account picker with ${adAccounts.length} accounts`);
        return res.redirect(`${fallbackPath}?selectAccount=${pickerData}`);

      } catch (adAccountError: any) {
        console.error('[platform-callback] Error fetching ad accounts:', adAccountError.message);
        // Fallback: continue with basic account data (no ad account selected)
      }
    }

    // ── Non-Meta or fallback: return single account data ──
    const encodedAccount = encodeURIComponent(JSON.stringify({
      platform: accountData.platform,
      accountId: accountData.accountId,
      accountName: accountData.accountName,
      status: accountData.status,
      permissions: accountData.permissions,
      metadata: accountData.metadata,
    }));

    return res.redirect(`${fallbackPath}?connected=${encodedAccount}`);

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
