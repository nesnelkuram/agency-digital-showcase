/**
 * RenderController - Three.js render optimizasyonu
 *
 * Gereksiz invalidate() çağrılarını önleyerek GPU yükünü azaltır.
 * Sadece gerçekten animasyon olduğunda render tetiklenir.
 */

type RenderReason = 'entrance' | 'scroll' | 'selection' | 'hover' | 'fall';

interface ActiveAnimation {
  reason: RenderReason;
  startTime: number;
  duration: number;
}

class RenderController {
  private activeAnimations: Map<string, ActiveAnimation> = new Map();
  private needsRender = false;
  private lastRenderTime = 0;
  private invalidateCallback: (() => void) | null = null;

  // Minimum time between renders (ms)
  private readonly MIN_RENDER_INTERVAL = 16; // ~60fps max

  // Animation durations by type (ms)
  private readonly ANIMATION_DURATIONS: Record<RenderReason, number> = {
    entrance: 2000,
    scroll: 100,
    selection: 1000,
    hover: 300,
    fall: 1500
  };

  /**
   * invalidate callback'ini kaydet (Three.js Canvas'tan gelir)
   */
  setInvalidateCallback(callback: () => void): void {
    this.invalidateCallback = callback;
  }

  /**
   * Bir animasyon başlat
   * @param id Unique identifier (örn: phone-0, phone-1)
   * @param reason Animasyon tipi
   */
  startAnimation(id: string, reason: RenderReason): void {
    const duration = this.ANIMATION_DURATIONS[reason];

    this.activeAnimations.set(id, {
      reason,
      startTime: performance.now(),
      duration
    });

    this.needsRender = true;
  }

  /**
   * Bir animasyonu durdur
   */
  stopAnimation(id: string): void {
    this.activeAnimations.delete(id);

    // Başka aktif animasyon yoksa render'ı durdur
    if (this.activeAnimations.size === 0) {
      this.needsRender = false;
    }
  }

  /**
   * Tüm scroll animasyonlarını güncelle (her scroll event'inde çağrılır)
   */
  updateScrollAnimations(): void {
    const now = performance.now();

    // Tüm scroll animasyonlarını yenile
    this.activeAnimations.forEach((anim, id) => {
      if (anim.reason === 'scroll') {
        anim.startTime = now;
      }
    });

    this.needsRender = true;
  }

  /**
   * Frame'de render gerekli mi kontrol et
   * useFrame içinde çağrılır
   */
  shouldRender(): boolean {
    if (!this.needsRender) return false;

    const now = performance.now();

    // Throttle renders
    if (now - this.lastRenderTime < this.MIN_RENDER_INTERVAL) {
      return false;
    }

    // Check if any animations are still active
    let hasActiveAnimation = false;

    this.activeAnimations.forEach((anim, id) => {
      const elapsed = now - anim.startTime;

      if (elapsed < anim.duration) {
        hasActiveAnimation = true;
      } else {
        // Animation finished, remove it
        this.activeAnimations.delete(id);
      }
    });

    if (!hasActiveAnimation) {
      this.needsRender = false;
      return false;
    }

    this.lastRenderTime = now;
    return true;
  }

  /**
   * Manuel olarak tek bir render tetikle
   */
  requestRender(): void {
    if (this.invalidateCallback) {
      this.invalidateCallback();
    }
  }

  /**
   * Aktif animasyon sayısını al
   */
  getActiveCount(): number {
    return this.activeAnimations.size;
  }

  /**
   * Debug: aktif animasyonları listele
   */
  getActiveAnimations(): string[] {
    return Array.from(this.activeAnimations.keys());
  }

  /**
   * Tüm animasyonları temizle
   */
  clear(): void {
    this.activeAnimations.clear();
    this.needsRender = false;
  }
}

// Singleton instance
export const renderController = new RenderController();
