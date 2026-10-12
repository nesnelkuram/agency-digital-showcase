import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import PostPlanner from '@/studio/feedPlanner/post/PostPlanner';
import { aest, cand } from './helpers';
import { mkPort, portsWith, PortError } from '../creative/uiFixtures';

// Toplu metin üretimi: AÇIK tek kullanıcı eylemi; post başına fikir → ilk fikir seçimi → caption [→ kontrol]. Model SAHTE (sıfır sağlayıcı).
const candidates = () => Array.from({ length: 6 }, (_, i) => cand('c' + i, { brand: 'dieci', dims: { w: 1000, h: 1500 }, note: 'konu' }));
const measure = vi.fn(async () => aest());
type Port = ReturnType<typeof mkPort>;
const el = (port: Port, voice: { approved: boolean | null } = { approved: true }) => (
  <PostPlanner candidates={candidates()} projectId="dieci" tenantId="t1" userId="u1" initialCount={4} measureCrop={measure} ports={portsWith(port)} voice={voice} />
);
beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const btn = (id: string) => screen.getByTestId(id) as HTMLButtonElement;
const setup = async (port: Port, voice?: { approved: boolean | null }) => {
  render(el(port, voice));
  await waitFor(() => expect(btn('post-plan-btn').disabled).toBe(false));
  click('post-plan-btn');
};
const approve = () => {}; // görsel plan onay kutusu kaldırıldı: roller doğrudan açık
const finished = () => waitFor(() => expect(screen.getByTestId('bulk-summary').getAttribute('data-phase')).toBe('done'), { timeout: 5000 });

