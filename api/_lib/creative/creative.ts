/**
 * Aşama 3 sunucu orkestrasyonu: fikir → caption → bağımsız kontrol. Her rol AYRI çağrı, AYRI prompt, AYRI şema, AYRI açık kullanıcı eylemidir;
 * hiçbir rol bir diğerini otomatik başlatmaz, başarısız kontrol sonrası otomatik yeniden üretim YOKTUR. Şablon fallback YOKTUR.
 * Model çıktısı ASLA doğrudan kabul edilmez: şema + kimlik eşleşmesi + kural denetimi (validateCopyOutput) sunucuda yapılır.
 * Önbellek yalnız DOĞRULANMIŞ başarıyı saklar (hata/ret asla); anahtar tenant+proje+KULLANICI(uid, sunucuda doğrulanmış)+varlık+kaynak SHA+analiz+kanıt zinciri+kırpım+niyet+ses+geçmiş+rol+model+istem+şema.
 * Kanıt zinciri özeti (evidence.digest) görünür olgularla BİRLİKTE kapsam, uid, varlık, analiz anahtarı, kaynak SHA-256 ve kırpım (odak/zoom/sürüm) içerir:
 * bunlardan biri değişince caption/kontrol model çağrısından ÖNCE 409 evidence_changed ile reddedilir.
 * Eşzamanlı aynı istek: Firestore'da kapsamlı (anahtar = tüm boyutlar) CLAIM; ikinci istek sağlayıcıyı çağırmaz, sonucu bekler. Claim süresi dolmadan
 * (çökme/zaman aşımı) yeni ücretli çağrı açılmaz; süre dolunca açık kullanıcı eylemi yeni çağrıya izin verir (kesinlik sınırı: bkz. docs).
 */
import type { MediaSourcePolicy } from '../../../shared/types/brandMedia.js';
import {
  buildEvidence, evidenceBlock, evidenceIds, evidenceAllowedText, buildIdeasPrompt, buildCaptionPrompt, buildCheckPrompt, validateIdeasOutput, validateCaptionStructure,
  validateCheckOutput, mergeCheck, cleanIntent, creativeCacheKey, cropParts, ideaPart, captionPart, recentDigestOf, captionHash, canon, BudgetExceeded,
  CREATIVE_PROMPT_VERSIONS, CREATIVE_SCHEMA_VERSION, type CacheKeyParts, type CreativeRequest, type CreativeResponse, type CreativeRole, type Evidence, type RoleMeta,
  type VoiceInfo, type VoiceInput, type AccountPost, type BudgetReport, type PostIntent,
} from '../../../shared/planner/creativeContract.js';
import { copyContentHash, validateCopyOutput, cleanTonePrompt, type CopyRequest } from '../../../shared/planner/copyContract.js';
import { sha256Hex } from '../../../shared/planner/sha256.js';
import { CopyError, applyCropVisibility, loadCopyMedia, resolveVoice, resolveCopyModel, OPENROUTER_MODEL_RE, type CopyModelCall, type ResolvedVoice } from '../planCopy/planCopy.js';

type Db = any;

export const CREATIVE_CACHE = 'planner_creative_cache';
export const creativeCacheDocId = (key: string) => key;
/** Uçuştaki istek talepleri (idempotency). Belge kimliği = önbellek anahtarı. */
export const CREATIVE_CLAIMS = 'planner_creative_claims';
/** Talep süresi: Vercel maxDuration (120 sn) + pay. Süre dolmadan başka istek aynı çağrıyı yeniden AÇAMAZ. */
export const CLAIM_TTL_MS = 130_000;
const WAIT_MS = 110_000;
const POLL_MS = 100;

export interface CreativeModels { ideas: string; caption: string; check: string }
/** Fikir+caption: PLAN_COPY_MODEL ile aynı çözüm. Kontrol rolü için isteğe bağlı AYRI model (PLAN_CREATIVE_CHECK_MODEL); yoksa aynı. */
export function resolveCreativeModels(env: Record<string, string | undefined> = process.env): { ok: true; models: CreativeModels } | { ok: false; reason: string } {
  const base = resolveCopyModel(env);
  if (!base.ok) return base;
  const raw = env.PLAN_CREATIVE_CHECK_MODEL?.trim();
  if (raw && !OPENROUTER_MODEL_RE.test(raw)) return { ok: false, reason: 'PLAN_CREATIVE_CHECK_MODEL geçersiz (biçim: sağlayıcı/model).' };
  return { ok: true, models: { ideas: base.model, caption: base.model, check: raw || base.model } };
}

