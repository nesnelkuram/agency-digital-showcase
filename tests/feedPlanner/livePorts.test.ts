import { describe, it, expect, vi, beforeEach } from 'vitest';

const af = vi.fn();
let failWith: Error | null = null; // vi.fn izleyicisi reddedilen sonuçları testin dışına sızdırdığından hata ayrı (izlenmeyen) yoldan verilir
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: (...a: any[]) => (failWith ? (async () => { throw failWith; })() : af(...a)) }));
vi.mock('@/lib/firebase/config', () => ({ storage: null }));
vi.mock('firebase/storage', () => ({ getBlob: vi.fn(), ref: vi.fn() }));
import { createCopyPort, createPersistencePort, fetchInventory, MAX_INVENTORY_PAGES, createBlobResolver } from '@/studio/feedPlanner/live/livePorts';
import { PortError } from '@/studio/feedPlanner/ports';

const ok = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
beforeEach(() => { af.mockReset(); failWith = null; });
const rejects = async (p: Promise<unknown>): Promise<PortError> => { try { await p; } catch (e) { return e as PortError; } throw new Error('hata beklendi'); };

describe('kopya portu (/api/studio/plan-copy)', () => {
  it('isteği olduğu gibi gönderir, yanıtı eşler; şablon üretmez', async () => {
    af.mockResolvedValue(ok({ accepted: [{ slotKey: 'feed:0' }], rejected: [], notes: ['n'], model: 'm', promptVersion: 'v', responseId: 'r1', draftOnly: true }));
    const req = { projectId: 'p1', weekStart: '2026-10-12', items: [] } as any;
    const r = await createCopyPort().generate(req);
    expect(af).toHaveBeenCalledWith('/api/studio/plan-copy', { method: 'POST', body: JSON.stringify(req) });
    expect(r).toMatchObject({ accepted: [{ slotKey: 'feed:0' }], responseId: 'r1', model: 'm' });
  });
  it.each([[503, 'feature_disabled', 'Metin üretimi kapalı'], [412, 'brand_voice_missing', 'Marka sesi paketi yok'], [502, 'model_error', 'Model çağrısı başarısız'], [422, 'media_invalid', 'Medya geçersiz']])('%s hatası PortError olarak kodu ve Türkçe mesajıyla yükselir (sessiz yutma yok)', async (status, code, error) => {
    af.mockResolvedValue(ok({ error, code, details: ['x'] }, status));
    const e = await rejects(createCopyPort().generate({} as any));
    expect(e).toBeInstanceOf(PortError);
    expect(e).toMatchObject({ message: error, code, status, details: ['x'] });
  });
  it('oturum yoksa açık hata', async () => {
    failWith = new Error('Not authenticated');
    expect(await rejects(createCopyPort().generate({} as any))).toMatchObject({ code: 'network', message: 'Oturum açık değil.' });
  });
  it('ağ hatasında açık hata', async () => {
    failWith = new Error('ag koptu');
    const e = await rejects(createCopyPort().generate({} as any));
    expect(e.message).toBe('Sunucuya ulaşılamadı: ag koptu');
  });
});

