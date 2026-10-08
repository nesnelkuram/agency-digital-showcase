import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';

const ctx: { current: any } = { current: null };
vi.mock('@/studio/StudioLayout', () => ({ useStudio: () => ctx.current }));
vi.mock('@/lib/firebase/config', () => ({ db: {}, storage: { app: { options: { storageBucket: 'b' } } } }));
const updateDoc = vi.fn(async (..._a: any[]) => {});
vi.mock('firebase/firestore', async (orig) => ({ ...(await orig<any>()), doc: vi.fn(() => ({})), updateDoc: (...a: any[]) => updateDoc(...a), serverTimestamp: () => 'ts' }));

const loaders: Record<string, { posts: (v: any[]) => void; plans: (v: any[]) => void }> = {};
vi.mock('@/studio/studioData', async (orig) => ({
  ...(await orig<any>()),
  getProjectPosts: (_t: string, p: string) => new Promise((r) => ((loaders[p] ||= {} as any).posts = r)),
  getProjectPlans: (_t: string, p: string) => new Promise((r) => ((loaders[p] ||= {} as any).plans = r)),
}));
const runApprovalAction = vi.fn(async (..._a: any[]) => ({ ok: true }));
vi.mock('@/shared/services/contentApprovalApi', () => ({ runApprovalAction: (...a: any[]) => runApprovalAction(...a) }));
const panelProps: any[] = [];
vi.mock('@/admin/social-media/components/CreatePostPanel', () => ({
  default: (p: any) => {
    panelProps.push(p);
    return null;
  },
}));
vi.mock('@/studio/components/StudioPostDetail', () => ({
  default: () => null,
  EDITABLE_STATUSES: new Set(['draft', 'internal_review', 'revision_requested_internal', 'revision_requested']),
}));
const drawerAssets: { current: any[] } = { current: [] };
vi.mock('@/studio/components/LibraryDrawer', () => ({
  default: ({ onAssets }: any) => {
    React.useEffect(() => onAssets(drawerAssets.current), []);
    return <div data-testid="drawer" />;
  },
}));

import StudioCalendarHome from '@/studio/pages/StudioCalendarHome';
import { DND_LIBRARY_ASSET, DND_POST } from '@/studio/components/CalendarBoard';

