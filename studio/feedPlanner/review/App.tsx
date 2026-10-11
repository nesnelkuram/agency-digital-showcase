import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Aesthetics, Candidate, FormatId, SlotText } from '../types';
import { FORMATS } from '../types';
import { cropRect, coverage, ratioOf, type Focus } from '../crop';
import { hardCheck, scoreCandidate, PART_LABEL, HARD_LABEL, type PartKey } from '../scorer';
import {
  emptyPlan, planFromIds, generate, toggleLock, proposeSlot, commitSuggestion, setSlotText, rejectItem, setSlotFormat, assignToSlot, restoreFromHistory, neighborSlots,
  FEED_SLOTS, GRID_COLS, type Lane, type PlanState, type PlanCtx, type SlotMessage, type OpResult, type ProposeMode,
} from '../planner';
import { seriesFrames, validateHierarchy, LOCAL_FONT_NOTE, type SeriesFrame } from '../storyLayout';
import { ThrowingMap, QA_LABEL, exhaustedPool, type QaMode } from '../qaScenario';
import { encodeDraft, decodeDraft, type CropState, type RejectionReason } from '../draftCodec';
import { PortError, reviewPorts, type PlannerPorts } from '../ports';
import { sha256Hex } from '../../../shared/planner/sha256';
import type { CopyItemRequest, CopyRequest } from '../../../shared/planner/copyContract';
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

/** Role uyan metin mi (Story hiyerarşisi): başlık yalnız ilk karede; devamda yalnız küçük açıklama; metinsiz karede metin yok. */
const fitsRole = (t: SlotText | null, role: SeriesFrame['role']): boolean =>
  role === 'headline' ? !!t?.headline && !t.caption : role === 'body' ? !!t?.body && !t.headline && !t.caption : !t;

