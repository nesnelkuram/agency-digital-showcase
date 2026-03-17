import type { VercelResponse } from '@vercel/node';
import { withAuthOptional, OptionalAuthRequest } from '../../_lib/withAuth.js';

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
export default withAuthOptional(async (req: OptionalAuthRequest, res: VercelResponse) => {
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
      const [adAccountsRes, pagesRes] = await Promise.all([
        fetch(`${META_API_BASE}/me/adaccounts?access_token=${accessToken}&fields=name,account_id,account_status&limit=100`),
        fetch(`${META_API_BASE}/me/accounts?access_token=${accessToken}&fields=id,name,access_token&limit=50`),
      ]);
      const adAccountsData = await adAccountsRes.json();
      const adAccounts: Array<{ id: string; name: string; account_id: string; account_status: number }> =
        adAccountsData.data || [];

      // Extract first page ID for ad creation (required for object_story_spec)
      const pagesData = await pagesRes.json();
      const pages: Array<{ id: string; name: string; access_token?: string }> = pagesData.data || [];
      const firstPageId = pages[0]?.id || null;
      const firstPageName = pages[0]?.name || null;

      console.log(`[platform-callback] Found ${adAccounts.length} Meta ad account(s), ${pages.length} page(s)${firstPageId ? ` (primary: ${firstPageName})` : ''}`);

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
            ...(firstPageId ? { pageId: firstPageId, pageName: firstPageName } : {}),
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
        ...(firstPageId ? { pageId: firstPageId, pageName: firstPageName } : {}),
        accounts: adAccounts.map(acc => ({
          id: acc.account_id,
          name: acc.name || acc.account_id,
          status: acc.account_status,
        })),
      }));

      console.log(`[platform-callback] Redirecting to account picker with ${adAccounts.length} accounts`);
      return res.redirect(`${fallbackPath}?selectAccount=${pickerData}`);
    }

    // ── Google Ads OAuth callback ──
    if (platform === 'google') {
      const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
      const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) {
        return res.redirect(
          `${fallbackPath}?error=${encodeURIComponent('GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET not configured')}`
        );
      }

      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        throw new Error(`Google OAuth error: ${tokenData.error_description || tokenData.error}`);
      }

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in || 3600;

      // Get user info
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await userRes.json();
      const userName = userData.name || userData.email || 'Google Ads Account';

      // Get accessible customer accounts via Google Ads API
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
      let accounts: Array<{ id: string; name: string }> = [];

      if (developerToken) {
        try {
          const customersRes = await fetch(
            'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'developer-token': developerToken,
              },
            }
          );
          const customersData = await customersRes.json();
          const resourceNames: string[] = customersData.resourceNames || [];
          accounts = resourceNames.map((rn: string) => ({
            id: rn.replace('customers/', ''),
            name: rn.replace('customers/', ''),
          }));
        } catch (err: any) {
          console.warn('[platform-callback] Failed to list Google Ads customers:', err.message);
        }
      }

      console.log(`[platform-callback] Google Ads: ${userName}, ${accounts.length} accounts`);

      if (accounts.length <= 1) {
        const accountId = accounts[0]?.id || userData.id || '';
        const encodedAccount = encodeURIComponent(JSON.stringify({
          platform: 'google',
          accountId,
          accountName: userName,
          status: 'connected',
          permissions: ['adwords', 'userinfo'],
          ...(projectId ? { projectId } : {}),
          metadata: {
            accessToken,
            refreshToken,
            developerToken: developerToken || '',
            customerId: accountId,
            email: userData.email,
          },
        }));
        return res.redirect(`${fallbackPath}?connected=${encodedAccount}`);
      }

      // Multiple accounts — picker
      const pickerData = encodeURIComponent(JSON.stringify({
        platform: 'google',
        accessToken,
        refreshToken,
        tokenExpiresAt: Date.now() + expiresIn * 1000,
        userName,
        permissions: ['adwords', 'userinfo'],
        ...(projectId ? { projectId } : {}),
        accounts: accounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          status: 1,
        })),
      }));
      return res.redirect(`${fallbackPath}?selectAccount=${pickerData}`);
    }

    // ── TikTok Ads OAuth callback ──
    if (platform === 'tiktok') {
      const appId = process.env.TIKTOK_APP_ID?.trim();
      const appSecret = process.env.TIKTOK_APP_SECRET?.trim();
      if (!appId || !appSecret) {
        return res.redirect(
          `${fallbackPath}?error=${encodeURIComponent('TIKTOK_APP_ID or TIKTOK_APP_SECRET not configured')}`
        );
      }

      // Exchange auth code for access token
      const tokenRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          secret: appSecret,
          auth_code: String(code),
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.code !== 0) {
        throw new Error(`TikTok OAuth error: ${tokenData.message}`);
      }

      const accessToken = tokenData.data.access_token;
      const advertiserIds: string[] = tokenData.data.advertiser_ids || [];

      console.log(`[platform-callback] TikTok: ${advertiserIds.length} advertiser(s)`);

      // Get advertiser info
      let accounts: Array<{ id: string; name: string }> = [];
      if (advertiserIds.length > 0) {
        try {
          const infoRes = await fetch(
            `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${JSON.stringify(advertiserIds)}`,
            { headers: { 'Access-Token': accessToken } }
          );
          const infoData = await infoRes.json();
          accounts = (infoData.data?.list || []).map((adv: any) => ({
            id: String(adv.advertiser_id),
            name: adv.advertiser_name || String(adv.advertiser_id),
          }));
        } catch (err: any) {
          console.warn('[platform-callback] Failed to get TikTok advertiser info:', err.message);
          accounts = advertiserIds.map(id => ({ id, name: id }));
        }
      }

      if (accounts.length <= 1) {
        const account = accounts[0] || { id: advertiserIds[0] || '', name: 'TikTok Ads' };
        const encodedAccount = encodeURIComponent(JSON.stringify({
          platform: 'tiktok',
          accountId: account.id,
          accountName: account.name,
          status: 'connected',
          permissions: ['ads_management', 'ads_read'],
          ...(projectId ? { projectId } : {}),
          metadata: {
            accessToken,
            advertiserId: account.id,
          },
        }));
        return res.redirect(`${fallbackPath}?connected=${encodedAccount}`);
      }

      const pickerData = encodeURIComponent(JSON.stringify({
        platform: 'tiktok',
        accessToken,
        userName: accounts[0]?.name || 'TikTok Business',
        permissions: ['ads_management', 'ads_read'],
        ...(projectId ? { projectId } : {}),
        accounts: accounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          status: 1,
        })),
      }));
      return res.redirect(`${fallbackPath}?selectAccount=${pickerData}`);
    }

    // ── LinkedIn Ads OAuth callback ──
    if (platform === 'linkedin') {
      const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) {
        return res.redirect(
          `${fallbackPath}?error=${encodeURIComponent('LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET not configured')}`
        );
      }

      // Exchange code for token
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        throw new Error(`LinkedIn OAuth error: ${tokenData.error_description || tokenData.error}`);
      }

      const accessToken = tokenData.access_token;
      const expiresIn = tokenData.expires_in || 5184000;

      // Get user profile
      const profileRes = await fetch('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profileData = await profileRes.json();
      const firstName = profileData.localizedFirstName || '';
      const lastName = profileData.localizedLastName || '';
      const userName = `${firstName} ${lastName}`.trim() || 'LinkedIn Ads';

      // Get ad accounts
      let accounts: Array<{ id: string; name: string }> = [];
      try {
        const adAccountsRes = await fetch(
          'https://api.linkedin.com/v2/adAccountsV2?q=search&search.status.values[0]=ACTIVE',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'LinkedIn-Version': '202401',
            },
          }
        );
        const adAccountsData = await adAccountsRes.json();
        accounts = (adAccountsData.elements || []).map((acc: any) => ({
          id: String(acc.id),
          name: acc.name || String(acc.id),
        }));
      } catch (err: any) {
        console.warn('[platform-callback] Failed to list LinkedIn ad accounts:', err.message);
      }

      console.log(`[platform-callback] LinkedIn: ${userName}, ${accounts.length} ad accounts`);

      if (accounts.length <= 1) {
        const account = accounts[0] || { id: profileData.id || '', name: userName };
        const encodedAccount = encodeURIComponent(JSON.stringify({
          platform: 'linkedin',
          accountId: account.id,
          accountName: account.name || userName,
          status: 'connected',
          permissions: ['r_ads', 'r_ads_reporting', 'rw_ads'],
          ...(projectId ? { projectId } : {}),
          metadata: {
            accessToken,
            accountId: account.id,
            profileId: profileData.id,
            profileName: userName,
          },
        }));
        return res.redirect(`${fallbackPath}?connected=${encodedAccount}`);
      }

      const pickerData = encodeURIComponent(JSON.stringify({
        platform: 'linkedin',
        accessToken,
        tokenExpiresAt: Date.now() + expiresIn * 1000,
        userName,
        permissions: ['r_ads', 'r_ads_reporting', 'rw_ads'],
        ...(projectId ? { projectId } : {}),
        accounts: accounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          status: 1,
        })),
      }));
      return res.redirect(`${fallbackPath}?selectAccount=${pickerData}`);
    }

    // ── Google Drive OAuth callback ──
    if (platform === 'google_drive') {
      const clientId = (process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID || '').trim();
      const clientSecret = (process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET || '').trim();
      if (!clientId || !clientSecret) {
        return res.redirect(
          `${fallbackPath}?error=${encodeURIComponent('Google Drive OAuth credentials not configured')}`
        );
      }

      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        throw new Error(`Google Drive OAuth error: ${tokenData.error_description || tokenData.error}`);
      }

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in || 3600;

      // Get user info
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await userRes.json();
      const userEmail = userData.email || '';
      const userName = userData.name || userEmail || 'Google Drive';

      console.log(`[platform-callback] Google Drive connected: ${userEmail}`);

      // Save to platform_accounts — we need tenantId from auth context or state
      // Since this is withAuthOptional, tenantId may come from auth or state
      const tenantId = (req as any).tenantId || stateData.projectId || '';

      if (tenantId) {
        try {
          const { getAdminDb } = await import('../../_lib/firebaseAdmin.js');
          const db = getAdminDb();

          // Check if already connected, update if so
          const existing = await db
            .collection('platform_accounts')
            .where('tenantId', '==', tenantId)
            .where('platform', '==', 'google_drive')
            .limit(1)
            .get();

          const accountData = {
            tenantId,
            platform: 'google_drive',
            status: 'connected',
            accountName: userName,
            email: userEmail,
            accessToken,
            refreshToken,
            tokenExpiresAt: Date.now() + expiresIn * 1000,
            metadata: {
              accessToken,
              refreshToken,
              email: userEmail,
              userName,
            },
            updatedAt: new Date(),
          };

          if (existing.empty) {
            await db.collection('platform_accounts').doc().set({
              ...accountData,
              createdAt: new Date(),
            });
          } else {
            await existing.docs[0].ref.update(accountData);
          }
        } catch (err: any) {
          console.warn('[platform-callback] Failed to save Google Drive credentials:', err.message);
        }
      }

      return res.redirect(`${fallbackPath}?connected=google_drive`);
    }

    // ── Unsupported platforms ──
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
});
