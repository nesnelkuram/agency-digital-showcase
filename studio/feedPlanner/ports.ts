import type { Candidate } from './types';
import type { CopyRequest, CopyResult } from '../../shared/planner/copyContract';
import type { PlannerDraft } from '../../shared/planner/plannerDraft';

/**
 * Planlayıcı çalışma alanının dış bağımlılıkları. Yerel inceleme (review) ve yetkili Studio aynı çalışma alanını
 * farklı portlarla kullanır. Hiçbir port bir başarıyı taklit etmez: bağlı değilse açıkça hata verir.
 */
export class PortError extends Error {
  constructor(message: string, public code: string, public status?: number, public details?: unknown) {
    super(message);
  }
}

export interface CopyResponse {
  accepted: CopyResult[];
  rejected: Array<{ slotKey: string; reasons: string[] }>;
  notes: string[];
  model: string;
  promptVersion: string;
  responseId: string | null;
  /** Sağlayıcı, istenen/çalışan model, istek kimliği, usage ve maliyet (sunucudan aynen; yoksa tanımsız) */
  provider?: string | null;
  requestedModel?: string;
  requestId?: string | null;
  /** Sunucunun kullandığı ses kaynağı ve varsayımlar. approved_* her zaman geçici tona üstündür. */
  voice?: { source: 'approved_bundle' | 'approved_guide' | 'temporary_tone'; tone: { label?: string; prompt?: string } | null; guideVersion: number | null; assumptions: string[]; tempToneIgnored: boolean };
  usage?: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; cachedTokens: number | null; reasoningTokens: number | null; costUsd: number | null };
}

/** Gerçek model hattı (sunucu: /api/studio/plan-copy). Şablon fallback YOK. */
export interface CopyPort {
  available: boolean;
  /** available=false ise kullanıcıya gösterilen kesin neden */
  unavailableReason?: string;
  generate(req: CopyRequest): Promise<CopyResponse>;
}

export interface LoadedDraftInfo {
  version: number;
  draft: PlannerDraft;
}

/** Kalıcı taslak (sunucu: /api/studio/planner-draft). Port null ise kalıcılık YOKTUR (yerel inceleme). */
export interface PersistencePort {
  load(weekStart: string): Promise<LoadedDraftInfo | null>;
  save(a: { weekStart: string; expectedVersion: number; idempotencyKey: string; draft: PlannerDraft }): Promise<{ version: number; replayed: boolean }>;
}

export interface PlannerPorts {
  mode: 'review' | 'studio';
  /** Aday görselinin gösterilebilir adresi (yerel: sunucu URL; Studio: yetkili Storage okumasıyla blob URL) */
  imageSrc: (c: Candidate) => string | Promise<string>;
  copy: CopyPort;
  persistence: PersistencePort | null;
}

/** Model bağlı değil: her çağrı açık hata verir (şablonla doldurmaz). */
export const unavailableCopyPort = (reason: string): CopyPort => ({
  available: false,
  unavailableReason: reason,
  generate: async () => {
    throw new PortError(reason, 'model_unavailable');
  },
});

export const REVIEW_COPY_REASON = 'Metin üretim modeli bağlı değil (yerel inceleme). Metin yalnız yetkili Studio\'daki gerçek model hattından gelir; şablonla doldurulmaz.';

export const reviewPorts = (): PlannerPorts => ({
  mode: 'review',
  imageSrc: (c) => `/__review/asset/${c.imageKey}`,
  copy: unavailableCopyPort(REVIEW_COPY_REASON),
  persistence: null,
});
