// Global video cache system
interface VideoCacheEntry {
  url: string;
  blob: Blob | null;
  status: 'pending' | 'loading' | 'loaded' | 'error' | 'streaming' | 'hybrid-streaming' | 'hybrid-cached';
  error?: string;
  isFullVideo?: boolean;
  videoElement?: HTMLVideoElement;
  hybridMode?: boolean; // For preview videos using hybrid approach
}

class VideoCache {
  private cache: Map<string, VideoCacheEntry> = new Map();
  private listeners: Map<string, Set<(status: VideoCacheEntry) => void>> = new Map();
  private batchSize: number = 3; // Dynamic batch size based on connection

  // Get or create cache entry
  getEntry(url: string): VideoCacheEntry {
    if (!this.cache.has(url)) {
      const isFullVideo = url.includes('/full/');
      this.cache.set(url, {
        url,
        blob: null,
        status: 'pending',
        isFullVideo
      });
    }
    return this.cache.get(url)!;
  }
  
  // Detect connection speed and device type to adjust batch size
  private async detectConnectionSpeed(): Promise<void> {
    // Check if mobile or tablet
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isTablet = /iPad|Android.*Tablet/i.test(navigator.userAgent);
    
    if ('connection' in navigator && (navigator as any).connection) {
      const connection = (navigator as any).connection;
      const effectiveType = connection.effectiveType;
      
      // MORE CONSERVATIVE batch sizes to ensure videos fully load
      if (isMobile && !isTablet) {
        // Mobile devices: very conservative for smooth loading
        switch(effectiveType) {
          case 'slow-2g':
          case '2g':
          case '3g':
            this.batchSize = 1; // Always 1 for mobile on slower connections
            break;
          case '4g':
          default:
            this.batchSize = 1; // Reduced to 1 for guaranteed smooth loading
            break;
        }
      } else if (isTablet) {
        // Tablets: still conservative
        switch(effectiveType) {
          case 'slow-2g':
          case '2g':
            this.batchSize = 1;
            break;
          case '3g':
            this.batchSize = 1; // Reduced from 2
            break;
          case '4g':
          default:
            this.batchSize = 2; // Reduced from 3
            break;
        }
      } else {
        // Desktop: moderate loading
        switch(effectiveType) {
          case 'slow-2g':
          case '2g':
            this.batchSize = 1;
            break;
          case '3g':
            this.batchSize = 2;
            break;
          case '4g':
          default:
            this.batchSize = 2; // Reduced from 3 for better guarantee
            break;
        }
      }
      
      console.log(`[VideoCache] Device: ${isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}, Connection: ${effectiveType}, batch size: ${this.batchSize}`);
    } else {
      // Fallback based on device only - MORE CONSERVATIVE
      if (isMobile && !isTablet) {
        this.batchSize = 1; // Reduced from 2
      } else if (isTablet) {
        this.batchSize = 2; // Reduced from 3
      } else {
        this.batchSize = 2; // Reduced from 3
      }
      console.log(`[VideoCache] Device: ${isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}, batch size: ${this.batchSize} (no connection API)`);
    }
  }

  // Subscribe to video status changes
  subscribe(url: string, callback: (status: VideoCacheEntry) => void): () => void {
    if (!this.listeners.has(url)) {
      this.listeners.set(url, new Set());
    }
    this.listeners.get(url)!.add(callback);

    // Immediately call with current status
    callback(this.getEntry(url));

    // Return unsubscribe function
    return () => {
      this.listeners.get(url)?.delete(callback);
    };
  }

  // Notify listeners of status change
  private notify(url: string) {
    const entry = this.getEntry(url);
    this.listeners.get(url)?.forEach(callback => callback(entry));
  }

  // Preload a video - streaming for full videos, hybrid for previews
  async preloadVideo(url: string, forceHybrid: boolean = true): Promise<boolean> {
    const entry = this.getEntry(url);
    
    // Already loaded or loading
    if (entry.status === 'loaded' || entry.status === 'streaming' || 
        entry.status === 'hybrid-streaming' || entry.status === 'hybrid-cached') return true;
    if (entry.status === 'loading') {
      // Wait for existing load to complete
      return new Promise((resolve) => {
        const unsubscribe = this.subscribe(url, (status) => {
          if (status.status === 'loaded' || status.status === 'streaming' || 
              status.status === 'hybrid-streaming' || status.status === 'hybrid-cached' || 
              status.status === 'error') {
            unsubscribe();
            resolve(status.status !== 'error');
          }
        });
      });
    }

    // Full videos use pure streaming
    if (entry.isFullVideo) {
      return this.setupStreaming(url);
    }

    // Preview videos use hybrid approach (streaming first, then cache)
    if (forceHybrid && !entry.isFullVideo) {
      return this.setupHybridLoading(url);
    }

    // Fallback to blob caching
    return this.loadAsBlob(url);
  }
  
