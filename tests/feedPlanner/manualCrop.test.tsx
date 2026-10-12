import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import App, { type ReviewData } from '@/studio/feedPlanner/review/App';
import { VISUAL_SCHEMA_VERSION } from '@/shared/planner/visualDecision';
import { aest, pool } from './helpers';
import { visual } from '../helpers/visualFixture';
import { reviewPorts, type PlannerPorts } from '@/studio/feedPlanner/ports';

// Gerçek App + gerçek planlayıcı/puanlayıcı; yalnız ölçüm (measure) ve model portu taklit. Görsel karar KAYITLI aday verisidir.
const prov = (id: string) => ({
  tenantId: 't1', projectId: 'dieci', assetId: id, analysisKey: `k-${id}`, sourceSha256: `s-${id}`, analyzedAt: 1, model: 'anthropic/claude-haiku-5.5', promptVersion: 'media-catalog-v3', schemaVersion: '3',
  visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualPromptVersion: 'visual-decision-prompt-3', sourceQuality: 'original', geometryBasis: 'original' as const,
});
const mkData = (): ReviewData => {
  const { all, storyIds } = pool();
  const candidates = all.filter((c) => !c.published).map((c) =>
    c.id === 'p7' ? { ...c, visual: { decision: visual({ subject: { box: { x: 0.2, y: 0.3, w: 0.6, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } }), provenance: prov('p7') } } : c);
  return { title: 't', dateLabel: 'd', archiveNote: 'a', scope: 's', weeklyStory: storyIds, candidates, published: [] };
};
const measure = vi.fn(async () => aest());
const ports = (): PlannerPorts => ({ ...reviewPorts(), mode: 'studio', copy: { available: true, generate: vi.fn() } as any, persistence: null });
let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const assignP7 = () => {
  fireEvent.click(screen.getByLabelText('Feed slot 5 seç'));
  fireEvent.click(screen.getByLabelText('p7 slota ata'));
  fireEvent.click(within(screen.getByTestId('feed-slot-4')).getByRole('button', { name: /p7 incele/ }));
};
const notes = () => screen.queryByTestId('composition-notes')?.textContent ?? '';

describe('manuel kırpım puanlamaya taşınır (UI)', () => {
  it('Reels 9:16 kırpımında yakınlaştırma konuyu kestiğinde kompozisyon açıklaması DEĞİŞİR; sıfırlanınca geri döner; model çağrısı yok', async () => {
    render(<App data={mkData()} measure={measure} ports={ports()} projectId="dieci" tenantId="t1" />);
    assignP7();
    fireEvent.click(screen.getByLabelText(/Reels kapağı 9:16/));
    await waitFor(() => expect(screen.getByTestId('composition-sources')).toBeTruthy());
    expect(notes()).not.toMatch(/konu .*kesiliyor|dışarıda kalıyor/);
    expect(screen.getByTestId('composition-sources').textContent).toMatch(/crop=kod hesabı/);
    const before = screen.getByText(/Puan \(sezgisel\)/).textContent;
    fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: '2' } });
    await waitFor(() => expect(notes()).toMatch(/Reels kapağı 9:16 kırpımında konu (kısmen kesiliyor|büyük ölçüde dışarıda kalıyor)/));
    expect(screen.getByText(/Puan \(sezgisel\)/).textContent).not.toBe(before); // toplam puan gerçekten değişti
    fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: '1' } });
    await waitFor(() => expect(notes()).not.toMatch(/kesiliyor|dışarıda kalıyor/));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('kilitli slotun manuel kırpımı plan yenilenince KORUNUR (yakınlaştırma 2 kalır) ve kilitli görsel değişmez', async () => {
    render(<App data={mkData()} measure={measure} ports={ports()} projectId="dieci" tenantId="t1" />);
    assignP7();
    fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('feed slot 5 kalsın'));
    const btn = screen.getByTestId('make-plan') as HTMLButtonElement;
    await waitFor(() => expect(btn.disabled).toBe(false));
    fireEvent.click(btn);
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
    expect(within(screen.getByTestId('feed-slot-4')).getByRole('button', { name: /p7 incele/ })).toBeTruthy(); // kilitli görsel yerinde
    fireEvent.click(within(screen.getByTestId('feed-slot-4')).getByRole('button', { name: /p7 incele/ }));
    expect((screen.getByLabelText('Yakınlaştırma') as HTMLInputElement).value).toBe('2');
  });
});
