import '../_lib/env.js';
import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';

export const config = { maxDuration: 10 };

/**
 * GET /api/drive/upload-status?sessionId=xxx
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const db = getAdminDb();
    const sessionDoc = await db.collection('drive_upload_sessions').doc(sessionId).get();

    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    const session = sessionDoc.data()!;
    if (session.tenantId !== req.tenantId || session.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check session expiry
    if (session.expiresAt && new Date(session.expiresAt.toDate?.() || session.expiresAt) < new Date()) {
      await sessionDoc.ref.update({ status: 'expired', updatedAt: new Date() });
      return res.status(200).json({
        sessionId,
        status: 'expired',
        uploadedBytes: session.uploadedBytes || 0,
        totalBytes: session.fileSize,
      });
    }

    // Query Google for actual progress
    if (session.status === 'active' || session.status === 'paused') {
      try {
        const checkResp = await fetch(session.sessionUri, {
          method: 'PUT',
          headers: {
            'Content-Range': `bytes */${session.fileSize}`,
          },
        });

        if (checkResp.status === 200 || checkResp.status === 201) {
          // Upload complete
          const result = await checkResp.json();
          await sessionDoc.ref.update({
            status: 'completed',
            uploadedBytes: session.fileSize,
            driveFileId: result.id,
            updatedAt: new Date(),
          });
          return res.status(200).json({
            sessionId,
            status: 'completed',
            uploadedBytes: session.fileSize,
            totalBytes: session.fileSize,
            driveFileId: result.id,
          });
        }

        if (checkResp.status === 308) {
          // In progress
          const range = checkResp.headers.get('Range');
          const uploadedBytes = range ? parseInt(range.split('-')[1], 10) + 1 : 0;
          await sessionDoc.ref.update({ uploadedBytes, updatedAt: new Date() });
          return res.status(200).json({
            sessionId,
            status: session.status,
            uploadedBytes,
            totalBytes: session.fileSize,
          });
        }

        // Session may have expired on Google's side
        if (checkResp.status === 404) {
          await sessionDoc.ref.update({ status: 'expired', updatedAt: new Date() });
          return res.status(200).json({
            sessionId,
            status: 'expired',
            uploadedBytes: session.uploadedBytes || 0,
            totalBytes: session.fileSize,
          });
        }
      } catch {
        // If we can't reach Google, return cached data
      }
    }

    return res.status(200).json({
      sessionId,
      status: session.status,
      uploadedBytes: session.uploadedBytes || 0,
      totalBytes: session.fileSize,
      driveFileId: session.driveFileId || null,
    });
  } catch (error: any) {
    console.error('[drive/upload-status] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});
