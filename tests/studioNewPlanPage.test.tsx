import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';

const ctx: { current: any } = { current: null };
vi.mock('@/studio/StudioLayout', () => ({ useStudio: () => ctx.current }));
vi.mock('@/lib/firebase/config', () => ({ db: {}, storage: null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1', displayName: 'Şeyma' } }) }));
const createContentPlan = vi.fn(async (..._a: any[]) => 'plan-new');
vi.mock('@/shared/services/contentPlanService', () => ({ createContentPlan: (...a: any[]) => createContentPlan(...a) }));
const posts: { current: any[] } = { current: [] };
vi.mock('@/studio/studioData', async (orig) => ({ ...(await orig<any>()), getProjectPosts: async () => posts.current }));

import StudioNewPlanPage, { defaultPlanWeekInput, normalizePlanWeekInput, planWeekRange } from '@/studio/pages/StudioNewPlanPage';

const at = (iso: string) => Timestamp.fromDate(new Date(iso));
const post = (id: string, iso: string) =>
  ({ id, projectId: 'projA', status: 'draft', postType: 'static', platforms: ['instagram'], caption: `metin ${id}`, scheduledAt: at(iso), tags: [] }) as any;

const view = () =>
  render(
    <MemoryRouter>
      <StudioNewPlanPage />
    </MemoryRouter>
  );

describe('StudioNewPlanPage — hafta aralığı marka saat diliminde', () => {
  const origTZ = process.env.TZ;
  beforeEach(() => {
    ctx.current = { project: { id: 'projA', name: 'Rakle' }, tenantId: 't1', timeZone: 'Europe/Istanbul', timeZoneIsDefault: false, projects: [] };
    createContentPlan.mockClear();
    vi.useFakeTimers({ toFake: ['Date'] });
    // Pazar 2026-10-11 22:30 İstanbul (19:30Z) — İstanbul'da bir sonraki hafta 12 Ekim Pazartesi
    vi.setSystemTime(new Date('2026-10-11T19:30:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = origTZ;
  });

  it('yardımcılar: varsayılan gelecek hafta, Pazartesi normalizasyonu, aralık', () => {
    expect(defaultPlanWeekInput(new Date('2026-10-11T19:30:00Z'), 'Europe/Istanbul')).toBe('2026-10-12');
    // Aynı an Los Angeles'ta hâlâ Pazar 12:30 → gelecek hafta yine 12 Ekim; Tokyo'da Pazartesi 04:30 → 19 Ekim
    expect(defaultPlanWeekInput(new Date('2026-10-11T19:30:00Z'), 'America/Los_Angeles')).toBe('2026-10-12');
    expect(defaultPlanWeekInput(new Date('2026-10-11T19:30:00Z'), 'Asia/Tokyo')).toBe('2026-10-19');
    expect(normalizePlanWeekInput('2026-10-15')).toBe('2026-10-12');
    expect(normalizePlanWeekInput('geçersiz')).toBeNull();
    const r = planWeekRange('2026-10-12', 'Europe/Istanbul');
    expect([r.start.toISOString(), r.end.toISOString()]).toEqual(['2026-10-11T21:00:00.000Z', '2026-10-18T20:59:59.999Z']);
  });

  it('hafta sınırındaki taslaklar marka saat dilimine göre seçilir; plan aynı aralıkla oluşturulur', async () => {
    process.env.TZ = 'America/Los_Angeles'; // tarayıcı saat dilimi farklı olsa da sonuç değişmemeli
    posts.current = [
      post('mon0', '2026-10-11T21:00:00Z'), // Pzt 12 Eki 00:00 İstanbul → içeride
      post('sun', '2026-10-18T20:30:00Z'), // Paz 18 Eki 23:30 İstanbul → içeride
      post('next', '2026-10-18T21:30:00Z'), // Pzt 19 Eki 00:30 İstanbul → dışarıda
      post('prev', '2026-10-11T20:30:00Z'), // Paz 11 Eki 23:30 İstanbul → dışarıda
    ];
    view();
    await waitFor(() => expect(screen.getByText('Planı oluştur (2)')).toBeTruthy());
    expect(screen.getByTestId('plan-week-range').textContent).toMatch(/12 Ekim – 18 Ekim/);
    expect(screen.getByTestId('plan-week-range').textContent).toMatch(/Europe\/Istanbul/);
    fireEvent.click(screen.getByText('Planı oluştur (2)'));
    await waitFor(() => expect(createContentPlan).toHaveBeenCalled());
    const data = createContentPlan.mock.calls[0][1];
    expect(data.postIds.sort()).toEqual(['mon0', 'sun']);
    expect(data.weekStartDate.toDate().toISOString()).toBe('2026-10-11T21:00:00.000Z');
    expect(data.weekEndDate.toDate().toISOString()).toBe('2026-10-18T20:59:59.999Z');
    expect(data.title).toBe('Rakle — 12 Eki / 18 Eki');
  });

  it('başka bir gün seçilince o haftanın Pazartesi\'sine normalize edilir', async () => {
    posts.current = [];
    view();
    const input = (await screen.findByDisplayValue('2026-10-12')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-10-22' } });
    expect(input.value).toBe('2026-10-19');
    expect(screen.getByTestId('plan-week-range').textContent).toMatch(/19 Ekim – 25 Ekim/);
  });
});
