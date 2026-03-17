import '../_lib/env.js';
import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { getGoogleDriveCredentials, driveGet } from '../_lib/googleDriveApi.js';
import { getAssetTypeFromMimeType } from '../../shared/types/asset.js';

export const config = { maxDuration: 60 };

/**
 * POST /api/drive/import
 * Body: { fileId, folderId?, mode: 'link' | 'copy' }
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileId, folderId, mode = 'link' } = req.body || {};
    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }

    const db = getAdminDb();
    const { accessToken } = await getGoogleDriveCredentials(db, req.tenantId);

    // Get file metadata from Drive
    const fileMeta = await driveGet(accessToken, `files/${fileId}`, {
      fields: 'id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink,iconLink',
    });

    const fileSize = parseInt(fileMeta.size || '0', 10);

    if (mode === 'copy') {
      // Copy mode: download from Drive → upload to Firebase Storage
      if (fileSize > 50 * 1024 * 1024) {
        return res.status(400).json({ error: 'Copy modu için maksimum dosya boyutu 50MB' });
      }

      // Download the file
      const downloadResp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!downloadResp.ok) {
        throw new Error('Drive dosyası indirilemedi');
      }

      // Upload to Firebase Storage
      const { getStorage } = await import('firebase-admin/storage');
      const bucket = getStorage().bucket();
      const storagePath = `tenants/${req.tenantId}/assets/${Date.now()}_${fileMeta.name}`;
      const file = bucket.file(storagePath);

      const buffer = Buffer.from(await downloadResp.arrayBuffer());
      await file.save(buffer, {
        metadata: { contentType: fileMeta.mimeType },
      });

      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      // Create asset record
      const assetRef = db.collection('assets').doc();
      await assetRef.set({
        tenantId: req.tenantId,
        name: fileMeta.name,
        type: getAssetTypeFromMimeType(fileMeta.mimeType),
        source: 'upload',
        url: publicUrl,
        thumbnailUrl: fileMeta.thumbnailLink || null,
        folderId: folderId || null,
        tags: [],
        metadata: {
          size: fileSize,
          mimeType: fileMeta.mimeType,
        },
        createdBy: req.userId,
        createdByName: req.userDisplayName || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return res.status(200).json({
        success: true,
        mode: 'copy',
        assetId: assetRef.id,
      });
    }

    // Link mode: create asset pointing to Drive file
    const assetRef = db.collection('assets').doc();
    await assetRef.set({
      tenantId: req.tenantId,
      name: fileMeta.name,
      type: getAssetTypeFromMimeType(fileMeta.mimeType),
      source: 'google_drive',
      url: fileMeta.webViewLink || fileMeta.webContentLink || '',
      thumbnailUrl: fileMeta.thumbnailLink || null,
      driveFileId: fileId,
      driveWebViewLink: fileMeta.webViewLink || null,
      folderId: folderId || null,
      tags: [],
      metadata: {
        size: fileSize,
        mimeType: fileMeta.mimeType,
      },
      createdBy: req.userId,
      createdByName: req.userDisplayName || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      mode: 'link',
      assetId: assetRef.id,
    });
  } catch (error: any) {
    console.error('[drive/import] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Dosya import edilemedi' });
  }
});
