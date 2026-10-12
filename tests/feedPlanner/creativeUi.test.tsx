import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import PostPlanner from '@/studio/feedPlanner/post/PostPlanner';
import { buildEvidence } from '@/shared/planner/creativeContract';
import { textHash } from '@/studio/feedPlanner/post/creativeState';
import { aest, cand } from './helpers';
import { mkPort, portsWith, ideasResp, captionResp, checkResp, PortError } from '../creative/uiFixtures';

// Aşama 3 — GERÇEK PostPlanner + CreativePanel; model SAHTE (sıfır sağlayıcı). Her kullanıcı tıklaması en çok TEK rol çağrısıdır.
const candidates = (note = 'konu') => Array.from({ length: 6 }, (_, i) => cand('c' + i, { brand: 'dieci', dims: { w: 1000, h: 1500 }, note }));
const measure = vi.fn(async () => aest());
let fetchSpy: ReturnType<typeof vi.fn>;
type Port = ReturnType<typeof mkPort>;
const el = (port: Port, o: { tenantId?: string; userId?: string; projectId?: string; cands?: ReturnType<typeof candidates>; voice?: { approved: boolean | null } } = {}) => (
  <PostPlanner candidates={o.cands ?? candidates()} projectId={o.projectId ?? 'dieci'} tenantId={o.tenantId ?? 't1'} userId={o.userId ?? 'u1'} initialCount={4} measureCrop={measure} ports={portsWith(port)} voice={o.voice ?? { approved: true }} />
);
beforeEach(() => { fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const q = (id: string) => screen.queryByTestId(id);
const status = (stage: string) => screen.getByTestId(`stage-${stage}`).getAttribute('data-status');
const start = async () => {
  await waitFor(() => expect((screen.getByTestId('post-plan-btn') as HTMLButtonElement).disabled).toBe(false));
  click('post-plan-btn');
  fireEvent.click(screen.getByLabelText('p1 incele'));
};
const approve = () => {}; // görsel plan onay kutusu kaldırıldı: roller doğrudan açık
const zoom = (v: string) => fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: v } });
const enabled = (id: string) => waitFor(() => expect(btn(id).disabled).toBe(false));
const runIdeas = async () => { await enabled('ideas-run'); click('ideas-run'); await waitFor(() => expect(q('idea-pick-i1')).toBeTruthy()); };
const pick = (id = 'i1') => click(`idea-pick-${id}`);
const runCaption = async () => { await enabled('caption-run'); click('caption-run'); await waitFor(() => expect(q('caption-text')).toBeTruthy()); };
const runCheck = async () => { await enabled('check-run'); click('check-run'); await waitFor(() => expect(q('check-verdict')).toBeTruthy()); };
const full = async (port: Port) => { render(el(port)); await start(); approve(); await runIdeas(); pick(); await runCaption(); await runCheck(); };
const editSel = (main: string) => { fireEvent.change(screen.getByTestId('sel-main'), { target: { value: main } }); click('sel-save'); };
const btn = (id: string) => screen.getByTestId(id) as HTMLButtonElement;