  // Load video as blob (original approach)
  private async loadAsBlob(url: string): Promise<boolean> {
    const entry = this.getEntry(url);
    entry.status = 'loading';
    this.notify(url);

    try {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      
      entry.blob = blob;
      entry.status = 'loaded';
      this.notify(url);
      
      console.log(`✓ Cached: ${url.substring(url.lastIndexOf('/') + 1)}`);
      return true;
    } catch (error) {
      entry.status = 'error';
      entry.error = error instanceof Error ? error.message : 'Unknown error';
      this.notify(url);
      
      console.error(`✗ Failed to cache: ${url.substring(url.lastIndexOf('/') + 1)}`, error);
      return false;
    }
  }
  
  // Progressive playback: resolve as soon as the browser says it can start
  // playing (canplay = readyState ≥ 3 = a few seconds of buffer). The rest
  // of the video downloads in the background while it's already on screen —
  // same model YouTube/Vimeo use. No need to wait for full download or % buffer.
  private async setupHybridLoading(url: string): Promise<boolean> {
    const entry = this.getEntry(url);
    entry.hybridMode = true;
    entry.status = 'loading';
    this.notify(url);

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.autoplay = true; // iOS Safari needs this for canplay/loadeddata to fire
      video.crossOrigin = 'anonymous';
      entry.videoElement = video;

      let resolved = false;
      let retryCount = 0;
      const MAX_RETRIES = 3;
      const fileName = url.substring(url.lastIndexOf('/') + 1);

      const success = (via: string) => {
        if (resolved) return;
        resolved = true;
        entry.status = 'hybrid-streaming';
        this.notify(url);
        console.log(`⚡ Playable: ${fileName} (via=${via}, readyState=${video.readyState})`);
        resolve(true);
      };

      const onError = () => {
        if (resolved) return;
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = 1500 * retryCount;
          console.warn(`⚠️ [VideoCache] Retry ${retryCount}/${MAX_RETRIES} for ${fileName} in ${delay}ms`);
          setTimeout(() => { if (!resolved) video.load(); }, delay);
          return;
        }
        resolved = true;
        entry.status = 'error';
        entry.error = 'Failed to load video';
        this.notify(url);
        console.error(`❌ Failed after ${MAX_RETRIES} retries: ${fileName}`);
        resolve(false);
      };

      // loadeddata = readyState 2 = first frame decoded; fires earlier than canplay
      // on iOS Safari where autoplay restrictions delay canplay. Whichever fires
      // first wins (`success` is idempotent via the `resolved` guard).
      video.addEventListener('loadeddata', () => success('loadeddata'), { once: true });
      video.addEventListener('canplay', () => success('canplay'), { once: true });
      video.addEventListener('error', onError);

      // Fail-safe: if events never fire, accept any first-frame data (readyState 2)
      // after 8s, otherwise treat as error. Retries above handle real failures first.
      setTimeout(() => {
        if (resolved) return;
        if (video.readyState >= 2) {
          success('timeout-with-data');
        } else {
          onError();
        }
      }, 8000);

