import React, { useContext, useEffect, useRef } from 'react';
import { UNSAFE_DataRouterContext, UNSAFE_NavigationContext, useBlocker, useLocation, useNavigationType } from 'react-router-dom';

/**
 * Studio düzenini terk ederken bellekteki Post taslağını (kalıcı kayıt YOK) kaybettirecek her uygulama içi gezinmede açık uyarı + vazgeçme yolu.
 * Kapsam: link tıklaması, programatik yönlendirme (push/replace/go) ve tarayıcı geri/ileri. Studio İÇİ geçişler (ör. Marka Kiti) engellenmez.
 * Yenile/kapat (beforeunload) ve açık çıkış (signOut) ayrı korunur; tam sayfa yüklemesi (<a href>) beforeunload'a düşer (tek tarayıcı uyarısı).
 *
 * Yönlendirici mimarisi: üretimde <BrowserRouter> (bildirimsel; `useBlocker` YOK), testlerde MemoryRouter, ileride veri yönlendiricisi olabilir:
 *  - veri yönlendiricisi → resmî `useBlocker` (geri/ileri dâhil, router kendisi geri alır);
 *  - bildirimsel → router'ın gezinme nesnesi (push/replace/go) Studio açıkken yerinde sarılır + `popstate` YAKALAMA aşamasında karşılanır: terk edecek geri/ileri
 *    router'a ULAŞMADAN durdurulur (konum/ekran/taslak hiç değişmez); vazgeçilirse tarayıcı girdisi geri alınır (geri alma popstate'i yutulur → döngü yok),
 *    onaylanırsa aynı olay router'a iletilir (onay hedefe gerçekten götürür).
 */
