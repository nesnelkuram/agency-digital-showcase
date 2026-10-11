import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ exists: false }) })) }));
vi.mock('@/studio/feedPlanner/review/loadPixels', () => ({ measureImage: async () => null }));
import StudioPlannerPage, { mondayOf } from '@/studio/pages/StudioPlannerPage';

const readiness = { static: 'ok', carousel: 'ok', story: 'ok', reels: 'error' };
const dto = (id: string, o: any = {}) => ({ id, kind: 'photo', width: 1080, height: 1350, path: `p/${id}.jpg`, thumbPath: null, catalog: null, verifiedProductIds: [], usage: { usedInPostCount: 0, approvedUseCount: 0, pendingUseCount: 0 }, readiness, ...o });
beforeEach(() => { fetchInv.mockReset(); failInv = null; });
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
