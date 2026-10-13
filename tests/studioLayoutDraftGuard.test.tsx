import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Studio düzeyi kayıp koruması: bellekteki Post taslağı varken yenile/kapat ve açık çıkış için VAZGEÇME yolu. Gerçek servis/ağ YOK.
const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1', role: 'admin', displayName: 'Mock' }, signOut: auth.signOut }) }));
vi.mock('@/shared/hooks/useTenant', () => ({ useTenantId: () => 't1', useTenant: () => ({ tenant: { settings: { timezone: 'UTC' } } }) }));
vi.mock('@/admin/contexts/NotificationsContext', () => ({ NotificationsProvider: ({ children }: any) => children }));
vi.mock('@/admin/components/NotificationDropdown', () => ({ default: () => null }));
vi.mock('@/studio/studioData', () => ({ getStudioProjects: async () => [{ id: 'dieci', name: 'Dieci' }], setStudioTimeZone: () => {}, studioLinkFor: () => '' }));
import StudioLayout, { useStudio } from '@/studio/StudioLayout';
import { emptyPostPlan } from '@/studio/feedPlanner/post/postPlan';

let store: any;
const Probe = () => { store = useStudio().plannerDrafts; return <p>içerik</p>; };
const mount = () => render(<MemoryRouter initialEntries={['/studio/dieci/x']}><Routes><Route path="/studio/:projectId" element={<StudioLayout />}><Route path="x" element={<Probe />} /></Route></Routes></MemoryRouter>);
const addDraft = () => store.set('t1|dieci|u1', { plan: { ...emptyPostPlan(), posts: [{ id: 'p1' } as any] }, entries: {}, tone: {}, count: '9', sel: null, doneSig: null, savedAt: 1, interrupted: [] });
const signOutBtn = async () => { await waitFor(() => expect(screen.getByText('içerik')).toBeTruthy()); fireEvent.click(document.querySelector('header button')!); return screen.getByRole('button', { name: 'Çıkış Yap' }); };
beforeEach(() => { auth.signOut.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Studio düzeyi kayıp koruması', () => {
  it('taslak YOKKEN: yenile/kapat uyarısı yok; çıkışta onay sorulmaz', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    mount();
    await waitFor(() => expect(store).toBeTruthy());
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    fireEvent.click(await signOutBtn());
    expect(confirm).not.toHaveBeenCalled();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('taslak VARKEN (Post planlayıcı açık olmasa da): yenile/kapat uyarısı; taslak silinince uyarı kalkar', async () => {
    mount();
    await waitFor(() => expect(store).toBeTruthy());
    addDraft();
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    store.clear('t1|dieci|u1');
    const ev2 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(false);
  });

  it('açık çıkış: taslak varken ONAY sorulur; Vazgeç → çıkış YAPILMAZ ve taslak durur; Tamam → çıkış yapılır', async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirm);
    mount();
    await waitFor(() => expect(store).toBeTruthy());
    addDraft();
    fireEvent.click(await signOutBtn());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(String(confirm.mock.calls[0][0])).toMatch(/kaybolur/);
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(store.hasWork()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Çıkış Yap' }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
  });

  it('signOut BAŞARISIZ olursa taslak SİLİNMEZ (çıkış gerçekleşmedi); başarılıysa atılır', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    auth.signOut.mockRejectedValueOnce(new Error('ağ'));
    mount();
    await waitFor(() => expect(store).toBeTruthy());
    addDraft();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    fireEvent.click(await signOutBtn());
    await new Promise((r) => setTimeout(r, 30));
    process.off('unhandledRejection', unhandled);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(store.hasWork()).toBe(true); // çıkış olmadı: taslak yerinde
    auth.signOut.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Çıkış Yap' }));
    await waitFor(() => expect(store.hasWork()).toBe(false));
  });
});
