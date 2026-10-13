import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, RouterProvider, createMemoryRouter, Routes, Route, Link, useNavigate, useLocation, Outlet } from 'react-router-dom';

// Studio dışına uygulama içi gezinmede taslak kaybı: açık uyarı + vazgeçme yolu (link, programatik, geri/ileri). Gerçek yönlendiriciler; servis/ağ YOK.
const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1', role: 'admin', displayName: 'Mock' }, signOut: auth.signOut }) }));
vi.mock('@/shared/hooks/useTenant', () => ({ useTenantId: () => 't1', useTenant: () => ({ tenant: { settings: { timezone: 'UTC' } } }) }));
vi.mock('@/admin/contexts/NotificationsContext', () => ({ NotificationsProvider: ({ children }: any) => children }));
vi.mock('@/admin/components/NotificationDropdown', () => ({ default: () => null }));
vi.mock('@/studio/studioData', () => ({ getStudioProjects: async () => [{ id: 'dieci', name: 'Dieci' }], setStudioTimeZone: () => {}, studioLinkFor: () => '' }));
import StudioLayout, { useStudio } from '@/studio/StudioLayout';
import { emptyPostPlan } from '@/studio/feedPlanner/post/postPlan';

let store: any;
const Planner = () => { store = useStudio().plannerDrafts; return <p data-testid="studio-page">PLANNER</p>; };
const Marka = () => <p data-testid="studio-marka">MARKA</p>;
const addDraft = () => store.set('t1|dieci|u1', { plan: { ...emptyPostPlan(), posts: [{ id: 'p1' } as any] }, entries: {}, tone: {}, count: '9', sel: null, doneSig: null, savedAt: 1, interrupted: [] });
const Nav = () => {
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <nav>
      <output data-testid="path">{loc.pathname}</output>
      <Link to="/outside">Outside link</Link>
      <Link to="/studio/dieci/planlayici">Enter Studio</Link>
      <Link to="/studio/dieci/marka">Marka link</Link>
      <button onClick={() => nav('/outside')}>Outside push</button>
      <button onClick={() => nav('/outside', { replace: true })}>Outside replace</button>
      <button onClick={() => nav(-1)}>Back</button>
      <button onClick={() => nav(-999)}>Back far</button>
      <button onClick={() => nav(1)}>Forward</button>
    </nav>
  );
};
const routes = (
  <>
    <Nav />
    <Routes>
      <Route path="/outside" element={<p data-testid="outside">OUTSIDE</p>} />
      <Route path="/studio/:projectId" element={<StudioLayout />}>
        <Route path="planlayici" element={<Planner />} />
        <Route path="marka" element={<Marka />} />
      </Route>
    </Routes>
  </>
);
const btn = (name: string) => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const path = () => screen.getByTestId('path').textContent;
const studioReady = () => waitFor(() => expect(store).toBeTruthy());
const history = () => window.history as History;
beforeEach(() => { store = undefined; auth.signOut.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('MemoryRouter (bildirimsel): link / push / replace / geri / ileri', () => {
  const mount = (entries = ['/outside', '/studio/dieci/planlayici'], idx = entries.length - 1) => render(<MemoryRouter initialEntries={entries} initialIndex={idx}>{routes}</MemoryRouter>);

  it.each(['link', 'push', 'replace'])('%s: taslak varken Studio dışına → TEK uyarı; vazgeç = konum ve taslak aynen; onay = hedefe GİDER ve taslak bilinçli atılır', async (mode) => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirm);
    mount();
    await studioReady();
    addDraft();
    const go = () => (mode === 'link' ? fireEvent.click(screen.getByRole('link', { name: 'Outside link' })) : btn(mode === 'push' ? 'Outside push' : 'Outside replace'));
    go();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(path()).toBe('/studio/dieci/planlayici');
    expect(screen.getByTestId('studio-page')).toBeTruthy();
    expect(store.hasWork()).toBe(true);
    go();
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(path()).toBe('/outside');
  });

  it('taslak YOKKEN uyarı yok; Studio İÇİ geçiş (Marka Kiti) taslak varken de engellenmez', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    mount();
    await studioReady();
    fireEvent.click(screen.getByRole('link', { name: 'Marka link' }));
    await waitFor(() => expect(screen.getByTestId('studio-marka')).toBeTruthy());
    addDraft();
    fireEvent.click(screen.getByRole('link', { name: 'Enter Studio' }));
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeTruthy());
    expect(confirm).not.toHaveBeenCalled();
    store.clearAll();
    btn('Outside push');
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).not.toHaveBeenCalled();
  });

  it('Studio İÇİ geri/ileri (Marka Kiti ↔ Planlayıcı) taslak varken sorulmaz; dışarı geri/ileri sorulur', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    mount(['/outside', '/studio/dieci/planlayici']);
    await studioReady();
    addDraft();
    fireEvent.click(screen.getByRole('link', { name: 'Marka link' }));
    await waitFor(() => expect(screen.getByTestId('studio-marka')).toBeTruthy());
    btn('Back');
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeTruthy());
    btn('Forward');
    await waitFor(() => expect(screen.getByTestId('studio-marka')).toBeTruthy());
    expect(confirm).not.toHaveBeenCalled();
    btn('Back');
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeTruthy());
    btn('Back'); // artık dışarı (/outside)
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(path()).toBe('/studio/dieci/planlayici');
  });

  it('tekrarlı geri vazgeçme: her deneme TEK uyarı, taslak durur, döngü yok; onay çıkarır; ileri taslaksız Studio\'ya döner', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    mount();
    await studioReady();
    addDraft();
    const oldStore = store;
    btn('Back'); btn('Back'); btn('Back');
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(path()).toBe('/studio/dieci/planlayici');
    confirm.mockReturnValue(true);
    btn('Back');
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(4);
    expect(oldStore.hasWork()).toBe(false); // onaylı çıkışta taslak BİLİNÇLİ atılır (eski depo boşalır)
    btn('Forward');
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(4);
    expect(store.hasWork()).toBe(false);
  });

  it('ETKİSİZ gezinme (geçmiş sınırını aşan go(-999)) onaylansa bile taslağı SİLMEZ; sonraki dışarı gezinme yine sorulur ve taslak korunur', async () => {
    const confirm = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirm);
    mount(['/studio/dieci/planlayici']); // tek girdi: go(-999) en yakın girdiye (kendisine) sıkışır → etkisiz
    await studioReady();
    addDraft();
    const oldStore = store;
    btn('Back far'); // onaylandı ama gidecek geçmiş girdisi yok: hiçbir yere çıkılmadı
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(path()).toBe('/studio/dieci/planlayici');
    expect(oldStore.hasWork()).toBe(true); // erken silinmedi
    btn('Outside push'); // yine sorulur (vazgeç)
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(path()).toBe('/studio/dieci/planlayici');
    expect(oldStore.hasWork()).toBe(true);
    btn('Outside push'); // onay: şimdi GERÇEKTEN çıkılır
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(oldStore.hasWork()).toBe(false); // taslak gerçek terkte atıldı
  });

  it('Studio kapanınca (dışarı onaylı çıkış) yöntemler geri yüklenir: dışarıdaki gezinme artık sorulmaz', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    mount(['/studio/dieci/planlayici']);
    await studioReady();
    addDraft();
    btn('Outside push');
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('link', { name: 'Enter Studio' }));
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeTruthy());
    btn('Outside push');
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});

