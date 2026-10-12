import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

const auth = vi.hoisted(() => ({ user: { uid: 'u1', role: 'admin' } as any }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
const api = vi.hoisted(() => ({ getGuideState: vi.fn(), generateGuideDraft: vi.fn(), saveGuideDraft: vi.fn(), approveGuide: vi.fn() }));
vi.mock('@/studio/brandGuideApi', async (orig) => ({ ...(await orig<any>()), ...api }));
import BrandGuideChat from '@/studio/components/BrandGuideChat';
import { GuideApiError } from '@/studio/brandGuideApi';

const GUIDE = { brandName: 'HAL', whatTheyDo: 'Mahalle fırını.', audience: 'Semt sakinleri', toneLabels: ['samimi'], toneNotes: 'Sıcak.', examples: [], avoid: ['indirim vaadi'], facts: ['Mahalle fırını.'], openQuestions: ['Çalışma saatleri neler?'] };
const draft = (v = 1, over: any = {}) => ({ version: v, guide: GUIDE, contentKey: 'a'.repeat(32), origin: 'ai', baseApprovedVersion: null, assumptions: ['Bu bir TASLAKtır; onaylanana kadar metin üretiminde kullanılmaz.'], droppedFacts: [], updatedAt: 1, ...over });
const state = (over: any = {}) => ({ draft: null, approved: null, bundleExists: false, aiEnabled: true, ...over });

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.getGuideState.mockResolvedValue(state()); auth.user = { uid: 'u1', role: 'admin' }; });
afterEach(() => cleanup());

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function fillWizardAndGenerate() {
  await waitFor(() => expect(api.getGuideState).toHaveBeenCalled());
  type('Markanızın adı nedir?', 'HAL');
  fireEvent.click(screen.getByText('İleri'));
  type('Marka ne yapar? Kısaca anlatın.', 'Mahalle fırını.');
  fireEvent.click(screen.getByText('İleri'));
  for (let k = 0; k < 3; k++) fireEvent.click(screen.getByText('Atla'));
  fireEvent.click(screen.getByTestId('guide-generate'));
}