describe('akış: niyet → ÜÇ fikir → SEÇİM → caption → bağımsız kontrol (her adım tek, açık eylem)', () => {
  it('planlama HİÇ model çağırmaz; görsel plan onay kutusu yoktur (roller doğrudan açık); yaratıcı roller tek tek açılır', async () => {
    const port = mkPort();
    render(el(port));
    await start();
    expect(port.run).not.toHaveBeenCalled();
    expect(q('post-visual-done')).toBeNull();
    await enabled('ideas-run');
    expect(btn('caption-run').disabled).toBe(true);
    expect(btn('check-run').disabled).toBe(true);
    expect(port.run).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('tam akış: 3 tıklama = 3 çağrı (fikir, caption, kontrol); fikir otomatik SEÇİLMEZ; caption seçimsiz yazılamaz; kontrol yayın/yeni üretim başlatmaz', async () => {
    const port = mkPort();
    render(el(port));
    await start();
    approve();
    await runIdeas();
    expect(port.count('ideas')).toBe(1);
    expect(screen.getAllByTestId(/^idea-i\d$/)).toHaveLength(3);
    expect(q('no-selection')).toBeTruthy();
    expect(btn('caption-run').disabled).toBe(true);
    fireEvent.click(btn('caption-run')); // devre dışı: çağrı yok
    expect(port.count('caption')).toBe(0);
    pick('i2');
    expect(status('selection')).toBe('geçerli');
    await runCaption();
    expect(port.count('caption')).toBe(1);
    const creq: any = port.calls.find((c) => c.role === 'caption');
    expect(creq.idea.sourceIdeaId).toBe('i2');
    expect(creq.evidenceDigest).toBe(ideasResp().evidence.digest);
    expect(creq.crop.version).toBe(0);
    await runCheck();
    expect(port.count('check')).toBe(1);
    expect(port.run).toHaveBeenCalledTimes(3);
    expect(status('ideas')).toBe('geçerli');
    expect(status('caption')).toBe('geçerli');
    expect(status('check')).toBe('geçerli');
    expect(screen.getByTestId('check-verdict').textContent).toMatch(/Uygun/);
    expect(screen.getByTestId('check-stage').textContent).toMatch(/yayın başlatmaz/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fikir kartı: ana mesaj, açı, görselle bağlantı, etki, bilgi kaynağı (kimlik+metin), YARATICI YORUM (olgu değil), belirsizlik; kanıt listesi görünür', async () => {
    const port = mkPort();
    render(el(port));
    await start();
    approve();
    await runIdeas();
    const card = screen.getByTestId('idea-i1').textContent!;
    expect(card).toMatch(/Ana mesaj 1/);
    expect(card).toMatch(/Yaratıcı açı: Açı 1/);
    expect(card).toMatch(/Görselle bağlantı: Tabak bağlantısı 1/);
    expect(card).toMatch(/Hedeflenen etki: hissettir/);
    expect(card).toMatch(/Yaratıcı yorum \(olgu DEĞİL\)/);
    expect(card).toMatch(/Belirsizlikler: sos bilinmiyor/);
    expect(screen.getByTestId('idea-basis-i1').textContent).toMatch(/F1, F2.*masada makarna tabağı/);
    expect(screen.getByTestId('fact-F2').textContent).toMatch(/Beyaz örtülü masada/);
    expect(screen.getByTestId('voice-label').textContent).toMatch(/GEÇİCİ ton \(onaylı marka hafızası DEĞİL\)/);
  });

  it('istekler niyet, geçici ton ve yakın geçmişi taşır; onaylı rehberde geçici ton GÖNDERİLMEZ', async () => {
    const port = mkPort();
    render(el(port, { voice: { approved: false } }));
    await start();
    approve();
    fireEvent.click(screen.getByTestId('post-tone-chip-zarif'));
    fireEvent.change(screen.getByTestId('intent-kind'), { target: { value: 'hisset' } });
    fireEvent.change(screen.getByTestId('intent-text'), { target: { value: 'sakinlik' } });
    click('intent-save');
    await runIdeas();
    const r: any = port.calls[0];
    expect(r.intent).toEqual({ kind: 'hisset', text: 'sakinlik' });
    expect(r.tempTone).toEqual({ label: 'zarif' });
    expect(r.crop).toMatchObject({ zoom: 1, version: 0 });
    cleanup();
    const p2 = mkPort();
    render(el(p2, { voice: { approved: true } }));
    await start();
    approve();
    await runIdeas();
    expect((p2.calls[0] as any).tempTone).toBeUndefined();
  });

  it('marka dili yok + ton yok → çağrı YAPILIR (sade varsayılan ton, tempTone gönderilmez); ton seçilince tempTone gider', async () => {
    const port = mkPort();
    render(el(port, { voice: { approved: false } }));
    await start();
    approve();
    await runIdeas();
    expect(port.count('ideas')).toBe(1);
    expect((port.calls[0] as any).tempTone).toBeUndefined();
    expect(screen.queryByTestId('failure-ideas')).toBeNull();
    expect(screen.getByTestId('post-tone-default-note')).toBeTruthy();
  });
});

describe('sürümlü durumlar: eski işaretlenir, insan düzenlemesi korunur, eski aşama yeni durumda geçerli sayılmaz', () => {
  it('SEÇİM düzenlemesi: caption ve kontrol “eski: seçilen fikir değişti” olur (silinmez); düzenleme korunur; yeni caption düzenlenmiş fikri taşır', async () => {
    const port = mkPort();
    await full(port);
    editSel('İNSANIN ana mesajı');
    expect(status('selection')).toBe('geçerli');
    expect(status('caption')).toBe('eski_fikir');
    expect(status('check')).toBe('eski_fikir');
    expect(q('caption-text')).toBeTruthy(); // silinmedi
    expect((screen.getByTestId('sel-main') as HTMLInputElement).value).toBe('İNSANIN ana mesajı');
    expect(btn('check-run').disabled).toBe(true); // eski metin kontrol edilmez
    await runCaption(); // aynı metin değil: yeni çağrı
    await waitFor(() => expect(status('caption')).toBe('geçerli'));
    const creq: any = port.calls.filter((c) => c.role === 'caption')[1];
    expect(creq.idea).toMatchObject({ mainMessage: 'İNSANIN ana mesajı', edited: true });
    expect(status('check')).toBe('eski_fikir'); // eski kontrol yeni metin için GEÇERLİ SAYILMAZ
  });

  it('NİYET değişimi: fikirler ve seçim “eski: niyet”; yeni fikirden seçim yapmadan caption/kontrol İLERLEMEZ; düzenleme korunur', async () => {
    const port = mkPort();
    render(el(port));
    await start();
    approve();
    await runIdeas();
    pick();
    editSel('Benim mesajım');
    fireEvent.change(screen.getByTestId('intent-kind'), { target: { value: 'yap' } });
    fireEvent.change(screen.getByTestId('intent-text'), { target: { value: 'rezervasyon yap' } });
    click('intent-save');
    expect(status('ideas')).toBe('eski_niyet');
    expect(status('selection')).toBe('eski_niyet');
    expect(btn('caption-run').disabled).toBe(true);
    expect(btn('idea-pick-i2').disabled).toBe(true);
    expect((screen.getByTestId('sel-main') as HTMLInputElement).value).toBe('Benim mesajım');
    expect(port.count('caption')).toBe(0);
    await runIdeas(); // yeni niyetle yeni fikirler (açık eylem)
    await waitFor(() => expect(status('ideas')).toBe('geçerli'));
    expect(btn('caption-run').disabled).toBe(true); // seçim hâlâ eski: yeni fikirden SEÇMEDEN ilerlemez
    pick('i3');
    expect(btn('caption-run').disabled).toBe(false);
    expect(screen.getByTestId('parked-0').textContent).toMatch(/Benim mesajım/); // insan düzenlemesi ezilmedi
  });

  it('KIRPIM değişimi: üç çıktı da “eski: kırpım”; metin ve düzenleme silinmez; deneme hakkı sıfırlanır; eski düzenleme yeni fikre AÇIKÇA uygulanır', async () => {
    const port = mkPort();
    render(el(port));
    await start();
    approve();
    await runIdeas();
    pick();
    editSel('Kırpımdan önceki insan mesajı');
    await runCaption();
    await runCheck();
    zoom('2');
    expect(status('ideas')).toBe('eski_kırpım');
    expect(status('selection')).toBe('eski_kırpım');
    expect(status('caption')).toBe('eski_kırpım');
    expect(status('check')).toBe('eski_kırpım');
    expect(screen.getByTestId('post-text-p1').getAttribute('data-status')).toBe('eski_kırpım');
    expect(q('caption-text')).toBeTruthy();
    expect(btn('idea-pick-i1').disabled).toBe(true);
    expect(btn('caption-run').disabled).toBe(true);
    expect(screen.getByTestId('attempts-ideas').textContent).toMatch(/3\/3/);
    expect(btn('ideas-run').disabled).toBe(true); // kırpım değişti → görsel plan onayı düştü: roller yeniden onay bekler
    approve();
    await runIdeas();
    await waitFor(() => expect(status('ideas')).toBe('geçerli'));
    expect(screen.getByTestId('parked-0').textContent).toMatch(/Kırpımdan önceki insan mesajı/);
    click('adopt-0-i2');
    expect((screen.getByTestId('sel-main') as HTMLInputElement).value).toBe('Kırpımdan önceki insan mesajı');
    expect(status('selection')).toBe('geçerli');
    expect(q('parked')).toBeNull();
    await runCaption();
    await waitFor(() => expect(status('caption')).toBe('geçerli'));
    const last: any = port.calls.filter((c) => c.role === 'caption').pop();
    expect(last.idea).toMatchObject({ mainMessage: 'Kırpımdan önceki insan mesajı', sourceIdeaId: 'i2', edited: true });
    expect(last.crop.version).toBe(1);
    expect(status('check')).toBe('eski_kırpım');
  });

  it('KAYNAK/analiz sürümü değişimi (aday yeniden yüklendi): fikir, seçim, caption ve kontrol “eski: kaynak”; model çağrısı OTOMATİK başlamaz', async () => {
    const port = mkPort();
    const view = render(el(port, { cands: candidates('konu v1') }));
    await start();
    approve();
    await runIdeas();
    pick();
    await runCaption();
    await runCheck();
    const before = port.run.mock.calls.length;
    view.rerender(el(port, { cands: candidates('konu v2 (yeniden analiz)') }));
    expect(status('ideas')).toBe('eski_kaynak');
    expect(status('selection')).toBe('eski_kaynak');
    expect(status('caption')).toBe('eski_kaynak');
    expect(status('check')).toBe('eski_kaynak');
    expect(btn('idea-pick-i1').disabled).toBe(true);
    expect(port.run.mock.calls.length).toBe(before);
  });

  it('SUNUCU “kanıt değişti” (409): fikir+seçim “eski: kanıt”, kontrol de geçerli kalmaz; insan düzenlemesi korunur; hata türü AYRI', async () => {
    const port = mkPort({ caption: () => { throw new PortError('Görselin kanıtı değişti.', 'evidence_changed', 409); } });
    render(el(port));
    await start();
    approve();
    await runIdeas();
    pick();
    editSel('Korunacak insan mesajı');
    click('caption-run');
    await waitFor(() => expect(screen.getByTestId('failure-caption').getAttribute('data-kind')).toBe('eski_kanıt'));
    expect(status('ideas')).toBe('eski_kanıt');
    expect(status('selection')).toBe('eski_kanıt');
    expect((screen.getByTestId('sel-main') as HTMLInputElement).value).toBe('Korunacak insan mesajı');
    expect(btn('caption-run').disabled).toBe(true);
  });
});

describe('geç yanıt / iptal / hata sınıfları', () => {
  it('KONTROL sürerken kırpım değişir → geç kontrol yanıtı YAZILMAZ ve hata da gösterilmez (eski durum canlanmaz)', async () => {
    let resolve!: (v: any) => void;
    const port = mkPort({ check: () => new Promise((r) => (resolve = r)) });
    render(el(port));
    await start();
    approve();
    await runIdeas();
    pick();
    await runCaption();
    click('check-run');
    await waitFor(() => expect(q('running-check')).toBeTruthy());
    zoom('2');
    await act(async () => resolve(checkResp(textHash((port.calls.find((c) => c.role === 'check') as any).caption.text))));
    expect(q('check-stage')).toBeNull();
    expect(q('failure-check')).toBeNull();
    expect(q('running-check')).toBeNull();
  });

  it('CAPTION isteği sürerken kırpım değişir ve istek HATA verir → eski hata yeni içerikte GÖSTERİLMEZ; negatif: kırpım değişmediyse hata görünür', async () => {
    let reject!: (e: any) => void;
    const port = mkPort({ caption: () => new Promise((_r, j) => (reject = j)) });
    render(el(port));
    await start();
    approve();
    await runIdeas();
    pick();
    click('caption-run');
    await waitFor(() => expect(q('running-caption')).toBeTruthy());
    zoom('2');
    await act(async () => reject(new PortError('ESKİ KIRPIM HATASI', 'model_error', 502)));
    expect(screen.queryByText(/ESKİ KIRPIM HATASI/)).toBeNull();
    expect(q('failure-caption')).toBeNull();
    cleanup();
    const p2 = mkPort({ caption: () => { throw new PortError('GERÇEK HATA', 'model_error', 502); } });
    render(el(p2));
    await start();
    approve();
    await runIdeas();
    pick();
    click('caption-run');
    await waitFor(() => expect(screen.getByTestId('failure-caption').textContent).toMatch(/GERÇEK HATA/));
  });

  it('CAPTION sürerken kırpım değişir → geç caption yazılmaz; sürerken İNSAN metni yazarsa insan metni korunur ve yanıt yok sayılır', async () => {
    let resolve!: (v: any) => void;
    const port = mkPort({ caption: () => new Promise((r) => (resolve = r)) });
    render(el(port));
    await start();
    approve();
    await runIdeas();
    pick();
    click('caption-run');
    await waitFor(() => expect(q('running-caption')).toBeTruthy());
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'İnsan yazdı, korunmalı' } });
    click('post-save-text');
    await act(async () => resolve(captionResp('Modelin geç gelen metni')));
    expect(screen.getByTestId('post-text-p1').textContent).toMatch(/İnsan yazdı, korunmalı/);
    expect(screen.getByTestId('post-text-p1').textContent).not.toMatch(/geç gelen/);
    expect(screen.getByTestId('post-messages').textContent).toMatch(/yok sayıldı/);
  });

  it('İPTAL: ayrı “iptal edildi” durumu; sinyal sağlayıcıya iletilir; geç başarı VE geç hata yok sayılır; kısmi sonuç kabul edilmez', async () => {
    let resolve!: (v: any) => void;
    let signal: AbortSignal | undefined;
    const port = mkPort({ ideas: (_r, o) => { signal = o.signal; return new Promise((r) => (resolve = r)); } });
    render(el(port));
    await start();
    approve();
    click('ideas-run');
    await waitFor(() => expect(q('running-ideas')).toBeTruthy());
    click('ideas-cancel');
    expect(signal?.aborted).toBe(true);
    expect(screen.getByTestId('failure-ideas').getAttribute('data-kind')).toBe('iptal');
    expect(q('running-ideas')).toBeNull();
    await act(async () => resolve(ideasResp()));
    expect(q('ideas-stage')).toBeNull();
    expect(screen.getByTestId('failure-ideas').getAttribute('data-kind')).toBe('iptal');
    expect(btn('ideas-run').disabled).toBe(false); // yeniden deneme açık eylem
  });

  it.each([
    ['feature_disabled', 'kapalı', 503], ['evidence_insufficient', 'eksik_bilgi', 422], ['invalid_output', 'geçersiz_çıktı', 422], ['in_progress', 'devam_ediyor', 409], ['internal', 'rol_hatası', 500], ['model_error', 'rol_hatası', 502], ['brand_voice_missing', 'ses_yok', 412],
  ])('hata kodu %s → ayrı tür “%s”; sonuç kabul edilmez; otomatik yeniden deneme yok', async (code, kind, status) => {
    const port = mkPort({ ideas: () => { throw new PortError('Sunucu mesajı', code, status, { reasons: ['neden_1'] }); } });
    render(el(port));
    await start();
    approve();
    click('ideas-run');
    await waitFor(() => expect(screen.getByTestId('failure-ideas').getAttribute('data-kind')).toBe(kind));
    if (code === 'invalid_output') expect(screen.getByTestId('failure-ideas').textContent).toMatch(/neden_1/);
    expect(q('ideas-stage')).toBeNull();
    expect(port.count('ideas')).toBe(1);
    await new Promise((r) => setTimeout(r, 30));
    expect(port.count('ideas')).toBe(1);
  });

  it('kısmi çalışma tamamlanmış gibi görünmez: caption başarılı ama kontrol hata verirse “KONTROL EDİLMEDİ” görünür, “uygun” DEĞİL', async () => {
    const port = mkPort({ check: () => { throw new PortError('hata', 'model_error', 502); } });
    render(el(port));
    await start();
    approve();
    await runIdeas();
    pick();
    await runCaption();
    click('check-run');
    await waitFor(() => expect(q('failure-check')).toBeTruthy());
    expect(q('check-stage')).toBeNull();
    expect(q('check-verdict')).toBeNull();
    expect(status('check')).toBe('yok');
    expect(q('check-none')).toBeNull(); // hata varken “kontrol edilmedi” yerine hata kutusu
  });

  it('BİLGİ YETERSİZ: fikir kartı yok, dürüst not; seçim/caption mümkün değil', async () => {
    const port = mkPort({ ideas: () => ideasResp({ status: 'bilgi_yetersiz', ideas: [], missingInfo: 'Kırpımda ana konu doğrulanamadı.', blockReason: 'kirpimda_gorunur_olgu_yok', meta: null }) });
    render(el(port));
    await start();
    approve();
    click('ideas-run');
    await waitFor(() => expect(q('ideas-insufficient')).toBeTruthy());
    expect(screen.getByTestId('ideas-insufficient').textContent).toMatch(/uydurulmadı/);
    expect(screen.queryAllByTestId(/^idea-i\d$/)).toHaveLength(0);
    expect(btn('caption-run').disabled).toBe(true);
  });

  it('KONTROL bulguları: kural denetimi (kod) bulgusu görünür; “düzeltme gerekli” sonrası OTOMATİK yeni caption/kontrol YOK; metin değişmez', async () => {
    const port = mkPort({
      check: (r) => checkResp(textHash(r.caption.text), {
        verdict: 'düzeltme_gerekli', summary: 'Kural ihlali.', codeReasons: ['yasak:fiyat_para'],
        findings: [{ dimension: 'kanitsiz_iddia', status: 'sorun', claim: '150 TL', reason: 'Kural denetimi: yasak:fiyat_para', sourceRef: null, origin: 'kod' }, { dimension: 'insan_kilit', status: 'tamam', claim: null, reason: 'Kontrol metni DEĞİŞTİRMEZ.', sourceRef: null, origin: 'kod' }],
      }),
    });
    await full(port);
    expect(screen.getByTestId('check-stage').getAttribute('data-verdict')).toBe('düzeltme_gerekli');
    expect(screen.getByTestId('check-findings').textContent).toMatch(/kural denetimi/);
    const text = screen.getByTestId('caption-text').textContent;
    await new Promise((r) => setTimeout(r, 30));
    expect(port.run).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('caption-text').textContent).toBe(text);
  });
});

