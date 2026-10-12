import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { scopeCss } from '../scripts/scope-planner-css.mjs';
import fs from 'node:fs';

const fetchInv = vi.fn();
let failInv: Error | null = null;
vi.mock('@/studio/StudioLayout', () => ({ useStudio: () => ({ project: { id: 'p1', name: 'Dieci' }, tenantId: 't1' }) }));
vi.mock('@/studio/feedPlanner/live/livePorts', () => ({
  fetchInventory: (...a: any[]) => (failInv ? (async () => { throw failInv; })() : fetchInv(...a)),
  createBlobResolver: () => ({ resolve: () => Promise.resolve('blob:x'), dispose: vi.fn() }),
  createCopyPort: () => ({ available: true, generate: vi.fn() }),
  createPersistencePort: () => ({ load: vi.fn(async () => null), save: vi.fn() }),
}));
const af = vi.hoisted(() => ({ fn: null as any }));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: (...a: any[]) => af.fn(...a) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1', role: 'admin' } }) }));
const okJson = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
/** URL'ye göre yanıt: marka sesi paketi ve konuşmalı rehber durumu */
const voiceApi = (o: { bundle?: any; guide?: any; fail?: boolean } = {}) => {
  af.fn = vi.fn(async (url: string) => {
    if (o.fail) throw new Error('ağ');
    if (url.startsWith('/api/studio/brand-voice')) return okJson(o.bundle ?? { exists: false });
    if (url.startsWith('/api/studio/brand-guide')) return okJson(o.guide ?? { draft: null, approved: null, bundleExists: false, aiEnabled: true });
    return okJson({});
  });
};
vi.mock('@/studio/feedPlanner/review/loadPixels', () => ({ measureImage: async () => null }));
import StudioPlannerPage, { mondayOf } from '@/studio/pages/StudioPlannerPage';

const readiness = { static: 'ok', carousel: 'ok', story: 'ok', reels: 'error' };
const dto = (id: string, o: any = {}) => ({ id, kind: 'photo', width: 1080, height: 1350, path: `p/${id}.jpg`, thumbPath: null, catalog: null, verifiedProductIds: [], usage: { usedInPostCount: 0, approvedUseCount: 0, pendingUseCount: 0 }, readiness, ...o });
beforeEach(() => { fetchInv.mockReset(); failInv = null; voiceApi(); });
afterEach(() => cleanup());

