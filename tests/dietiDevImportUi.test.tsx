import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const imp = vi.hoisted(() => ({ importDieciDraft: vi.fn() }));
vi.mock('@/studio/devDraft/importDraft', () => ({ importDieciDraft: (...a: any[]) => imp.importDieciDraft(...a), ImportConflictError: class extends Error {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1', displayName: 'Şeyma', email: 'x@y' } }) }));

import DevDraftImport from '@/studio/components/DevDraftImport';

const plan = { baslik: 'Dieci Türkçe plan', days: [{ items: [{}, {}] }, { items: [{}] }] };
beforeEach(() => {
  imp.importDieciDraft.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => plan })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const renderIt = (name = 'Dieci Moda', onDone = vi.fn()) => {
  render(<MemoryRouter><DevDraftImport projectId="p1" projectName={name} tenantId="t1" onDone={onDone} /></MemoryRouter>);
  return onDone;
};

describe('Dev yerel taslak aktarım kartı', () => {
  it('kaynak yoksa hiçbir şey göstermez', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    const { container } = render(<MemoryRouter><DevDraftImport projectId="p1" projectName="Dieci" tenantId="t1" onDone={() => {}} /></MemoryRouter>);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="dev-draft-import"]')).toBeNull();
  });

  it('TASLAK etiketi ve özet görünür; Dieci projesinde buton açık', async () => {
    renderIt();
    await waitFor(() => expect(screen.getByTestId('dev-draft-import')).toBeTruthy());
    expect(screen.getByText('TASLAK')).toBeTruthy();
    expect(screen.getByText(/3 kare/)).toBeTruthy();
    expect((screen.getByText('Taslağı bu projeye aktar') as HTMLButtonElement).disabled).toBe(false);
    expect(imp.importDieciDraft).not.toHaveBeenCalled();
  });

  it('Dieci olmayan projede aktarım kapalıdır', async () => {
    renderIt('Başka Marka');
    await waitFor(() => expect(screen.getByTestId('dev-draft-import')).toBeTruthy());
    expect((screen.getByText('Taslağı bu projeye aktar') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Dieci değil/)).toBeTruthy();
  });

  it('iki adımlı onay: önce onay butonu; onaylanınca oturum bilgisiyle importer çağrılır, sonuç ve plan linki görünür', async () => {
    imp.importDieciDraft.mockResolvedValue({ planId: 'dsp_x', createdPlan: true, createdPosts: ['a', 'b'], alreadyPresent: 7, uploaded: 18 });
    const onDone = renderIt();
    await waitFor(() => expect(screen.getByTestId('dev-draft-import')).toBeTruthy());
    fireEvent.click(screen.getByText('Taslağı bu projeye aktar'));
    expect(imp.importDieciDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/Onaylıyorum/));
    await waitFor(() => expect(imp.importDieciDraft).toHaveBeenCalledTimes(1));
    expect(imp.importDieciDraft.mock.calls[0][0]).toMatchObject({ tenantId: 't1', projectId: 'p1', uid: 'u1' });
    await waitFor(() => expect(screen.getByText('Planı aç').getAttribute('href')).toBe('/studio/p1/planlar/dsp_x'));
    expect(onDone).toHaveBeenCalled();
  });

  it('hata durumunda mesaj gösterir ve sonuç/plan linki göstermez', async () => {
    imp.importDieciDraft.mockRejectedValue(new Error('storage/unauthorized'));
    renderIt();
    await waitFor(() => expect(screen.getByTestId('dev-draft-import')).toBeTruthy());
    fireEvent.click(screen.getByText('Taslağı bu projeye aktar'));
    fireEvent.click(screen.getByText(/Onaylıyorum/));
    await waitFor(() => expect(screen.getByText(/İçe aktarma durdu/)).toBeTruthy());
    expect(screen.queryByText('Planı aç')).toBeNull();
  });
});
