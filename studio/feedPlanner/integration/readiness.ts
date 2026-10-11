import { checkInstagramReadiness } from '../../../shared/social/instagramReadiness';
import type { MediaItem } from '../../../shared/types/socialMedia';
import type { LivePostType } from './liveTypes';

export type Readiness = 'ok' | 'warning' | 'error';

const levelOf = (r: { issues: Array<{ level: string }> }): Readiness =>
  r.issues.some((i) => i.level === 'error') ? 'error' : r.issues.some((i) => i.level === 'warning') ? 'warning' : 'ok';

/** api/_lib/planSuggest/planSuggest.ts readinessFor ile aynı mantık (testle eşitliği doğrulanır). */
export function readinessByType(item: MediaItem): Record<LivePostType, Readiness> {
  return {
    static: levelOf(checkInstagramReadiness('static', [item])),
    carousel: item.type === 'image' ? levelOf(checkInstagramReadiness('static', [item])) : 'error',
    story: levelOf(checkInstagramReadiness('story', [item])),
    reels: levelOf(checkInstagramReadiness('reels', [item])),
  };
}
