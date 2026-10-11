/**
 * Canva REST istemcisi (ilk sürüm: fotoğraf). Kaynak: canva.dev REST reference (okunma 2026-10-10).
 * - GET  /v1/folders/{id}/items      folder:read   100/dk/kullanıcı — videolar listelenmez
 * - GET  /v1/assets/{id}             asset:read    100/dk — thumbnail URL 15 dk; ORİJİNAL indirme URL'si YOK
 * - POST /v1/asset-uploads           asset:write   30/dk  — octet-stream gövde + Asset-Upload-Metadata
 * - GET  /v1/asset-uploads/{jobId}   asset:read    180/dk — failed | in_progress | success
 * - POST /v1/folders/move            folder:write  100/dk — 204; video desteklenmez; item_in_multiple_folders
 */

export const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
/** Token alınamadığı için istek gönderilmedi (yan etki yok) */
export const AUTH_UNAVAILABLE = 'auth_unavailable';
/** Görsel yükleme sınırı: "smaller than 50 MB" — temkinli olarak ondalık */
export const CANVA_IMAGE_MAX_BYTES = 50_000_000;
/** İlk sürüm: yalnız JPEG/PNG (Canva HEIC/GIF/TIFF/WEBP'yi de kabul ediyor; kapsam bilinçli dar) */
export const CANVA_SYNC_MIME = new Set(['image/jpeg', 'image/png']);
/** Asset adı en fazla 50 karakter (kodlanmamış) */
export const CANVA_NAME_MAX = 50;

export interface CanvaImageItem {
  id: string;
  name: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  thumbnail?: { url: string; width: number; height: number };
}

export interface CanvaUploadJob {
  id: string;
  status: 'failed' | 'in_progress' | 'success';
  error?: { code: string; message?: string };
  assetId?: string;
}

/**
 * Hata sınıflandırması:
 *  - noResponse: istek gönderildi ama yanıt yok (zaman aşımı/ağ) → yan etki BELİRSİZ
 *  - retryable: aynı isteği tekrar etmek güvenli/uygun (429, ve yalnız okuma/taşıma için 5xx)
 */
export class CanvaApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string,
    readonly noResponse = false
  ) {
    super(message);
  }
  get rateLimited() {
    return this.status === 429;
  }
  get serverError() {
    return this.status !== null && this.status >= 500;
  }
}

export type CanvaFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: any; signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

/** Canva'ya gidecek ad: ≤ 50 karakter, uzantı korunur */
export function canvaAssetName(fileName: string): string {
  const clean = (fileName || 'studio-asset').replace(/[\r\n\t]/g, ' ').trim() || 'studio-asset';
  if ([...clean].length <= CANVA_NAME_MAX) return clean;
  const dot = clean.lastIndexOf('.');
  const ext = dot > 0 && clean.length - dot <= 6 ? clean.slice(dot) : '';
  return [...clean.slice(0, clean.length - ext.length)].slice(0, CANVA_NAME_MAX - ext.length).join('') + ext;
}

export class CanvaClient {
  constructor(
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetchImpl: CanvaFetch,
    private readonly timeoutMs = 30_000
  ) {}

  private async call(method: string, path: string, opts: { headers?: Record<string, string>; body?: any } = {}): Promise<any> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (e: any) {
      // İstek HİÇ gönderilmedi (token yok/yenileniyor/yeniden yetki): belirsiz değil, sonra yeniden denenebilir
      throw new CanvaApiError(String(e?.message || 'Canva token alınamadı'), null, AUTH_UNAVAILABLE, false);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Awaited<ReturnType<CanvaFetch>>;
    try {
      res = await this.fetchImpl(`${CANVA_API_BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
        body: opts.body,
        signal: ctrl.signal,
      });
    } catch {
      throw new CanvaApiError('Canva isteğine yanıt alınamadı', null, 'no_response', true);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 204) return null;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new CanvaApiError(String(body?.message || 'Canva isteği başarısız'), res.status, String(body?.code || `http_${res.status}`));
    return body;
  }

  async listFolderImages(folderId: string, continuation?: string): Promise<{ items: CanvaImageItem[]; continuation?: string }> {
    const q = new URLSearchParams({ item_types: 'image', sort_by: 'modified_descending', limit: '50' });
    if (continuation) q.set('continuation', continuation);
    const body = await this.call('GET', `/folders/${encodeURIComponent(folderId)}/items?${q}`);
    const items: CanvaImageItem[] = [];
    for (const it of body?.items || []) {
      const img = it?.type === 'image' ? it.image : null;
      if (!img || img.type !== 'image' || typeof img.id !== 'string') continue; // video vb. desteklenmiyor
      items.push({
        id: img.id,
        name: String(img.name || ''),
        tags: Array.isArray(img.tags) ? img.tags.map(String) : [],
        createdAt: Number(img.created_at) || 0,
        updatedAt: Number(img.updated_at) || 0,
        ...(img.thumbnail?.url ? { thumbnail: { url: img.thumbnail.url, width: img.thumbnail.width, height: img.thumbnail.height } } : {}),
      });
    }
    return { items, ...(body?.continuation ? { continuation: body.continuation } : {}) };
  }

  async getAsset(assetId: string): Promise<{ id: string; type: string; name: string; thumbnail?: { url: string; width: number; height: number }; width?: number; height?: number }> {
    const body = await this.call('GET', `/assets/${encodeURIComponent(assetId)}`);
    const a = body?.asset || {};
    return { id: a.id, type: a.type, name: a.name, thumbnail: a.thumbnail, width: a.metadata?.width, height: a.metadata?.height };
  }

  /** Orijinal baytlarla async yükleme işi başlatır (yan etkili; yeniden deneme kararı çağırana ait) */
  async createAssetUploadJob(bytes: Buffer, fileName: string): Promise<CanvaUploadJob> {
    const nameBase64 = Buffer.from(canvaAssetName(fileName), 'utf8').toString('base64');
    const body = await this.call('POST', '/asset-uploads', {
      headers: { 'Content-Type': 'application/octet-stream', 'Asset-Upload-Metadata': JSON.stringify({ name_base64: nameBase64 }) },
      body: bytes,
    });
    return toJob(body?.job);
  }

  async getAssetUploadJob(jobId: string): Promise<CanvaUploadJob> {
    return toJob((await this.call('GET', `/asset-uploads/${encodeURIComponent(jobId)}`))?.job);
  }

  async moveFolderItem(itemId: string, toFolderId: string): Promise<void> {
    await this.call('POST', '/folders/move', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_folder_id: toFolderId, item_id: itemId }),
    });
  }
}

function toJob(j: any): CanvaUploadJob {
  if (!j || typeof j.id !== 'string') throw new CanvaApiError('Canva yükleme işi yanıtı eksik', 200, 'invalid_response');
  return {
    id: j.id,
    status: j.status,
    ...(j.error ? { error: { code: String(j.error.code), message: j.error.message } } : {}),
    ...(j.asset?.id ? { assetId: String(j.asset.id) } : {}),
  };
}
