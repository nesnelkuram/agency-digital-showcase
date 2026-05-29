import { upload } from '@vercel/blob/client';
import { getAuth } from 'firebase/auth';

/**
 * Upload a Blob/File directly to Vercel Blob from the browser, authorising the
 * request with the current user's Firebase ID token (verified server-side in
 * /api/blob/upload-url). Returns the public URL.
 *
 * Client uploads bypass the 4.5 MB serverless body limit, so they handle the
 * full-size compressed videos.
 */
export async function uploadToBlob(
  pathname: string,
  data: Blob,
  contentType = 'video/mp4',
  onProgress?: (loaded: number, total: number) => void,
): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Oturum açık değil');
  const idToken = await user.getIdToken();

  const result = await upload(pathname, data, {
    access: 'public',
    contentType,
    handleUploadUrl: '/api/blob/upload-url',
    clientPayload: idToken,
    onUploadProgress: onProgress
      ? (e) => onProgress(e.loaded, e.total)
      : undefined,
  });

  return result.url;
}
