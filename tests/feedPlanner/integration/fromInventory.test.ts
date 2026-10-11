import { describe, it, expect } from 'vitest';
import { candidateFromInventory, type InventoryDTO } from '@/studio/feedPlanner/integration/fromInventory';

const readiness = { static: 'ok', carousel: 'ok', story: 'ok', reels: 'error' } as any;
const dto = (o: Partial<InventoryDTO> = {}): InventoryDTO => ({
  id: 'm1', kind: 'photo', width: 3697, height: 5546, path: 'brand-media/t/p/m1/m1.jpg', thumbPath: 'brand-media/t/p/m1/thumb.jpg', catalog: null,
  verifiedProductIds: [], usage: { usedInPostCount: 2, approvedUseCount: 1, pendingUseCount: 1 }, readiness, ...o,
});

describe('sunucu envanter kaydı → planlayıcı adayı', () => {
  it('kapsam projectId; Storage yolu (önizleme öncelikli) imageKey olur; sunucu doğruladığı için storageVerified; kullanım ve hazırlık sunucudan', () => {
    const r = candidateFromInventory(dto(), { projectId: 'p1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidate).toMatchObject({
      id: 'm1', brand: 'p1', kind: 'photo', origin: 'studio', published: false, imageKey: 'brand-media/t/p/m1/thumb.jpg',
      dims: { w: 3697, h: 5546 }, dimsSource: 'kaynak', storageVerified: true, readiness, productId: null,
      usage: { usedInPostCount: 2, approvedUseCount: 1, pendingUseCount: 1 },
    });
    expect(r.candidate.provenance).toMatch(/Studio kütüphanesi · brand_media\/m1 · katalog yok/);
  });

  it('önizleme yoksa ana dosya; video → video kapağı; doğrulanmış ürün kimliği ilk değerden gelir', () => {
    const r = candidateFromInventory(dto({ thumbPath: null, kind: 'video', verifiedProductIds: ['the-ghosting', 'x'] }), { projectId: 'p1' });
    expect(r.ok && r.candidate).toMatchObject({ imageKey: 'brand-media/t/p/m1/m1.jpg', kind: 'video_cover', productId: 'the-ghosting' });
  });

  it('katalog varsa anlamsal alan "katalog" kaynaklı; yoksa "bilinmiyor" (uydurma yok)', () => {
    const none = candidateFromInventory(dto(), { projectId: 'p1' });
    expect(none.ok && none.candidate.semantic).toEqual({ shotScale: 'bilinmiyor', subjectPos: 'bilinmiyor', source: 'bilinmiyor' });
    expect(none.ok && none.candidate.humanPresence).toBe('bilinmiyor');
    const cat = { subject: 'Pizza', description: '', tags: [], foodCategories: ['Pizza'], visibleObjects: [], uncertainties: [], shotType: 'yakın_çekim', subjectPlacement: 'sağ', negativeSpace: false, peoplePresent: true } as any;
    const r = candidateFromInventory(dto({ catalog: cat }), { projectId: 'p1' });
    expect(r.ok && r.candidate).toMatchObject({ group: 'pizza', note: 'Pizza', humanPresence: 'evet', semantic: { shotScale: 'yakın', subjectPos: 'sağ', source: 'katalog' } });
  });

  it('geçersiz boyut (null, 0, NaN, negatif) aday OLMAZ ve nedeni döner', () => {
    for (const [w, h] of [[null, 100], [100, null], [0, 100], [100, -1], [NaN, 5], [Infinity, 5]] as const) {
      expect(candidateFromInventory(dto({ width: w as any, height: h as any }), { projectId: 'p1' })).toEqual({ ok: false, reason: 'dimensions_invalid' });
    }
  });
});
