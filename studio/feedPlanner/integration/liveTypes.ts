/**
 * Canlı sistemin sözleşmelerinin YAPISAL kopyaları (yalnız ihtiyaç duyulan alanlar). Kaynaklar:
 *  - shared/types/brandMedia.ts            BrandMediaAsset
 *  - api/_lib/mediaAnalysis/spec.ts        ImageCatalog (etkin katalog)
 *  - api/_lib/planSuggest/planSuggest.ts   ValidatedPost, suggestWeeklyPlan sonucu
 * Testler gerçek tiplerle/şemalarla uyumu doğrular; bu dosya hiçbir ağ/DB çağrısı yapmaz.
 */
import type { MediaItem } from '../../../shared/types/socialMedia';

export interface LiveBrandMediaAsset {
  id: string;
  tenantId: string;
  projectId: string;
  kind: 'photo' | 'video';
  title: string;
  fileName: string;
  tags: string[];
  status: 'active' | 'archived';
  storage: {
    path: string;
    downloadUrl: string;
    contentType: string;
    size: number;
    width?: number;
    height?: number;
    duration?: number;
    thumbPath?: string;
    thumbUrl?: string;
  };
  createdBy: string;
}

export interface LiveCatalog {
  subject: string;
  description: string;
  tags: string[];
  foodCategories: string[];
  composition: {
    shotType: 'yakın_çekim' | 'orta_plan' | 'genel_plan' | 'üstten' | 'ürün_odaklı' | 'mekan' | 'diğer';
    orientation: 'dikey' | 'yatay' | 'kare';
    hasTextOverlay: boolean;
    subjectPlacement: 'merkez' | 'sol' | 'sağ' | 'üst' | 'alt' | 'dağınık';
    negativeSpace: boolean;
  };
  peoplePresent: boolean;
  productIdentity: { status: string; note: string };
  usageSuggestions: string[];
  overallConfidence: 'düşük' | 'orta' | 'yüksek';
  uncertainties: string[];
}

export interface LiveMediaUsage {
  usedInPostCount: number;
  approvedUseCount: number;
  pendingUseCount: number;
  lastUsedAt: number | null;
}

export type LivePostType = 'static' | 'carousel' | 'story' | 'reels';

export interface LiveValidatedPost {
  index: number;
  day: number;
  time: string;
  scheduledAt: string;
  postType: LivePostType;
  mediaIds: string[];
  media: MediaItem[];
  captionDraft: string;
  rationale: string;
  readinessWarnings: boolean;
  contentHash: string;
  warnings: string[];
}

export interface LiveSuggestionResponse {
  weekStart: string;
  model?: string;
  modelCalled?: boolean;
  suggestionSetId: string | null;
  accepted: LiveValidatedPost[];
  rejected: Array<{ index: number; reasons: string[]; mediaIds: string[] }>;
  shortages: string[];
  inventory?: { eligible: number; excluded: Array<{ mediaId: string; reason: string }>; truncated: boolean };
}
