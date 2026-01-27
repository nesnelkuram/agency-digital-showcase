export type FeedbackVideoStatus = 'processing' | 'ready' | 'failed';
export type RecordingMode = 'screen' | 'camera' | 'screen_camera';

export interface FeedbackVideoMetadata {
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface FeedbackVideo {
  id: string;
  title: string;
  description?: string;

  // Video
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number; // saniye
  recordingMode: RecordingMode;

  // Organizasyon
  projectId?: string;
  tags: string[];

  // Paylasim
  shareToken: string;
  isPublic: boolean;
  allowedUsers: string[];

  // Istatistikler
  viewCount: number;
  commentCount: number;

  // Meta
  status: FeedbackVideoStatus;
  metadata: FeedbackVideoMetadata;

  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackVideoSummary {
  id: string;
  title: string;
  thumbnailUrl?: string;
  duration: number;
  recordingMode: RecordingMode;
  projectId?: string;
  shareToken: string;
  isPublic: boolean;
  viewCount: number;
  commentCount: number;
  status: FeedbackVideoStatus;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

export interface CreateFeedbackVideoData {
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  recordingMode: RecordingMode;
  projectId?: string;
  tags?: string[];
  isPublic?: boolean;
  metadata: FeedbackVideoMetadata;
}

export interface UpdateFeedbackVideoData {
  title?: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  allowedUsers?: string[];
  projectId?: string | null;
  status?: FeedbackVideoStatus;
}

export interface FeedbackVideoFilters {
  search?: string;
  recordingMode?: RecordingMode;
  projectId?: string;
  createdBy?: string;
  status?: FeedbackVideoStatus;
}

export interface FeedbackComment {
  id: string;
  videoId: string;
  timestamp: number; // video saniyesi
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateCommentData {
  videoId: string;
  timestamp: number;
  text: string;
}

export interface FeedbackReaction {
  id: string;
  videoId: string;
  timestamp: number;
  emoji: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackVideoStatus, string> = {
  processing: 'Isleniyor',
  ready: 'Hazir',
  failed: 'Basarisiz',
};

export const FEEDBACK_STATUS_COLORS: Record<FeedbackVideoStatus, string> = {
  processing: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export const RECORDING_MODE_LABELS: Record<RecordingMode, string> = {
  screen: 'Ekran',
  camera: 'Kamera',
  screen_camera: 'Ekran + Kamera',
};

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
