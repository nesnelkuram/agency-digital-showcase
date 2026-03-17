import '../_lib/env.js';
import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { getGoogleDriveCredentials } from '../_lib/googleDriveApi.js';

export const config = { maxDuration: 15 };

/**
 * POST /api/drive/initiate-upload
 * Body: { fileName, mimeType, folderId?, fileSize }
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, mimeType, folderId, fileSize } = req.body || {};
    if (!fileName || !mimeType || !fileSize) {
      return res.status(400).json({ error: 'fileName, mimeType, and fileSize are required' });
    }

    const db = getAdminDb();
    const { accessToken } = await getGoogleDriveCredentials(db, req.tenantId);

    // Build file metadata
    const metadata: Record<string, any> = { name: fileName };
    if (folderId) {
      metadata.parents = [folderId];
    }

    // Initiate resumable upload session
    const initiateResp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(fileSize),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initiateResp.ok) {
      const err = await initiateResp.text();
      throw new Error(`Failed to initiate upload: ${err}`);
    }

    const sessionUri = initiateResp.headers.get('Location');
    if (!sessionUri) {
      throw new Error('No upload session URI returned');
    }

    // Save session to Firestore
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const sessionRef = db.collection('drive_upload_sessions').doc();
    await sessionRef.set({
      tenantId: req.tenantId,
      userId: req.userId,
      sessionUri,
      fileName,
      mimeType,
      fileSize,
      uploadedBytes: 0,
      targetDriveFolderId: folderId || null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt,
    });

    return res.status(200).json({
      sessionId: sessionRef.id,
      sessionUri,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error('[drive/initiate-upload] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Upload başlatılamadı' });
  }
});
