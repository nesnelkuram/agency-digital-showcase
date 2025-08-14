import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    // Set initial value
    setMatches(media.matches);

    // Create event listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    media.addEventListener('change', listener);

    // Cleanup
    return () => {
      media.removeEventListener('change', listener);
    };
  }, [query]);

  return matches;
};

// Preset breakpoints matching Tailwind CSS
export const useBreakpoint = () => {
  const isMobile = useMediaQuery('(max-width: 639px)'); // < 640px
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)'); // 640px - 1023px
  const isDesktop = useMediaQuery('(min-width: 1024px)'); // >= 1024px
  const isLarge = useMediaQuery('(min-width: 1280px)'); // >= 1280px
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    isLarge,
    isTouch: 'ontouchstart' in window
  };
};