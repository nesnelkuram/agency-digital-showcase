import '../_lib/env.js';
import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { getGoogleDriveCredentials, driveGet } from '../_lib/googleDriveApi.js';
import { getAssetTypeFromMimeType } from '../../shared/types/asset.js';

export const config = { maxDuration: 60 };

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
}

/**
 * POST /api/drive/sync
 * Body: { driveFolderId?, depth? }
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { driveFolderId, depth = 2 } = req.body || {};
    const maxDepth = Math.min(depth, 3);

    const db = getAdminDb();
    const creds = await getGoogleDriveCredentials(db, req.tenantId);

    let syncedFolders = 0;
    let syncedFiles = 0;
    let deletedFiles = 0;

    // Recursive sync function
    async function syncFolder(
      parentDriveFolderId: string | null,
      parentAssetFolderId: string | null,
      currentDepth: number
    ) {
      if (currentDepth > maxDepth) return;

      const parent = parentDriveFolderId || 'root';

      // List all items in this folder
      const [foldersResult, filesResult] = await Promise.all([
        driveGet(creds.accessToken, 'files', {
          q: `'${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id,name)',
          pageSize: '200',
        }),
        driveGet(creds.accessToken, 'files', {
          q: `'${parent}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id,name,mimeType,size,webViewLink,thumbnailLink,modifiedTime)',
          pageSize: '200',
        }),
      ]);

      const driveFolders: DriveItem[] = foldersResult.files || [];
      const driveFiles: DriveItem[] = filesResult.files || [];

      // Sync folders (upsert)
      for (const folder of driveFolders) {
        const existing = await db
          .collection('assetFolders')
          .where('tenantId', '==', req.tenantId)
          .where('driveFolderId', '==', folder.id)
          .limit(1)
          .get();

        let assetFolderId: string;
        if (existing.empty) {
          const ref = db.collection('assetFolders').doc();
          await ref.set({
            tenantId: req.tenantId,
            name: folder.name,
            parentId: parentAssetFolderId || null,
            driveFolderId: folder.id,
            createdBy: req.userId,
            createdAt: new Date(),
          });
          assetFolderId = ref.id;
          syncedFolders++;
        } else {
          assetFolderId = existing.docs[0].id;
          await existing.docs[0].ref.update({ name: folder.name });
        }

        // Recurse into subfolders
        await syncFolder(folder.id, assetFolderId, currentDepth + 1);
      }

      // Sync files (upsert)
      for (const file of driveFiles) {
        const existing = await db
          .collection('assets')
          .where('tenantId', '==', req.tenantId)
          .where('driveFileId', '==', file.id)
          .limit(1)
          .get();

        if (existing.empty) {
          const ref = db.collection('assets').doc();
          await ref.set({
            tenantId: req.tenantId,
            name: file.name,
            type: getAssetTypeFromMimeType(file.mimeType),
            source: 'google_drive',
            url: file.webViewLink || '',
            thumbnailUrl: file.thumbnailLink || null,
            driveFileId: file.id,
            driveWebViewLink: file.webViewLink || null,
            folderId: parentAssetFolderId || null,
            tags: [],
            metadata: {
              size: parseInt(file.size || '0', 10),
              mimeType: file.mimeType,
            },
            createdBy: req.userId,
            createdByName: req.userDisplayName || '',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          syncedFiles++;
        } else {
          await existing.docs[0].ref.update({
            name: file.name,
            thumbnailUrl: file.thumbnailLink || null,
            updatedAt: new Date(),
          });
        }
      }

      // Mark files that no longer exist in Drive
      const driveFileIds = driveFiles.map((f) => f.id);
      if (driveFileIds.length > 0 && parentAssetFolderId) {
        const localFiles = await db
          .collection('assets')
          .where('tenantId', '==', req.tenantId)
          .where('source', '==', 'google_drive')
          .where('folderId', '==', parentAssetFolderId)
          .get();

        for (const doc of localFiles.docs) {
          const data = doc.data();
          if (data.driveFileId && !driveFileIds.includes(data.driveFileId)) {
            await doc.ref.update({ deletedFromDrive: true, updatedAt: new Date() });
            deletedFiles++;
          }
        }
      }
    }

    await syncFolder(driveFolderId || null, null, 0);

    // Update last sync time
    const accountSnap = await db
      .collection('platform_accounts')
      .where('tenantId', '==', req.tenantId)
      .where('platform', '==', 'google_drive')
      .limit(1)
      .get();
    if (!accountSnap.empty) {
      await accountSnap.docs[0].ref.update({ lastSyncAt: new Date() });
    }

    return res.status(200).json({
      success: true,
      syncedFolders,
      syncedFiles,
      deletedFiles,
    });
  } catch (error: any) {
    console.error('[drive/sync] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Senkronizasyon başarısız' });
  }
});
