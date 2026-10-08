/**
 * Saat dilimine bağlı takvim hesapları (tarayıcının yerel saatinden bağımsız).
 * Studio takvimi markanın saat dilimini kullanır: tenant ayarı (settings.timezone) yoksa
 * DEFAULT_STUDIO_TIME_ZONE açıkça "varsayılan" olarak gösterilir.
 */

export const DEFAULT_STUDIO_TIME_ZONE = 'Europe/Istanbul';

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveStudioTimeZone(tenantTz: unknown): { timeZone: string; isDefault: boolean } {
  return isValidTimeZone(tenantTz) ? { timeZone: tenantTz, isDefault: false } : { timeZone: DEFAULT_STUDIO_TIME_ZONE, isDefault: true };
}

/** Takvim günü (saat diliminden bağımsız sivil tarih); month 1–12 */
export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface ZonedParts extends CivilDate {
  hour: number;
  minute: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function zonedParts(date: Date, tz: string): ZonedParts {
  const parts: Record<string, number> = {};
  for (const p of fmt(tz).formatToParts(date)) if (p.type !== 'literal') parts[p.type] = Number(p.value);
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour % 24, minute: parts.minute };
}

/** Bir anda saat diliminin UTC'den farkı (ms) */
function offsetAt(ms: number, tz: string): number {
  const p = zonedParts(new Date(ms), tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60_000) * 60_000;
}

/**
 * Saat dilimindeki duvar saatini UTC anına çevirir. Round-trip doğrulamalı:
 * - Yaz saatine geçişte VAR OLMAYAN saat (ör. America/New_York 2027-03-14 02:30) → null (sessizce kaydırılmaz).
 * - Kış saatine geçişte İKİ KEZ yaşanan saat (ör. America/New_York 2027-11-07 01:30) → deterministik olarak
 *   İLK gerçekleşen an (geçişten önceki ofset) seçilir.
 * Geçersiz tarih/saat (ör. 31 Şubat, 24:00) → null.
 */
export function zonedToUtc(c: CivilDate, hour: number, minute: number, tz: string): Date | null {
  if (![c.year, c.month, c.day, hour, minute].every(Number.isInteger)) return null;
  if (c.month < 1 || c.month > 12 || c.day < 1 || c.day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const target = Date.UTC(c.year, c.month - 1, c.day, hour, minute);
  const check = new Date(target);
  if (check.getUTCFullYear() !== c.year || check.getUTCMonth() !== c.month - 1 || check.getUTCDate() !== c.day) return null;
  // Geçişin iki yanındaki ofsetler; her biri ile aday üretilir ve duvar saatine geri dönüşü doğrulanır
  const offsets = Array.from(new Set([offsetAt(target - 86_400_000, tz), offsetAt(target, tz), offsetAt(target + 86_400_000, tz)]));
  const matches = offsets
    .map((o) => target - o)
    .filter((ms) => {
      const p = zonedParts(new Date(ms), tz);
      return p.year === c.year && p.month === c.month && p.day === c.day && p.hour === hour && p.minute === minute;
    })
    .sort((a, b) => a - b);
  return matches.length > 0 ? new Date(matches[0]) : null;
}

export const civilOf = (date: Date, tz: string): CivilDate => {
  const p = zonedParts(date, tz);
  return { year: p.year, month: p.month, day: p.day };
};

export function addCivilDays(c: CivilDate, n: number): CivilDate {
  const d = new Date(Date.UTC(c.year, c.month - 1, c.day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = Pazartesi … 6 = Pazar */
export function civilWeekday(c: CivilDate): number {
  return (new Date(Date.UTC(c.year, c.month - 1, c.day)).getUTCDay() + 6) % 7;
}

export const startOfCivilWeek = (c: CivilDate): CivilDate => addCivilDays(c, -civilWeekday(c));
export const civilKey = (c: CivilDate) => `${c.year}-${c.month}-${c.day}`;
export const sameCivil = (a: CivilDate, b: CivilDate) => a.year === b.year && a.month === b.month && a.day === b.day;
export const compareCivil = (a: CivilDate, b: CivilDate) => Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day);

/** "YYYY-MM-DD" → takvim günü (geçersizse null) */
export function parseDateInput(value: string): CivilDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!m) return null;
  const c = { year: +m[1], month: +m[2], day: +m[3] };
  const d = new Date(Date.UTC(c.year, c.month - 1, c.day));
  return d.getUTCFullYear() === c.year && d.getUTCMonth() === c.month - 1 && d.getUTCDate() === c.day ? c : null;
}

export const civilToInput = (c: CivilDate) => `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;

/**
 * Günün saat dilimindeki ilk anı: normalde 00:00; yaz saati geçişi gece yarısındaysa
 * (ör. America/Santiago 2026-09-06, 00:00 yaşanmaz) günün ilk var olan dakikası.
 */
export function startOfZonedDay(c: CivilDate, tz: string): Date {
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const d = zonedToUtc(c, h, m, tz);
      if (d) return d;
    }
  }
  // Pratikte erişilmez: güvenli geri dönüş UTC gece yarısı
  return new Date(Date.UTC(c.year, c.month - 1, c.day));
}

/**
 * Pazartesi başlangıçlı hafta (marka saat diliminde): [Pazartesi ilk an, sonraki Pazartesi ilk an − 1 ms].
 * Haftaya düşme kararı tarayıcının yerel saatinden bağımsızdır.
 */
export function zonedWeekRange(anyDayOfWeek: CivilDate, tz: string): { monday: CivilDate; start: Date; end: Date } {
  const monday = startOfCivilWeek(anyDayOfWeek);
  const start = startOfZonedDay(monday, tz);
  const end = new Date(startOfZonedDay(addCivilDays(monday, 7), tz).getTime() - 1);
  return { monday, start, end };
}

/** <input type="date"> / <input type="time"> değerleri (saat diliminde) */
export function toDateInput(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
export function toTimeInput(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}
/** Tarih/saat girdisini saat diliminde yorumlar; geçersiz veya o saat dilimimde var olmayan zaman → null */
export function fromInputs(dateStr: string, timeStr: string, tz: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  const tm = /^(\d{2}):(\d{2})$/.exec(timeStr || '');
  if (!dm || !tm) return null;
  return zonedToUtc({ year: +dm[1], month: +dm[2], day: +dm[3] }, +tm[1], +tm[2], tz);
}

/** Kısa saat dilimi etiketi, ör. "Europe/Istanbul (GMT+3)" */
export function timeZoneLabel(tz: string, at: Date = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value;
    return name ? `${tz} (${name})` : tz;
  } catch {
    return tz;
  }
}
