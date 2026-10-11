import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const st = vi.hoisted(() => ({ getBlob: vi.fn(), ref: vi.fn() }));
vi.mock('firebase/storage', () => ({ getBlob: (...a: any[]) => st.getBlob(...a), ref: (...a: any[]) => st.ref(...a), getDownloadURL: vi.fn() }));
vi.mock('@/lib/firebase/config', () => ({ storage: { app: 'test' }, db: {} }));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn() }));

import CalendarBoard, { suggestedDayParts } from '@/studio/components/CalendarBoard';

const draft = (id: string, dayOrder: number, extra: any = {}) =>
  ({ id, projectId: 'p', status: 'draft', postType: 'story', platforms: ['instagram'], title: `taslak ${id}`, caption: '', tags: [], importRef: { planKey: 'dieci-2026-10-12', dayOrder, frame: 1 }, ...extra }) as any;
const NOW = new Date('2026-10-10T12:00:00Z');
const noop = () => {};

describe('Takvim: saatsiz taslaklar (gün önerisi)', () => {
  beforeEach(() => { try { localStorage.setItem('studio.calendarMode', 'week'); } catch { /* yok say */ } });

  it('suggestedDayParts: plan haftası + gün sırasından günü çıkarır; saat üretmez; geçersizde null', () => {
    expect(suggestedDayParts(draft('a', 1))).toEqual({ year: 2026, month: 10, day: 12 });
    expect(suggestedDayParts(draft('a', 7))).toEqual({ year: 2026, month: 10, day: 18 });
    expect(suggestedDayParts(draft('a', 3))).toEqual({ year: 2026, month: 10, day: 14 });
    expect(suggestedDayParts({ id: 'x' } as any)).toBeNull();
    expect(suggestedDayParts(draft('a', 0))).toBeNull();
    expect(suggestedDayParts(draft('a', 8))).toBeNull();
    expect(suggestedDayParts(draft('a', 1, { importRef: { planKey: 'bozuk', dayOrder: 1 } }))).toBeNull();
  });

  it('hafta görünümü: ilgili haftada "Saatsiz" satırında doğru günde görünür; saat gösterilmez', () => {
    const onPostClick = vi.fn();
    render(<CalendarBoard posts={[draft('mon', 1), draft('wed', 3)]} onPostClick={onPostClick} onCreate={noop} onReschedule={noop} now={NOW} timeZone="Europe/Istanbul" />);
    // Bugün 10 Ekim (Cmt): bu haftada (5–11 Ekim) taslak yok
    expect(screen.queryByTestId('calendar-undated-row')).toBeNull();
    fireEvent.click(screen.getByLabelText('Sonraki'));
    expect(screen.getByTestId('calendar-undated-row')).toBeTruthy();
    expect(screen.getByText('Saatsiz')).toBeTruthy();
    expect(screen.getByTestId('undated-2026-10-12').textContent).toContain('taslak mon');
    expect(screen.getByTestId('undated-2026-10-14').textContent).toContain('taslak wed');
    expect(screen.getByTestId('undated-2026-10-13').textContent).toBe('');
    fireEvent.click(screen.getByText('taslak mon'));
    expect(onPostClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/\d{2}:\d{2}.*taslak mon/)).toBeNull();
  });

  it('ay görünümü: günün hücresinde görünür', () => {
    render(<CalendarBoard posts={[draft('mon', 1)]} onPostClick={noop} onCreate={noop} onReschedule={noop} now={NOW} timeZone="Europe/Istanbul" />);
    fireEvent.click(screen.getByText('Ay'));
    expect(screen.getByText('taslak mon')).toBeTruthy();
  });

  it('öneri günü olmayan tarihsiz post takvimde gösterilmez (davranış değişmedi)', () => {
    render(<CalendarBoard posts={[{ ...draft('x', 1), importRef: undefined }]} onPostClick={noop} onCreate={noop} onReschedule={noop} now={NOW} timeZone="Europe/Istanbul" />);
    fireEvent.click(screen.getByLabelText('Sonraki'));
    expect(screen.queryByText('taslak x')).toBeNull();
    expect(screen.queryByTestId('calendar-undated-row')).toBeNull();
  });

  it('önizleme: taslak postun fotoğrafı yetkili Storage okumasıyla (getBlob) takvim kartında görünür; token yok', async () => {
    st.getBlob.mockReset().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    st.ref.mockReset().mockImplementation((_s: any, p: string) => ({ path: p }));
    (globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:cal-1');
    (globalThis as any).URL.revokeObjectURL = vi.fn();
    const withMedia = draft('mon', 1, { media: [{ id: 'A', url: '', type: 'image', mimeType: 'image/jpeg', size: 1, order: 0, storagePath: 'social-media-drafts/t1/p/dieci-2026-10-12/A.jpg', previewStoragePath: 'social-media-drafts/t1/p/dieci-2026-10-12/A.web.jpg' }] });
    render(<CalendarBoard posts={[withMedia]} onPostClick={noop} onCreate={noop} onReschedule={noop} now={NOW} timeZone="Europe/Istanbul" />);
    fireEvent.click(screen.getByLabelText('Sonraki'));
    const cell = screen.getByTestId('undated-2026-10-12');
    await waitFor(() => expect(cell.querySelector('img')?.getAttribute('src')).toBe('blob:cal-1'));
    expect(st.ref.mock.calls[0][1]).toBe('social-media-drafts/t1/p/dieci-2026-10-12/A.web.jpg');
  });
});
