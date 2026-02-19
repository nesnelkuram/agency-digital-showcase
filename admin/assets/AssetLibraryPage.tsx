import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageIcon,
  Upload,
  Folder,
  FolderPlus,
  Search,
  Grid3X3,
  List,
  FileText,
  Film,
  Music,
  File,
  Trash2,
  Copy,
  Tag,
  ChevronRight,
  Home,
  Loader2,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import { useAssetManagement } from '@/shared/hooks/useAssetManagement';
import { Asset, AssetFolder, AssetType, formatFileSize } from '@/shared/types/asset';

// ─── Type helpers ───────────────────────────────────────────────────────────

const TYPE_ICONS: Record<AssetType, React.ReactNode> = {
  image: <ImageIcon className="w-5 h-5 text-blue-500" />,
  video: <Film className="w-5 h-5 text-purple-500" />,
  document: <FileText className="w-5 h-5 text-amber-500" />,
  audio: <Music className="w-5 h-5 text-green-500" />,
  other: <File className="w-5 h-5 text-neutral-500" />,
};

const TYPE_LABELS: Record<AssetType, string> = {
  image: 'Görsel',
  video: 'Video',
  document: 'Belge',
  audio: 'Ses',
  other: 'Diğer',
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const FolderCard: React.FC<{
  folder: AssetFolder;
  onOpen: () => void;
  onDelete: () => void;
}> = ({ folder, onOpen, onDelete }) => (
  <div
    className="group relative bg-white rounded-xl border border-neutral-100 p-4 hover:border-neutral-200 hover:shadow-sm transition-all cursor-pointer"
    onClick={onOpen}
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
        <Folder className="w-5 h-5 text-amber-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-grotesk font-medium text-[#171717] truncate">{folder.name}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-neutral-300" />
    </div>
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(); }}
      className="absolute top-2 right-2 p-1.5 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