const url = (p: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(p)}?alt=media&token=t`;
const asset = (id: string, projectId: string) => ({
  id, tenantId: 't1', projectId, kind: 'photo', title: id, fileName: `${id}.jpg`, tags: [], status: 'active', createdBy: 'u',
  storage: { path: `brand-media/t1/${projectId}/${id}/${id}.jpg`, downloadUrl: url(`brand-media/t1/${projectId}/${id}/${id}.jpg`), contentType: 'image/jpeg', size: 10 },
});
const post = (id: string, projectId: string, status = 'draft', planId?: string) =>
  ({ id, projectId, status, postType: 'static', platforms: ['instagram'], caption: `metin ${id}`, contentPlanId: planId, scheduledAt: Timestamp.fromDate(new Date('2026-10-09T11:00:00Z')), tags: [] }) as any;
const dt = (data: Record<string, string>) => ({ getData: (t: string) => data[t] || '', setData: () => {} });
const setBrand = (projectId: string) => {
  ctx.current = { project: { id: projectId, name: projectId }, tenantId: 't1', timeZone: 'Europe/Istanbul', timeZoneIsDefault: false, projects: [] };
};
const view = () => (
  <MemoryRouter>
    <StudioCalendarHome />
  </MemoryRouter>
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T06:15:00Z'));
  try {
    localStorage.setItem('studio.calendarMode', 'week');
  } catch {
    // yok say
  }
  for (const k of Object.keys(loaders)) delete loaders[k];
  panelProps.length = 0;
  runApprovalAction.mockClear();
  updateDoc.mockClear();
  drawerAssets.current = [];
});
afterEach(() => vi.useRealTimers());

async function resolve(projectId: string, posts: any[], plans: any[] = []) {
  await waitFor(() => expect(loaders[projectId]?.posts && loaders[projectId]?.plans).toBeTruthy());
  await act(async () => {
    loaders[projectId].posts(posts);
    loaders[projectId].plans(plans);
  });
}

describe('StudioCalendarHome — marka izolasyonu', () => {
  it('eski markanın geç gelen yanıtı yeni markanın takvimine yazılmaz', async () => {
    setBrand('projA');
    const { rerender } = render(view());
    await waitFor(() => expect(loaders.projA?.posts).toBeTruthy());
    setBrand('projB');
    rerender(view());
    await resolve('projB', [post('b1', 'projB')]);
    await act(async () => {
      loaders.projA.posts([post('a1', 'projA')]);
      loaders.projA.plans([]);
    });
    expect(screen.queryAllByText('metin b1').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('metin a1')).toHaveLength(0);
  });

  it('onaylı içerik taşıma penceresi marka değişince kapanır; eski post taşınmaz', async () => {
    setBrand('projA');
    const { rerender } = render(view());
    await resolve('projA', [post('a1', 'projA', 'approved', 'planA')], [{ id: 'planA', projectId: 'projA', title: 'Plan' }]);
    fireEvent.drop(screen.getByTestId('slot-2026-10-10-15'), { dataTransfer: dt({ [DND_POST]: 'a1' }) });
    expect(screen.getByRole('dialog', { name: 'Yeniden onay gerekli' })).toBeTruthy();
    setBrand('projB');
    rerender(view());
    expect(screen.queryByRole('dialog', { name: 'Yeniden onay gerekli' })).toBeNull();
    await resolve('projB', []);
    expect(runApprovalAction).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('onaylı içerik onaylanınca sunucu reschedule çağrılır (istemci doğrudan yazmaz)', async () => {
    setBrand('projA');
    render(view());
    await resolve('projA', [post('a1', 'projA', 'approved', 'planA')], [{ id: 'planA', projectId: 'projA', title: 'Plan' }]);
    fireEvent.drop(screen.getByTestId('slot-2026-10-10-15'), { dataTransfer: dt({ [DND_POST]: 'a1' }) });
    fireEvent.click(screen.getByText(/Zamanı değiştir ve iç incelemeye al/));
    await waitFor(() => expect(runApprovalAction).toHaveBeenCalled());
    expect(runApprovalAction.mock.calls[0][0]).toEqual({ planId: 'planA', action: 'reschedule', postIds: ['a1'], scheduledAt: Date.UTC(2026, 9, 10, 12, 0) });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('taslak içerik taşınınca yalnız zamanı istemciden yazılır', async () => {
    setBrand('projA');
    render(view());
    await resolve('projA', [post('d1', 'projA', 'draft')]);
    fireEvent.drop(screen.getByTestId('slot-2026-10-10-15'), { dataTransfer: dt({ [DND_POST]: 'd1' }) });
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    expect(Object.keys((updateDoc.mock.calls[0] as any[])[1]).sort()).toEqual(['scheduledAt', 'updatedAt']);
    expect(runApprovalAction).not.toHaveBeenCalled();
  });

  it('kütüphane dosyası bırakılınca o saatle ve dosyayla editör açılır; başka markanın dosyası reddedilir', async () => {
    drawerAssets.current = [asset('a1', 'projA'), asset('x1', 'projB')];
    setBrand('projA');
    render(view());
    await resolve('projA', []);
    fireEvent.click(screen.getByText('Kütüphane'));
    await waitFor(() => expect(screen.getByTestId('drawer')).toBeTruthy());
    fireEvent.drop(screen.getByTestId('slot-2026-10-10-15'), { dataTransfer: dt({ [DND_LIBRARY_ASSET]: 'a1' }) });
    const last = panelProps[panelProps.length - 1];
    expect(last.open).toBe(true);
    expect(last.prefilledDate).toEqual(new Date('2026-10-10T12:00:00Z'));
    expect(last.initialLibraryAssets.map((a: any) => a.id)).toEqual(['a1']);
    expect(last.timeZone).toBe('Europe/Istanbul');

    fireEvent.drop(screen.getByTestId('slot-2026-10-11-15'), { dataTransfer: dt({ [DND_LIBRARY_ASSET]: 'x1' }) });
    expect(screen.getByText(/bulunamadı/)).toBeTruthy();
    expect(panelProps[panelProps.length - 1].prefilledDate).toEqual(new Date('2026-10-10T12:00:00Z'));
  });
});