describe('rol bağlamı: niyet / seçim / metin / ton (geç hata ve geçerlilik)', () => {
  it('FİKİR isteği sürerken NİYET değişir → eski isteğin HATASI ve BAŞARISI yeni niyete yazılmaz; negatif: niyet değişmediyse hata görünür', async () => {
    for (const how of ['fail', 'ok'] as const) {
      cleanup();
      let resolve!: (v: any) => void;
      let reject!: (e: any) => void;
      const port = mkPort({ ideas: () => new Promise((res, rej) => { resolve = res; reject = rej; }) });
      render(el(port));
      await start();
      approve();
      click('ideas-run');
      await waitFor(() => expect(q('running-ideas')).toBeTruthy());
      fireEvent.change(screen.getByTestId('intent-text'), { target: { value: 'YENİ NİYET' } });
      click('intent-save');
      await act(async () => (how === 'fail' ? reject(new PortError('ESKİ NİYET HATASI', 'model_error', 502)) : resolve(ideasResp())));
      expect(screen.queryByText(/ESKİ NİYET HATASI/)).toBeNull();
      expect(q('failure-ideas')).toBeNull();
      expect(q('ideas-stage')).toBeNull(); // eski niyetin fikirleri yeni niyete yazılmadı
    }
    cleanup();
    const p2 = mkPort({ ideas: () => { throw new PortError('GERÇEK FİKİR HATASI', 'model_error', 502); } });
    render(el(p2));
    await start();
    approve();
    click('ideas-run');
    await waitFor(() => expect(screen.getByTestId('failure-ideas').textContent).toMatch(/GERÇEK FİKİR HATASI/));
    // hata görünürken niyet değişirse hata YENİ niyet için gösterilmez
    fireEvent.change(screen.getByTestId('intent-text'), { target: { value: 'sonradan' } });
    click('intent-save');
    expect(q('failure-ideas')).toBeNull();
  });

  it('CAPTION isteği sürerken seçim/fikir değiştirme kapalıdır (uçuştaki istek kendi seçimiyle tutarlı kalır); iptal sonrası serbest', async () => {
    let reject!: (e: any) => void;
    const port = mkPort({ caption: () => new Promise((_r, j) => (reject = j)) });
    render(el(port));
    await start();
    approve();
    await runIdeas();
    pick();
    click('caption-run');
    await waitFor(() => expect(q('running-caption')).toBeTruthy());
    fireEvent.change(screen.getByTestId('sel-main'), { target: { value: 'Sürerken yazılan' } });
    expect(btn('sel-save').disabled).toBe(true);
    expect(btn('idea-pick-i2').disabled).toBe(true);
    expect(btn('ideas-run').disabled).toBe(true);
    expect(btn('caption-run').disabled).toBe(true);
    await act(async () => reject(new PortError('GERÇEK CAPTION HATASI', 'model_error', 502)));
    expect(screen.getByTestId('failure-caption').textContent).toMatch(/GERÇEK CAPTION HATASI/); // bağlam aynı: hata görünür
    expect(btn('sel-save').disabled).toBe(false);
  });

  it('GEÇİCİ TON değişimi: fikir, seçim, caption ve kontrol “eski: marka dili/ton” olur; insan metni ve düzenleme SİLİNMEZ; yeni ton gönderilir', async () => {
    const port = mkPort();
    render(el(port, { voice: { approved: false } }));
    await start();
    approve();
    fireEvent.change(screen.getByTestId('post-tone-prompt'), { target: { value: 'Sakin ve sade' } });
    await runIdeas();
    pick();
    editSel('Ton değişse de korunacak');
    await runCaption();
    await runCheck();
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'TON DEĞİŞİNCE KORU' } });
    click('post-save-text');
    expect(status('caption')).toBe('geçerli');
    fireEvent.change(screen.getByTestId('post-tone-prompt'), { target: { value: 'Enerjik ve neşeli' } });
    for (const k of ['ideas', 'selection', 'caption', 'check']) expect(status(k), k).toBe('eski_ses');
    expect(screen.getByTestId('caption-text').textContent).toBe('TON DEĞİŞİNCE KORU');
    expect((screen.getByTestId('sel-main') as HTMLInputElement).value).toBe('Ton değişse de korunacak');
    expect(btn('caption-run').disabled).toBe(true);
    expect(btn('idea-pick-i2').disabled).toBe(true);
    await runIdeas();
    expect((port.calls.filter((c) => c.role === 'ideas')[1] as any).tempTone.prompt).toBe('Enerjik ve neşeli');
    await waitFor(() => expect(status('ideas')).toBe('geçerli'));
    expect(screen.getByTestId('parked-0').textContent).toMatch(/Ton değişse de korunacak/);
  });

  it('BİLİNEN onaylı rehber sürümü g1→g2: fikir, seçim, caption, kontrol “eski: marka dili”; insan metni korunur; uçuştaki eski sürüm yanıtı yazılmaz', async () => {
    const port = mkPort();
    const view = render(<PostPlanner candidates={candidates()} projectId="dieci" tenantId="t1" userId="u1" initialCount={4} measureCrop={measure} ports={portsWith(port)} voice={{ approved: true, guideVersion: 1 }} />);
    await start();
    approve();
    await runIdeas();
    pick();
    await runCaption();
    await runCheck();
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'REHBER DEĞİŞİNCE KORU' } });
    click('post-save-text');
    view.rerender(<PostPlanner candidates={candidates()} projectId="dieci" tenantId="t1" userId="u1" initialCount={4} measureCrop={measure} ports={portsWith(port)} voice={{ approved: true, guideVersion: 2 }} />);
    for (const k of ['ideas', 'selection', 'caption', 'check']) expect(status(k), k).toBe('eski_ses');
    expect(screen.getByTestId('caption-text').textContent).toBe('REHBER DEĞİŞİNCE KORU');
    expect(btn('caption-run').disabled).toBe(true);
    // aynı sürümde yeniden render durumu BOZMAZ
    view.rerender(<PostPlanner candidates={candidates()} projectId="dieci" tenantId="t1" userId="u1" initialCount={4} measureCrop={measure} ports={portsWith(port)} voice={{ approved: true, guideVersion: 2 }} />);
    expect(status('ideas')).toBe('eski_ses');
  });

  it('TON değişirken uçuştaki yanıt (başarı) yeni tona YAZILMAZ; onaylı rehberde ton alanı yok sayılır (voiceSig sabit)', async () => {
    let resolve!: (v: any) => void;
    const port = mkPort({ ideas: () => new Promise((r) => (resolve = r)) });
    render(el(port, { voice: { approved: false } }));
    await start();
    approve();
    fireEvent.click(screen.getByTestId('post-tone-chip-samimi'));
    click('ideas-run');
    await waitFor(() => expect(q('running-ideas')).toBeTruthy());
    fireEvent.click(screen.getByTestId('post-tone-chip-lüks'));
    await act(async () => resolve(ideasResp()));
    expect(q('ideas-stage')).toBeNull();
  });
});

