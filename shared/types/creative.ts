import type { Timestamp } from 'firebase/firestore';
import type { AdPlatform } from './marketing';

// ============================================
// KREATIF TIPLERI
// ============================================

export type CreativeType = 'image' | 'video' | 'text' | 'carousel';
export type CreativeStatus = 'draft' | 'ready' | 'archived';

// ============================================
// KREATIF ASSET
// ============================================

export interface CreativeAsset {
  id: string;
  projectId?: string;
  name: string;
  type: CreativeType;
  status: CreativeStatus;

  // Medya
  fileUrl?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  fileSize?: number;
  dimensions?: { width: number; height: number };
  duration?: number; // saniye, video icin

  // Metin icerikleri
  headline?: string;
  primaryText?: string;
  description?: string;
  callToAction?: string;

  // Organizasyon
  platforms: AdPlatform[];
  tags: string[];
  campaignIds: string[];

  // Metadata
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// ETIKETLER
// ============================================

export const CREATIVE_TYPE_LABELS: Record<CreativeType, string> = {
  image: 'Gorsel',
  video: 'Video',
  text: 'Metin',
  carousel: 'Carousel',
};

export const CREATIVE_STATUS_LABELS: Record<CreativeStatus, string> = {
  draft: 'Taslak',
  ready: 'Hazir',
  archived: 'Arsiv',
};

// ============================================
// RENKLER
// ============================================

export const CREATIVE_STATUS_COLORS: Record<CreativeStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-green-100 text-green-700',
  archived: 'bg-neutral-100 text-neutral-500',
};

export const CREATIVE_TYPE_COLORS: Record<CreativeType, string> = {
  image: 'bg-blue-100 text-blue-700',
  video: 'bg-purple-100 text-purple-700',
  text: 'bg-emerald-100 text-emerald-700',
  carousel: 'bg-orange-100 text-orange-700',
};
