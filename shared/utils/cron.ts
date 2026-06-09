/**
 * cron — minimal 5-alanlı cron ifadesi yardımcıları.
 * Hem client (sıradaki tarih önizleme + insan-okunur açıklama) hem de
 * server cron endpoint'i (spawn-recurring-tasks) tarafından kullanılır.
 *
 * Alanlar:  minute hour day-of-month month day-of-week
 * Desteklenen sözdizimi her alan için: *  5  1-5  1,3,5  *​/2  10-20/2
 */

export interface CronPreset {
  label: string;        // kısa Türkçe etiket
  expression: string;   // 5-alanlı cron
}

// Saat 09:00 varsayılanlı yaygın periyotlar
export const CRON_PRESETS: CronPreset[] = [
  { label: 'Her gün 09:00', expression: '0 9 * * *' },
  { label: 'Hafta içi (Pzt–Cum) 09:00', expression: '0 9 * * 1-5' },
  { label: 'Her Pazartesi 09:00', expression: '0 9 * * 1' },
  { label: 'Her Cuma 17:00', expression: '0 17 * * 5' },
  { label: "Ayın 1'i 09:00", expression: '0 9 1 * *' },
  { label: 'Her saat başı', expression: '0 * * * *' },
];

const WEEKDAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Tek bir cron alan-parçasını (a, a-b, *​/n, a-b/n) değerle eşleştirir
function matchPart(value: number, part: string): boolean {
  let range = part;
  let step = 1;
  const slash = part.split('/');
  if (slash.length === 2) {
    range = slash[0];
    step = parseInt(slash[1], 10) || 1;
  }

  let lo: number;
  let hi: number;
  let isStar = false;
  if (range === '*') {
    isStar = true;
    lo = -Infinity;
    hi = Infinity;
  } else if (range.includes('-')) {
    const [a, b] = range.split('-').map((x) => parseInt(x, 10));
    if (isNaN(a) || isNaN(b)) return false;
    lo = a;
    hi = b;
  } else {
    const n = parseInt(range, 10);
    if (isNaN(n)) return false;
    lo = hi = n;
  }

  if (value < lo || value > hi) return false;
  if (step === 1) return true;
  const base = isStar ? 0 : lo;
  return (value - base) % step === 0;
}

// Virgülle ayrılmış liste dahil tüm alanı eşleştirir
function fieldMatches(value: number, expr: string): boolean {
  if (expr === '*') return true;
  return expr.split(',').some((part) => matchPart(value, part));
}

/** 5 alanlı geçerli bir cron mu? (kaba doğrulama) */
export function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  // Her alanda en az bir geçerli token bulunmalı
  const tokenRe = /^(\*|\d+|\d+-\d+)(\/\d+)?(,(\*|\d+|\d+-\d+)(\/\d+)?)*$/;
  return parts.every((p) => tokenRe.test(p));
}

/**
 * `from` anından SONRAKİ ilk eşleşmeyi döndürür.
 * Yerel saat alanları `timezone` üzerinden karşılaştırılır.
 * 45 gün içinde eşleşme bulamazsa null döner (günlük/haftalık/aylık için yeterli).
 */
export function getNextRunDate(
  cronExpr: string,
  timezone: string,
  from: Date = new Date()
): Date | null {
  if (!isValidCron(cronExpr)) return null;
  const [minP, hourP, domP, monP, dowP] = cronExpr.trim().split(/\s+/);

  const candidate = new Date(from.getTime() + 60_000); // 1 dk sonra başla
  candidate.setSeconds(0, 0);

  // 70 gün: aylık "31. gün" gibi seçimlerde Şubat→Mart aralığını da kapsar
  const maxIterations = 70 * 24 * 60;
  for (let i = 0; i < maxIterations; i++) {
    // Adayı hedef saat dilimine çevirip alan değerlerini oku
    const localStr = candidate.toLocaleString('en-US', { timeZone: timezone });
    const local = new Date(localStr);

    if (
      fieldMatches(local.getMinutes(), minP) &&
      fieldMatches(local.getHours(), hourP) &&
      fieldMatches(local.getDate(), domP) &&
      fieldMatches(local.getMonth() + 1, monP) &&
      fieldMatches(local.getDay(), dowP)
    ) {
      return candidate;
    }
    candidate.setTime(candidate.getTime() + 60_000);
  }
  return null;
}

/** Cron'u Türkçe insan-okunur metne çevirir. */
export function describeCron(expr: string): string {
  if (!isValidCron(expr)) return expr;
  const [minP, hourP, domP, monP, dowP] = expr.trim().split(/\s+/);

  const minNum = parseInt(minP, 10);
  const hourNum = parseInt(hourP, 10);
  const timeStr =
    !isNaN(minNum) && !isNaN(hourNum) ? `${pad(hourNum)}:${pad(minNum)}` : null;

  // Her saat başı: dakika sabit, saat *
  if (!isNaN(minNum) && hourP === '*' && domP === '*' && monP === '*' && dowP === '*') {
    return minNum === 0 ? 'Her saat başı' : `Her saat :${pad(minNum)}`;
  }

  if (timeStr && domP === '*' && monP === '*') {
    // Gün-bazlı
    if (dowP === '*') return `Her gün ${timeStr}`;
    if (dowP === '1-5') return `Hafta içi her gün ${timeStr}`;
    if (dowP === '0,6' || dowP === '6,0') return `Hafta sonu ${timeStr}`;
    // Çoklu gün listesi (ör. 1,3,5) — tek-gün kontrolünden ÖNCE
    if (dowP.includes(',') && /^(\d)(,\d)*$/.test(dowP)) {
      const SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const names = dowP
        .split(',')
        .map((d) => SHORT[parseInt(d, 10)])
        .filter(Boolean);
      if (names.length) return `Her ${names.join(', ')} ${timeStr}`;
    }
    const dow = parseInt(dowP, 10);
    if (!dowP.includes(',') && !isNaN(dow) && WEEKDAY_NAMES[dow]) return `Her ${WEEKDAY_NAMES[dow]} ${timeStr}`;
  }

  if (timeStr && dowP === '*' && monP === '*') {
    const dom = parseInt(domP, 10);
    if (!isNaN(dom)) return `Her ayın ${dom}. günü ${timeStr}`;
  }

  // Fallback — ham ifade
  return expr;
}

/** Sıradaki çalışmayı "30 May Cum 09:00" gibi kısa Türkçe gösterir. */
export function formatNextRun(date: Date | null): string {
  if (!date) return '—';
  const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${DAYS[date.getDay()]} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