export interface CreativeDeps {
  /** Rol başına model çağrısı (her rolün kendi şeması/adı olur) */
  callModel: (role: CreativeRole) => CopyModelCall;
  policy: MediaSourcePolicy;
  models: CreativeModels;
  now?: () => number;
  /** Eşzamanlı aynı isteğin sonucunu bekleme üst sınırı / yoklama aralığı (test için ayarlanabilir) */
  waitMs?: number;
  pollMs?: number;
}

const VOICE_SOURCE = { bundle: 'approved_bundle', guide: 'approved_guide', tone: 'temporary_tone' } as const;
const voiceInput = (v: ResolvedVoice): VoiceInput => (v.mode === 'bundle' ? { mode: 'bundle', bundle: v.bundle } : v.mode === 'guide' ? { mode: 'guide', guide: v.guide } : { mode: 'tone', tone: v.tone });
const voiceRef = (v: ResolvedVoice): string =>
  v.mode === 'bundle' ? `bundle:${sha256Hex(canon({ g: v.bundle.guideHashes, c: v.bundle.captions, v: v.bundle.verifiedProducts, b: v.bundle.brand })).slice(0, 24)}`
  : v.mode === 'guide' ? `guide:v${v.version}:${sha256Hex(canon(v.guide)).slice(0, 16)}`
  : `tone:${sha256Hex(canon({ l: v.tone.label ?? null, p: v.tone.prompt ? cleanTonePrompt(v.tone.prompt) : null })).slice(0, 16)}`;

function voiceInfo(v: ResolvedVoice, req: CreativeRequest): VoiceInfo {
  const assumptions: string[] = [];
  if (v.mode === 'tone') {
    assumptions.push('Marka rehberi yok: ton GEÇİCİ plan tonudur, onaylı marka hafızası değildir.');
    if (!req.tempTone || (!req.tempTone.label && !req.tempTone.prompt)) assumptions.push('Ton seçilmedi: sade, tarafsız varsayılan üslup kullanıldı; marka kişiliği varsayılmadı.');
    assumptions.push('Fikir ve metin yalnız 4:5 kırpımda GÖRÜNÜR olduğu doğrulanan konu bilgisinden türetilir; ürün, içerik, fiyat ve saat doğrulanmadı.');
  }
  return { source: VOICE_SOURCE[v.mode], guideVersion: v.mode === 'guide' ? v.version : null, assumptions, tempToneIgnored: v.mode !== 'tone' && !!req.tempTone };
}

const metaOf = (res: Awaited<ReturnType<CopyModelCall>>, requestedModel: string, promptVersion: string): RoleMeta => ({
  responseId: res.id || null, model: res.modelUsed ?? requestedModel, requestedModel, provider: res.provider ?? null, requestId: res.requestId ?? null,
  promptVersion, schemaVersion: CREATIVE_SCHEMA_VERSION,
  usage: res.usageDetail ?? (res.usage ? { inputTokens: res.usage.input_tokens ?? null, outputTokens: res.usage.output_tokens ?? null, totalTokens: null, cachedTokens: null, reasoningTokens: null, costUsd: null } : null),
});

