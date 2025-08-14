import { useEffect, useRef } from 'react';
import { videoCache } from '../utils/videoCache';

interface UseViewportVideoLoaderProps {
  videoSrc: string;
  isNearCamera?: boolean;
  threshold?: number;
}

export const useViewportVideoLoader = ({ 
  videoSrc, 
  isNearCamera = true,
  threshold = 0.1 
}: UseViewportVideoLoaderProps) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!videoSrc || !isNearCamera || hasLoadedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !hasLoadedRef.current) {
            hasLoadedRef.current = true;
            videoCache.preloadVideo(videoSrc);
            observer.disconnect();
          }
        });
      },
      { threshold }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [videoSrc, isNearCamera, threshold]);

  return elementRef;
};