describe('kalıcılık portu (/api/studio/planner-draft)', () => {
  it('load: yok → null; var → sürüm + taslak; GET sorgusu proje ve hafta taşır', async () => {
    const p = createPersistencePort('p1');
    af.mockResolvedValueOnce(ok({ exists: false, version: 0 }));
    expect(await p.load('2026-10-12')).toBeNull();
    expect(af.mock.calls[0][0]).toBe('/api/studio/planner-draft?projectId=p1&weekStart=2026-10-12');
    af.mockResolvedValueOnce(ok({ exists: true, version: 4, draft: { weekStart: 'w' } }));
    expect(await p.load('2026-10-12')).toEqual({ version: 4, draft: { weekStart: 'w' } });
  });
  it('save: PUT gövdesi proje, hafta, beklenen sürüm, anahtar ve taslağı taşır; 409 sürüm çakışması kodu korunur', async () => {
    const p = createPersistencePort('p1');
    af.mockResolvedValueOnce(ok({ version: 2, replayed: false }));
    expect(await p.save({ weekStart: 'w', expectedVersion: 1, idempotencyKey: 'k'.repeat(16), draft: { a: 1 } as any })).toEqual({ version: 2, replayed: false });
    expect(JSON.parse(af.mock.calls[0][1].body)).toEqual({ projectId: 'p1', weekStart: 'w', expectedVersion: 1, idempotencyKey: 'k'.repeat(16), draft: { a: 1 } });
    af.mockResolvedValueOnce(ok({ error: 'Taslak başka bir yerde değişmiş', code: 'version_conflict', details: { currentVersion: 3 } }, 409));
    expect(await rejects(p.save({ weekStart: 'w', expectedVersion: 1, idempotencyKey: 'k'.repeat(16), draft: {} as any }))).toMatchObject({ code: 'version_conflict', status: 409 });
  });
});

describe('katalog sayfalaması: imleç tükenene kadar, sessiz kırpma yok', () => {
  const page = (n: number, next: string | null) => ({ items: Array.from({ length: n }, (_, i) => ({ id: `i${next}${i}` })), excluded: [], nextCursor: next });
  it('447 kayıt = 5 sayfa; tüm kayıtlar gelir; ilerleme bildirilir; sonraki istek önceki imleci taşır', async () => {
    const pages = [page(100, 'c1'), page(100, 'c2'), page(100, 'c3'), page(100, 'c4'), page(47, null)];
    const cursors: (string | null)[] = [];
    let k = 0;
    const progress: number[] = [];
    const r = await fetchInventory('p1', (loaded) => progress.push(loaded), async (c) => { cursors.push(c); return pages[k++] as any; });
    expect(r.items).toHaveLength(447);
    expect(r.pages).toBe(5);
    expect(cursors).toEqual([null, 'c1', 'c2', 'c3', 'c4']);
    expect(progress).toEqual([100, 200, 300, 400, 447]);
  });
  it('elenenler toplanır; imleç döngüsü AÇIK hata; sayfa üst sınırı AÇIK hata', async () => {
    const r = await fetchInventory('p1', undefined, async () => ({ items: [], excluded: [{ id: 'x', reason: 'not_ready' }], nextCursor: null }) as any);
    expect(r.excluded).toEqual([{ id: 'x', reason: 'not_ready' }]);
    expect(await rejects(fetchInventory('p1', undefined, async () => page(1, 'same') as any))).toMatchObject({ code: 'cursor_loop' });
    let n = 0;
    expect(await rejects(fetchInventory('p1', undefined, async () => page(1, `c${n++}`) as any))).toMatchObject({ code: 'page_limit' });
    expect(n).toBe(MAX_INVENTORY_PAGES);
  });
  it('varsayılan çekici: sorgu limit=100 ve imleci taşır; sunucu hatası yükselir', async () => {
    af.mockResolvedValueOnce(ok({ items: [], excluded: [], nextCursor: 'zz' })).mockResolvedValueOnce(ok({ error: 'Sayfa imleci geçersiz.', code: 'bad_cursor' }, 400));
    expect(await rejects(fetchInventory('p1'))).toMatchObject({ code: 'bad_cursor', status: 400 });
    expect(af.mock.calls[0][0]).toBe('/api/studio/planner-inventory?projectId=p1&limit=100');
    expect(af.mock.calls[1][0]).toBe('/api/studio/planner-inventory?projectId=p1&limit=100&cursor=zz');
  });
});

describe('görsel çözümleyici', () => {
  it('depolama hazır değilse hata verir ve hata önbelleğe yazılmaz', async () => {
    const r = createBlobResolver();
    await expect(r.resolve({ imageKey: 'a' } as any)).rejects.toThrow(/Depolama hazır değil/);
    await expect(r.resolve({ imageKey: 'a' } as any)).rejects.toThrow(/Depolama hazır değil/);
    r.dispose();
  });
});
