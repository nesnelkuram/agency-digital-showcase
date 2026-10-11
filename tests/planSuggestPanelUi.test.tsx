import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const api = vi.hoisted(() => ({ requestPlanSuggestion: vi.fn() }));
const svc = vi.hoisted(() => ({ createSocialPost: vi.fn() }));
vi.mock('@/studio/mediaIntegrationsApi', async (orig) => ({ ...(await orig<any>()), requestPlanSuggestion: (...a: any[]) => api.requestPlanSuggestion(...a) }));
vi.mock('@/shared/services/socialMediaService', () => ({ createSocialPost: (...a: any[]) => svc.createSocialPost(...a) }));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn() }));

import PlanSuggestPanel from '@/studio/components/PlanSuggestPanel';

const sug = (index: number, id: string) => ({
  index,
  scheduledAt: '2026-10-12T07:00:00.000Z',
  postType: 'static',
  mediaIds: [id],
  media: [{ id: `lib_${id}`, url: `https://x/${id}`, type: 'image', mimeType: 'image/jpeg', size: 1, order: 0, libraryAssetId: id }],
  captionDraft: `cap ${id}`,
  rationale: 'r',
  readinessWarnings: false,
});

beforeEach(() => {
  api.requestPlanSuggestion.mockReset();
  svc.createSocialPost.mockReset();
});

const renderPanel = (onDraftsCreated = vi.fn()) => {
  render(<PlanSuggestPanel tenantId="t1" projectId="p1" weekStart="2026-10-12" timeZone="Europe/Istanbul" uid="u1" userName="Şeyma" onDraftsCreated={onDraftsCreated} />);
  return onDraftsCreated;
};

describe('AI taslak paneli', () => {
  it('kısmi hata: eklenenler işaretlenir; yeniden deneme yalnız kalanları ekler (çoğalma yok)', async () => {
    api.requestPlanSuggestion.mockResolvedValue({ accepted: [sug(0, 'a'), sug(1, 'b'), sug(2, 'c')], rejected: [], shortages: [], inventory: { eligible: 3, excluded: [] }, modelCalled: true });
    let n = 0;
    svc.createSocialPost.mockImplementation(async () => {
      n++;
      if (n === 3) throw new Error('network');
      return `post${n}`;
    });
    const reload = renderPanel();
    fireEvent.click(screen.getByText('Öneri al'));
    await waitFor(() => expect(screen.getByText(/Seçilenleri taslak olarak ekle \(3\)/)).toBeTruthy());
    fireEvent.click(screen.getByText(/Seçilenleri taslak olarak ekle/));
    await waitFor(() => expect(screen.getByText(/Bazı taslaklar eklenemedi/)).toBeTruthy());
    expect(screen.getByTestId('suggestion-0').textContent).toContain('taslak olarak eklendi');
    expect(screen.getByTestId('suggestion-1').textContent).toContain('taslak olarak eklendi');
    expect(screen.getByTestId('suggestion-2').textContent).not.toContain('eklendi');
    expect(screen.getByText(/Seçilenleri taslak olarak ekle \(1\)/)).toBeTruthy();
    expect(reload).toHaveBeenCalledTimes(1); // eklenenler mevcut listede görünsün

    fireEvent.click(screen.getByText(/Seçilenleri taslak olarak ekle/));
    await waitFor(() => expect(svc.createSocialPost).toHaveBeenCalledTimes(4));
    const assetIds = svc.createSocialPost.mock.calls.map((c: any[]) => c[1].libraryAssetIds[0]);
    expect(assetIds).toEqual(['a', 'b', 'c', 'c']); // a ve b ikinci kez gönderilmedi
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
  });

  it('özellik kapalıysa açık mesaj; taslak oluşturulmaz', async () => {
    api.requestPlanSuggestion.mockRejectedValue(Object.assign(new Error('x'), { code: 'feature_disabled' }));
    renderPanel();
    fireEvent.click(screen.getByText('Öneri al'));
    await waitFor(() => expect(screen.getByText('AI plan önerisi bu ortamda kapalı.')).toBeTruthy());
    expect(svc.createSocialPost).not.toHaveBeenCalled();
  });

  it('eksiklik raporu gösterilir; reddedilen öneriler listelenmez', async () => {
    api.requestPlanSuggestion.mockResolvedValue({ accepted: [sug(0, 'a')], rejected: [{ index: 1, reasons: ['unknown_media:ghost'] }], shortages: ['İstenen 5 post için doğrulanmış öneri 1; yeterli uygun medya veya geçerli öneri yok.'], inventory: { eligible: 1, excluded: [] }, modelCalled: true });
    renderPanel();
    fireEvent.click(screen.getByText('Öneri al'));
    await waitFor(() => expect(screen.getByTestId('plan-suggest-shortage').textContent).toContain('doğrulanmış öneri 1'));
    expect(screen.getByText(/1 öneri doğrulamadan geçmedi/)).toBeTruthy();
    expect(screen.queryByTestId('suggestion-1')).toBeNull();
  });
});
