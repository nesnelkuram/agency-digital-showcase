import React from 'react';
import { GoogleDriveFile } from '@/shared/types/asset';
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FileSpreadsheet,
  Presentation,
  ExternalLink,
  Download,
} from 'lucide-react';

interface DriveFileCardProps {
  file: GoogleDriveFile;
  onImport: (mode: 'link' | 'copy') => void;
  viewMode: 'grid' | 'list';
}

const MIME_ICONS: Record<string, React.ReactNode> = {
  'application/vnd.google-apps.document': <FileText className="w-5 h-5 text-blue-500" />,
  'application/vnd.google-apps.spreadsheet': <FileSpreadsheet className="w-5 h-5 text-green-600" />,
  'application/vnd.google-apps.presentation': <Presentation className="w-5 h-5 text-amber-500" />,
  'application/pdf': <FileText className="w-5 h-5 text-red-500" />,
};

function getIconForMime(mimeType: string): React.ReactNode {
  if (MIME_ICONS[mimeType]) return MIME_ICONS[mimeType];
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-purple-500" />;
  if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-green-500" />;
  return <FileText className="w-5 h-5 text-neutral-500" />;
}

function formatSize(bytes?: string): string {
  if (!bytes) return '';
  const n = parseInt(bytes, 10);
  if (n === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return parseFloat((n / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const DriveFileCard: React.FC<DriveFileCardProps> = ({ file, onImport, viewMode }) => {
  const isGoogleNative = file.mimeType.startsWith('application/vnd.google-apps.');

  if (viewMode === 'list') {
    return (
      <div className="group flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 border-b border-neutral-50 last:border-0 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {file.thumbnailLink ? (
            <img src={file.thumbnailLink} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            getIconForMime(file.mimeType)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-grotesk text-sm font-medium text-[#171717] truncate">{file.name}</p>
          <p className="font-grotesk text-xs text-neutral-400">
            {formatSize(file.size)}
            {file.modifiedTime && ` • ${new Date(file.modifiedTime).toLocaleDateString('tr-TR')}`}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {file.webViewLink && (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Drive'da Aç"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {!isGoogleNative && (
            <button
              onClick={() => onImport('link')}
              className="p-2 text-neutral-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="İçeri Aktar"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-white rounded-xl border border-neutral-100 overflow-hidden hover:border-neutral-200 hover:shadow-sm transition-all">
      {/* Thumbnail */}
      <div className="aspect-square bg-neutral-50 flex items-center justify-center overflow-hidden">
        {file.thumbnailLink ? (
          <img src={file.thumbnailLink} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            {getIconForMime(file.mimeType)}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="font-grotesk text-xs font-medium text-[#171717] truncate">{file.name}</p>
        <p className="font-grotesk text-xs text-neutral-400 mt-0.5">{formatSize(file.size)}</p>
      </div>
      {/* Actions overlay */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {file.webViewLink && (
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 bg-white/90 text-neutral-600 hover:text-blue-600 rounded-lg shadow-sm transition-colors"
            title="Drive'da Aç"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {!isGoogleNative && (
          <button
            onClick={() => onImport('link')}
            className="p-1.5 bg-white/90 text-neutral-600 hover:text-green-600 rounded-lg shadow-sm transition-colors"
            title="İçeri Aktar"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default DriveFileCard;
