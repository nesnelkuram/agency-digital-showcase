import { useState, useEffect, useCallback } from 'react';

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

// Consolidated breakpoint hook — single state object, single effect, 1 re-render instead of 4
interface BreakpointState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLarge: boolean;
  isTouch: boolean;
}

const queries = {
  isMobile: '(max-width: 639px)',
  isTablet: '(min-width: 640px) and (max-width: 1023px)',
  isDesktop: '(min-width: 1024px)',
  isLarge: '(min-width: 1280px)',
} as const;

function getBreakpointState(): BreakpointState {
  return {
    isMobile: window.matchMedia(queries.isMobile).matches,
    isTablet: window.matchMedia(queries.isTablet).matches,
    isDesktop: window.matchMedia(queries.isDesktop).matches,
    isLarge: window.matchMedia(queries.isLarge).matches,
    isTouch: 'ontouchstart' in window,
  };
}

export const useBreakpoint = (): BreakpointState => {
  const [state, setState] = useState<BreakpointState>(getBreakpointState);

  useEffect(() => {
    const mqls = Object.values(queries).map(q => window.matchMedia(q));

    const handler = () => {
      setState(getBreakpointState());
    };

    mqls.forEach(mql => mql.addEventListener('change', handler));

    return () => {
      mqls.forEach(mql => mql.removeEventListener('change', handler));
    };
  }, []);

  return state;
};
