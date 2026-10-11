/**
 * Canva OAuth — Authorization Code + PKCE (S256), yalnız sunucu.
 * Kaynak: https://www.canva.dev/docs/apps/rest-apis/authentication/ ve
 *         https://www.canva.dev/docs/apps/rest-apis/reference/authentication/generate-access-token/ (okunma 2026-10-10)
 * - code_verifier 43–128 karakter, tarayıcıya/state'e konmaz (şifreli olarak sunucuda saklanır)
 * - state yüksek entropili, istek başına tek, dönüşte doğrulanır
 * - token uç noktası: Basic auth (client_id:client_secret), x-www-form-urlencoded, yalnız backend
 * - refresh token TEK KULLANIMLIK: her yenilemede yeni refresh token kalıcı yazılmalı
 */

import { createHash, randomBytes } from 'crypto';

export const CANVA_AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize';
export const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
/** İlk sürüm: klasör listeleme/taşıma + varlık okuma/yükleme. asset:write asset:read'i kapsamaz (açık liste). */
export const CANVA_SCOPES = ['folder:read', 'folder:write', 'asset:read', 'asset:write'] as const;
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(64)); // 86 karakter
  return { verifier, challenge: pkceChallenge(verifier) };
}

export function pkceChallenge(verifier: string): string {
  if (verifier.length < 43 || verifier.length > 128) throw new Error('code_verifier 43–128 karakter olmalı');
  return b64url(createHash('sha256').update(verifier).digest());
}

export function createState(): string {
  return b64url(randomBytes(32));
}

/** State dokümanı kimliği: state'in kendisi saklanmaz, hash'i saklanır */
export const stateKey = (state: string) => createHash('sha256').update(state).digest('hex');

export function buildAuthorizeUrl(p: { clientId: string; redirectUri: string; challenge: string; state: string }): string {
  const u = new URL(CANVA_AUTHORIZE_URL);
  u.searchParams.set('code_challenge', p.challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('scope', CANVA_SCOPES.join(' '));
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', p.clientId);
  u.searchParams.set('state', p.state);
  u.searchParams.set('redirect_uri', p.redirectUri);
  return u.toString();
}

export interface StoredOAuthState {
  tenantId: string;
  uid: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

/** Dönüşte state doğrulaması (saf): bulunmalı, kullanılmamış, süresi dolmamış */
export function validateOAuthState(s: StoredOAuthState | null, now: number): { ok: true } | { ok: false; reason: string } {
  if (!s) return { ok: false, reason: 'state_unknown' };
  if (s.used) return { ok: false, reason: 'state_reused' };
  if (now > s.expiresAt) return { ok: false, reason: 'state_expired' };
  return { ok: true };
}

export interface CanvaTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
}

export class CanvaOAuthError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string,
    /** Yanıt alınamadı: refresh token tüketilmiş olabilir (belirsiz) */
    readonly noResponse = false
  ) {
    super(message);
  }
}

/** Token isteği zaman aşımı — yenileme kilidinden (30 sn) kısa olmalı */
export const TOKEN_REQUEST_TIMEOUT_MS = 20_000;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}>;

async function tokenRequest(
  params: Record<string, string>,
  creds: { clientId: string; clientSecret: string },
  fetchImpl: FetchLike,
  now: number
): Promise<CanvaTokenSet> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  let res: Awaited<ReturnType<FetchLike>>;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TOKEN_REQUEST_TIMEOUT_MS);
  try {
    res = await fetchImpl(CANVA_TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      signal: ctrl.signal,
    });
  } catch {
    throw new CanvaOAuthError('Canva token isteğine yanıt alınamadı', null, 'network', true);
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new CanvaOAuthError('Canva token isteği reddedildi', res.status, String(body?.error || body?.code || 'token_error'));
  if (typeof body.access_token !== 'string' || typeof body.refresh_token !== 'string') {
    throw new CanvaOAuthError('Canva token yanıtı eksik', res.status, 'invalid_response');
  }
  const expiresIn = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 3600;
  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: now + expiresIn * 1000, scope: body.scope };
}

export function exchangeCode(
  p: { code: string; verifier: string; redirectUri: string; clientId: string; clientSecret: string },
  fetchImpl: FetchLike,
  now = Date.now()
) {
  return tokenRequest(
    { grant_type: 'authorization_code', code: p.code, code_verifier: p.verifier, redirect_uri: p.redirectUri },
    p,
    fetchImpl,
    now
  );
}

export function refreshTokens(p: { refreshToken: string; clientId: string; clientSecret: string }, fetchImpl: FetchLike, now = Date.now()) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: p.refreshToken }, p, fetchImpl, now);
}
