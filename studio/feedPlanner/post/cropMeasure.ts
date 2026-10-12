import type { Aesthetics, Candidate } from '../types';
import type { Box } from '../../../shared/planner/visualDecision';
import { cropWindow } from '../../../shared/planner/visualDecision';
import { POST_RATIO, effectiveCrop, type PostPlan } from './postPlan';

/**
 * NİHAİ 4:5 kırpım görünümünün piksel ölçümü (renk, parlaklık, boş alan, yoğunluk): orijinal tüm-kare ölçümü KOPYALANMAZ.
 * Anahtar: varlık + kaynak kimliği (imageKey) + kaynak boyutu + kırpım penceresi. Kırpım/kaynak değişince anahtar değişir; eski anahtarlı
 * GEÇ yanıt varlığın son istenen anahtarıyla eşleşmiyorsa REDDEDİLİR (kaydedilmez, `staleDropped` artar). Ölçüm yerel pikseldir; model/ağ yok.
 */
export type MeasureCropFn = (url: string, window: Box | null) => Promise<Aesthetics | null>;
export type SrcFn = (c: Candidate) => string | Promise<string>;

const r4 = (n: number) => n.toFixed(4);
export const windowKey = (w: Box | null) => (w ? `${r4(w.x)},${r4(w.y)},${r4(w.w)},${r4(w.h)}` : 'full');
/**
 * Ölçüm anahtarı: kapsam (tenant/proje) + varlık + kaynak yolu + KAYNAK İÇERİK KİMLİĞİ (SHA-256; bilinmiyorsa '?') + kaynak boyutu + pencere.
 * Aynı yolda içerik değişirse (sha farklı) eski piksel ölçümü kullanılmaz. Analiz anahtarı/model/istem alanları anahtarda YOKTUR: kaynak pikselleri
 * değişmediyse bağımsız analiz değişikliği gereksiz yeniden ölçüm başlatmaz.
 */
export const measureKey = (c: Candidate, w: Box | null) =>
  [c.visual?.provenance.tenantId ?? '?', c.brand, c.id, c.imageKey, c.visual?.provenance.sourceSha256 || '?', `${c.dims.w}x${c.dims.h}`, windowKey(w)].join('|');

/** Adayın etkin 4:5 penceresi (kaynak karenin normalize dikdörtgeni) */
export function postWindow(plan: Pick<PostPlan, 'crops'>, c: Candidate): Box {
  const e = effectiveCrop(plan, c);
  return cropWindow(c.dims, POST_RATIO, e.focus, e.zoom);
}

export class CropMeasurer {
  private done = new Map<string, Aesthetics | null>();
  private inflight = new Set<string>();
  private latest = new Map<string, string>();
  private queue: Array<() => void> = [];
  private active = 0;
  staleDropped = 0;
  calls = 0;
  private disposed = false;
  /** scope: tenant|proje. Anahtarlara eklenir; ölçücü kapsam değişince atılır (dispose) ve geç yanıtları yok sayılır. */
  constructor(private measure: MeasureCropFn, private src: SrcFn, private onChange: () => void, private concurrency = 3, private scope = '') {}
  private key(c: Candidate, w: Box | null) {
    return `${this.scope}#${measureKey(c, w)}`;
  }
  /** React StrictMode çift efekt: dispose sonrası aynı örnek yeniden etkinleştirilebilir (yeni örnek için kapsam değişimi dispose + yeni örnek) */
  revive() {
    this.disposed = false;
    this.pump();
  }
  /** Eski kapsam/örnek: kuyruktaki ölçümler BAŞLATILMAZ; uçuştakiler tamamlansa da SONUÇ yazılmaz, onChange çağrılmaz. Kuyruk korunur (StrictMode revive). */
  dispose() {
    this.disposed = true;
  }

  /** undefined = henüz ölçülmedi; null = ölçülemedi; değer = ölçüldü */
  get(c: Candidate, w: Box | null): Aesthetics | null | undefined {
    const k = this.key(c, w);
    return this.done.has(k) ? this.done.get(k) : undefined;
  }
  isCurrent(c: Candidate, w: Box | null) {
    return this.latest.get(c.id) === this.key(c, w);
  }
  pending() {
    return this.inflight.size + this.queue.length;
  }
  request(c: Candidate, w: Box | null): void {
    if (this.disposed) return;
    const k = this.key(c, w);
    this.latest.set(c.id, k);
    if (this.done.has(k) || this.inflight.has(k)) return;
    this.inflight.add(k);
    const run = async () => {
      this.active++;
      this.calls++;
      let m: Aesthetics | null = null;
      try {
        m = await this.measure(await Promise.resolve(this.src(c)), w);
      } catch {
        m = null;
      }
      this.active--;
      this.inflight.delete(k);
      if (this.disposed) return; // eski kapsam: sonuç yazılmaz
      // Geç/eski yanıt: varlığın son istenen anahtarı değiştiyse bu sonuç yeni kırpıma UYGULANMAZ
      if (this.latest.get(c.id) === k) this.done.set(k, m);
      else this.staleDropped++;
      this.onChange();
      this.pump();
    };
    this.queue.push(() => void run());
    this.pump();
  }
  private pump() {
    while (!this.disposed && this.active < this.concurrency && this.queue.length) this.queue.shift()!();
  }
}
