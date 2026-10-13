import { useEffect, useState } from 'react';
import { CHECK_LABEL, INTENT_KINDS, ROLE_ATTEMPT_LIMIT, type CreativeRole, type IntentKind } from '../../../shared/planner/creativeContract';
import type { PostText } from './postPlan';
import {
  FAILURE_LABEL, STALE_LABEL, attemptsLeft, textHash, type Entry, type Failure, type MetaView, type StageStatus, type StaleReason, type Binding,
} from './creativeState';

/**
 * Seçili post için Aşama 3 akışı: niyet → ÜÇ fikir → kullanıcı SEÇİMİ/düzenlemesi → Türkçe caption → bağımsız kontrol.
 * Her rol AYRI, açık bir kullanıcı eylemidir (tek düğme = tek model çağrısı). Hiçbir rol bir sonrakini başlatmaz; yayın yoktur.
 */
export interface CreativePanelProps {
  postId: string;
  entry: Entry;
  binding: Binding;
  text: PostText | null;
  locked: boolean;
  status: { ideas: StageStatus; selection: StageStatus; caption: StageStatus; check: StageStatus };
  running: { role: CreativeRole } | null;
  failures: Partial<Record<CreativeRole, Failure>>;
  /** Görsel plan onayı ("Görsel planı tamamladım" veya Metin üret) geçerli mi; değilse yaratıcı roller başlatılmaz */
  done: boolean;
  /** Son kırpımın piksel ölçümleri tamam mı (değilse roller açılmaz) */
  ready: boolean;
  available: boolean;
  unavailableReason?: string;
  overwrite: boolean;
  onOverwrite: (v: boolean) => void;
  onIntent: (kind: IntentKind | null, text: string) => void;
  onRun: (role: CreativeRole, refresh?: boolean) => void;
  onCancel: () => void;
  onPick: (id: 'i1' | 'i2' | 'i3') => void;
  onEditSel: (patch: { mainMessage: string; creativeAngle: string; note: string }) => void;
  onAdopt: (parkedIndex: number, id: 'i1' | 'i2' | 'i3') => void;
  onDiscard: (parkedIndex: number) => void;
  onRestore: (historyIndex: number) => void;
}

const STAGE_TITLE = { ideas: 'Fikirler', selection: 'Seçilen fikir', caption: 'Caption', check: 'Bağımsız kontrol' } as const;
const label = (s: StageStatus) => (s === 'yok' ? 'henüz yok' : s === 'geçerli' ? 'geçerli' : STALE_LABEL[s as StaleReason]);
const EFFECT_TR = { hisset: 'hissettir', düşün: 'düşündür', yap: 'harekete geçir', belirsiz: 'belirsiz' } as const;
const SRC_TR = { gorunur_gercek: 'görünür gerçek', dogrulanmis_urun: 'doğrulanmış ürün', marka_rehberi: 'marka rehberi', yaratici_yorum: 'yaratıcı yorum' } as const;
const VERDICT_TR = { uygun: 'Uygun', düzeltme_gerekli: 'Düzeltme gerekli', bilgi_yetersiz: 'Bilgi yetersiz' } as const;

function Meta({ m, testId }: { m: MetaView | null; testId: string }) {
  if (!m) return null;
  return (
    <p className="small muted" data-testid={testId}>
      model: {m.model} · istem: {m.promptVersion} · {m.cached ? 'ÖNBELLEKTEN (yeni çağrı yok)' : 'yeni çağrı'}{m.costUsd !== null ? ` · maliyet (sağlayıcı): ${m.costUsd}` : ''}
      {m.budgetTruncated && <span data-testid={`${testId}-budget`}> · girdi bütçesi: {m.budgetNotes.join(' ')}</span>}
    </p>
  );
}

function FailureBox({ role, f }: { role: CreativeRole; f?: Failure }) {
  if (!f) return null;
  return (
    <div className="shortage" role="alert" data-testid={`failure-${role}`} data-kind={f.kind}>
      <strong>{FAILURE_LABEL[f.kind]}</strong> — {f.message}
      {f.details?.length ? <ul>{f.details.map((d) => <li key={d} className="small">{d}</li>)}</ul> : null}
      {f.kind !== 'iptal' && f.kind !== 'engellendi' ? ' Hiçbir sonuç kabul edilmedi; yeniden deneme AYRI, açık bir eylemdir.' : ''}
    </div>
  );
}

