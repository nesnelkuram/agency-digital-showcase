/**
 * Canva senkronu ve medya AI analizi — özellik bayrakları ve gerekli yapılandırma.
 * Varsayılan KAPALI (fail-closed): bayrak açıkça "true" değilse veya gerekli değişken yoksa uç noktalar 503 döner.
 * Değerler hiçbir yerde döndürülmez/loglanmaz; yalnız "eksik değişken adları" raporlanır.
 */

export type FeatureState = { enabled: true } | { enabled: false; reason: string; missing?: string[] };

const has = (name: string) => typeof process.env[name] === 'string' && process.env[name]!.trim().length > 0;

export const CANVA_REQUIRED_ENV = ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'CANVA_REDIRECT_URI', 'INTEGRATION_TOKEN_KEY', 'FIREBASE_STORAGE_BUCKET'] as const;
/** Medya analizi OpenRouter üzerinden çalışır (plan metin üretimiyle aynı sağlayıcı); ANTHROPIC_API_KEY ne gerekir ne yeterlidir, sessiz yedek yoktur */
export const MEDIA_AI_REQUIRED_ENV = ['OPENROUTER_API_KEY', 'FIREBASE_STORAGE_BUCKET'] as const;

export function canvaSyncState(): FeatureState {
  if (process.env.CANVA_SYNC_ENABLED !== 'true') return { enabled: false, reason: 'Canva senkronu kapalı (CANVA_SYNC_ENABLED).' };
  const missing = CANVA_REQUIRED_ENV.filter((n) => !has(n));
  if (missing.length) return { enabled: false, reason: 'Canva yapılandırması eksik.', missing: [...missing] };
  return { enabled: true };
}

export function mediaAnalysisState(): FeatureState {
  if (process.env.MEDIA_AI_ANALYSIS_ENABLED !== 'true') return { enabled: false, reason: 'Medya AI analizi kapalı (MEDIA_AI_ANALYSIS_ENABLED).' };
  const missing = MEDIA_AI_REQUIRED_ENV.filter((n) => !has(n));
  if (missing.length) return { enabled: false, reason: 'AI yapılandırması eksik.', missing: [...missing] };
  const raw = process.env.MEDIA_AI_MODEL?.trim();
  if (raw && !MEDIA_AI_ALLOWED_MODELS.includes(raw)) return { enabled: false, reason: `MEDIA_AI_MODEL geçersiz (izinli: ${MEDIA_AI_ALLOWED_MODELS.join(', ')}).` };
  return { enabled: true };
}

/** İzinli medya analizi modelleri (OpenRouter kimlikleri). spec.ALLOWED_MEDIA_MODELS ile aynı liste; testle eşitliği doğrulanır. */
export const MEDIA_AI_ALLOWED_MODELS: string[] = ['anthropic/claude-haiku-5.5', 'anthropic/claude-sonnet-5.5'];

/**
 * Otomatik analiz aktivasyon başlangıcı (ISO 8601, ör. 2026-10-12T09:00:00+03:00). Kalıcı uzlaştırma bu andan
 * SONRA yüklenen fotoğrafları tarar; önceki arşiv için backfill yok. Yoksa/geçersizse uzlaştırma çalışmaz
 * (yükleme sonrası hızlı yol yine çalışır).
 */
export function parseActivationSince(raw: string | undefined): number | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}T/.test(raw.trim())) return null;
  const ms = Date.parse(raw.trim());
  return Number.isFinite(ms) ? ms : null;
}

export const mediaAnalysisSinceMs = () => parseActivationSince(process.env.MEDIA_AI_ANALYSIS_SINCE);

export const PLAN_SUGGEST_REQUIRED_ENV = ['ANTHROPIC_API_KEY'] as const;

/** Haftalık plan taslak önerisi (Sonnet 5.5) — varsayılan KAPALI */
export function planSuggestState(): FeatureState {
  if (process.env.PLAN_AI_SUGGEST_ENABLED !== 'true') return { enabled: false, reason: 'Plan taslak önerisi kapalı (PLAN_AI_SUGGEST_ENABLED).' };
  const missing = PLAN_SUGGEST_REQUIRED_ENV.filter((n) => !has(n));
  if (missing.length) return { enabled: false, reason: 'AI yapılandırması eksik.', missing: [...missing] };
  return { enabled: true };
}

/**
 * Planlayıcı metin üretimi — OpenRouter üzerinden; varsayılan KAPALI, şablon ve Anthropic yedeği YOK.
 * Bu akış ANTHROPIC_API_KEY'e bağlı DEĞİLDİR (anahtar eksik olsa da yedeğe düşmez).
 */
export const PLAN_COPY_REQUIRED_ENV = ['OPENROUTER_API_KEY'] as const;
export function copySuggestState(): FeatureState {
  if (process.env.PLAN_COPY_AI_ENABLED !== 'true') return { enabled: false, reason: 'Plan metin üretimi kapalı (PLAN_COPY_AI_ENABLED).' };
  const missing = PLAN_COPY_REQUIRED_ENV.filter((n) => !has(n));
  if (missing.length) return { enabled: false, reason: 'AI yapılandırması eksik.', missing: [...missing] };
  const raw = process.env.PLAN_COPY_MODEL?.trim();
  if (raw && !/^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:+-]*$/.test(raw)) return { enabled: false, reason: 'PLAN_COPY_MODEL geçersiz (biçim: sağlayıcı/model, ör. anthropic/claude-sonnet-5.5).' };
  return { enabled: true };
}
