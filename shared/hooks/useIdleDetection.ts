/**
 * useIdleDetection — kullanıcının bilgisayardan uzaklaştığını tahmin eder.
 *
 * Tarayıcı "masadan kalktın" diye birebir bilemez; iki sinyalle tahmin ederiz:
 *   1. Hareketsizlik: `idleMs` boyunca fare/klavye/scroll/dokunma yoksa → idle
 *   2. Sekme/pencere arka plana geçti (visibilitychange hidden) → anında idle
 *
 * `onIdle(lastActivityMs)` idle'a GİRİŞTE bir kez çağrılır; `lastActivityMs`
 * son gerçek aktivite anıdır (sayaç bu ana kadar sayılmalı, boşluk sayılmaz).
 * `onActive()` kullanıcı geri döndüğünde (idle→aktif) bir kez çağrılır.
 *
 * enabled false→true veya `resetKey` değişince zamanlayıcı sıfırlanır.
 */
import { useEffect, useRef } from 'react';

interface IdleOptions {
  idleMs: number;
  enabled: boolean;
  resetKey?: string | number | null;   // değişince izlemeyi baştan başlat (ör. aktif görev id)
  onIdle: (lastActivityMs: number) => void;
  onActive: () => void;
}

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;
const CHECK_INTERVAL_MS = 15_000;

export function useIdleDetection({ idleMs, enabled, resetKey, onIdle, onActive }: IdleOptions): void {
  // Callback'leri ref'te tut — her render'da en taze closure kullanılsın,
  // effect bağımlılıkları sadece [enabled, idleMs, resetKey] kalsın.
  const onIdleRef = useRef(onIdle);
  const onActiveRef = useRef(onActive);
  onIdleRef.current = onIdle;
  onActiveRef.current = onActive;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let lastActivity = Date.now();
    let isIdle = false;

    const markActive = () => {
      lastActivity = Date.now();
      if (isIdle) {
        isIdle = false;
        onActiveRef.current();
      }
    };

    const goIdle = (atMs: number) => {
      if (!isIdle) {
        isIdle = true;
        onIdleRef.current(atMs);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Sekme/pencere arka plana geçti → son aktivite anına kadar say, hemen idle
        goIdle(lastActivity);
      } else {
        markActive();
      }
    };

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, markActive, { passive: true })
    );
    document.addEventListener('visibilitychange', onVisibility);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return; // zaten idle sayıldı
      if (Date.now() - lastActivity >= idleMs) {
        goIdle(lastActivity);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [enabled, idleMs, resetKey]);
}
