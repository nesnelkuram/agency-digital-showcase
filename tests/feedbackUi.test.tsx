import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const m = vi.hoisted(() => ({
  runApprovalAction: vi.fn(),
  getPlan: vi.fn(),
  getPlanPosts: vi.fn(),
  requestPlanSuggestion: vi.fn(),
  submitFeedback: vi.fn(),
  createSocialPost: vi.fn(),
}));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn(async () => ({ ok: true, json: async () => ({}) })) }));
vi.mock('@/shared/services/contentApprovalApi', async (orig) => ({ ...(await orig<any>()), runApprovalAction: (...a: any[]) => m.runApprovalAction(...a) }));
vi.mock('@/studio/studioData', async (orig) => ({
  ...(await orig<any>()),
  getPlan: (...a: any[]) => m.getPlan(...a),
  getPlanPosts: (...a: any[]) => m.getPlanPosts(...a),
  getBrandKit: async () => ({ project: { id: 'p1', name: 'Rakle', description: '', clientName: '', clientEmail: '' }, brand: null }),
}));
vi.mock('@/studio/StudioLayout', () => ({ useStudio: () => ({ project: { id: 'p1', name: 'Rakle' }, tenantId: 't1', timeZone: 'Europe/Istanbul' }) }));
vi.mock('@/admin/social-media/components/ApprovalAuditTrail', () => ({ default: () => null }));
vi.mock('@/studio/components/StudioPostDetail', () => ({ default: () => null, EDITABLE_STATUSES: new Set(['draft']) }));
vi.mock('@/studio/components/StudioPostCard', () => ({ default: ({ post, children }: any) => <div>{post.caption}{children}</div> }));
vi.mock('@/studio/mediaIntegrationsApi', async (orig) => ({
  ...(await orig<any>()),
  requestPlanSuggestion: (...a: any[]) => m.requestPlanSuggestion(...a),
  submitFeedback: (...a: any[]) => m.submitFeedback(...a),
}));
vi.mock('@/shared/services/socialMediaService', () => ({ createSocialPost: (...a: any[]) => m.createSocialPost(...a) }));

import StudioPlanPage from '@/studio/pages/StudioPlanPage';
import PlanSuggestPanel from '@/studio/components/PlanSuggestPanel';
import { ApprovalApiError } from '@/shared/services/contentApprovalApi';
import { contentHashOf } from '@/shared/feedback/contentVersion';

const POST = { id: 'post1', projectId: 'p1', contentPlanId: 'plan1', status: 'internal_review', caption: 'Görülen metin', hashtags: [], media: [], mediaUrls: [], postType: 'static', platforms: ['instagram'], scheduledAt: { toMillis: () => 1_760_000_000_000, toDate: () => new Date(1_760_000_000_000) } };

beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

const renderPlan = () =>
  render(
    <MemoryRouter initialEntries={['/studio/p1/planlar/plan1']}>
      <Routes>
        <Route path="/studio/:projectId/planlar/:planId" element={<StudioPlanPage />} />
      </Routes>
    </MemoryRouter>
  );

