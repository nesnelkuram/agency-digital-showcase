import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

const af = vi.fn();
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: (...a: any[]) => af(...a) }));
import BrandVoiceCard from '@/studio/components/BrandVoiceCard';

const res = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
beforeEach(() => af.mockReset());
afterEach(() => cleanup());

describe('marka sesi paketi kartı', () => {
  it('onaylı marka dili yoksa BLOKLAMAZ: plan akışının sürdüğünü söyler, "birlikte oluştur" ana yoldur, manuel paket yüklemesi gelişmiş bölümde katlıdır', async () => {
    af.mockResolvedValue(res({ exists: false }));
    const onStartGuide = vi.fn();
    render(<BrandVoiceCard projectId="p1" onStartGuide={onStartGuide} />);
    await waitFor(() => expect(screen.getByTestId('brand-voice-missing').textContent).toMatch(/Onaylı marka dili yok\. Plan akışı bloklanmaz/));
    expect(screen.queryByText(/412|çalışmaz/)).toBeNull();
    expect(af.mock.calls[0][0]).toBe('/api/studio/brand-voice?projectId=p1');
    fireEvent.click(screen.getByTestId('brand-guide-open'));
    expect(onStartGuide).toHaveBeenCalledTimes(1);
    const adv = screen.getByText(/Gelişmiş: marka sesi paketi yükle/).closest('details') as HTMLDetailsElement;
    expect(adv.open).toBe(false);
    expect(adv.contains(screen.getByLabelText(/Paket dosyası/))).toBe(true);
  });
  it('onaylı rehber varsa sürümü gösterir ve "eksik" uyarısı vermez', async () => {
    af.mockResolvedValue(res({ exists: false }));
    render(<BrandVoiceCard projectId="p1" guideVersion={3} onStartGuide={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('brand-guide-status').textContent).toMatch(/sürüm 3/));
    expect(screen.queryByTestId('brand-voice-missing')).toBeNull();
    expect(screen.getByTestId('brand-guide-open').textContent).toBe('Marka dilini güncelle');
  });
  it('yüklüyse durumu gösterir; rehber METNİ yok, yalnız özet', async () => {
    af.mockResolvedValue(res({ exists: true, valid: true, account: 'dieci', captionCount: 38, excluded: [{ id: 'P10', reason: 'üçüncü taraf' }], guideHashes: { persona: 'abcdef0123456789' }, verifiedProducts: [{ id: 'a', name: 'A' }], updatedAt: 1760000000000 }));
    render(<BrandVoiceCard projectId="p1" />);
    await waitFor(() => expect(screen.getByTestId('brand-voice-status').textContent).toMatch(/Hesap dieci · 38 gönderi · 1 dışlanan · 1 doğrulanmış ürün/));
    expect(screen.getByTestId('brand-voice-status').textContent).toMatch(/persona abcdef01/);
  });
  it('geçersiz saklı paket uyarılır', async () => {
    af.mockResolvedValue(res({ exists: true, valid: false, errors: ['guideHashes uyuşmuyor'] }));
    render(<BrandVoiceCard projectId="p1" />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Saklanan paket geçersiz: guideHashes uyuşmuyor/));
  });
  it('dosya yüklemesi: PUT gövdesi proje + paket; sunucu reddederse neden gösterilir, başarı denmez', async () => {
    af.mockResolvedValueOnce(res({ exists: false }));
    render(<BrandVoiceCard projectId="p1" />);
    await waitFor(() => expect(af).toHaveBeenCalledTimes(1));
    const input = screen.getByLabelText(/Paket dosyası/) as HTMLInputElement;
    af.mockResolvedValueOnce(res({ error: 'Marka sesi paketi geçersiz', code: 'bundle_invalid', details: ['hesap sahipliği uyuşmuyor'] }, 422));
    fireEvent.change(input, { target: { files: [new File([JSON.stringify({ v: 1 })], 'bundle.json', { type: 'application/json' })] } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Yüklenemedi: Marka sesi paketi geçersiz · hesap sahipliği uyuşmuyor/));
    expect(JSON.parse(af.mock.calls[1][1].body)).toEqual({ projectId: 'p1', bundle: { v: 1 } });
    expect(screen.queryByText(/Yüklendi:/)).toBeNull();
  });
  it('başarılı yüklemede sayılar gösterilir ve durum yenilenir', async () => {
    af.mockResolvedValueOnce(res({ exists: false }));
    render(<BrandVoiceCard projectId="p1" />);
    await waitFor(() => expect(af).toHaveBeenCalledTimes(1));
    af.mockResolvedValueOnce(res({ ok: true, captionCount: 38, excluded: [{ id: 'P10' }] })).mockResolvedValueOnce(res({ exists: true, valid: true, account: 'dieci', captionCount: 38, excluded: [], guideHashes: {}, verifiedProducts: [] }));
    fireEvent.change(screen.getByLabelText(/Paket dosyası/), { target: { files: [new File(['{}'], 'b.json')] } });
    await waitFor(() => expect(screen.getByText(/Yüklendi: 38 hesap gönderisi, 1 kayıt dışlandı/)).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('brand-voice-status')).toBeTruthy());
  });
});
