import React from 'react';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface SyncStatusBadgeProps {
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncAt?: Timestamp;
  syncError?: string;
  onSync?: () => void;
  loading?: boolean;
}

function formatRelativeTime(ts: Timestamp): string {
  const now = Date.now();
  const then = ts.toDate().getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'Az once';
  if (diffMin < 60) return `${diffMin} dk once`;
  if (diffHour < 24) return `${diffHour} saat once`;

  return ts.toDate().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  syncStatus,
  lastSyncAt,
  syncError,
  onSync,
  loading,
}) => {
  const isSyncing = syncStatus === 'syncing' || loading;

  return (
    <div className="flex items-center gap-2 font-commons">
      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        {isSyncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
            <span className="text-xs text-indigo-600">Senkronize ediliyor...</span>
          </>
        ) : syncStatus === 'success' && lastSyncAt ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-neutral-500">
              {formatRelativeTime(lastSyncAt)}
            </span>
          </>
        ) : syncStatus === 'error' ? (
          <>
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-red-600 max-w-[160px] truncate" title={syncError}>
              {syncError || 'Senkronizasyon hatasi'}
            </span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-neutral-400" />
            <span className="text-xs text-neutral-500">Senkronize edilmedi</span>
          </>
        )}
      </div>

      {/* Sync button */}
      {onSync && !isSyncing && (
        <button
          onClick={onSync}
          className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Senkronize Et
        </button>
      )}
    </div>
  );
};

export default SyncStatusBadge;
