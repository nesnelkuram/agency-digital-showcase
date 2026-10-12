import React, { useEffect, useState } from 'react';
import { Loader2, ScanSearch } from 'lucide-react';
import { QUALITY_LABEL, getMediaAnalysis } from '../mediaIntegrationsApi';
import { PLATFORM_SAFE, VISUAL_SCHEMA_VERSION, bestTextZone, cropResolution, evaluateCrop, negativeSpaceRatio, platformInsets, subjectFocus, subjectGeometry, type FieldKey, type VisualDecision } from '../../shared/planner/visualDecision';

/**
 * Fotoğraf detayında KAYITLI görsel tanımı (yalnız okuma). Panel açılışı yalnız GET /api/media/analyze çağırır:
 * model, Canva, kuyruk işleme veya yazma başlatılmaz. Kaynaklar ayrı gösterilir:
 *   - İnsan düzeltmesi (AI'dan bağımsız kayıt; AI yokken de görünür),
 *   - AI gözlemi (model/prompt/tarih; ham sonuç),
 *   - İnsan doğrulamalı ürün (kimlik + marka paketinden çözülen ad),
 *   - Kuyruk durumu (sırada / işleniyor / başarısız / atlandı / tamamlandı) — "kayıt yok"tan ayrıdır.
 * Pazarlama metni (caption) görsel tanımı DEĞİLDİR. Okunamayan her kaynak "yok" gibi değil, "okunamadı" olarak gösterilir.
 * Kapsam (tenant+proje+varlık) anahtarlıdır ve sunucunun yankıladığı kapsamla doğrulanır: geç/yanlış yanıt yazılmaz.
 */
type Props = { projectId: string; assetId: string; tenantId?: string; /** Kaynak boyutu (kırpım hesabı için); yoksa kırpım satırları gösterilmez */ dims?: { w: number; h: number } };

type Source = 'human' | 'ai' | 'code';
type Read = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; data: any };

const SOURCE_LABEL: Record<Source, string> = { human: 'İnsan düzeltmesi', ai: 'AI gözlemi', code: 'Kod hesabı' };
const PRODUCT_STATUS_LABEL: Record<string, string> = {
  ürün_yok: 'Ürün görünmüyor',
  belirsiz: 'Ürün kimliği belirsiz',
  genel_kategori: 'Yalnız genel kategori görünüyor',
  okunaklı_etiket: 'Okunaklı etiket var',
};
const SHOT_LABEL: Record<string, string> = {
  yakın_çekim: 'yakın çekim',
  orta_plan: 'orta plan',
  genel_plan: 'genel plan',
  üstten: 'üstten',
  ürün_odaklı: 'ürün odaklı',
  mekan: 'mekân',
  diğer: 'diğer',
};

