import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import PostPlanner from '@/studio/feedPlanner/post/PostPlanner';
import { createPostDraftStore } from '@/studio/feedPlanner/post/draftStore';
import { aest, cand } from './helpers';
import { mkPort, portsWith, PortError } from '../creative/uiFixtures';

// "Metin üret": TEK açık eylem — önce eksik ANLAMSAL analiz, sonra fikirler. Fikir SEÇİMİ insandır (sessiz varsayılan yok); caption seçilen fikirle ayrı eylemle yazılır.
// Gerçek React akışı; model/analiz SAHTE (sıfır sağlayıcı, sıfır ağ).
const READY = { decision: null, provenance: { sourceSha256: 'sha1', analysisKey: 'k1' } } as any;
const analyzed = () => Array.from({ length: 6 }, (_, i) => cand('c' + i, { brand: 'dieci', dims: { w: 1000, h: 1500 }, note: 'konu', visual: READY }));
const missing = () => analyzed().map((c) => ({ ...c, note: '', visual: undefined }));
type Port = ReturnType<typeof mkPort>;
let hold: Promise<void> | null = null;
const measure = vi.fn(async () => { if (hold) await hold; return aest(); });
const el = (port: Port, o: { cands?: any[]; analysis?: any; draftStore?: any; tenantId?: string; voice?: { approved: boolean | null } } = {}) => (
  <PostPlanner candidates={o.cands ?? analyzed()} projectId="dieci" tenantId={o.tenantId ?? 't1'} userId="u1" initialCount={4} measureCrop={measure} ports={portsWith(port)} voice={o.voice ?? { approved: true }} analysis={o.analysis} draftStore={o.draftStore} />
);
beforeEach(() => { hold = null; measure.mockClear(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const btn = (id: string) => screen.getByTestId(id) as HTMLButtonElement;
const q = (id: string) => screen.queryByTestId(id);
const makePlan = async () => { await waitFor(() => expect(btn('post-plan-btn').disabled).toBe(false)); click('post-plan-btn'); await waitFor(() => expect(screen.getByTestId('post-grid').children.length).toBe(4)); };
const prepare = () => { click('bulk-open'); click('bulk-start'); };
const finished = () => waitFor(() => expect(screen.getByTestId('bulk-summary').getAttribute('data-phase')).toBe('done'), { timeout: 5000 });
const select = (id: string) => fireEvent.click(screen.getByLabelText(`${id} incele`));
const status = (stage: string) => screen.getByTestId(`stage-${stage}`).getAttribute('data-status');

describe('Metin üret: açık onay, hazırlık ve insan seçimi', () => {
  it('onay kutusu çağrı sayısını ve "fikri siz seçersiniz" der; Başlat\'a kadar HİÇ çağrı yok; Vazgeç; Başlat görsel planı onaylar', async () => {
    const port = mkPort();
    render(el(port));
    await makePlan();
    expect(btn('post-visual-done').checked).toBe(false);
    click('bulk-open');
    expect(screen.getByTestId('bulk-confirm').textContent).toMatch(/4 post.*üç fikir hazırlanır.*4 model çağrısı.*Fikri siz seçersiniz.*plan bu haliyle onaylanır/);
    expect(port.run).not.toHaveBeenCalled();
    click('bulk-cancel-confirm');
    expect(q('bulk-confirm')).toBeNull();
    expect(port.run).not.toHaveBeenCalled();
    prepare();
    await finished();
    expect(btn('post-visual-done').checked).toBe(true);
  });

  it('hazır analiz YENİDEN çağrılmaz; yalnız fikirler (4 çağrı); caption/kontrol YOK; hiçbir fikir otomatik SEÇİLMEZ; özet "fikir seçin" der', async () => {
    const port = mkPort();
    const analysis = { run: vi.fn(), refresh: vi.fn() };
    render(el(port, { analysis }));
    await makePlan();
    prepare();
    await finished();
    expect(analysis.run).not.toHaveBeenCalled();
    expect(port.count('ideas')).toBe(4);
    expect(port.count('caption') + port.count('check')).toBe(0);
    expect(screen.getByTestId('bulk-summary').textContent).toMatch(/4.*fikirler hazır.*bir fikir seçin/);
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      select(id);
      expect(status('ideas')).toBe('geçerli');
      expect(q('no-selection')).toBeTruthy();
      expect(status('selection')).not.toBe('geçerli');
    }
  });

  it('ikinci "Metin üret" hazır fikirler için tekrar ücret oluşturmaz', async () => {
    const port = mkPort();
    render(el(port));
    await makePlan();
    prepare();
    await finished();
    click('bulk-dismiss');
    prepare();
    await finished();
    expect(port.count('ideas')).toBe(4);
    expect(screen.getAllByTestId(/^bulk-row-/).every((r) => /zaten hazır/.test(r.textContent!))).toBe(true);
  });

  it('İNSAN seçimi: seçilen fikirle caption — yalnız seçim yapılan postlara; sourceIdeaId insanın seçtiğidir', async () => {
    const port = mkPort();
    render(el(port));
    await makePlan();
    prepare();
    await finished();
    click('bulk-dismiss');
    expect(q('caption-selected-open')).toBeNull(); // henüz kimse fikir seçmedi
    select('p1');
    fireEvent.click(screen.getByTestId('idea-pick-i2'));
    expect(btn('caption-selected-open').textContent).toMatch(/\(1\)/);
    click('caption-selected-open');
    expect(screen.getByTestId('bulk-confirm').textContent).toMatch(/Seçtiğiniz fikirlerle 1 caption/);
    click('bulk-start');
    await finished();
    expect(port.count('caption')).toBe(1);
    expect((port.calls.find((c) => c.role === 'caption') as any).idea.sourceIdeaId).toBe('i2');
    expect(screen.getByTestId('post-text-p1').getAttribute('data-status')).toBe('geçerli');
    expect(q('post-text-p2')).toBeNull();
  });

  it('elle yazılmış metin korunur: o post için fikir üretilmez, satırda açık not', async () => {
    const port = mkPort();
    render(el(port));
    await makePlan();
    select('p2');
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'Benim metnim' } });
    click('post-save-text');
    prepare();
    await finished();
    expect(port.count('ideas')).toBe(3);
    expect(screen.getByTestId('bulk-row-p2').getAttribute('data-outcome')).toBe('atlandı');
    expect(screen.getByTestId('post-text-p2').textContent).toMatch(/Benim metnim/);
  });

  it('tek post: "Bu post için metin üret" = fikirler (1 çağrı); seçim ve caption OTOMATİK değil; sonra seçince "Seçtiğim fikirle caption yaz" çıkar', async () => {
    const port = mkPort();
    render(el(port));
    await makePlan();
    select('p1');
    click('post-gen-this');
    await waitFor(() => expect(q('idea-pick-i1')).toBeTruthy());
    expect(port.count('ideas')).toBe(1);
    expect(port.count('caption')).toBe(0);
    expect(screen.getByTestId('post-next-step').textContent).toMatch(/Fikirler hazır.*SİZ seçin/);
    expect(q('post-caption-this')).toBeNull();
    fireEvent.click(screen.getByTestId('idea-pick-i3'));
    expect(screen.getByTestId('post-next-step').textContent).toMatch(/Fikir seçildi/);
    click('post-caption-this');
    await waitFor(() => expect(q('caption-text')).toBeTruthy());
    expect((port.calls.find((c) => c.role === 'caption') as any).idea.sourceIdeaId).toBe('i3');
  });

  it('marka dili ve ton yokken de çalışır (sade varsayılan ton)', async () => {
    const port = mkPort();
    render(el(port, { voice: { approved: false } }));
    await makePlan();
    prepare();
    await finished();
    expect(port.count('ideas')).toBe(4);
    expect(port.calls.every((c: any) => c.tempTone === undefined)).toBe(true);
  });
});

