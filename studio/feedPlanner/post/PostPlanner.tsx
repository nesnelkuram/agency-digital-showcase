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
  /** Nihai kırpım görünümünün piksel ölçümü (test için enjekte edilir) */
  measureCrop?: MeasureCropFn;
  /** Başlangıç sayısı */
  initialCount?: number;
}

const DEFAULT_PORTS = reviewPorts();
const TONE_LABEL_TR: Record<ToneLabel, string> = { enerjik: 'Enerjik', zarif: 'Zarif', lüks: 'Lüks', samimi: 'Samimi', minimal: 'Minimal', eğlenceli: 'Eğlenceli' };
const FACT_LABEL = { tam: 'tam kare görünür', 'yalnız_konu': 'yalnız ana konu', yok: 'görünür olgu yok' } as const;
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
  candidates, published = [], historySource, ports = DEFAULT_PORTS, projectId, tenantId, userId, weekStart = '', voice = { approved: null }, onStartGuide, measureCrop = measureImageCrop, initialCount = 9,
}: PostPlannerProps) {
  const [plan, setPlanState] = useState<PostPlan>(() => emptyPostPlan());
  const planRef = useRef(plan);
  const setPlan = (p: PostPlan) => { planRef.current = p; setPlanState(p); };
  const [count, setCount] = useState(String(initialCount));
  const [sel, setSel] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [msgs, setMsgs] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  /** "Görsel planı tamamladım" onayı GÖRSEL plan imzasına bağlıdır: görsel/sıra/kırpım değişince geçersizleşir */
  const [doneSig, setDoneSig] = useState<string | null>(null);
  const doneRef = useRef<string | null>(null);
  doneRef.current = doneSig;
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    const acs = aborters.current;
    return () => {
      aliveRef.current = false;
      acs.forEach((ac) => ac.abort()); // kapsam/sekme kapanırken uçuştaki istekler iptal; yanıtları zaten yok sayılır
    };
  }, []);
  const [tone, setTone] = useState<TempTone>({});
  const toneRef = useRef(tone);
  toneRef.current = tone;
  const [step, setStep] = useState<number | null>(null);
  const [draftText, setDraftText] = useState('');

  const scopeKey = `${tenantId ?? ''}|${projectId}|${userId ?? ''}`;
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
  const [entries, setEntriesState] = useState<Record<string, Entry>>({});
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

  const runRole = async (postId: string, role: CreativeRole, refresh = false) => {
    const pl = planRef.current;
    const post = pl.posts.find((p) => p.id === postId);
    const cand = post ? allByIdRef.current.get(post.assetId) : undefined;
    const cur = post ? bindingOf(pl, post) : null;
    if (!post || !cand || !cur) return;
    const sigNow = bindingSig(cur);
    const failSig = `${sigNow}#${roleCtx(role, getEntry(postId), post.text)}`;
    const fail = (f: Failure) => setFailure(postId, role, { f, sig: failSig });
    if (runningRef.current[postId]) return; // post başına aynı anda TEK rol
    if (doneRef.current === null || doneRef.current !== visualPlanSig(pl)) return fail({ kind: 'engellendi', message: 'Görsel plan onaylanmadı veya onaydan sonra değişti; yaratıcı roller başlatılmadı.' });
    if (!ports.creative.available) return fail({ kind: 'kapalı', message: ports.creative.unavailableReason ?? 'Yaratıcı roller bağlı değil.' });
    if (voice.approved === false && !cleanTone()) return fail({ kind: 'ses_yok', message: 'Onaylı marka dili yok: bir plan tonu seçin veya marka dilini birlikte oluşturun.' });
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

  return (
    <ImageSrcContext.Provider value={ports.imageSrc}>
      <main className="shell post-planner" data-testid="post-planner">
        <header className="top">
          <div>
            <h1>Post Planlayıcı</h1>
            <p className="muted small">Instagram post · {POST_SIZE.w}×{POST_SIZE.h} px (4:5) · 3 sütun · yerel taslak: {ports.persistence ? 'kalıcılık bu sekmede kullanılmaz' : 'kalıcılık yok'}; canlıya hiçbir şey gönderilmez.</p>
          </div>
          <div className="actions">
            <label className="field" style={{ margin: 0 }}>Post sayısı (N)
              <input type="number" min={1} max={MAX_POSTS} value={count} onChange={(e) => setCount(e.target.value)} data-testid="post-count" aria-label="Post sayısı" style={{ width: 70 }} />
            </label>
            <button className="primary big" onClick={onPlan} disabled={!ready || anyBusy} data-testid="post-plan-btn" title={ready ? undefined : 'Kırpılmış görünüm ölçümleri tamamlanana kadar kapalı'}>
              {n ? 'Yeniden planla (kilitler korunur)' : 'Post planı oluştur'}
            </button>
            <button onClick={() => op((p, e) => addPosts(p, 1, e))} disabled={!n || !ready} data-testid="post-add">Post ekle</button>
            <button onClick={() => op((p, e) => arrangePlan(p, e))} disabled={n < 2 || !ready} data-testid="post-arrange">Sırayı iyileştir</button>
            <button onClick={() => op((p, e) => undoLast(p, e))} disabled={!plan.undo.length} data-testid="post-undo">Geri al{plan.undo.length ? ` (${plan.undo[plan.undo.length - 1].label})` : ''}</button>
          </div>
        </header>

        {!ready && <p className="counts" role="status" data-testid="post-measure-progress">Kırpılmış (4:5) görünümler ölçülüyor ({measured}/{toMeasure}): plan eksik ölçümle kurulmasın diye düğme kapalı.</p>}
        <p className="counts" data-testid="post-capacity">
          Uygun aday: <strong>{n ? cap.available + n : eligibleNow}</strong> · planda <strong>{n}</strong>{plan.requested ? ` / istenen ${plan.requested}` : ''}
          {cap.note ? ` — ${cap.note}` : ''}
        </p>
        {evaluation && <p className="counts" data-testid="post-plan-score">Plan uyumu (sezgisel, kayıtlı analiz + nihai kırpım): <strong>{evaluation.total}</strong>/100{evaluation.notes.length ? ` · ${evaluation.notes.join(' · ')}` : ''}</p>}
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

        <div className="cols with-panels">
          <section className="center" aria-label="Post planı">
            <h2>Plan düzeni · profil sırası (yeni → eski) · {n} post{shape.partial ? ` · son sıra kısmi (${shape.lastRowFilled}/3)` : ''}</h2>
            {n === 0 && <p className="small muted" data-testid="post-empty">Henüz plan yok. Post sayısını girip "Post planı oluştur"a basın; planlama model çağırmaz.</p>}
            <div className="feed" data-testid="post-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
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
                      </button>
                    ) : <div className="pick empty" role="alert">Varlık havuzda yok ({p.assetId})</div>}
                    <div className="cellbar">
                      <span data-testid={`post-pos-${p.id}`}>Profil #{i + 1} · yayın #{n - i} · {p.assetId}</span>
                      <span className="small" data-testid={`post-lockstate-${p.id}`}>
                        {p.posLock ? 'Görsel + konum kilitli' : p.assetLock ? 'Görsel kilitli · konum serbest' : 'Kilit yok'}
                      </span>
                      <button aria-label={`${p.id} görseli koru`} aria-pressed={p.assetLock} onClick={() => op((pl) => setAssetLock(pl, p.id, !p.assetLock, p.version))}>{p.assetLock ? 'Görsel korunuyor ✓' : 'Görseli koru'}</button>
                      <button aria-label={`${p.id} yerini de koru`} aria-pressed={p.posLock} onClick={() => op((pl) => setPositionLock(pl, p.id, !p.posLock, p.version))}>{p.posLock ? 'Yeri de korunuyor ✓' : 'Yerini de koru'}</button>
                      <button aria-label={`${p.id} değiştir`} disabled={p.assetLock} onClick={() => op((pl, ev) => replacePost(pl, p.id, 'replace', ev, p.version))}>Değiştir</button>
                      <button aria-label={`${p.id} ele ve yenisini getir`} disabled={p.assetLock} onClick={() => op((pl, ev) => replacePost(pl, p.id, 'dismiss', ev, p.version))}>Ele, yenisini getir</button>
                      <button aria-label={`${p.id} sil`} disabled={p.assetLock} onClick={() => op((pl, ev) => deletePost(pl, p.id, ev, p.version))}>Sil</button>
                      <button aria-label={`${p.id} öne al`} disabled={i === 0} onClick={() => op((pl, ev) => movePost(pl, p.id, -1, ev))}>◀</button>
                      <button aria-label={`${p.id} geriye al`} disabled={i === n - 1} onClick={() => op((pl, ev) => movePost(pl, p.id, 1, ev))}>▶</button>
                      <span className="small muted" data-testid={`post-score-${p.id}`} title={per?.notes.join(' · ')}>uyum {per ? Math.round(per.total) : '–'}</span>
                      {run && <span className="status" data-testid={`post-busy-${p.id}`}>{run.role === 'ideas' ? 'Fikirler' : run.role === 'caption' ? 'Caption' : 'Kontrol'} üretiliyor…</span>}
                      {!run && lastFail && <span className="status err" data-testid={`post-error-${p.id}`}>{lastFail.f.message}</span>}
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

            <section className="textpanel" aria-label="Yaratıcı metin" data-testid="post-text-panel">
              <h2>Yaratıcı fikir ve metin (ayrı, post başına adım)</h2>
              <p className="small" data-testid="post-text-summary">
                {n === 0 ? 'Önce görsel planı oluşturun; fikir ve metin ayrı, açık eylemlerdir.' : `${n} görsel yerleşti · ${withIdea} geçerli seçilmiş fikir · ${withText} geçerli metin · ${withCheck} geçerli bağımsız kontrol.`} Fikir ve metin bir postu seçince sağ panelde yönetilir; toplu/otomatik üretim YOKTUR. Görsel, kırpım veya kaynak değişince fikir/caption/kontrol “eski” işaretlenir; insan düzenlemesi silinmez.
              </p>
              <label className="radio"><input type="checkbox" checked={done} onChange={(e) => setDoneSig(e.target.checked ? visualPlanSig(planRef.current) : null)} disabled={!n} data-testid="post-visual-done" /> Görsel planı tamamladım (yaratıcı adımları aç)</label>
              {doneSig !== null && !done && <p className="small" role="status" data-testid="post-done-stale">Görsel plan (görsel / sıra / kırpım) onaydan sonra değişti: yaratıcı adımlar için yeniden onaylayın.</p>}
              {!ports.creative.available && <div className="shortage" role="alert" data-testid="post-copy-unavailable"><strong>Yaratıcı fikir/metin kapalı.</strong> {ports.creative.unavailableReason} Görsel plan etkilenmez.</div>}
              <p className="small muted" data-testid="post-memory-note">Bu sürümde Post planı ve yaratıcı durum yalnız bu sekmenin belleğindedir (sayfa yenilenince / sekme değişip kapanınca kaybolur); yayın geçmişi bağlı değildir.</p>
              {voice.approved === true && <p className="small muted" data-testid="post-voice-approved">Marka dili: onaylı rehber kullanılır.</p>}
              {voice.approved !== true && (
                <div className="tonebox" data-testid="post-tone-panel">
                  <strong className="small">Plan tonu {voice.approved === false ? '(onaylı marka dili yok)' : '(isteğe bağlı)'}</strong>
                  <div className="chips" role="group" aria-label="Plan tonu">
                    {TONE_KEYS.map((t) => (
                      <button key={t} className={`chipbtn ${toneOn(t) ? 'on' : ''}`} aria-pressed={toneOn(t)} data-testid={`post-tone-chip-${t}`} onClick={() => setTone((cur) => ({ ...cur, label: cur.label === t ? undefined : t }))}>{TONE_LABEL_TR[t]}</button>
                    ))}
                  </div>
                  <label className="field">Serbest ton tarifi (isteğe bağlı)
                    <input type="text" maxLength={MAX_TONE_PROMPT} value={tone.prompt ?? ''} onChange={(e) => setTone((cur) => ({ ...cur, prompt: e.target.value }))} data-testid="post-tone-prompt" />
                  </label>
                  <p className="small muted">Ton GEÇİCİDİR; onaylı marka hafızası değildir. Fikir ve metin yalnız o 4:5 kırpımda GÖRÜNÜR olduğu doğrulanan olgulardan türetilir; kırpım dışında kalan ayrıntı görünen gerçek sayılmaz.</p>
                  {onStartGuide && <button onClick={onStartGuide} data-testid="post-start-guide">Marka dilini birlikte oluştur</button>}
                </div>
              )}
            </section>
          </section>

          <aside className="panel right" aria-label="Seçili post">
            {!selPost && <p className="muted">Bir post seçin: kırpımı ve ayrıntıları burada.</p>}
            {selPost && selCand && selCrop && (
              <div data-testid="post-crop-panel">
                <h2>{selPost.id} · {selPost.assetId}</h2>
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
                <label className="field">Caption (elle yaz/düzenle — insan metni korunur)
                  <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={4} data-testid="post-edit-text" style={{ width: '100%', boxSizing: 'border-box', font: 'inherit' }} />
                </label>
                <div className="actions">
                  <button onClick={() => saveManual(selPost, draftText)} data-testid="post-save-text" disabled={draftText === (selPost.text?.text ?? '')}>Metni kaydet (elle)</button>
                </div>
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
              </div>
            )}
          </aside>
        </div>
      </main>
    </ImageSrcContext.Provider>
  );
}