describe('toplu metin üretimi', () => {
  it('plan yokken kapalı; plan olunca açık (görsel plan onay kutusu yok); açılınca onay kutusu çıkar ve Başlat\'a kadar HİÇ çağrı yok; vazgeçilebilir', async () => {
    const port = mkPort();
    render(el(port));
    expect(btn('bulk-open').disabled).toBe(true);
    await waitFor(() => expect(btn('post-plan-btn').disabled).toBe(false));
    click('post-plan-btn');
    expect(screen.queryByTestId('post-visual-done')).toBeNull();
    await waitFor(() => expect(btn('bulk-open').disabled).toBe(false));
    click('bulk-open');
    expect(screen.getByTestId('bulk-confirm').textContent).toMatch(/4 post.*ilk fikir otomatik seçilir.*8 model çağrısı/);
    expect(port.run).not.toHaveBeenCalled();
    click('bulk-cancel-confirm');
    expect(screen.queryByTestId('bulk-confirm')).toBeNull();
    expect(port.run).not.toHaveBeenCalled();
  });

  it('Başlat: her post için fikir + ilk fikir (i1) seçimi + caption (4×2=8 çağrı), kontrol YOK; hepsi metin alır', async () => {
    const port = mkPort();
    await setup(port);
    approve();
    click('bulk-open');
    click('bulk-start');
    await finished();
    expect(port.count('ideas')).toBe(4);
    expect(port.count('caption')).toBe(4);
    expect(port.count('check')).toBe(0);
    expect(port.calls.filter((c) => c.role === 'caption').every((c: any) => c.idea.sourceIdeaId === 'i1')).toBe(true);
    expect(screen.getAllByTestId(/^bulk-row-/).every((r) => r.getAttribute('data-outcome') === 'üretildi')).toBe(true);
    for (const id of ['p1', 'p2', 'p3', 'p4']) expect(screen.getByTestId(`post-text-${id}`).getAttribute('data-status')).toBe('geçerli');
  });

  it('kontrol seçeneği işaretliyse post başına +1 çağrı (4×3=12)', async () => {
    const port = mkPort();
    await setup(port);
    approve();
    click('bulk-open');
    fireEvent.click(screen.getByTestId('bulk-check-option'));
    expect(screen.getByTestId('bulk-confirm').textContent).toMatch(/12 model çağrısı/);
    click('bulk-start');
    await finished();
    expect(port.count('check')).toBe(4);
  });

  it('ikinci toplu çalıştırma geçerli metinleri atlar (yeniden ücret yok); elle yazılmış metin ASLA ezilmez', async () => {
    const port = mkPort();
    await setup(port);
    approve();
    click('bulk-open');
    click('bulk-start');
    await finished();
    const before = port.run.mock.calls.length;
    // p2'yi elle düzenle
    fireEvent.click(screen.getByLabelText('p2 incele'));
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'Benim elle yazdığım metin' } });
    click('post-save-text');
    click('bulk-dismiss');
    click('bulk-open');
    click('bulk-start');
    await finished();
    expect(port.run.mock.calls.length).toBe(before);
    expect(screen.getByTestId('post-text-p2').textContent).toMatch(/Benim elle yazdığım metin/);
    expect(screen.getAllByTestId(/^bulk-row-/).every((r) => r.getAttribute('data-outcome') === 'atlandı')).toBe(true);
  });

  it('art arda 3 hata → durur (kalan postlar için ücret yok)', async () => {
    const port = mkPort({ ideas: () => { throw new PortError('Model çağrısı başarısız', 'model_error', 502); } });
    await setup(port);
    approve();
    click('bulk-open');
    click('bulk-start');
    await finished();
    expect(port.count('ideas')).toBe(3);
    expect(screen.getByTestId('bulk-halted').textContent).toMatch(/Art arda 3 hata/);
    expect(screen.getAllByTestId(/^bulk-row-/)).toHaveLength(3);
  });

  it('Durdur: uçuştaki çağrı iptal, kalan postlar işlenmez', async () => {
    let gate!: () => void;
    const port = mkPort({ ideas: (_r, o) => new Promise((_res, rej) => { gate = () => {}; o.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))); }) });
    await setup(port);
    approve();
    click('bulk-open');
    click('bulk-start');
    await waitFor(() => expect(screen.getByTestId('bulk-progress')).toBeTruthy());
    await waitFor(() => expect(port.count('ideas')).toBe(1));
    click('bulk-stop');
    await finished();
    expect(port.count('ideas')).toBe(1);
    expect(screen.getByTestId('bulk-halted').textContent).toMatch(/İptal edildi/);
    void gate;
  });

  it('marka dili ve ton yokken de toplu üretim çalışır (sade varsayılan ton)', async () => {
    const port = mkPort();
    await setup(port, { approved: false });
    approve();
    click('bulk-open');
    click('bulk-start');
    await finished();
    expect(port.count('caption')).toBe(4);
    expect(port.calls.every((c: any) => c.tempTone === undefined)).toBe(true);
  });

  it('tek post: "Bu post için metin yaz" = fikir + ilk fikir + caption (2 çağrı); "Yeniden yaz" yalnız caption (+1); elle metin üzerine yazılır ve geçmişte saklanır', async () => {
    const port = mkPort();
    await setup(port);
    fireEvent.click(screen.getByLabelText('p1 incele'));
    expect(btn('post-gen-this').textContent).toMatch(/Bu post için metin yaz/);
    click('post-gen-this');
    await waitFor(() => expect(screen.getByTestId('post-text-p1').getAttribute('data-status')).toBe('geçerli'));
    expect(port.count('ideas')).toBe(1);
    expect(port.count('caption')).toBe(1);
    await waitFor(() => expect(btn('post-gen-this').textContent).toMatch(/Yeniden yaz/));
    click('post-gen-this');
    await waitFor(() => expect(screen.getByTestId('post-text-p1').textContent).toMatch(/Metin 2/));
    expect(port.count('caption')).toBe(2);
    expect(port.count('ideas')).toBe(1);
    // elle yaz → yeniden yaz: üzerine yazılır, elle metin geçmişte
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'Benim elle yazdığım metin' } });
    click('post-save-text');
    await waitFor(() => expect(btn('post-gen-this').disabled).toBe(false));
    click('post-gen-this');
    await waitFor(() => expect(port.count('caption')).toBe(3));
    await waitFor(() => expect(screen.getByTestId('post-text-p1').textContent).not.toMatch(/Benim elle yazdığım metin/));
    fireEvent.click(screen.getByText(/Adım adım/));
    expect(screen.getByTestId('text-history').textContent).toMatch(/Benim elle yazdığım metin/);
  });
});