export default function CreativePanel(p: CreativePanelProps) {
  const e = p.entry;
  const [kind, setKind] = useState<IntentKind | ''>(e.intent.kind ?? '');
  const [itext, setItext] = useState(e.intent.text);
  const [sel, setSel] = useState({ mainMessage: '', creativeAngle: '', note: '' });
  useEffect(() => { setKind(e.intent.kind ?? ''); setItext(e.intent.text); }, [p.postId, e.intent.rev]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSel(e.selection ? { mainMessage: e.selection.mainMessage, creativeAngle: e.selection.creativeAngle, note: e.selection.note } : { mainMessage: '', creativeAngle: '', note: '' });
  }, [p.postId, e.selection?.rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = !!p.running;
  const off = !p.done || !p.ready || busy || !p.available;
  const ideasOk = p.status.ideas === 'geçerli';
  const selOk = p.status.selection === 'geçerli';
  const left = (r: CreativeRole) => attemptsLeft(e, r, p.binding);
  const st = e.ideas;
  const evidence = st?.evidence ?? null;
  const manualValid = !!p.text && p.text.source === 'manual' && p.status.caption === 'geçerli';
  const intentDirty = (kind || null) !== e.intent.kind || itext.trim() !== e.intent.text;

  return (
    <section className="creative" aria-label="Yaratıcı akış" data-testid="creative-panel" style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <h3>Yaratıcı akış · Post 4:5 son kırpım</h3>
      <p className="small muted">Fikir → sizin seçiminiz/düzenlemeniz → Türkçe caption → bağımsız kontrol. Her adım AYRI ve açık bir eylemdir (tek düğme = tek model çağrısı); seçim olmadan caption yazılmaz; kontrol yayın başlatmaz. Yayın yok.</p>
      {!p.done && <p className="small" role="status" data-testid="creative-needs-approval">Önce “Görsel planı tamamladım” kutusunu işaretleyin (ya da üstteki “Metin üret”e basın: plan bu haliyle onaylanır). Kırpım bitmeden yaratıcı roller başlatılmaz.</p>}
      {p.done && !p.ready && <p className="small" role="status" data-testid="creative-measuring">Son kırpımın ölçümü sürüyor; roller ölçüm bitince açılır.</p>}
      {!p.available && <div className="shortage" role="alert" data-testid="creative-unavailable"><strong>Yaratıcı roller kapalı.</strong> {p.unavailableReason} Görsel plan etkilenmez.</div>}

      <div className="chips" role="list" aria-label="Aşama durumları" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['ideas', 'selection', 'caption', 'check'] as const).map((k) => (
          <span key={k} role="listitem" className={`chipbtn ${p.status[k] === 'geçerli' ? 'on' : ''}`} data-testid={`stage-${k}`} data-status={p.status[k]}>{STAGE_TITLE[k]}: {label(p.status[k])}</span>
        ))}
      </div>

      <fieldset style={{ border: '1px solid var(--line)', borderRadius: 8, marginTop: 8 }}>
        <legend className="small">Post niyeti (isteğe bağlı)</legend>
        <label className="field">Okuyucu ne yapsın?
          <select value={kind} onChange={(ev) => setKind(ev.target.value as IntentKind | '')} data-testid="intent-kind" aria-label="Niyet türü">
            <option value="">belirtilmedi</option>
            {INTENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label className="field">Niyet açıklaması
          <input type="text" maxLength={200} value={itext} onChange={(ev) => setItext(ev.target.value)} data-testid="intent-text" aria-label="Niyet açıklaması" />
        </label>
        <button onClick={() => p.onIntent(kind || null, itext)} disabled={!intentDirty} data-testid="intent-save">Niyeti kaydet</button>
        <span className="small muted" data-testid="intent-state"> kayıtlı: {e.intent.kind ?? '—'} / {e.intent.text || '—'} (sürüm {e.intent.rev})</span>
      </fieldset>

      <h4>1 · Üç fikir</h4>
      <div className="actions">
        <button className="primary" onClick={() => p.onRun('ideas')} disabled={off || left('ideas') <= 0 || (!!st && ideasOk)} data-testid="ideas-run" title="Tek model çağrısı">Üç fikir üret</button>
        <button onClick={() => p.onRun('ideas', true)} disabled={off || left('ideas') <= 0 || !st || !ideasOk} data-testid="ideas-refresh" title="Açık yenileme: önbelleği atlar, tek ücretli çağrı">Fikirleri yenile (yeni ücretli çağrı)</button>
        {p.running?.role === 'ideas' && <button onClick={p.onCancel} data-testid="ideas-cancel">İptal</button>}
        <span className="small muted" data-testid="attempts-ideas">kalan deneme: {left('ideas')}/{ROLE_ATTEMPT_LIMIT}</span>
      </div>
      {p.running?.role === 'ideas' && <p className="status" role="status" data-testid="running-ideas">Fikirler üretiliyor…</p>}
      <FailureBox role="ideas" f={p.failures.ideas} />
      {st && (
        <div data-testid="ideas-stage" data-status={p.status.ideas}>
          {p.status.ideas !== 'geçerli' && <p className="small err" data-testid="ideas-stale">{label(p.status.ideas)} — bu fikirler yeni durum için geçerli değil; seçilemez. Yeniden üretin.</p>}
          <Meta m={st.meta} testId="ideas-meta" />
          <p className="small" data-testid="voice-label">Ses kaynağı: <strong>{st.voice.source === 'approved_bundle' ? 'onaylı marka sesi paketi' : st.voice.source === 'approved_guide' ? `onaylı marka rehberi (sürüm ${st.voice.guideVersion})` : 'GEÇİCİ ton (onaylı marka hafızası DEĞİL)'}</strong>{st.voice.tempToneIgnored ? ' · seçtiğiniz geçici ton yok sayıldı (onaylı olan öncelikli)' : ''}</p>
          {evidence && (
            <details open data-testid="evidence">
              <summary className="small">Kanıt: bu kırpımda GÖRÜNEN gerçekler ({evidence.facts.length}) · kapsam: {evidence.visibility.facts}{evidence.sourceKind === 'human' ? ' · yalnız insan açıklaması' : ''}</summary>
              <ul className="small">
                {evidence.facts.map((f) => <li key={f.id} data-testid={`fact-${f.id}`}><strong>{f.id}</strong> [{f.kind} · {f.source}] {f.text}</li>)}
                {evidence.products.map((x) => <li key={x.id}><strong>{x.id}</strong> doğrulanmış ürün: {x.name}</li>)}
                {evidence.brandFacts.map((g) => <li key={g.id}><strong>{g.id}</strong> rehber olgusu: {g.text}</li>)}
              </ul>
              {evidence.truncated.length > 0 && <div className="shortage" role="status" data-testid="evidence-truncated"><strong>Kanıt kırpıldı (eksiklik görünür):</strong><ul>{evidence.truncated.map((t) => <li key={t} className="small">{t}</li>)}</ul></div>}
              {evidence.uncertainties.filter((u) => !evidence.truncated.includes(u)).length > 0 && <p className="small" data-testid="evidence-uncertain">Belirsizlikler: {evidence.uncertainties.filter((u) => !evidence.truncated.includes(u)).join(' ; ')}</p>}
            </details>
          )}
          {st.status === 'bilgi_yetersiz' && (
            <div className="shortage" role="status" data-testid="ideas-insufficient"><strong>Bilgi yetersiz — fikir uydurulmadı.</strong> {st.missingInfo}</div>
          )}
          {st.ideas.map((i) => (
            <article key={i.id} className="panel" data-testid={`idea-${i.id}`} style={{ marginTop: 6, outline: e.selection?.sourceIdeaId === i.id && selOk ? '2px solid var(--accent)' : undefined }}>
              <p><strong>{i.id.toUpperCase()}</strong> · <span data-testid={`idea-main-${i.id}`}>{i.mainMessage}</span></p>
              <p className="small">Yaratıcı açı: {i.creativeAngle}</p>
              <p className="small">Görselle bağlantı: {i.visualLink}</p>
              <p className="small">Hedeflenen etki: <strong>{EFFECT_TR[i.targetEffect.kind]}</strong> — {i.targetEffect.note}</p>
              <p className="small" data-testid={`idea-basis-${i.id}`}>Bilgi kaynağı: {[...i.basis.factIds, ...i.basis.productIds, ...i.basis.brandIds].join(', ') || '—'}{evidence ? ` (${i.basis.factIds.map((id) => evidence.facts.find((f) => f.id === id)?.text).filter(Boolean).join(' ; ')})` : ''}</p>
              <p className="small muted">Yaratıcı yorum (olgu DEĞİL): {i.interpretation}</p>
              {i.uncertainties.length > 0 && <p className="small muted">Belirsizlikler: {i.uncertainties.join(' ; ')}</p>}
              {i.missingInfoNote && <p className="small muted">Eksik bilgi: {i.missingInfoNote}</p>}
              <div className="actions">
                <button onClick={() => p.onPick(i.id)} disabled={!ideasOk || busy} data-testid={`idea-pick-${i.id}`}>Bu fikri seç</button>
                {e.parked.map((_, k) => <button key={k} onClick={() => p.onAdopt(k, i.id)} disabled={!ideasOk || busy} data-testid={`adopt-${k}-${i.id}`}>Korunan düzenlemem #{k + 1}’i bu fikre uygula</button>)}
              </div>
            </article>
          ))}
        </div>
      )}

      <h4>2 · Seçilen fikir (düzenleyebilirsiniz)</h4>
      {!e.selection && <p className="small muted" data-testid="no-selection">Henüz fikir seçilmedi: caption yazılamaz.</p>}
      {e.selection && (
        <div data-testid="selection" data-status={p.status.selection}>
          {p.status.selection !== 'geçerli' && <p className="small err" data-testid="selection-stale">{label(p.status.selection)} — seçiminiz ve düzenlemeniz KORUNUYOR ama bu durum için kullanılamaz; yeni fikir üretip düzenlemenizi uygulayın.</p>}
          <p className="small muted">Kaynak: {e.selection.sourceIdeaId.toUpperCase()}{e.selection.edited ? ' · insan düzenlemesi içerir' : ''} · seçim sürümü {e.selection.rev}. Düzenleme bir OLGU kaynağı değildir; olgular yalnız yukarıdaki görünür kanıttan gelir.</p>
          <label className="field">Ana mesaj<input type="text" maxLength={200} value={sel.mainMessage} onChange={(ev) => setSel({ ...sel, mainMessage: ev.target.value })} data-testid="sel-main" disabled={p.status.selection !== 'geçerli'} /></label>
          <label className="field">Yaratıcı açı<input type="text" maxLength={240} value={sel.creativeAngle} onChange={(ev) => setSel({ ...sel, creativeAngle: ev.target.value })} data-testid="sel-angle" disabled={p.status.selection !== 'geçerli'} /></label>
          <label className="field">Notum<input type="text" maxLength={240} value={sel.note} onChange={(ev) => setSel({ ...sel, note: ev.target.value })} data-testid="sel-note" disabled={p.status.selection !== 'geçerli'} /></label>
          <button onClick={() => p.onEditSel(sel)} disabled={p.status.selection !== 'geçerli' || busy || (sel.mainMessage === e.selection.mainMessage && sel.creativeAngle === e.selection.creativeAngle && sel.note === e.selection.note)} data-testid="sel-save">Düzenlemeyi kaydet</button>
        </div>
      )}
      {e.parked.length > 0 && (
        <div data-testid="parked">
          <p className="small"><strong>Korunan düzenlemeleriniz</strong> (başka görsel/kırpım/kaynak için yazılmıştı; silinmedi):</p>
          {e.parked.map((x, k) => (
            <p key={x.rev} className="small" data-testid={`parked-${k}`}>#{k + 1} · {x.mainMessage} — {x.creativeAngle}{x.note ? ` · not: ${x.note}` : ''} <button onClick={() => p.onDiscard(k)} data-testid={`parked-discard-${k}`}>At</button></p>
          ))}
        </div>
      )}

      <h4>3 · Caption (Türkçe)</h4>
      <div className="actions">
        <button className="primary" onClick={() => p.onRun('caption')} disabled={off || !selOk || left('caption') <= 0 || (p.locked && p.status.caption === 'geçerli')} data-testid="caption-run" title="Tek model çağrısı; yalnız seçilmiş fikirden">Seçili fikirden caption yaz</button>
        {p.running?.role === 'caption' && <button onClick={p.onCancel} data-testid="caption-cancel">İptal</button>}
        <span className="small muted" data-testid="attempts-caption">kalan deneme: {left('caption')}/{ROLE_ATTEMPT_LIMIT}</span>
      </div>
      {manualValid && (
        <label className="radio" data-testid="overwrite-box"><input type="checkbox" checked={p.overwrite} onChange={(ev) => p.onOverwrite(ev.target.checked)} data-testid="caption-overwrite" /> Elle yazdığım metnin yerine geçsin (önceki metin geçmişte saklanır)</label>
      )}
      {p.locked && p.text && <p className="small" data-testid="caption-locked">Post kilitli: geçerli metin kilit kaldırılmadan ezilmez.</p>}
      {p.running?.role === 'caption' && <p className="status" role="status" data-testid="running-caption">Caption yazılıyor…</p>}
      <FailureBox role="caption" f={p.failures.caption} />
      {p.text && (
        <div data-testid="caption-stage" data-status={p.status.caption}>
          <p data-testid="caption-text">{p.text.text}</p>
          <p className="small muted">{p.text.source === 'manual' ? 'İNSAN metni (elle yazılmış/düzenlenmiş)' : p.text.voiceSource === 'temporary_tone' ? 'Model · geçici ton taslağı' : 'Model · TR'} · {label(p.status.caption)}</p>
        </div>
      )}
      {p.text && p.text.source === 'manual' && (
        <p className="small" data-testid="human-provenance">Güncel metnin kaynağı: <strong>insan düzenlemesi</strong> — model kaynak eşlemesi/gerekçesi bu metne ait DEĞİLDİR; kontrol (isterseniz) bu metne ayrıca yapılır.</p>
      )}
      {e.caption && p.text && (() => {
        // Model kaynak eşlemesi/gözlem/gerekçe YALNIZ üretildiği metne aittir: metin sonradan değiştiyse (insan düzenlemesi) güncel metnin kaynağı gibi sunulmaz
        const current = e.caption.textHash === textHash(p.text.text);
        return (
          <details open={current} data-testid="caption-sources" data-current={current}>
            <summary className="small">{current ? 'Kaynak eşlemesi ve gerekçe (ayrı alanlar)' : 'ÖNCEKİ model metnine ait kaynak eşlemesi — güncel metne ait DEĞİL (eski)'}</summary>
            {!current && <p className="small err" data-testid="caption-sources-stale">Bu kaynak eşlemesi, gözlem ve gerekçe modelin ürettiği önceki metne aittir; güncel metin değiştirildiği için geçersizdir ve güncel metnin kanıtı sayılmaz.</p>}
            <ul className="small">{e.caption.sourceMap.map((m, k) => <li key={k} data-testid={`srcmap-${k}`}>“{m.segment}” → <strong>{SRC_TR[m.source]}</strong>{m.ref ? ` (${m.ref})` : ''}</li>)}</ul>
            <p className="small" data-testid="caption-observation">Gözlem: {e.caption.observation}</p>
            <p className="small" data-testid="caption-rationale">Gerekçe: {e.caption.rationale}</p>
            <Meta m={e.caption.meta} testId="caption-meta" />
          </details>
        );
      })()}
      {e.textHistory.length > 0 && (
        <div data-testid="text-history">
          <p className="small"><strong>Önceki metinler</strong> (üzerine yazılanlar saklanır):</p>
          {e.textHistory.map((h, k) => <p key={k} className="small">{h.source === 'manual' ? 'insan' : 'model'} · {h.text.slice(0, 120)} <button onClick={() => p.onRestore(k)} data-testid={`history-restore-${k}`}>Geri yükle</button></p>)}
        </div>
      )}

      <h4>4 · Bağımsız kontrol</h4>
      <div className="actions">
        <button className="primary" onClick={() => p.onRun('check')} disabled={off || !p.text || p.status.caption !== 'geçerli' || left('check') <= 0} data-testid="check-run" title="Ayrı rol promptu; metni değiştirmez, yayın başlatmaz">Metni bağımsız kontrol et</button>
        {p.running?.role === 'check' && <button onClick={p.onCancel} data-testid="check-cancel">İptal</button>}
        <span className="small muted" data-testid="attempts-check">kalan deneme: {left('check')}/{ROLE_ATTEMPT_LIMIT}</span>
      </div>
      {p.running?.role === 'check' && <p className="status" role="status" data-testid="running-check">Kontrol yapılıyor…</p>}
      <FailureBox role="check" f={p.failures.check} />
      {!e.check && p.text && !p.failures.check && <p className="small muted" data-testid="check-none">Bu metin henüz KONTROL EDİLMEDİ (kontrolsüz taslak).</p>}
      {e.check && (
        <div data-testid="check-stage" data-status={p.status.check} data-verdict={e.check.verdict}>
          {p.status.check !== 'geçerli' && <p className="small err" data-testid="check-stale">{label(p.status.check)} — bu kontrol güncel metne ait DEĞİL.</p>}
          <p data-testid="check-verdict"><strong>{VERDICT_TR[e.check.verdict]}</strong> — {e.check.summary}</p>
          <ul className="small" data-testid="check-findings">
            {e.check.findings.map((f, k) => (
              <li key={k} data-dimension={f.dimension} data-status={f.status} data-origin={f.origin}>
                <strong>{CHECK_LABEL[f.dimension]}</strong>: {f.status}{f.claim ? ` · “${f.claim}”` : ''} — {f.reason}{f.sourceRef ? ` [${f.sourceRef}]` : ''} <em>({f.origin === 'kod' ? 'kural denetimi' : 'model'})</em>
              </li>
            ))}
          </ul>
          <Meta m={e.check.meta} testId="check-meta" />
          <p className="small muted">Kontrol metni DEĞİŞTİRMEZ ve yayın başlatmaz. Düzeltme ayrı eylemdir: metni elle düzenleyin veya yeni caption isteyin.</p>
        </div>
      )}
    </section>
  );
}
