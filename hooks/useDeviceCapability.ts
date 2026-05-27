import { useState, useEffect } from 'react';

export interface DeviceCapability {
  /** Maximum number of videos that should play simultaneously */
  maxConcurrentVideos: number;
  /** User prefers reduced motion */
  reducedMotion: boolean;
  /** Device is classified as low-end */
  lowEnd: boolean;
  /** Tier label for debugging */
  tier: 'high' | 'mid' | 'low' | 'minimal';
}

/**
 * Detects device capability and returns safe concurrency limits.
 *
 * Tiers:
 * - high:    desktop with ≥8 cores, ≥8 GB RAM → 6 videos
 * - mid:     desktop or good mobile              → 4 videos
 * - low:     old mobile / low RAM / slow net      → 2 videos
 * - minimal: prefers-reduced-motion or very weak  → 0 videos (poster only)
 */
export function useDeviceCapability(): DeviceCapability {
  const [capability, setCapability] = useState<DeviceCapability>(() => detect());

  // Listen for reduced-motion changes (user can toggle mid-session)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setCapability(detect());
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return capability;
}

function detect(): DeviceCapability {
  if (typeof window === 'undefined') {
    return { maxConcurrentVideos: 4, reducedMotion: false, lowEnd: false, tier: 'mid' };
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    return { maxConcurrentVideos: 0, reducedMotion: true, lowEnd: false, tier: 'minimal' };
  }

  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory as number | undefined; // Chrome-only
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const viewportSmall = window.innerWidth <= 768;

  // Connection quality
  let slowConnection = false;
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn?.saveData) slowConnection = true;
    if (conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') slowConnection = true;
  }

  // Classify
  if (slowConnection || (memory !== undefined && memory < 4) || cores <= 2) {
    return { maxConcurrentVideos: 2, reducedMotion: false, lowEnd: true, tier: 'low' };
  }

  if (isMobileUA || viewportSmall || cores <= 4) {
    return { maxConcurrentVideos: 4, reducedMotion: false, lowEnd: false, tier: 'mid' };
  }

  if (cores >= 8 && (memory === undefined || memory >= 8)) {
    return { maxConcurrentVideos: 6, reducedMotion: false, lowEnd: false, tier: 'high' };
  }

  return { maxConcurrentVideos: 4, reducedMotion: false, lowEnd: false, tier: 'mid' };
}
