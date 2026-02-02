import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus,
  Search,
  Image,
  Video,
  Type,
  Layout,
  Trash2,
  Upload,
  X,
  Tag,
  FileText,
} from 'lucide-react';
import type {
  CreativeAsset,
  CreativeType,
  CreativeStatus,
} from '@/shared/types/creative';
import {
  CREATIVE_TYPE_LABELS,
  CREATIVE_STATUS_LABELS,
  CREATIVE_STATUS_COLORS,
  CREATIVE_TYPE_COLORS,
} from '@/shared/types/creative';
import type { AdPlatform } from '@/shared/types/marketing';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/shared/types/marketing';
import {
  getCreatives,
  createCreative,
  updateCreative,
  deleteCreative,
  uploadCreativeFile,
} from '@/shared/services/creativeService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import { useAuth } from '@/contexts/AuthContext';

// ============================================
// SABITLER
// ============================================

const ALL_PLATFORMS: AdPlatform[] = ['meta', 'google', 'tiktok', 'linkedin', 'email'];

const CREATIVE_TYPE_ICONS: Record<CreativeType, React.ReactNode> = {
  image: <Image className="w-8 h-8 text-neutral-300" />,
  video: <Video className="w-8 h-8 text-neutral-300" />,
  text: <Type className="w-8 h-8 text-neutral-300" />,
  carousel: <Layout className="w-8 h-8 text-neutral-300" />,
};

// ============================================
// UPLOAD MODAL
// ============================================

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId?: string;
}

