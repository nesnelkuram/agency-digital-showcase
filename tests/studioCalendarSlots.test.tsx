import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import CalendarBoard, { DND_LIBRARY_ASSET, DND_POST } from '@/studio/components/CalendarBoard';

// Perşembe 2026-10-08 09:15 İstanbul (06:15Z) — hafta: 5–11 Ekim
const NOW = new Date('2026-10-08T06:15:00Z');
const tsAt = (iso: string) => Timestamp.fromDate(new Date(iso));
const post = (id: string, iso: string, status = 'draft') =>
  ({ id, projectId: 'p', status, postType: 'static', platforms: ['instagram'], caption: `metin ${id}`, scheduledAt: tsAt(iso), tags: [] }) as any;
const dt = (data: Record<string, string>) => ({ getData: (t: string) => data[t] || '', setData: () => {}, effectAllowed: 'all' });

beforeEach(() => {
  try {
    localStorage.setItem('studio.calendarMode', 'week');
  } catch {
    // yok say
  }
});

describe('Studio haftalık gün+saat ızgarası', () => {
  it('saat hücresine tıklama o gün/saatle oluşturur (marka saat diliminde)', () => {
    const onCreate = vi.fn();
    render(<CalendarBoard posts={[]} onPostClick={() => {}} onCreate={onCreate} onReschedule={() => {}} timeZone="Europe/Istanbul" now={NOW} />);
    fireEvent.click(screen.getByTestId('slot-2026-10-09-14'));
    expect(onCreate).toHaveBeenCalledWith(new Date('2026-10-09T11:00:00Z'));
  });

  it('içerik kendi gün/saat hücresinde görünür; saat dilimi etiketi gösterilir', () => {
    render(
      <CalendarBoard posts={[post('a', '2026-10-09T11:30:00Z')]} onPostClick={() => {}} onCreate={() => {}} onReschedule={() => {}} timeZone="Europe/Istanbul" timeZoneIsDefault now={NOW} />
    );
    expect(screen.getByTestId('slot-2026-10-09-14').textContent).toContain('14:30');
    expect(screen.getByTestId('calendar-timezone').textContent).toMatch(/Europe\/Istanbul.*varsayılan/);
  });

  it('geçmiş saat hücresi tıklanamaz', () => {
    const onCreate = vi.fn();
    render(<CalendarBoard posts={[]} onPostClick={() => {}} onCreate={onCreate} onReschedule={() => {}} timeZone="Europe/Istanbul" now={NOW} />);
    fireEvent.click(screen.getByTestId('slot-2026-10-08-08'));
    fireEvent.click(screen.getByTestId('slot-2026-10-06-12'));
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('slot-2026-10-08-09')); // 09:00–10:00 sürüyor → kullanılabilir
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('kütüphane dosyası hücreye bırakılınca o saatle ve dosya kimliğiyle oluşturur', () => {
    const onCreate = vi.fn();
    render(<CalendarBoard posts={[]} onPostClick={() => {}} onCreate={onCreate} onReschedule={() => {}} timeZone="Europe/Istanbul" now={NOW} />);
    fireEvent.drop(screen.getByTestId('slot-2026-10-10-18'), { dataTransfer: dt({ [DND_LIBRARY_ASSET]: 'asset1' }) });
    expect(onCreate).toHaveBeenCalledWith(new Date('2026-10-10T15:00:00Z'), 'asset1');
  });

  it('içerik başka gün/saate taşınır (dakika korunur); geçmişe taşınmaz', () => {
    const onReschedule = vi.fn();
    const p = post('a', '2026-10-09T11:30:00Z', 'approved');
    render(<CalendarBoard posts={[p]} onPostClick={() => {}} onCreate={() => {}} onReschedule={onReschedule} timeZone="Europe/Istanbul" now={NOW} />);
    fireEvent.drop(screen.getByTestId('slot-2026-10-10-09'), { dataTransfer: dt({ [DND_POST]: 'a' }) });
    expect(onReschedule).toHaveBeenCalledWith(p, new Date('2026-10-10T06:30:00Z'));
    fireEvent.drop(screen.getByTestId('slot-2026-10-06-09'), { dataTransfer: dt({ [DND_POST]: 'a' }) });
    expect(onReschedule).toHaveBeenCalledTimes(1);
  });

  it('başka saat dilimi: aynı içerik farklı hücrede', () => {
    render(<CalendarBoard posts={[post('a', '2026-10-09T11:30:00Z')]} onPostClick={() => {}} onCreate={() => {}} onReschedule={() => {}} timeZone="Europe/London" now={NOW} />);
    expect(screen.getByTestId('slot-2026-10-09-12').textContent).toContain('12:30');
  });

  it('yaz saati geçişinde var olmayan saat hücresi kapalı (America/New_York 2027-03-14 02:00)', () => {
    const onCreate = vi.fn();
    const now = new Date('2027-03-10T12:00:00Z');
    render(<CalendarBoard posts={[]} onPostClick={() => {}} onCreate={onCreate} onReschedule={() => {}} timeZone="America/New_York" now={now} />);
    const missing = screen.getByTestId('slot-2027-03-14-02');
    expect(missing.getAttribute('data-missing')).toBe('true');
    fireEvent.click(missing);
    fireEvent.drop(missing, { dataTransfer: dt({ [DND_LIBRARY_ASSET]: 'asset1' }) });
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('slot-2027-03-14-03'));
    expect(onCreate).toHaveBeenCalledWith(new Date('2027-03-14T07:00:00Z'));
  });
});
