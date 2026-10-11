/**
 * İçerik sürümü — post'un İÇERİK alanlarının kanonik biçimi (durum, revizyon sayısı, updatedAt HARİÇ:
 * onay geçişi içeriği değiştirmez). İstemci, ekranda gördüğü post'tan hash'i hesaplar ve gönderir;
 * sunucu aynı kanonik biçimden kendi hash'ini transaction içinde hesaplayıp EŞİTLİK arar (istemci hash'i
 * yalnız "gördüğüm sürüm bu" iddiasıdır; kayıt her zaman sunucunun hesapladığı hash'e bağlanır).
 */

const msOf = (v: any): number | null => (v == null ? null : typeof v === 'number' ? v : typeof v.toMillis === 'function' ? v.toMillis() : null);

export function canonicalPostContent(post: any): string {
  const media = Array.isArray(post?.media) ? post.media.map((m: any) => m?.libraryAssetId || m?.url || '') : [];
  return JSON.stringify({
    caption: post?.caption || '',
    hashtags: Array.isArray(post?.hashtags) ? post.hashtags : [],
    media,
    mediaUrls: Array.isArray(post?.mediaUrls) ? post.mediaUrls : [],
    postType: post?.postType || '',
    platforms: Array.isArray(post?.platforms) ? post.platforms : [],
    scheduledAt: msOf(post?.scheduledAt),
  });
}

export const CONTENT_HASH_RE = /^[0-9a-f]{32}$/;

/** Tarayıcı/Node WebCrypto ile aynı hash (sunucu: node:crypto sha256, ilk 32 hex) */
export async function contentHashOf(post: any): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalPostContent(post));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