export async function runCreative(
  db: Db,
  deps: CreativeDeps,
  p: { tenantId: string; projectId: string; /** Sunucuda doğrulanmış kullanıcı (istemci iddiası DEĞİL) */ uid: string; req: CreativeRequest }
): Promise<CreativeResponse> {
  const { req } = p;
  if (!p.uid) throw new CopyError(401, 'uid_required', 'Yetkili kullanıcı kimliği yok.');
  if (req.projectId !== p.projectId) throw new CopyError(400, 'bad_request', 'Proje uyuşmuyor.');
  const voice = await resolveVoice(db, p.tenantId, p.projectId, req.tempTone, { neutralFallback: true });
  const { media, invalid, visuals, provenance } = await loadCopyMedia(db, { tenantId: p.tenantId, projectId: p.projectId, ids: [req.mediaId], policy: deps.policy, bundle: voice.bundle, keepUnnamedProducts: voice.mode !== 'bundle' });
  if (invalid.length) throw new CopyError(422, 'media_invalid', 'İstekteki medya bu marka kütüphanesinde geçerli değil.', invalid);
  const m = media.get(req.mediaId)!;
  const hadCatalog = !!m.catalog;
  // Kırpımda görünür olgu sınırı (sunucu hesabı; istemci iddiasına güvenilmez)
  applyCropVisibility(media, visuals, [{ slotKey: 'feed:0', mediaId: req.mediaId, lane: 'feed', role: 'caption', crop: req.crop }]);
  const products = voice.mode === 'bundle' ? m.verifiedProductIds.map((id) => voice.bundle.verifiedProducts.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ name: x.name, note: x.note })) : [];
  const evidence0: Evidence = buildEvidence({ catalog: m.catalog, visibility: m.visibility ?? { cropped: false, facts: 'tam' }, products, guideFacts: voice.mode === 'guide' ? voice.guide.facts : undefined });
  const prov = provenance.get(req.mediaId) ?? { analysisKey: null, sourceSha256: null };
  // Kanıt ZİNCİRİ özeti: görünür olgular + kapsam + uid + varlık + analiz anahtarı + kaynak SHA + kırpım (odak/zoom/sürüm). Olgu metni aynı kalsa bile bunlardan biri değişirse DEĞİŞİR.
  const evidence: Evidence = { ...evidence0, digest: sha256Hex(canon({ facts: evidence0.digest, tenantId: p.tenantId, projectId: p.projectId, uid: p.uid, mediaId: req.mediaId, analysisKey: prov.analysisKey, sourceSha256: prov.sourceSha256, crop: cropParts(req.crop) })).slice(0, 32) };
  const intent: PostIntent | null = cleanIntent(req.intent);
  const vinfo = voiceInfo(voice, req);
  const base = { evidence, voice: vinfo, source: prov, draftOnly: true as const };
  const block = evidenceBlock(evidence, hadCatalog);

  if (block) {
    // Görünür gerçek yok: model ÇAĞRILMAZ (ücret yok, uydurma yok). Fikir rolü açık "bilgi yetersiz" durumu döner; caption/kontrol yapılamaz.
    if (req.role === 'ideas') return { ...base, role: 'ideas', status: 'bilgi_yetersiz', ideas: [], missingInfo: block === 'kirpimda_gorunur_olgu_yok' ? 'Bu 4:5 kırpımda ana konunun görünürlüğü doğrulanamadı; kırpım dışında kalabilecek ayrıntılar görünen gerçek sayılmaz.' : 'Bu görselde konu açıklaması yok.', blockReason: block, cached: false, meta: null, budget: null };
    throw new CopyError(422, 'evidence_insufficient', block === 'kirpimda_gorunur_olgu_yok' ? 'Kırpımda görünür gerçek doğrulanamadı; bu rol çalıştırılamaz.' : 'Görselde konu açıklaması yok; bu rol çalıştırılamaz.', { reason: block });
  }
  if (req.role !== 'ideas') {
    // Kanıt zinciri: fikir üretildiği andaki kanıtla BUGÜNKÜ kanıt aynı olmalı (analiz/insan düzeltmesi/kırpım değiştiyse eski fikir üzerinden devam edilmez)
    if (req.evidenceDigest !== evidence.digest) throw new CopyError(409, 'evidence_changed', 'Görselin kanıtı fikir üretildikten sonra değişti (analiz, insan düzeltmesi veya kırpım); fikri yeniden üretin.', { current: evidence.digest });
    const ids = evidenceIds(evidence);
    const bad = [...req.idea.factIds.filter((i) => !ids.F.has(i)), ...req.idea.productIds.filter((i) => !ids.P.has(i)), ...req.idea.brandIds.filter((i) => !ids.G.has(i))];
    if (bad.length) throw new CopyError(422, 'idea_basis_invalid', 'Seçilen fikrin dayandığı kanıt bu kırpımda yok.', bad.slice(0, 5));
  }

  const model = deps.models[req.role];
  const promptVersion = CREATIVE_PROMPT_VERSIONS[req.role];
  const parts: CacheKeyParts = {
    role: req.role, tenantId: p.tenantId, projectId: p.projectId, uid: p.uid, mediaId: req.mediaId, sourceSha256: prov.sourceSha256, analysisKey: prov.analysisKey, evidenceDigest: evidence.digest,
    crop: cropParts(req.crop), intent, voice: { mode: voice.mode, ref: voiceRef(voice) }, recentDigest: recentDigestOf(req.recent), model, promptVersion, schemaVersion: CREATIVE_SCHEMA_VERSION,
    ...(req.role !== 'ideas' ? { idea: ideaPart(req.idea) } : {}),
    ...(req.role === 'check' ? { caption: captionPart(req.caption) } : {}),
  };
  const key = creativeCacheKey(parts);
  const now = deps.now ?? Date.now;
  /** Doğrulanmış (kapsam+kullanıcı+rol+anahtar) önbellek kaydı; `accept` ile üretim neslini de sınar */
  const readCache = async (accept?: (d: any) => boolean): Promise<{ res: CreativeResponse; gen: string | null } | null> => {
    const hit = await db.collection(CREATIVE_CACHE).doc(creativeCacheDocId(key)).get();
    const d = hit.exists ? hit.data() : null;
    // Başka kiracı/proje/KULLANICI/rol/anahtar kaydı asla kullanılmaz (savunma amaçlı doğrulama)
    if (d && d.tenantId === p.tenantId && d.projectId === p.projectId && d.uid === p.uid && d.role === req.role && d.key === key && d.result && (!accept || accept(d))) {
      return { res: { ...base, ...d.result, role: req.role, cached: true, evidence, voice: vinfo, source: prov, draftOnly: true } as CreativeResponse, gen: typeof d.claimOwner === 'string' ? d.claimOwner : null };
    }
    return null;
  };
  // Yenileme için taban: başlangıçta duran kaydın ÜRETİM NESLİ (claim sahibi). Yenileme bekleyeni yalnız bundan FARKLI (daha yeni) nesli kabul eder.
  const baseline = req.refresh ? (await readCache())?.gen ?? null : null;
  if (!req.refresh) {
    const cached = await readCache();
    if (cached) return cached.res;
  }
  // Idempotency: aynı anahtar için TEK uçuştaki çağrı. Talebi alamayan istek sağlayıcıyı çağırmaz; sonucu bekler.
  const token = `${now()}-${Math.random().toString(36).slice(2, 10)}`;
  let claim = await acquireClaim(db, key, { tenantId: p.tenantId, projectId: p.projectId, uid: p.uid, role: req.role, token, now: now() });
  if (!claim) {
    const waited = await awaitInFlight(db, key, { read: () => readCache(req.refresh ? (d) => (typeof d.claimOwner === 'string' ? d.claimOwner : null) !== baseline : undefined).then((x) => x?.res ?? null), deps, token, claimArgs: { tenantId: p.tenantId, projectId: p.projectId, uid: p.uid, role: req.role } });
    if (waited.kind === 'result') return waited.result;
    claim = true; // talep süresi dolmuştu ve bu istek devraldı
  }
  try {
    // Çifte kontrol: talebi beklerken önceki sahip sonucu yazmış olabilir (yenileme isteği hariç)
    if (!req.refresh) {
      const again = await readCache();
      if (again) return again.res;
    }
    return await callAndValidate();
  } finally {
    await releaseClaim(db, key, token);
  }

  async function callAndValidate(): Promise<CreativeResponse> {
  const accountPosts: AccountPost[] = voice.mode === 'bundle' ? voice.bundle.captions.map((c) => ({ id: c.id, date: c.date, caption: c.caption })) : [];
  const vin = voiceInput(voice);
  let prompt;
  try {
    prompt = req.role === 'ideas' ? buildIdeasPrompt({ voice: vin, evidence, intent, recent: req.recent, accountPosts })
      : req.role === 'caption' ? buildCaptionPrompt({ voice: vin, evidence, intent, idea: req.idea, recent: req.recent, accountPosts })
      : buildCheckPrompt({ voice: vin, evidence, intent, idea: req.idea, caption: req.caption, recent: req.recent, accountPosts });
  } catch (e) {
    if (e instanceof BudgetExceeded) throw new CopyError(413, 'budget_exceeded', 'Girdi bütçeyi aşıyor (kanıt/fikir çok uzun); kısaltıp yeniden deneyin.');
    throw e;
  }
  let res;
  try {
    res = await deps.callModel(req.role)({ model, system: prompt.system, user: prompt.user });
  } catch (e: any) {
    console.error('plan-creative model error:', req.role, e?.status ?? '', e?.code ?? '');
    throw new CopyError(502, 'model_error', 'Model çağrısı başarısız; sonuç üretilmedi.', { role: req.role });
  }
  if (res.stopReason === 'refusal') throw new CopyError(422, 'model_refusal', 'Model isteği reddetti; sonuç üretilmedi.', { role: req.role });
  if (res.parsed == null) throw new CopyError(422, 'invalid_output', 'Model geçerli yapılandırılmış çıktı döndürmedi.', { role: req.role, reasons: ['schema_invalid'] });
  const meta = metaOf(res, model, promptVersion);

  let result: Record<string, unknown>;
  if (req.role === 'ideas') {
    const v = validateIdeasOutput(res.parsed, { evidence, intent });
    if (!v.ok) throw new CopyError(422, 'invalid_output', 'Fikir çıktısı doğrulamadan geçmedi.', { role: 'ideas', reasons: v.reasons.slice(0, 12) });
    result = { role: 'ideas', status: v.status, ideas: v.ideas, missingInfo: v.missingInfo, blockReason: null, budget: prompt.budget, meta };
  } else if (req.role === 'caption') {
    const s = validateCaptionStructure(res.parsed, { evidence, mode: voice.mode });
    if (!s.ok) throw new CopyError(422, 'invalid_output', 'Caption çıktısı doğrulamadan geçmedi.', { role: 'caption', reasons: s.reasons.slice(0, 12) });
    const cr = contentRejects(s.out.caption, s.out.observation, s.out.rationale, s.out.evidenceBasis, { req, media, voice, avoid: req.recent?.texts ?? [] });
    if (cr.length) throw new CopyError(422, 'invalid_output', 'Caption kural denetiminden geçmedi.', { role: 'caption', reasons: cr.slice(0, 12) });
    const warnings: string[] = voice.mode === 'tone' ? ['gecici_ton_taslak'] : [];
    result = { role: 'caption', caption: { text: s.out.caption, contentHash: copyContentHash(req.mediaId, 'caption', { caption: s.out.caption }), evidenceBasis: s.out.evidenceBasis, observation: s.out.observation, rationale: s.out.rationale, sourceMap: s.out.sourceMap, warnings }, budget: prompt.budget, meta };
  } else {
    const v = validateCheckOutput(res.parsed, { evidence });
    if (!v.ok) throw new CopyError(422, 'invalid_output', 'Kontrol çıktısı doğrulamadan geçmedi.', { role: 'check', reasons: v.reasons.slice(0, 12) });
    // Kod denetimi AYRICA ve bağımsız çalışır: model "uygun" dese de kural ihlali varsa sonuç uygun olamaz
    const codeReasons = contentRejects(req.caption.text, 'denetim gözlemi', 'denetim gerekçesi', 'katalog_gozlem', { req, media, voice, avoid: req.recent?.texts ?? [] });
    const merged = mergeCheck(v, codeReasons, { humanEdited: req.caption.humanEdited, locked: req.caption.locked });
    result = { role: 'check', captionHash: captionHash(req.caption.text), ...merged, codeReasons, budget: prompt.budget, meta };
  }

  // Yalnız DOĞRULANMIŞ başarı önbelleğe yazılır
  // Firestore varsayılan olarak undefined alanı REDDEDER: yük JSON turundan geçirilir (undefined alanlar tamamen çıkar)
  await db.collection(CREATIVE_CACHE).doc(creativeCacheDocId(key)).set(plain({
    key, claimOwner: token, tenantId: p.tenantId, projectId: p.projectId, uid: p.uid, role: req.role, mediaId: req.mediaId, parts, result, createdAt: now(),
  }));
  return { ...base, ...result, cached: false } as CreativeResponse;
  }
}

