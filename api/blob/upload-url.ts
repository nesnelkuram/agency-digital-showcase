import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

/**
 * Token endpoint for @vercel/blob client uploads. The browser never sees the
 * BLOB_READ_WRITE_TOKEN; instead it calls this route, which (after verifying the
 * caller is an authenticated admin) hands back a short-lived, scoped upload
 * token. Client uploads bypass the 4.5 MB serverless body limit, so compressed
 * videos up to 60 MB upload straight to Blob.
 *
 * The Firebase ID token is passed via `clientPayload`.
 */
const ALLOWED_ROLES = ['admin', 'super_admin', 'account_manager', 'editor'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const token = typeof clientPayload === 'string' ? clientPayload : '';
        if (!token) throw new Error('Missing auth token');

        const { getFirebaseAuth, getAdminDb } = await import('../_lib/firebaseAdmin.js');
        const decoded = await getFirebaseAuth().verifyIdToken(token);
        const userDoc = await getAdminDb().collection('users').doc(decoded.uid).get();
        const role = userDoc.exists ? (userDoc.data() as any)?.role : null;
        if (!role || !ALLOWED_ROLES.includes(role)) {
          throw new Error('Not authorized to upload videos');
        }

        // Only allow writes under the showcase video paths.
        if (!/^videos\/(full|preview|thumbnails)\//.test(pathname)) {
          throw new Error('Invalid upload path');
        }

        return {
          allowedContentTypes: ['video/mp4', 'image/jpeg', 'image/png'],
          addRandomSuffix: false,
          allowOverwrite: true,
          maximumSizeInBytes: 60 * 1024 * 1024,
          tokenPayload: JSON.stringify({ uid: decoded.uid }),
        };
      },
      onUploadCompleted: async () => {
        // Metadata is written to Firestore by the client after upload resolves.
      },
    });

    res.status(200).json(jsonResponse);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Upload authorization failed' });
  }
}