describe('Metin üret: eksik anlamsal analiz, ölçüm bekleme, iptal/kapsam/kaynak', () => {
  const withAnalysis = (port: Port, analysis: any, cands = missing()) => el(port, { cands, analysis });

  it('eksik analiz ÖNCE (görsel başına 1 çağrı), sonra yenileme, ölçüm hazır olunca fikirler; sıra analiz→yenile→fikir', async () => {
    const events: string[] = [];
    const port = mkPort({ ideas: async () => { events.push('ideas'); return (await import('../creative/uiFixtures')).ideasResp(); } });
    let rerender!: (ui: React.ReactElement) => void;
    const analysis: any = { run: vi.fn(async () => { events.push('analysis'); return { ok: true as const }; }), refresh: vi.fn(async () => { events.push('refresh'); rerender(withAnalysis(port, analysis, analyzed())); }) };
    const r = render(withAnalysis(port, analysis));
    rerender = r.rerender;
    await makePlan();
    prepare();
    await finished();
    expect(events.slice(0, 5)).toEqual(['analysis', 'analysis', 'analysis', 'analysis', 'refresh']);
    expect(events.filter((e) => e === 'ideas')).toHaveLength(4);
    expect(port.count('caption')).toBe(0);
    expect(screen.getByTestId('bulk-summary').textContent).not.toMatch(/İŞ EKSİK/);
  });

  it('yenilemeden sonra yeni kırpım ölçümü BİTMEDEN fikir çağrılmaz; ölçüm bitince kontrollü devam eder', async () => {
    const port = mkPort();
    let rerender!: (ui: React.ReactElement) => void;
    let release!: () => void;
    const analysis: any = { run: vi.fn(async () => ({ ok: true as const })), refresh: vi.fn(async () => { hold = new Promise<void>((r) => { release = r; }); rerender(withAnalysis(port, analysis, analyzed().map((c) => ({ ...c, imageKey: c.imageKey + '-yeni' })))); }) };
    const r = render(withAnalysis(port, analysis));
    rerender = r.rerender;
    await makePlan();
    prepare();
    await waitFor(() => expect(analysis.refresh).toHaveBeenCalled());
    await new Promise((res) => setTimeout(res, 250));
    expect(port.count('ideas')).toBe(0); // ölçüm sürerken üretim YOK ("Kırpılmış görünüm ölçümleri tamamlanmadı" hatasına düşmez)
    expect(screen.queryByTestId('failure-ideas')).toBeNull();
    await act(async () => { release(); });
    await finished();
    expect(port.count('ideas')).toBe(4);
    expect(screen.getByTestId('bulk-summary').textContent).not.toMatch(/İŞ EKSİK/);
  });

  it('ölçüm beklerken DURDUR: üretim başlamaz, kalan postlar açıkça "atlandı", iş eksik görünür', async () => {
    const port = mkPort();
    let rerender!: (ui: React.ReactElement) => void;
    const analysis: any = { run: vi.fn(async () => ({ ok: true as const })), refresh: vi.fn(async () => { hold = new Promise<void>(() => {}); rerender(withAnalysis(port, analysis, analyzed().map((c) => ({ ...c, imageKey: c.imageKey + '-yeni' })))); }) };
    const r = render(withAnalysis(port, analysis));
    rerender = r.rerender;
    await makePlan();
    prepare();
    await waitFor(() => expect(analysis.refresh).toHaveBeenCalled());
    click('bulk-stop');
    await finished();
    expect(port.run).not.toHaveBeenCalled();
    expect(screen.getByTestId('bulk-halted').textContent).toMatch(/Durduruldu/);
    expect(screen.getByTestId('bulk-summary').textContent).toMatch(/İŞ EKSİK KALDI/);
    expect(screen.getAllByTestId(/^bulk-row-/).every((x) => x.getAttribute('data-outcome') === 'atlandı')).toBe(true);
  });

  it('analiz sürerken GÖRSEL PLAN (kırpım) değişirse: durur, onay YENİ plana taşınmaz (geri alınır), üretim yok', async () => {
    const port = mkPort();
    let resolve!: (v: any) => void;
    const analysis: any = { run: vi.fn(() => new Promise<any>((r) => { resolve = r; })), refresh: vi.fn(async () => {}) };
    render(withAnalysis(port, analysis));
    await makePlan();
    prepare();
    await waitFor(() => expect(analysis.run).toHaveBeenCalledTimes(1));
    select('p1');
    fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: '2' } });
    await act(async () => resolve({ ok: true }));
    await finished();
    expect(port.run).not.toHaveBeenCalled();
    expect(analysis.refresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('bulk-halted').textContent).toMatch(/Görsel plan.*değişti.*yeni plana taşınmadı/);
    expect(btn('post-visual-done').checked).toBe(false);
  });

  it('analiz sürerken KAYNAK (piksel özeti) değişirse: durur, onay geri alınır, üretim yok', async () => {
    const port = mkPort();
    let resolve!: (v: any) => void;
    const analysis: any = { run: vi.fn(() => new Promise<any>((r) => { resolve = r; })), refresh: vi.fn(async () => {}) };
    const r = render(withAnalysis(port, analysis, analyzed().map((c) => ({ ...c, note: '' }))));
    await makePlan();
    prepare();
    await waitFor(() => expect(analysis.run).toHaveBeenCalledTimes(1));
    r.rerender(withAnalysis(port, analysis, analyzed().map((c) => ({ ...c, visual: { ...c.visual, provenance: { ...c.visual!.provenance, sourceSha256: 'DEGISTI' } } }))));
    await act(async () => resolve({ ok: true }));
    await finished();
    expect(port.run).not.toHaveBeenCalled();
    expect(screen.getByTestId('bulk-halted').textContent).toMatch(/kaynağı.*değişti.*yeni kaynağa taşınmadı/);
    expect(btn('post-visual-done').checked).toBe(false);
  });

  it('kapsam (tenant) değişirse eski akış yeni kapsamda HİÇ üretim başlatmaz', async () => {
    const port = mkPort();
    let resolve!: (v: any) => void;
    const analysis: any = { run: vi.fn(() => new Promise<any>((r) => { resolve = r; })), refresh: vi.fn(async () => {}) };
    const r = render(withAnalysis(port, analysis));
    await makePlan();
    prepare();
    await waitFor(() => expect(analysis.run).toHaveBeenCalledTimes(1));
    r.rerender(el(port, { cands: missing(), analysis, tenantId: 't2' }));
    await act(async () => resolve({ ok: true }));
    expect(port.run).not.toHaveBeenCalled();
    expect(analysis.refresh).not.toHaveBeenCalled();
  });

  it('bir görselin analizi başarısız: o post "hata" (nedeniyle), diğerleri devam eder; özet "İŞ EKSİK KALDI" (tamamlandı DEĞİL)', async () => {
    const port = mkPort();
    let rerender!: (ui: React.ReactElement) => void;
    let n = 0;
    let failId = '';
    const analysis: any = { run: vi.fn(async (assetId: string) => { if (++n === 2) { failId = assetId; return { ok: false as const, message: 'MOCK: görsel okunamadı' }; } return { ok: true as const }; }), refresh: vi.fn(async () => { rerender(withAnalysis(port, analysis, analyzed().map((c) => (c.id === failId ? { ...c, note: '', visual: undefined } : c)))); }) };
    const r = render(withAnalysis(port, analysis));
    rerender = r.rerender;
    await makePlan();
    prepare();
    await finished();
    expect(port.count('ideas')).toBe(3);
    const bad = screen.getAllByTestId(/^bulk-row-/).filter((x) => x.getAttribute('data-outcome') === 'hata');
    expect(bad).toHaveLength(1);
    expect(bad[0].textContent).toMatch(/MOCK: görsel okunamadı/);
    expect(screen.getByTestId('bulk-summary').textContent).toMatch(/İŞ EKSİK KALDI/);
  });

  it('kompozisyon/kadraj kararı VAR ama konu açıklaması YOK → anlamsal kanıt sayılmaz: analiz çağrılır; sonuçta konu yoksa fikir YAZILMAZ', async () => {
    const port = mkPort();
    const analysis: any = { run: vi.fn(async () => ({ ok: true as const })), refresh: vi.fn(async () => {}) };
    render(withAnalysis(port, analysis, analyzed().map((c) => ({ ...c, note: '' }))));
    await makePlan();
    prepare();
    await finished();
    expect(analysis.run).toHaveBeenCalledTimes(4);
    expect(port.run).not.toHaveBeenCalled();
    expect(screen.getAllByTestId(/^bulk-row-/).every((x) => x.getAttribute('data-outcome') === 'hata')).toBe(true);
  });

  it('art arda 3 fikir hatası → durur (kalan postlar için ücret yok); sınırsız yeniden deneme yok', async () => {
    const port = mkPort({ ideas: () => { throw new PortError('Model çağrısı başarısız', 'model_error', 502); } });
    render(el(port));
    await makePlan();
    prepare();
    await finished();
    expect(port.count('ideas')).toBe(3);
    expect(screen.getByTestId('bulk-halted').textContent).toMatch(/Art arda 3 hata/);
  });
});

