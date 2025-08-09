import { useEffect, useState, useRef } from 'react';

interface UseInViewportOptions {
  threshold?: number;
  rootMargin?: string;
}

export const useInViewport = (options: UseInViewportOptions = {}) => {
  const [isInViewport, setIsInViewport] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '0px',
      }
    );

    const element = ref.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [options.threshold, options.rootMargin]);

  return { ref, isInViewport };
};