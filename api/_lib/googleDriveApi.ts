import '../env.js';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export interface GoogleDriveCredentials {
  accessToken: string;
  refreshToken: string;
  email?: string;
}

export async function getGoogleDriveCredentials(
  db: FirebaseFirestore.Firestore,
  tenantId: string
): Promise<GoogleDriveCredentials> {
  const snap = await db
    .collection('platform_accounts')
    .where('tenantId', '==', tenantId)
    .where('platform', '==', 'google_drive')
    .where('status', '==', 'connected')
    .limit(1)
    .get();

  if (snap.empty) throw new Error('Bağlı Google Drive hesabı bulunamadı');

  const doc = snap.docs[0];
  const data = doc.data();
  const refreshToken = data.refreshToken || data.metadata?.refreshToken;
  if (!refreshToken) throw new Error('Google Drive refresh token bulunamadı');

  let accessToken = data.accessToken || data.metadata?.accessToken;
  const expiresAt = data.tokenExpiresAt || 0;

  // Refresh if expired or expiring within 5 minutes
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    accessToken = await refreshGoogleDriveToken(db, doc.id, refreshToken);
  }

  return {
    accessToken,
    refreshToken,
    email: data.email || data.metadata?.email,
  };
}

export async function refreshGoogleDriveToken(
  db: FirebaseFirestore.Firestore,
  docId: string,
  refreshToken: string
): Promise<string> {
  const clientId = (process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('Google Drive OAuth credentials not configured');
  }

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await resp.json();
  if (data.error) {
    throw new Error(`Google token refresh failed: ${data.error_description || data.error}`);
  }

  const newAccessToken = data.access_token;
  const expiresIn = data.expires_in || 3600;

  // Update Firestore
  await db.collection('platform_accounts').doc(docId).update({
    accessToken: newAccessToken,
    'metadata.accessToken': newAccessToken,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
  });

  return newAccessToken;
}

export async function driveGet(
  accessToken: string,
  path: string,
  params?: Record<string, string>
): Promise<any> {
  const url = new URL(`${DRIVE_API_BASE}/${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await resp.json();
  if (json.error) {
    throw new Error(json.error.message || JSON.stringify(json.error));
  }
  return json;
}

export async function drivePost(
  accessToken: string,
  path: string,
  body: Record<string, any>
): Promise<any> {
  const resp = await fetch(`${DRIVE_API_BASE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  if (json.error) {
    throw new Error(json.error.message || JSON.stringify(json.error));
  }
  return json;
}
