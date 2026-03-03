/**
 * Meta Graph API helpers — shared across all marketing agent handlers
 */

const META_API_BASE = 'https://graph.facebook.com/v21.0';

export { META_API_BASE };

export interface MetaCredentials {
  accessToken: string;
  adAccountId: string; // e.g. "act_123456"
  pageId?: string;
}

/**
 * Look up connected Meta platform account and return credentials.
 */
export async function getMetaCredentials(
  db: FirebaseFirestore.Firestore,
  tenantId: string
): Promise<MetaCredentials> {
  const snap = await db
    .collection('platform_accounts')
    .where('tenantId', '==', tenantId)
    .get();

  const metaDoc = snap.docs.find((d) => {
    const data = d.data();
    return data.platform === 'meta' && data.status === 'connected';
  });

  if (!metaDoc) throw new Error('Bagli Meta hesabi bulunamadi');

  const data = metaDoc.data();
  const accessToken = data.accessToken || data.metadata?.accessToken;
  if (!accessToken) throw new Error('Access token bulunamadi');

  const rawId = data.accountId || data.metadata?.adAccountId;
  const adAccountId = rawId?.startsWith('act_') ? rawId : `act_${rawId}`;

  return {
    accessToken,
    adAccountId,
    pageId: data.metadata?.pageId,
  };
}

/**
 * GET request to the Meta Graph API.
 */
export async function metaGet(
  path: string,
  params: Record<string, string>
): Promise<any> {
  const url = new URL(`${META_API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString());
  const json = await resp.json();
  if ((json as any).error) {
    throw new Error((json as any).error.message || JSON.stringify((json as any).error));
  }
  return json;
}

/**
 * POST multipart/form-data to the Meta Graph API (for image uploads).
 */
export async function metaPostMultipart(
  path: string,
  formData: FormData
): Promise<any> {
  const resp = await fetch(`${META_API_BASE}/${path}`, {
    method: 'POST',
    body: formData,
  });
  const json = await resp.json();
  if ((json as any).error) {
    throw new Error((json as any).error.message || JSON.stringify((json as any).error));
  }
  return json;
}

/**
 * POST request to the Meta Graph API.
 */
export async function metaPost(
  path: string,
  params: Record<string, string>
): Promise<any> {
  const resp = await fetch(`${META_API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const json = await resp.json();
  if ((json as any).error) {
    throw new Error((json as any).error.message || JSON.stringify((json as any).error));
  }
  return json;
}

/**
 * Resolve a Firestore campaign doc ID to its Meta campaign ID.
 * If already a numeric Meta ID, returns as-is.
 */
export async function resolveMetaCampaignId(
  db: FirebaseFirestore.Firestore,
  idOrFirestoreId: string
): Promise<string> {
  if (/^\d+$/.test(idOrFirestoreId)) return idOrFirestoreId;
  const docSnap = await db.collection('marketing_campaigns').doc(idOrFirestoreId).get();
  if (!docSnap.exists) throw new Error(`Kampanya bulunamadi: ${idOrFirestoreId}`);
  const data = docSnap.data()!;
  const metaId = data.platformCampaignIds?.meta;
  if (!metaId) throw new Error(`Bu kampanyanin Meta ID'si bulunamadi`);
  return metaId;
}

/**
 * Resolve an adset ID — if numeric, returns as-is; otherwise looks up from Firestore campaign doc.
 */
export async function resolveMetaAdSetId(
  db: FirebaseFirestore.Firestore,
  idOrFirestoreId: string
): Promise<string> {
  if (/^\d+$/.test(idOrFirestoreId)) return idOrFirestoreId;
  const docSnap = await db.collection('marketing_campaigns').doc(idOrFirestoreId).get();
  if (docSnap.exists) {
    const adSets = docSnap.data()?.adSets || [];
    if (adSets.length > 0 && adSets[0].metaAdSetId) return adSets[0].metaAdSetId;
  }
  throw new Error(`AdSet Meta ID bulunamadi: ${idOrFirestoreId}`);
}