describe('yetkili Studio planlayıcı sayfası', () => {
  it('katalog sayfalı yüklenir, adaylar planlayıcıya girer; elenen/boyutsuz kayıtlar nedenle raporlanır; ilerleme gösterilir', async () => {
    fetchInv.mockImplementation(async (_p: string, onProgress?: (n: number, p: number) => void) => {
      onProgress?.(3, 2);
      return { items: [dto('a1'), dto('a2'), dto('bad', { width: null })], excluded: [{ id: 'x1', reason: 'inconsistent_asset' }], pages: 2 };
    });
    render(<StudioPlannerPage />);
    await waitFor(() => expect(screen.getByTestId('counts').textContent).toMatch(/Aday havuzu 2/));
    expect(fetchInv).toHaveBeenCalledWith('p1', expect.any(Function));
    expect(screen.getByText(/Studio · gerçek kütüphane ve katalog/)).toBeTruthy();
    expect(screen.queryByText(/Yerel snapshot · model çalışmadı/)).toBeNull();
    expect(screen.getByText(/3 kayıt, 2 sayfada yüklendi/)).toBeTruthy();
    expect(screen.getByText(/bad: boyut bilgisi geçersiz/)).toBeTruthy();
    expect(screen.getByText(/x1: depolama kaydı tutarsız/)).toBeTruthy();
    expect(screen.getByTestId('brand-voice-card')).toBeTruthy();
    expect(screen.getByTestId('persist-status').textContent).toMatch(/Henüz kaydedilmedi|Kayıtlı taslak/);
    expect(screen.queryByTestId('copy-unavailable')).toBeNull(); // port bağlı
  });

  it('katalog yüklenemezse planlayıcı AÇILMAZ (eksik liste ile çalışmaz) ve neden gösterilir', async () => {
    failInv = new Error('Katalog 500 sayfadan uzun; yükleme tamamlanamadı (liste eksik).');
    render(<StudioPlannerPage />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Katalog yüklenemedi: Katalog 500 sayfadan uzun/));
    expect(screen.getByRole('alert').textContent).toMatch(/planlayıcı açılmadı/);
    expect(screen.queryByTestId('counts')).toBeNull();
  });

  it('MARKA DİLİ YOK: plan BLOKLANMAZ (geçici ton paneli), kart "birlikte oluştur" sunar ve konuşma penceresini açar', async () => {
    fetchInv.mockResolvedValue({ items: [dto('a1'), dto('a2')], excluded: [], pages: 1 });
    render(<StudioPlannerPage />);
    await waitFor(() => expect(screen.getByTestId('tone-panel')).toBeTruthy());
    expect(screen.getByTestId('tone-panel').textContent).toMatch(/onaylı marka dili yok/);
    await waitFor(() => expect((screen.getByTestId('make-plan') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByTestId('brand-voice-missing').textContent).toMatch(/Plan akışı bloklanmaz/);
    expect(screen.queryByTestId('guide-chat')).toBeNull();
    fireEvent.click(screen.getByTestId('start-guide')); // planlayıcıdaki düğme
    expect(screen.getByTestId('guide-chat')).toBeTruthy();
  });

  it('ONAYLI REHBER varsa ton paneli yok, "onaylı rehber kullanılır"; kart sürümü gösterir', async () => {
    voiceApi({ guide: { draft: null, bundleExists: false, aiEnabled: true, approved: { version: 2, guide: {}, contentKey: 'a'.repeat(32), approvedAt: 1, approvedBy: 'u1' } } });
    fetchInv.mockResolvedValue({ items: [dto('a1')], excluded: [], pages: 1 });
    render(<StudioPlannerPage />);
    await waitFor(() => expect(screen.getByTestId('voice-approved')).toBeTruthy());
    expect(screen.queryByTestId('tone-panel')).toBeNull();
    expect(screen.getByTestId('brand-guide-status').textContent).toMatch(/sürüm 2/);
  });

  it('yüklü marka sesi paketi varsa da onaylı sayılır', async () => {
    voiceApi({ bundle: { exists: true, valid: true, account: 'dieci', captionCount: 3, excluded: [], guideHashes: {}, verifiedProducts: [] } });
    fetchInv.mockResolvedValue({ items: [dto('a1')], excluded: [], pages: 1 });
    render(<StudioPlannerPage />);
    await waitFor(() => expect(screen.getByTestId('voice-approved')).toBeTruthy());
    expect(screen.queryByTestId('tone-panel')).toBeNull();
  });

  it('marka dili durumu okunamazsa: BİLİNMİYOR — "yok" denmez, plan bloklanmaz, ton isteğe bağlı; karar sunucuda', async () => {
    voiceApi({ fail: true });
    fetchInv.mockResolvedValue({ items: [dto('a1')], excluded: [], pages: 1 });
    render(<StudioPlannerPage />);
    await waitFor(() => expect(screen.getByTestId('tone-panel')).toBeTruthy());
    expect(screen.getByTestId('tone-panel').textContent).toMatch(/\(isteğe bağlı\)/);
    expect(screen.getByTestId('tone-panel').textContent).not.toMatch(/onaylı marka dili yok/);
    await waitFor(() => expect((screen.getByTestId('make-plan') as HTMLButtonElement).disabled).toBe(false));
  });

  it('hafta her zaman Pazartesi\'ye yuvarlanır', () => {
    expect(mondayOf(new Date(2026, 9, 14))).toBe('2026-10-12'); // Çarşamba
    expect(mondayOf(new Date(2026, 9, 18))).toBe('2026-10-12'); // Pazar
    expect(mondayOf(new Date(2026, 9, 12))).toBe('2026-10-12');
  });
});

describe('planlayıcı stil kapsamı', () => {
  it('scoped.css güncel ve YALNIZ .planner-scope altında kural içerir (Studio\'nun diğer sayfalarına sızmaz)', () => {
    const src = fs.readFileSync('studio/feedPlanner/review/styles.css', 'utf8');
    const scoped = fs.readFileSync('studio/feedPlanner/review/scoped.css', 'utf8');
    expect(scoped).toBe(scopeCss(src));
    const selectors = [...scoped.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => m[2].trim());
    expect(selectors.length).toBeGreaterThan(40);
    for (const sel of selectors) for (const part of sel.split(',')) expect(part.trim(), sel).toMatch(/^\.planner-scope(\s|$)/);
    expect(scoped).not.toMatch(/^(body|html|button|h1|h2)\b/m);
  });
});