      video.src = url;
      video.load();
    });
  }

  // Setup streaming for full videos
  private async setupStreaming(url: string): Promise<boolean> {
    const entry = this.getEntry(url);
    
    entry.status = 'loading';
    this.notify(url);

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.autoplay = true;
      video.crossOrigin = 'anonymous';
      entry.videoElement = video;

      let resolved = false;
      let retryCount = 0;
      const MAX_RETRIES = 3;
      const fileName = url.substring(url.lastIndexOf('/') + 1);

      const success = (via: string) => {
        if (resolved) return;
        resolved = true;
        entry.status = 'streaming';
        this.notify(url);
        console.log(`⚡ Full playable: ${fileName} (via=${via}, readyState=${video.readyState})`);
        resolve(true);
      };

      const onError = () => {
        if (resolved) return;
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = 2000 * retryCount;
          console.warn(`⚠️ [VideoCache] Retry ${retryCount}/${MAX_RETRIES} (full) for ${fileName} in ${delay}ms`);
          setTimeout(() => { if (!resolved) video.load(); }, delay);
          return;
        }
        resolved = true;
        entry.status = 'error';
        entry.error = 'Failed to load video';
        this.notify(url);
        console.error(`❌ Full failed after ${MAX_RETRIES} retries: ${fileName}`);
        resolve(false);
      };

      video.addEventListener('loadeddata', () => success('loadeddata'), { once: true });
      video.addEventListener('canplay', () => success('canplay'), { once: true });
      video.addEventListener('error', onError);

      setTimeout(() => {
        if (resolved) return;
        if (video.readyState >= 2) {
          success('timeout-with-data');
        } else {
          onError();
        }
      }, 12000);

      video.src = url;
      video.load();
    });
  }

  // Preload multiple videos in batches with dynamic sizing
  async preloadBatch(urls: string[], customBatchSize?: number): Promise<Map<string, boolean>> {
    // Detect connection speed first
    await this.detectConnectionSpeed();
    
    const results = new Map<string, boolean>();
    const effectiveBatchSize = customBatchSize || this.batchSize;
    
    // Separate preview and full videos
    const previewVideos = urls.filter(url => !url.includes('/full/'));
    const fullVideos = urls.filter(url => url.includes('/full/'));
    
    // Load preview videos first (smaller, faster)
    for (let i = 0; i < previewVideos.length; i += effectiveBatchSize) {
      const batch = previewVideos.slice(i, i + effectiveBatchSize);
      const batchResults = await Promise.all(
        batch.map(url => this.preloadVideo(url).then(success => ({ url, success })))
      );
      
      batchResults.forEach(({ url, success }) => {
        results.set(url, success);
      });
    }
    
    // Then load full videos with smaller batch size
    const fullVideoBatchSize = Math.max(1, Math.floor(effectiveBatchSize / 2));
    for (let i = 0; i < fullVideos.length; i += fullVideoBatchSize) {
      const batch = fullVideos.slice(i, i + fullVideoBatchSize);
      const batchResults = await Promise.all(
        batch.map(url => this.preloadVideo(url).then(success => ({ url, success })))
      );
      
      batchResults.forEach(({ url, success }) => {
        results.set(url, success);
      });
    }
    
    return results;
  }

  // Track created blob URLs for cleanup
  private blobUrls: Map<string, string> = new Map();
  
  // Get blob URL for cached video (reuses existing URL if already created)
  getBlobUrl(url: string): string | null {
    const entry = this.getEntry(url);
    if (entry.status === 'loaded' && entry.blob) {
      // Reuse existing blob URL if already created
      if (this.blobUrls.has(url)) {
        return this.blobUrls.get(url)!;
      }
      // Create new blob URL and track it
      const blobUrl = URL.createObjectURL(entry.blob);
      this.blobUrls.set(url, blobUrl);
      return blobUrl;
    }
    return null;
  }

  // Check if video is ready with optional strict mode
  isReady(url: string, strict: boolean = false): boolean {
    const entry = this.getEntry(url);
    const status = entry.status;
    
    // Basic ready check
    const basicReady = status === 'loaded' || status === 'streaming' || 
                       status === 'hybrid-streaming' || status === 'hybrid-cached';
    
    if (!strict) return basicReady;
    
    // Strict mode: also check video element readiness
    if (basicReady && entry.videoElement) {
      const video = entry.videoElement;
      // For preview videos, require readyState 4 (can play through)
      // For full videos, readyState 3 is acceptable (can play)
      const requiredState = entry.isFullVideo ? 3 : 4;
      return video.readyState >= requiredState;
    }
    
    return basicReady;
  }
  
  // Get hybrid mode status
  getHybridStatus(url: string): 'streaming' | 'cached' | 'none' {
    const entry = this.getEntry(url);
    if (entry.status === 'hybrid-streaming') return 'streaming';
    if (entry.status === 'hybrid-cached') return 'cached';
    return 'none';
  }

  // Get loading progress with optional strict mode
  getProgress(urls: string[], strict: boolean = false): { loaded: number; total: number; percentage: number; details?: string[] } {
    const loaded = urls.filter(url => this.isReady(url, strict)).length;
    const total = urls.length;
    const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
    
    // Add detailed status for debugging
    const details = urls.map(url => {
      const entry = this.getEntry(url);
      const ready = this.isReady(url, strict);
      return `${url.substring(url.lastIndexOf('/') + 1)}: ${entry.status} (ready: ${ready})`;
    });
    
    return { loaded, total, percentage, details };
  }

  // Clear cache
  clear() {
    // Revoke all tracked blob URLs
    this.blobUrls.forEach(blobUrl => {
      URL.revokeObjectURL(blobUrl);
    });
    this.blobUrls.clear();
    
    this.cache.clear();
    this.listeners.clear();
  }
  
  // Clean up specific video
  cleanupVideo(url: string) {
    // Revoke blob URL if exists
    const blobUrl = this.blobUrls.get(url);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      this.blobUrls.delete(url);
    }

    this.cache.delete(url);
    this.listeners.delete(url);
  }

  // Revoke blob URL without removing from cache (for memory optimization)
  revokeBlobUrl(url: string) {
    const blobUrl = this.blobUrls.get(url);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      this.blobUrls.delete(url);
    }
  }
}

// Export singleton instance
export const videoCache = new VideoCache();