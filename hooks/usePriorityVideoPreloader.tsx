import { useEffect, useState } from 'react';
import { videoCache } from '../utils/videoCache';

interface PreloadProgress {
  priorityLoaded: number;
  priorityTotal: number;
  priorityPercentage: number;
  isPriorityComplete: boolean;
  totalLoaded: number;
  total: number;
  totalPercentage: number;
  isAllComplete: boolean;
}

export const usePriorityVideoPreloader = (
  priorityVideos: string[],
  remainingVideos: string[]
): PreloadProgress => {
  const [progress, setProgress] = useState<PreloadProgress>({
    priorityLoaded: 0,
    priorityTotal: priorityVideos.length,
    priorityPercentage: 0,
    isPriorityComplete: false,
    totalLoaded: 0,
    total: priorityVideos.length + remainingVideos.length,
    totalPercentage: 0,
    isAllComplete: false
  });

  useEffect(() => {
    if (!priorityVideos.length) return;

    let mounted = true;

    const updateProgress = () => {
      if (!mounted) return;

      const priorityProgress = videoCache.getProgress(priorityVideos);
      const remainingProgress = videoCache.getProgress(remainingVideos);
      
      const totalLoaded = priorityProgress.loaded + remainingProgress.loaded;
      const total = priorityVideos.length + remainingVideos.length;
      
      setProgress({
        priorityLoaded: priorityProgress.loaded,
        priorityTotal: priorityVideos.length,
        priorityPercentage: priorityProgress.percentage,
        isPriorityComplete: priorityProgress.loaded === priorityVideos.length,
        totalLoaded,
        total,
        totalPercentage: total > 0 ? Math.round((totalLoaded / total) * 100) : 0,
        isAllComplete: totalLoaded === total
      });
    };

    // Subscribe to all video status changes
    const unsubscribers: (() => void)[] = [];
    
    [...priorityVideos, ...remainingVideos].forEach(url => {
      unsubscribers.push(
        videoCache.subscribe(url, () => updateProgress())
      );
    });

    const preloadVideos = async () => {
      console.log(`Starting priority preload of ${priorityVideos.length} videos...`);
      
      // Load priority videos first (smaller batch size for faster initial load)
      await videoCache.preloadBatch(priorityVideos, 2);
      
      console.log(`Priority videos loaded, continuing with remaining ${remainingVideos.length} videos...`);
      
      // Then load remaining videos
      if (remainingVideos.length > 0) {
        await videoCache.preloadBatch(remainingVideos, 4);
      }
      
      console.log('All video preloading complete');
    };

    preloadVideos();

    return () => {
      mounted = false;
      unsubscribers.forEach(unsub => unsub());
    };
  }, [priorityVideos, remainingVideos]);

  return progress;
};