const choose = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('plan sayfası: Düzeltilsin / Revizyona al sebebi', () => {
  it('kategori + not zorunlu; geçiş ve sebep TEK istekte, görülen sürüm hash\'i ve sabit anahtarla; yeniden deneme aynı anahtar', async () => {
    m.getPlan.mockResolvedValue({ id: 'plan1', projectId: 'p1', status: 'internal_review', reviewRequestId: 'rr1', postIds: ['post1'] });
    m.getPlanPosts.mockResolvedValue([POST]);
    m.runApprovalAction.mockRejectedValueOnce(new ApprovalApiError('ağ hatası', undefined, 500)).mockResolvedValueOnce({ success: true });
    renderPlan();
    await waitFor(() => expect(screen.getByText('Düzeltilsin')).toBeTruthy());
    fireEvent.click(screen.getByText('Düzeltilsin'));
    await waitFor(() => expect(screen.getByTestId('reason-modal')).toBeTruthy());
    const send = () => screen.getByText('Gönder') as HTMLButtonElement;
    expect(send().disabled).toBe(true);
    choose('Sebep kategorisi', 'metin');
    expect(send().disabled).toBe(true); // Düzeltilsin notu zorunlu
    choose('Sebep açıklaması', 'Metin çok uzun');
    fireEvent.click(screen.getByLabelText(/Sonraki marka planlarında bağlam/));
    fireEvent.click(send());
    await waitFor(() => expect(screen.getByText(/aynı gönderimi güvenle yeniden dener/)).toBeTruthy());
    fireEvent.click(send());
    await waitFor(() => expect(m.runApprovalAction).toHaveBeenCalledTimes(2));
    const [a1, a2] = m.runApprovalAction.mock.calls.map((c: any[]) => c[0]);
    expect(a1).toMatchObject({ planId: 'plan1', action: 'internal_reject', postIds: ['post1'], comment: 'Metin çok uzun', feedback: { category: 'metin', note: 'Metin çok uzun', scope: 'brand_context', expectedContentHash: await contentHashOf(POST) } });
    expect(a2.feedback.idempotencyKey).toBe(a1.feedback.idempotencyKey);
    expect(a1.feedback.actorUid).toBeUndefined();
    await waitFor(() => expect(screen.queryByTestId('reason-modal')).toBeNull());
  });

  it('içerik değiştiyse (409) açık mesaj ve yenileme', async () => {
    m.getPlan.mockResolvedValue({ id: 'plan1', projectId: 'p1', status: 'internal_review', postIds: ['post1'] });
    m.getPlanPosts.mockResolvedValue([POST]);
    m.runApprovalAction.mockRejectedValue(new ApprovalApiError('değişti', 'CONTENT_VERSION_CHANGED', 409));
    renderPlan();
    await waitFor(() => expect(screen.getByText('Düzeltilsin')).toBeTruthy());
    fireEvent.click(screen.getByText('Düzeltilsin'));
    await waitFor(() => expect(screen.getByTestId('reason-modal')).toBeTruthy());
    choose('Sebep kategorisi', 'görsel');
    choose('Sebep açıklaması', 'Kadraj');
    fireEvent.click(screen.getByText('Gönder'));
    await waitFor(() => expect(screen.getByText(/İçerik siz incelerken değişmiş/)).toBeTruthy());
    expect(m.getPlanPosts.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('Revizyona al: sebep kategorisi sorulur, not isteğe bağlı', async () => {
    m.getPlan.mockResolvedValue({ id: 'plan1', projectId: 'p1', status: 'approved', postIds: ['post1'] });
    m.getPlanPosts.mockResolvedValue([{ ...POST, status: 'approved' }]);
    m.runApprovalAction.mockResolvedValue({ success: true });
    renderPlan();
    await waitFor(() => expect(screen.getByText('Revizyona al')).toBeTruthy());
    fireEvent.click(screen.getByText('Revizyona al'));
    await waitFor(() => expect(screen.getByText('Neden revizyona alınıyor?')).toBeTruthy());
    choose('Sebep kategorisi', 'zamanlama');
    expect((screen.getByText('Gönder') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText('Gönder'));
    await waitFor(() => expect(m.runApprovalAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'reopen', feedback: expect.objectContaining({ category: 'zamanlama', scope: 'content_only' }) })));
  });
});

describe('öneri paneli: geçmiş ayarları ve öneri reddi', () => {
  const sug = (index: number, id: string) => ({ index, scheduledAt: '2026-10-12T07:00:00.000Z', postType: 'static', mediaIds: [id], media: [{ id: `lib_${id}`, url: `https://x/${id}`, type: 'image', mimeType: 'image/jpeg', size: 1, order: 0, libraryAssetId: id }], captionDraft: `c ${id}`, rationale: 'r', readinessWarnings: false, contentHash: `${index}`.repeat(32).slice(0, 32), warnings: index === 1 ? ['benzer_metin:old1'] : [] });

  it('kullanıcı ayarları istekle gider; kapsam/uyarı gösterilir; red saklanmış öneriye bağlanır, yeniden denemede aynı anahtar; reddedilen taslak olmaz', async () => {
    m.requestPlanSuggestion.mockResolvedValue({
      suggestionSetId: 'set1',
      accepted: [sug(0, 'a'), sug(1, 'b')],
      rejected: [],
      shortages: [],
      inventory: { eligible: 2, excluded: [] },
      modelCalled: true,
      historyScope: { available: false, source: "Yalnız bu sistemde (Studio) kayıtlı post'lar.", windowStart: '2026-09-07', windowEnd: '2026-10-18', postsInWindow: 0, undatedPosts: 0, byBucket: {} },
    });
    m.submitFeedback.mockRejectedValueOnce(new Error('ağ')).mockResolvedValueOnce({ ok: true });
    m.createSocialPost.mockResolvedValue('newpost');
    render(<PlanSuggestPanel tenantId="t1" projectId="p1" weekStart="2026-10-12" timeZone="Europe/Istanbul" uid="u1" userName="Ş" onDraftsCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Geriye bakış (gün)'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Medya tekrar aralığı (gün)'), { target: { value: '21' } });
    fireEvent.click(screen.getByLabelText(/Onay sürecindekiler de tekrar sayılsın/));
    fireEvent.click(screen.getByText('Öneri al'));
    await waitFor(() => expect(screen.getByTestId('history-scope').textContent).toContain('Geçmiş paylaşım verisi yok'));
    expect(m.requestPlanSuggestion).toHaveBeenCalledWith('p1', '2026-10-12', 5, { lookbackDays: 7, repeatGapDays: 21, countPending: false });
    expect(screen.getByTestId('suggestion-1').textContent).toContain('benzer_metin:old1');

    fireEvent.click(screen.getAllByText('Reddet')[1]);
    choose('Sebep kategorisi', 'tekrar');
    fireEvent.click(screen.getByText('Sebebi kaydet ve reddet'));
    await waitFor(() => expect(screen.getByText('ağ')).toBeTruthy());
    fireEvent.click(screen.getByText('Sebebi kaydet ve reddet'));
    await waitFor(() => expect(screen.getByTestId('suggestion-1').textContent).toContain('reddedildi'));
    const [f1, f2] = m.submitFeedback.mock.calls.map((c: any[]) => c[0]);
    expect(f1).toMatchObject({ target: { kind: 'suggestion', suggestionSetId: 'set1', index: 1 }, category: 'tekrar', scope: 'content_only', expectedContentHash: '1'.repeat(32) });
    expect(f2.idempotencyKey).toBe(f1.idempotencyKey);

    fireEvent.click(screen.getByText(/Seçilenleri taslak olarak ekle/));
    await waitFor(() => expect(m.createSocialPost).toHaveBeenCalledTimes(1));
    expect(m.createSocialPost.mock.calls[0][1].libraryAssetIds).toEqual(['a']);
  });
});
