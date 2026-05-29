import { MediaContent } from '../types';
import { getVideosByCategory } from '../videoUtils';

/**
 * Picks the videos that will populate the initial phone grid.
 *
 * Used as the single source of truth by both:
 *  - HomePage (App.tsx) — to know which preview URLs to preload before reveal
 *  - Header3D — to render the phones for the 'all' category on first mount
 *
 * Mirrors the random sampling Header3D used to do inline (one video per
 * Fashion/Commercial/Gastronomy/Interview, shuffled, sliced to totalPhones).
 */
export function selectInitialVideos(
  totalPhones: number,
  extraPool: MediaContent[] = [],
): MediaContent[] {
  // Admin-added videos (extraPool) are merged into the candidate pool so they
  // can be sampled alongside the static catalogue. Empty pool → original behaviour.
  const allVideos = [...extraPool, ...getVideosByCategory('all')];
  const categories = ['Fashion', 'Commercial', 'Gastronomy', 'Interview'];
  const picked: MediaContent[] = [];

  for (const cat of categories) {
    const catVideos = allVideos.filter(v => v.category === cat);
    if (catVideos.length === 0) continue;
    const shuffled = [...catVideos].sort(() => Math.random() - 0.5);
    picked.push(...shuffled.slice(0, Math.min(3, catVideos.length)));
  }

  return [...picked].sort(() => Math.random() - 0.5).slice(0, totalPhones);
}
