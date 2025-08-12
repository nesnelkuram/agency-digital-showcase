// Global video cache system
interface VideoCacheEntry {
  url: string;
  blob: Blob | null;
  status: 'pending' | 'loading' | 'loaded' | 'error';
  error?: string;
}

class VideoCache {
  private cache: Map<string, VideoCacheEntry> = new Map();
  private listeners: Map<string, Set<(status: VideoCacheEntry) => void>> = new Map();

  // Get or create cache entry
  getEntry(url: string): VideoCacheEntry {
    if (!this.cache.has(url)) {
      this.cache.set(url, {
        url,
        blob: null,
        status: 'pending'
      });
    }
    return this.cache.get(url)!;
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

  // Preload a video
  async preloadVideo(url: string): Promise<boolean> {
    const entry = this.getEntry(url);
    
    // Already loaded or loading
    if (entry.status === 'loaded') return true;
    if (entry.status === 'loading') {
      // Wait for existing load to complete
      return new Promise((resolve) => {
        const unsubscribe = this.subscribe(url, (status) => {
          if (status.status === 'loaded' || status.status === 'error') {
            unsubscribe();
            resolve(status.status === 'loaded');
          }
        });
      });
    }

    // Start loading
    entry.status = 'loading';
    this.notify(url);

    try {
      // Fetch video as blob
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      
      // Update cache
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

  // Preload multiple videos in batches
  async preloadBatch(urls: string[], batchSize: number = 3): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(url => this.preloadVideo(url).then(success => ({ url, success })))
      );
      
      batchResults.forEach(({ url, success }) => {
        results.set(url, success);
      });
    }
    
    return results;
  }

  // Get blob URL for cached video
  getBlobUrl(url: string): string | null {
    const entry = this.getEntry(url);
    if (entry.status === 'loaded' && entry.blob) {
      return URL.createObjectURL(entry.blob);
    }
    return null;
  }

  // Check if video is ready
  isReady(url: string): boolean {
    return this.getEntry(url).status === 'loaded';
  }

  // Get loading progress
  getProgress(urls: string[]): { loaded: number; total: number; percentage: number } {
    const loaded = urls.filter(url => this.isReady(url)).length;
    const total = urls.length;
    const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
    
    return { loaded, total, percentage };
  }

  // Clear cache
  clear() {
    // Revoke all blob URLs
    this.cache.forEach(entry => {
      if (entry.blob) {
        const blobUrl = URL.createObjectURL(entry.blob);
        URL.revokeObjectURL(blobUrl);
      }
    });
    
    this.cache.clear();
    this.listeners.clear();
  }
}

// Export singleton instance
export const videoCache = new VideoCache();