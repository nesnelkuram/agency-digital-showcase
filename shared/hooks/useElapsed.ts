/**
 * useElapsed — verilen başlangıç anından beri geçen süreyi her saniye günceller.
 * `startedAt` Firestore Timestamp objesi veya Date veya millis number kabul eder.
 *
 * Dönüş: `{ seconds, mmss, mmssss }` — saniye + formatlanmış string'ler.
 */
import { useEffect, useState } from 'react';

type StartInput =
  | { toMillis: () => number }      // Firestore Timestamp
  | Date
  | number
  | null
  | undefined;

function toMillis(input: StartInput): number | null {
  if (!input) return null;
  if (typeof input === 'number') return input;
  if (input instanceof Date) return input.getTime();
  if (typeof (input as any).toMillis === 'function') return (input as any).toMillis();
  return null;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function format(seconds: number): { mmss: string; hhmmss: string } {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return {
    mmss: `${pad(mm)}:${pad(ss)}`,
    hhmmss: `${pad(hh)}:${pad(mm)}:${pad(ss)}`,
  };
}

export interface ElapsedResult {
  seconds: number;
  mmss: string;
  hhmmss: string;
  running: boolean;
}

/**
 * @param startedAt   Aktif segment'in başlangıcı (resume noktası)
 * @param running     Şu an çalışıyor mu (in_progress)
 * @param accumulated Önceki segmentlerden biriken saniye (paused/resume akışı)
 */
export function useElapsed(
  startedAt: StartInput,
  running: boolean,
  accumulated: number = 0
): ElapsedResult {
  const startMs = toMillis(startedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running || !startMs) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running, startMs]);

  // Live segment + previous accumulated
  const liveSegment =
    running && startMs ? Math.max(0, Math.floor((now - startMs) / 1000)) : 0;
  const seconds = Math.max(0, accumulated + liveSegment);
  const { mmss, hhmmss } = format(seconds);

  return { seconds, mmss, hhmmss, running: Boolean(running && startMs) };
}