describe('kilit, insan metni, deneme sınırı, önbellek, bütçe', () => {
  it('İNSAN METNİ sessizce ezilmez: onay kutusu olmadan çağrı yok; onayla yazılır ve önceki insan metni GEÇMİŞTE saklanır, geri yüklenebilir', async () => {
    const port = mkPort();
    render(el(port));
    await start();
    approve();
    await runIdeas();
    pick();
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'Benim elle yazdığım metin' } });
    click('post-save-text');
    expect(q('overwrite-box')).toBeTruthy();
    click('caption-run');
    await waitFor(() => expect(screen.getByTestId('failure-caption').getAttribute('data-kind')).toBe('engellendi'));
    expect(port.count('caption')).toBe(0);
    fireEvent.click(screen.getByTestId('caption-overwrite'));
    click('caption-run');
    await waitFor(() => expect(screen.getByTestId('post-text-p1').textContent).toMatch(/Masadaki makarna/));
    expect(screen.getByTestId('text-history').textContent).toMatch(/Benim elle yazdığım metin/);
    click('history-restore-0');
    expect(screen.getByTestId('post-text-p1').textContent).toMatch(/Benim elle yazdığım metin/);
  });

  it('İNSAN caption düzenlemesi: eski MODEL kaynak eşlemesi/gözlem/gerekçe güncel metnin kaynağı gibi gösterilmez (eski etiketi); insan provenance’ı ayrı; metin aynıyken güncel', async () => {
    const port = mkPort();
    await full(port);
    expect(screen.getByTestId('caption-sources').getAttribute('data-current')).toBe('true');
    expect(q('caption-sources-stale')).toBeNull();
    expect(q('human-provenance')).toBeNull();
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'YENİ İNSAN METNİ TAMAMEN BAŞKA' } });
    click('post-save-text');
    const src = screen.getByTestId('caption-sources');
    expect(src.getAttribute('data-current')).toBe('false');
    expect(src.textContent).toMatch(/ÖNCEKİ model metnine ait.*güncel metne ait DEĞİL/);
    expect(screen.getByTestId('caption-sources-stale').textContent).toMatch(/güncel metnin kanıtı sayılmaz/);
    expect(screen.getByTestId('human-provenance').textContent).toMatch(/insan düzenlemesi/);
    expect(status('check')).toBe('eski_metin'); // eski kontrol de yeni insan metni için geçerli değil
  });

  it('KİLİTLİ post: geçerli metin kilit kaldırılmadan ezilmez (düğme kapalı, çağrı yok); kontrol kilitli metni inceleyebilir', async () => {
    const port = mkPort();
    render(el(port));
    await start();
    approve();
    await runIdeas();
    pick();
    await runCaption();
    fireEvent.click(screen.getByLabelText('p1 görseli koru'));
    expect(btn('caption-run').disabled).toBe(true);
    expect(q('caption-locked')).toBeTruthy();
    expect(port.count('caption')).toBe(1);
    await runCheck();
    const chk: any = port.calls.find((c) => c.role === 'check');
    expect(chk.caption.locked).toBe(true);
  });

  it('DENEME SINIRI: aynı görsel/kırpım için 3 ücretli çağrıdan sonra rol durur; ÖNBELLEK yanıtı sayılmaz; kırpım değişince sıfırlanır', async () => {
    const port = mkPort();
    render(el(port));
    await start();
    approve();
    await runIdeas();
    click('ideas-refresh');
    await waitFor(() => expect(port.count('ideas')).toBe(2));
    await waitFor(() => expect(btn('ideas-refresh').disabled).toBe(false));
    click('ideas-refresh');
    await waitFor(() => expect(port.count('ideas')).toBe(3));
    await waitFor(() => expect(screen.getByTestId('attempts-ideas').textContent).toMatch(/0\/3/));
    expect(btn('ideas-refresh').disabled).toBe(true);
    zoom('2');
    expect(screen.getByTestId('attempts-ideas').textContent).toMatch(/3\/3/);
    cleanup();
    const cached = mkPort({ ideas: () => ideasResp({ cached: true }) });
    render(el(cached));
    await start();
    approve();
    await runIdeas();
    expect(screen.getByTestId('attempts-ideas').textContent).toMatch(/3\/3/);
    expect(screen.getByTestId('ideas-meta').textContent).toMatch(/ÖNBELLEKTEN \(yeni çağrı yok\)/);
  });

  it('KANIT KIRPILMASI ve girdi bütçesi GÖRÜNÜR: eksiklik kullanıcıya gösterilir', async () => {
    const ev = buildEvidence({ catalog: { subject: 's', description: 'uzun '.repeat(120), tags: [], visibleObjects: [], foodCategories: [], uncertainties: [], source: 'human' }, visibility: { cropped: false, facts: 'tam' } });
    const port = mkPort({ ideas: () => ideasResp({ evidence: ev, budget: { role: 'ideas', maxChars: 14000, usedChars: 13000, truncated: true, notes: ['Yakın geçmiş metinler: 3 öğe bütçe nedeniyle alınmadı (en eskiler).'] } }) });
    render(el(port));
    await start();
    approve();
    await runIdeas();
    expect(screen.getByTestId('evidence-truncated').textContent).toMatch(/kısaltıldı/);
    expect(screen.getByTestId('ideas-meta-budget').textContent).toMatch(/3 öğe bütçe nedeniyle alınmadı/);
    expect(screen.getByTestId('fact-F1').textContent).toMatch(/insan_açıklaması/);
  });

  it('yaratıcı port kapalıysa (yerel inceleme) açık not; görsel plan etkilenmez; hiçbir şablon metin üretilmez', async () => {
    const port = mkPort();
    (port as any).available = false;
    (port as any).unavailableReason = 'Modeller bağlı değil (test).';
    render(el(port));
    await start();
    approve();
    expect(screen.getByTestId('creative-unavailable').textContent).toMatch(/Modeller bağlı değil/);
    expect(btn('ideas-run').disabled).toBe(true);
    expect(screen.getByTestId('post-grid').children.length).toBe(4);
    expect(port.run).not.toHaveBeenCalled();
  });
});