export default function App({ data: injected, measure = measureImage, qa = null, ports = DEFAULT_PORTS, projectId, weekStart = '' }: ReviewAppProps) {
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
  const [copyErrors, setCopyErrors] = useState<Record<string, string>>({});
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
  const ctxFor = (lane: Lane): PlanCtx => ({
    brand,
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

  // ── Gerçek model hattı (port) ──
  type Spec = { lane: Lane; i: number; candidateId: string };
  const buildRequest = (specs: Spec[]): CopyRequest | null => {
    const storySlots = stateOf('story').slots.map((s, j) => specs.find((sp) => sp.lane === 'story' && sp.i === j)?.candidateId ?? s);
    const fr = framesOf(storySlots);
    const reqItems: CopyItemRequest[] = [];
    for (const sp of specs) {
      if (sp.lane === 'feed') {
        reqItems.push({ slotKey: `feed:${sp.i}`, mediaId: sp.candidateId, lane: 'feed', role: 'caption' });
        continue;
      }
      const f = fr[sp.i];
      if (!f || f.role === 'none') continue; // metinsiz kare: istek yok
      reqItems.push({
        slotKey: `story:${sp.i}`, mediaId: sp.candidateId, lane: 'story', role: f.role,
        ...(f.key && f.size >= 2 ? { seriesKey: f.key, seriesPosition: f.position, seriesSize: f.size } : { seriesKey: null }),
      });
    }
    if (!reqItems.length) return null;
    const requested = new Set(specs.map((s) => `${s.lane}:${s.i}`));
    const avoid: string[] = [];
    (['feed', 'story'] as Lane[]).forEach((l) => stateOf(l).texts.forEach((t, j) => { const m = mainText(t); if (m && !requested.has(`${l}:${j}`)) avoid.push(m.slice(0, 400)); }));
    return { projectId: brand, weekStart, items: reqItems, ...(avoid.length ? { avoidTexts: avoid.slice(0, 40) } : {}) };
  };

  interface CopyOutcome { texts: Map<string, SlotText>; errors: Map<string, string>; fatal?: string }
  const requestCopy = async (specs: Spec[]): Promise<CopyOutcome> => {
    const out: CopyOutcome = { texts: new Map(), errors: new Map() };
    const req = buildRequest(specs);
    if (!req) return out;
    if (!ports.copy.available) return { ...out, fatal: ports.copy.unavailableReason ?? 'Metin üretim modeli bağlı değil.' };
    try {
      const resp = await ports.copy.generate(req);
      const asked = new Set(req.items.map((i) => i.slotKey));
      for (const a of resp.accepted) {
        if (!asked.has(a.slotKey)) continue;
        if (!resp.responseId) { out.errors.set(a.slotKey, 'yanıt kimliği yok; metin kabul edilmedi'); continue; }
        out.texts.set(a.slotKey, { ...a.text, source: 'model', lang: 'tr', evidenceBasis: a.evidenceBasis, contentHash: a.contentHash, responseId: resp.responseId, promptVersion: resp.promptVersion });
      }
      for (const r of resp.rejected) if (asked.has(r.slotKey)) out.errors.set(r.slotKey, r.reasons.join(', '));
      for (const k of asked) if (!out.texts.has(k) && !out.errors.has(k)) out.errors.set(k, 'model bu slot için metin döndürmedi');
    } catch (e) {
      out.fatal = describeError(e);
    }
    return out;
  };
  const setBusyFor = (keys: string[], on: boolean) => {
    const next = { ...busyRef.current };
    for (const k of keys) { if (on) next[k] = true; else delete next[k]; }
    busyRef.current = next;
    setBusy(next);
  };
  const setErrorsFor = (keys: string[], msg: string | null) =>
    setCopyErrors((prev) => {
      const n = { ...prev };
      for (const k of keys) { if (msg) n[k] = msg; else delete n[k]; }
      return n;
    });

  /** Metni eksik slotları (görsel yerinde) doldurur. Sonuç yalnız slot hâlâ aynı görseli tutuyorsa yazılır. */
  const fillMissing = async (lane: Lane) => {
    const st = stateOf(lane);
    const fr = lane === 'story' ? framesOf(st.slots) : null;
    const specs: Spec[] = [];
    const versions = new Map<string, number>();
    st.slots.forEach((id, i) => {
      if (!id || st.texts[i] || busyRef.current[`${lane}:${i}`]) return;
      if (fr && fr[i].role === 'none') return;
      specs.push({ lane, i, candidateId: id });
      versions.set(`${lane}:${i}`, st.versions[i]);
    });
    if (!specs.length) return;
    const keys = specs.map((s) => `${s.lane}:${s.i}`);
    setBusyFor(keys, true);
    setErrorsFor(keys, null);
    const res = await requestCopy(specs);
    setBusyFor(keys, false);
    if (res.fatal) {
      setErrorsFor(keys, res.fatal);
      setMessages((m) => [...m, { lane, slot: -1, text: `Metin üretilemedi: ${res.fatal}` }]);
      return;
    }
    let cur = stateOf(lane);
    for (const sp of specs) {
      const key = `${sp.lane}:${sp.i}`;
      const text = res.texts.get(key);
      if (!text) { setErrorsFor([key], res.errors.get(key) ?? 'metin üretilemedi'); continue; }
      cur = setSlotText(sp.i, sp.candidateId, text, cur, versions.get(key)).state;
    }
    commit(lane, cur);
  };

  /** Story'de rol değişince uymayan metni boşalt (hiyerarşi); metin gereken kareler için yeniden üret. */
  const reconcileStory = async () => {
    const st = stateOf('story');
    const fr = framesOf(st.slots);
    let next = st;
    const need: number[] = [];
    st.slots.forEach((id, i) => {
      if (!id || fitsRole(st.texts[i], fr[i].role)) return;
      next = { ...next, texts: next.texts.map((t, j) => (j === i ? null : t)), versions: next.versions.map((v, j) => (j === i ? v + 1 : v)) };
      if (fr[i].role !== 'none') need.push(i);
    });
    if (next !== st) {
      commit('story', next);
      if (need.length) setMessages((m) => [...m, ...need.map((i) => ({ lane: 'story' as Lane, slot: i, text: 'Seri değişti: bu karenin metni yeniden üretilmeli.' }))]);
    }
    if (need.length) await fillMissing('story');
  };

  const onGenerate = async (lane: Lane, regen: boolean) => {
    const before = stateOf(lane);
    const r = generate(before, ctxFor(lane), regen);
    if (!regen) {
      commit(lane, r.state);
      setMessages(r.messages.map((m) => ({ ...m, lane })));
      if (lane === 'story') await reconcileStory();
      await fillMissing(lane);
      return;
    }
    // Yeniden öner: görsel + metin ATOMİK. Yeni görsel yalnız metni de geldiyse yazılır; aksi hâlde eski öneri korunur.
    const changed = r.state.slots.map((id, i) => (id && id !== before.slots[i] ? i : -1)).filter((i) => i >= 0);
    const msgs = r.messages.map((m) => ({ ...m, lane }));
    if (!changed.length) { commit(lane, r.state); setMessages(msgs); return; }
    const specs = changed.map((i) => ({ lane, i, candidateId: r.state.slots[i] as string }));
    const keys = specs.map((s) => `${s.lane}:${s.i}`);
    setBusyFor(keys, true);
    const res = await requestCopy(specs);
    setBusyFor(keys, false);
    const now = stateOf(lane);
    if (JSON.stringify(now.versions) !== JSON.stringify(before.versions) || JSON.stringify(now.locked) !== JSON.stringify(before.locked)) {
      setMessages([{ lane, slot: -1, text: 'Plan siz beklerken değişti; yeniden öner iptal edildi, mevcut öneriler korundu.' }]);
      return;
    }
    const next: PlanState = { ...r.state, slots: [...r.state.slots], texts: [...r.state.texts], versions: [...r.state.versions] };
    const failures: string[] = [];
    for (const sp of specs) {
      const key = `${sp.lane}:${sp.i}`;
      const text = res.texts.get(key);
      if (text) { next.texts[sp.i] = text; continue; }
      next.slots[sp.i] = before.slots[sp.i];
      next.texts[sp.i] = before.texts[sp.i];
      next.versions[sp.i] = before.versions[sp.i];
      failures.push(`${lane === 'feed' ? 'Feed' : 'Story'} slot ${sp.i + 1}: ${res.fatal ?? res.errors.get(key) ?? 'metin üretilemedi'}`);
    }
    commit(lane, next);
    setMessages([...msgs, ...failures.map((t) => ({ lane, slot: -1, text: `Görsel ve metin birlikte yenilenemedi, mevcut öneri korundu — ${t}` }))]);
    if (lane === 'story') await reconcileStory();
  };

  const mirrorDismissed = (lane: Lane, id: string | null | undefined) => {
    if (!id) return;
    const other: Lane = lane === 'feed' ? 'story' : 'feed';
    const o = stateOf(other);
    commit(other, { ...o, dismissed: [...new Set([...o.dismissed, id])] });
  };

  /** Tek slot: aday öner → gerçek model metni → TEK adımda yaz. Hata/alternatif yok → mevcut öneri aynen kalır. */
  const refreshSlot = async (lane: Lane, i: number, mode: ProposeMode, expected?: number) => {
    const key = `${lane}:${i}`;
    if (busyRef.current[key]) return;
    const before = stateOf(lane);
    const base = ctxFor(lane);
    const ctx = qa === 'error' ? { ...base, byId: new ThrowingMap(base.byId) } : base;
    const prop = proposeSlot(i, mode, before, ctx, expected);
    if (!prop.ok) { setMessages([{ lane, slot: i, text: prop.message }]); return; }
    const old = before.slots[i];
    setBusyFor([key], true);
    setErrorsFor([key], null);
    const res = await requestCopy([{ lane, i, candidateId: prop.candidateId }]);
    setBusyFor([key], false);
    const text = res.texts.get(key);
    const reason = res.fatal ?? res.errors.get(key);
    if (!text) {
      const why = reason ?? 'metin üretilemedi';
      setErrorsFor([key], why);
      setMessages([{ lane, slot: i, text: `Görsel ve metin birlikte yenilenemedi${old ? ', mevcut öneri korundu' : ''}: ${why}` }]);
      return;
    }
    const out = commitSuggestion(i, prop.candidateId, text, mode, stateOf(lane), ctxFor(lane), prop.version);
    apply(lane, out, i);
    if (!out.message && mode === 'dismiss') mirrorDismissed(lane, old);
    if (!out.message && lane === 'story') await reconcileStory();
  };

  const onRestore = (lane: Lane, seq: number) => {
    const st = stateOf(lane);
    const entry = st.history.find((h) => h.seq === seq);
    apply(lane, restoreFromHistory(seq, st, ctxFor(lane), entry ? st.versions[entry.slot] : undefined), entry?.slot ?? -1);
    if (lane === 'story') void reconcileStory();
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
  const assign = async (id: string) => {
    const target: SlotRef | null = selSlot ?? (() => {
      const i = feedRef.current.slots.findIndex((s, j) => !s && !feedRef.current.locked[j]);
      return i >= 0 ? { lane: 'feed' as Lane, i } : null;
    })();
    if (!target) { setMessages([{ lane: 'feed', slot: -1, text: 'Boş/kilitsiz slot yok; bir slot seçin.' }]); return; }
    setSelSlot(target);
    const st = stateOf(target.lane);
    const key = `${target.lane}:${target.i}`;
    if (busyRef.current[key]) return;
    const check = assignToSlot(id, target.i, st, ctxFor(target.lane), st.versions[target.i]);
    if (check.message) { setMessages([{ lane: target.lane, slot: target.i, text: check.message }]); return; }
    setBusyFor([key], true);
    setErrorsFor([key], null);
    const res = await requestCopy([{ lane: target.lane, i: target.i, candidateId: id }]);
    setBusyFor([key], false);
    const text = res.texts.get(key);
    if (!text) {
      const why = res.fatal ?? res.errors.get(key) ?? 'metin üretilemedi';
      setErrorsFor([key], why);
      setMessages([{ lane: target.lane, slot: target.i, text: `Atama yapılamadı (görsel ve metin birlikte yazılır): ${why}` }]);
      return;
    }
    const out = commitSuggestion(target.i, id, text, 'fill', stateOf(target.lane), ctxFor(target.lane), st.versions[target.i]);
    apply(target.lane, out, target.i);
    if (!out.message && target.lane === 'story') await reconcileStory();
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
    if (slot >= 0) await refreshSlot(lane, slot, 'fill');
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
    const menuItems: MenuItem[] = c
      ? [
          { label: locked ? 'Kalsın işaretini kaldır' : 'Kalsın', onSelect: () => apply(lane, toggleLock(i, stateOf(lane), !locked, expected), i) },
          { label: 'Ele ve yenisini getir', disabled: isBusy, onSelect: () => void refreshSlot(lane, i, 'dismiss', expected) },
          { label: 'Başka adayla değiştir', disabled: isBusy, onSelect: () => void refreshSlot(lane, i, 'replace', expected) },
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
          <button className="pick" onClick={() => { setSelId(c.id); setSelSlot({ lane, i }); }} aria-label={`${lane === 'feed' ? 'Feed' : 'Story'} slot ${i + 1}: ${c.id} incele`}>
            {lane === 'story' ? (
              <StoryCanvas c={c} focus={cropOf(c).focus} zoom={cropOf(c).zoom} text={text} role={role === 'caption' ? 'headline' : role} aesthetics={c.aesthetics} />
            ) : (
              <CroppedImage c={c} format={f} focus={cropOf(c).focus} zoom={cropOf(c).zoom} />
            )}
          </button>
        ) : (
          <button className="pick empty" onClick={() => setSelSlot({ lane, i })} aria-label={`${lane === 'feed' ? 'Feed' : 'Story'} slot ${i + 1} seç`} style={{ aspectRatio: `${FORMATS[f].w}/${FORMATS[f].h}` }}>
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
            <span className="caption" data-testid={`caption-${i}`}><em className="tag">{text.source === 'plan' ? 'plan metni' : text.source === 'model' ? 'model · TR' : 'şablon (test)'}</em> {text.caption}</span>
          )}
          {isBusy && <span className="status" data-testid={`status-${key}`}>Metin üretiliyor…</span>}
          {!isBusy && err && <span className="status err" data-testid={`status-${key}`}>Metin üretilemedi: {err}</span>}
          {!isBusy && !err && needsText && <span className="status err" data-testid={`status-${key}`}>{ports.copy.available ? 'Metin yok' : 'Metin yok · model bağlı değil'}</span>}
          {c && (
            <>
              <button aria-label={`${lane} slot ${i + 1} ${locked ? 'kalsın işaretini kaldır' : 'kalsın'}`} aria-pressed={locked} onClick={() => apply(lane, toggleLock(i, stateOf(lane), !locked, version), i)}>{locked ? 'Kalsın ✓' : 'Kalsın'}</button>
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

  return (
    <ImageSrcContext.Provider value={ports.imageSrc}>
      <main className="shell">
        <header className="top">
          <div>
            <h1>{data.title}</h1>
            <p className="muted">{data.dateLabel} · Instagram feed ve Story · <span className="badge">TASLAK{ports.mode === 'review' ? ' · yerel önizleme' : ''}</span></p>
          </div>
          <div className="actions">
            <button className="primary" onClick={() => void onGenerate('feed', false)} disabled={!ready || anyBusy} title={ready ? undefined : 'Ölçümler tamamlanana kadar kapalı'}>Plan oluştur</button>
            <button onClick={() => void onGenerate('feed', true)} disabled={feedPlaced === 0 || !ready || anyBusy}>Kalanları yeniden öner</button>
            {ports.persistence && <button onClick={() => void onSave()} disabled={persist.status === 'saving' || anyBusy || !persist.dirty} data-testid="save-draft">Taslağı kaydet</button>}
          </div>
        </header>
        <p className="counts" data-testid="counts">
          Aday havuzu <strong>{data.candidates.length}</strong> · Arşiv (ayrı, havuza girmez) <strong>{data.published.length}</strong> · Ölçüm {measuredDone}/{items.length}
          {!ready && <span className="warn"> · Ölçüm sürüyor: plan eksik değerlendirilmesin diye kapalı</span>}
        </p>
        <p className="counts" data-testid="persist-status">{persistLabel}{persist.message ? ` — ${persist.message}` : ''}
          {persist.status === 'conflict' && <button onClick={() => void loadSaved()}>Güncel sürümü yükle</button>}
        </p>

        {qa && <div className="qa" role="note" data-testid="qa-banner">{QA_LABEL[qa]}</div>}
        {!ports.copy.available && (
          <div className="shortage" role="alert" data-testid="copy-unavailable">
            <strong>Metin üretimi kapalı.</strong> {ports.copy.unavailableReason}
          </div>
        )}
        {incomplete > 0 && (
          <div className="shortage" role="status" data-testid="incomplete">
            <strong>Plan TAMAMLANMADI:</strong> {incomplete} slotta metin yok. Metin yalnız gerçek model hattından gelir; şablonla doldurulmaz.
          </div>
        )}
        <div className="notice" role="note">
          <strong>{ports.mode === 'review' ? 'Yerel snapshot · model çalışmadı · canlı kütüphane bağlı değil.' : 'Studio · gerçek kütüphane ve katalog.'}</strong> {data.candidates.length} aday + {data.published.length} arşiv; ölçülen {measuredOk}/{items.length}.
          <details>
            <summary>Ayrıntılar</summary>
            <p>{data.scope}</p>
            <p>{data.archiveNote}</p>
            {data.inventoryNotes?.map((n) => <p key={n}>{n}</p>)}
            <p>Ölçümler piksel istatistikleridir; anlamsal alanlar yalnız katalog/notlardan çıkarılır, yoksa "bilinmiyor" yazılır. Skorlar editoryal sezgiseldir, kalite ölçüsü değildir.</p>
            <p><strong>Metinler:</strong> yalnız gerçek model hattından (sunucuda marka sesi paketi, hesap caption'ları ve üç kılavuzla), Türkçe; sunucu çıktıyı doğrular (Türkçe, kanıt, ürün/malzeme uydurma yok). Model yoksa/hata verirse metin üretilmez ve bu açıkça gösterilir. Görsel ve metin tek sürüm olarak birlikte yenilenir; Kalsın ikisini korur.</p>
            <p><strong>Story serisi:</strong> yalnız gerçek ürün kimliğinden (insan doğrulamalı) veya planın açık seri adından kurulur; aynı gün olmak seri değildir. Kimliği olmayan kare tek karelik seridir.</p>
            <p><strong>Kalıcılık:</strong> {ports.persistence ? 'Sunucuya yazılır: görsel seçimi, format, metin, kırpma/odak, Kalsın, eleme ve gerekçeli ret. Kırpma ve Story görsel üstü metni post şemasında YOKTUR; taslaktan post oluşturulurken taşınmaz.' : 'Yerel incelemede kalıcılık yoktur; hiçbir şey kaydedilmez.'}</p>
            <p><strong>Yazı tipi:</strong> {LOCAL_FONT_NOTE}</p>
          </details>
        </div>

        <div className="cols">
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

            <h2>Instagram feed · 3 sütun ({feedPlaced}/{FEED_SLOTS})</h2>
            <div className="feed" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}>
              {Array.from({ length: FEED_SLOTS }, (_, i) => renderSlot('feed', i))}
            </div>

            <div className="lanehead">
              <h2>Story serisi{data.weeklyStory.length ? ' · haftalık plan kaydının bellek kopyası' : ''}</h2>
              <div className="actions">
                <button onClick={() => void onGenerate('story', false)} disabled={!ready || anyBusy}>Story oluştur</button>
                <button onClick={() => void onGenerate('story', true)} disabled={!ready || anyBusy}>Story: kalanları yeniden öner</button>
                {data.weeklyStory.length > 0 && <button onClick={() => { commit('story', initialStory ?? planFromIds(data.weeklyStory, 'story')); setMessages([]); }}>Haftalık plana dön</button>}
              </div>
            </div>
            {hierarchyProblems.length > 0 && <p className="warn" role="alert">{hierarchyProblems.join(' · ')}</p>}
            <div className="strip" aria-label="Story serisi">
              {Array.from({ length: FEED_SLOTS }, (_, i) => renderSlot('story', i))}
            </div>

            <h2>Elenen taslak öneriler · yerel geçmiş</h2>
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

            <h2>Yayımlanmış geçmiş · arşiv (ayrı, canlı senkron değil)</h2>
            <div className="strip" aria-label="Yayımlanmış geçmiş">
              {items.filter((c) => c.published).map((c) => (
                <button key={c.id} className="story past" onClick={() => setSelId(c.id)}>
                  <PlannerImg c={c} />
                  <span>{c.date}</span>
                </button>
              ))}
            </div>
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
                    <button onClick={() => void assign(selected.id)} aria-label="Seçili slota ata">Seçili slota ata{selSlot ? ` (${selSlot.lane === 'feed' ? 'Feed' : 'Story'} ${selSlot.i + 1})` : ''}</button>
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
                      <button className="assign" aria-label={`${c.id} slota ata`} onClick={() => { setSelId(c.id); void assign(c.id); }}>Ata</button>
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
