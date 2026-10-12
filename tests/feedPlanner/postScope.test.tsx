import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import PostPlanner from '@/studio/feedPlanner/post/PostPlanner';
import { reviewPorts } from '@/studio/feedPlanner/ports';
import { aest, cand } from './helpers';

// Kapsam (tenant/proje) geçişi, geç başarı/hata/meşgul, görsel-plan onayı ve son-kırpım önizlemesi — gerçek bileşen, taklit model portu.
const candidates = Array.from({ length: 6 }, (_, i) => cand('c' + i, { brand: 'dieci', dims: { w: 1500, h: 1000 } }));
const measureCrop = vi.fn(async () => aest());
const ports = (generate: any) => ({ ...reviewPorts(), mode: 'studio' as const, imageSrc: () => '/__mock/image.svg', copy: { available: true, generate } as any, creative: { available: true, run: generate } as any, persistence: null });
const other = Array.from({ length: 6 }, (_, i) => cand('o' + i, { brand: 'baska', dims: { w: 1500, h: 1000 } }));
const el = (generate: any, tenantId = 't1', projectId = 'dieci', pt = ports(generate)) => (
  <PostPlanner candidates={[...candidates, ...other]} projectId={projectId} tenantId={tenantId} initialCount={4} measureCrop={measureCrop} ports={pt} voice={{ approved: true }} />
);
const start = async () => {
  await waitFor(() => expect((screen.getByTestId('post-plan-btn') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByTestId('post-plan-btn'));
  expect(screen.getByTestId('post-grid').children.length).toBe(4);
  fireEvent.click(screen.getByLabelText('p1 incele'));
};
const ok = (text: string) => ({ responseId: text, accepted: [{ slotKey: 'feed:0', text: { caption: text }, contentHash: 'h', evidenceBasis: 'katalog_gozlem', crop: { version: 0, facts: 'tam' } }], rejected: [], promptVersion: 'mock' });
const gen = async () => {
  fireEvent.click(screen.getByTestId('post-visual-done'));
  fireEvent.click(screen.getByTestId('post-gen-one'));
};
const zoom = (v: string) => fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: v } });
afterEach(cleanup);

describe('görsel plan onayı', () => {
  it('kırpım değişince onay düşer ve yaratıcı roller kapanır; yeniden onaylayınca açılır', async () => {
    render(el(vi.fn()));
    await start();
    fireEvent.click(screen.getByTestId('post-visual-done'));
    expect((screen.getByTestId('post-visual-done') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('ideas-run') as HTMLButtonElement).disabled).toBe(false);
    zoom('2');
    expect((screen.getByTestId('post-visual-done') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId('ideas-run') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('post-done-stale')).toBeTruthy();
    fireEvent.click(screen.getByTestId('post-visual-done'));
    expect((screen.getByTestId('post-visual-done') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByTestId('post-done-stale')).toBeNull();
  });

  it('görsel değiştirme (replace) de onayı düşürür; insan metni düzenlemesi onayı BOZMAZ', async () => {
    render(el(vi.fn()));
    await start();
    fireEvent.click(screen.getByTestId('post-visual-done'));
    fireEvent.change(screen.getByTestId('post-edit-text'), { target: { value: 'insan yazdı' } });
    fireEvent.click(screen.getByTestId('post-save-text'));
    expect((screen.getByTestId('post-visual-done') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('p1 değiştir'));
    expect((screen.getByTestId('post-visual-done') as HTMLInputElement).checked).toBe(false);
  });
});

describe('önizleme: SON 4:5 kırpım', () => {
  const cropAt = (root: ParentNode, sel: string) => root.querySelector(sel.includes('data-idx') ? `${sel} [data-crop]` : sel)?.getAttribute('data-crop');
  it('profil ve kronoloji önizlemesi plan hücresiyle AYNI kırpımı çizer; kırpılmamış post otomatik kırpımla; kırpım güncellenince önizleme de güncellenir', async () => {
    render(el(vi.fn()));
    await start();
    zoom('2');
    const crop = cropAt(screen.getByTestId('post-cell-p1'), '[data-crop]');
    expect(crop).toBeTruthy();
    const profile = screen.getByTestId('view-profile');
    expect(cropAt(profile, '[data-kind="plan"][data-idx="0"]')).toBe(crop);
    const other = cropAt(screen.getByTestId('post-cell-p2'), '[data-crop]');
    expect(cropAt(profile, '[data-kind="plan"][data-idx="1"]')).toBe(other);
    expect(other).not.toBe(crop);
    zoom('3');
    expect(cropAt(profile, '[data-kind="plan"][data-idx="0"]')).toBe(cropAt(screen.getByTestId('post-cell-p1'), '[data-crop]'));
    expect(cropAt(profile, '[data-kind="plan"][data-idx="0"]')).not.toBe(crop);
  });
});

describe('React.StrictMode (gerçek uygulama yaşam döngüsü)', () => {
  it('çift efekt/dispose-revive sonrası ölçüm kuyruğu tamamlanır; plan düğmesi açılır', async () => {
    render(<React.StrictMode>{el(vi.fn())}</React.StrictMode>);
    await waitFor(() => expect((screen.getByTestId('post-plan-btn') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('post-plan-btn'));
    expect(screen.getByTestId('post-grid').children.length).toBe(4);
  });
});