describe('BrowserRouter (üretim yönlendiricisi, gerçek pencere geçmişi): tarayıcı geri/ileri', () => {
  const mount = (url: string) => { history().replaceState(null, '', url); return render(<BrowserRouter>{routes}</BrowserRouter>); };
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });

  it('geri → Studio dışına: router\'a ULAŞMADAN durdurulur; vazgeç = konum, ekran ve taslak değişmez (tekrarlı vazgeçme döngü yapmaz); onay = hedefe gider', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    // Gerçek tarayıcıda history.go() ASENKRONDUR (ayrı görev): vazgeçme geri alması, router'ın gördüğü ara durumu görünür kılar. Aynısını simüle et.
    const realGo = history().go.bind(history());
    const goSpy = vi.spyOn(history(), 'go').mockImplementation((d?: number) => { setTimeout(() => realGo(d), 5); });
    mount('/outside');
    fireEvent.click(screen.getByRole('link', { name: 'Enter Studio' }));
    await studioReady();
    addDraft();
    const oldStore = store;
    const pageNode = screen.getByTestId('studio-page');
    const idx0 = (history().state as any).idx;
    history().back(); await settle();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('studio-page')).toBe(pageNode); // Studio hiç yeniden kurulmadı: router bu geçişi görmedi
    expect(window.location.pathname).toBe('/studio/dieci/planlayici');
    expect(path()).toBe('/studio/dieci/planlayici');
    expect(screen.getByTestId('studio-page')).toBeTruthy();
    expect((history().state as any).idx).toBe(idx0);
    history().back(); await settle();
    history().back(); await settle();
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(window.location.pathname).toBe('/studio/dieci/planlayici');
    expect(screen.getByTestId('studio-page')).toBe(pageNode);
    expect(oldStore.hasWork()).toBe(true);
    confirm.mockReturnValue(true);
    history().back(); await settle();
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(4);
    expect(window.location.pathname).toBe('/outside');
    expect(oldStore.hasWork()).toBe(false); // onaylı çıkış: bilinçli atıldı
    goSpy.mockRestore();
  });

  it('ileri → Studio dışına: vazgeç sonra onay; geri gelince taslaksız Studio, uyarı yok', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    mount('/studio/dieci/planlayici');
    await studioReady();
    btn('Outside push'); // taslak yok: uyarısız
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).not.toHaveBeenCalled();
    history().back(); await settle(); // Studio'ya geri (taslaksız, uyarı yok)
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeTruthy());
    addDraft();
    history().forward(); await settle();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/studio/dieci/planlayici');
    expect(screen.getByTestId('studio-page')).toBeTruthy();
    confirm.mockReturnValue(true);
    history().forward(); await settle();
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(2);
    history().back(); await settle();
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('programatik Back (navigate(-1)) TEK uyarı: yöntem onayı sonrası doğan popstate ikinci kez sormaz; vazgeçilince hiç gitmez; sonraki yerel geri yine sorar', async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirm);
    mount('/outside');
    fireEvent.click(screen.getByRole('link', { name: 'Enter Studio' }));
    await studioReady();
    addDraft();
    const oldStore = store;
    btn('Back'); await settle();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(path()).toBe('/studio/dieci/planlayici');
    btn('Back'); await settle();
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(2); // ikinci denemede de TEK uyarı
    expect(oldStore.hasWork()).toBe(false);
  });

  it('ETKİSİZ programatik go (popstate doğmaz) hiçbir şeyi onaylamaz ve uyarı çıkarmaz; ardından GELEN bağımsız yerel geri kendi uyarısını alır (otomatik onay YOK)', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    mount('/outside');
    fireEvent.click(screen.getByRole('link', { name: 'Enter Studio' }));
    await studioReady();
    addDraft();
    const goSpy = vi.spyOn(history(), 'go').mockImplementation(() => {}); // tarayıcı go()'yu yok sayar: etkisiz
    btn('Back'); await settle();
    expect(confirm).not.toHaveBeenCalled(); // uyarı yalnız gerçek popstate'te sorulur
    expect(path()).toBe('/studio/dieci/planlayici');
    goSpy.mockRestore();
    history().back(); await settle(); // bağımsız yerel geri
    expect(confirm).toHaveBeenCalledTimes(1); // KENDİ uyarısı
    expect(path()).toBe('/studio/dieci/planlayici');
    expect(store.hasWork()).toBe(true);
  });

  it('programatik Forward da TEK uyarı (tarayıcı geçmişi); vazgeçme sonrası bağımsız hareket yeniden sorar', async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirm);
    mount('/studio/dieci/planlayici');
    await studioReady();
    btn('Outside push'); // taslak yok
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    history().back(); await settle();
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeTruthy());
    addDraft();
    btn('Forward'); await settle();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(path()).toBe('/studio/dieci/planlayici');
    history().forward(); await settle();
    expect(confirm).toHaveBeenCalledTimes(2);
    btn('Forward'); await settle();
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it('Studio İÇİ geri/ileri ve taslaksız geri engellenmez; link/push da yakalanır', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    mount('/outside');
    fireEvent.click(screen.getByRole('link', { name: 'Enter Studio' }));
    await studioReady();
    addDraft();
    fireEvent.click(screen.getByRole('link', { name: 'Marka link' }));
    await waitFor(() => expect(screen.getByTestId('studio-marka')).toBeTruthy());
    history().back(); await settle();
    await waitFor(() => expect(screen.getByTestId('studio-page')).toBeTruthy());
    history().forward(); await settle();
    await waitFor(() => expect(screen.getByTestId('studio-marka')).toBeTruthy());
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Outside link' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(path()).toBe('/studio/dieci/marka');
  });
});

