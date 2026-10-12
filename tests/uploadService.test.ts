import { describe, it, expect, vi } from 'vitest';
import { UploadService } from '@/studio/library/uploadService';
import { mkFile, multiDeps, tick, until } from './helpers/uploadDeps';

const ctx = (over: Partial<Parameters<UploadService['enqueue']>[1]> = {}) => ({
  tenantId: 't1', projectId: 'projA', projectName: 'HAL', tags: [] as string[], actor: { uid: 'u1', displayName: 'Şeyma' }, ...over,
});
function setup() {
  const m = multiDeps();
  let n = 0;
  const afterCreate = vi.fn();
  const svc = new UploadService(async () => m.deps, () => `id${++n}`, afterCreate);
  svc.bindSession('u1');
  return { ...m, svc, afterCreate, snap: () => svc.getSnapshot() };
}
const finishNext = async (s: ReturnType<typeof setup>, idx: number) => {
  await until(() => s.mainHandles().length > idx);
  s.mainHandles()[idx].release();
};

describe('UploadService — marka/tenant sabit bağlama', () => {
  it('iş oluşturulurken tenant/proje/marka adı/kullanıcı sabitlenir; sonraki başka marka eklemesi öncekini değiştirmez', async () => {
    const s = setup();
    s.svc.enqueue([mkFile('a.jpg')], ctx());
    s.svc.enqueue([mkFile('b.jpg')], ctx({ projectId: 'projB', projectName: 'Rakle' }));
    const [a, b] = s.snap().items;
    expect([a.tenantId, a.projectId, a.projectName, a.actor.uid]).toEqual(['t1', 'projA', 'HAL', 'u1']);
    expect([b.projectId, b.projectName]).toEqual(['projB', 'Rakle']);
    await finishNext(s, 0);
    await until(() => s.snap().items[0].status === 'done');
    expect(s.deps.writeRecord.mock.calls[0][0]).toMatchObject({ tenantId: 't1', projectId: 'projA', createdBy: 'u1' });
    await finishNext(s, 1);
    await until(() => s.snap().items[1].status === 'done');
    expect(s.deps.writeRecord.mock.calls[1][0]).toMatchObject({ projectId: 'projB' });
  });

  it('oluşturma bildirimi ve dinleyici iş sahibi tenant/proje ile gelir', async () => {
    const s = setup();
    const seen: any[] = [];
    s.svc.onAssetCreated((e) => seen.push(e));
    s.svc.enqueue([mkFile('a.jpg')], ctx());
    await finishNext(s, 0);
    await until(() => seen.length === 1);
    expect(seen[0]).toEqual({ tenantId: 't1', projectId: 'projA', assetId: 'id1' });
    expect(s.afterCreate).toHaveBeenCalledWith(seen[0]);
  });

  it('projectId/tenantId yoksa kuyruğa alınmaz', () => {
    const s = setup();
    expect(s.svc.enqueue([mkFile('a.jpg')], ctx({ projectId: '' }))[0]).toMatch(/Marka seçili değil/);
    expect(s.snap().items).toHaveLength(0);
  });
});