type ClaimWho = { tenantId: string; projectId: string; uid: string; role: CreativeRole };
/** undefined/NaN alanları çıkarır: Firestore yazılabilir düz JSON */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Talebi alır (true) veya başka istek uçuştaysa null. Süresi dolmuş talep devralınır (çökme/zaman aşımı sonrası). Transaction: iki eşzamanlı istek AYNI talebi alamaz. */
async function acquireClaim(db: Db, key: string, w: ClaimWho & { token: string; now: number }): Promise<true | null> {
  const ref = db.collection(CREATIVE_CLAIMS).doc(key);
  return db.runTransaction(async (tx: any) => {
    const s = await tx.get(ref);
    const d = s.exists ? s.data() : null;
    if (d && d.owner !== w.token && typeof d.expiresAt === 'number' && d.expiresAt > w.now) return null;
    tx.set(ref, plain({ key, tenantId: w.tenantId, projectId: w.projectId, uid: w.uid, role: w.role, owner: w.token, createdAt: w.now, expiresAt: w.now + CLAIM_TTL_MS }));
    return true;
  });
}
async function releaseClaim(db: Db, key: string, token: string): Promise<void> {
  const ref = db.collection(CREATIVE_CLAIMS).doc(key);
  try {
    await db.runTransaction(async (tx: any) => {
      const s = await tx.get(ref);
      if (s.exists && s.data().owner === token) tx.delete(ref);
    });
  } catch {
    // Bırakma başarısız olsa bile talep süresi dolunca kendiliğinden serbest kalır; sonucu etkilemez
  }
}
/**
 * Başka isteğin uçuştaki çağrısını bekler. Sonuç yazılırsa onu döndürür (sağlayıcı ÇAĞRILMAZ). Talep sonuçsuz kalkarsa (sahibi hata aldı)
 * yeni ücretli çağrı AÇILMAZ: açık 409 (yeniden deneme kullanıcının ayrı eylemidir). Talep süresi dolarsa (sahibi öldü) devralınır.
 */
