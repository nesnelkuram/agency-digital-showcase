import { useEffect, useMemo, useRef, useState } from 'react';
import type { Candidate } from '../types';
import { cropRect } from '../crop';
import { CropEvalCache, cropVisibility } from '../../../shared/planner/visualDecision';
import { TONE_KEYS, MAX_TONE_PROMPT, type TempTone, type ToneLabel } from '../../../shared/planner/copyContract';
import type { CaptionResponse, CheckResponse, CreativeRequest, CreativeRole, IdeasResponse } from '../../../shared/planner/creativeContract';
import { reviewPorts, type PlannerPorts } from '../ports';
import { defaultFocusOf } from '../compositionFit';
import { CroppedImage } from '../review/CroppedImage';
import { ImageSrcContext, PlannerImg } from '../review/imageSource';
import { measureImageCrop } from '../review/loadPixels';
import {
  MAX_POSTS, POST_FORMAT, POST_RATIO, POST_SIZE, addPosts, applyTexts, arrangePlan, capacityOf, cropVersionOf, deletePost, effectiveCrop, eligiblePool, emptyPostPlan, evaluatePlan,
  movePost, planPosts, replacePost, resolveDelete, setAssetLock, setCrop, setManualText, setPositionLock, undoLast, visualPlanSig,
  type Conflict, type ConflictOption, type CropEdit, type LayoutCell, type OpResult, type Post, type PostEnv, type PostPlan,
} from './postPlan';
import { chronology, gridShape, planShape, profileAfterStep, snapshotInfo, sortHistory } from './postViews';
import { CropMeasurer, postWindow, type MeasureCropFn } from './cropMeasure';
import CreativePanel from './CreativePanel';
import type { PostDraft, PostDraftStore } from './draftStore';
import './postPlanner.css';
import {
  STALE_LABEL, acceptCaption, acceptCheck, acceptIdeas, adoptParked, bindingSig, canRun, captionDraftOf, captionStatus, checkStatus, discardParked, editSelection, emptyEntry, failureOf,
  ideasStatus, intentOf, markEvidenceChanged, parkStaleSelection, pushHistory, recentOf, selectedIdeaOf, selectIdea, selectionStatus, setIntent, sourceVersionOf, textHash,
  type Binding, type Entry, type Failure, type StaleReason,
} from './creativeState';

export interface PostPlannerProps {
  /** Aday havuzu (marka dışı/yayımlanmış adaylar sert kısıtla elenir) */
  candidates: Candidate[];
  /** Mevcut yayınlar: GEÇMİŞ SNAPSHOT (canlı değil). Profil görünümüne ve komşuluk değerlendirmesine girer. */
  published?: Candidate[];
  historySource?: string;
  ports?: PlannerPorts;
  projectId: string;
  tenantId?: string;
  /** Sunucuda doğrulanmış yetkili kullanıcı: aynı tenant+proje içinde kullanıcı değişirse plan, yaratıcı durum ve insan metni SIFIRLANIR */
  userId?: string;
  weekStart?: string;
  /** guideVersion/bundle: UI'ye zaten gelen BİLİNEN onaylı marka dili sürümü (canlı abonelik değil); değişirse yaratıcı aşamalar eski olur, insan metni korunur */
  voice?: { approved: boolean | null; guideVersion?: string | number | null; bundle?: boolean };
  onStartGuide?: () => void;
  /** Studio oturum belleği: ayarlara gidip dönünce plan + yaratıcı durum + insan metni korunur (yenileme/kapanışta kaybolur) */
  draftStore?: PostDraftStore;
  /** Görsel analizi (AI): konu açıklaması + kompozisyon kararı. Yoksa analiz düğmeleri gösterilmez. `run` tek görsel için 1 model çağrısıdır; `refresh` envanteri sessizce yeniler. */
  analysis?: { run: (assetId: string) => Promise<{ ok: true } | { ok: false; message: string; fatal?: boolean }>; refresh: () => Promise<void> };
  /** Nihai kırpım görünümünün piksel ölçümü (test için enjekte edilir) */
  measureCrop?: MeasureCropFn;
  /** Başlangıç sayısı */
  initialCount?: number;
}

const DEFAULT_PORTS = reviewPorts();
const TONE_LABEL_TR: Record<ToneLabel, string> = { enerjik: 'Enerjik', zarif: 'Zarif', lüks: 'Lüks', samimi: 'Samimi', minimal: 'Minimal', eğlenceli: 'Eğlenceli' };
const FACT_LABEL = { tam: 'tam kare görünür', 'yalnız_konu': 'yalnız ana konu', yok: 'görünür olgu yok' } as const;
/** Metne esas ANLAMSAL kanıt (konu/nesne açıklaması) veya kırpım doğrulaması için kompozisyon kararı yoksa analiz gerekir. Kompozisyon/kadraj tarifi caption kanıtı DEĞİLDİR (sunucu yalnız katalog gözleminden yazar). */
const needsAnalysis = (c: Candidate | undefined) => !!c && (!c.visual || !(c.note ?? '').trim());
const todayIso = () => new Date().toISOString().slice(0, 10);

type MiniCell = Pick<LayoutCell, 'idx' | 'assetId' | 'assetLock' | 'posLock' | 'kind'> & { id?: string | null; note?: string; crop?: CropEdit | null };
/**
 * Küçük düzen önizlemesi. Plan hücreleri SON 4:5 kırpımla (o anlık görüntünün KENDİ kırpımıyla) çizilir; mevcut yayın (snapshot) hücreleri
 * olduğu gibi gösterilir — eski snapshot'ın kırpımı bugünkü kırpıma çevrilmez.
 */
