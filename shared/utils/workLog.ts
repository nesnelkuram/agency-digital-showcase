/**
 * workLog — WorkSession'ları gün-gün toplar ve süre formatlar.
 * "Hangi gün ne kadar çalışıldı" dökümü için kullanılır.
 */
import type { WorkSession } from '@/shared/types/task';

export interface DayTotal {
  key: string;       // YYYY-MM-DD (yerel)
  label: string;     // "Bugün" / "Dün" / "27 May Sal"
  seconds: number;
  hasAuto: boolean;  // o gün en az bir otomatik (idle) duraklatma oldu mu
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Saniyeyi "1s 23dk" / "23dk" / "0:45" gibi okunur metne çevirir. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}s ${pad(m)}dk`;
  if (m > 0) return `${m}dk`;
  return `${sec}sn`;
}

/** Saniyeyi tam saat:dakika:saniye olarak biçimlendirir. */
export function formatHMS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Segmentleri yerel güne göre toplar (segment başlangıç gününe yazılır).
 * `liveSeconds` > 0 ise, halen çalışılan canlı segment bugüne eklenir.
 */
export function aggregateByDay(
  sessions: WorkSession[] = [],
  liveSeconds = 0
): DayTotal[] {
  const map = new Map<string, { seconds: number; hasAuto: boolean }>();

  for (const s of sessions) {
    const k = dayKey(s.startedAt);
    const prev = map.get(k) ?? { seconds: 0, hasAuto: false };
    map.set(k, { seconds: prev.seconds + s.seconds, hasAuto: prev.hasAuto || !!s.auto });
  }

  const now = new Date();
  const todayKey = dayKeyOf(now);
  if (liveSeconds > 0) {
    const prev = map.get(todayKey) ?? { seconds: 0, hasAuto: false };
    map.set(todayKey, { seconds: prev.seconds + liveSeconds, hasAuto: prev.hasAuto });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = dayKeyOf(yesterday);

  const WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  const labelFor = (key: string): string => {
    if (key === todayKey) return 'Bugün';
    if (key === yesterdayKey) return 'Dün';
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${d} ${MONTHS[m - 1]} ${WEEKDAYS[dt.getDay()]}`;
  };

  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // en yeni gün üstte
    .map(([key, v]) => ({
      key,
      label: labelFor(key),
      seconds: v.seconds,
      hasAuto: v.hasAuto,
    }));
}