async function awaitInFlight(
  db: Db, key: string,
  a: { read: () => Promise<CreativeResponse | null>; deps: CreativeDeps; token: string; claimArgs: ClaimWho }
): Promise<{ kind: 'result'; result: CreativeResponse } | { kind: 'took_over' }> {
  const now = a.deps.now ?? Date.now;
  const waitMs = a.deps.waitMs ?? WAIT_MS;
  const pollMs = a.deps.pollMs ?? POLL_MS;
  const started = Date.now();
  for (;;) {
    const hit = await a.read();
    if (hit) return { kind: 'result', result: hit };
    const c = await db.collection(CREATIVE_CLAIMS).doc(key).get();
    if (!c.exists) {
      // Sahip talebi bıraktı: sonuç yazıldıysa (yazma → bırakma sırası) onu al, yoksa sahibi başarısız oldu
      const late = await a.read();
      if (late) return { kind: 'result', result: late };
      throw new CopyError(409, 'in_flight_failed', 'Aynı istek başka bir çağrıda başarısız oldu; yeniden deneme AYRI, açık bir eylemdir (otomatik yeniden deneme yok).', { reason: 'owner_failed' });
    }
    if (typeof c.data().expiresAt === 'number' && c.data().expiresAt <= now()) {
      const took = await acquireClaim(db, key, { ...a.claimArgs, token: a.token, now: now() });
      if (took) return { kind: 'took_over' };
    }
    if (Date.now() - started >= waitMs) throw new CopyError(409, 'in_progress', 'Aynı istek hâlâ çalışıyor; sonucu bekleyin, ikinci çağrı açılmadı.', { reason: 'in_flight' });
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

/** validateCopyOutput'u (dil, yasak kalıp, kanıtsız içerik, tekrar) tek-slot Post caption'ına uygular; yalnız İÇERİK ret nedenlerini döndürür */
function contentRejects(
  caption: string, observation: string, rationale: string, basis: 'dogrulanmis_urun' | 'katalog_gozlem' | 'marka_rehberi',
  c: { req: CreativeRequest; media: Map<string, import('../../../shared/planner/copyContract.js').CopyMedia>; voice: ResolvedVoice; avoid: string[] }
): string[] {
  const creq: CopyRequest = { projectId: c.req.projectId, weekStart: '2000-01-01', items: [{ slotKey: 'feed:0', mediaId: c.req.mediaId, lane: 'feed', role: 'caption', crop: c.req.crop }], avoidTexts: c.avoid.slice(0, 40) };
  const v = validateCopyOutput(
    { items: [{ slotKey: 'feed:0', caption, headline: null, body: null, evidenceBasis: basis, observation, rationale }], notes: [] },
    creq,
    { media: c.media, bundle: c.voice.bundle, avoidTexts: creq.avoidTexts, mode: c.voice.mode, guideFacts: c.voice.mode === 'guide' ? c.voice.guide.facts : undefined }
  );
  return (v.rejected[0]?.reasons ?? []).filter((r) => !/^(observation_|rationale_|evidenceBasis_)/.test(r));
}
export type { BudgetReport };
export { evidenceAllowedText };
