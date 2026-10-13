import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Marka dili (yazı rehberi) yönetimi Marka Kiti'ndedir; Post planlayıcı yüzeyinde değil. Gerçek ağ/sağlayıcı YOK (tümü sahte).
const studioCtx = vi.hoisted(() => ({ project: { id: 'p1', name: 'Hal Coffee' }, tenantId: 't1', plannerDrafts: undefined as any }));
vi.mock('@/studio/StudioLayout', () => ({ useStudio: () => studioCtx }));
vi.mock('@/studio/studioData', () => ({ getBrandKit: async () => ({ project: { name: 'Hal Coffee' }, brand: null }) }));
const af = vi.hoisted(() => ({ fn: null as any }));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: (...a: any[]) => af.fn(...a) }));
const authCtx = vi.hoisted(() => ({ user: { uid: 'u1', role: 'admin' } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => authCtx }));
import StudioBrandKitPage from '@/studio/pages/StudioBrandKitPage';
import { createPostDraftStore } from '@/studio/feedPlanner/post/draftStore';
import { emptyPostPlan } from '@/studio/feedPlanner/post/postPlan';

const okJson = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
const voiceApi = (guide: any = null) => {
  af.fn = vi.fn(async (url: string) => {
    if (url.startsWith('/api/studio/brand-voice')) return okJson({ exists: false });
    if (url.startsWith('/api/studio/brand-guide')) return okJson({ draft: null, approved: guide, bundleExists: false, aiEnabled: true });
    return okJson({});
  });
};
beforeEach(() => { voiceApi(); studioCtx.plannerDrafts = undefined; });
afterEach(() => cleanup());
const view = () => render(<MemoryRouter><StudioBrandKitPage /></MemoryRouter>);

describe('Marka Kiti: marka dili yönetimi', () => {
  it('marka dili kartı + "birlikte oluştur" burada; sohbet bu sayfada açılır; planlayıcıya dönüş bağlantısı var', async () => {
    view();
    await waitFor(() => expect(screen.getByTestId('brand-voice-card')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('brand-voice-missing').textContent).toMatch(/Onaylı marka dili yok/));
    expect(screen.queryByTestId('guide-chat')).toBeNull();
    fireEvent.click(screen.getByTestId('brand-guide-open'));
    expect(screen.getByTestId('guide-chat')).toBeTruthy();
    expect(screen.getByTestId('back-to-planner').getAttribute('href')).toBe('/studio/p1/planlayici');
  });

  it('onaylı rehber sürümü burada görünür (idare metni Post yüzeyinde değil)', async () => {
    voiceApi({ version: 3, guide: {}, contentKey: 'a'.repeat(32), approvedAt: 1, approvedBy: 'u1' });
    view();
    await waitFor(() => expect(screen.getByTestId('brand-guide-status').textContent).toMatch(/sürüm 3/));
  });

  it('bellekte Post taslağı varsa dürüst not: korunuyor, yenileme/kapatmada kaybolur; yoksa not yok', async () => {
    view();
    await waitFor(() => expect(screen.getByTestId('brand-voice-card')).toBeTruthy());
    expect(screen.queryByTestId('draft-kept-note')).toBeNull();
    cleanup();
    const store = createPostDraftStore();
    store.set('t1|p1|u1', { plan: { ...emptyPostPlan(), posts: [{ id: 'p1' } as any, { id: 'p2' } as any] }, entries: {}, tone: {}, count: '9', sel: null, doneSig: null, savedAt: 1, interrupted: [] });
    studioCtx.plannerDrafts = store;
    view();
    await waitFor(() => expect(screen.getByTestId('draft-kept-note').textContent).toMatch(/2 post.*korunuyor.*kaybolur/));
  });

  it('başka kapsamın (uid) taslağı gösterilmez', async () => {
    const store = createPostDraftStore();
    store.set('t1|p1|BASKA', { plan: { ...emptyPostPlan(), posts: [{ id: 'p1' } as any] }, entries: {}, tone: {}, count: '9', sel: null, doneSig: null, savedAt: 1, interrupted: [] });
    studioCtx.plannerDrafts = store;
    view();
    await waitFor(() => expect(screen.getByTestId('brand-voice-card')).toBeTruthy());
    expect(screen.queryByTestId('draft-kept-note')).toBeNull();
  });
});

describe('Marka Kiti: kapsam (proje/tenant/UID) değişiminde GEÇ yanıt eski rehber sürümünü göstermez', () => {
  it.each(['project', 'tenant', 'uid'])('%s değişir → eski kapsamın geç yanıtı (sürüm 9) yazılmaz; yeni kapsamın yanıtı (sürüm 2) görünür', async (field) => {
    const pending: Array<{ url: string; resolve: (v: any) => void; gen: number }> = [];
    let gen = 1;
    af.fn = vi.fn((url: string) => new Promise((resolve) => pending.push({ url, resolve, gen })));
    const ui = () => <MemoryRouter><StudioBrandKitPage /></MemoryRouter>;
    const r = render(ui());
    await waitFor(() => expect(pending.length).toBeGreaterThan(0));
    // kapsam değişir (aynı bileşen örneği, yeniden çizim)
    gen = 2;
    if (field === 'project') studioCtx.project = { id: 'p2', name: 'Baska' };
    if (field === 'tenant') studioCtx.tenantId = 't2';
    if (field === 'uid') authCtx.user = { uid: 'u2', role: 'admin' };
    r.rerender(ui());
    await waitFor(() => expect(pending.some((x) => x.gen === 2)).toBe(true));
    const answer = (x: { url: string; resolve: (v: any) => void }, version: number) => x.resolve(x.url.startsWith('/api/studio/brand-guide')
      ? okJson({ draft: null, approved: { version, guide: {}, contentKey: 'a'.repeat(32), approvedAt: 1, approvedBy: 'u1' }, bundleExists: false, aiEnabled: true })
      : okJson({ exists: false }));
    // ESKİ kapsam geç döner
    for (const x of pending.filter((p) => p.gen === 1)) answer(x, 9);
    await new Promise((res) => setTimeout(res, 50));
    expect(document.body.textContent).not.toMatch(/sürüm 9/);
    for (const x of pending.filter((p) => p.gen === 2)) answer(x, 2);
    await waitFor(() => expect(screen.getByTestId('brand-guide-status').textContent).toMatch(/sürüm 2/));
    expect(document.body.textContent).not.toMatch(/sürüm 9/);
    studioCtx.project = { id: 'p1', name: 'Hal Coffee' }; studioCtx.tenantId = 't1'; authCtx.user = { uid: 'u1', role: 'admin' };
  });
});

