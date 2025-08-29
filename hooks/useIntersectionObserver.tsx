import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const {
    threshold = 0,
    root = null,
    rootMargin = '0px',
    freezeOnceVisible = false,
  } = options;

  const elementRef = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const frozen = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || frozen.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting;
        setIsIntersecting(isElementIntersecting);

        // Freeze once visible if requested
        if (isElementIntersecting && freezeOnceVisible) {
          frozen.current = true;
        }
      },
      {
        threshold,
        root,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin, freezeOnceVisible]);

  return [elementRef, isIntersecting];
}

// Hook for video element intersection
export function useVideoIntersectionObserver(
  videoRef: React.RefObject<HTMLVideoElement>,
  options: UseIntersectionObserverOptions = {}
): boolean {
  const {
    threshold = 0.1,
    root = null,
    rootMargin = '50px',
  } = options;

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVideoVisible = entry.isIntersecting;
        setIsVisible(isVideoVisible);
        
        // Auto play/pause based on visibility
        if (video) {
          if (isVideoVisible) {
            // Play when visible
            video.play().catch(() => {
              // Silently handle autoplay restrictions
            });
          } else {
            // Pause when not visible to save resources
            video.pause();
          }
        }
      },
      {
        threshold,
        root,
        rootMargin,
      }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, [videoRef, threshold, root, rootMargin]);

  return isVisible;
}