describe('Marka dilini birlikte oluştur', () => {
  it('yönlendirmeli sorular → taslak: brief gönderilir (yalnız kullanıcı yanıtları), taslak v1 AI taslağı olarak gösterilir; HENÜZ onaylı değil', async () => {
    api.generateGuideDraft.mockResolvedValue({ draft: draft(1), replayed: false });
    render(<BrandGuideChat projectId="p1" onClose={() => {}} />);
    expect(screen.getByRole('dialog').textContent).toMatch(/ses\/audio üretimi değil/);
    await fillWizardAndGenerate();
    await waitFor(() => expect(screen.getByTestId('guide-draft')).toBeTruthy());
    const call = api.generateGuideDraft.mock.calls[0][0];
    expect(call).toMatchObject({ projectId: 'p1', expectedDraftVersion: 0, brief: { brandName: 'HAL', whatTheyDo: 'Mahalle fırını.', audience: '', free: '' } });
    expect(call.idempotencyKey).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    expect(screen.getByTestId('guide-draft').textContent).toMatch(/Taslak sürüm 1 · AI taslağı/);
    expect(screen.getByTestId('guide-assumptions').textContent).toMatch(/onaylanana kadar metin üretiminde kullanılmaz/);
    expect(screen.getByTestId('guide-questions').textContent).toMatch(/Çalışma saatleri neler/);
    expect(api.approveGuide).not.toHaveBeenCalled();
    expect(screen.queryByTestId('guide-approved-info')).toBeNull();
  });

  it('serbest brief yolu da çalışır (ad + brief)', async () => {
    api.generateGuideDraft.mockResolvedValue({ draft: draft(1), replayed: false });
    render(<BrandGuideChat projectId="p1" onClose={() => {}} />);
    await waitFor(() => expect(api.getGuideState).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Serbest brief'));
    expect((screen.getByTestId('guide-generate') as HTMLButtonElement).disabled).toBe(true);
    type('Marka adı', 'HAL');
    type('Serbest brief', 'Mahalle fırını, sıcak bir dil.');
    fireEvent.click(screen.getByTestId('guide-generate'));
    await waitFor(() => expect(api.generateGuideDraft).toHaveBeenCalled());
    expect(api.generateGuideDraft.mock.calls[0][0].brief).toMatchObject({ brandName: 'HAL', free: 'Mahalle fırını, sıcak bir dil.', whatTheyDo: '' });
  });

  it('ONAY: kaydedilmemiş düzenleme varken kapalı; önce kaydet (taslak sürümüne), sonra açık onay kutusu + düğme; onay çağrısı sürüm ve içerik anahtarı taşır', async () => {
    api.generateGuideDraft.mockResolvedValue({ draft: draft(1), replayed: false });
    api.saveGuideDraft.mockResolvedValue({ draft: draft(2, { origin: 'human', contentKey: 'b'.repeat(32), guide: { ...GUIDE, toneNotes: 'Elle' } }), replayed: false });
    api.approveGuide.mockResolvedValue({ approved: { version: 1, guide: GUIDE, contentKey: 'b'.repeat(32), approvedAt: 5, approvedBy: 'u1' }, replayed: false });
    const onApproved = vi.fn();
    render(<BrandGuideChat projectId="p1" onClose={() => {}} onApproved={onApproved} />);
    await fillWizardAndGenerate();
    await waitFor(() => expect(screen.getByTestId('guide-draft')).toBeTruthy());
    const approve = screen.getByTestId('guide-approve') as HTMLButtonElement;
    expect(approve.disabled).toBe(true); // onay kutusu işaretli değil
    fireEvent.change(screen.getByLabelText('Rehber ton notu'), { target: { value: 'Elle' } });
    expect((screen.getByTestId('guide-confirm') as HTMLInputElement).disabled).toBe(true); // kaydedilmemiş düzenleme
    fireEvent.click(screen.getByTestId('guide-save'));
    await waitFor(() => expect(api.saveGuideDraft).toHaveBeenCalled());
    expect(api.saveGuideDraft.mock.calls[0][0]).toMatchObject({ projectId: 'p1', expectedDraftVersion: 1, guide: { toneNotes: 'Elle' } });
    await waitFor(() => expect(screen.getByTestId('guide-draft').textContent).toMatch(/Taslak sürüm 2 · elle düzenlendi/));
    const confirm = screen.getByTestId('guide-confirm') as HTMLInputElement;
    expect(confirm.disabled).toBe(false);
    expect(approve.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(approve.disabled).toBe(false);
    api.getGuideState.mockResolvedValue(state({ draft: draft(2), approved: { version: 1, guide: GUIDE, contentKey: 'b'.repeat(32), approvedAt: 5, approvedBy: 'u1' } }));
    fireEvent.click(approve);
    await waitFor(() => expect(api.approveGuide).toHaveBeenCalledTimes(1));
    expect(api.approveGuide.mock.calls[0][0]).toMatchObject({ projectId: 'p1', expectedDraftVersion: 2, contentKey: 'b'.repeat(32), expectedApprovedVersion: null });
    await waitFor(() => expect(screen.getByTestId('guide-msg').textContent).toMatch(/Marka rehberi onaylandı \(sürüm 1\)/));
    expect(onApproved).toHaveBeenCalled();
  });

  it('yönetici DEĞİLSE onay kapalıdır ve nedeni söylenir; taslak/düzenleme çalışır', async () => {
    auth.user = { uid: 'u2', role: 'brand_manager' };
    api.getGuideState.mockResolvedValue(state({ draft: draft(1) }));
    render(<BrandGuideChat projectId="p1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('guide-draft')).toBeTruthy());
    expect(screen.getByTestId('guide-admin-only').textContent).toMatch(/yalnız yöneticiye açık/);
    expect((screen.getByTestId('guide-confirm') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('guide-approve') as HTMLButtonElement).disabled).toBe(true);
  });

  it('yüklü marka sesi paketi varsa onay kapalı (paket öncelikli) ve açıklanır', async () => {
    api.getGuideState.mockResolvedValue(state({ draft: draft(1), bundleExists: true }));
    render(<BrandGuideChat projectId="p1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('guide-bundle-blocks').textContent).toMatch(/öncelikli/));
    expect((screen.getByTestId('guide-confirm') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('guide-approve') as HTMLButtonElement).disabled).toBe(true);
  });

  it('SAĞLAYICI KAPALI: taslak üretimi kapalı gösterilir, elle yazma yolu açıktır; kaydetme sürüm 0\'dan başlar', async () => {
    api.getGuideState.mockResolvedValue(state({ aiEnabled: false }));
    api.saveGuideDraft.mockResolvedValue({ draft: draft(1, { origin: 'human' }), replayed: false });
    render(<BrandGuideChat projectId="p1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('guide-ai-off').textContent).toMatch(/kapalı \(sağlayıcı yapılandırması\)/));
    fireEvent.click(screen.getByText('Serbest brief'));
    type('Marka adı', 'HAL');
    type('Serbest brief', 'Fırın');
    expect((screen.getByTestId('guide-generate') as HTMLButtonElement).disabled).toBe(true); // brief dolu olsa da sağlayıcı kapalı
    fireEvent.click(screen.getByTestId('guide-manual'));
    fireEvent.change(screen.getByLabelText('Rehber marka adı'), { target: { value: 'HAL' } });
    fireEvent.change(screen.getByLabelText('Rehber ne yapar'), { target: { value: 'Fırın' } });
    fireEvent.click(screen.getByTestId('guide-save'));
    await waitFor(() => expect(api.saveGuideDraft).toHaveBeenCalled());
    expect(api.saveGuideDraft.mock.calls[0][0].expectedDraftVersion).toBe(0);
    expect(api.generateGuideDraft).not.toHaveBeenCalled();
  });

  it('503 feature_disabled (sunucu kapalı) görünür ve açıklanır; sahte başarı yok', async () => {
    api.generateGuideDraft.mockRejectedValue(new GuideApiError('Plan metin üretimi kapalı (PLAN_COPY_AI_ENABLED).', 'feature_disabled', 503));
    render(<BrandGuideChat projectId="p1" onClose={() => {}} />);
    await fillWizardAndGenerate();
    await waitFor(() => expect(screen.getByTestId('guide-msg').textContent).toMatch(/Taslak oluşturma kapalı \(sağlayıcı yapılandırması\)/));
    expect(screen.queryByTestId('guide-draft')).toBeNull();
  });

  it('request_pending: aynı anahtarla tekrar sorulur (çift ücretli çağrı yok); kesin hatadan (502) sonra YENİ anahtar kullanılır', async () => {
    api.generateGuideDraft
      .mockRejectedValueOnce(new GuideApiError('Aynı istek işleniyor', 'request_pending', 409, { retryAfterMs: 2000 }))
      .mockRejectedValueOnce(new GuideApiError('model hatası', 'model_error', 502))
      .mockResolvedValueOnce({ draft: draft(1), replayed: false });
    render(<BrandGuideChat projectId="p1" onClose={() => {}} />);
    await fillWizardAndGenerate();
    await waitFor(() => expect(screen.getByTestId('guide-msg').textContent).toMatch(/Aynı istek işleniyor/));
    fireEvent.click(screen.getByTestId('guide-generate'));
    await waitFor(() => expect(api.generateGuideDraft).toHaveBeenCalledTimes(2));
    const [k1, k2] = api.generateGuideDraft.mock.calls.map((c) => c[0].idempotencyKey);
    expect(k2).toBe(k1); // pending sonrası aynı anahtar
    await waitFor(() => expect(screen.getByTestId('guide-msg').textContent).toMatch(/model hatası \[model_error\]/));
    fireEvent.click(screen.getByTestId('guide-generate'));
    await waitFor(() => expect(api.generateGuideDraft).toHaveBeenCalledTimes(3));
    expect(api.generateGuideDraft.mock.calls[2][0].idempotencyKey).not.toBe(k1); // kesin hata → bilinçli yeni deneme
  });

  it('sürüm çakışması: hata gösterilir ve güncel durum yeniden yüklenir; onay çakışmasında sahte başarı yok', async () => {
    api.getGuideState.mockResolvedValue(state({ draft: draft(2) }));
    api.approveGuide.mockRejectedValue(new GuideApiError('Taslak onay ekranından sonra değişti', 'draft_conflict', 409, { currentVersion: 3 }));
    render(<BrandGuideChat projectId="p1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('guide-draft')).toBeTruthy());
    fireEvent.click(screen.getByTestId('guide-confirm'));
    fireEvent.click(screen.getByTestId('guide-approve'));
    await waitFor(() => expect(screen.getByTestId('guide-msg').textContent).toMatch(/Taslak onay ekranından sonra değişti.*Güncel durum yüklendi/));
    expect(api.getGuideState.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId('guide-approved-info')).toBeNull();
  });

  it('brief eksikse sunucu nedenleri gösterilir', async () => {
    api.generateGuideDraft.mockRejectedValue(new GuideApiError('Brief eksik', 'brief_incomplete', 422, ['Marka adı gerekli.']));
    render(<BrandGuideChat projectId="p1" onClose={() => {}} />);
    await fillWizardAndGenerate();
    await waitFor(() => expect(screen.getByTestId('guide-msg').textContent).toMatch(/Brief eksik: Marka adı gerekli\./));
  });

  it('mevcut onaylı rehber sürümü gösterilir; onay, mevcut onaylı sürümü beklenen sürüm olarak taşır (sessiz ezme yok)', async () => {
    api.getGuideState.mockResolvedValue(state({ draft: draft(4), approved: { version: 2, guide: GUIDE, contentKey: 'c'.repeat(32), approvedAt: 9, approvedBy: 'u1' } }));
    api.approveGuide.mockResolvedValue({ approved: { version: 3, guide: GUIDE, contentKey: 'a'.repeat(32), approvedAt: 10, approvedBy: 'u1' }, replayed: false });
    render(<BrandGuideChat projectId="p1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('guide-approved-info').textContent).toMatch(/sürüm 2/));
    fireEvent.click(screen.getByTestId('guide-confirm'));
    fireEvent.click(screen.getByTestId('guide-approve'));
    await waitFor(() => expect(api.approveGuide).toHaveBeenCalled());
    expect(api.approveGuide.mock.calls[0][0]).toMatchObject({ expectedDraftVersion: 4, expectedApprovedVersion: 2 });
  });
});