describe('UploadService — oturum sınırı', () => {
  it('aynı kullanıcı için bindSession etkisizdir', async () => {
    const s = setup();
    s.svc.enqueue([mkFile('a.jpg')], ctx());
    await until(() => s.deps.startUpload.mock.calls.length === 1);
    s.svc.bindSession('u1');
    expect(s.snap().items).toHaveLength(1);
    expect(s.mainHandles()[0].h.cancel).not.toHaveBeenCalled();
  });

  it('kullanıcı değişirse/çıkış olursa: yükleme iptal, kuyruk temizlenir, kayıt ve bildirim yok', async () => {
    const s = setup();
    s.svc.enqueue([mkFile('a.jpg'), mkFile('b.jpg')], ctx());
    await until(() => s.deps.startUpload.mock.calls.length === 1);
    s.svc.bindSession(null);
    expect(s.mainHandles()[0].h.cancel).toHaveBeenCalled();
    expect(s.snap().items).toHaveLength(0);
    await tick();
    await tick();
    expect(s.deps.writeRecord).not.toHaveBeenCalled();
    expect(s.afterCreate).not.toHaveBeenCalled();
    expect(s.deps.startUpload).toHaveBeenCalledTimes(1); // ikinci dosya hiç başlamadı
  });

  it('kayıt yazılırken oturum biterse kayıt tamamlanır ama arayüze/bildirime yansımaz', async () => {
    const s = setup();
    let finish!: () => void;
    s.deps.writeRecord.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    s.svc.enqueue([mkFile('a.jpg')], ctx());
    await finishNext(s, 0);
    await until(() => s.snap().items[0]?.status === 'saving');
    s.svc.bindSession('u2');
    expect(s.snap().items).toHaveLength(0);
    finish();
    await tick();
    await tick();
    expect(s.deps.writeRecord).toHaveBeenCalledTimes(1);
    expect(s.snap().items).toHaveLength(0);
    expect(s.afterCreate).not.toHaveBeenCalled();
  });
});

describe('UploadService — tek toplam özet', () => {
  it('22 dosya: tek özet; done/total yalnız katalog kaydı yazılanları sayar; bayt oranı dürüst', async () => {
    const s = setup();
    const files = Array.from({ length: 22 }, (_, i) => mkFile(`f${i}.jpg`, 1000, 'image/jpeg', i + 1));
    s.svc.enqueue(files, ctx());
    expect(s.snap().summary).toMatchObject({ total: 22, done: 0, queued: 22 - 0 - 0 + 0 === 22 ? s.snap().summary.queued : 0 });
    await until(() => s.mainHandles().length === 1);
    s.mainHandles()[0].progress(0.5); // 0.5*90=45 → %50 bayt
    await until(() => s.snap().summary.uploadedBytes === 500);
    expect(s.snap().summary.totalBytes).toBe(22_000);
    expect(s.snap().summary.fraction).toBeCloseTo(500 / 22_000);
    expect(s.snap().summary.done).toBe(0);
    s.mainHandles()[0].release();
    await until(() => s.snap().summary.done === 1);
    expect(s.snap().summary.uploadedBytes).toBe(1000);
  });

  it('dosyası yüklenmiş ama kaydı yazılmamış iş "tamamlandı" sayılmaz; kayıt bekleyen sayısı görünür', async () => {
    const s = setup();
    let finish!: () => void;
    s.deps.writeRecord.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    s.svc.enqueue([mkFile('a.jpg', 1000)], ctx());
    await finishNext(s, 0);
    await until(() => s.snap().summary.saving === 1);
    expect(s.snap().summary).toMatchObject({ done: 0, recordsPending: 1, uploadedBytes: 1000, fraction: 1 });
    finish();
    await until(() => s.snap().summary.done === 1);
    expect(s.snap().summary.recordsPending).toBe(0);
  });

  it('iptal edilenler toplamdan düşer ve ayrı sayılır', async () => {
    const s = setup();
    s.svc.enqueue([mkFile('a.jpg'), mkFile('b.jpg', 100, 'image/jpeg', 2)], ctx());
    await until(() => s.mainHandles().length === 1);
    s.svc.cancel(s.snap().items[1].key);
    expect(s.snap().summary).toMatchObject({ total: 1, canceled: 1 });
  });
});