describe('oturum taslağı: Marka Kiti/ayarlara gidip dönünce plan + insan metni korunur; yenileme/kapanış gerçek kayıptır', () => {
  it('unmount → aynı kapsamla yeniden kur: plan, kilit, insan metni ve seçili post korunur; dürüst bilgi notu; başka kapsamda hiçbir şey gelmez', async () => {
    const store = createPostDraftStore();
    const port = mkPort();
    const a = render(el(port, { draftStore: store }));
    await makePlan();
    select('p1');
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'AYARLARA GİDİNCE KAYBOLMASIN' } });
    click('post-save-text');
    fireEvent.click(screen.getByLabelText('p1 görseli koru'));
    a.unmount();
    render(el(port, { draftStore: store }));
    await waitFor(() => expect(screen.getByTestId('post-grid').children.length).toBe(4));
    expect(screen.getByTestId('post-text-p1').textContent).toMatch(/AYARLARA GİDİNCE KAYBOLMASIN/);
    expect(screen.getByTestId('post-cell-p1').getAttribute('data-asset-lock')).toBe('true');
    expect(screen.getByTestId('post-restored-note').textContent).toMatch(/korundu.*yenilerseniz ya da kapatırsanız kaybolur/);
    cleanup();
    render(el(port, { draftStore: store, tenantId: 't2' }));
    expect(screen.getByTestId('post-plan-btn').textContent).toBe('Yeni post planı oluştur');
    expect(q('post-cell-p1')).toBeNull();
  });

  it('üretim sürerken ayrılınca istek İPTAL edilir ve dönüşte bu açıkça söylenir (sessiz kayıp yok); plan korunur', async () => {
    const store = createPostDraftStore();
    const port = mkPort({ ideas: (_r, o) => new Promise((_res, rej) => { o.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))); }) });
    const a = render(el(port, { draftStore: store }));
    await makePlan();
    select('p1');
    click('post-gen-this');
    await waitFor(() => expect(port.count('ideas')).toBe(1));
    a.unmount();
    render(el(mkPort(), { draftStore: store }));
    await waitFor(() => expect(screen.getByTestId('post-grid').children.length).toBe(4));
    expect(screen.getByTestId('post-restored-note').textContent).toMatch(/yarıda kalan üretim iptal edildi/);
  });

  it('tarayıcı kapatma/yenileme uyarısı YALNIZ plan varken (kayıp gerçektir); boş ekranda yok', async () => {
    const port = mkPort();
    render(el(port));
    const ev1 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev1);
    expect(ev1.defaultPrevented).toBe(false);
    await makePlan();
    const ev2 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(true);
  });
});
