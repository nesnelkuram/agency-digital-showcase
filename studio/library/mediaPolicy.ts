import { storage } from '@/lib/firebase/config';
import type { MediaSourcePolicy } from '@/shared/types/brandMedia';

/**
 * İstemcinin güvendiği medya kaynağı: resmi Firebase Storage host'u (HTTPS) + uygulamanın yapılandırılmış bucket'ı.
 * Bucket bilinmiyorsa liste boş döner (fail-closed). İstemci emülatöre bağlanmadığı için emülatör host'u yoktur.
 */
export function getClientMediaPolicy(): MediaSourcePolicy {
  const bucket = (storage?.app?.options?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim();
  return { hosts: ['firebasestorage.googleapis.com'], buckets: bucket ? [bucket] : [] };
}
