export type AssetType = 'image' | 'video' | 'document' | 'audio' | 'other';
export type AssetSource = 'upload' | 'google_drive';

export interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number; // for video/audio in seconds
  size: number; // in bytes
  mimeType: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  source: AssetSource;

  // Storage info
  url: string;
  thumbnailUrl?: string;

  // Google Drive specific
  driveFileId?: string;
  driveWebViewLink?: string;

  // Organization
  folderId?: string;
  projectId?: string;
  tags: string[];

  // Metadata
  metadata: AssetMetadata;

  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetFolder {
  id: string;
  name: string;
  parentId?: string;
  color?: string;

  // Google Drive specific
  driveFolderId?: string;

  // Audit
  createdBy: string;
  createdAt: Date;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

export interface DriveUploadSession {
  id: string;
  tenantId: string;
  userId: string;
  sessionUri: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBytes: number;
  targetDriveFolderId?: string;
  assetFolderId?: string;
  status: 'active' | 'paused' | 'completed' | 'failed' | 'expired';
  driveFileId?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

// Helper to determine asset type from mime type
export function getAssetTypeFromMimeType(mimeType: string): AssetType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('text/')
  ) {
    return 'document';
  }
  return 'other';
}

// File size formatter
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