export const isInsideStudio = (p: string) => /^\/studio(\/|$)/.test(p) && !/^\/studio\/intro(\/|$)/.test(p);
export const LEAVE_MESSAGE = 'Kaydedilmemiş Post planınız ve metinleriniz bu oturumun belleğinde tutuluyor; Studio dışına çıkarsanız kaybolur. Yine de çıkılsın mı?';
const pathOf = (to: unknown): string => (typeof to === 'string' ? to.split(/[?#]/)[0] : String((to as { pathname?: string } | null)?.pathname ?? ''));
const readIdx = (): number | null => { const i = (window.history.state as { idx?: unknown } | null)?.idx; return typeof i === 'number' ? i : null; };

interface GuardProps { hasWork: () => boolean; discard: () => void; children?: React.ReactNode }

function DataGuard({ hasWork, discard }: GuardProps) {
  /** Onay yalnız "çıkış izni"dir: taslak, Studio GERÇEKTEN kapanınca atılır (etkisiz/başarısız gezinmede korunur) */
  const leaveOk = useRef(false);
  const discardRef = useRef(discard); discardRef.current = discard;
  useEffect(() => () => { if (leaveOk.current) discardRef.current(); }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => hasWork() && isInsideStudio(currentLocation.pathname) && !isInsideStudio(nextLocation.pathname));
  const asked = useRef<unknown>(null);
  useEffect(() => {
    if (blocker.state !== 'blocked') { asked.current = null; return; }
    if (asked.current === blocker.location) return; // StrictMode çift efekti: aynı engel için TEK uyarı
    asked.current = blocker.location;
    leaveOk.current = false;
    if (window.confirm(LEAVE_MESSAGE)) { leaveOk.current = true; blocker.proceed(); } else blocker.reset();
  }, [blocker]);
  return null;
}

function DeclarativeGuard({ hasWork, discard, children }: GuardProps) {
  const navCtx = useContext(UNSAFE_NavigationContext);
  const location = useLocation();
  const navType = useNavigationType();
  const hasWorkRef = useRef(hasWork); hasWorkRef.current = hasWork;
  const discardRef = useRef(discard); discardRef.current = discard;
  const here = useRef(location.pathname); here.current = location.pathname;
  /** Uygulama içi geçmiş aynası (go(delta) hedefini bilmek için): yalnız bu düzen açıkken görülen girdiler */
  const stack = useRef<{ paths: string[]; i: number }>({ paths: [location.pathname], i: 0 });
  const pendingDelta = useRef<number | null>(null);
  const lastIdx = useRef<number | null>(readIdx());
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; lastIdx.current = readIdx(); return; }
    const s = stack.current;
    if (navType === 'PUSH') { s.paths = s.paths.slice(0, s.i + 1); s.paths.push(location.pathname); s.i = s.paths.length - 1; }
    else if (navType === 'REPLACE') s.paths[s.i] = location.pathname;
    else {
      const idx = readIdx();
      const d = pendingDelta.current ?? (idx !== null && lastIdx.current !== null ? idx - lastIdx.current : 0);
      const ni = s.i + d;
      if (ni >= 0 && ni < s.paths.length && s.paths[ni] === location.pathname) s.i = ni; else { s.paths = [location.pathname]; s.i = 0; }
    }
    pendingDelta.current = null;
    lastIdx.current = readIdx();
  }, [location.key, location.pathname, navType]);

  /**
   * Onay yalnız "çıkış izni"dir (`leaveOk`): taslak, Studio GERÇEKTEN kapanırken (aşağıdaki unmount temizliği) atılır. Etkisiz / başarısız / Studio içinde
   * kalan gezinme (ör. geçmiş sınırını aşan go(-999), bilinmeyen go hedefi) taslağı SİLMEZ; sonraki her gezinme izni yeniden sorar.
   */
  const leaveOk = useRef(false);
  useEffect(() => () => { if (leaveOk.current) discardRef.current(); }, []);
  const confirmLeave = (): boolean => {
    leaveOk.current = false;
    if (!hasWorkRef.current()) return true;
    if (window.confirm(LEAVE_MESSAGE)) { leaveOk.current = true; return true; }
    return false;
  };

  /**
   * Yönlendiricinin TEK gezinme nesnesinin push/replace/go yöntemleri Studio açıkken YERİNDE sarılır (kapanınca geri yüklenir): Studio dışındaki bileşenler
   * (üst çubuk, başka sayfalardaki linkler) de aynı nesneyi kullandığı için programatik/link gezinmesi nereden gelirse gelsin yakalanır.
   */
  useEffect(() => {
    const nav: any = navCtx.navigator;
    const isMemoryHistory = 'index' in nav; // createMemoryHistory'nin `index` erişimcisi var; tarayıcı geçmişinde yok
    const orig = { push: nav.push, replace: nav.replace, go: nav.go };
    const leaving = (dest: string | undefined) => isInsideStudio(here.current) && !(dest !== undefined && isInsideStudio(dest));
    const guarded = (kind: 'push' | 'replace') => (to: any, state?: any, opts?: any) => {
      leaveOk.current = false;
      if (leaving(pathOf(to)) && !confirmLeave()) return; // vazgeç: hiçbir şey olmaz
      return orig[kind].call(nav, to, state, opts);
    };
    const patched = {
      push: guarded('push'),
      replace: guarded('replace'),
      go: (delta: number) => {
        leaveOk.current = false;
        // Tarayıcı geçmişinde go(), kendi `popstate` olayını doğurur ve onu aşağıdaki yakalayıcı TEK KEZ sorar (hedef kesin bilinir; no-op go'da olay da uyarı da yoktur).
        // popstate'i OLMAYAN bellek geçmişinde (MemoryRouter) uyarı burada, aynı hareket için yine TEK kez sorulur.
        if (isMemoryHistory) {
          const dest = stack.current.paths[stack.current.i + delta];
          if (leaving(dest) && !confirmLeave()) return;
        }
        pendingDelta.current = delta;
        return orig.go.call(nav, delta);
      },
    };
    nav.push = patched.push; nav.replace = patched.replace; nav.go = patched.go;
    return () => {
      if (nav.push === patched.push) nav.push = orig.push;
      if (nav.replace === patched.replace) nav.replace = orig.replace;
      if (nav.go === patched.go) nav.go = orig.go;
    };
  }, [navCtx.navigator]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tarayıcı geri/ileri: YAKALAMA aşamasında, router'dan ÖNCE
  useEffect(() => {
    const pass = { v: false };
    const revert = { v: false };
    const onPop = (e: Event) => {
      if (pass.v) { pass.v = false; return; } // onaylanan geçiş: router görsün
      if (revert.v) { revert.v = false; e.stopImmediatePropagation(); return; } // vazgeçme için yaptığımız geri alma: router görmez
      leaveOk.current = false;
      if (!hasWorkRef.current()) return;
      if (isInsideStudio(window.location.pathname) || !isInsideStudio(here.current)) return; // Studio içi geri/ileri engellenmez
      e.stopImmediatePropagation(); // router bu geçişi görmez: konum, ekran ve taslak değişmez
      if (window.confirm(LEAVE_MESSAGE)) {
        leaveOk.current = true;
        pass.v = true;
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
        return;
      }
      const idxNow = readIdx();
      const d = idxNow !== null && lastIdx.current !== null ? lastIdx.current - idxNow : 0;
      if (d !== 0) { revert.v = true; window.history.go(d); }
    };
    window.addEventListener('popstate', onPop, true);
    return () => window.removeEventListener('popstate', onPop, true);
  }, []);

  return <>{children}</>;
}

export function LeaveGuard({ hasWork, discard, children }: GuardProps) {
  const data = useContext(UNSAFE_DataRouterContext);
  if (data) return <><DataGuard hasWork={hasWork} discard={discard} />{children}</>;
  return <DeclarativeGuard hasWork={hasWork} discard={discard}>{children}</DeclarativeGuard>;
}