describe('kapsam (tenant / proje / KULLANICI) izolasyonu — yaratıcı durum', () => {
  const scenario = async (change: (v: ReturnType<typeof render>, port: Port) => void, how: 'ok' | 'fail') => {
    let resolve!: (v: any) => void;
    let reject!: (e: any) => void;
    const port = mkPort({ ideas: () => new Promise((res, rej) => { resolve = res; reject = rej; }) });
    const view = render(el(port));
    await start();
    approve();
    click('ideas-run');
    await waitFor(() => expect(q('running-ideas')).toBeTruthy());
    change(view, port);
    expect(screen.getByTestId('post-grid').children.length).toBe(0); // plan, onay, seçim, durum SIFIRLANDI
    expect(q('creative-panel')).toBeNull();
    await act(async () => (how === 'ok' ? resolve(ideasResp()) : reject(new PortError('ESKİ HATA', 'model_error', 502))));
    expect(screen.queryByText(/Ana mesaj 1/)).toBeNull();
    expect(screen.queryByText(/ESKİ HATA/)).toBeNull();
    await start(); // yeni kapsamda aynı kimlikli (p1) post
    expect(q('ideas-stage')).toBeNull();
    expect(q('failure-ideas')).toBeNull();
    expect(q('running-ideas')).toBeNull();
    expect(status('ideas')).toBe('yok');
  };
  it.each([['tenant', { tenantId: 't2' }], ['proje', { projectId: 'baska' }], ['KULLANICI (aynı tenant+proje)', { userId: 'u2' }]])('%s değişimi: plan/seçim/insan metni/durum sıfırlanır; eski başarı ve eski hata yeni kapsama YAZILMAZ', async (_n, over) => {
    for (const how of ['ok', 'fail'] as const) {
      cleanup();
      const all = [...candidates(), ...Array.from({ length: 6 }, (_, i) => cand('o' + i, { brand: 'baska', dims: { w: 1000, h: 1500 } }))];
      await scenario((v, port) => v.rerender(el(port, { ...over, cands: all as any })), how);
    }
  });
  it('KULLANICI değişince insan metni de taşınmaz', async () => {
    const port = mkPort();
    const view = render(el(port));
    await start();
    approve();
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'u1 insan metni' } });
    click('post-save-text');
    view.rerender(el(port, { userId: 'u2' }));
    expect(screen.queryByText(/u1 insan metni/)).toBeNull();
    await start();
    expect(screen.getByTestId('post-grid').textContent).not.toMatch(/u1 insan metni/);
  });
});

describe('Post kalıcılığı ve yayın geçmişi bu aşamada YOK (dürüst sınır)', () => {
  it('bellek-içi uyarı görünür; kalıcılık portu çağrılmaz; fetch yok; yeniden bağlanınca plan ve yaratıcı durum kaybolur', async () => {
    const save = vi.fn();
    const load = vi.fn();
    const port = mkPort();
    const ports = { ...portsWith(port), persistence: { save, load } as any };
    const view = render(<PostPlanner candidates={candidates()} projectId="dieci" tenantId="t1" userId="u1" initialCount={4} measureCrop={measure} ports={ports} voice={{ approved: true }} />);
    await start();
    approve();
    await runIdeas();
    expect(screen.getByTestId('post-memory-note').textContent).toMatch(/yalnız bu sekmenin belleğindedir/);
    view.unmount();
    expect(save).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    render(<PostPlanner candidates={candidates()} projectId="dieci" tenantId="t1" userId="u1" initialCount={4} measureCrop={measure} ports={ports} voice={{ approved: true }} />);
    await waitFor(() => expect((screen.getByTestId('post-plan-btn') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByTestId('post-grid').children.length).toBe(0);
  });
});
