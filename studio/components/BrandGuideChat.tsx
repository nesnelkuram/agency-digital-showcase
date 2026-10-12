import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TONE_KEYS, type ToneLabel } from '@/shared/planner/copyContract';
import { GUIDE_LIMITS, type BrandBrief, type BrandGuide } from '@/shared/planner/brandGuide';
import { GuideApiError, approveGuide, generateGuideDraft, getGuideState, newGuideKey, saveGuideDraft, type GuideDraftDTO, type GuideState } from '../brandGuideApi';

const TONE_TR: Record<ToneLabel, string> = { enerjik: 'Enerjik', zarif: 'Zarif', lüks: 'Lüks', samimi: 'Samimi', minimal: 'Minimal', eğlenceli: 'Eğlenceli' };
const ADMIN = new Set(['admin', 'super_admin']);

const STEPS: Array<{ key: keyof BrandBrief; q: string; hint: string; required?: boolean; multiline?: boolean }> = [
  { key: 'brandName', q: 'Markanızın adı nedir?', hint: 'ör. HAL', required: true },
  { key: 'whatTheyDo', q: 'Marka ne yapar? Kısaca anlatın.', hint: 'Yalnız emin olduğunuz şeyleri yazın; uydurma yapılmaz.', required: true, multiline: true },
  { key: 'audience', q: 'Hedef kitle kim?', hint: 'Bilmiyorsanız boş bırakın; taslakta soru olarak işaretlenir.', multiline: true },
  { key: 'tone', q: 'Marka dili nasıl olmalı? (ton)', hint: 'ör. sıcak, kısa cümleler, abartısız', multiline: true },
  { key: 'examples', q: 'Beğendiğiniz ya da markaya ait örnek cümleler var mı?', hint: 'Her cümleyi ayrı satıra yazın (isteğe bağlı).', multiline: true },
  { key: 'avoid', q: 'Hangi iddia veya konulardan kaçınılmalı?', hint: 'ör. indirim vaadi, sağlık iddiası (isteğe bağlı).', multiline: true },
];
const EMPTY_BRIEF: BrandBrief = { brandName: '', whatTheyDo: '', audience: '', tone: '', examples: '', avoid: '', free: '' };
const lines = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);

/**
 * "Marka dilini birlikte oluştur": kısa yönlendirmeli konuşma veya serbest brief → AI TASLAK → insan düzenler → yalnız açık
 * yönetici onayıyla marka rehberi. Bu bir YAZI dili özelliğidir (ses/audio üretimi değil). AI onaylı rehbere yazamaz.
 */
