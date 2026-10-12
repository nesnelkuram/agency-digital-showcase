import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Aesthetics, Candidate, FormatId, SlotText } from '../types';
import { FORMATS } from '../types';
import { cropRect, coverage, ratioOf, type Focus } from '../crop';
import { hardCheck, scoreCandidate, PART_LABEL, HARD_LABEL, type PartKey } from '../scorer';
import {
  emptyPlan, planFromIds, generate, toggleLock, proposeSlot, setSlotText, rejectItem, setSlotFormat, assignToSlot, dismissSlot, replaceSlot, restoreFromHistory, neighborSlots,
  FEED_SLOTS, GRID_COLS, type Lane, type PlanState, type PlanCtx, type SlotMessage, type OpResult, type ProposeMode,
} from '../planner';
import { seriesFrames, validateHierarchy, LOCAL_FONT_NOTE, type SeriesFrame } from '../storyLayout';
import { ThrowingMap, QA_LABEL, exhaustedPool, type QaMode } from '../qaScenario';
import { encodeDraft, decodeDraft, type CropState, type RejectionReason } from '../draftCodec';
import { PortError, reviewPorts, type PlannerPorts } from '../ports';
import { sha256Hex } from '../../../shared/planner/sha256';
import { TONE_KEYS, MAX_TONE_PROMPT, type CopyItemRequest, type CopyRequest, type PixelObservation, type TempTone, type ToneLabel } from '../../../shared/planner/copyContract';
import FeedbackReasonFields, { EMPTY_REASON, FEEDBACK_CATEGORY_OPTIONS, type FeedbackReasonValue } from '../../components/FeedbackReasonFields';
import { CroppedImage } from './CroppedImage';
import { StoryCanvas } from './StoryCanvas';
import { SlotMenu, type MenuItem } from './SlotMenu';
import { ImageSrcContext, PlannerImg } from './imageSource';
import { measureImage } from './loadPixels';

export interface ReviewData {
  title: string;
  dateLabel: string;
  archiveNote: string;
  scope: string;
  weeklyStory: string[];
  candidates: Candidate[];
  published: Candidate[];
  /** Envanter yüklenirken elenen/eksik kayıtlar (nedenle; sessiz değil) */
  inventoryNotes?: string[];
}
export interface ReviewAppProps {
  data?: ReviewData;
  measure?: (url: string) => Promise<Aesthetics | null>;
  /** Yalnız yerel QA: açık etiketli senaryo. Normal akışta verilmez. */
  qa?: QaMode | null;
  /** Dış bağımlılıklar: model, kalıcılık, görsel. Varsayılan: yerel inceleme (model/kalıcılık YOK). */
  ports?: PlannerPorts;
  /** Marka kapsamı (adaylar brand = projectId taşır). Yerel incelemede 'dieci'. */
  projectId?: string;
  /** Planın haftası (YYYY-MM-DD, Pazartesi): model isteği ve kalıcı taslak anahtarı */
  weekStart?: string;
  /**
   * Marka dili durumu: approved=true → onaylı rehber/paket var (geçici ton kullanılmaz). false → ton seçilir. null → bilinmiyor
   * (sunucu karar verir). Geçici ton kalıcı onaylı marka hafızası DEĞİLDİR.
   */
  voice?: { approved: boolean | null };
  /** Marka dilini konuşarak oluşturma akışını açar (yoksa düğme gösterilmez) */
  onStartGuide?: () => void;
}

