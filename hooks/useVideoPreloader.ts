import { useEffect, useState } from 'react';

interface VideoPreloadOptions {
  priority?: 'high' | 'low';
  preloadType?: 'auto' | 'metadata' | 'none';
}

export const useVideoPreloader = (videoUrls: string[], options: VideoPreloadOptions = {}) => {
  const [loadedVideos, setLoadedVideos] = useState<Set<string>>(new Set());
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    const { priority = 'low', preloadType = 'metadata' } = options;
    
    // For high priority, preload first 3 videos immediately
    const videosToPreload = priority === 'high' 
      ? videoUrls.slice(0, 3) 
      : videoUrls;

    let loaded = 0;
    const total = videosToPreload.length;

    videosToPreload.forEach((url, index) => {
      // Create a link element for preloading
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = url;
      
      // Add to head with delay for low priority
      if (priority === 'low') {
        setTimeout(() => {
          document.head.appendChild(link);
        }, index * 500); // Stagger loading
      } else {
        document.head.appendChild(link);
      }

      // Create video element to actually load
      const video = document.createElement('video');
      video.preload = preloadType;
      video.src = url;
      
      video.addEventListener('loadedmetadata', () => {
        loaded++;
        setLoadedVideos(prev => new Set(prev).add(url));
        setLoadingProgress((loaded / total) * 100);
      });

      // Start loading after a delay for low priority
      if (priority === 'low') {
        setTimeout(() => {
          video.load();
        }, index * 1000);
      } else {
        video.load();
      }
    });

    return () => {
      // Cleanup preload links
      document.querySelectorAll('link[rel="preload"][as="video"]').forEach(link => {
        link.remove();
      });
    };
  }, [videoUrls, options]);

  return { loadedVideos, loadingProgress };
};