import { Timestamp } from 'firebase/firestore';

// ============================================
// MEDYA DETAY TIPI
// ============================================

export interface MediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  order: number;
}

// ============================================
// PLATFORM-POST TIPI ESLEMESI
// ============================================

export const PLATFORM_POST_TYPES: Record<SocialPlatform, PostType[]> = {
  instagram: ['static', 'carousel', 'reels', 'story'],
  tiktok: ['video', 'story'],
  linkedin: ['static', 'carousel', 'video', 'text'],
  twitter: ['static', 'video', 'text'],
  facebook: ['static', 'carousel', 'video', 'text', 'story'],
};

// ============================================
// ICERIK PLANI (MUSTERI ONAY SISTEMI)
// ============================================

export type ContentPlanStatus = 'draft' | 'pending_approval' | 'approved' | 'revision_requested';

export interface ContentPlanComment {
  id: string;
  postId?: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  isClient: boolean;
}

export interface ContentPlan {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description?: string;
  platform: SocialPlatform;
  postIds: string[];
  weekStartDate: Timestamp;
  weekEndDate: Timestamp;
  status: ContentPlanStatus;
  shareToken: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  clientComments: ContentPlanComment[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName: string;
}

export interface CreateContentPlanData {
  projectId: string;
  title: string;
  description?: string;
  platform: SocialPlatform;
  postIds: string[];
  weekStartDate: Timestamp;
  weekEndDate: Timestamp;
}

export interface ContentPlanSummary {
  id: string;
  title: string;
  platform: SocialPlatform;
  postCount: number;
  weekStartDate: Timestamp;
  weekEndDate: Timestamp;
  status: ContentPlanStatus;
  createdAt: Timestamp;
}

// ============================================
// SOSYAL MEDYA PLATFORMLARI
// ============================================

export type SocialPlatform = 'instagram' | 'tiktok' | 'linkedin' | 'twitter' | 'facebook';

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
};

export const SOCIAL_PLATFORM_COLORS: Record<SocialPlatform, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  tiktok: 'bg-gray-100 text-gray-700',
  linkedin: 'bg-sky-100 text-sky-700',
  twitter: 'bg-blue-100 text-blue-700',
  facebook: 'bg-indigo-100 text-indigo-700',
};

// ============================================
// POST TIPLERI
// ============================================

export type PostType = 'reels' | 'story' | 'carousel' | 'static' | 'video' | 'text';

export const POST_TYPE_LABELS: Record<PostType, string> = {
  reels: 'Reels',
  story: 'Story',
  carousel: 'Carousel',
  static: 'Statik Gorsel',
  video: 'Video',
  text: 'Metin',
};

export const POST_TYPE_COLORS: Record<PostType, string> = {
  reels: 'bg-purple-100 text-purple-700',
  story: 'bg-orange-100 text-orange-700',
  carousel: 'bg-teal-100 text-teal-700',
  static: 'bg-blue-100 text-blue-700',
  video: 'bg-red-100 text-red-700',
  text: 'bg-gray-100 text-gray-700',
};

// ============================================
// PLATFORM KARAKTER LIMITLERI
// ============================================

export const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  twitter: 280,
  facebook: 63206,
};

// ============================================
// POST DURUMLARI
// ============================================

export type PostStatus = 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'published' | 'failed';

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Taslak',
  pending_approval: 'Onay Bekliyor',
  approved: 'Onaylandi',
  scheduled: 'Planlanmis',
  published: 'Yayinlandi',
  failed: 'Basarisiz',
};

export const POST_STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

// ============================================
// ANA POST ENTITY
// ============================================

export interface SocialMediaPost {
  id: string;
  projectId: string;

  // Icerik
  title?: string;
  caption?: string;
  hashtags?: string[];
  mediaUrls?: string[];
  media?: MediaItem[];
  aiGeneratedCaption?: string;

  // Siniflandirma
  postType: PostType;
  platforms: SocialPlatform[];
  status: PostStatus;

  // Plan
  contentPlanId?: string;

  // Zamanlama
  scheduledAt?: Timestamp;
  publishedAt?: Timestamp;

  // Onay
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;

  // Etiketler
  tags: string[];

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName: string;
}

// ============================================
// CRUD TIPLERI
// ============================================

export interface CreateSocialPostData {
  projectId: string;
  title?: string;
  caption?: string;
  hashtags?: string[];
  mediaUrls?: string[];
  media?: MediaItem[];
  aiGeneratedCaption?: string;
  postType: PostType;
  platforms: SocialPlatform[];
  contentPlanId?: string;
  scheduledAt?: Timestamp;
  tags?: string[];
}

export interface UpdateSocialPostData {
  title?: string;
  caption?: string;
  hashtags?: string[];
  mediaUrls?: string[];
  media?: MediaItem[];
  aiGeneratedCaption?: string;
  postType?: PostType;
  platforms?: SocialPlatform[];
  contentPlanId?: string;
  status?: PostStatus;
  scheduledAt?: Timestamp;
  tags?: string[];
}

// ============================================
// LISTE/OZET TIPI
// ============================================

export interface SocialPostSummary {
  id: string;
  projectId: string;
  title?: string;
  caption?: string;
  postType: PostType;
  platforms: SocialPlatform[];
  status: PostStatus;
  media?: MediaItem[];
  contentPlanId?: string;
  scheduledAt?: Timestamp;
  createdAt: Timestamp;
}

// ============================================
// FILTRE TIPI
// ============================================

export interface SocialPostFilters {
  projectId?: string;
  status?: PostStatus[];
  postType?: PostType[];
  platforms?: SocialPlatform[];
  dateRange?: { start: Date; end: Date };
  search?: string;
}

// ============================================
// ISTATISTIK TIPI
// ============================================

export interface SocialMediaStats {
  totalPosts: number;
  drafts: number;
  pendingApproval: number;
  scheduled: number;
  published: number;
  failed: number;
}