const BrandGuideChat: React.FC<{ projectId: string; onClose: () => void; onApproved?: () => void }> = ({ projectId, onClose, onApproved }) => {
  const { user } = useAuth();
  const isAdmin = !!user && ADMIN.has(user.role);
  const [state, setState] = useState<GuideState | null>(null);
  const [mode, setMode] = useState<'guided' | 'free'>('guided');
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<BrandBrief>(EMPTY_BRIEF);
  const [draft, setDraft] = useState<GuideDraftDTO | null>(null);
  const [edit, setEdit] = useState<BrandGuide | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | 'generate' | 'save' | 'approve'>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const keys = useRef<{ generate?: string; save?: string; approve?: string }>({});

  const load = useCallback(async () => {
    try {
      const st = await getGuideState(projectId);
      setState(st);
      if (st.draft) { setDraft(st.draft); setEdit(st.draft.guide); setDirty(false); }
    } catch (e: any) {
      setMsg({ kind: 'err', text: `Durum okunamadı: ${e.message}` });
    }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const describe = (e: unknown): { kind: 'err' | 'warn'; text: string } => {
    if (e instanceof GuideApiError) {
      if (e.code === 'feature_disabled') return { kind: 'warn', text: 'Taslak oluşturma kapalı (sağlayıcı yapılandırması). Aşağıdan elle yazıp kaydedebilirsiniz.' };
      if (e.code === 'request_pending') return { kind: 'warn', text: 'Aynı istek işleniyor; birkaç saniye sonra tekrar deneyin (aynı anahtarla sonuç gelir).' };
      if (e.code === 'request_expired') return { kind: 'err', text: `${e.message}` };
      if (e.code === 'draft_conflict' || e.code === 'content_mismatch' || e.code === 'approved_version_conflict') return { kind: 'err', text: `${e.message} (Güncel durum yüklendi.)` };
      if (e.code === 'brief_incomplete') return { kind: 'err', text: `Brief eksik: ${Array.isArray(e.details) ? (e.details as string[]).join(' · ') : e.message}` };
      return { kind: 'err', text: `${e.message}${e.code && !e.code.startsWith('http_') ? ` [${e.code}]` : ''}` };
    }
    return { kind: 'err', text: e instanceof Error ? e.message : 'Bilinmeyen hata' };
  };
  const definitive = (e: unknown) => e instanceof GuideApiError && e.status !== 0 && e.code !== 'request_pending';

  const briefToSend = (): BrandBrief => (mode === 'free' ? { ...brief, whatTheyDo: '', audience: '', tone: '', examples: '', avoid: '' } : { ...brief, free: '' });
  const canGenerate = !!brief.brandName.trim() && (mode === 'free' ? !!brief.free.trim() : !!brief.whatTheyDo.trim());

  const generate = async () => {
    if (!canGenerate || busy) return;
    setBusy('generate'); setMsg(null);
    keys.current.generate ??= newGuideKey();
    try {
      const r = await generateGuideDraft({ projectId, brief: briefToSend(), expectedDraftVersion: draft?.version ?? 0, idempotencyKey: keys.current.generate });
      keys.current.generate = undefined;
      setDraft(r.draft); setEdit(r.draft.guide); setDirty(false); setConfirmed(false);
      setMsg({ kind: 'ok', text: 'Taslak hazır. İnceleyin, düzenleyin; onaylamadıkça metin üretiminde kullanılmaz.' });
    } catch (e) {
      if (definitive(e)) keys.current.generate = undefined; // kesin sonuç: yeni deneme yeni anahtarla
      setMsg(describe(e));
      if (e instanceof GuideApiError && ['draft_conflict'].includes(e.code)) void load();
    } finally { setBusy(null); }
  };

  const save = async (): Promise<GuideDraftDTO | null> => {
    if (!edit || busy) return null;
    setBusy('save'); setMsg(null);
    keys.current.save ??= newGuideKey();
    try {
      const r = await saveGuideDraft({ projectId, guide: edit, expectedDraftVersion: draft?.version ?? 0, idempotencyKey: keys.current.save });
      keys.current.save = undefined;
      setDraft(r.draft); setEdit(r.draft.guide); setDirty(false); setConfirmed(false);
      setMsg({ kind: 'ok', text: `Düzenleme kaydedildi (taslak sürüm ${r.draft.version}).` });
      return r.draft;
    } catch (e) {
      if (definitive(e)) keys.current.save = undefined;
      setMsg(describe(e));
      if (e instanceof GuideApiError && e.code === 'draft_conflict') void load();
      return null;
    } finally { setBusy(null); }
  };

  const approve = async () => {
    if (!draft || dirty || !confirmed || busy) return;
    setBusy('approve'); setMsg(null);
    keys.current.approve ??= newGuideKey();
    try {
      const r = await approveGuide({ projectId, expectedDraftVersion: draft.version, contentKey: draft.contentKey, expectedApprovedVersion: state?.approved?.version ?? null, idempotencyKey: keys.current.approve });
      keys.current.approve = undefined;
      setMsg({ kind: 'ok', text: `Marka rehberi onaylandı (sürüm ${r.approved.version}). Metin üretimi artık bu rehberi kullanır.` });
      await load();
      onApproved?.();
    } catch (e) {
      if (definitive(e)) keys.current.approve = undefined;
      setMsg(describe(e));
      if (e instanceof GuideApiError && ['draft_conflict', 'content_mismatch', 'approved_version_conflict'].includes(e.code)) void load();
    } finally { setBusy(null); }
  };

  const setG = (p: Partial<BrandGuide>) => { setEdit((g) => (g ? { ...g, ...p } : g)); setDirty(true); };
  const startManual = () => {
    setEdit({ brandName: brief.brandName, whatTheyDo: brief.whatTheyDo || brief.free, audience: brief.audience, toneLabels: [], toneNotes: brief.tone, examples: lines(brief.examples), avoid: lines(brief.avoid), facts: [], openQuestions: [] });
    setDirty(true);
  };

  const cur = STEPS[step];
  const bundleBlocks = !!state?.bundleExists;

  return (
    <section className="panel guidechat" role="dialog" aria-label="Marka dilini birlikte oluştur" data-testid="guide-chat">
      <div className="textrow">
        <h2 style={{ margin: 0 }}>Marka dilini birlikte oluştur</h2>
        <button onClick={onClose} data-testid="guide-close">Kapat</button>
      </div>
      <p className="small muted">Bu, markanın <strong>yazı dilini</strong> belirleyen bir rehberdir (ses/audio üretimi değil). Önerilen taslaktır; olgu uydurulmaz, bilinmeyen sorulur. Yalnız yönetici onayıyla marka rehberi olur; onaylı rehber varken öncelik onundur.</p>
      {state?.approved && <p className="small" data-testid="guide-approved-info">Onaylı rehber: sürüm {state.approved.version} · {new Date(state.approved.approvedAt).toLocaleString('tr-TR')}</p>}
      {bundleBlocks && <p className="warn" role="status" data-testid="guide-bundle-blocks">Yüklü marka sesi paketi öncelikli: konuşmalı rehber onaylanamaz. Taslak üzerinde çalışabilirsiniz.</p>}
      {state && !state.aiEnabled && <p className="warn" role="status" data-testid="guide-ai-off">Taslak oluşturma kapalı (sağlayıcı yapılandırması). Rehberi elle yazıp kaydedebilirsiniz.</p>}

      {!draft && !edit && (
        <>
          <div className="chips" role="group" aria-label="Yöntem">
            <button className={`chipbtn ${mode === 'guided' ? 'on' : ''}`} aria-pressed={mode === 'guided'} onClick={() => setMode('guided')}>Adım adım sorular</button>
            <button className={`chipbtn ${mode === 'free' ? 'on' : ''}`} aria-pressed={mode === 'free'} onClick={() => setMode('free')}>Serbest brief</button>
          </div>
          {mode === 'guided' ? (
            <div className="guidestep" data-testid="guide-step">
              <p className="small muted">Soru {step + 1}/{STEPS.length}</p>
              <p><strong>{cur.q}</strong></p>
              <p className="small muted">{cur.hint}</p>
              {cur.multiline ? (
                <textarea aria-label={cur.q} rows={3} maxLength={cur.key === 'examples' || cur.key === 'avoid' ? GUIDE_LIMITS.free : GUIDE_LIMITS.whatTheyDo} value={brief[cur.key]} onChange={(e) => setBrief({ ...brief, [cur.key]: e.target.value })} />
              ) : (
                <input type="text" aria-label={cur.q} maxLength={GUIDE_LIMITS.brandName} value={brief[cur.key]} onChange={(e) => setBrief({ ...brief, [cur.key]: e.target.value })} />
              )}
              <div className="actions">
                <button onClick={() => setStep(step - 1)} disabled={step === 0}>Geri</button>
                {step < STEPS.length - 1 ? (
                  <button className="primary" onClick={() => setStep(step + 1)} disabled={!!cur.required && !brief[cur.key].trim()}>{brief[cur.key].trim() || cur.required ? 'İleri' : 'Atla'}</button>
                ) : (
                  <button className="primary" onClick={() => void generate()} disabled={!canGenerate || busy !== null || state?.aiEnabled === false} data-testid="guide-generate">{busy === 'generate' ? 'Taslak hazırlanıyor…' : 'Taslağı oluştur'}</button>
                )}
              </div>
            </div>
          ) : (
            <div className="guidestep" data-testid="guide-free">
              <label className="field">Marka adı<input type="text" aria-label="Marka adı" maxLength={GUIDE_LIMITS.brandName} value={brief.brandName} onChange={(e) => setBrief({ ...brief, brandName: e.target.value })} /></label>
              <label className="field">Serbest brief (ne yapar, kime hitap eder, ton, örnekler, kaçınılacaklar)
                <textarea aria-label="Serbest brief" rows={6} maxLength={GUIDE_LIMITS.free} value={brief.free} onChange={(e) => setBrief({ ...brief, free: e.target.value })} />
              </label>
              <div className="actions">
                <button className="primary" onClick={() => void generate()} disabled={!canGenerate || busy !== null || state?.aiEnabled === false} data-testid="guide-generate">{busy === 'generate' ? 'Taslak hazırlanıyor…' : 'Taslağı oluştur'}</button>
              </div>
            </div>
          )}
          {state?.aiEnabled === false && <button onClick={startManual} data-testid="guide-manual">Elle yazmaya başla</button>}
        </>
      )}

      {edit && (
        <div className="guidedraft" data-testid="guide-draft">
          <p className="small">
            {draft ? <>Taslak sürüm <strong>{draft.version}</strong> · {draft.origin === 'ai' ? 'AI taslağı' : 'elle düzenlendi'}{dirty ? ' · kaydedilmemiş düzenleme var' : ''}</> : 'Henüz kaydedilmemiş taslak'}
          </p>
          {draft && draft.assumptions.length > 0 && (
            <ul className="small muted" data-testid="guide-assumptions">{draft.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          )}
          <label className="field">Marka adı<input type="text" aria-label="Rehber marka adı" value={edit.brandName} maxLength={GUIDE_LIMITS.brandName} onChange={(e) => setG({ brandName: e.target.value })} /></label>
          <label className="field">Ne yapar<textarea aria-label="Rehber ne yapar" rows={2} value={edit.whatTheyDo} maxLength={GUIDE_LIMITS.whatTheyDo} onChange={(e) => setG({ whatTheyDo: e.target.value })} /></label>
          <label className="field">Hedef kitle<textarea aria-label="Rehber hedef kitle" rows={2} value={edit.audience} maxLength={GUIDE_LIMITS.audience} onChange={(e) => setG({ audience: e.target.value })} /></label>
          <div className="chips" role="group" aria-label="Ton etiketleri">
            {TONE_KEYS.map((t) => (
              <button key={t} className={`chipbtn ${edit.toneLabels.includes(t) ? 'on' : ''}`} aria-pressed={edit.toneLabels.includes(t)} onClick={() => setG({ toneLabels: edit.toneLabels.includes(t) ? edit.toneLabels.filter((x) => x !== t) : [...edit.toneLabels, t].slice(0, 3) })}>{TONE_TR[t]}</button>
            ))}
          </div>
          <label className="field">Ton notu<textarea aria-label="Rehber ton notu" rows={2} value={edit.toneNotes} maxLength={GUIDE_LIMITS.toneNotes} onChange={(e) => setG({ toneNotes: e.target.value })} /></label>
          <label className="field">Örnek cümleler (satır başına bir)<textarea aria-label="Rehber örnekler" rows={3} defaultValue={edit.examples.join('\n')} key={`ex-${draft?.version ?? 0}`} onChange={(e) => setG({ examples: lines(e.target.value) })} /></label>
          <label className="field">Kaçınılacak iddialar (satır başına bir)<textarea aria-label="Rehber kaçınılacaklar" rows={3} defaultValue={edit.avoid.join('\n')} key={`av-${draft?.version ?? 0}`} onChange={(e) => setG({ avoid: lines(e.target.value) })} /></label>
          <label className="field">Doğrulanmış olgular — metinlerde kanıt olarak kullanılır; yalnız emin olduklarınız (satır başına bir)
            <textarea aria-label="Rehber olgular" rows={3} defaultValue={edit.facts.join('\n')} key={`fa-${draft?.version ?? 0}`} onChange={(e) => setG({ facts: lines(e.target.value) })} />
          </label>
          {edit.openQuestions.length > 0 && (
            <div data-testid="guide-questions">
              <strong className="small">Açık sorular (bilinmeyenler — yanıtlayıp olgulara ekleyebilir ya da bırakabilirsiniz)</strong>
              <ul className="small">{edit.openQuestions.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          )}
          <div className="actions">
            <button onClick={() => void save()} disabled={!dirty || busy !== null} data-testid="guide-save">{busy === 'save' ? 'Kaydediliyor…' : 'Düzenlemeyi kaydet'}</button>
            {state?.aiEnabled !== false && canGenerate && (
              <button onClick={() => void generate()} disabled={dirty || busy !== null} data-testid="guide-regenerate" title="Bu oturumdaki brief'ten yeni taslak (mevcut taslağın üzerine yazar; önce düzenlemeyi kaydedin)">Yeniden taslak oluştur</button>
            )}
          </div>
          <div className="approvebox">
            {!isAdmin && <p className="small muted" data-testid="guide-admin-only">Onay yalnız yöneticiye açıktır.</p>}
            <label className="small"><input type="checkbox" checked={confirmed} disabled={!isAdmin || !draft || dirty || bundleBlocks} onChange={(e) => setConfirmed(e.target.checked)} data-testid="guide-confirm" /> Rehberi inceledim; bu içeriği marka rehberi olarak onaylıyorum.</label>
            <button className="primary" onClick={() => void approve()} disabled={!isAdmin || !draft || dirty || !confirmed || bundleBlocks || busy !== null} data-testid="guide-approve">{busy === 'approve' ? 'Onaylanıyor…' : 'Onayla ve marka rehberi yap'}</button>
            {dirty && <p className="small muted">Önce düzenlemeyi kaydedin; onay yalnız kayıtlı taslak sürümüne verilir.</p>}
          </div>
        </div>
      )}
      {msg && <p className={msg.kind === 'err' ? 'err small' : msg.kind === 'warn' ? 'warn' : 'small'} role={msg.kind === 'err' ? 'alert' : 'status'} data-testid="guide-msg">{msg.text}</p>}
    </section>
  );
};

export default BrandGuideChat;