const UploadModal: React.FC<UploadModalProps> = ({
  open,
  onClose,
  onCreated,
  projectId,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<CreativeType>('image');
  const [platforms, setPlatforms] = useState<AdPlatform[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Text creative fields
  const [headline, setHeadline] = useState('');
  const [primaryText, setPrimaryText] = useState('');
  const [description, setDescription] = useState('');
  const [callToAction, setCallToAction] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  // Platform toggle
  const togglePlatform = (platform: AdPlatform) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  // File handling
  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    if (!name) {
      setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!name.trim() || !user) return;
    if (type !== 'text' && !file) return;

    setSubmitting(true);
    setError('');
    setUploadProgress(0);

    try {
      let fileUrl: string | undefined;
      let thumbnailUrl: string | undefined;

      // Upload file if present
      if (file) {
        setUploadProgress(20);
        const uploadResult = await uploadCreativeFile(file);
        fileUrl = uploadResult.url;
        thumbnailUrl = uploadResult.thumbnailUrl;
        setUploadProgress(70);
      }

      // Parse tags
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Create creative
      await createCreative({
        projectId,
        name: name.trim(),
        type,
        status: 'draft',
        fileUrl,
        thumbnailUrl,
        mimeType: file?.type,
        fileSize: file?.size,
        headline: type === 'text' ? headline || undefined : undefined,
        primaryText: type === 'text' ? primaryText || undefined : undefined,
        description: type === 'text' ? description || undefined : undefined,
        callToAction: type === 'text' ? callToAction || undefined : undefined,
        platforms,
        tags,
        campaignIds: [],
        createdBy: user.uid,
        createdByName: user.displayName || 'Bilinmeyen',
      });

      setUploadProgress(100);
      onCreated();
      resetForm();
    } catch (err) {
      console.error('Kreatif olusturulurken hata:', err);
      setError('Kreatif yuklenirken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setType('image');
    setPlatforms([]);
    setTagsInput('');
    setFile(null);
    setHeadline('');
    setPrimaryText('');
    setDescription('');
    setCallToAction('');
    setUploadProgress(0);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isValid =
    name.trim() &&
    (type === 'text' || file) &&
    !submitting;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-commons font-bold text-[#171717]">
            Yeni Kreatif
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-commons">
              {error}
            </div>
          )}

          {/* File Drop Zone */}
          {type !== 'text' && (
            <div>
              <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                Dosya
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-indigo-400 bg-indigo-50'
                    : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-neutral-200 hover:border-indigo-300 hover:bg-neutral-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={
                    type === 'image'
                      ? 'image/*'
                      : type === 'video'
                      ? 'video/*'
                      : 'image/*,video/*'
                  }
                  onChange={handleFileInputChange}
                />
                {file ? (
                  <div className="space-y-1">
                    <FileText className="w-8 h-8 text-green-500 mx-auto" />
                    <p className="font-commons text-sm text-green-700 font-medium">
                      {file.name}
                    </p>
                    <p className="font-commons text-xs text-green-600">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-neutral-300 mx-auto" />
                    <p className="font-commons text-sm text-neutral-500">
                      Dosyayi surukleyin veya tiklayin
                    </p>
                    <p className="font-commons text-xs text-neutral-400">
                      {type === 'image'
                        ? 'PNG, JPG, WebP, SVG'
                        : type === 'video'
                        ? 'MP4, MOV, WebM'
                        : 'Gorsel veya video dosyasi'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {submitting && uploadProgress > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-commons text-neutral-500">
                  Yukleniyor...
                </span>
                <span className="text-xs font-commons text-indigo-600 font-medium">
                  %{uploadProgress}
                </span>
              </div>
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Ad
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kreatif adi"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Tip
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(CREATIVE_TYPE_LABELS) as CreativeType[]).map(
                (ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => {
                      setType(ct);
                      if (ct === 'text') setFile(null);
                    }}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border text-xs font-commons transition-colors ${
                      type === ct
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                        : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                    }`}
                  >
                    {ct === 'image' && <Image className="w-4 h-4" />}
                    {ct === 'video' && <Video className="w-4 h-4" />}
                    {ct === 'text' && <Type className="w-4 h-4" />}
                    {ct === 'carousel' && <Layout className="w-4 h-4" />}
                    {CREATIVE_TYPE_LABELS[ct]}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Platform Multi-select */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Platformlar
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((platform) => (
                <label
                  key={platform}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-sm font-commons ${
                    platforms.includes(platform)
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={platforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                    className="sr-only"
                  />
                  <span className="w-3 h-3 rounded border flex items-center justify-center flex-shrink-0">
                    {platforms.includes(platform) && (
                      <span className="w-2 h-2 rounded-sm bg-indigo-600" />
                    )}
                  </span>
                  {PLATFORM_LABELS[platform].split(' (')[0]}
                </label>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
              Etiketler
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Virgul ile ayirin: banner, kampanya, yaz"
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Text Creative Fields */}
          {type === 'text' && (
            <div className="space-y-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
              <p className="text-xs font-commons font-semibold text-neutral-500 uppercase tracking-wide">
                Metin Icerikleri
              </p>

              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                  Baslik
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Reklam basligi"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                  Ana Metin
                </label>
                <textarea
                  value={primaryText}
                  onChange={(e) => setPrimaryText(e.target.value)}
                  placeholder="Reklam ana metni"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                  Aciklama
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kisa aciklama"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-sm font-commons font-medium text-[#171717] mb-1.5">
                  Aksiyon Butonu (CTA)
                </label>
                <input
                  type="text"
                  value={callToAction}
                  onChange={(e) => setCallToAction(e.target.value)}
                  placeholder="Orn: Hemen Satin Al, Daha Fazla Bilgi"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-neutral-200 text-neutral-600 font-commons text-sm hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Iptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-commons text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Yukleniyor...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Yukle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CREATIVE LIBRARY PAGE
// ============================================

const CreativeLibraryPage: React.FC = () => {
  const { projectId } = useProjectScope();
  const { user } = useAuth();

  // Data state
  const [creatives, setCreatives] = useState<CreativeAsset[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CreativeType | ''>('');
  const [statusFilter, setStatusFilter] = useState<CreativeStatus | ''>('');

  // UI state
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load creatives
  const loadCreatives = useCallback(async () => {
    setLoading(true);
    try {
      const filters: {
        projectId?: string;
        type?: CreativeType;
        status?: CreativeStatus;
        search?: string;
      } = {};

      if (projectId) filters.projectId = projectId;
      if (typeFilter) filters.type = typeFilter;
      if (statusFilter) filters.status = statusFilter;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      const result = await getCreatives(
        Object.keys(filters).length > 0 ? filters : undefined
      );
      setCreatives(result);
    } catch (err) {
      console.error('Kreatifleri yuklerken hata:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, typeFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadCreatives();
  }, [loadCreatives]);

  // Delete creative
  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu kreatifi silmek istediginizden emin misiniz?'))
      return;

    setDeletingId(id);
    try {
      await deleteCreative(id);
      setCreatives((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Kreatif silinirken hata:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Update status
  const handleStatusChange = async (id: string, newStatus: CreativeStatus) => {
    try {
      await updateCreative(id, { status: newStatus });
      setCreatives((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
    } catch (err) {
      console.error('Durum guncellenirken hata:', err);
    }
  };

  // After upload success
  const handleCreated = () => {
    setModalOpen(false);
    loadCreatives();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">
            Kreatif Kutuphanesi
          </h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Reklam gorsel, video ve metin icerikleri
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm"
        >
          <Plus className="w-4 h-4" />
          Yeni Kreatif
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kreatif ara..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as CreativeType | '')}
          className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="">Tum Tipler</option>
          {(Object.entries(CREATIVE_TYPE_LABELS) as [CreativeType, string][]).map(
            ([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            )
          )}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as CreativeStatus | '')
          }
          className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="">Tum Durumlar</option>
          {(
            Object.entries(CREATIVE_STATUS_LABELS) as [CreativeStatus, string][]
          ).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : creatives.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200/50 p-12 text-center">
          <Image className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="font-commons text-neutral-500">
            Henuz kreatif bulunmuyor
          </p>
          <p className="font-commons text-neutral-400 text-sm mt-1">
            Yeni bir gorsel, video veya metin icerik yukleyin.
          </p>
        </div>
      ) : (
        /* Creative Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creatives.map((creative) => (
            <div
              key={creative.id}
              className="bg-white rounded-xl border border-neutral-200/50 hover:shadow-md hover:border-indigo-200 transition-all group"
            >
              {/* Thumbnail / Preview Area */}
              {creative.type === 'text' ? (
                <div className="p-4 border-b border-neutral-100">
                  {creative.headline && (
                    <p className="font-commons font-semibold text-sm text-[#171717] mb-1 line-clamp-1">
                      {creative.headline}
                    </p>
                  )}
                  {creative.primaryText && (
                    <p className="font-commons text-xs text-neutral-500 line-clamp-3">
                      {creative.primaryText}
                    </p>
                  )}
                  {!creative.headline && !creative.primaryText && (
                    <div className="h-[120px] flex items-center justify-center">
                      <Type className="w-8 h-8 text-neutral-300" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[200px] bg-neutral-100 rounded-t-xl overflow-hidden flex items-center justify-center">
                  {creative.fileUrl || creative.thumbnailUrl ? (
                    creative.type === 'video' ? (
                      creative.thumbnailUrl ? (
                        <img
                          src={creative.thumbnailUrl}
                          alt={creative.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={creative.fileUrl}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                      )
                    ) : (
                      <img
                        src={creative.thumbnailUrl || creative.fileUrl}
                        alt={creative.name}
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    CREATIVE_TYPE_ICONS[creative.type]
                  )}
                </div>
              )}

              {/* Card Body */}
              <div className="p-4 space-y-3">
                {/* Name + Badges */}
                <div>
                  <h3 className="font-commons font-semibold text-[#171717] text-sm truncate">
                    {creative.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-commons ${
                        CREATIVE_TYPE_COLORS[creative.type]
                      }`}
                    >
                      {CREATIVE_TYPE_LABELS[creative.type]}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-commons ${
                        CREATIVE_STATUS_COLORS[creative.status]
                      }`}
                    >
                      {CREATIVE_STATUS_LABELS[creative.status]}
                    </span>
                  </div>
                </div>

                {/* Platform Badges */}
                {creative.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {creative.platforms.map((platform) => (
                      <span
                        key={platform}
                        className={`px-1.5 py-0.5 rounded text-xs font-commons ${PLATFORM_COLORS[platform]}`}
                      >
                        {PLATFORM_LABELS[platform].split(' (')[0]}
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag pills */}
                {creative.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {creative.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-xs font-commons"
                      >
                        {tag}
                      </span>
                    ))}
                    {creative.tags.length > 3 && (
                      <span className="px-2 py-0.5 text-neutral-400 text-xs font-commons">
                        +{creative.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                  <select
                    value={creative.status}
                    onChange={(e) =>
                      handleStatusChange(
                        creative.id,
                        e.target.value as CreativeStatus
                      )
                    }
                    className="px-2 py-1 rounded-md border border-neutral-200 bg-white font-commons text-xs focus:outline-none focus:border-indigo-400"
                  >
                    {(
                      Object.entries(CREATIVE_STATUS_LABELS) as [
                        CreativeStatus,
                        string,
                      ][]
                    ).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(creative.id)}
                    disabled={deletingId === creative.id}
                    className="p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Kreatifi sil"
                  >
                    {deletingId === creative.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        projectId={projectId}
      />
    </div>
  );
};

export default CreativeLibraryPage;
