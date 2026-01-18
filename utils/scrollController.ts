/**
 * ScrollController - React state'ten bağımsız scroll yönetimi
 *
 * Scroll olaylarını React re-render'larından ayırarak performansı artırır.
 * Subscriber'lar doğrudan ref güncellemesi yapabilir.
 */

type ScrollCallback = (offset: number, progress: number) => void;

class ScrollController {
  private parallaxOffset = 0;
  private scrollProgress = 0;
  private listeners: Set<ScrollCallback> = new Set();
  private rafId: number | null = null;
  private isInitialized = false;

  // Cached DOM values - sadece resize'da güncellenir
  private cachedHeaderTop = 0;
  private cachedHeaderHeight = 0;
  private cachedViewportHeight = 0;
  private headerElement: HTMLElement | null = null;

  // Throttle settings
  private lastScrollY = 0;
  private lastUpdateTime = 0;
  private readonly THROTTLE_MS = 16; // ~60fps

  // Parallax settings
  private readonly PARALLAX_DURATION_VIEWPORTS = 3.5;
  private readonly MAX_PARALLAX_PERCENT = 120; // Orijinal Header3D değeri

  /**
   * Header element'i ile controller'ı başlat
   */
  init(headerElement: HTMLElement): () => void {
    if (this.isInitialized) {
      this.cleanup();
    }

    this.headerElement = headerElement;
    this.updateCachedValues();
    this.setupEventListeners();
    this.isInitialized = true;

    // Initial calculation
    this.calculateParallax(window.scrollY);

    // Cleanup function döndür
    return () => this.cleanup();
  }

  private updateCachedValues(): void {
    if (this.headerElement) {
      this.cachedHeaderTop = this.headerElement.offsetTop;
      this.cachedHeaderHeight = this.headerElement.offsetHeight;
    }
    this.cachedViewportHeight = window.innerHeight;
  }

  private setupEventListeners(): void {
    // Scroll listener - passive for performance
    window.addEventListener('scroll', this.handleScroll, { passive: true });

    // Resize listener - update cached values
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  private handleScroll = (): void => {
    // Skip if already processing
    if (this.rafId !== null) return;

    // Throttle check
    const now = performance.now();
    if (now - this.lastUpdateTime < this.THROTTLE_MS) return;

    this.rafId = requestAnimationFrame(() => {
      const scrollY = window.scrollY;

      // Only update if scroll position actually changed
      if (Math.abs(scrollY - this.lastScrollY) > 0.5) {
        this.calculateParallax(scrollY);
        this.lastScrollY = scrollY;
        this.lastUpdateTime = performance.now();

        // Notify all subscribers
        this.notifyListeners();
      }

      this.rafId = null;
    });
  };

  private handleResize = (): void => {
    this.updateCachedValues();
    // Recalculate parallax with new dimensions
    this.calculateParallax(window.scrollY);
    this.notifyListeners();
  };

  private calculateParallax(scrollY: number): void {
    const parallaxDuration = this.cachedViewportHeight * this.PARALLAX_DURATION_VIEWPORTS;
    const scrollRelativeToHeader = scrollY - this.cachedHeaderTop;

    // Calculate progress (0 to 1)
    this.scrollProgress = Math.max(0, Math.min(1, scrollRelativeToHeader / parallaxDuration));

    // Calculate parallax offset
    this.parallaxOffset = this.scrollProgress * this.MAX_PARALLAX_PERCENT;
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      callback(this.parallaxOffset, this.scrollProgress);
    });
  }

  /**
   * Scroll değişikliklerini dinle
   * @returns Unsubscribe function
   */
  subscribe(callback: ScrollCallback): () => void {
    this.listeners.add(callback);

    // Immediately call with current values
    callback(this.parallaxOffset, this.scrollProgress);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Mevcut parallax offset değerini al
   */
  getOffset(): number {
    return this.parallaxOffset;
  }

  /**
   * Mevcut scroll progress değerini al (0-1)
   */
  getProgress(): number {
    return this.scrollProgress;
  }

  /**
   * Cleanup - tüm listener'ları kaldır
   */
  cleanup(): void {
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.listeners.clear();
    this.isInitialized = false;
    this.headerElement = null;
  }
}

// Singleton instance
export const scrollController = new ScrollController();