const AssetCard: React.FC<{
  asset: Asset;
  viewMode: 'grid' | 'list';
  onDelete: () => void;
  onCopyLink: () => void;
  copiedId: string | null;
}> = ({ asset, viewMode, onDelete, onCopyLink, copiedId }) => {
  const isCopied = copiedId === asset.id;

  if (viewMode === 'list') {
    return (
      <div className="group flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 border-b border-neutral-50 last:border-0 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {asset.type === 'image' && asset.thumbnailUrl ? (
            <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            TYPE_ICONS[asset.type]
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-grotesk text-sm font-medium text-[#171717] truncate">{asset.name}</p>
          <p className="font-grotesk text-xs text-neutral-400">
            {TYPE_LABELS[asset.type]} • {formatFileSize(asset.metadata.size)}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onCopyLink}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Linki kopyala"
          >
            {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Sil"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-white rounded-xl border border-neutral-100 overflow-hidden hover:border-neutral-200 hover:shadow-sm transition-all">
      {/* Thumbnail */}
      <div className="aspect-square bg-neutral-50 flex items-center justify-center overflow-hidden">
        {asset.type === 'image' && asset.url ? (
          <img src={asset.thumbnailUrl || asset.url} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            {TYPE_ICONS[asset.type]}
            <span className="font-grotesk text-xs text-neutral-400">{TYPE_LABELS[asset.type]}</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="font-grotesk text-xs font-medium text-[#171717] truncate">{asset.name}</p>
        <p className="font-grotesk text-xs text-neutral-400 mt-0.5">{formatFileSize(asset.metadata.size)}</p>
      </div>
      {/* Actions overlay */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onCopyLink}
          className="p-1.5 bg-white/90 text-neutral-600 hover:text-neutral-900 rounded-lg shadow-sm transition-colors"
          title="Linki kopyala"
        >
          {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 bg-white/90 text-neutral-600 hover:text-red-600 rounded-lg shadow-sm transition-colors"
          title="Sil"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const AssetLibraryPage: React.FC = () => {
  const {
    assets,
    folders,
    currentFolderId,
    loading,
    uploading,
    uploadProgress,
    error,
    setCurrentFolderId,
    uploadFile,
    createFolder,
    deleteAsset,
    deleteFolder,
  } = useAssetManagement();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Tüm Dosyalar' },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigateToFolder = (folder: AssetFolder) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
    setSearch('');
  };

  const navigateBreadcrumb = (index: number) => {
    const crumb = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentFolderId(crumb.id);
    setSearch('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await uploadFile(file, currentFolderId ?? undefined);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await uploadFile(file, currentFolderId ?? undefined);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim(), currentFolderId ?? undefined);
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const handleCopyLink = (asset: Asset) => {
    navigator.clipboard.writeText(asset.url).then(() => {
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || a.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [assets, search, typeFilter]);

  const typeOptions: (AssetType | 'all')[] = ['all', 'image', 'video', 'document', 'audio', 'other'];

  return (
    <div
      className="space-y-5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Asset Kütüphanesi
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1 text-sm">
            Marka asset'lerini yönetin ve organize edin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewFolderInput(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-200 text-neutral-700 rounded-full font-grotesk text-sm hover:bg-neutral-50 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            Klasör
          </button>
          <motion.button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-60"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploadProgress > 0 ? `${uploadProgress}%` : 'Yükleniyor...'}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Dosya Yükle
              </>
            )}
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          />
        </div>
      </div>

      {/* New Folder Input */}
      <AnimatePresence>
        {showNewFolderInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 bg-white rounded-xl border border-neutral-200 p-3">
              <Folder className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); }
                }}
                placeholder="Klasör adı..."
                className="flex-1 font-grotesk text-sm focus:outline-none bg-transparent"
                autoFocus
              />
              <button onClick={handleCreateFolder} className="p-1.5 bg-[#171717] text-white rounded-lg hover:bg-neutral-800 transition-colors">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
              <button
                onClick={() => navigateBreadcrumb(i)}
                className={`flex items-center gap-1 font-grotesk text-sm transition-colors ${
                  i === breadcrumbs.length - 1
                    ? 'text-[#171717] font-medium'
                    : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                {i === 0 && <Home className="w-3.5 h-3.5" />}
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dosya ara..."
            className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm focus:outline-none focus:border-neutral-400 bg-neutral-50 transition-colors"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {typeOptions.map((type) => {
            const count = type === 'all' ? assets.length : assets.filter((a) => a.type === type).length;
            if (type !== 'all' && count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-colors ${
                  typeFilter === type
                    ? 'bg-[#171717] text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {type === 'all' ? 'Tümü' : TYPE_LABELS[type]} {type !== 'all' && `(${count})`}
              </button>
            );
          })}
        </div>

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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="font-grotesk text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      )}

      {/* Content */}
      {!loading && (
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
                    <FolderCard
                      folder={folder}
                      onOpen={() => navigateToFolder(folder)}
                      onDelete={() => deleteFolder(folder.id)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Assets */}
          {filteredAssets.length > 0 && (
            <div>
              <p className="font-grotesk text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">
                Dosyalar ({filteredAssets.length})
              </p>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredAssets.map((asset, i) => (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                    >
                      <AssetCard
                        asset={asset}
                        viewMode="grid"
                        onDelete={() => deleteAsset(asset.id)}
                        onCopyLink={() => handleCopyLink(asset)}
                        copiedId={copiedId}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
                  {filteredAssets.map((asset, i) => (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                    >
                      <AssetCard
                        asset={asset}
                        viewMode="list"
                        onDelete={() => deleteAsset(asset.id)}
                        onCopyLink={() => handleCopyLink(asset)}
                        copiedId={copiedId}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {folders.length === 0 && filteredAssets.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-neutral-200 cursor-pointer hover:border-neutral-300 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-neutral-300 mb-3" />
              <p className="font-grotesk font-semibold text-neutral-500">
                {search || typeFilter !== 'all' ? 'Eşleşen dosya bulunamadı' : 'Dosya yok'}
              </p>
              {!search && typeFilter === 'all' && (
                <p className="font-grotesk text-sm text-neutral-400 mt-1">
                  Tıklayın veya sürükleyip bırakın
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Tag filter info */}
      {filteredAssets.length > 0 && (
        <p className="font-grotesk text-xs text-neutral-400 text-center pb-2">
          <Tag className="w-3 h-3 inline mr-1" />
          Etiket yönetimi yakında
        </p>
      )}
    </div>
  );
};

export default AssetLibraryPage;
