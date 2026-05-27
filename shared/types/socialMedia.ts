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

export type ContentPlanStatus =
  | 'draft'
  | 'internal_review'
  | 'pending_approval'
  | 'partially_approved'
  | 'approved'
  | 'revision_requested';

export interface ContentPlanComment {
  id: string;
  postId?: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdAt: Timestamp;
  isClient: boolean;
  isInternal: boolean;
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

  // Onay yapilandirmasi
  approvalConfig?: ApprovalConfig;

  // Post onay ozeti (aggregate)
  postApprovalSummary?: PostApprovalSummary;

  // Dahili inceleme
  internalReviewedBy?: string;
  internalReviewedByName?: string;
  internalReviewedAt?: Timestamp;

  // Atanmis musteri
  assignedClientId?: string;
  assignedClientName?: string;
  assignedClientEmail?: string;

  // Müşteriye gönderilme zamanı (onay için)
  sentToClientAt?: Timestamp;
  sentToClientBy?: string;
  sentToClientByName?: string;
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

export type PostStatus =
  | 'draft'
  | 'internal_review'
  | 'revision_requested_internal'
  | 'pending_approval'
  | 'revision_requested'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'failed';

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Taslak',
  internal_review: 'Dahili Inceleme',
  revision_requested_internal: 'Dahili Revizyon',
  pending_approval: 'Musteri Onayi Bekliyor',
  revision_requested: 'Musteri Revizyonu',
  approved: 'Onaylandi',
  scheduled: 'Planlanmis',
  published: 'Yayinlandi',
  failed: 'Basarisiz',
};

export const POST_STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  internal_review: 'bg-sky-100 text-sky-700',
  revision_requested_internal: 'bg-orange-100 text-orange-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  revision_requested: 'bg-red-100 text-red-700',
  approved: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

// ============================================
// ANA POST ENTITY
// ============================================

export interface CaptionChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestedCaption?: string;
  suggestedHashtags?: string[];
}

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

  // AI caption iterasyon sohbeti
  captionChatHistory?: CaptionChatMessage[];

  // Siniflandirma
  postType: PostType;
  platforms: SocialPlatform[];
  status: PostStatus;

  // Plan
  contentPlanId?: string;

  // Instagram grid sıralaması (opsiyonel, yoksa scheduledAt)
  gridPosition?: number;

  // Zamanlama
  scheduledAt?: Timestamp;
  publishedAt?: Timestamp;

  // Onay
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;

  // Dahili inceleme
  internalReviewedBy?: string;
  internalReviewedByName?: string;
  internalReviewedAt?: Timestamp;

  // Revizyon takibi
  revisionCount?: number;
  lastRevisionComment?: string;

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
  captionChatHistory?: CaptionChatMessage[];
  postType?: PostType;
  platforms?: SocialPlatform[];
  contentPlanId?: string;
  status?: PostStatus;
  scheduledAt?: Timestamp;
  gridPosition?: number;
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
  internalReview: number;
  pendingApproval: number;
  approved: number;
  scheduled: number;
  published: number;
  failed: number;
}

// ============================================
// ONAY SISTEMI TIPLERI
// ============================================

export type ApprovalLevel = 'none' | 'internal' | 'client' | 'final';

export type ApprovalAction =
  | 'submit_for_review'
  | 'internal_approve'
  | 'internal_reject'
  | 'submit_to_client'
  | 'client_approve'
  | 'client_reject'
  | 'resubmit';

export interface ApprovalEvent {
  id: string;
  postId?: string;
  action: ApprovalAction;
  fromStatus: PostStatus | ContentPlanStatus;
  toStatus: PostStatus | ContentPlanStatus;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  comment?: string;
  timestamp: Timestamp;
}

export interface ApprovalConfig {
  requireInternalReview: boolean;
  autoScheduleOnApproval: boolean;
  allowPartialApproval: boolean;
}

export const DEFAULT_APPROVAL_CONFIG: ApprovalConfig = {
  requireInternalReview: false,
  autoScheduleOnApproval: true,
  allowPartialApproval: true,
};

export interface PostApprovalSummary {
  total: number;
  draft: number;
  internalReview: number;
  pendingApproval: number;
  approved: number;
  revisionRequested: number;
}

export const CONTENT_PLAN_STATUS_LABELS: Record<ContentPlanStatus, string> = {
  draft: 'Taslak',
  internal_review: 'Dahili Inceleme',
  pending_approval: 'Musteri Onayi Bekliyor',
  partially_approved: 'Kismi Onay',
  approved: 'Onaylandi',
  revision_requested: 'Revizyon Istendi',
};

export const CONTENT_PLAN_STATUS_COLORS: Record<ContentPlanStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  internal_review: 'bg-sky-100 text-sky-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  partially_approved: 'bg-violet-100 text-violet-700',
  approved: 'bg-green-100 text-green-700',
  revision_requested: 'bg-red-100 text-red-700',
};

// Gecerli durum gecisleri: [fromStatus, toStatus] -> gerekli ApprovalAction
export const VALID_POST_TRANSITIONS: Record<string, ApprovalAction> = {
  'draft->internal_review': 'submit_for_review',
  'draft->pending_approval': 'submit_to_client',
  'internal_review->pending_approval': 'internal_approve',
  'internal_review->revision_requested_internal': 'internal_reject',
  'revision_requested_internal->internal_review': 'resubmit',
  'pending_approval->approved': 'client_approve',
  'pending_approval->revision_requested': 'client_reject',
  'revision_requested->pending_approval': 'resubmit',
};
