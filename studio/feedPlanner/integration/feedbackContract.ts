/**
 * /api/studio/feedback gövdesi (AI öneri reddi) — yalnız İNŞA ve DOĞRULAMA; ağ çağrısı yok. Kurallar
 * api/_lib/feedback/contentFeedback.ts SuggestionFeedbackSchema ile aynıdır (testte gerçek şemayla eşitlik doğrulanır).
 */
export const FEEDBACK_CATEGORIES = ['görsel', 'metin', 'marka_sesi', 'ürün_bilgisi', 'format', 'zamanlama', 'tekrar', 'diğer'] as const;
export const FEEDBACK_SCOPES = ['content_only', 'brand_context'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackScope = (typeof FEEDBACK_SCOPES)[number];

export interface SuggestionRejectBody {
  target: { kind: 'suggestion'; suggestionSetId: string; index: number };
  category: FeedbackCategory;
  note: string;
  scope: FeedbackScope;
  idempotencyKey: string;
  expectedContentHash: string;
}

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const KEY_RE = /^[A-Za-z0-9-]{16,64}$/;
const HASH_RE = /^[0-9a-f]{32}$/;

export interface RejectInput {
  suggestionSetId: string;
  index: number;
  category: string;
  note?: string;
  scope: string;
  idempotencyKey: string;
  expectedContentHash: string;
}

export function buildSuggestionRejectBody(i: RejectInput): { ok: true; body: SuggestionRejectBody } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!ID_RE.test(i.suggestionSetId)) errors.push('suggestionSetId geçersiz');
  if (!Number.isInteger(i.index) || i.index < 0 || i.index > 50) errors.push('index 0-50 tam sayı olmalı');
  if (!(FEEDBACK_CATEGORIES as readonly string[]).includes(i.category)) errors.push('category geçersiz');
  if ((i.note ?? '').length > 500) errors.push('note en fazla 500 karakter');
  if (!(FEEDBACK_SCOPES as readonly string[]).includes(i.scope)) errors.push('scope geçersiz');
  if (!KEY_RE.test(i.idempotencyKey)) errors.push('idempotencyKey 16-64 karakter [A-Za-z0-9-] olmalı');
  if (!HASH_RE.test(i.expectedContentHash)) errors.push('expectedContentHash 32 hex olmalı');
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    body: {
      target: { kind: 'suggestion', suggestionSetId: i.suggestionSetId, index: i.index },
      category: i.category as FeedbackCategory,
      note: i.note ?? '',
      scope: i.scope as FeedbackScope,
      idempotencyKey: i.idempotencyKey,
      expectedContentHash: i.expectedContentHash,
    },
  };
}

export type LocalAction = 'reject_with_reason' | 'dismiss' | 'lock' | 'unlock';
export type GapCode = 'no_stored_suggestion' | 'dismiss_not_persisted' | 'lock_not_persisted';

export type ServerMapping =
  | { kind: 'request'; endpoint: '/api/studio/feedback'; body: SuggestionRejectBody }
  | { kind: 'invalid'; errors: string[] }
  | { kind: 'gap'; gap: GapCode; detail: string };

/**
 * Yerel eylemin canlıdaki karşılığı. Karşılığı OLMAYAN eylem için uydurma istek üretilmez: "gap" döner.
 *  - gerekçeli ret: yalnız sunucuda saklanmış öneri kümesine bağlı slotlar için mevcut uç noktaya eşlenir.
 *  - Ele (gerekçesiz) ve Kalsın: canlıda kalıcı karşılığı yok.
 */
export function mapLocalAction(
  action: LocalAction,
  ref: { suggestionSetId: string; index: number; contentHash: string } | undefined,
  reason?: { category: string; note?: string; scope: string; idempotencyKey: string },
): ServerMapping {
  if (action === 'lock' || action === 'unlock') return { kind: 'gap', gap: 'lock_not_persisted', detail: 'Kalsın işareti için canlı şemada alan/uç nokta yok.' };
  if (action === 'dismiss') return { kind: 'gap', gap: 'dismiss_not_persisted', detail: 'Gerekçesiz eleme kalıcı kaydedilmez; yalnız gerekçeli ret content_feedback\'e yazılır.' };
  if (!ref || !reason) return { kind: 'gap', gap: 'no_stored_suggestion', detail: 'Bu slot sunucuda saklanmış bir öneri kümesinden gelmiyor; ret sebebi bağlanamaz.' };
  const r = buildSuggestionRejectBody({ ...ref, ...reason, expectedContentHash: ref.contentHash });
  return r.ok ? { kind: 'request', endpoint: '/api/studio/feedback', body: r.body } : { kind: 'invalid', errors: r.errors };
}