function MiniGrid({ cells, byId, testId, label }: { cells: MiniCell[]; byId: Map<string, Candidate>; testId: string; label: string }) {
  return (
    <div className="minigrid" data-testid={testId} role="list" aria-label={label}>
      {cells.map((c) => {
        const cand = byId.get(c.assetId);
        return (
          <div key={`${c.kind}-${c.idx}-${c.assetId}`} role="listitem" className={`minicell ${c.kind === 'history' ? 'snap' : ''} ${c.posLock ? 'lockpos' : c.assetLock ? 'lockasset' : ''}`} data-asset={c.assetId} data-kind={c.kind} data-idx={c.idx} title={`${c.assetId}${c.note ? ` · ${c.note}` : ''}`}>
            {cand ? (
              c.kind === 'plan' ? <CroppedImage c={cand} format={POST_FORMAT} focus={c.crop?.focus ?? defaultFocusOf(cand)} zoom={c.crop?.zoom ?? 1} /> : <PlannerImg c={cand} />
            ) : <span className="imgph" />}
            <span className="tag">{c.id ?? c.assetId}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Kapsam (tenant+proje) anahtarlı sarmalayıcı: kapsam değişince iç bileşen TAMAMEN yeniden kurulur (plan, bekleyen istek, ölçüm, önbellek,
 * onay, hata/meşgul durumu sıfırlanır). Eski kapsamın geç yanıtları ayrıca iç bileşende `alive` + istek anlık görüntüsü ile reddedilir.
 */
export default function PostPlanner(props: PostPlannerProps) {
  return <PostPlannerInner key={`${props.tenantId ?? ''}|${props.projectId}|${props.userId ?? ''}`} {...props} />;
}

function PostPlannerInner({
  candidates, published = [], historySource, ports = DEFAULT_PORTS, projectId, tenantId, userId, weekStart = '', voice = { approved: null }, onStartGuide, draftStore, analysis, measureCrop = measureImageCrop, initialCount = 9,
}: PostPlannerProps) {
  const scopeKey = `${tenantId ?? ''}|${projectId}|${userId ?? ''}`;
  /** Aynı kapsamın bellekteki taslağı (yalnız ilk kurulumda okunur; başka kapsamın taslağı okunmaz) */
  const restored = useRef<PostDraft | undefined>(draftStore?.get(scopeKey)).current;
  const [restoredNote, setRestoredNote] = useState(!!restored && restored.plan.posts.length > 0);
  const [plan, setPlanState] = useState<PostPlan>(() => restored?.plan ?? emptyPostPlan());
  const planRef = useRef(plan);
  const setPlan = (p: PostPlan) => { planRef.current = p; setPlanState(p); };
  const [count, setCount] = useState(restored?.count ?? String(initialCount));
  const [sel, setSel] = useState<string | null>(restored?.sel ?? null);
  /** "Görsel planı tamamladım" onayı GÖRSEL plan imzasına bağlıdır: görsel/sıra/kırpım değişince geçersizleşir */
  const [doneSig, setDoneSig] = useState<string | null>(restored?.doneSig ?? null);
  const doneRef = useRef<string | null>(doneSig);
  doneRef.current = doneSig;
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [msgs, setMsgs] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    const acs = aborters.current;
    return () => {
      aliveRef.current = false;
      acs.forEach((ac) => ac.abort()); // kapsam/sekme kapanırken uçuştaki istekler iptal; yanıtları zaten yok sayılır
      // Ayarlara gidilirken yarıda kalan üretim iptal edilir: taslağa işlenir, dönünce dürüstçe söylenir
      const cur = draftStore?.get(scopeKey);
      const cut = Object.keys(runningRef.current);
      if (draftStore && cur && (cut.length || batchRef.current.running)) draftStore.set(scopeKey, { ...cur, interrupted: cut.length ? cut : ['toplu işlem'] });
    };
  }, []);
  const [tone, setTone] = useState<TempTone>(restored?.tone ?? {});
  const toneRef = useRef(tone);
  toneRef.current = tone;
  const [step, setStep] = useState<number | null>(null);
  const [draftText, setDraftText] = useState('');

  const measurer = useMemo(() => new CropMeasurer(measureCrop, ports.imageSrc, () => setTick((t) => t + 1), 3, scopeKey), [measureCrop, ports.imageSrc, scopeKey]);
  useEffect(() => {
    measurer.revive();
    return () => measurer.dispose();
  }, [measurer]);
  const cache = useMemo(() => new CropEvalCache({ tenantId, projectId }), [tenantId, projectId]);

  const pool = useMemo(() => candidates.filter((c) => !c.published && c.brand === projectId), [candidates, projectId]);
  const history = useMemo(() => sortHistory(published.filter((c) => c.brand === projectId)), [published, projectId]);

  // Nihai 4:5 kırpım görünümünü ölç (orijinal ölçümü kopyalanmaz). Kırpım değişince yalnız o varlık yeniden ölçülür.
  useEffect(() => {
    for (const c of pool) measurer.request(c, postWindow(plan, c));
    for (const h of history) measurer.request(h, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, history, plan.crops, measurer]);

  const byId = useMemo(() => {
    const m = new Map<string, Candidate>();
    for (const c of pool) m.set(c.id, { ...c, aesthetics: measurer.get(c, postWindow(plan, c)) ?? undefined });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, plan.crops, tick, measurer]);
  const historyM = useMemo(() => history.map((h) => ({ ...h, aesthetics: measurer.get(h, null) ?? undefined })), [history, tick, measurer]);
  const histById = useMemo(() => new Map(historyM.map((h) => [h.id, h])), [historyM]);
  const allById = useMemo(() => new Map<string, Candidate>([...histById, ...byId]), [byId, histById]);
  const env = useMemo<PostEnv>(() => ({ brand: projectId, byId, history: historyM, cache }), [projectId, byId, historyM, cache]);
  const envRef = useRef(env);
  envRef.current = env;

  const measured = pool.filter((c) => measurer.get(c, postWindow(plan, c)) !== undefined).length + history.filter((h) => measurer.get(h, null) !== undefined).length;
  const toMeasure = pool.length + history.length;
  const ready = measured >= toMeasure;

  const evaluation = useMemo(() => (plan.posts.length ? evaluatePlan(plan, env) : null), [plan, env]);
  const cap = useMemo(() => capacityOf(plan, env), [plan, env]);
  const eligibleNow = useMemo(() => eligiblePool(plan, env, new Set(plan.posts.map((p) => p.assetId))).length, [plan, env]);
  const snap = useMemo(() => snapshotInfo(historyM, historySource), [historyM, historySource]);
  const shape = planShape(plan);
  const n = plan.posts.length;
  const stepNow = step === null ? n : Math.min(step, n);

  const apply = (r: OpResult) => {
    setPlan(r.plan);
    setMsgs(r.message ? [r.message] : []);
    setConflict(r.conflict ?? null);
  };
  const op = (fn: (p: PostPlan, e: PostEnv) => OpResult) => apply(fn(planRef.current, envRef.current));

  const requested = Math.max(1, Math.min(MAX_POSTS, Math.floor(Number(count) || 0)));
  const onPlan = () => {
    setStep(null);
    op((p, e) => planPosts(p.posts.length ? p : null, requested, e));
  };
  const resolve = (option: ConflictOption) => {
    if (!conflict) return;
    const r = resolveDelete(planRef.current, conflict, option, envRef.current);
    setPlan(r.plan);
    setMsgs(r.message ? [r.message] : []);
    setConflict(null);
  };

  // ── Aşama 3: yaratıcı roller (fikir → SEÇİM → caption → bağımsız kontrol). Her rol AYRI, açık kullanıcı eylemidir; planlama/düzenleme model çağırmaz. ──
  const [entries, setEntriesState] = useState<Record<string, Entry>>(restored?.entries ?? {});
  const entriesRef = useRef(entries);
  const putEntry = (e: Entry) => { const m = { ...entriesRef.current, [e.postId]: e }; entriesRef.current = m; setEntriesState(m); };
  const getEntry = (id: string) => entriesRef.current[id] ?? emptyEntry(id);
  const [running, setRunning] = useState<Record<string, { role: CreativeRole; token: number; sig: string; failSig: string }>>({});
  const runningRef = useRef(running);
  const setRunningFor = (id: string, v: { role: CreativeRole; token: number; sig: string; failSig: string } | null) => {
    const m = { ...runningRef.current };
    if (v) m[id] = v; else delete m[id];
    runningRef.current = m;
    setRunning(m);
  };
  const [failures, setFailures] = useState<Record<string, Partial<Record<CreativeRole, { f: Failure; sig: string }>>>>({});
  const setFailure = (id: string, role: CreativeRole, v: { f: Failure; sig: string } | null) =>
    setFailures((m) => { const cur = { ...(m[id] ?? {}) }; if (v) cur[role] = v; else delete cur[role]; return { ...m, [id]: cur }; });
  const aborters = useRef(new Map<string, AbortController>());
  const tokenRef = useRef(0);
  const [overwrite, setOverwrite] = useState<Record<string, boolean>>({});
  const overwriteRef = useRef(overwrite);
  overwriteRef.current = overwrite;
  const voiceSigRef = useRef('');
  voiceSigRef.current = voice.approved === true ? `onaylı:g${voice.guideVersion ?? ''}:b${voice.bundle ? 1 : 0}` : `ton:${tone.label ?? ''}|${(tone.prompt ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TONE_PROMPT)}`;
  const allByIdRef = useRef(allById);
  allByIdRef.current = allById;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const cleanTone = (): TempTone | null => {
    const t = toneRef.current;
    const prompt = t.prompt?.replace(/\s+/g, ' ').trim().slice(0, MAX_TONE_PROMPT);
    if (!t.label && !prompt) return null;
    return { ...(t.label ? { label: t.label } : {}), ...(prompt ? { prompt } : {}) };
  };
  /** Postun O ANKİ bağlamı: varlık + kırpım sürümü + kaynak/analiz sürümü. Yaratıcı aşamalar buna bağlıdır. */
  const bindingOf = (pl: PostPlan, p: Post): Binding | null => {
    const c = allByIdRef.current.get(p.assetId);
    return c ? { assetId: p.assetId, cropVersion: cropVersionOf(pl, p.assetId), sourceVersion: sourceVersionOf(c), voiceSig: voiceSigRef.current } : null;
  };
  /** Hata/meşgul kaydının bağlı olduğu rol bağlamı: niyet sürümü (fikir) / seçim sürümü (caption) / seçim+metin (kontrol). Değişirse eski hata gösterilmez. */
  const roleCtx = (role: CreativeRole, e: Entry, text: Post['text']) => (role === 'ideas' ? `i${e.intent.rev}` : role === 'caption' ? `s${e.selection?.rev ?? -1}` : `s${e.selection?.rev ?? -1}|${text ? textHash(text.text) : ''}`);

  /** Son rol çağrısının hatası (toplu üretim akışı sonucu okur); her çağrı başında sıfırlanır */
  const lastFailRef = useRef<Failure | null>(null);
  const runRole = async (postId: string, role: CreativeRole, refresh = false) => {
    lastFailRef.current = null;
    const pl = planRef.current;
    const post = pl.posts.find((p) => p.id === postId);
    const cand = post ? allByIdRef.current.get(post.assetId) : undefined;
    const cur = post ? bindingOf(pl, post) : null;
    if (!post || !cand || !cur) return;
    const sigNow = bindingSig(cur);
    const failSig = `${sigNow}#${roleCtx(role, getEntry(postId), post.text)}`;
    const fail = (f: Failure) => { lastFailRef.current = f; setFailure(postId, role, { f, sig: failSig }); };
    if (runningRef.current[postId]) return; // post başına aynı anda TEK rol
    if (doneRef.current === null || doneRef.current !== visualPlanSig(pl)) return fail({ kind: 'engellendi', message: 'Görsel plan onaylanmadı veya onaydan sonra değişti; yaratıcı roller başlatılmadı.' });
    if (!ports.creative.available) return fail({ kind: 'kapalı', message: ports.creative.unavailableReason ?? 'Yaratıcı roller bağlı değil.' });
    const entry = getEntry(postId);
    // MODEL ÇAĞRISINDAN ÖNCE sürüm/seçim/kilit/insan-metni koruması (sunucu ayrıca doğrular)
    const block = canRun(role, entry, cur, { text: post.text, locked: post.assetLock || post.posLock, overwriteHuman: !!overwriteRef.current[postId], ready: readyRef.current, refresh });
    if (!block.ok) return fail({ kind: 'engellendi', message: block.why });
    const e = effectiveCrop(pl, cand);
    const recent = recentOf(pl.posts.map((p) => ({ postId: p.id, entry: entriesRef.current[p.id], text: p.text, binding: bindingOf(pl, p) ?? cur })), postId);
    const tone = voice.approved === true ? null : cleanTone();
    const intent = intentOf(entry);
    const common = { projectId, mediaId: post.assetId, crop: { focus: e.focus, zoom: e.zoom, version: cur.cropVersion }, ...(intent ? { intent } : {}), ...(tone ? { tempTone: tone } : {}), recent, ...(refresh ? { refresh: true } : {}) };
    let req: CreativeRequest;
    if (role === 'ideas') req = { role: 'ideas', ...common };
    else {
      const sel = entry.selection!;
      req = role === 'caption'
        ? { role: 'caption', ...common, idea: selectedIdeaOf(sel), evidenceDigest: sel.evidenceDigest }
        : { role: 'check', ...common, idea: selectedIdeaOf(sel), evidenceDigest: sel.evidenceDigest, caption: captionDraftOf(entry, post.text!, post.assetLock || post.posLock) };
    }
    const snap = { binding: cur, intentRev: entry.intent.rev, selectionRev: entry.selection?.rev ?? -1, captionHash: post.text ? textHash(post.text.text) : '', postVersion: post.version };
    const token = ++tokenRef.current;
    const ac = new AbortController();
    aborters.current.set(postId, ac);
    setRunningFor(postId, { role, token, sig: sigNow, failSig });
    setFailure(postId, role, null);
    const live = () => aliveRef.current && runningRef.current[postId]?.token === token; // iptal edilmedi, kapsam değişmedi
    try {
      const resp = await ports.creative.run(req, { signal: ac.signal });
      if (!live()) return;
      const nowPlan = planRef.current;
      const nowPost = nowPlan.posts.find((p) => p.id === postId);
      const nowCur = nowPost ? bindingOf(nowPlan, nowPost) : null;
      if (!nowPost || !nowCur) return void setMsgs(['Post beklerken silindi; gelen yanıt yok sayıldı.']);
      if (!resp || resp.role !== role) return fail({ kind: 'geçersiz_çıktı', message: 'Yanıt beklenen role ait değil; kabul edilmedi.' });
      const ent = getEntry(postId);
      if (role === 'ideas') {
        const r = acceptIdeas(ent, resp as IdeasResponse, { binding: snap.binding, intentRev: snap.intentRev }, nowCur);
        if (!r.ok) return void setMsgs([r.why]);
        putEntry(parkStaleSelection(r.entry, nowCur)); // eski, insan düzenlemeli seçim SESSİZCE ezilmez: korunur
      } else if (role === 'caption') {
        const cr = resp as CaptionResponse;
        const r = acceptCaption(ent, cr, { binding: snap.binding, selectionRev: snap.selectionRev }, nowCur, { text: nowPost.text });
        if (!r.ok) return void setMsgs([r.why]);
        const res = applyTexts(nowPlan, [{
          postId, expected: { version: snap.postVersion, assetId: snap.binding.assetId, cropVersion: snap.binding.cropVersion },
          text: {
            text: cr.caption.text, source: 'model', responseId: cr.meta?.responseId ?? undefined, contentHash: cr.caption.contentHash, evidenceBasis: cr.caption.evidenceBasis, voiceSource: cr.voice.source, promptVersion: cr.meta?.promptVersion,
            observation: cr.caption.observation, rationale: cr.caption.rationale, facts: cr.evidence.visibility.facts, sourceVersion: snap.binding.sourceVersion, voiceSig: snap.binding.voiceSig,
            ...(cr.voice.source === 'temporary_tone' ? { assumptions: cr.voice.assumptions } : {}),
          },
        }]);
        if (!res.applied.length) return void setMsgs([`Post beklerken değişti, gelen caption yok sayıldı: ${res.stale.map((x) => `${x.postId} (${x.why})`).join(', ')}.`]);
        setPlan(res.plan);
        putEntry(r.entry);
      } else {
        const r = acceptCheck(ent, resp as CheckResponse, { binding: snap.binding, selectionRev: snap.selectionRev, captionHash: snap.captionHash }, nowCur, nowPost.text);
        if (!r.ok) return void setMsgs([r.why]);
        putEntry(r.entry);
      }
    } catch (err) {
      if (!live()) return;
      const f = failureOf(err);
      const nowPost = planRef.current.posts.find((p) => p.id === postId);
      const nowCur = nowPost ? bindingOf(planRef.current, nowPost) : null;
      // Eski hata yeni bağlamda/kapsamda GÖSTERİLMEZ
      if (!nowCur || `${bindingSig(nowCur)}#${roleCtx(role, getEntry(postId), nowPost?.text ?? null)}` !== failSig) return;
      if (f.kind === 'eski_kanıt') putEntry(markEvidenceChanged(getEntry(postId)));
      fail(f);
    } finally {
      if (runningRef.current[postId]?.token === token) setRunningFor(postId, null);
      if (aborters.current.get(postId) === ac) aborters.current.delete(postId);
    }
  };
  const cancelRole = (postId: string) => {
    const r = runningRef.current[postId];
    if (!r) return;
    aborters.current.get(postId)?.abort();
    aborters.current.delete(postId);
    setRunningFor(postId, null); // belirteç geçersiz: gelecek yanıt (başarı/hata) yok sayılır
    setFailure(postId, r.role, { f: { kind: 'iptal', message: 'İptal edildi. Sağlayıcıda tamamlanmış olabilir ama yanıt yok sayıldı; kısmi sonuç kabul edilmedi.' }, sig: r.failSig });
  };
  // ── "Metin üret": TEK açık kullanıcı eylemi. Önce eksik ANLAMSAL görsel analizini (mevcut analiz fonksiyonuyla) tamamlar, sonra her post için üç fikri hazırlar.
  // Fikir SEÇİMİ her zaman insandır: sessiz varsayılan seçim YOK. Caption, seçtiğiniz fikirle AYRI açık eylemle yazılır. Hazır/güncel analiz ve fikirler yeniden çağrılmaz;
  // elle yazılmış metin ve seçtiğiniz fikir korunur; eksikler sessizce atlanmaz, kısmi iş "tamamlandı" diye sunulmaz.
  type BatchRow = { postId: string; outcome: 'hazır' | 'atlandı' | 'hata'; note: string };
  type Batch = { kind: 'metin' | 'caption'; phase: 'confirm' | 'run' | 'done'; stage: 'analiz' | 'fikir' | 'caption'; total: number; index: number; cur: string | null; rows: BatchRow[]; halted?: string; counts: { analysis: number; ideas: number; captions: number } };
  const [batch, setBatch] = useState<Batch | null>(null);
  const batchRef = useRef({ cancel: false, running: false });
  const postNow = (id: string) => planRef.current.posts.find((p) => p.id === id);
  const bindNow = (id: string) => { const p = postNow(id); return p ? bindingOf(planRef.current, p) : null; };
  const selectionReady = (id: string) => { const b = bindNow(id); return !!b && selectionStatus(getEntry(id), b) === 'geçerli'; };
  const ideasReady = (id: string) => { const b = bindNow(id); const e = getEntry(id); return !!b && !!e.ideas && ideasStatus(e, b) === 'geçerli'; };
  const approvePlan = () => { const sig = visualPlanSig(planRef.current); doneRef.current = sig; setDoneSig(sig); };
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const MEASURE_WAIT_MS = 30_000; // yeni kırpım ölçümü için ÜST SINIR (takılı kalma yok; aşılırsa görünür hata)
  const SEMANTIC_WAIT_MS = 2_000; // analiz sonrası yenilenen anlamsal veri için üst sınır
  const srcOf = (asset: string) => allByIdRef.current.get(asset)?.visual?.provenance.sourceSha256 ?? null;
  /**
   * Uzun işlemin BAŞLANGIÇ anındaki bağlam: görsel plan imzası + kaynak piksel özetleri. İşlem sürerken iptal / kapsam / plan (görsel, sıra, kırpım) / kaynak
   * değişirse `guard()` neden döndürür: işlem durur ve onay YENİ plana/kaynağa TAŞINMAZ (onay geri alınır).
   */
  const startGuard = (assetIds: string[]) => {
    const sig0 = visualPlanSig(planRef.current);
    const src0 = new Map(assetIds.map((a) => [a, srcOf(a)] as const));
    return (): { why: string; revoke: boolean } | null => {
      if (batchRef.current.cancel) return { why: 'Durduruldu.', revoke: false };
      if (!aliveRef.current) return { why: 'Sekme veya kapsam kapandı.', revoke: false };
      if (visualPlanSig(planRef.current) !== sig0) return { why: 'Görsel plan (görsel / sıra / kırpım) işlem sürerken değişti; onay yeni plana taşınmadı. “Metin üret”e yeniden basın.', revoke: true };
      for (const [a, s0] of src0) { const s1 = srcOf(a); if (s0 !== null && s1 !== null && s0 !== s1) return { why: `Görselin kaynağı (${a}) işlem sürerken değişti; onay yeni kaynağa taşınmadı. “Metin üret”e yeniden basın.`, revoke: true }; }
      return null;
    };
  };
  /** Yeni (yenilenen) görsellerin kırpım ölçümü hazır olana kadar SINIRLI bekler; anlamsal veri `semantic` süresinde gelmezse beklemeyi bırakır (yazım yine de engellenir). */
  const settle = async (assets: string[], guard: ReturnType<typeof startGuard>): Promise<{ stop: { why: string; revoke: boolean } | null; timedOut?: string }> => {
    const t0 = Date.now();
    for (;;) {
      const g = guard();
      if (g) return { stop: g };
      const fresh = assets.every((a) => !needsAnalysis(allByIdRef.current.get(a)));
      if (readyRef.current && (fresh || Date.now() - t0 > SEMANTIC_WAIT_MS)) return { stop: null };
      if (Date.now() - t0 > MEASURE_WAIT_MS) return { stop: null, timedOut: `Kırpım ölçümü ${MEASURE_WAIT_MS / 1000} sn içinde tamamlanmadı; yaratıcı roller başlatılmadı. Bir süre sonra “Metin üret”e yeniden basın.` };
      await sleep(50);
    }
  };
  const analysisNeeded = (ids: string[]) => (analysis ? [...new Set(ids.map((id) => postNow(id)?.assetId).filter((a): a is string => !!a && needsAnalysis(allByIdRef.current.get(a))))] : []);
  const metinTargets = (ids: string[], single: boolean) => ids.filter((id) => { const p = postNow(id); return !!p && (single || p.text?.source !== 'manual'); });
  const captionTargets = () => plan.posts.filter((p) => statusOf(p).selection === 'geçerli' && statusOf(p).caption !== 'geçerli' && p.text?.source !== 'manual').map((p) => p.id);
  const openMetinConfirm = () => {
    const ids = metinTargets(plan.posts.map((p) => p.id).reverse(), false);
    setBatch({ kind: 'metin', phase: 'confirm', stage: 'analiz', total: ids.length, index: 0, cur: null, rows: [], counts: { analysis: analysisNeeded(ids).length, ideas: ids.filter((id) => !selectionReady(id) && !ideasReady(id)).length, captions: 0 } });
  };
  const openCaptionConfirm = () => setBatch({ kind: 'caption', phase: 'confirm', stage: 'caption', total: captionTargets().length, index: 0, cur: null, rows: [], counts: { analysis: 0, ideas: 0, captions: captionTargets().length } });

  const metinUret = async (ids: string[], single = false) => {
    if (batchRef.current.running) return;
    batchRef.current = { cancel: false, running: true };
    const targets = metinTargets(ids, single);
    const guard = startGuard([...new Set(targets.map((id) => postNow(id)?.assetId).filter((a): a is string => !!a))]);
    approvePlan(); // bu tıklama görsel planı BU HALİYLE onaylar (onay kutusuyla aynı imza); plan/kaynak değişirse geri alınır
    const rows: BatchRow[] = ids.filter((i) => !targets.includes(i)).map((postId) => ({ postId, outcome: 'atlandı' as const, note: 'Elle yazılmış metin korunur; bu post için fikir üretilmedi.' }));
    const needAn = analysisNeeded(targets);
    const failedAssets = new Map<string, string>();
    let halted: string | undefined;
    let refreshError: string | undefined;
    const upd = (patch: Partial<Batch>) => setBatch((b) => (b ? { ...b, ...patch } : b));
    const finish = () => { batchRef.current.running = false; if (aliveRef.current) setBatch((b) => (b ? { ...b, phase: 'done', cur: null, rows: [...rows], halted } : b)); };
    /** Koruma tetiklenince: kalan postlar açıkça "atlandı" yazılır, gerekirse onay geri alınır, iş "tamamlandı" sayılmaz */
    const stopWith = (g: { why: string; revoke: boolean }, rest: string[]) => {
      for (const r of rest) rows.push({ postId: r, outcome: 'atlandı', note: g.why });
      halted = g.why;
      if (g.revoke && aliveRef.current) { doneRef.current = null; setDoneSig(null); }
      finish();
    };
    setBatch({ kind: 'metin', phase: 'run', stage: needAn.length ? 'analiz' : 'fikir', total: needAn.length || targets.length, index: 0, cur: null, rows: [...rows], counts: { analysis: needAn.length, ideas: 0, captions: 0 } });
    // 1) Eksik anlamsal analiz (görsel başına 1 çağrı, sırayla; hazır/güncel olan çağrılmaz)
    let analysed = 0;
    for (let i = 0; i < needAn.length; i++) {
      const g = guard();
      if (g) { if (!aliveRef.current) { batchRef.current.running = false; return; } return stopWith(g, targets); }
      upd({ stage: 'analiz', index: i + 1, total: needAn.length, cur: null });
      const r = await analysis!.run(needAn[i]);
      if (r.ok) analysed++;
      else { failedAssets.set(needAn[i], r.message); if (r.fatal) { halted = r.message; break; } }
    }
    if (!aliveRef.current) { batchRef.current.running = false; return; }
    {
      const g = guard();
      if (g) return stopWith(g, targets);
    }
    // 2) Envanteri yenile → yeni kırpım ölçümlerinin hazır olmasını SINIRLI bekle (eski onayla yeni görsele üretim başlatma)
    if (analysed) {
      try { await analysis!.refresh(); } catch (e: any) { refreshError = e?.message ? String(e.message) : 'bilinmeyen hata'; }
      if (!aliveRef.current) { batchRef.current.running = false; return; }
    }
    upd({ stage: 'fikir', index: 0, cur: null });
    const waited = await settle(refreshError ? [] : needAn.filter((a) => !failedAssets.has(a)), guard); // yenileme zaten başarısızsa anlamsal veriyi bekleme: hata hemen görünür
    if (waited.stop) { if (!aliveRef.current) { batchRef.current.running = false; return; } return stopWith(waited.stop, targets); }
    if (waited.timedOut) { halted = waited.timedOut; for (const id of targets) rows.push({ postId: id, outcome: 'hata', note: waited.timedOut }); return finish(); }
    const ready: string[] = [];
    for (const id of targets) {
      const post = postNow(id);
      if (!post) { rows.push({ postId: id, outcome: 'atlandı', note: 'Post silindi.' }); continue; }
      if (analysis && needsAnalysis(allByIdRef.current.get(post.assetId))) {
        rows.push({ postId: id, outcome: 'hata', note: failedAssets.get(post.assetId) ?? (refreshError ? `Analiz tamamlandı ama görsel listesi yenilenemedi: ${refreshError}` : halted) ?? 'Görselde konu bilgisi oluşmadı (analiz sonucu boş).' });
        continue;
      }
      ready.push(id);
    }
    // 3) Fikirler (post başına 1 çağrı; hazır fikir ya da seçili fikir varsa çağrılmaz)
    upd({ total: ready.length, index: 0, rows: [...rows] });
    let streak = 0;
    for (let i = 0; i < ready.length; i++) {
      const g = guard();
      if (g) { if (!aliveRef.current) { batchRef.current.running = false; return; } return stopWith(g, ready.slice(i)); }
      const id = ready[i];
      upd({ index: i + 1, cur: id });
      if (selectionReady(id)) { rows.push({ postId: id, outcome: 'hazır', note: 'Seçtiğiniz fikir korunuyor.' }); streak = 0; continue; }
      const e0 = getEntry(id);
      if (ideasReady(id) && e0.ideas && e0.ideas.status === 'ok' && e0.ideas.ideas.length) { rows.push({ postId: id, outcome: 'hazır', note: 'Fikirler zaten hazır (tekrar çağrılmadı): bir tanesini seçin.' }); streak = 0; continue; }
      const w = await settle([], guard); // ölçüm yeniden sürüyorsa (başka bir değişiklikten) sınırlı bekle
      if (w.stop) { if (!aliveRef.current) { batchRef.current.running = false; return; } return stopWith(w.stop, ready.slice(i)); }
      if (w.timedOut) { halted = w.timedOut; for (const r of ready.slice(i)) rows.push({ postId: r, outcome: 'hata', note: w.timedOut }); return finish(); }
      await runRole(id, 'ideas');
      if (!aliveRef.current) { batchRef.current.running = false; return; }
      const e = getEntry(id);
      const b = bindNow(id);
      if (b && e.ideas && ideasStatus(e, b) === 'geçerli') {
        if (e.ideas.status === 'ok' && e.ideas.ideas.length) rows.push({ postId: id, outcome: 'hazır', note: 'Üç fikir hazır: bir tanesini SİZ seçin.' });
        else rows.push({ postId: id, outcome: 'atlandı', note: `Bilgi yetersiz: ${e.ideas.missingInfo ?? 'görselden yeterli bilgi çıkarılamadı'}` });
        streak = 0;
      } else {
        const f = lastFailRef.current;
        rows.push({ postId: id, outcome: 'hata', note: f?.message ?? 'Yanıt kabul edilmedi (bağlam değişti veya iptal edildi).' });
        streak++;
        if (f?.kind === 'kapalı') { halted = f.message; break; }
        if (streak >= 3) { halted = 'Art arda 3 hata: gereksiz ücret oluşmasın diye durduruldu.'; break; }
      }
      upd({ rows: [...rows] });
    }
    finish();
  };

  /** Seçtiğiniz fikirlerle caption: yalnız İNSAN seçimi olan, geçerli metni olmayan postlar; sırayla, post başına 1 çağrı. */
  const captionSelected = async () => {
    if (batchRef.current.running) return;
    batchRef.current = { cancel: false, running: true };
    approvePlan();
    const ids = captionTargets();
    const rows: BatchRow[] = [];
    let halted: string | undefined;
    let streak = 0;
    const guard = startGuard([...new Set(ids.map((id) => postNow(id)?.assetId).filter((x): x is string => !!x))]);
    setBatch({ kind: 'caption', phase: 'run', stage: 'caption', total: ids.length, index: 0, cur: null, rows: [], counts: { analysis: 0, ideas: 0, captions: ids.length } });
    for (let i = 0; i < ids.length; i++) {
      const g = guard();
      if (g) {
        if (!aliveRef.current) break;
        for (const r of ids.slice(i)) rows.push({ postId: r, outcome: 'atlandı', note: g.why });
        halted = g.why;
        if (g.revoke) { doneRef.current = null; setDoneSig(null); }
        break;
      }
      const id = ids[i];
      setBatch((b) => (b ? { ...b, index: i + 1, cur: id } : b));
      await runRole(id, 'caption');
      if (!aliveRef.current) break;
      const post = postNow(id);
      const b = bindNow(id);
      if (post && b && captionStatus(getEntry(id), post.text, b) === 'geçerli') { rows.push({ postId: id, outcome: 'hazır', note: 'Caption seçtiğiniz fikirle yazıldı (kontrol ayrı adım).' }); streak = 0; }
      else {
        const f = lastFailRef.current;
        rows.push({ postId: id, outcome: 'hata', note: f?.message ?? 'Yanıt kabul edilmedi (bağlam değişti veya iptal edildi).' });
        streak++;
        if (f?.kind === 'kapalı') { halted = f.message; break; }
        if (streak >= 3) { halted = 'Art arda 3 hata: gereksiz ücret oluşmasın diye durduruldu.'; break; }
      }
      setBatch((bb) => (bb ? { ...bb, rows: [...rows] } : bb));
    }
    batchRef.current.running = false;
    if (aliveRef.current) setBatch((bb) => (bb ? { ...bb, phase: 'done', cur: null, rows: [...rows], halted } : bb));
  };
  const startBatch = () => { if (batch?.kind === 'caption') void captionSelected(); else void metinUret(plan.posts.map((p) => p.id).reverse()); };
  const stopBatch = () => {
    batchRef.current.cancel = true;
    const cur = batch?.cur;
    if (cur) cancelRole(cur);
  };
  const withBinding = (postId: string, fn: (e: Entry, cur: Binding) => { ok: true; entry: Entry } | { ok: false; why: string }) => {
    const pl = planRef.current;
    const post = pl.posts.find((p) => p.id === postId);
    const cur = post ? bindingOf(pl, post) : null;
    if (!post || !cur) return;
    const r = fn(getEntry(postId), cur);
    if (r.ok) { putEntry(r.entry); setMsgs([]); } else setMsgs([r.why]);
  };
  const saveManual = (post: Post, text: string) => {
    const pl = planRef.current;
    const cur = bindingOf(pl, post);
    const had = post.text;
    const r = setManualText(pl, post.id, text, post.version, cur ? { sourceVersion: cur.sourceVersion, voiceSig: cur.voiceSig } : undefined);
    apply(r);
    // Üzerine yazılan metin kaybolmaz: geçmişe girer (insan düzenlemesi korunur)
    if (!r.stale && had && had.text !== text.trim()) putEntry(pushHistory(getEntry(post.id), { text: had.text, source: had.source, why: 'elle düzenleme' }));
  };
  const restoreText = (post: Post, idx: number) => {
    const h = getEntry(post.id).textHistory[idx];
    if (h) saveManual(post, h.text);
  };

  const selPost = sel ? plan.posts.find((p) => p.id === sel) ?? null : null;
  const selCand = selPost ? allById.get(selPost.assetId) ?? null : null;
  const selCrop = selPost && selCand ? effectiveCrop(plan, selCand) : null;
  useEffect(() => { setDraftText(selPost?.text?.text ?? ''); }, [selPost?.id, selPost?.text?.text]);

  const done = doneSig !== null && doneSig === visualPlanSig(plan);
  const anyBusy = Object.keys(running).length > 0;
  const bindings = new Map(plan.posts.map((p) => [p.id, bindingOf(plan, p)] as const));
  const selBinding = selPost ? bindings.get(selPost.id) ?? null : null;
  const statusOf = (p: Post) => {
    const b = bindings.get(p.id);
    const e = entries[p.id] ?? emptyEntry(p.id);
    return b ? { ideas: ideasStatus(e, b), selection: selectionStatus(e, b), caption: captionStatus(e, p.text, b), check: checkStatus(e, p.text, b) } : { ideas: 'yok' as const, selection: 'yok' as const, caption: 'yok' as const, check: 'yok' as const };
  };
  const withText = plan.posts.filter((p) => statusOf(p).caption === 'geçerli').length;
  const withIdea = plan.posts.filter((p) => statusOf(p).selection === 'geçerli').length;
  const withCheck = plan.posts.filter((p) => statusOf(p).check === 'geçerli').length;
  const toneOn = (l: ToneLabel) => tone.label === l;
  const profile = profileAfterStep(plan.posts, historyM, stepNow, plan.crops);
  const chrono = chronology(plan.posts, plan.crops);
  const profShape = gridShape(profile.length);
  const last = plan.lastChange;

  // Taslak: plan + yaratıcı durum + insan metni oturum belleğine yazılır (Marka Kiti/ayarlara gidip dönünce korunur).
  useEffect(() => {
    if (!draftStore) return;
    if (plan.posts.length === 0 && Object.keys(entries).length === 0) draftStore.clear(scopeKey);
    else draftStore.set(scopeKey, { plan, entries, tone, count, sel, doneSig, savedAt: Date.now(), interrupted: [] });
  }, [draftStore, scopeKey, plan, entries, tone, count, sel, doneSig]);
  // Yenileme/kapatma gerçek kayıptır: plan varken tarayıcı uyarısı
  const hasPlan = plan.posts.length > 0;
  useEffect(() => {
    if (!hasPlan) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [hasPlan]);

  const metinBusy = batch?.phase === 'run';
  const doneBox = (
    <label className="radio small donebox"><input type="checkbox" checked={done} onChange={(e) => setDoneSig(e.target.checked ? visualPlanSig(planRef.current) : null)} disabled={!n} data-testid="post-visual-done" /> Görsel planı tamamladım</label>
  );
  const planBtn = (
    <button className={n ? '' : 'primary big'} onClick={onPlan} disabled={!ready || anyBusy || metinBusy} data-testid="post-plan-btn" title={ready ? undefined : 'Kırpılmış görünüm ölçümleri tamamlanana kadar kapalı'}>
      {n ? 'Yeniden planla (kilitler korunur)' : 'Yeni post planı oluştur'}
    </button>
  );

  // ── BOŞ YÜZEY: tek birincil eylem ──
  if (n === 0) {
    return (
      <ImageSrcContext.Provider value={ports.imageSrc}>
        <main className="shell post-planner pp-emptyscreen" data-testid="post-planner">
          <section className="pp-hero" aria-label="Post planlayıcı">
            <h1>Post Planlayıcı</h1>
            {planBtn}
            {!ready && <p className="counts" role="status" data-testid="post-measure-progress">Görseller hazırlanıyor ({measured}/{toMeasure}); bitince plan oluşturulabilir.</p>}
            {ready && eligibleNow === 0 && <p className="small" role="status" data-testid="post-empty">Planlanabilir görsel yok. Kütüphaneye uygun fotoğraf ekleyin.</p>}
            {ready && eligibleNow > 0 && <p className="small muted" data-testid="post-empty">{eligibleNow} uygun görsel hazır. Plan oluşturmak model çağırmaz.</p>}
            {msgs.length > 0 && <div className="shortage" role="status" data-testid="post-messages">{msgs.map((m, i) => <p key={i}>{m}</p>)}</div>}
            <div className="feed pp-feed" data-testid="post-grid" hidden aria-hidden="true" />
          </section>
        </main>
      </ImageSrcContext.Provider>
    );
  }

  return (
    <ImageSrcContext.Provider value={ports.imageSrc}>
      <main className="shell post-planner" data-testid="post-planner">
        {restoredNote && (
          <p className="notice small" role="status" data-testid="post-restored-note">
            Planınız ve yazdığınız metinler bu oturumda korundu.{restored && restored.interrupted.length ? ` Ayrılırken yarıda kalan üretim iptal edildi (${restored.interrupted.join(', ')}); gerekirse yeniden başlatın.` : ''} Sayfayı yenilerseniz ya da kapatırsanız kaybolur. <button onClick={() => setRestoredNote(false)} data-testid="post-restored-dismiss">Tamam</button>
          </p>
        )}
        <header className="top pp-top">
          <div>
            <h1>Post Planlayıcı</h1>
            <p className="muted small">Instagram post · {POST_SIZE.w}×{POST_SIZE.h} (4:5) · taslak; canlıya hiçbir şey gönderilmez.</p>
          </div>
          <div className="actions">
            <button className="primary big" onClick={openMetinConfirm} disabled={!ready || !ports.creative.available || anyBusy || metinBusy || batch?.phase === 'confirm'} data-testid="bulk-open" title={ready ? undefined : 'Kırpım ölçümleri bitince açılır'}>Metin üret</button>
          </div>
        </header>
        {!ready && <p className="counts" role="status" data-testid="post-measure-progress">Kırpılmış (4:5) görünümler ölçülüyor ({measured}/{toMeasure}): plan eksik ölçümle kurulmasın diye düğme kapalı.</p>}
        {msgs.length > 0 && <div className="shortage" role="status" data-testid="post-messages">{msgs.map((m, i) => <p key={i}>{m}</p>)}</div>}

        {conflict && (
          <div className="rejectbox" role="dialog" aria-label="Silme çatışması" data-testid="post-conflict">
            <strong>Silme, konum kilidiyle çatışıyor</strong>
            <p className="small">{conflict.reason} Hiçbir şey değişmedi; bir seçenek seçin.</p>
            <div className="previews">
              <div><span className="small muted">Önce</span><MiniGrid cells={conflict.before} byId={allById} testId="conflict-before" label="Silme öncesi düzen" /></div>
              <div><span className="small muted">Kilit kaldırılırsa sonra</span><MiniGrid cells={conflict.afterRelease} byId={allById} testId="conflict-after" label="Seçenek sonrası düzen" /></div>
            </div>
            <div className="actions">
              {conflict.options.map((o) => (
                <button key={o.id} className={o.id === 'cancel' ? '' : 'primary'} data-testid={o.id === 'cancel' ? 'conflict-cancel' : 'conflict-release'} onClick={() => resolve(o.id)}>{o.label}</button>
              ))}
            </div>
          </div>
        )}

        <section className="genbar" aria-label="Yaratıcı metin" data-testid="post-text-panel">
          <div className="genrow">
            <span className="small" data-testid="post-text-summary">{withText}/{n} postta metin var{withIdea || withCheck ? ` · ${withIdea} seçilmiş fikir · ${withCheck} kontrol` : ''}</span>
            {captionTargets().length > 0 && <button onClick={openCaptionConfirm} disabled={!ready || !ports.creative.available || anyBusy || metinBusy || batch?.phase === 'confirm'} data-testid="caption-selected-open">Seçtiğim fikirlerle caption yaz ({captionTargets().length})</button>}
            {doneBox}
            {voice.approved === true ? null : (
              <details className="tonedrop" data-testid="post-tone-panel">
                <summary>Ton: <strong>{tone.label || tone.prompt ? [tone.label ? TONE_LABEL_TR[tone.label] : null, tone.prompt ? 'özel tarif' : null].filter(Boolean).join(' + ') : 'sade (varsayılan)'}</strong></summary>
                <div className="tonebox">
                  <div className="chips" role="group" aria-label="Plan tonu">
                    {TONE_KEYS.map((t) => (
                      <button key={t} className={`chipbtn ${toneOn(t) ? 'on' : ''}`} aria-pressed={toneOn(t)} data-testid={`post-tone-chip-${t}`} onClick={() => setTone((cur) => ({ ...cur, label: cur.label === t ? undefined : t }))}>{TONE_LABEL_TR[t]}</button>
                    ))}
                  </div>
                  <label className="field">Kendi tarifiniz (isteğe bağlı)
                    <input type="text" maxLength={MAX_TONE_PROMPT} value={tone.prompt ?? ''} onChange={(e) => setTone((cur) => ({ ...cur, prompt: e.target.value }))} data-testid="post-tone-prompt" placeholder="ör. mahalle kahvecisi gibi, sade ve rahat" />
                  </label>
                  <p className="small muted" data-testid="post-tone-default-note">Ton seçmezseniz sade, tarafsız bir üslup kullanılır; marka kişiliği varsayılmaz. Bu ton geçicidir, onaylı marka dili değildir.</p>
                  {onStartGuide && <button onClick={onStartGuide} data-testid="post-start-guide">Marka dili ayarları (Marka Kiti)</button>}
                </div>
              </details>
            )}
          </div>
          {doneSig !== null && !done && <p className="small" role="status" data-testid="post-done-stale">Görsel plan (görsel / sıra / kırpım) onaydan sonra değişti: yaratıcı adımlar için yeniden onaylayın ya da “Metin üret”e basın.</p>}
          {batch?.phase === 'confirm' && (
            <div className="bulkconfirm" role="dialog" aria-label="Metin üretimi onayı" data-testid="bulk-confirm">
              {batch.kind === 'metin' ? (
                <p className="small">
                  <strong>{n} post</strong> için sırayla: {batch.counts.analysis > 0 ? <><strong>{batch.counts.analysis} görselin analizi eksik, önce o yapılır</strong>, sonra </> : ''}her post için <strong>üç fikir hazırlanır</strong> (yaklaşık <strong>{batch.counts.analysis + batch.counts.ideas} model çağrısı</strong>). <strong>Fikri siz seçersiniz</strong>; caption seçtiğiniz fikirle yazılır. Hazır analiz/fikirler tekrar çağrılmaz; elle yazdığınız metinler korunur. Başlatınca görsel plan bu haliyle onaylanır.
                </p>
              ) : (
                <p className="small">Seçtiğiniz fikirlerle <strong>{batch.counts.captions} caption</strong> yazılır (yaklaşık {batch.counts.captions} model çağrısı). Fikri siz seçmiştiniz; elle yazılmış metinler korunur.</p>
              )}
              <div className="actions">
                <button className="primary" onClick={startBatch} data-testid="bulk-start">Başlat</button>
                <button onClick={() => setBatch(null)} data-testid="bulk-cancel-confirm">Vazgeç</button>
              </div>
            </div>
          )}
          {batch?.phase === 'run' && (
            <p className="small" role="status" data-testid="bulk-progress">
              {batch.stage === 'analiz' ? 'Görseller analiz ediliyor' : batch.stage === 'fikir' ? 'Fikirler hazırlanıyor' : 'Caption yazılıyor'}: {batch.index}/{batch.total}{batch.cur ? ` · ${batch.cur}` : ''} <button onClick={stopBatch} data-testid="bulk-stop">Durdur</button>
            </p>
          )}
          {batch && batch.phase !== 'confirm' && batch.rows.length > 0 && (() => {
            const ok = batch.rows.filter((r) => r.outcome === 'hazır').length;
            const skipped = batch.rows.filter((r) => r.outcome === 'atlandı').length;
            const bad = batch.rows.filter((r) => r.outcome === 'hata').length;
            const incomplete = bad > 0 || skipped > 0 || !!batch.halted;
            return (
              <div data-testid="bulk-summary" data-phase={batch.phase}>
                <p className="small">
                  <strong>{ok}</strong> post {batch.kind === 'metin' ? 'için fikirler hazır' : 'için caption yazıldı'} · {skipped} atlandı · {bad} hata
                  {batch.phase === 'done' ? (incomplete ? ' · İŞ EKSİK KALDI' : batch.kind === 'metin' ? ' · şimdi her post için bir fikir seçin' : ' · bitti') : ''}{' '}
                  {batch.phase === 'done' && <button onClick={() => setBatch(null)} data-testid="bulk-dismiss">Kapat</button>}
                </p>
                {batch.halted && <p className="warn small" role="status" data-testid="bulk-halted">{batch.halted}</p>}
                <details open={bad > 0 || skipped > 0}><summary className="small">Post başına sonuç</summary><ul className="small">{batch.rows.map((r) => <li key={r.postId} data-testid={`bulk-row-${r.postId}`} data-outcome={r.outcome}>{r.postId}: {r.outcome} — {r.note}</li>)}</ul></details>
              </div>
            );
          })()}
          {!ports.creative.available && <div className="shortage" role="alert" data-testid="post-copy-unavailable"><strong>Yaratıcı fikir/metin kapalı.</strong> {ports.creative.unavailableReason} Görsel plan etkilenmez.</div>}
        </section>

        <div className="pp-tools small">
          <label className="field" style={{ margin: 0 }}>Post sayısı
            <input type="number" min={1} max={MAX_POSTS} value={count} onChange={(e) => setCount(e.target.value)} data-testid="post-count" aria-label="Post sayısı" style={{ width: 56 }} />
          </label>
          {planBtn}
          <button onClick={() => op((p, e) => addPosts(p, 1, e))} disabled={!ready} data-testid="post-add">Post ekle</button>
          <button onClick={() => op((p, e) => arrangePlan(p, e))} disabled={n < 2 || !ready} data-testid="post-arrange">Sırayı iyileştir</button>
          <button onClick={() => op((p, e) => undoLast(p, e))} disabled={!plan.undo.length} data-testid="post-undo">Geri al{plan.undo.length ? ` (${plan.undo[plan.undo.length - 1].label})` : ''}</button>
        </div>
        <p className="counts" data-testid="post-capacity">
          Uygun aday: <strong>{cap.available + n}</strong> · planda <strong>{n}</strong>{plan.requested ? ` / istenen ${plan.requested}` : ''}
          {cap.note ? ` — ${cap.note}` : ''}
        </p>

        <div className="pp-cols">
          <section className="pp-center" aria-label="Post planı">
            <h2 className="pp-h">Plan düzeni · profil sırası (yeni → eski) · {n} post{shape.partial ? ` · son sıra kısmi (${shape.lastRowFilled}/3)` : ''}</h2>
            <div className="feed pp-feed" data-testid="post-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {plan.posts.map((p, i) => {
                const c = allById.get(p.assetId);
                const e = c ? effectiveCrop(plan, c) : null;
                const ts = statusOf(p).caption;
                const b = bindings.get(p.id);
                const sig = b ? bindingSig(b) : '';
                const ent = entries[p.id] ?? emptyEntry(p.id);
                const run = running[p.id];
                const lastFail = (Object.entries(failures[p.id] ?? {}) as Array<[CreativeRole, { f: Failure; sig: string }]>).find(([r, x]) => x && x.sig === `${sig}#${roleCtx(r, ent, p.text)}`)?.[1];
                const per = evaluation?.perPost[i];
                return (
                  <div key={p.id} className={`cell post ${p.posLock ? 'locked' : ''} ${p.assetLock && !p.posLock ? 'assetlocked' : ''} ${sel === p.id ? 'sel' : ''}`} data-testid={`post-cell-${p.id}`} data-asset={p.assetId} data-idx={i} data-asset-lock={p.assetLock} data-pos-lock={p.posLock} aria-busy={!!run}>
                    {c && e ? (
                      <button className="pick" onClick={() => setSel(p.id)} aria-label={`${p.id} incele`}>
                        <CroppedImage c={c} format={POST_FORMAT} focus={e.focus} zoom={e.zoom} />
                        {(p.assetLock || p.posLock) && <span className="lockbadge" aria-hidden="true">🔒</span>}
                      </button>
                    ) : <div className="pick empty" role="alert">Varlık havuzda yok ({p.assetId})</div>}
                    <div className="cellbar">
                      <span className="meta" data-testid={`post-pos-${p.id}`}>Profil #{i + 1} · yayın #{n - i} · {p.assetId}</span>
                      <span className="small meta" data-testid={`post-lockstate-${p.id}`}>
                        {p.posLock ? 'Görsel + konum kilitli' : p.assetLock ? 'Görsel kilitli · konum serbest' : 'Kilit yok'}
                      </span>
                      {sel === p.id && (
                      <span className="cellact" data-testid={`post-actions-${p.id}`}>
                        <button aria-label={`${p.id} görseli koru`} aria-pressed={p.assetLock} onClick={() => op((pl) => setAssetLock(pl, p.id, !p.assetLock, p.version))}>{p.assetLock ? 'Görsel korunuyor ✓' : 'Görseli koru'}</button>
                      <button aria-label={`${p.id} yerini de koru`} aria-pressed={p.posLock} onClick={() => op((pl) => setPositionLock(pl, p.id, !p.posLock, p.version))}>{p.posLock ? 'Yeri de korunuyor ✓' : 'Yerini de koru'}</button>
                      <button aria-label={`${p.id} değiştir`} disabled={p.assetLock} onClick={() => op((pl, ev) => replacePost(pl, p.id, 'replace', ev, p.version))}>Değiştir</button>
                      <button aria-label={`${p.id} ele ve yenisini getir`} disabled={p.assetLock} onClick={() => op((pl, ev) => replacePost(pl, p.id, 'dismiss', ev, p.version))}>Ele, yenisini getir</button>
                      <button aria-label={`${p.id} sil`} disabled={p.assetLock} onClick={() => op((pl, ev) => deletePost(pl, p.id, ev, p.version))}>Sil</button>
                      <button aria-label={`${p.id} öne al`} disabled={i === 0} onClick={() => op((pl, ev) => movePost(pl, p.id, -1, ev))}>◀</button>
                      <button aria-label={`${p.id} geriye al`} disabled={i === n - 1} onClick={() => op((pl, ev) => movePost(pl, p.id, 1, ev))}>▶</button>
                      </span>
                      )}
                      <span className="small muted meta" data-testid={`post-score-${p.id}`} title={per?.notes.join(' · ')}>uyum {per ? Math.round(per.total) : '–'}</span>
                      {run && <span className="status" data-testid={`post-busy-${p.id}`}>{run.role === 'ideas' ? 'Fikirler' : run.role === 'caption' ? 'Caption' : 'Kontrol'} üretiliyor…</span>}
                      {!run && lastFail && <span className="status err" data-testid={`post-error-${p.id}`}>{lastFail.f.message}</span>}
                      {!p.text && !run && !lastFail && <span className="caption empty">Metin yok</span>}
                      {p.text && (
                        <span className="caption" data-testid={`post-text-${p.id}`} data-status={ts}>
                          <em className="tag">{p.text.source === 'manual' ? 'elle' : p.text.voiceSource === 'temporary_tone' ? 'geçici ton taslağı' : 'model · TR'}{ts !== 'geçerli' && ts !== 'yok' ? ` · ${STALE_LABEL[ts as StaleReason]}` : ''}</em> {p.text.text}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="pp-side" aria-label="Seçili post">
            {!selPost && <div className="pp-pickhint">Bir postun üstüne tıklayın: metnini yazın, kırpımını ve kilitlerini ayarlayın.</div>}
            {selPost && selCand && selCrop && (
              <div data-testid="post-crop-panel">
                <h2 className="pp-sidehead">{selPost.id} <span className="small muted">· {selPost.assetId}</span></h2>
                {analysis && needsAnalysis(selCand) && <p className="small pp-needan" data-testid="post-needs-analysis">Bu görselin anlamsal analizi yok; “Metin üret” önce onu yapar.</p>}
                <div className="pp-textblock">
                  <label className="field"><strong>Metin (caption)</strong>
                    <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={6} data-testid="post-edit-text" placeholder="Elle yazın ya da fikir seçip caption yazdırın" />
                  </label>
                  <div className="actions">
                    <button className="primary" onClick={() => void metinUret([selPost.id], true)} disabled={!ready || !ports.creative.available || anyBusy || metinBusy} data-testid="post-gen-this">{metinBusy || running[selPost.id] ? 'Hazırlanıyor…' : 'Bu post için metin üret'}</button>
                    {statusOf(selPost).selection === 'geçerli' && (
                      <button className="primary" onClick={() => { approvePlan(); void runRole(selPost.id, 'caption', !!selPost.text && statusOf(selPost).caption === 'geçerli'); }} disabled={!ready || !ports.creative.available || !!running[selPost.id] || metinBusy} data-testid="post-caption-this">{selPost.text && statusOf(selPost).caption === 'geçerli' ? 'Seçtiğim fikirle yeniden yaz' : 'Seçtiğim fikirle caption yaz'}</button>
                    )}
                    <button onClick={() => saveManual(selPost, draftText)} data-testid="post-save-text" disabled={draftText === (selPost.text?.text ?? '')}>Elle yazdığımı kaydet</button>
                  </div>
                  <p className="small muted" data-testid="post-next-step">
                    {(() => {
                      const st = statusOf(selPost);
                      if (running[selPost.id]) return 'Üretim sürüyor…';
                      if (st.caption === 'geçerli') return selPost.text?.source === 'manual' ? 'Bu metni siz yazdınız; yeniden yazılırsa eskisi geçmişte saklanır.' : 'Metin hazır. İsterseniz aşağıdan bağımsız kontrol edin.';
                      if (st.selection === 'geçerli') return 'Fikir seçildi: “Seçtiğim fikirle caption yaz” ile devam edin.';
                      if (st.ideas === 'geçerli') return 'Fikirler hazır: aşağıdan birini SİZ seçin.';
                      return 'Başlamak için “Bu post için metin üret”: eksik analiz tamamlanır, üç fikir hazırlanır, seçim sizdedir.';
                    })()}
                  </p>
                </div>
                <details className="pp-detail" data-testid="pp-steps" open={!!(entries[selPost.id]?.ideas) || !!running[selPost.id] || undefined}>
                  <summary>Fikirler, caption ve kontrol (adım adım)</summary>
                  {selBinding && (
                  <CreativePanel
                    postId={selPost.id}
                    entry={entries[selPost.id] ?? emptyEntry(selPost.id)}
                    binding={selBinding}
                    text={selPost.text}
                    locked={selPost.assetLock || selPost.posLock}
                    status={statusOf(selPost)}
                    running={running[selPost.id] ? { role: running[selPost.id].role } : null}
                    failures={Object.fromEntries(Object.entries(failures[selPost.id] ?? {}).filter(([k, v]) => v && v.sig === `${bindingSig(selBinding)}#${roleCtx(k as CreativeRole, entries[selPost.id] ?? emptyEntry(selPost.id), selPost.text)}`).map(([k, v]) => [k, v!.f]))}
                    done={done}
                    ready={ready}
                    available={ports.creative.available}
                    unavailableReason={ports.creative.unavailableReason}
                    overwrite={!!overwrite[selPost.id]}
                    onOverwrite={(v) => setOverwrite((m) => ({ ...m, [selPost.id]: v }))}
                    onIntent={(k, t) => putEntry(setIntent(getEntry(selPost.id), k, t))}
                    onRun={(role, refresh) => void runRole(selPost.id, role, !!refresh)}
                    onCancel={() => cancelRole(selPost.id)}
                    onPick={(id) => withBinding(selPost.id, (e, cur) => selectIdea(e, id, cur))}
                    onEditSel={(patch) => withBinding(selPost.id, (e, cur) => editSelection(e, patch, cur))}
                    onAdopt={(k, id) => withBinding(selPost.id, (e, cur) => adoptParked(e, k, id, cur))}
                    onDiscard={(k) => putEntry(discardParked(getEntry(selPost.id), k))}
                    onRestore={(k) => restoreText(selPost, k)}
                  />
                )}
                </details>
                <details className="pp-detail" open>
                  <summary>Kırpım ve görünür olgular</summary>

                <p className="small">Kaynak: {selCand.dims.w}×{selCand.dims.h} (değişmez) → çıktı {POST_SIZE.w}×{POST_SIZE.h} (4:5)</p>
                <p className="small" data-testid="post-crop-version">Kırpım sürümü: {cropVersionOf(plan, selPost.assetId)} · {plan.crops[selPost.assetId]?.focus ? 'manuel' : plan.crops[selPost.assetId] ? 'otomatik (sıfırlandı)' : 'otomatik (ana konu merkezli)'}</p>
                <div className="cropbox">
                  <div className="cropframe" data-testid="post-cropframe" onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    op((pl) => setCrop(pl, selPost.assetId, { focus: { x: (e.clientX - r.left) / (r.width || 1), y: (e.clientY - r.top) / (r.height || 1) } }));
                  }}>
                    <PlannerImg c={selCand} />
                    {(() => {
                      const rc = cropRect(selCand.dims, POST_RATIO, selCrop.focus, selCrop.zoom);
                      return <div className="overlay" style={{ left: `${(rc.x / selCand.dims.w) * 100}%`, top: `${(rc.y / selCand.dims.h) * 100}%`, width: `${(rc.w / selCand.dims.w) * 100}%`, height: `${(rc.h / selCand.dims.h) * 100}%` }} />;
                    })()}
                  </div>
                  <div className="previewcol"><span className="small muted">Sonuç (4:5)</span><CroppedImage c={selCand} format={POST_FORMAT} focus={selCrop.focus} zoom={selCrop.zoom} /></div>
                </div>
                <label className="field">Yakınlaştırma {selCrop.zoom.toFixed(2)}×
                  <input type="range" aria-label="Yakınlaştırma" min={1} max={2.5} step={0.05} value={selCrop.zoom} onChange={(e) => op((pl) => setCrop(pl, selPost.assetId, { zoom: Number(e.target.value) }))} />
                </label>
                <button onClick={() => op((pl) => setCrop(pl, selPost.assetId, { auto: true }))} data-testid="post-crop-auto" disabled={!plan.crops[selPost.assetId]?.focus && (plan.crops[selPost.assetId]?.zoom ?? 1) === 1}>Otomatik kırpıma dön</button>
                {(() => {
                  const v = cropVisibility(selCand.visual?.decision, selCand.dims, POST_RATIO, selCrop.focus, selCrop.zoom);
                  return (
                    <p className="small" data-testid="post-visibility">
                      Metne taşınabilecek görünür olgular: <strong>{FACT_LABEL[v.facts]}</strong>
                      {v.cropped ? ` — kırpım karenin %${Math.round(v.windowShare * 100)}'ini gösteriyor; ana konu ${v.subject === 'visible' ? 'kırpımda görünür' : v.subject === 'partial' ? 'kısmen kesik' : v.subject === 'outside' ? 'kırpım dışında' : 'doğrulanamadı (kutu/analiz yok)'}; kırpım dışında kalan ayrıntılar görünen gerçek sayılmaz.` : '.'}
                    </p>
                  );
                })()}
                {evaluation?.perPost[plan.posts.indexOf(selPost)] && (
                  <p className="small" data-testid="post-notes">Uyum notları: {evaluation.perPost[plan.posts.indexOf(selPost)].notes.join(' · ') || '—'}
                    {evaluation.perPost[plan.posts.indexOf(selPost)].unknown.length ? ` · bilinmiyor (puana katılmadı): ${evaluation.perPost[plan.posts.indexOf(selPost)].unknown.join(', ')}` : ''}
                  </p>
                )}
                                </details>
              </div>
            )}
          </aside>
        </div>

        <details className="pp-more">
          <summary>Plan ayrıntıları ve önizleme: uyum, son işlem, yayın sırası, profil görünümü</summary>
          {evaluation && <p className="counts" data-testid="post-plan-score">Plan uyumu (sezgisel, kayıtlı analiz + nihai kırpım): <strong>{evaluation.total}</strong>/100{evaluation.notes.length ? ` · ${evaluation.notes.join(' · ')}` : ''}</p>}

            {last && (
              <section className="lastchange" aria-label="Son işlem" data-testid="post-lastchange">
                <h3>Son işlem: {last.label}</h3>
                <div className="previews">
                  <div><span className="small muted">Önce</span><MiniGrid cells={last.before} byId={allById} testId="lastchange-before" label="İşlem öncesi düzen" /></div>
                  <div><span className="small muted">Sonra</span><MiniGrid cells={last.after} byId={allById} testId="lastchange-after" label="İşlem sonrası düzen" /></div>
                </div>
                {last.notes.length > 0 && <p className="small" data-testid="lastchange-notes">{last.notes.join(' · ')}</p>}
              </section>
            )}
            <section className="views" aria-label="Yayın sırası ve profil görünümü">
              <h2>Yayın sırası ve profil görünümü</h2>
              <p className="small muted" data-testid="views-explain">
                Yayın sırası KRONOLOJİKTİR (#1 ilk yayınlanır); profil gridinde ise her yeni gönderi BAŞA (sol üst) gelir, öncekiler kayar. Bu yüzden plan düzeni (profil sırası) yayın sırasının tersidir. Önizleme canlı yayına gönderilmez.
              </p>
              <h3>Yayın sırası (kronolojik)</h3>
              <div className="chrono" data-testid="view-chrono">
                {chrono.length === 0 && <span className="small muted">Plan boş.</span>}
                {chrono.map((c) => (
                  <div key={c.postId} className="item" data-order={c.order} data-asset={c.assetId}>
                    {allById.get(c.assetId) && <CroppedImage c={allById.get(c.assetId)!} format={POST_FORMAT} focus={c.crop?.focus ?? defaultFocusOf(allById.get(c.assetId)!)} zoom={c.crop?.zoom ?? 1} />}
                    <span>#{c.order}{c.order === 1 ? ' ilk' : c.order === chrono.length ? ' son' : ''}</span>
                  </div>
                ))}
              </div>
              <h3>Profil görünümü · {stepNow === n ? 'plan tamamen yayınlandıktan sonra' : `ilk ${stepNow} post yayınlandıktan sonra`}</h3>
              <label className="field">Yayın adımı
                <input type="range" min={0} max={n} value={stepNow} onChange={(e) => setStep(Number(e.target.value))} aria-label="Yayın adımı" data-testid="profile-step" disabled={!n} />
              </label>
              <MiniGrid
                cells={profile.map((c) => ({ idx: c.idx, assetId: c.assetId, assetLock: false, posLock: false, kind: c.source === 'plan' ? ('plan' as const) : ('history' as const), id: c.postId ?? null, crop: c.crop ?? null, note: c.source === 'plan' ? `yayın #${c.publishOrder}` : `snapshot · ${c.dateKnown ? c.date : 'tarih bilinmiyor'}` }))}
                byId={allById}
                testId="view-profile"
                label="Profil görünümü"
              />
              <p className="small muted" data-testid="profile-shape">Profil: {profShape.total} hücre, {profShape.rows} sıra{profShape.partial ? `; son sıra kısmi (${profShape.lastRowFilled}/3)` : ''}. Plan bloğu: {shape.rows} sıra{shape.partial ? `, son sıra kısmi (${shape.lastRowFilled}/3) — mevcut yayınlar bu sırayı tamamlar` : ''}.</p>
              <p className="small" data-testid="snapshot-label"><strong>Mevcut yayınlar = geçmiş SNAPSHOT.</strong> {snap.note}</p>
            </section>
        </details>
        <p className="small muted" data-testid="post-memory-note">Post planı ve yaratıcı durum yalnız bu sekmenin belleğindedir: Marka Kiti/ayarlara gidip dönünce korunur; sayfayı yenilerseniz ya da sekmeyi kapatırsanız kaybolur (kalıcı kayıt yok). Yayın geçmişi bağlı değildir.</p>
      </main>
    </ImageSrcContext.Provider>
  );
}
