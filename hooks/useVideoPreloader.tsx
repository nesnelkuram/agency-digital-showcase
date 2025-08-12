import { useEffect, useState } from 'react';

interface PreloadProgress {
  loaded: number;
  total: number;
  percentage: number;
  isComplete: boolean;
}

export const useVideoPreloader = (videoUrls: string[]): PreloadProgress => {
  const [loadedCount, setLoadedCount] = useState(0);
  const [failedVideos, setFailedVideos] = useState<string[]>([]);

  useEffect(() => {
    if (!videoUrls.length) return;

    const preloadVideo = async (url: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = url;
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        
        // Don't set crossOrigin for Blob URLs
        if (!url.includes('blob.vercel-storage.com')) {
          video.crossOrigin = 'anonymous';
        }

        const handleLoad = () => {
          console.log(`✓ Preloaded: ${url.substring(url.lastIndexOf('/') + 1)}`);
          video.remove();
          resolve(true);
        };

        const handleError = () => {
          console.warn(`✗ Failed to preload: ${url.substring(url.lastIndexOf('/') + 1)}`);
          video.remove();
          resolve(false);
        };

        video.addEventListener('loadeddata', handleLoad);
        video.addEventListener('error', handleError);
        
        // Start loading
        video.load();
        
        // Timeout after 10 seconds
        setTimeout(() => {
          video.removeEventListener('loadeddata', handleLoad);
          video.removeEventListener('error', handleError);
          video.remove();
          resolve(false);
        }, 10000);
      });
    };

    const preloadAllVideos = async () => {
      console.log(`Starting preload of ${videoUrls.length} videos...`);
      
      // Preload in batches to avoid overwhelming the browser
      const batchSize = 3;
      let loaded = 0;
      const failed: string[] = [];
      
      for (let i = 0; i < videoUrls.length; i += batchSize) {
        const batch = videoUrls.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(preloadVideo));
        
        results.forEach((success, index) => {
          if (success) {
            loaded++;
          } else {
            failed.push(batch[index]);
          }
        });
        
        setLoadedCount(loaded);
        setFailedVideos(failed);
      }
      
      console.log(`Preload complete: ${loaded}/${videoUrls.length} videos loaded`);
      if (failed.length > 0) {
        console.warn('Failed videos:', failed);
      }
    };

    preloadAllVideos();
  }, [videoUrls]);

  const total = videoUrls.length;
  const percentage = total > 0 ? Math.round((loadedCount / total) * 100) : 0;
  const isComplete = loadedCount === total || (loadedCount + failedVideos.length) === total;

  return {
    loaded: loadedCount,
    total,
    percentage,
    isComplete
  };
};