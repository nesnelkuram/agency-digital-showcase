import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STUDIO_TIME_ZONE,
  addCivilDays,
  fromInputs,
  parseDateInput,
  resolveStudioTimeZone,
  startOfCivilWeek,
  startOfZonedDay,
  zonedWeekRange,
  toDateInput,
  toTimeInput,
  zonedParts,
  zonedToUtc,
} from '@/shared/time/zonedTime';

describe('saat dilimi dönüşümleri', () => {
  it('İstanbul (UTC+3, yaz saati yok): duvar saati ↔ UTC', () => {
    const d = zonedToUtc({ year: 2026, month: 10, day: 12 }, 14, 30, 'Europe/Istanbul')!;
    expect(d.toISOString()).toBe('2026-10-12T11:30:00.000Z');
    expect(zonedParts(d, 'Europe/Istanbul')).toMatchObject({ year: 2026, month: 10, day: 12, hour: 14, minute: 30 });
    expect(toDateInput(d, 'Europe/Istanbul')).toBe('2026-10-12');
    expect(toTimeInput(d, 'Europe/Istanbul')).toBe('14:30');
  });

  it('tarayıcı saat diliminden bağımsız: aynı an farklı dilimlerde farklı duvar saati', () => {
    const d = fromInputs('2026-10-12', '09:00', 'Europe/London')!;
    expect(d.toISOString()).toBe('2026-10-12T08:00:00.000Z');
    expect(toTimeInput(d, 'Europe/Istanbul')).toBe('11:00');
  });

  it('yaz saatine geçiş: var olmayan saat null (America/New_York 2027-03-14 02:00 ve 02:30)', () => {
    expect(zonedToUtc({ year: 2027, month: 3, day: 14 }, 2, 0, 'America/New_York')).toBeNull();
    expect(zonedToUtc({ year: 2027, month: 3, day: 14 }, 2, 30, 'America/New_York')).toBeNull();
    expect(fromInputs('2027-03-14', '02:30', 'America/New_York')).toBeNull();
    expect(zonedToUtc({ year: 2027, month: 3, day: 14 }, 3, 0, 'America/New_York')!.toISOString()).toBe('2027-03-14T07:00:00.000Z');
    expect(zonedToUtc({ year: 2027, month: 3, day: 14 }, 1, 59, 'America/New_York')!.toISOString()).toBe('2027-03-14T06:59:00.000Z');
  });

  it('kış saatine geçiş: iki kez yaşanan 01:30 deterministik olarak İLK an (EDT, UTC-4)', () => {
    const d = zonedToUtc({ year: 2027, month: 11, day: 7 }, 1, 30, 'America/New_York')!;
    expect(d.toISOString()).toBe('2027-11-07T05:30:00.000Z');
    // ikinci 01:30 (EST) da aynı duvar saatini gösterir; dönüşüm onu seçmez
    expect(zonedParts(new Date('2027-11-07T06:30:00Z'), 'America/New_York')).toMatchObject({ hour: 1, minute: 30 });
    expect(zonedToUtc({ year: 2027, month: 11, day: 7 }, 2, 0, 'America/New_York')!.toISOString()).toBe('2027-11-07T07:00:00.000Z');
  });

  it('geçersiz tarih/saat ve biçim reddedilir', () => {
    expect(fromInputs('2027-02-31', '10:00', 'Europe/Istanbul')).toBeNull();
    expect(fromInputs('2027-13-01', '10:00', 'Europe/Istanbul')).toBeNull();
    expect(fromInputs('2027-01-01', '24:00', 'Europe/Istanbul')).toBeNull();
    expect(fromInputs('2027-01-01', '10:60', 'Europe/Istanbul')).toBeNull();
    expect(fromInputs('2027-01-01', '9:00', 'Europe/Istanbul')).toBeNull();
    expect(fromInputs('', '10:00', 'Europe/Istanbul')).toBeNull();
  });

  it('marka saat dilimi: tenant ayarı geçerliyse o, değilse açık varsayılan', () => {
    expect(resolveStudioTimeZone('Europe/London')).toEqual({ timeZone: 'Europe/London', isDefault: false });
    expect(resolveStudioTimeZone(undefined)).toEqual({ timeZone: DEFAULT_STUDIO_TIME_ZONE, isDefault: true });
    expect(resolveStudioTimeZone('Mars/Olympus')).toEqual({ timeZone: DEFAULT_STUDIO_TIME_ZONE, isDefault: true });
  });

  it('takvim günü aritmetiği: ay geçişi ve Pazartesi başlangıçlı hafta', () => {
    expect(addCivilDays({ year: 2026, month: 10, day: 30 }, 3)).toEqual({ year: 2026, month: 11, day: 2 });
    expect(startOfCivilWeek({ year: 2026, month: 10, day: 11 })).toEqual({ year: 2026, month: 10, day: 5 });
  });

  it('hafta aralığı marka saat diliminde: Pazartesi 00:00 – Pazar 23:59:59.999', () => {
    const r = zonedWeekRange({ year: 2026, month: 10, day: 14 }, 'Europe/Istanbul');
    expect(r.monday).toEqual({ year: 2026, month: 10, day: 12 });
    expect(r.start.toISOString()).toBe('2026-10-11T21:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-10-18T20:59:59.999Z');
  });

  it('hafta içinde yaz saati geçişi: başlangıç EST, bitiş EDT ofsetiyle (America/New_York)', () => {
    const r = zonedWeekRange({ year: 2027, month: 3, day: 10 }, 'America/New_York');
    expect(r.start.toISOString()).toBe('2027-03-08T05:00:00.000Z');
    expect(r.end.toISOString()).toBe('2027-03-15T03:59:59.999Z');
  });

  it('gece yarısı yaşanmayan gün: günün ilk var olan anı (America/Santiago 2026-09-06 → 01:00)', () => {
    expect(zonedToUtc({ year: 2026, month: 9, day: 6 }, 0, 0, 'America/Santiago')).toBeNull();
    const d = startOfZonedDay({ year: 2026, month: 9, day: 6 }, 'America/Santiago');
    expect(zonedParts(d, 'America/Santiago')).toMatchObject({ year: 2026, month: 9, day: 6, hour: 1, minute: 0 });
    // Bu Pazar'ı içeren haftanın sonu, ertesi Pazartesi'nin ilk anından 1 ms önce
    const r = zonedWeekRange({ year: 2026, month: 9, day: 6 }, 'America/Santiago');
    expect(zonedParts(r.end, 'America/Santiago')).toMatchObject({ month: 9, day: 6, hour: 23, minute: 59 });
  });

  it('tarih girdisi ayrıştırma geçersiz günü reddeder', () => {
    expect(parseDateInput('2026-10-12')).toEqual({ year: 2026, month: 10, day: 12 });
    expect(parseDateInput('2026-02-30')).toBeNull();
    expect(parseDateInput('12.10.2026')).toBeNull();
  });
});