const Badge: React.FC<{ source: Source }> = ({ source }) => (
  <span
    data-source={source}
    className={`ml-1 px-1.5 py-0.5 rounded font-grotesk text-[10px] align-middle ${source === 'human' ? 'bg-emerald-50 text-emerald-700' : source === 'code' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}
  >
    {SOURCE_LABEL[source]}
  </span>
);

const Row: React.FC<{ label: string; source: Source; children: React.ReactNode }> = ({ label, source, children }) => (
  <p className="font-grotesk text-sm text-neutral-700">
    <span className="text-xs text-neutral-500">{label}: </span>
    {children}
    <Badge source={source} />
  </p>
);

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);
const when = (ms: unknown): string | null => {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
};

export const AssetDescription: React.FC<Props> = (p) => <AssetDescriptionInner key={`${p.tenantId ?? ''}:${p.projectId}:${p.assetId}`} {...p} />;

const AssetDescriptionInner: React.FC<Props> = ({ projectId, assetId, tenantId, dims }) => {
  const [read, setRead] = useState<Read>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setRead({ state: 'loading' });
    getMediaAnalysis(projectId, assetId)
      .then((data) => {
        if (!alive) return;
        const sc = data?.scope;
        const rec = data?.analysis;
        // Yanıt başka tenant/marka/varlığa aitse (veya kapsam doğrulanamıyorsa) YAZILMAZ; yokluk gibi gösterilmez, okuma hatasıdır
        const scopeOk = sc && sc.projectId === projectId && sc.assetId === assetId && (tenantId === undefined || sc.tenantId === tenantId);
        const recOk = !rec || ((!rec.sourceId || rec.sourceId === assetId) && (!rec.projectId || rec.projectId === projectId));
        if (!scopeOk || !recOk) {
          setRead({ state: 'error', message: 'Yanıt bu görsele ait değil veya kapsamı doğrulanamadı; gösterilmedi.' });
          return;
        }
        setRead({ state: 'ok', data });
      })
      .catch((e: any) => alive && setRead({ state: 'error', message: e?.message ? String(e.message) : 'Bilinmeyen hata' }));
    return () => {
      alive = false;
    };
  }, [projectId, assetId, tenantId, attempt]);

  return (
    <section data-testid="asset-description" aria-label="Kayıtlı görsel tanımı" className="space-y-2">
      <p className="flex items-center gap-1 font-grotesk text-xs font-medium text-neutral-500">
        <ScanSearch className="w-3.5 h-3.5" /> Görsel tanımı (kayıtlı)
      </p>
      {read.state === 'loading' && (
        <p className="flex items-center gap-2 font-grotesk text-xs text-neutral-500" data-testid="desc-loading">
          <Loader2 className="w-4 h-4 animate-spin text-neutral-400" /> Kayıtlı tanım okunuyor…
        </p>
      )}
      {read.state === 'error' && (
        <div role="alert" data-testid="desc-read-error" className="font-grotesk text-sm text-amber-700">
          Kayıtlı görsel tanımı okunamadı ({read.message}). Bu, tanımın olmadığı anlamına gelmez.{' '}
          <button className="underline" onClick={() => setAttempt((n) => n + 1)}>
            Yeniden oku
          </button>
        </div>
      )}
      {read.state === 'ok' && <Loaded data={read.data} dims={dims} onReread={() => setAttempt((n) => n + 1)} />}
    </section>
  );
};

/** Kuyruk işi + analiz kaydı yokluğu için dürüst metin. Sunucu saatine göre (serverNow) karşılaştırır. */
function queueNote(job: any, serverNow: number | null, enabled: boolean): { key: string; text: string } {
  const tries = `deneme ${job.attempts}/${job.maxAttempts}`;
  const err = job.lastError ? ` Son hata: ${job.lastError.message || 'ayrıntı yok'}${job.lastError.code ? ` (${job.lastError.code})` : ''}.` : '';
  if (job.state === 'pending') {
    const off = enabled ? '' : ' AI analizi bu ortamda kapalı olduğu sürece işlenmez.';
    if (job.leaseActive) return { key: 'processing', text: `Analiz şu anda işleniyor (${tries}${when(job.leaseUntil) ? `; kilit ${when(job.leaseUntil)} tarihine kadar` : ''}). Sonuç henüz kaydedilmedi.${err}` };
    const next = typeof job.nextAttemptAt === 'number' ? job.nextAttemptAt : null;
    if (next !== null && serverNow !== null && next > serverNow) return { key: 'retry_wait', text: `Yeniden deneme bekleniyor: ${when(next)} sonrası (${tries}).${err}${off}` };
    return { key: 'queued', text: `Analiz kuyrukta, işlenmeyi bekliyor (${tries}).${err}${off}` };
  }
  if (job.state === 'failed') return { key: 'failed', text: `Kuyruk işi başarısız oldu (${tries}); otomatik yeniden deneme yok.${err}` };
  if (job.state === 'skipped') return { key: 'skipped', text: `Kuyruk işi atlandı: analiz bu dosya için uygun görülmedi.${err}` };
  return { key: 'done', text: `Kuyruk işi tamamlandı görünüyor${job.analysisKey ? '' : ', ama analiz anahtarı kayıtlı değil'}.` };
}


const CROP_FORMATS: Array<{ id: string; format: string; label: string; ratio: number }> = [
  { id: '1x1', format: 'feed-1x1', label: 'Kare 1:1', ratio: 1 },
  { id: '4x5', format: 'feed-4x5', label: 'Dikey 4:5', ratio: 4 / 5 },
  { id: '9x16', format: 'story', label: 'Story 9:16', ratio: 9 / 16 },
];
const CROP_STATUS: Record<string, string> = { korunur: 'konu korunuyor', kenarda: 'konu kenara çok yakın', kısmen_kesilir: 'konu kısmen kesiliyor', kesilir: 'konu büyük ölçüde dışarıda kalıyor', bilinmiyor: 'konu kutusu bilinmiyor: korunma hesaplanamadı' };
const pctText = (n: number) => `%${Math.round(n * 100)}`;
const known = (v: string | undefined | null) => (v && v !== 'belirsiz' ? v : 'belirsiz');

/**
 * Kompozisyon kararı — konu açıklamasından AYRI, kendi şema/istem sürümüyle. Kaynaklar etiketlidir:
 * "AI gözlemi" = modelin anlamsal yargısı ve kutu TAHMİNİ (sayısal ölçüm değil); "Kod hesabı" = kutudan türetilen konum/alan/oran ve kırpım
 * hesapları (girdi yine modelin tahmini); "Piksel ölçümü" = tarayıcıda yapılır, bu panelde YOKTUR. Alan bazında güven ve notlar gösterilir.
 * Bilinmeyen 'belirsiz' ya da "bilinmiyor" olarak kalır; doğrulanmamış/eski/geçersiz karar gösterilmez, nedeni söylenir.
 */
const VisualSection: React.FC<{ rec: any; dims?: { w: number; h: number } }> = ({ rec, dims }) => {
  const done = rec?.status === 'done';
  if (!done) return null;
  const v: VisualDecision | null = rec.visual ?? null;
  if (!v) {
    const invalid = rec.visualStatus === 'invalid';
    return (
      <div data-testid="desc-visual-missing" className="rounded-lg border border-neutral-100 p-3">
        <p className="font-grotesk text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Kompozisyon kararı</p>
        <p className="font-grotesk text-sm text-neutral-600">
          {invalid
            ? `Model kompozisyon kararı verdi ama doğrulamadan geçmedi (${rec.visualIssue || 'neden kayıtlı değil'}); kullanılmıyor, plan motoru bu görsel için kompozisyonu bilinmiyor sayar.`
            : 'Bu kayıt kompozisyon kararı olmadan üretilmiş (eski sürüm). Yeniden analiz otomatik başlatılmadı; plan motoru bu görsel için kompozisyonu bilinmiyor sayar.'}
        </p>
      </div>
    );
  }
  if (rec.visualSchemaVersion !== VISUAL_SCHEMA_VERSION) {
    return (
      <div data-testid="desc-visual-stale" className="rounded-lg border border-amber-100 p-3">
        <p className="font-grotesk text-sm text-amber-700">Kompozisyon kararı eski görsel şemasında ({String(rec.visualSchemaVersion || 'bilinmiyor')}); güncel şema {VISUAL_SCHEMA_VERSION}. Gösterilmiyor ve planda kullanılmıyor.</p>
      </div>
    );
  }
  const geo = subjectGeometry(v);
  const neg = negativeSpaceRatio(v, null);
  const focus = subjectFocus(v);
  const geometryNote = rec.sourceQuality === 'original' ? null : 'Kutu önizlemeden tahmin edildi; asıl kare oranının aynı olduğu varsayıldı (doğrulanamadı).';
  const fc = (k: FieldKey) => (v.fieldConfidence?.[k] ? <span className="ml-1 font-grotesk text-[10px] text-neutral-500">(güven: {v.fieldConfidence[k]})</span> : null);
  const notes = Array.isArray(v.fieldNotes) ? v.fieldNotes : [];
  const lit = v.lighting;
  return (
    <div data-testid="desc-visual" className="space-y-1 rounded-lg border border-sky-100 bg-sky-50/20 p-3">
      <p className="font-grotesk text-[11px] font-semibold uppercase tracking-wide text-sky-700">Kompozisyon kararı (konu açıklamasından ayrı)</p>
      <p data-testid="desc-visual-version" className="font-grotesk text-[10px] text-neutral-400">
        Görsel şema {rec.visualSchemaVersion} · istem {rec.visualPromptVersion || 'bilinmiyor'}. Anlamsal yargı ve kutu tahmini modele aittir; kesin ölçüm değildir. Genel güven: {v.confidence}.
      </p>
      {rec.visualStatus === 'partial' && (
        <p data-testid="desc-visual-partial" className="font-grotesk text-xs text-amber-700">
          Kompozisyon kısmen geçerli ({rec.visualIssue || 'bazı geometri alanları bilinmiyor'}): diğer alanlar korundu, eksik geometri uydurulmadı.
        </p>
      )}
      <p className="font-grotesk text-sm text-neutral-700" data-testid="desc-visual-subject">
        <span className="text-xs text-neutral-500">Ana obje konumu ve kapladığı alan: </span>
        {geo.cell.value === null || geo.areaShare.value === null ? (
          <>BİLİNMİYOR (model konu kutusu vermedi veya kutu doğrulanamadı)<Badge source="code" /></>
        ) : (
          <>
            {geo.cell.value}, kareyi yaklaşık {pctText(geo.areaShare.value)} kaplıyor
            <Badge source="code" />
            <span className="ml-1 font-grotesk text-[10px] text-neutral-500">({geo.cell.basis}; kutu güveni: {v.subject.boxConfidence})</span>
          </>
        )}
      </p>
      <p className="font-grotesk text-sm text-neutral-700">
        <span className="text-xs text-neutral-500">Kadraj ölçeği: </span>
        {known(v.subject.scale)}
        {fc('scale')}
        <Badge source="ai" />
      </p>
      {v.surroundings ? (
        <p className="font-grotesk text-sm text-neutral-700" data-testid="desc-visual-surroundings">
          <span className="text-xs text-neutral-500">Konu–çevre ilişkisi: </span>
          {known(v.surroundings.relation).replace(/_/g, ' ')}
          {` · çevre türü ${known(v.surroundings.setting).replace(/_/g, ' ')}`}
          {fc('context')}
          <Badge source="ai" />
        </p>
      ) : (
        <p className="font-grotesk text-xs text-neutral-500" data-testid="desc-visual-surroundings-missing">
          Konu–çevre ilişkisi: bu kayıtta yok (eski kayıt); uydurulmadı.
        </p>
      )}
      <p className="font-grotesk text-sm text-neutral-700" data-testid="desc-visual-weight">
        <span className="text-xs text-neutral-500">Görsel ağırlık: </span>
        {known(v.weight.direction)}
        {v.weight.reasons.length > 0 && ` (${v.weight.reasons.map((r) => r.replace(/_/g, ' ')).join(', ')})`}
        {fc('weight')}
        <Badge source="ai" />
      </p>
      <p className="font-grotesk text-sm text-neutral-700" data-testid="desc-visual-negative">
        <span className="text-xs text-neutral-500">Negatif alan: </span>
        {known(v.negativeSpace.amount)}
        {v.negativeSpace.zone !== 'belirsiz' && v.negativeSpace.zone !== 'yok' ? `, ${v.negativeSpace.zone}` : ''}
        {fc('negativeSpace')}
        <Badge source="ai" />
        <span className="ml-2 text-xs text-neutral-500">Oran: </span>
        {neg.value === null ? <span data-testid="desc-visual-negative-ratio">ölçülmedi ({neg.basis})</span> : <span data-testid="desc-visual-negative-ratio">yaklaşık {pctText(neg.value)}</span>}
        {neg.value !== null && <Badge source="code" />}
        {neg.value !== null && <span className="ml-1 font-grotesk text-[10px] text-neutral-500">({neg.basis}; piksel ölçümü planlayıcıda yapılır)</span>}
      </p>
      <p className="font-grotesk text-sm text-neutral-700">
        <span className="text-xs text-neutral-500">Odak / yönler: </span>
        {[`odak ${v.focus.competition.replace(/_/g, ' ')}${v.focus.competingElements?.length ? ` (${v.focus.competingElements.join(', ')})` : ''}`, `bakış ${v.directions.gaze}`, `hareket ${v.directions.motion}`, `çizgiler ${v.directions.leadingLines}`, `denge ${v.balance.replace(/_/g, ' ')}`].join(' · ')}
        {fc('focus')}
        <Badge source="ai" />
      </p>
      <p className="font-grotesk text-sm text-neutral-700">
        <span className="text-xs text-neutral-500">Renk ve ton (model gözlemi; sayısal renk ölçümü tarayıcıda yapılır): </span>
        {[`ana ${v.color.main || 'belirsiz'}`, v.color.accents.length ? `vurgu ${v.color.accents.join(', ')}` : null, v.color.attention && v.color.attention !== 'belirsiz' ? `dikkat çeken ${v.color.attention}` : null, `sıcaklık ${v.color.temperature}`, `ışık ${v.tone.light}`, `kontrast ${v.tone.contrast}`, `konu ayrışması ${v.tone.subjectSeparation}`, `ayrıntı ${v.tone.detail}`, v.density].filter(Boolean).join(' · ')}
        {fc('color')}
        <Badge source="ai" />
      </p>
      {lit && (
        <p className="font-grotesk text-sm text-neutral-700" data-testid="desc-visual-lighting">
          <span className="text-xs text-neutral-500">Işık: </span>
          {[`yön ${lit.direction}`, `en aydınlık ${lit.brightZone}`, `en karanlık ${lit.darkZone}`, `patlamış parlak bölge ${lit.blownHighlights}`, `ezilmiş koyu bölge ${lit.crushedShadows}`].join(' · ')}
          {fc('lighting')}
          <Badge source="ai" />
        </p>
      )}
      <p className="font-grotesk text-sm text-neutral-700">
        <span className="text-xs text-neutral-500">Yazı için güvenli alan: </span>
        {v.textSafe.length ? `${v.textSafe.length} alan (${v.textSafe.map((t) => t.quality).join(', ')})` : 'önerilen alan yok'}
        {fc('textSafe')}
        <Badge source="ai" />
      </p>
      <p className="font-grotesk text-sm text-neutral-700" data-testid="desc-visual-technical">
        <span className="text-xs text-neutral-500">Teknik kalite: </span>
        {[`netlik ${v.technical.sharpness}`, `pozlama ${v.technical.exposure}`, `gürültü ${v.technical.noise ?? 'belirsiz'}`, `sıkıştırma ${v.technical.compression ?? 'belirsiz'}`, ...v.technical.issues].join(' · ')}
        {fc('technical')}
        <Badge source="ai" />
        {dims && <span className="ml-1 font-grotesk text-[10px] text-neutral-500">Kaynak çözünürlük {dims.w}×{dims.h} px (kod); kırpım sonrası aşağıda.</span>}
      </p>
      {v.purpose.length > 0 && (
        <p className="font-grotesk text-sm text-neutral-700">
          <span className="text-xs text-neutral-500">İçerik amacına uygunluk (model gözlemi; marka/kullanıcı girdisi ve kullanım geçmişi AYRI tutulur): </span>
          {v.purpose.join(', ')}
          {fc('purpose')}
          <Badge source="ai" />
        </p>
      )}
      {dims && focus ? (
        <div data-testid="desc-visual-crops" className="space-y-0.5">
          <p className="font-grotesk text-xs text-neutral-500">
            Kırpımda konu, ağırlık, çözünürlük ve yazı alanı (önerilen odakla, konu merkezli)
            <Badge source="code" />
          </p>
          {CROP_FORMATS.map((f) => {
            const ev = evaluateCrop(v, dims, f.ratio, focus, 1, platformInsets(f.format));
            const sh = ev.weightShift;
            const shift = sh && (Math.abs(sh.dx) > 0.05 || Math.abs(sh.dy) > 0.05) ? `; ağırlık ${[Math.abs(sh.dx) > 0.05 ? (sh.dx > 0 ? 'sağa' : 'sola') : null, Math.abs(sh.dy) > 0.05 ? (sh.dy > 0 ? 'aşağı' : 'yukarı') : null].filter(Boolean).join(' ve ')} kayar` : '';
            const res = cropResolution(dims, ev.window, f.format);
            const tz = bestTextZone(ev);
            return (
              <p key={f.id} data-crop={f.id} className="font-grotesk text-xs text-neutral-700">
                {f.label}: {CROP_STATUS[ev.subject.status]}
                {ev.subject.insideShare !== null ? ` (${pctText(ev.subject.insideShare)} kalıyor)` : ''}
                {shift}
                {res ? `; kırpım ${res.sourcePx.w}×${res.sourcePx.h} px → ${res.targetPx.w}×${res.targetPx.h}${res.scale < 0.9 ? ' (büyütme gerekir)' : ''}` : ''}
                {f.format !== 'feed-1x1' && f.format !== 'feed-4x5' ? `; yazı alanı ${tz ? 'var' : 'yok'} (platform kenarları dahil)` : ''}
              </p>
            );
          })}
          <p className="font-grotesk text-[10px] text-neutral-400" data-testid="desc-visual-safe-note">
            Story/Reels güvenli kenarları üst/alt %{Math.round(PLATFORM_SAFE.story.insets.top * 100)}: {PLATFORM_SAFE.story.verified ? 'doğrulandı' : 'VARSAYIM, Meta resmi belgesiyle doğrulanmadı'} ({PLATFORM_SAFE.story.basis}).
          </p>
        </div>
      ) : (
        <p className="font-grotesk text-xs text-neutral-500">Kırpım hesabı için {focus ? 'kaynak boyutu' : 'konu kutusu'} bilinmiyor; hesaplanmadı.</p>
      )}
      {geometryNote && <p className="font-grotesk text-xs text-amber-700">{geometryNote}</p>}
      {notes.length > 0 && (
        <p className="font-grotesk text-xs text-neutral-600" data-testid="desc-visual-notes">
          Alan notları (model): {notes.map((n) => `${n.field}: ${n.note}`).join(' · ')}
        </p>
      )}
      <p className="font-grotesk text-xs text-neutral-600" data-testid="desc-visual-confidence">
        Kompozisyon güveni: {v.confidence}
        {v.uncertainties.length > 0 && ` · belirsizlikler: ${v.uncertainties.join(' · ')}`}
      </p>
    </div>
  );
};

const Loaded: React.FC<{ data: any; dims?: { w: number; h: number }; onReread: () => void }> = ({ data, dims, onReread }) => {
  const rec = data.analysis ?? null;
  const enabled = data.enabled === true;
  const serverNow = typeof data.serverNow === 'number' ? data.serverNow : null;
  const queue = data.queue ?? { state: 'unavailable' };
  const job = queue.state === 'ok' ? queue.job : null;
  const corr = data.correction ?? { state: 'unavailable' };
  const human = corr.state === 'ok' ? corr.value : null;
  const ov = human?.overrides ?? {};
  const humanKeys = Object.keys(ov);
  const status: string | null = rec?.status ?? null;
  const done = status === 'done';
  const ai = done ? rec?.result ?? null : null; // HAM AI sonucu: insan alanlarıyla birleştirilmiş görünüm değil
  const comp = ai?.composition ?? null;
  const date = when(rec?.updatedAt) ?? when(rec?.createdAt);
  const quality = rec?.sourceQuality ?? null;
  const products = data.products ?? { state: 'none', items: [] };
  const verified: Array<{ id: string; name: string | null }> = Array.isArray(products.items) ? products.items : [];
  const note = job && !(job.state === 'done' && done) ? queueNote(job, serverNow, enabled) : null;
  const overridden = (k: string) => (k in ov ? <span className="ml-1 font-grotesk text-[10px] text-emerald-700">(insan düzeltmesi geçerli)</span> : null);

  return (
    <div className="space-y-3">
      {!enabled && (
        <p data-testid="desc-disabled" className="font-grotesk text-xs text-neutral-500">
          AI analizi bu ortamda kapalı: yeni analiz başlatılmaz. Aşağıda yalnız daha önce kaydedilmiş veri gösterilir.
        </p>
      )}

      {/* AI analiz durumu: kayıt yokluğu, kuyruk, işleniyor, başarısız, desteklenmiyor birbirinden ayrı */}
      {!rec && queue.state === 'unavailable' && (
        <p data-testid="desc-queue-unavailable" role="alert" className="font-grotesk text-sm text-amber-700">
          Kuyruk durumu okunamadı; analiz kaydı da bulunamadı. Bu, analizin planlanmadığı veya çalışmadığı anlamına gelmez.{' '}
          <button className="underline" onClick={onReread}>
            Yeniden oku
          </button>
        </p>
      )}
      {!rec && queue.state === 'ok' && !job && (
        <p data-testid="desc-missing" className="font-grotesk text-sm text-neutral-600">
          Bu görsel için kayıtlı AI analizi ve kuyruk işi yok. Bu yüzden AI görsel tanımı gösterilmiyor; açıklama uydurulmaz.
        </p>
      )}
      {!rec && note && (
        <p data-testid="desc-queue" data-state={note.key} className={`font-grotesk text-sm ${note.key === 'failed' ? 'text-red-600' : 'text-neutral-600'}`}>
          {note.text} AI analiz kaydı henüz yok.{' '}
          {(note.key === 'processing' || note.key === 'queued' || note.key === 'retry_wait') && (
            <button className="underline" onClick={onReread}>
              Yeniden oku
            </button>
          )}
        </p>
      )}
      {rec && note && (
        <p data-testid="desc-queue" data-state={note.key} className="font-grotesk text-xs text-neutral-600">
          Kuyruk: {note.text}
        </p>
      )}
      {status === 'running' && (
        <p data-testid="desc-running" className="font-grotesk text-sm text-neutral-600">
          Analiz kaydı işleniyor; sonuç henüz kaydedilmedi.{' '}
          <button className="underline" onClick={onReread}>
            Yeniden oku
          </button>
        </p>
      )}
      {status === 'failed' && (
        <p data-testid="desc-failed" role="alert" className="font-grotesk text-sm text-red-600">
          Analiz başarısız: {rec.error?.message || 'neden kaydedilmemiş'}
          {rec.error?.code ? ` (${rec.error.code})` : ''}. {rec.retryable ? 'Sunucu yeniden denemeye uygun görüyor; bu panel analiz başlatmaz.' : 'Otomatik yeniden deneme yok.'}
        </p>
      )}
      {status === 'unsupported' && (
        <p data-testid="desc-unsupported" className="font-grotesk text-sm text-neutral-600">
          Bu dosya analiz için desteklenmiyor{rec.error?.message ? `: ${rec.error.message}` : ''}.
        </p>
      )}
      {status && !['running', 'failed', 'unsupported', 'done'].includes(status) && (
        <p data-testid="desc-unknown" className="font-grotesk text-sm text-amber-700">
          Analiz kaydının durumu tanınmıyor ({String(status)}); içerik gösterilmedi.
        </p>
      )}
      {done && !ai && (
        <p data-testid="desc-empty-result" className="font-grotesk text-sm text-amber-700">
          Analiz tamamlanmış görünüyor ama kayıtlı sonuç boş; AI tanımı gösterilmiyor.
        </p>
      )}

      {/* İnsan düzeltmesi: AI'dan bağımsız kayıt; AI yokken de görünür */}
      {corr.state === 'unavailable' && (
        <p data-testid="desc-correction-unavailable" role="alert" className="font-grotesk text-sm text-amber-700">
          İnsan düzeltmesi okunamadı; varsa gösterilemiyor. Bu, düzeltme olmadığı anlamına gelmez.{' '}
          <button className="underline" onClick={onReread}>
            Yeniden oku
          </button>
        </p>
      )}
      {human && (humanKeys.length > 0 || human.note) && (
        <div data-testid="desc-human" className="space-y-1 rounded-lg border border-emerald-100 bg-emerald-50/30 p-3">
          <p className="font-grotesk text-[11px] font-semibold uppercase tracking-wide text-emerald-700">İnsan düzeltmesi (AI sonucundan bağımsız; yeniden analiz bunu ezmez)</p>
          {ov.subject && <Row label="Konu" source="human">{ov.subject}</Row>}
          {ov.description && <Row label="Açıklama" source="human">{ov.description}</Row>}
          {list(ov.tags).length > 0 && <Row label="Etiketler" source="human">{list(ov.tags).map((t) => `#${t}`).join(' ')}</Row>}
          {list(ov.foodCategories).length > 0 && <Row label="Yiyecek/içecek kategorisi" source="human">{list(ov.foodCategories).join(', ')}</Row>}
          {ov.productIdentity && (
            <Row label="Ürün kimliği (görüntüde)" source="human">
              {PRODUCT_STATUS_LABEL[ov.productIdentity.status] ?? ov.productIdentity.status}
              {ov.productIdentity.note ? ` — ${ov.productIdentity.note}` : ''}
            </Row>
          )}
          {list(ov.usageSuggestions).length > 0 && <Row label="Önerilen kullanım" source="human">{list(ov.usageSuggestions).join(', ').replace(/_/g, ' ')}</Row>}
          {ov.shotType && <Row label="Kadraj türü" source="human">{SHOT_LABEL[ov.shotType] ?? ov.shotType}</Row>}
          {typeof ov.peoplePresent === 'boolean' && <Row label="İnsan görünüyor mu" source="human">{ov.peoplePresent ? 'evet' : 'hayır'}</Row>}
          {human.note && <p className="font-grotesk text-xs text-neutral-600">Not: {human.note}</p>}
          {when(human.correctedAt) && <p className="font-grotesk text-[10px] text-neutral-500">Düzeltme tarihi: {when(human.correctedAt)}</p>}
        </div>
      )}

      {ai && (
        <div data-testid="desc-semantic" className="space-y-1 rounded-lg border border-neutral-100 p-3">
          <p className="font-grotesk text-[11px] font-semibold uppercase tracking-wide text-neutral-400">AI gözlemi: konu ve açıklama</p>
          {ai.subject && <Row label="Konu" source="ai">{ai.subject}{overridden('subject')}</Row>}
          {ai.description && <Row label="Açıklama" source="ai">{ai.description}{overridden('description')}</Row>}
          {list(ai.tags).length > 0 && <Row label="Etiketler" source="ai">{list(ai.tags).map((t) => `#${t}`).join(' ')}{overridden('tags')}</Row>}
          {list(ai.visibleObjects).length > 0 && <Row label="Görünen nesneler" source="ai">{list(ai.visibleObjects).join(', ')}</Row>}
          {list(ai.foodCategories).length > 0 && <Row label="Yiyecek/içecek kategorisi" source="ai">{list(ai.foodCategories).join(', ')}{overridden('foodCategories')}</Row>}
          {typeof ai.peoplePresent === 'boolean' && <Row label="İnsan görünüyor mu" source="ai">{ai.peoplePresent ? 'evet' : 'hayır'}{overridden('peoplePresent')}</Row>}
          {list(ai.usageSuggestions).length > 0 && <Row label="Önerilen kullanım" source="ai">{list(ai.usageSuggestions).join(', ').replace(/_/g, ' ')}{overridden('usageSuggestions')}</Row>}
        </div>
      )}

      {(ai?.productIdentity || verified.length > 0 || products.state === 'unavailable') && (
        <div data-testid="desc-product" className="space-y-1 rounded-lg border border-neutral-100 p-3">
          <p className="font-grotesk text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Ürün bilgisi</p>
          {ai?.productIdentity && (
            <Row label="AI'nın ürün gözlemi (görüntüden)" source="ai">
              {PRODUCT_STATUS_LABEL[ai.productIdentity.status] ?? ai.productIdentity.status}
              {ai.productIdentity.note ? ` — ${ai.productIdentity.note}` : ''}
              {overridden('productIdentity')}
            </Row>
          )}
          {verified.length > 0 ? (
            <div data-testid="desc-verified">
              {verified.map((p) => (
                <p key={p.id} className="font-grotesk text-sm text-neutral-700">
                  <span className="text-xs text-neutral-500">İnsan doğrulamalı ürün: </span>
                  {p.name ? p.name : <span className="text-amber-700">Ad çözülemedi</span>} <span className="text-xs text-neutral-500">(kimlik: {p.id})</span>
                  <Badge source="human" />
                </p>
              ))}
              {products.state === 'no_bundle' && <p className="font-grotesk text-xs text-amber-700">Bu markanın marka sesi paketi yüklü değil; ürün adları çözülemedi.</p>}
              {products.state === 'invalid_bundle' && <p className="font-grotesk text-xs text-amber-700">Yüklü marka sesi paketi geçersiz; ürün adları gösterilmedi.</p>}
              {products.state === 'unavailable' && <p className="font-grotesk text-xs text-amber-700">Ürün adları okunamadı.</p>}
              {products.state === 'bundle' && verified.some((p) => !p.name) && <p className="font-grotesk text-xs text-amber-700">Bazı kimlikler marka paketinde bulunmuyor: ad bilinmiyor.</p>}
            </div>
          ) : corr.state === 'ok' ? (
            <p data-testid="desc-no-verified" className="font-grotesk text-xs text-neutral-500">İnsan doğrulamalı ürün kaydı yok; AI ürün adı tahmin etmez.</p>
          ) : null}
        </div>
      )}

      {ai && (list(ai.uncertainties).length > 0 || ai.overallConfidence) && (
        <div data-testid="desc-uncertainty" className="space-y-1 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
          <p className="font-grotesk text-[11px] font-semibold uppercase tracking-wide text-amber-700">Belirsizlikler (AI)</p>
          {list(ai.uncertainties).map((u, i) => (
            <p key={i} className="font-grotesk text-sm text-amber-800">
              {u}
              <Badge source="ai" />
            </p>
          ))}
          {ai.overallConfidence && <p className="font-grotesk text-xs text-neutral-600">AI genel güveni: {ai.overallConfidence}</p>}
          {list(ai.planningNotes).length > 0 && (
            <p className="font-grotesk text-xs text-neutral-600">
              AI plan notları (öneridir, doğrulanmış olgu değildir): {list(ai.planningNotes).join(' · ')}
            </p>
          )}
        </div>
      )}

      <div data-testid="desc-measure" className="space-y-1 rounded-lg border border-neutral-100 p-3">
        <p className="font-grotesk text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Kadraj gözlemi ve ölçümler (anlamsal tanımdan ayrı)</p>
        {comp ? (
          <p className="font-grotesk text-sm text-neutral-700">
            <span className="text-xs text-neutral-500">AI kadraj gözlemi (sayısal ölçüm değil): </span>
            {[
              comp.shotType && (SHOT_LABEL[comp.shotType] ?? comp.shotType),
              comp.orientation,
              comp.subjectPlacement && `konu ${comp.subjectPlacement}`,
              typeof comp.negativeSpace === 'boolean' && (comp.negativeSpace ? 'boş alan var' : 'boş alan yok'),
              typeof comp.hasTextOverlay === 'boolean' && (comp.hasTextOverlay ? 'üzerinde yazı/logo var' : 'üzerinde yazı yok'),
            ]
              .filter(Boolean)
              .join(' · ')}
            <Badge source="ai" />
            {overridden('shotType')}
          </p>
        ) : (
          <p className="font-grotesk text-xs text-neutral-500">Kayıtlı AI kadraj gözlemi yok.</p>
        )}
        <p className="font-grotesk text-xs text-neutral-500">
          Renk, palet ve parlaklık ÖLÇÜMÜ bu kayıtta saklanmıyor; planlayıcı bunları tarayıcıda görselden ölçer. Planlayıcının yazdığı pazarlama metni
          (caption) görsel tanımı değildir ve doğrulanmış ürün bilgisi sayılmaz. Renk/ışık/kadraj ölçümü tek başına caption kanıtı DEĞİLDİR: konu açıklaması
          (AI gözlemi veya insan açıklaması) yoksa metin üretilmez.
        </p>
      </div>

      <VisualSection rec={rec} dims={dims} />

      {(rec?.model || date || quality) && (
        <p data-testid="desc-provenance" className="font-grotesk text-[10px] text-neutral-400">
          AI kaynağı: {[rec?.model, rec?.provider === 'openrouter' && 'OpenRouter', rec?.promptVersion && `istem ${rec.promptVersion}`, rec?.schemaVersion && `şema ${rec.schemaVersion}`, quality && (QUALITY_LABEL[quality] || quality), date]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </div>
  );
};

export default AssetDescription;
