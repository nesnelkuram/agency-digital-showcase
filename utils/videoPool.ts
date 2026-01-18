/**
 * VideoPool - Video element havuzu yönetimi
 *
 * Aynı anda maksimum 6 video elementi kullanarak bellek ve CPU tasarrufu sağlar.
 * Görünür olmayan videolar için statik thumbnail gösterilir.
 */

type VideoPriority = 'selected' | 'visible' | 'preload';

interface PooledVideo {
  element: HTMLVideoElement;
  src: string;
  priority: VideoPriority;
  lastUsed: number;
  isReady: boolean;
}

interface VideoRequest {
  src: string;
  priority: VideoPriority;
  onReady: (video: HTMLVideoElement) => void;
  onRelease: () => void;
}

class VideoPool {
  private pool: PooledVideo[] = [];
  private requests: Map<string, VideoRequest> = new Map();
  private readonly MAX_POOL_SIZE = 6;
  private thumbnailCache: Map<string, string> = new Map(); // video src -> thumbnail data URL

  constructor() {
    // Pre-create video elements
    for (let i = 0; i < this.MAX_POOL_SIZE; i++) {
      this.pool.push({
        element: this.createVideoElement(),
        src: '',
        priority: 'preload',
        lastUsed: 0,
        isReady: false
      });
    }
  }

  private createVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    return video;
  }

  /**
   * Video talep et
   * @returns Video element veya null (havuz dolu ve düşük öncelikli)
   */
  acquire(
    src: string,
    priority: VideoPriority,
    onReady: (video: HTMLVideoElement) => void,
    onRelease: () => void
  ): HTMLVideoElement | null {
    // Zaten bu src için aktif video var mı?
    const existing = this.pool.find(p => p.src === src);
    if (existing) {
      existing.priority = priority;
      existing.lastUsed = performance.now();

      if (existing.isReady) {
        onReady(existing.element);
      }
      return existing.element;
    }

    // Request kaydet
    this.requests.set(src, { src, priority, onReady, onRelease });

    // Boş slot bul
    const freeSlot = this.pool.find(p => !p.src);
    if (freeSlot) {
      return this.assignVideo(freeSlot, src, priority, onReady);
    }

    // Boş slot yok, en düşük öncelikli videoyu bul
    if (priority === 'selected' || priority === 'visible') {
      const victim = this.findEvictionCandidate(priority);
      if (victim) {
        this.releaseVideo(victim);
        return this.assignVideo(victim, src, priority, onReady);
      }
    }

    // Havuz dolu ve yeterli öncelik yok
    return null;
  }

  private assignVideo(
    slot: PooledVideo,
    src: string,
    priority: VideoPriority,
    onReady: (video: HTMLVideoElement) => void
  ): HTMLVideoElement {
    slot.src = src;
    slot.priority = priority;
    slot.lastUsed = performance.now();
    slot.isReady = false;

    const video = slot.element;

    // Video yüklendiğinde callback'i çağır
    const handleCanPlay = () => {
      slot.isReady = true;
      video.removeEventListener('canplaythrough', handleCanPlay);
      onReady(video);

      // Thumbnail oluştur (ilk frame)
      this.captureThumbnail(src, video);
    };

    const handleError = () => {
      console.warn('VideoPool: Failed to load', src);
      video.removeEventListener('error', handleError);
      slot.isReady = false;
    };

    video.addEventListener('canplaythrough', handleCanPlay, { once: true });
    video.addEventListener('error', handleError, { once: true });

    video.src = src;
    video.load();

    return video;
  }

  private findEvictionCandidate(requestPriority: VideoPriority): PooledVideo | null {
    // Priority order: selected > visible > preload
    const priorityOrder: VideoPriority[] = ['preload', 'visible', 'selected'];
    const requestPriorityIndex = priorityOrder.indexOf(requestPriority);

    // En düşük öncelikli ve en eski videoyu bul
    let candidate: PooledVideo | null = null;
    let candidatePriorityIndex = requestPriorityIndex;
    let candidateLastUsed = Infinity;

    for (const pooled of this.pool) {
      if (!pooled.src) continue;

      const pooledPriorityIndex = priorityOrder.indexOf(pooled.priority);

      // Daha düşük öncelikli mi?
      if (pooledPriorityIndex < candidatePriorityIndex) {
        candidate = pooled;
        candidatePriorityIndex = pooledPriorityIndex;
        candidateLastUsed = pooled.lastUsed;
      }
      // Aynı öncelikte ama daha eski mi?
      else if (pooledPriorityIndex === candidatePriorityIndex && pooled.lastUsed < candidateLastUsed) {
        candidate = pooled;
        candidateLastUsed = pooled.lastUsed;
      }
    }

    return candidate;
  }

  private releaseVideo(pooled: PooledVideo): void {
    const request = this.requests.get(pooled.src);
    if (request) {
      request.onRelease();
      this.requests.delete(pooled.src);
    }

    pooled.element.pause();
    pooled.element.src = '';
    pooled.element.load();
    pooled.src = '';
    pooled.isReady = false;
    pooled.priority = 'preload';
  }

  /**
   * Video'yu serbest bırak
   */
  release(src: string): void {
    const pooled = this.pool.find(p => p.src === src);
    if (pooled) {
      this.releaseVideo(pooled);
    }
    this.requests.delete(src);
  }

  /**
   * Thumbnail oluştur (video'nun ilk frame'i)
   */
  private captureThumbnail(src: string, video: HTMLVideoElement): void {
    if (this.thumbnailCache.has(src)) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 320;
      const ctx = canvas.getContext('2d');

      if (ctx && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        this.thumbnailCache.set(src, dataUrl);
      }
    } catch (e) {
      // CORS veya diğer hatalar için sessizce devam et
    }
  }

  /**
   * Video için thumbnail al
   */
  getThumbnail(src: string): string | null {
    return this.thumbnailCache.get(src) || null;
  }

  /**
   * Video aktif mi kontrol et
   */
  isActive(src: string): boolean {
    return this.pool.some(p => p.src === src && p.isReady);
  }

  /**
   * Öncelik güncelle
   */
  updatePriority(src: string, priority: VideoPriority): void {
    const pooled = this.pool.find(p => p.src === src);
    if (pooled) {
      pooled.priority = priority;
      pooled.lastUsed = performance.now();
    }
  }

  /**
   * İstatistikler
   */
  getStats(): { active: number; total: number; cached: number } {
    return {
      active: this.pool.filter(p => p.src).length,
      total: this.MAX_POOL_SIZE,
      cached: this.thumbnailCache.size
    };
  }

  /**
   * Tüm videoları serbest bırak
   */
  releaseAll(): void {
    for (const pooled of this.pool) {
      if (pooled.src) {
        this.releaseVideo(pooled);
      }
    }
    this.requests.clear();
  }

  /**
   * Thumbnail cache'ini temizle
   */
  clearThumbnailCache(): void {
    this.thumbnailCache.clear();
  }
}

// Singleton instance
export const videoPool = new VideoPool();
