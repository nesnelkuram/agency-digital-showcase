import '../_lib/env.js';
import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { getGoogleDriveCredentials, driveGet } from '../_lib/googleDriveApi.js';

export const config = { maxDuration: 15 };

/**
 * GET /api/drive/list?folderId=xxx&pageToken=xxx&q=searchTerm
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getAdminDb();
    const { accessToken } = await getGoogleDriveCredentials(db, req.tenantId);

    const folderId = req.query.folderId as string | undefined;
    const pageToken = req.query.pageToken as string | undefined;
    const searchQuery = req.query.q as string | undefined;

    const fileFields = 'id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink,iconLink,createdTime,modifiedTime,parents';

    let query: string;
    if (searchQuery) {
      query = `name contains '${searchQuery.replace(/'/g, "\\'")}' and trashed=false`;
    } else {
      const parent = folderId || 'root';
      query = `'${parent}' in parents and trashed=false`;
    }

    // Fetch folders and files separately for better UX
    const [foldersResult, filesResult] = await Promise.all([
      driveGet(accessToken, 'files', {
        q: searchQuery
          ? `name contains '${searchQuery.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
          : `'${folderId || 'root'}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: `nextPageToken,files(id,name,parents)`,
        orderBy: 'name',
        pageSize: '100',
      }),
      driveGet(accessToken, 'files', {
        q: searchQuery
          ? `name contains '${searchQuery.replace(/'/g, "\\'")}' and mimeType!='application/vnd.google-apps.folder' and trashed=false`
          : `'${folderId || 'root'}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
        fields: `nextPageToken,files(${fileFields})`,
        orderBy: 'modifiedTime desc',
        pageSize: '50',
        ...(pageToken ? { pageToken } : {}),
      }),
    ]);

    return res.status(200).json({
      folders: foldersResult.files || [],
      files: filesResult.files || [],
      nextPageToken: filesResult.nextPageToken || null,
    });
  } catch (error: any) {
    console.error('[drive/list] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Drive dosyaları listelenemedi' });
  }
});