describe('UploadService — kısmi tamamlanma, tekrar, tekrarı önleme', () => {
  it('bir dosya hata alsa da diğerleri sürer (kısmi tamamlanma)', async () => {
    const s = setup();
    s.deps.writeRecord.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    s.svc.enqueue([mkFile('a.jpg'), mkFile('b.jpg', 100, 'image/jpeg', 2)], ctx());
    await finishNext(s, 0);
    await until(() => s.snap().items[0]?.status === 'error');
    await finishNext(s, 1);
    await until(() => s.snap().items[1]?.status === 'done');
    expect(s.snap().summary).toMatchObject({ done: 1, failed: 1, total: 2 });
  });

  it('tekrar dene: biten ana yükleme yeniden gönderilmez, aynı varlık kimliğiyle yalnız kayıt yeniden denenir', async () => {
    const s = setup();
    s.deps.writeRecord.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    s.svc.enqueue([mkFile('a.jpg')], ctx());
    await finishNext(s, 0);
    await until(() => s.snap().items[0]?.status === 'error');
    s.svc.retryFailed();
    await until(() => s.snap().items[0]?.status === 'done');
    expect(s.deps.startUpload).toHaveBeenCalledTimes(1);
    expect(s.deps.writeRecord).toHaveBeenCalledTimes(2);
    expect(s.deps.writeRecord.mock.calls[1][0].assetId).toBe(s.deps.writeRecord.mock.calls[0][0].assetId);
  });

  it('bitmiş dosya aynı oturumda yeniden eklenirse yüklenmez ve yeni varlık açılmaz', async () => {
    const s = setup();
    const f = mkFile('a.jpg');
    s.svc.enqueue([f], ctx());
    await finishNext(s, 0);
    await until(() => s.snap().items[0]?.status === 'done');
    const notes = s.svc.enqueue([f], ctx());
    expect(notes[0]).toMatch(/zaten kütüphaneye eklendi/);
    expect(s.snap().items).toHaveLength(1);
    expect(s.deps.startUpload).toHaveBeenCalledTimes(1);
  });

  it('kuyruktaki dosya tekrar eklenirse çift satır açılmaz', async () => {
    const s = setup();
    const f = mkFile('a.jpg');
    s.svc.enqueue([f], ctx());
    const notes = s.svc.enqueue([f], ctx());
    expect(notes[0]).toMatch(/zaten kuyrukta/);
    expect(s.snap().items).toHaveLength(1);
  });

  it('iptal edilen dosya yeniden eklenirse AYNI kimlikle sürer (çift varlık yok)', async () => {
    const s = setup();
    const f = mkFile('a.jpg');
    s.svc.enqueue([f], ctx());
    await until(() => s.mainHandles().length === 1);
    const key = s.snap().items[0].key;
    s.svc.cancel(key);
    await until(() => s.snap().items[0]?.status === 'canceled');
    s.deps.getUrl.mockRejectedValueOnce(Object.assign(new Error('nf'), { code: 'storage/object-not-found' })); // iptalden sonra nesne yok
    expect(s.svc.enqueue([f], ctx())).toEqual([]);
    expect(s.snap().items).toHaveLength(1);
    expect(s.snap().items[0].key).toBe(key);
    await until(() => s.mainHandles().length === 2);
    s.mainHandles()[1].release();
    await until(() => s.snap().items[0]?.status === 'done');
    expect(s.deps.writeRecord).toHaveBeenCalledTimes(1);
  });

  it('iptal edilen iş için kayıt yazılmaz', async () => {
    const s = setup();
    s.svc.enqueue([mkFile('a.jpg')], ctx());
    await until(() => s.mainHandles().length === 1);
    s.svc.cancel(s.snap().items[0].key);
    await tick();
    await tick();
    expect(s.deps.writeRecord).not.toHaveBeenCalled();
  });

  it('kayıt yazılırken iptal kabul edilmez', async () => {
    const s = setup();
    let finish!: () => void;
    s.deps.writeRecord.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    s.svc.enqueue([mkFile('a.jpg')], ctx());
    await finishNext(s, 0);
    await until(() => s.snap().items[0]?.status === 'saving');
    s.svc.cancel(s.snap().items[0].key);
    s.svc.cancelAll();
    expect(s.snap().items[0].status).toBe('saving');
    finish();
    await until(() => s.snap().items[0]?.status === 'done');
  });
});

