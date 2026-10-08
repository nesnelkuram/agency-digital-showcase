import { describe, it, expect } from 'vitest';
import { checkInstagramReadiness } from '@/shared/social/instagramReadiness';

const img = (o: Record<string, unknown> = {}) => ({ type: 'image' as const, mimeType: 'image/jpeg', size: 2_000_000, width: 1080, height: 1350, ...o });
const vid = (o: Record<string, unknown> = {}) => ({ type: 'video' as const, mimeType: 'video/mp4', size: 50_000_000, width: 1080, height: 1920, duration: 30, ...o });

describe('Instagram ön kontrolü', () => {
  it('uygun JPEG tekli gönderi hazır', () => {
    expect(checkInstagramReadiness('static', [img()])).toEqual({ status: 'ready', issues: [] });
  });

  it('video hiçbir zaman "hazır" değildir: codec/FPS ölçülemez', () => {
    const r = checkInstagramReadiness('reels', [vid()]);
    expect(r.status).toBe('partial');
    expect(r.issues.some((i) => i.level === 'unverified' && /codec/.test(i.message))).toBe(true);
  });

  it('bilinmeyen video metadata\'sı uygun sayılmaz', () => {
    const r = checkInstagramReadiness('reels', [vid({ duration: undefined, width: undefined, height: undefined })]);
    expect(r.status).not.toBe('ready');
    expect(r.issues.filter((i) => i.level === 'unverified').map((i) => i.message).join(' ')).toMatch(/süresi bilinmiyor/);
  });

  it('Reels sınırları: 3 sn–15 dk, 300 MB (ondalık)', () => {
    expect(checkInstagramReadiness('reels', [vid({ duration: 2 })]).status).toBe('issues');
    expect(checkInstagramReadiness('reels', [vid({ duration: 901 })]).status).toBe('issues');
    expect(checkInstagramReadiness('reels', [vid({ size: 300_000_001 })]).status).toBe('issues');
    expect(checkInstagramReadiness('reels', [vid({ size: 300_000_000 })]).status).toBe('partial');
  });

  it('panel sınırı içindeki 900 MB video Reels için uyarı alır (1 GB Instagram sınırı değildir)', () => {
    const r = checkInstagramReadiness('reels', [vid({ size: 900_000_000 })]);
    expect(r.issues.some((i) => i.level === 'error' && /300 MB/.test(i.message))).toBe(true);
  });

  it('akış görseli: JPEG dışı uyarı, 4:5–1,91:1 dışı hata, 8 MB üstü hata', () => {
    expect(checkInstagramReadiness('static', [img({ mimeType: 'image/png' })]).issues[0].level).toBe('warning');
    expect(checkInstagramReadiness('static', [img({ width: 1080, height: 1920 })]).status).toBe('issues');
    expect(checkInstagramReadiness('static', [img({ size: 8_000_001 })]).status).toBe('issues');
  });

  it('carousel: en fazla 10 öğe; içindeki video doğrulanamadı olarak işaretlenir', () => {
    expect(checkInstagramReadiness('carousel', Array.from({ length: 11 }, () => img())).status).toBe('issues');
    const r = checkInstagramReadiness('carousel', [img(), vid()]);
    expect(r.status).toBe('partial');
    expect(r.issues[0].message).toMatch(/doğrulanamadı/);
  });

  it('hikâye videosu 60 sn ve 100 MB ile sınırlı', () => {
    expect(checkInstagramReadiness('story', [vid({ duration: 61 })]).status).toBe('issues');
    expect(checkInstagramReadiness('story', [vid({ size: 100_000_001 })]).status).toBe('issues');
  });

  it('tür–medya uyuşmazlığı ve medyasız gönderi', () => {
    expect(checkInstagramReadiness('static', [vid()]).status).toBe('issues');
    expect(checkInstagramReadiness('reels', [img()]).status).toBe('issues');
    expect(checkInstagramReadiness('static', []).status).toBe('issues');
    expect(checkInstagramReadiness('text', []).status).toBe('issues');
  });
});