interface SlotRef {
  lane: Lane;
  i: number;
}
interface Rejection extends FeedbackReasonValue {
  at: string;
}
const FOCUS_BY_POS: Record<string, Focus> = {
  merkez: { x: 0.5, y: 0.5 }, sol: { x: 0.3, y: 0.5 }, sağ: { x: 0.7, y: 0.5 }, üst: { x: 0.5, y: 0.35 }, alt: { x: 0.5, y: 0.65 },
};
const DEFAULT_PORTS = reviewPorts();
const pct = (v: number) => `${Math.round(v * 100)}%`;
const tone = (w: number) => (w > 0.05 ? 'sıcak' : w < -0.05 ? 'soğuk' : 'nötr');
const categoryLabel = (v: string) => FEEDBACK_CATEGORY_OPTIONS.find((o) => o.value === v)?.label ?? v;
const newKey = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}-${Math.random().toString(36).slice(2, 14)}`).slice(0, 64);
const mainText = (t: SlotText | null | undefined) => [t?.headline, t?.body, t?.caption].filter(Boolean).join(' ');
const describeError = (e: unknown): string => (e instanceof PortError ? `${e.message}${e.code && e.code !== 'model_unavailable' ? ` [${e.code}]` : ''}` : e instanceof Error ? e.message : 'Bilinmeyen hata');

type CopyErrKind = 'provider_off' | 'needs_voice' | 'no_observation' | 'rejected' | 'error';
interface CopyErr { kind: CopyErrKind; text: string }
const TONE_LABEL_TR: Record<ToneLabel, string> = { enerjik: 'Enerjik', zarif: 'Zarif', lüks: 'Lüks', samimi: 'Samimi', minimal: 'Minimal', eğlenceli: 'Eğlenceli' };
const GUARD = 'Görsel korundu.';
/** Sağlayıcı kapalı (503) ile marka dili yokluğu (412) AYRI durumlardır; ikisinde de görsel silinmez. */
function classifyCopyError(e: unknown): CopyErr {
  if (e instanceof PortError) {
    if (e.code === 'feature_disabled') return { kind: 'provider_off', text: `Metin üretimi kapalı (sağlayıcı yapılandırması). ${GUARD}` };
    if (e.code === 'model_unavailable') return { kind: 'provider_off', text: `${e.message} ${GUARD}` };
    if (e.code === 'brand_voice_missing') return { kind: 'needs_voice', text: `Onaylı marka dili yok: bir plan tonu seçin veya marka dilini birlikte oluşturun. ${GUARD}` };
  }
  return { kind: 'error', text: `Metin üretilemedi: ${describeError(e)}. ${GUARD}` };
}
const classifyRejection = (reasons: string[]): CopyErr =>
  reasons.includes('gorsel_gozlem_yok')
    ? { kind: 'no_observation', text: `Bu görselde gözlem yok (katalog kaydı da ölçüm de yok): metin üretilemedi. ${GUARD}` }
    : { kind: 'rejected', text: `Metin doğrulamadan geçmedi (${reasons.join(', ')}). ${GUARD}` };

/** Aday ölçümünden sunucuya giden GÖZLEM (yalnız ölçülen piksel istatistiği; anlam değil) */
const observationOf = (c: Candidate | undefined): PixelObservation | undefined => {
  const a = c?.aesthetics;
  if (!a?.measured) return undefined;
  return { brightness: a.brightness, warmth: a.warmth, contrast: a.contrast, density: a.density, negativeSpace: a.negativeSpace, negativeZone: a.negativeZone, palette: a.palette.slice(0, 4) };
};

/** Role uyan metin mi (Story hiyerarşisi): başlık yalnız ilk karede; devamda yalnız küçük açıklama; metinsiz karede metin yok. */
const fitsRole = (t: SlotText | null, role: SeriesFrame['role']): boolean =>
  role === 'headline' ? !!t?.headline && !t.caption : role === 'body' ? !!t?.body && !t.headline && !t.caption : !t;

export default function App({ data: injected, measure = measureImage, qa = null, ports = DEFAULT_PORTS, projectId, weekStart = '', voice = { approved: null }, onStartGuide }: ReviewAppProps) {
  const brand = projectId ?? 'dieci';
  const prep = (d: ReviewData): ReviewData =>
    qa === 'exhausted' ? { ...d, title: `${d.title} · QA`, candidates: exhaustedPool(d.candidates, d.weeklyStory, brand) } : d;
  const [data, setData] = useState<ReviewData | null>(injected ? prep(injected) : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aest, setAest] = useState<Record<string, Aesthetics | null>>({});
  const [feed, setFeed] = useState<PlanState>(() => emptyPlan('feed'));
  const [story, setStory] = useState<PlanState>(() => emptyPlan('story'));
  const [messages, setMessages] = useState<(SlotMessage & { lane: Lane })[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [selSlot, setSelSlot] = useState<SlotRef | null>(null);
  const [crops, setCrops] = useState<Record<string, CropState>>({});
  const [localFormat, setLocalFormat] = useState<FormatId>('feed-4x5');
  const [groupFilter, setGroupFilter] = useState('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState<FeedbackReasonValue>(EMPTY_REASON);
  const [reasons, setReasons] = useState<Record<string, Rejection>>({});
  const [menu, setMenu] = useState<{ lane: Lane; i: number; version: number } | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [copyErrors, setCopyErrors] = useState<Record<string, CopyErr>>({});
  const [planTone, setPlanTone] = useState<TempTone>({});
  const [showPanels, setShowPanels] = useState(false);
  const seedRef = useRef(0);
  const toneRef = useRef(planTone);
  toneRef.current = planTone;
  const [persist, setPersist] = useState<{ version: number; status: 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict'; message?: string; dirty: boolean }>({ version: 0, status: 'idle', dirty: false });
  // Her işlem en güncel durumu okur: eski/tekrarlı tıklama sürüm kontrolüyle güvenle yok sayılır.
  const feedRef = useRef(feed);
  const storyRef = useRef(story);
  const busyRef = useRef(busy);
  const cropsRef = useRef(crops);
  const reasonsRef = useRef(reasons);
  const lastSave = useRef<{ hash: string; key: string } | null>(null);
  feedRef.current = feed;
  storyRef.current = story;
  busyRef.current = busy;
  cropsRef.current = crops;
  reasonsRef.current = reasons;

  useEffect(() => {
    if (injected) return;
    fetch('/__review/fixture', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ReviewData) => setData(prep(d)))
      .catch((e) => setLoadError(`Yerel fixture okunamadı: ${e.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injected]);

  const items = useMemo<Candidate[]>(() => {
    if (!data) return [];
    return [...data.candidates, ...data.published].map((c) => (aest[c.id] ? { ...c, aesthetics: aest[c.id]! } : c));
  }, [data, aest]);
  const byId = useMemo(() => new Map(items.map((c) => [c.id, c])), [items]);
  const byIdRef = useRef(byId);
  byIdRef.current = byId;

  /** Seri kimliği YALNIZ gerçek ürün kimliğinden (insan doğrulamalı) veya planın kendi açık seri adından gelir; aynı gün seri değildir. */
  const keyOf = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const c = byIdRef.current.get(id);
    return c?.productId ?? c?.weekFrame?.seriesKey ?? null;
  };
  const framesOf = (slots: (string | null)[]): SeriesFrame[] => seriesFrames(slots.map(keyOf));

  // Story şeridi: haftalık plan kaydının BELLEK KOPYASI (kaynak değişmez). Plan metni ilk karede başlık olarak taşınır.
  const initialStory = useMemo<PlanState | null>(() => {
    if (!data) return null;
    const raw = new Map(data.candidates.map((c) => [c.id, c]));
    const fr = seriesFrames(data.weeklyStory.map((id) => raw.get(id)?.productId ?? raw.get(id)?.weekFrame?.seriesKey ?? null));
    const texts: (SlotText | null)[] = data.weeklyStory.map((id, i) => {
      const copy = raw.get(id)?.weekFrame?.copy?.trim();
      if (!copy || fr[i].role === 'none') return null;
      return fr[i].role === 'headline' ? { headline: copy, source: 'plan', lang: 'tr' } : { body: copy, source: 'plan', lang: 'tr' };
    });
    return planFromIds(data.weeklyStory, 'story', texts);
  }, [data]);
  useEffect(() => {
    if (initialStory) {
      storyRef.current = initialStory;
      setStory(initialStory);
    }
  }, [initialStory]);

  useEffect(() => {
    if (!data) return;
    let alive = true;
    (async () => {
      for (const c of [...data.candidates, ...data.published]) {
        if (!alive) return;
        if (aest[c.id] !== undefined) continue;
        let m: Aesthetics | null = null;
        try {
          m = await measure(await Promise.resolve(ports.imageSrc(c)));
        } catch {
          m = null;
        }
        if (alive) setAest((prev) => ({ ...prev, [c.id]: m }));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, measure]);

  const stateOf = (lane: Lane) => (lane === 'feed' ? feedRef.current : storyRef.current);
  const markDirty = () => setPersist((p) => (p.dirty ? p : { ...p, dirty: true, status: p.status === 'saved' ? 'idle' : p.status }));
  const commit = (lane: Lane, st: PlanState) => {
    if (lane === 'feed') { feedRef.current = st; setFeed(st); } else { storyRef.current = st; setStory(st); }
    markDirty();
  };
  const ctxFor = (lane: Lane, seed?: number): PlanCtx => ({
    brand,
    ...(seed !== undefined ? { seed } : {}),
    byId: byIdRef.current,
    storyIds: stateOf(lane === 'feed' ? 'story' : 'feed').slots.filter(Boolean) as string[],
    roleOf: (i, slots) => framesOf(slots)[i]?.role ?? 'headline',
  });

  const groups = useMemo(() => [...new Set(items.filter((c) => !c.published).map((c) => c.group))].sort(), [items]);
  const selected = selId ? byId.get(selId) ?? null : null;
  const where: SlotRef | null = selected
    ? feed.slots.includes(selected.id) ? { lane: 'feed', i: feed.slots.indexOf(selected.id) }
      : story.slots.includes(selected.id) ? { lane: 'story', i: story.slots.indexOf(selected.id) } : null
    : null;
  const format: FormatId = where ? (where.lane === 'feed' ? feed : story).formats[where.i] : localFormat;
  const defaultCrop = (c: Candidate): CropState => ({ focus: FOCUS_BY_POS[c.semantic.subjectPos] ?? { x: 0.5, y: 0.5 }, zoom: 1 });
  const cropOf = (c: Candidate): CropState => crops[c.id] ?? defaultCrop(c);
  const crop: CropState | null = selected ? cropOf(selected) : null;
  const frames = framesOf(story.slots);

  const apply = (lane: Lane, r: OpResult, slot = -1) => {
    commit(lane, r.state);
    setMessages(r.message ? [{ lane, slot, text: r.message }] : []);
  };

  // ── Metin hattı (port) — GÖRSELDEN AYRI. Görsel yerleşimi hiçbir yolda modeli çağırmaz; metin yalnız açık "Metin üret" eylemiyle gelir. ──
  type Spec = { lane: Lane; i: number; candidateId: string };
  const cleanTone = (): TempTone | null => {
    const t = toneRef.current;
    const prompt = t.prompt?.replace(/\s+/g, ' ').trim().slice(0, MAX_TONE_PROMPT);
    if (!t.label && !prompt) return null;
    return { ...(t.label ? { label: t.label } : {}), ...(prompt ? { prompt } : {}) };
  };
  const buildRequest = (specs: Spec[]): CopyRequest | null => {
    const obs = (id: string) => { const o = observationOf(byIdRef.current.get(id)); return o ? { observed: o } : {}; };
    const storySlots = stateOf('story').slots.map((s, j) => specs.find((sp) => sp.lane === 'story' && sp.i === j)?.candidateId ?? s);
    const fr = framesOf(storySlots);
    const reqItems: CopyItemRequest[] = [];
    for (const sp of specs) {
      if (sp.lane === 'feed') {
        reqItems.push({ slotKey: `feed:${sp.i}`, mediaId: sp.candidateId, lane: 'feed', role: 'caption', ...obs(sp.candidateId) });
        continue;
      }
      const f = fr[sp.i];
      if (!f || f.role === 'none') continue; // metinsiz kare: istek yok
      reqItems.push({
        slotKey: `story:${sp.i}`, mediaId: sp.candidateId, lane: 'story', role: f.role, ...obs(sp.candidateId),
        ...(f.key && f.size >= 2 ? { seriesKey: f.key, seriesPosition: f.position, seriesSize: f.size } : { seriesKey: null }),
      });
    }
    if (!reqItems.length) return null;
    const requested = new Set(specs.map((s) => `${s.lane}:${s.i}`));
    const avoid: string[] = [];
    (['feed', 'story'] as Lane[]).forEach((l) => stateOf(l).texts.forEach((t, j) => { const m = mainText(t); if (m && !requested.has(`${l}:${j}`)) avoid.push(m.slice(0, 400)); }));
    const tempTone = voice.approved === true ? null : cleanTone();
    return { projectId: brand, weekStart, items: reqItems, ...(avoid.length ? { avoidTexts: avoid.slice(0, 40) } : {}), ...(tempTone ? { tempTone } : {}) };
  };

  interface CopyOutcome { texts: Map<string, SlotText>; errors: Map<string, CopyErr>; fatal?: CopyErr; note?: string }
  const requestCopy = async (specs: Spec[]): Promise<CopyOutcome> => {
    const out: CopyOutcome = { texts: new Map(), errors: new Map() };
    const req = buildRequest(specs);
    if (!req) return out;
    if (!ports.copy.available) return { ...out, fatal: { kind: 'provider_off', text: `${ports.copy.unavailableReason ?? 'Metin üretim modeli bağlı değil.'} ${GUARD}` } };
    try {
      const resp = await ports.copy.generate(req);
      const asked = new Set(req.items.map((i) => i.slotKey));
      const vs = resp.voice?.source;
      if (resp.voice?.tempToneIgnored) out.note = 'Onaylı marka dili kullanıldı; seçtiğiniz geçici ton yok sayıldı.';
      for (const a of resp.accepted) {
        if (!asked.has(a.slotKey)) continue;
        if (!resp.responseId) { out.errors.set(a.slotKey, { kind: 'error', text: `Yanıt kimliği yok; metin kabul edilmedi. ${GUARD}` }); continue; }
        out.texts.set(a.slotKey, {
          ...a.text, source: 'model', lang: 'tr', evidenceBasis: a.evidenceBasis, contentHash: a.contentHash, responseId: resp.responseId, promptVersion: resp.promptVersion,
          ...(vs ? { voiceSource: vs } : {}), ...(vs === 'temporary_tone' && resp.voice ? { assumptions: resp.voice.assumptions } : {}),
        });
      }
      for (const r of resp.rejected) if (asked.has(r.slotKey)) out.errors.set(r.slotKey, classifyRejection(r.reasons));
      for (const k of asked) if (!out.texts.has(k) && !out.errors.has(k)) out.errors.set(k, { kind: 'error', text: `Model bu slot için metin döndürmedi. ${GUARD}` });
    } catch (e) {
      out.fatal = classifyCopyError(e);
    }
    return out;
  };
  const setBusyFor = (keys: string[], on: boolean) => {
    const next = { ...busyRef.current };
    for (const k of keys) { if (on) next[k] = true; else delete next[k]; }
    busyRef.current = next;
    setBusy(next);
  };
  const setErrorsFor = (keys: string[], err: CopyErr | null) =>
    setCopyErrors((prev) => {
      const n = { ...prev };
      for (const k of keys) { if (err) n[k] = err; else delete n[k]; }
      return n;
    });
  const clearChangedErrors = (lane: Lane, before: PlanState, after: PlanState) =>
    setErrorsFor(after.slots.map((id, i) => (id !== before.slots[i] ? `${lane}:${i}` : '')).filter(Boolean), null);

  /**
   * AÇIK "Metin üret": hedef slot (veya tüm metinsiz slotlar) için gerçek model hattı. Görsel ASLA değişmez/silinmez;
   * hata, kapalı sağlayıcı (503) veya marka dili yokluğu (412) yalnız slot durumuna yazılır. Sonuç, slot hâlâ aynı görseli
   * ve aynı sürümü tutuyorsa yazılır (bayat yanıt yok sayılır). Kalsın işaretli ve metni olan çift değiştirilmez.
   */
  const generateText = async (target: { lane: Lane; i: number } | null, force = false) => {
    const lanes: Lane[] = target ? [target.lane] : ['feed', 'story'];
    const specs: Spec[] = [];
    const versions = new Map<string, number>();
    let lockedSkip = false;
    for (const lane of lanes) {
      const st = stateOf(lane);
      const fr = lane === 'story' ? framesOf(st.slots) : null;
      st.slots.forEach((id, i) => {
        if (!id || (target && target.i !== i)) return;
        const key = `${lane}:${i}`;
        if (busyRef.current[key]) return;
        if (st.texts[i] && !force) return;
        if (st.locked[i] && st.texts[i]) { lockedSkip = true; return; }
        if (fr && fr[i].role === 'none') return;
        specs.push({ lane, i, candidateId: id });
        versions.set(key, st.versions[i]);
      });
    }
    if (!specs.length) {
      if (lockedSkip) setMessages([{ lane: target!.lane, slot: target!.i, text: 'Kalsın işaretli görsel+metin çifti değişmez; önce işareti kaldırın.' }]);
      return;
    }
    const keys = specs.map((s) => `${s.lane}:${s.i}`);
    if (voice.approved === false && !cleanTone()) {
      setErrorsFor(keys, { kind: 'needs_voice', text: `Onaylı marka dili yok: bir plan tonu seçin veya marka dilini birlikte oluşturun. ${GUARD}` });
      return;
    }
    setBusyFor(keys, true);
    setErrorsFor(keys, null);
    const res = await requestCopy(specs);
    setBusyFor(keys, false);
    if (res.fatal) { setErrorsFor(keys, res.fatal); return; }
    const stale: string[] = [];
    for (const lane of lanes) {
      let cur = stateOf(lane);
      let changed = false;
      for (const sp of specs.filter((x) => x.lane === lane)) {
        const key = `${lane}:${sp.i}`;
        const text = res.texts.get(key);
        if (!text) { setErrorsFor([key], res.errors.get(key) ?? { kind: 'error', text: `Metin üretilemedi. ${GUARD}` }); continue; }
        const out = setSlotText(sp.i, sp.candidateId, text, cur, versions.get(key));
        if (out.stale) { stale.push(`${lane === 'feed' ? 'Feed' : 'Story'} slot ${sp.i + 1}`); continue; }
        cur = out.state;
        changed = true;
      }
      if (changed) commit(lane, cur);
    }
    const notes: SlotMessage[] = [];
    if (res.note) notes.push({ slot: -1, text: res.note });
    if (stale.length) notes.push({ slot: -1, text: `Slot beklerken değişti, gelen metin yok sayıldı: ${stale.join(', ')}.` });
    if (notes.length) setMessages(notes.map((n) => ({ ...n, lane: lanes[0] })));
  };

  /** Story'de rol değişince uymayan metni boşalt (hiyerarşi). Model ÇAĞRILMAZ; metin gereken kareler "henüz üretilmedi" olur. */
  const reconcileStory = () => {
    const st = stateOf('story');
    const fr = framesOf(st.slots);
    let next = st;
    const need: number[] = [];
    st.slots.forEach((id, i) => {
      if (!id || fitsRole(st.texts[i], fr[i].role)) return;
      next = { ...next, texts: next.texts.map((t, j) => (j === i ? null : t)), versions: next.versions.map((v, j) => (j === i ? v + 1 : v)) };
      if (fr[i].role !== 'none') need.push(i);
    });
    if (next === st) return;
    commit('story', next);
    if (need.length) setMessages((m) => [...m, ...need.map((i) => ({ lane: 'story' as Lane, slot: i, text: 'Seri değişti: bu karenin metni yeniden üretilmeli (Metin üret).' }))]);
  };

  /** Plan oluştur / kalanları yeniden öner: YALNIZ görsel plan. İlk basış en iyi planı kurar; sonraki basışlar tohumla (sert kısıt, komşu uyumu, yayın geçmişi ve Kalsın korunarak) varyasyon verir. */
  const onGenerate = (lane: Lane, regen: boolean) => {
    const before = stateOf(lane);
    const seed = regen || before.slots.some(Boolean) ? ++seedRef.current : undefined;
    const r = generate(before, ctxFor(lane, seed), regen);
    commit(lane, r.state);
    clearChangedErrors(lane, before, r.state);
    setMessages(r.messages.map((m) => ({ ...m, lane })));
    if (lane === 'story') reconcileStory();
  };

  const mirrorDismissed = (lane: Lane, id: string | null | undefined) => {
    if (!id) return;
    const other: Lane = lane === 'feed' ? 'story' : 'feed';
    const o = stateOf(other);
    commit(other, { ...o, dismissed: [...new Set([...o.dismissed, id])] });
  };

  /** Tek slot görseli: ele ve yenisini getir / başka adayla değiştir / boşu doldur. Model ÇAĞRILMAZ; yeni görsel metinsiz gelir (eski metin taşınmaz). Hata/alternatif yok → mevcut öneri aynen kalır. */
  const refreshSlot = (lane: Lane, i: number, mode: ProposeMode, expected?: number) => {
    const key = `${lane}:${i}`;
    if (busyRef.current[key]) return;
    const before = stateOf(lane);
    const base = ctxFor(lane);
    const ctx = qa === 'error' ? { ...base, byId: new ThrowingMap(base.byId) } : base;
    const old = before.slots[i];
    let out: OpResult;
    if (mode === 'fill') {
      const prop = proposeSlot(i, 'fill', before, ctx, expected);
      if (!prop.ok) { setMessages([{ lane, slot: i, text: prop.message }]); return; }
      out = assignToSlot(prop.candidateId, i, before, ctx, prop.version);
    } else {
      out = mode === 'dismiss' ? dismissSlot(i, before, ctx, expected) : replaceSlot(i, before, ctx, expected);
    }
    apply(lane, out, i);
    if (out.message || out.stale) return;
    setErrorsFor([key], null);
    if (mode === 'dismiss') mirrorDismissed(lane, old);
    if (lane === 'story') reconcileStory();
  };

  const onRestore = (lane: Lane, seq: number) => {
    const st = stateOf(lane);
    const entry = st.history.find((h) => h.seq === seq);
    apply(lane, restoreFromHistory(seq, st, ctxFor(lane), entry ? st.versions[entry.slot] : undefined), entry?.slot ?? -1);
    if (lane === 'story') reconcileStory();
  };
  const onFormat = (f: FormatId) => {
    if (where) apply(where.lane, setSlotFormat(where.i, f, stateOf(where.lane), ctxFor(where.lane)), where.i);
    else {
      setLocalFormat(f);
      setNotice('Önizleme biçimi değişti. Plana kaydetmek için öğeyi bir slota atayın.');
    }
  };
  const setCrop = (patch: Partial<CropState>) => {
    if (!selected || !crop) return;
    setCrops((prev) => ({ ...prev, [selected.id]: { ...crop, ...patch } }));
    markDirty();
  };
  /** Seçili (veya ilk boş) slota görseli HEMEN geçerli bir taslak olarak yerleştirir; model çağrılmaz, metin ayrı eylemdir. */
  const assign = (id: string) => {
    const target: SlotRef | null = selSlot ?? (() => {
      const i = feedRef.current.slots.findIndex((s, j) => !s && !feedRef.current.locked[j]);
      return i >= 0 ? { lane: 'feed' as Lane, i } : null;
    })();
    if (!target) { setMessages([{ lane: 'feed', slot: -1, text: 'Boş/kilitsiz slot yok; bir slot seçin.' }]); return; }
    setSelSlot(target);
    const st = stateOf(target.lane);
    const key = `${target.lane}:${target.i}`;
    if (busyRef.current[key]) return;
    const out = assignToSlot(id, target.i, st, ctxFor(target.lane), st.versions[target.i]);
    apply(target.lane, out, target.i);
    if (out.message || out.stale) return;
    setErrorsFor([key], null);
    if (target.lane === 'story') reconcileStory();
  };
  const startReject = (id: string) => {
    setRejecting(id);
    setReasonDraft(EMPTY_REASON);
  };
  const confirmReject = async () => {
    if (!rejecting || !reasonDraft.category) return;
    const id = rejecting;
    const lane: Lane = stateOf('story').slots.includes(id) ? 'story' : 'feed';
    const slot = stateOf(lane).slots.indexOf(id);
    const r = rejectItem(id, stateOf(lane), ctxFor(lane), false);
    commit(lane, r.state);
    const other: Lane = lane === 'feed' ? 'story' : 'feed';
    commit(other, { ...stateOf(other), rejected: [...new Set([...stateOf(other).rejected, id])] });
    setReasons((prev) => ({ ...prev, [id]: { ...reasonDraft, at: new Date().toISOString() } }));
    setRejecting(null);
    setMessages([]);
    if (slot >= 0) refreshSlot(lane, slot, 'fill');
  };
  const undoReject = (id: string) => {
    (['feed', 'story'] as Lane[]).forEach((l) => commit(l, { ...stateOf(l), rejected: stateOf(l).rejected.filter((x) => x !== id) }));
    setReasons((prev) => {
      const { [id]: removed, ...rest } = prev;
      void removed;
      return rest;
    });
  };

  // ── Kalıcı taslak (yalnız ports.persistence varsa) ──
  const buildDraft = () => {
    const rej: Record<string, RejectionReason> = Object.fromEntries(Object.entries(reasonsRef.current).map(([id, r]) => [id, { category: r.category, note: r.note, scope: r.scope }]));
    const st = storyRef.current;
    const fr = framesOf(st.slots);
    return encodeDraft({
      weekStart, feed: feedRef.current, story: st, crops: cropsRef.current, rejections: rej,
      storySeriesKeys: st.slots.map((id, i) => (id && fr[i]?.key ? fr[i].key : null)),
    });
  };

  const loadSaved = useCallback(async () => {
    if (!ports.persistence || !weekStart) return;
    setPersist((p) => ({ ...p, status: 'loading', message: undefined }));
    try {
      const got = await ports.persistence.load(weekStart);
      if (!got) { setPersist({ version: 0, status: 'idle', dirty: false }); return; }
      const d = decodeDraft(got.draft, byIdRef.current);
      feedRef.current = d.feed; storyRef.current = d.story;
      setFeed(d.feed); setStory(d.story); setCrops(d.crops);
      setReasons(Object.fromEntries(Object.entries(d.rejections).map(([id, r]) => [id, { ...r, at: '' } as Rejection])));
      setMessages(d.dropped.map((x) => ({ lane: x.lane, slot: x.slot, text: `Kayıtlı medya (${x.mediaId}) envanterde bulunamadı; slot boşaltıldı.` })));
      lastSave.current = null;
      setPersist({ version: got.version, status: 'saved', dirty: false, message: `Kayıtlı taslak yüklendi (sürüm ${got.version}).` });
    } catch (e) {
      setPersist((p) => ({ ...p, status: 'error', message: `Taslak yüklenemedi: ${describeError(e)}` }));
    }
  }, [ports.persistence, weekStart]);

  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!data || loadedOnce.current || !ports.persistence || !weekStart || Object.keys(aest).length < items.length) return;
    loadedOnce.current = true;
    void loadSaved();
  }, [data, ports.persistence, weekStart, aest, items.length, loadSaved]);

  const onSave = async () => {
    if (!ports.persistence) return;
    const enc = buildDraft();
    if (!enc.ok) { setPersist((p) => ({ ...p, status: 'error', message: `Kaydedilemedi: ${enc.errors.slice(0, 3).join(' · ')}` })); return; }
    const hash = sha256Hex(JSON.stringify({ v: persist.version, d: enc.draft }));
    // Aynı yükle yeniden deneme AYNI anahtarı kullanır (çift kayıt olmaz); yük değişince yeni anahtar
    const key = lastSave.current?.hash === hash ? lastSave.current.key : newKey();
    lastSave.current = { hash, key };
    setPersist((p) => ({ ...p, status: 'saving', message: undefined }));
    try {
      const r = await ports.persistence.save({ weekStart, expectedVersion: persist.version, idempotencyKey: key, draft: enc.draft });
      lastSave.current = null;
      setPersist({ version: r.version, status: 'saved', dirty: false, message: `Sunucuya kaydedildi (sürüm ${r.version}).` });
    } catch (e) {
      if (e instanceof PortError && e.code === 'version_conflict') setPersist((p) => ({ ...p, status: 'conflict', message: 'Taslak başka bir yerde değişmiş. Güncel sürümü yükleyin (yerel değişiklikler atılır).' }));
      else setPersist((p) => ({ ...p, status: 'error', message: `Kaydedilemedi: ${describeError(e)}` }));
    }
  };

  if (loadError) return <main className="shell"><p className="err">{loadError}</p></main>;
  if (!data) return <main className="shell"><p>Yükleniyor…</p></main>;

  const measuredDone = Object.keys(aest).length;
  const measuredOk = Object.values(aest).filter(Boolean).length;
  const ready = measuredDone >= items.length;
  const feedPlaced = feed.slots.filter(Boolean).length;
  const shownFeed = items.filter((c) => !c.published && (groupFilter === 'all' || c.group === groupFilter));
  const rejectedList = feed.rejected;
  const anyBusy = Object.keys(busy).length > 0;
  const roleAt = (lane: Lane, i: number): SeriesFrame['role'] | 'caption' => (lane === 'feed' ? 'caption' : frames[i]?.role ?? 'headline');
  const incomplete = (['feed', 'story'] as Lane[]).reduce((n, l) => {
    const st = l === 'feed' ? feed : story;
    return n + st.slots.filter((id, i) => id && roleAt(l, i) !== 'none' && !st.texts[i]).length;
  }, 0);
  const hierarchyProblems = validateHierarchy(story.texts, frames.map((f) => f.role));
  const reservedFor = (lane: Lane, slot: number) => new Set([...ctxFor(lane).storyIds, ...(lane === 'feed' ? feed : story).slots.filter((id, j) => j !== slot && id).map((id) => id as string)]);
  const scored = selected && where
    ? scoreCandidate(
        selected,
        format,
        neighborSlots(where.i, where.lane).map((j) => (where.lane === 'feed' ? feed : story).slots[j]).map((id) => (id ? byId.get(id) : undefined)).filter((c): c is Candidate => !!c),
        (where.lane === 'feed' ? feed : story).slots.filter((id, j) => j !== where.i && id).map((id) => byId.get(id as string)).filter((c): c is Candidate => !!c),
        items.filter((c) => c.published && c.brand === brand),
      )
    : null;
  const hard = selected
    ? hardCheck(selected, format, { brand, rejected: new Set(rejectedList), inPlan: reservedFor(where?.lane ?? 'feed', where?.i ?? -1) })
    : null;

  const closeMenu = (lane: Lane, i: number) => {
    setMenu(null);
    setTimeout(() => document.querySelector<HTMLElement>(`[data-menu-trigger="${lane}-${i}"]`)?.focus(), 0);
  };

  const renderSlot = (lane: Lane, i: number) => {
    const st = lane === 'feed' ? feed : story;
    const id = st.slots[i];
    const c = id ? byId.get(id) : null;
    const f = st.formats[i];
    const on = selSlot?.lane === lane && selSlot.i === i;
    const meta = lane === 'story' ? byId.get(data.weeklyStory[i])?.weekFrame : null;
    const text = st.texts[i];
    const version = st.versions[i];
    const role = roleAt(lane, i);
    const frame = lane === 'story' ? frames[i] : null;
    const key = `${lane}:${i}`;
    const isBusy = !!busy[key];
    const menuOpen = menu?.lane === lane && menu.i === i;
    const expected = menu?.version ?? version;
    const locked = st.locked[i];
    const needsText = !!c && role !== 'none' && !text;
    const err = copyErrors[key];
    const tempTone = text?.voiceSource === 'temporary_tone';
    const menuItems: MenuItem[] = c
      ? [
          { label: locked ? 'Kalsın işaretini kaldır' : 'Kalsın', onSelect: () => apply(lane, toggleLock(i, stateOf(lane), !locked, expected), i) },
          { label: 'Ele ve yenisini getir', disabled: isBusy, onSelect: () => refreshSlot(lane, i, 'dismiss', expected) },
          { label: 'Başka adayla değiştir', disabled: isBusy, onSelect: () => refreshSlot(lane, i, 'replace', expected) },
          { label: 'Gerekçeyle reddet…', onSelect: () => startReject(c.id) },
        ]
      : [];
    return (
      <div
        key={key}
        className={`cell ${locked ? 'locked' : ''} ${on ? 'sel' : ''} ${lane}`}
        data-testid={`${lane}-slot-${i}`}
        aria-busy={isBusy}
        onContextMenu={(e) => {
          if (!c) return;
          e.preventDefault();
          setSelSlot({ lane, i });
          setMenu({ lane, i, version });
        }}
      >
        {c ? (
          <button className="pick" onClick={() => { setSelId(c.id); setSelSlot({ lane, i }); setShowPanels(true); }} aria-label={`${lane === 'feed' ? 'Feed' : 'Story'} slot ${i + 1}: ${c.id} incele`}>
            {lane === 'story' ? (
              <StoryCanvas c={c} focus={cropOf(c).focus} zoom={cropOf(c).zoom} text={text} role={role === 'caption' ? 'headline' : role} aesthetics={c.aesthetics} />
            ) : (
              <CroppedImage c={c} format={f} focus={cropOf(c).focus} zoom={cropOf(c).zoom} />
            )}
          </button>
        ) : (
          <button className="pick empty" onClick={() => { setSelSlot({ lane, i }); setShowPanels(true); }} aria-label={`${lane === 'feed' ? 'Feed' : 'Story'} slot ${i + 1} seç`} style={{ aspectRatio: `${FORMATS[f].w}/${FORMATS[f].h}` }}>
            Slot {i + 1} boş{on ? ' · seçili' : ''}
          </button>
        )}
        <div className="cellbar">
          <span>{meta ? `${meta.day.split(' ')[0]} · kare ${meta.frame}` : `#${i + 1}`} · {FORMATS[f].label}{locked ? ' · kalsın' : ''}</span>
          {frame && c && (
            <span className="seri" data-testid={`seri-${i}`} title="Seri yalnız gerçek ürün kimliğinden veya planın açık seri adından kurulur; aynı gün olmak seri değildir.">
              {frame.key ? `seri: ${frame.key} (${frame.position + 1}/${frame.size})` : 'tek kare'}
            </span>
          )}
          {lane === 'feed' && text?.caption && (
            <span className="caption" data-testid={`caption-${i}`}><em className="tag">{sourceTag(text)}</em> {text.caption}</span>
          )}
          {tempTone && (
            <span className="assume small" data-testid={`assume-${key}`}>
              Varsayım: yalnız ölçülen görsel özellik ve seçilen geçici tondan türetildi; ürün/içerik doğrulanmadı. Onaylı marka dili değildir.
            </span>
          )}
          {isBusy && <span className="status" data-testid={`status-${key}`}>Metin üretiliyor…</span>}
          {!isBusy && err && <span className="status err" data-testid={`status-${key}`} data-kind={err.kind}>{err.text}</span>}
          {!isBusy && !err && needsText && <span className="status" data-testid={`status-${key}`} data-kind="pending">Metin henüz üretilmedi</span>}
          {c && (
            <>
              <button aria-label={`${lane} slot ${i + 1} ${locked ? 'kalsın işaretini kaldır' : 'kalsın'}`} aria-pressed={locked} onClick={() => apply(lane, toggleLock(i, stateOf(lane), !locked, version), i)}>{locked ? 'Kalsın ✓' : 'Kalsın'}</button>
              {role !== 'none' && (
                <button data-testid={`gen-${key}`} aria-label={`${lane} slot ${i + 1} ${text ? 'metni yenile' : 'metin üret'}`} disabled={isBusy || (locked && !!text)} onClick={() => void generateText({ lane, i }, !!text)}>{text ? 'Metni yenile' : 'Metin üret'}</button>
              )}
              <button data-testid={`next-${key}`} aria-label={`${lane} slot ${i + 1} ele ve yenisini getir`} title="Bu öneriyi ele, yenisini getir (sağ tık menüsüyle aynı)" disabled={isBusy || locked} onClick={() => refreshSlot(lane, i, 'dismiss', version)}>Yenisini getir</button>
              <button
                className="dots"
                data-menu-trigger={`${lane}-${i}`}
                aria-label={`${lane} slot ${i + 1} menü`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => { setSelSlot({ lane, i }); setMenu(menuOpen ? null : { lane, i, version }); }}
                onKeyDown={(e) => { if (e.key === 'ArrowDown' && !menuOpen) { e.preventDefault(); setMenu({ lane, i, version }); } }}
              >
                ⋯
              </button>
            </>
          )}
        </div>
        {menuOpen && c && <SlotMenu items={menuItems} label={`Slot ${i + 1} işlemleri`} onClose={() => closeMenu(lane, i)} />}
      </div>
    );
  };

  const persistLabel = !ports.persistence
    ? 'Kalıcılık yok (yerel inceleme): değişiklikler yalnız bellekte; sayfa yenilenince kaybolur.'
    : persist.status === 'saving' ? 'Kaydediliyor…'
    : persist.status === 'loading' ? 'Kayıtlı taslak yükleniyor…'
    : persist.dirty ? `Kaydedilmemiş değişiklik (kayıtlı sürüm ${persist.version || 'yok'})`
    : persist.version ? `Sunucuda kayıtlı sürüm ${persist.version}` : 'Henüz kaydedilmedi';

  const withText = (['feed', 'story'] as Lane[]).reduce((n, l) => n + (l === 'feed' ? feed : story).texts.filter(Boolean).length, 0);
  const placedAll = feedPlaced + story.slots.filter(Boolean).length;
  const toneOn = (l: ToneLabel) => planTone.label === l;
  const voiceNeeded = voice.approved === false;
  const sourceTag = (t: SlotText) => (t.source === 'plan' ? 'plan metni' : t.source === 'model' ? (t.voiceSource === 'temporary_tone' ? 'geçici ton taslağı' : t.voiceSource === 'approved_guide' ? 'marka rehberi · TR' : 'model · TR') : t.source === 'manual' ? 'elle' : 'şablon (test)');

  return (
    <ImageSrcContext.Provider value={ports.imageSrc}>
      <main className="shell home">
        <header className="top">
          <div>
            <h1>{data.title}</h1>
            <p className="muted">{data.dateLabel} · <span className="badge">TASLAK{ports.mode === 'review' ? ' · yerel önizleme' : ''}</span></p>
          </div>
          <div className="actions">
            <button className="primary big" onClick={() => onGenerate('feed', false)} disabled={!ready || anyBusy} title={ready ? undefined : 'Ölçümler tamamlanana kadar kapalı'} data-testid="make-plan">Post planı oluştur</button>
            {ports.persistence && <button onClick={() => void onSave()} disabled={persist.status === 'saving' || anyBusy || !persist.dirty} data-testid="save-draft">Taslağı kaydet</button>}
            <button onClick={() => setShowPanels(!showPanels)} aria-expanded={showPanels} data-testid="toggle-panels">Kütüphane ve inceleme</button>
          </div>
        </header>
        {!ready && <p className="counts" role="status">Ölçüm sürüyor ({measuredDone}/{items.length}): plan eksik değerlendirilmesin diye düğme kapalı.</p>}
        <p className="counts" data-testid="persist-status">{persistLabel}{persist.message ? ` — ${persist.message}` : ''}
          {persist.status === 'conflict' && <button onClick={() => void loadSaved()}>Güncel sürümü yükle</button>}
        </p>
        {qa && <div className="qa" role="note" data-testid="qa-banner">{QA_LABEL[qa]}</div>}

        <div className={`cols ${showPanels ? 'with-panels' : 'no-panels'}`}>
          <section className="center" aria-label="Plan">
            {messages.length > 0 && (
              <div className="shortage" role="status">
                {messages.map((m, k) => <p key={k}>{m.slot >= 0 ? `${m.lane === 'feed' ? 'Feed' : 'Story'} slot ${m.slot + 1}: ` : ''}{m.text}</p>)}
              </div>
            )}

            {rejecting && (
              <div className="rejectbox" role="dialog" aria-label="Ret gerekçesi">
                <strong>Reddet: {rejecting}</strong>
                <FeedbackReasonFields value={reasonDraft} onChange={setReasonDraft} notePlaceholder="Kısa açıklama" />
                <p className="small muted">Gerekçe {ports.persistence ? "taslakla birlikte sunucuya kaydedilir (Kaydet'e basınca)" : 'yalnız bu yerel oturumda tutulur'}; marka hafızasına yazılmaz.</p>
                <div className="actions">
                  <button className="primary" onClick={() => void confirmReject()} disabled={!reasonDraft.category}>Reddi kaydet</button>
                  <button onClick={() => setRejecting(null)}>Vazgeç</button>
                </div>
              </div>
            )}

            <div className="lanehead">
              <h2>Hikâyeler</h2>
            </div>
            {hierarchyProblems.length > 0 && <p className="warn" role="alert">{hierarchyProblems.join(' · ')}</p>}
            <div className="strip" aria-label="Story serisi">
              {Array.from({ length: FEED_SLOTS }, (_, i) => renderSlot('story', i))}
            </div>

            <h2>Instagram feed · 3 sütun ({feedPlaced}/{FEED_SLOTS})</h2>
            <div className="feed" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}>
              {Array.from({ length: FEED_SLOTS }, (_, i) => renderSlot('feed', i))}
            </div>

            <section className="textpanel" aria-label="Metin" data-testid="text-panel">
              <div className="textrow">
                <p className="small" data-testid="text-summary">
                  {placedAll === 0 ? 'Önce görsel planı oluşturun; metin ayrı bir adımdır.' : `${placedAll} görsel yerleşti · ${withText} metin hazır${incomplete > 0 ? ` · ${incomplete} görselin metni henüz üretilmedi` : ''}`}
                </p>
                <button className="primary" onClick={() => void generateText(null)} disabled={incomplete === 0 || anyBusy} data-testid="gen-text">
                  Metinleri üret{incomplete > 0 ? ` (${incomplete})` : ''}
                </button>
              </div>
              {!ports.copy.available && (
                <div className="shortage" role="alert" data-testid="copy-unavailable">
                  <strong>Metin üretimi kapalı.</strong> {ports.copy.unavailableReason} Görsel plan etkilenmez.
                </div>
              )}
              {voice.approved === true && <p className="small muted" data-testid="voice-approved">Marka dili: onaylı rehber kullanılır.</p>}
              {voice.approved !== true && (
                <div className="tonebox" data-testid="tone-panel">
                  <strong className="small">Plan tonu {voiceNeeded ? '(onaylı marka dili yok)' : '(isteğe bağlı)'}</strong>
                  <div className="chips" role="group" aria-label="Plan tonu">
                    {TONE_KEYS.map((t) => (
                      <button key={t} className={`chipbtn ${toneOn(t) ? 'on' : ''}`} aria-pressed={toneOn(t)} data-testid={`tone-chip-${t}`} onClick={() => setPlanTone((cur) => ({ ...cur, label: cur.label === t ? undefined : t }))}>{TONE_LABEL_TR[t]}</button>
                    ))}
                  </div>
                  <label className="field">Serbest ton tarifi (isteğe bağlı)
                    <input type="text" maxLength={MAX_TONE_PROMPT} value={planTone.prompt ?? ''} onChange={(e) => setPlanTone((cur) => ({ ...cur, prompt: e.target.value }))} placeholder="ör. sıcak, kısa cümleler" data-testid="tone-prompt" />
                  </label>
                  <p className="small muted">Bu ton GEÇİCİDİR; onaylı marka hafızası değildir ve kaydedilmez. Metin yalnız fotoğrafta ölçülen/gözlenen özelliklerden ve bu tondan türetilir; ürün, içerik, fiyat, saat uydurulmaz. Varsayımlar işaretlenir.</p>
                  {onStartGuide && <button onClick={onStartGuide} data-testid="start-guide">Marka dilini birlikte oluştur</button>}
                </div>
              )}
            </section>

            <details className="advanced" data-testid="advanced">
              <summary>Gelişmiş ayarlar</summary>
              <div className="actions">
                <button onClick={() => onGenerate('feed', true)} disabled={feedPlaced === 0 || !ready || anyBusy}>Kalanları yeniden öner</button>
                <button onClick={() => onGenerate('story', false)} disabled={!ready || anyBusy}>Story oluştur</button>
                <button onClick={() => onGenerate('story', true)} disabled={!ready || anyBusy}>Story: kalanları yeniden öner</button>
                {data.weeklyStory.length > 0 && <button onClick={() => { commit('story', initialStory ?? planFromIds(data.weeklyStory, 'story')); setMessages([]); }}>Haftalık plana dön</button>}
              </div>
              <p className="counts" data-testid="counts">
                Aday havuzu <strong>{data.candidates.length}</strong> · Arşiv (ayrı, havuza girmez) <strong>{data.published.length}</strong> · Ölçüm {measuredDone}/{items.length}
              </p>
              <div className="notice" role="note">
                <strong>{ports.mode === 'review' ? 'Yerel snapshot · model çalışmadı · canlı kütüphane bağlı değil.' : 'Studio · gerçek kütüphane ve katalog.'}</strong> {data.candidates.length} aday + {data.published.length} arşiv; ölçülen {measuredOk}/{items.length}.
                <details>
                  <summary>Ayrıntılar</summary>
                  <p>{data.scope}</p>
                  <p>{data.archiveNote}</p>
                  {data.inventoryNotes?.map((n) => <p key={n}>{n}</p>)}
                  <p>Ölçümler piksel istatistikleridir; anlamsal alanlar yalnız katalog/notlardan çıkarılır, yoksa "bilinmiyor" yazılır. Skorlar editoryal sezgiseldir, kalite ölçüsü değildir. Plan kurulurken palet, parlaklık, renk dengesi, yoğunluk, boş alan, kırpma ve komşu görsel ritmi/uyumu değerlendirilir; yayın geçmişi ve Kalsın korunur. Yeniden öneride küçük bir tohumlu varyasyon yalnız bu ölçütlerde en iyiye çok yakın adaylar arasında seçim yapar.</p>
                  <p><strong>Görsel ve metin ayrıdır:</strong> görsel yerleşimi (otomatik, elle atama, ele-yenile) modeli ÇAĞIRMAZ. Metin yalnız "Metin üret" ile, gerçek model hattından (onaylı marka dili varsa onunla, yoksa seçtiğiniz geçici tonla), Türkçe gelir; sunucu çıktıyı doğrular (Türkçe, kanıt, ürün/malzeme/fiyat/saat uydurma yok). Metin üretimi kapalı/hatalıysa görsel plan korunur. Yeni görsele eski metin taşınmaz; Kalsın görsel+metin çiftini korur.</p>
                  <p><strong>Story serisi:</strong> yalnız gerçek ürün kimliğinden (insan doğrulamalı) veya planın açık seri adından kurulur; aynı gün olmak seri değildir. Kimliği olmayan kare tek karelik seridir.</p>
                  <p><strong>Kalıcılık:</strong> {ports.persistence ? 'Sunucuya yazılır: görsel seçimi, format, metin (varsa), kırpma/odak, Kalsın, eleme ve gerekçeli ret. Metinsiz taslak da kaydedilir. Kırpma ve Story görsel üstü metni post şemasında YOKTUR; taslaktan post oluşturulurken taşınmaz.' : 'Yerel incelemede kalıcılık yoktur; hiçbir şey kaydedilmez.'}</p>
                  <p><strong>Yazı tipi:</strong> {LOCAL_FONT_NOTE}</p>
                </details>
              </div>
            </details>

            <details className="advanced">
              <summary>Elenen taslak öneriler · yerel geçmiş ({feed.history.length + story.history.length})</summary>
              <p className="muted small">Yalnız taslak öneri elenir; kaynak medya ve arşiv silinmez. Elenen aday otomatik geri gelmez; buradan geri getirebilirsiniz.</p>
              <div data-testid="history">
                {feed.history.length + story.history.length === 0 && <p className="small muted">Henüz elenen yok.</p>}
                {(['feed', 'story'] as Lane[]).flatMap((lane) =>
                  (lane === 'feed' ? feed : story).history.map((h) => {
                    const hc = byId.get(h.candidateId);
                    return (
                      <div key={`${lane}-${h.seq}`} className="histrow">
                        {hc && <PlannerImg c={hc} />}
                        <span className="small">{lane === 'feed' ? 'Feed' : 'Story'} slot {h.slot + 1} · {h.candidateId}{h.text?.caption || h.text?.headline ? ` · "${h.text.caption ?? h.text.headline}"` : ''}</span>
                        <button aria-label={`geri getir ${h.candidateId}`} onClick={() => onRestore(lane, h.seq)}>Geri getir</button>
                      </div>
                    );
                  }),
                )}
              </div>
            </details>

            <details className="advanced">
              <summary>Yayımlanmış geçmiş · arşiv (ayrı, canlı senkron değil)</summary>
              <div className="strip" aria-label="Yayımlanmış geçmiş">
                {items.filter((c) => c.published).map((c) => (
                  <button key={c.id} className="story past" onClick={() => { setSelId(c.id); setShowPanels(true); }}>
                    <PlannerImg c={c} />
                    <span>{c.date}</span>
                  </button>
                ))}
                {items.filter((c) => c.published).length === 0 && <p className="small muted">Bu ekranda yayın geçmişi bağlı değil.</p>}
              </div>
            </details>
          </section>

          <aside className="panel right" aria-label="Seçili öğe">
            {!selected && <p className="muted">Bir öğe seçin: kütüphaneden, slottan veya şeritten.</p>}
            {selected && crop && (
              <>
                <h2>{selected.id}</h2>
                <p className="muted small">{selected.provenance}</p>
                <p className="small">Kaynak: {selected.dims.w}×{selected.dims.h} ({selected.dimsSource})</p>
                {selected.weekFrame && <p className="small muted">Plan metni (değişmez): {selected.weekFrame.copy || '(metinsiz)'}</p>}
                {!selected.published && (
                  <div className="actions">
                    <button onClick={() => assign(selected.id)} aria-label="Seçili slota ata">Seçili slota ata{selSlot ? ` (${selSlot.lane === 'feed' ? 'Feed' : 'Story'} ${selSlot.i + 1})` : ''}</button>
                    {!rejectedList.includes(selected.id) && <button onClick={() => startReject(selected.id)}>Reddet…</button>}
                  </div>
                )}

                <fieldset className="field">
                  <legend>Biçim {where ? '(slota kaydedilir)' : '(önizleme)'}</legend>
                  {(Object.keys(FORMATS) as FormatId[]).map((f) => (
                    <label key={f} className="radio"><input type="radio" name="fmt" disabled={where?.lane === 'story' && f !== 'story'} checked={format === f} onChange={() => onFormat(f)} /> {FORMATS[f].label}</label>
                  ))}
                </fieldset>
                {notice && <p className="small muted">{notice}</p>}

                <div className="cropbox">
                  <div className="cropframe" data-testid="cropframe" onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setCrop({ focus: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } });
                  }}>
                    <PlannerImg c={selected} />
                    {(() => {
                      const rc = cropRect(selected.dims, ratioOf(format), crop.focus, crop.zoom);
                      return <div className="overlay" style={{ left: `${(rc.x / selected.dims.w) * 100}%`, top: `${(rc.y / selected.dims.h) * 100}%`, width: `${(rc.w / selected.dims.w) * 100}%`, height: `${(rc.h / selected.dims.h) * 100}%` }} />;
                    })()}
                  </div>
                  <div className="previewcol">
                    <span className="small muted">Sonuç</span>
                    <CroppedImage c={selected} format={format} focus={crop.focus} zoom={crop.zoom} />
                  </div>
                </div>
                <label className="field">Yakınlaştırma {crop.zoom.toFixed(2)}×
                  <input type="range" aria-label="Yakınlaştırma" min={1} max={2.5} step={0.05} value={crop.zoom} onChange={(e) => setCrop({ zoom: Number(e.target.value) })} />
                </label>
                <p className="small">Kırpma: {(() => { const rc = cropRect(selected.dims, ratioOf(format), crop.focus, crop.zoom); return `x${rc.x} y${rc.y} · ${rc.w}×${rc.h} px · görünen kesir ${pct(coverage(selected.dims, ratioOf(format)))}`; })()}</p>
                <p className="small muted">{ports.persistence ? 'Kırpma/odak taslakla birlikte kaydedilir; post şemasında yoktur, taslaktan post oluşturulurken taşınmaz.' : 'Kırpma yalnız bellekte (kalıcılık yok).'}</p>
                {hard && <p className="warn">Bu biçimde uygun değil: {HARD_LABEL[hard]}</p>}
                {reasons[selected.id] && <p className="warn">Reddedildi · {categoryLabel(reasons[selected.id].category)}{reasons[selected.id].note ? `: ${reasons[selected.id].note}` : ''} <button onClick={() => undoReject(selected.id)}>Reddi geri al</button></p>}

                <details>
                  <summary>Estetik ölçüm ve anlamsal alanlar</summary>
                  {selected.aesthetics?.measured ? (
                    <div className="aes">
                      <div className="swatches">{selected.aesthetics.palette.map((p) => <span key={p} title={p} style={{ background: p }} />)}</div>
                      <p className="small">Parlaklık {pct(selected.aesthetics.brightness)} · Ton {tone(selected.aesthetics.warmth)} · Kontrast {pct(selected.aesthetics.contrast)}</p>
                      <p className="small">Yoğunluk {pct(selected.aesthetics.density)} · Boş alan {pct(selected.aesthetics.negativeSpace)} ({selected.aesthetics.negativeZone})</p>
                    </div>
                  ) : <p className="small muted">{aest[selected.id] === null ? 'Ölçülemedi' : 'Ölçülüyor…'}</p>}
                  <p className="small">Çekim ölçeği: {selected.semantic.shotScale} · Ana konu: {selected.semantic.subjectPos} · Kaynak: {selected.semantic.source === 'nottan' ? 'metin notu' : selected.semantic.source === 'katalog' ? 'Studio kataloğu' : 'bilinmiyor'}</p>
                  <p className="small">Yüz/insan: {selected.humanPresence} · AI izi: {selected.aiMark}{selected.productId ? ` · doğrulanmış ürün: ${selected.productId}` : ''}</p>
                </details>

                {scored && (
                  <details>
                    <summary>Puan (sezgisel): {scored.total}/100{scored.known < 7 ? ` · kısmi ${scored.known}/7` : ''}</summary>
                    <p className="small">{scored.warnings.join(' · ')}</p>
                    {scored.missing.length > 0 && <p className="small muted">Ölçüm yok: {scored.missing.join(', ')}</p>}
                    <ul className="small">
                      {(Object.keys(PART_LABEL) as PartKey[]).map((k) => (
                        <li key={k}>{PART_LABEL[k]}: {scored.parts[k] === null ? 'bilinmiyor' : scored.parts[k]!.toFixed(2)}</li>
                      ))}
                    </ul>
                    {scored.repetitionNote && <p className="small">{scored.repetitionNote}</p>}
                  </details>
                )}
              </>
            )}
          </aside>

          <aside className="panel left" aria-label="Kütüphane">
            <h2>Kütüphane ({shownFeed.length})</h2>
            <label className="field">Grup
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                <option value="all">Tümü</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <ul className="lib">
              {shownFeed.map((c) => {
                const inFeed = feed.slots.indexOf(c.id);
                const inStory = story.slots.indexOf(c.id);
                const label = inFeed >= 0 ? `Feed #${inFeed + 1}` : inStory >= 0 ? `Story #${inStory + 1}` : rejectedList.includes(c.id) ? 'Reddedildi' : '';
                return (
                  <li key={c.id}>
                    <div className={`libitem ${selId === c.id ? 'on' : ''}`}>
                      <button className="libpick" onClick={() => setSelId(c.id)} aria-label={`${c.id} incele`}>
                        <PlannerImg c={c} loading="lazy" />
                        <span className="meta"><span>{c.kind === 'video_cover' ? 'Video kapağı' : c.group}</span><span className="chip">{label}</span></span>
                      </button>
                      <button className="assign" aria-label={`${c.id} slota ata`} onClick={() => { setSelId(c.id); assign(c.id); }}>Ata</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </main>
    </ImageSrcContext.Provider>
  );
}