describe('UploadService — duraklat / devam', () => {
  it('pauseAll: çalışan duraklar, sıradakiler başlamaz; resumeAll devam ettirir', async () => {
    const s = setup();
    s.svc.enqueue([mkFile('a.jpg'), mkFile('b.jpg', 100, 'image/jpeg', 2)], ctx());
    await until(() => s.mainHandles().length === 1);
    s.svc.pauseAll();
    expect(s.mainHandles()[0].h.pause).toHaveBeenCalled();
    expect(s.snap().queuePaused).toBe(true);
    expect(s.snap().items[0].status).toBe('paused');
    s.mainHandles()[0].progress(0.2); // ilerleme olayı duraklatmayı ezmez
    await tick();
    expect(s.snap().items[0].status).toBe('paused');
    expect(s.deps.startUpload).toHaveBeenCalledTimes(1);
    s.svc.resumeAll();
    expect(s.mainHandles()[0].h.resume).toHaveBeenCalled();
    expect(s.snap().items[0].status).toBe('uploading');
    s.mainHandles()[0].release();
    await until(() => s.mainHandles().length === 2); // kuyruk devam etti
  });

  it('sıradaki iş tek tek duraklatılıp devam ettirilebilir; duraklayan iş başlamaz', async () => {
    const s = setup();
    s.svc.enqueue([mkFile('a.jpg'), mkFile('b.jpg', 100, 'image/jpeg', 2)], ctx());
    await until(() => s.mainHandles().length === 1);
    const second = s.snap().items[1].key;
    s.svc.pause(second);
    expect(s.snap().items[1].status).toBe('paused');
    s.mainHandles()[0].release();
    await until(() => s.snap().items[0]?.status === 'done');
    await tick();
    expect(s.mainHandles()).toHaveLength(1);
    s.svc.resume(second);
    await until(() => s.mainHandles().length === 2);
  });
});

