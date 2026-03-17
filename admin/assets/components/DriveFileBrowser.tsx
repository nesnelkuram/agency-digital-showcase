import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Grid3X3,
  List,
  ChevronRight,
  Home,
  Loader2,
  AlertCircle,
  Folder,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { GoogleDriveFolder } from '@/shared/types/asset';
import DriveFileCard from './DriveFileCard';
import { useGoogleDrive } from '@/shared/hooks/useGoogleDrive';

interface DriveFileBrowserProps {
  onImportFile: (fileId: string, mode: 'link' | 'copy') => Promise<void>;
  onSync: () => Promise<void>;
  onUploadToDrive: () => void;
  syncing: boolean;
  lastSyncAt: string | null;
}

const DriveFolderCard: React.FC<{
  folder: GoogleDriveFolder;
  onOpen: () => void;
}> = ({ folder, onOpen }) => (
  <div
    className="group relative bg-white rounded-xl border border-neutral-100 p-4 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
    onClick={onOpen}
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
        <Folder className="w-5 h-5 text-blue-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-grotesk font-medium text-[#171717] truncate">{folder.name}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-neutral-300" />
    </div>
  </div>
);

const DriveFileBrowser: React.FC<DriveFileBrowserProps> = ({
  onImportFile,
  onSync,
  onUploadToDrive,
  syncing,
  lastSyncAt,
}) => {
  const {
    files,
    folders,
    isLoading,
    error,
    breadcrumbs,
    listFiles,
    navigateToFolder,
    searchFiles,
  } = useGoogleDrive();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Load root on mount
  useEffect(() => {
    listFiles();
  }, [listFiles]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);

    if (value.trim().length >= 2) {
      const timeout = setTimeout(() => searchFiles(value.trim()), 400);
      setSearchTimeout(timeout);
    } else if (value.trim().length === 0) {
      listFiles();
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      navigateToFolder(null);
      setSearch('');
    } else {
      const crumb = breadcrumbs[index];
      // Navigate to this breadcrumb level by trimming breadcrumbs after it
      navigateToFolder(crumb.id);
      setSearch('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Drive'da ara..."
            className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm focus:outline-none focus:border-blue-400 bg-neutral-50 transition-colors"
          />
        </div>

        {/* Sync button */}
        <button
          onClick={onSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-3 py-2 border border-neutral-200 text-neutral-700 rounded-lg font-grotesk text-sm hover:bg-neutral-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          Senkronize Et
        </button>

        {/* Upload to Drive */}
        <button
          onClick={onUploadToDrive}
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg font-grotesk text-sm hover:bg-blue-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Drive'a Yükle
        </button>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#171717]' : 'text-neutral-400 hover:text-neutral-700'}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-[#171717]' : 'text-neutral-400 hover:text-neutral-700'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Last sync info */}
      {lastSyncAt && (
        <p className="font-grotesk text-xs text-neutral-400">
          Son senkronizasyon: {new Date(lastSyncAt).toLocaleString('tr-TR')}
        </p>
      )}

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => handleBreadcrumbClick(-1)}
            className="flex items-center gap-1 font-grotesk text-sm text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Drive
          </button>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
              <button
                onClick={() => handleBreadcrumbClick(i)}
                className={`font-grotesk text-sm transition-colors ${
                  i === breadcrumbs.length - 1
                    ? 'text-[#171717] font-medium'
                    : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="font-grotesk text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <>
          {/* Folders */}
          {folders.length > 0 && (
            <div>
              <p className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">
                Klasörler ({folders.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {folders.map((folder, i) => (
                  <motion.div
                    key={folder.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                  >
                    <DriveFolderCard
                      folder={folder}
                      onOpen={() => navigateToFolder(folder.id, folder.name)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div>
              <p className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">
                Dosyalar ({files.length})
              </p>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {files.map((file, i) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                    >
                      <DriveFileCard
                        file={file}
                        viewMode="grid"
                        onImport={(mode) => onImportFile(file.id, mode)}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
                  {files.map((file, i) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                    >
                      <DriveFileCard
                        file={file}
                        viewMode="list"
                        onImport={(mode) => onImportFile(file.id, mode)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {folders.length === 0 && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-neutral-200">
              <Folder className="w-10 h-10 text-neutral-300 mb-3" />
              <p className="font-grotesk font-semibold text-neutral-500">
                {search ? 'Eşleşen dosya bulunamadı' : 'Bu klasör boş'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DriveFileBrowser;