describe('veri yönlendiricisi (createMemoryRouter): resmî useBlocker yolu', () => {
  const make = (entries: string[], index: number) => createMemoryRouter([{ path: '*', element: routes }], { initialEntries: entries, initialIndex: index });

  it('link ve geri: vazgeç = konum/taslak aynen; onay = hedefe gider; TEK uyarı', async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirm);
    const router = make(['/outside', '/studio/dieci/planlayici'], 1);
    render(<RouterProvider router={router} />);
    await studioReady();
    addDraft();
    fireEvent.click(screen.getByRole('link', { name: 'Outside link' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(router.state.location.pathname).toBe('/studio/dieci/planlayici');
    await act(async () => { await router.navigate(-1); });
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(router.state.location.pathname).toBe('/studio/dieci/planlayici');
    expect(store.hasWork()).toBe(true);
    await act(async () => { await router.navigate(-1); });
    await waitFor(() => expect(router.state.location.pathname).toBe('/outside'));
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it('taslaksız ve Studio içi geçiş uyarısız', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const router = make(['/studio/dieci/planlayici'], 0);
    render(<RouterProvider router={router} />);
    await studioReady();
    await act(async () => { await router.navigate('/studio/dieci/marka'); });
    expect(router.state.location.pathname).toBe('/studio/dieci/marka');
    addDraft();
    await act(async () => { await router.navigate('/studio/dieci/planlayici'); });
    expect(confirm).not.toHaveBeenCalled();
  });
});