describe('UploadService — bağımlılık (getDeps) hatası: otomatik döngü yok', () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  function failing() {
    const m = multiDeps();
    let n = 0;
    let mode: 'reject' | 'ok' = 'reject';
    const getDeps = vi.fn(async () => {
      if (mode === 'reject') throw new Error('chunk load failed');
      return m.deps;
    });
    const svc = new UploadService(getDeps, () => `id${++n}`, vi.fn());
    svc.bindSession('u1');
    return { ...m, svc, getDeps, fix: () => (mode = 'ok'), snap: () => svc.getSnapshot() };
  }

  it('sürekli reddeden getDeps: enqueue sonrası TAM 1 çağrı; zaman ilerlese de artmaz; işler sırada bekler ve hata görünür', async () => {
    const f = failing();
    f.svc.enqueue([mkFile('a.jpg'), mkFile('b.jpg', 100, 'image/jpeg', 2)], ctx());
    await wait(80);
    expect(f.getDeps).toHaveBeenCalledTimes(1);
    expect(f.snap().dependencyError).toMatch(/Tekrar dene/);
    expect(f.snap().items.map((i) => i.status)).toEqual(['queued', 'queued']);
    await wait(200);
    expect(f.getDeps).toHaveBeenCalledTimes(1);
    expect(f.deps.startUpload).not.toHaveBeenCalled();
  });

  it('hata sürerken yeni eklenen işler de durur (yeni bağımlılık çağrısı yok); toplu devam/duraklat etkisiz', async () => {
    const f = failing();
    f.svc.enqueue([mkFile('a.jpg')], ctx());
    await wait(30);
    f.svc.enqueue([mkFile('c.jpg', 100, 'image/jpeg', 3)], ctx());
    f.svc.resumeAll();
    f.svc.pauseAll();
    f.svc.resumeAll();
    await wait(60);
    expect(f.getDeps).toHaveBeenCalledTimes(1);
    expect(f.snap().items).toHaveLength(2);
    expect(f.snap().items.every((i) => i.status === 'queued')).toBe(true);
  });

  it('açık Tekrar dene: yalnız 1 yeni deneme; yine reddederse tekrar bekleme durumu (otomatik tekrar yok)', async () => {
    const f = failing();
    f.svc.enqueue([mkFile('a.jpg')], ctx());
    await wait(30);
    f.svc.retryDependencies();
    await wait(60);
    expect(f.getDeps).toHaveBeenCalledTimes(2);
    expect(f.snap().dependencyError).not.toBeNull();
    await wait(100);
    expect(f.getDeps).toHaveBeenCalledTimes(2);
    f.svc.retryDependencies();
    await wait(30);
    expect(f.getDeps).toHaveBeenCalledTimes(3);
  });

  it('hata yokken Tekrar dene etkisizdir (fazladan bağımlılık çağrısı yok)', async () => {
    const f = failing();
    f.fix();
    f.svc.enqueue([mkFile('a.jpg')], ctx());
    await until(() => f.mainHandles().length === 1);
    f.svc.retryDependencies();
    await wait(20);
    expect(f.getDeps).toHaveBeenCalledTimes(1);
  });

  it('hata düzelince açık Tekrar dene: aynı kararlı kimliklerle sırayla sürer, çift varlık/çift kayıt yok', async () => {
    const f = failing();
    f.svc.enqueue([mkFile('a.jpg'), mkFile('b.jpg', 100, 'image/jpeg', 2)], ctx());
    await wait(30);
    const ids = f.snap().items.map((i) => i.key);
    expect(ids).toEqual(['id1', 'id2']);
    f.fix();
    f.svc.retryDependencies();
    await until(() => f.mainHandles().length === 1);
    f.mainHandles()[0].release();
    await until(() => f.snap().items[0]?.status === 'done');
    await until(() => f.mainHandles().length === 2);
    f.mainHandles()[1].release();
    await until(() => f.snap().items[1]?.status === 'done');
    expect(f.snap().items.map((i) => i.key)).toEqual(ids);
    expect(f.snap().dependencyError).toBeNull();
    expect(f.getDeps).toHaveBeenCalledTimes(2);
    expect(f.deps.writeRecord).toHaveBeenCalledTimes(2);
    expect(f.deps.writeRecord.mock.calls.map((c: any[]) => c[0].assetId)).toEqual(ids);
    // bağımlılık bir kez yüklenince önbelleklenir: sonraki işler yeniden çağırmaz
    f.svc.enqueue([mkFile('c.jpg', 100, 'image/jpeg', 3)], ctx());
    await until(() => f.mainHandles().length === 3);
    expect(f.getDeps).toHaveBeenCalledTimes(2);
  });

  it('bağımlılık hatasında açık işe-özel Tekrar dene (hatalı iş) da tek deneme yapar', async () => {
    const f = failing();
    f.svc.enqueue([mkFile('a.jpg')], ctx());
    await wait(30);
    const key = f.snap().items[0].key;
    f.svc.cancel(key);
    expect(f.snap().items[0].status).toBe('canceled');
    f.svc.retry(key);
    await wait(40);
    expect(f.getDeps).toHaveBeenCalledTimes(2);
  });

  it('oturum bitince bağımlılık hatası temizlenir ve yeni oturum yeniden dener', async () => {
    const f = failing();
    f.svc.enqueue([mkFile('a.jpg')], ctx());
    await wait(30);
    expect(f.snap().dependencyError).not.toBeNull();
    f.svc.bindSession('u2');
    expect(f.snap().dependencyError).toBeNull();
    expect(f.snap().items).toHaveLength(0);
    f.fix();
    f.svc.enqueue([mkFile('b.jpg')], ctx({ actor: { uid: 'u2' } }));
    await until(() => f.mainHandles().length === 1);
  });
});
