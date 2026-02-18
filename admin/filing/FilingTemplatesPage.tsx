import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Folder,
  File,
  Trash2,
  Loader2,
  AlertCircle,
  FolderPlus,
  FileUp,
  FilePlus,
  ArrowLeft,
  X,
  CheckCircle2,
  Upload,
  ChevronDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import {
  getFilingTemplates,
  createFilingTemplate,
  updateFilingTemplate,
  deleteFilingTemplate,
  uploadTemplateFile,
  deleteTemplateFile,
  addBlankTemplateFile,
  getAppSeeds,
  uploadAppSeed,
  deleteAppSeed,
} from '@/shared/services/filingService';
import type {
  FilingTemplate,
  FilingTemplateFolder,
  FilingTemplateFile,
  AppSeedsMap,
} from '@/shared/types/filing';

const FILE_TYPE_PRESETS = [
  { label: 'Premiere Pro', ext: 'prproj', icon: '🎬', seedKey: 'premiere_pro', accept: '.prproj' },
  { label: 'After Effects', ext: 'aep', icon: '✨', seedKey: 'after_effects', accept: '.aep' },
  { label: 'Photoshop', ext: 'psd', icon: '🖼️', seedKey: 'photoshop', accept: '.psd' },
  { label: 'Illustrator', ext: 'ai', icon: '🎨', seedKey: 'illustrator', accept: '.ai' },
  { label: 'Lightroom Katalog', ext: 'lrcat', icon: '📷', seedKey: 'lightroom', accept: '.lrcat,.lrtemplate' },
  { label: 'Motion Graphics', ext: 'mogrt', icon: '🎞️', seedKey: 'motion_graphics', accept: '.mogrt' },
  { label: 'Ozel', ext: '', icon: '📄', seedKey: '', accept: '*' },
] as const;

const FilingTemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = useTenantId();

  const [templates, setTemplates] = useState<FilingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New template form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

  // New folder form
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingToFolderId, setUploadingToFolderId] = useState<string | null>(null);

  // Bos dosya ekleme state'i
  const [blankFileFolderId, setBlankFileFolderId] = useState<string | null>(null);
  const [blankFilePreset, setBlankFilePreset] = useState<typeof FILE_TYPE_PRESETS[number] | null>(null);
  const [blankFileName, setBlankFileName] = useState('');

  // Seed dosyaları
  const [appSeeds, setAppSeeds] = useState<AppSeedsMap>({});
  const [uploadingSeedKey, setUploadingSeedKey] = useState<string | null>(null);
  const seedInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [seedsExpanded, setSeedsExpanded] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  useEffect(() => {
    loadTemplates();
    loadSeeds();
  }, [tenantId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const result = await getFilingTemplates(tenantId);
      setTemplates(result);
      if (result.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(result[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Sablonlar yuklenirken hata olustu');
    } finally {
      setLoading(false);
    }
  };

  const loadSeeds = async () => {
    try {
      const seeds = await getAppSeeds(tenantId);
      setAppSeeds(seeds);
    } catch {
      // Seeds are optional — ignore errors
    }
  };

  const handleSeedUpload = async (e: React.ChangeEvent<HTMLInputElement>, seedKey: string) => {
    const file = e.target.files?.[0];
    if (!file || !seedKey) return;

    try {
      setUploadingSeedKey(seedKey);
      setError(null);
      const seedInfo = await uploadAppSeed(tenantId, seedKey, file);
      setAppSeeds((prev) => ({ ...prev, [seedKey]: seedInfo }));
    } catch (err: any) {
      setError(err.message || 'Seed dosyasi yuklenemedi');
    } finally {
      setUploadingSeedKey(null);
      if (seedInputRefs.current[seedKey]) {
        seedInputRefs.current[seedKey]!.value = '';
      }
    }
  };

  const handleDeleteSeed = async (seedKey: string) => {
    if (!confirm('Bu seed dosyasini silmek istediginizden emin misiniz?')) return;
    try {
      setUploadingSeedKey(seedKey);
      await deleteAppSeed(tenantId, seedKey);
      setAppSeeds((prev) => {
        const next = { ...prev };
        delete next[seedKey];
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Seed silinemedi');
    } finally {
      setUploadingSeedKey(null);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !user) return;

    try {
      setSaving(true);
      setError(null);
      const id = await createFilingTemplate(
        tenantId,
        {
          name: newTemplateName.trim(),
          description: newTemplateDesc.trim() || undefined,
          folders: [],
        },
        user.uid
      );
      setNewTemplateName('');
      setNewTemplateDesc('');
      setShowNewForm(false);
      await loadTemplates();
      setSelectedTemplateId(id);
    } catch (err: any) {
      setError(err.message || 'Sablon olusturulamadi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Bu sablonu silmek istediginizden emin misiniz?')) return;

    try {
      setSaving(true);
      await deleteFilingTemplate(tenantId, templateId);
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
      }
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Sablon silinemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim() || !selectedTemplate) return;

    try {
      setSaving(true);
      const newFolder: FilingTemplateFolder = {
        id: `folder-${Date.now()}`,
        name: newFolderName.trim(),
        parentId: newFolderParentId,
        order: selectedTemplate.folders.length,
      };

      await updateFilingTemplate(tenantId, selectedTemplate.id, {
        folders: [...selectedTemplate.folders, newFolder],
      });

      setNewFolderName('');
      setShowNewFolder(false);
      setNewFolderParentId(undefined);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Klasor eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!selectedTemplate) return;

    // Also delete child folders and files in this folder
    const childFolderIds = selectedTemplate.folders
      .filter((f) => f.parentId === folderId)
      .map((f) => f.id);

    const allFolderIdsToRemove = [folderId, ...childFolderIds];

    const updatedFolders = selectedTemplate.folders.filter(
      (f) => !allFolderIdsToRemove.includes(f.id)
    );
    const updatedFiles = selectedTemplate.files.filter(
      (f) => !allFolderIdsToRemove.includes(f.folderId)
    );

    try {
      setSaving(true);
      await updateFilingTemplate(tenantId, selectedTemplate.id, {
        folders: updatedFolders,
        files: updatedFiles,
      });
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Klasor silinemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTemplate || !uploadingToFolderId) return;

    try {
      setSaving(true);
      await uploadTemplateFile(tenantId, selectedTemplate.id, uploadingToFolderId, file);
      setUploadingToFolderId(null);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Dosya yuklenemedi');
    } finally {
      setSaving(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!selectedTemplate) return;

    try {
      setSaving(true);
      await deleteTemplateFile(tenantId, selectedTemplate.id, fileId);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Dosya silinemedi');
    } finally {
      setSaving(false);
    }
  };

  const startFileUpload = (folderId: string) => {
    setUploadingToFolderId(folderId);
    fileInputRef.current?.click();
  };

  const openBlankFileForm = (folderId: string) => {
    setBlankFileFolderId(folderId);
    setBlankFilePreset(null);
    setBlankFileName('');
  };

  const handleSelectPreset = (preset: typeof FILE_TYPE_PRESETS[number]) => {
    setBlankFilePreset(preset);
    if (preset.ext) {
      setBlankFileName(`[template].${preset.ext}`);
    } else {
      setBlankFileName('');
    }
  };

  const handleAddBlankFile = async () => {
    if (!blankFileName.trim() || !blankFileFolderId || !selectedTemplate) return;
    try {
      setSaving(true);
      // Seed varsa storageUrl olarak geç — yoksa boş dosya oluşturulur
      const seedKey = blankFilePreset?.seedKey || '';
      const seedUrl = seedKey && appSeeds[seedKey] ? appSeeds[seedKey].storageUrl : undefined;
      await addBlankTemplateFile(tenantId, selectedTemplate.id, blankFileFolderId, blankFileName.trim(), seedUrl);
      setBlankFileFolderId(null);
      setBlankFilePreset(null);
      setBlankFileName('');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Dosya eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  // Build folder tree
  const getRootFolders = () =>
    (selectedTemplate?.folders || [])
      .filter((f) => !f.parentId)
      .sort((a, b) => a.order - b.order);

  const getChildFolders = (parentId: string) =>
    (selectedTemplate?.folders || [])
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.order - b.order);

  const getFolderFiles = (folderId: string) =>
    (selectedTemplate?.files || [])
      .filter((f) => f.folderId === folderId)
      .sort((a, b) => a.order - b.order);

  const renderFolder = (folder: FilingTemplateFolder, depth: number = 0) => {
    const children = getChildFolders(folder.id);
    const files = getFolderFiles(folder.id);

    return (
      <div key={folder.id} style={{ marginLeft: depth * 20 }}>
        <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-neutral-50 group">
          <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="font-commons text-sm text-[#171717] flex-1">
            {folder.name}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => {
                setNewFolderParentId(folder.id);
                setShowNewFolder(true);
              }}
              className="p-1 hover:bg-neutral-200 rounded"
              title="Alt klasor ekle"
            >
              <FolderPlus className="w-3.5 h-3.5 text-neutral-500" />
            </button>
            <button
              onClick={() => openBlankFileForm(folder.id)}
              className="p-1 hover:bg-indigo-100 rounded"
              title="Bos dosya ekle (Premiere, Photoshop vb.)"
            >
              <FilePlus className="w-3.5 h-3.5 text-indigo-500" />
            </button>
            <button
              onClick={() => startFileUpload(folder.id)}
              className="p-1 hover:bg-neutral-200 rounded"
              title="Bilgisayardan dosya yukle"
            >
              <FileUp className="w-3.5 h-3.5 text-neutral-500" />
            </button>
            <button
              onClick={() => handleDeleteFolder(folder.id)}
              className="p-1 hover:bg-red-100 rounded"
              title="Klasoru sil"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        </div>

        {/* Bos dosya ekleme formu */}
        <AnimatePresence>
          {blankFileFolderId === folder.id && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
              style={{ marginLeft: (depth + 1) * 20 }}
            >
              <div className="my-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-commons text-xs font-semibold text-indigo-700">Bos Dosya Ekle</p>
                  <button onClick={() => setBlankFileFolderId(null)} className="p-0.5 hover:bg-indigo-100 rounded">
                    <X className="w-3.5 h-3.5 text-indigo-400" />
                  </button>
                </div>
                {/* Tip secimi */}
                <div className="flex flex-wrap gap-1.5">
                  {FILE_TYPE_PRESETS.map((preset) => (
                    <button
                      key={preset.ext || 'custom'}
                      onClick={() => handleSelectPreset(preset)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg font-commons text-xs transition-colors ${
                        blankFilePreset?.ext === preset.ext && blankFilePreset?.label === preset.label
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      <span>{preset.icon}</span>
                      {preset.label}
                    </button>
                  ))}
                </div>
                {/* Dosya adi */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={blankFileName}
                    onChange={(e) => setBlankFileName(e.target.value)}
                    placeholder="[template].prproj"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white font-commons text-xs focus:outline-none focus:border-indigo-400"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddBlankFile(); }}
                  />
                  <button
                    onClick={handleAddBlankFile}
                    disabled={saving || !blankFileName.trim()}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-commons text-xs font-medium disabled:opacity-50 hover:bg-indigo-700"
                  >
                    Ekle
                  </button>
                </div>
                {/* Seed göstergesi */}
                {blankFilePreset?.seedKey && appSeeds[blankFilePreset.seedKey] ? (
                  <p className="font-commons text-xs text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Seed bulundu: <strong>{appSeeds[blankFilePreset.seedKey].fileName}</strong> — geçerli proje dosyası kopyalanacak
                  </p>
                ) : blankFilePreset?.seedKey ? (
                  <p className="font-commons text-xs text-amber-600">
                    Bu dosya türü için seed yüklenmemiş — boş dosya oluşturulacak. Seed yüklemek için sayfanın üstündeki "Başlangıç Dosyaları" bölümünü kullanın.
                  </p>
                ) : (
                  <p className="font-commons text-xs text-indigo-500">
                    <code className="bg-indigo-100 px-1 rounded">[template]</code> ifadesi proje oluşturulurken klasör adıyla değişir
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Files in this folder */}
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-neutral-50 group"
            style={{ marginLeft: (depth + 1) * 20 }}
          >
            <File className={`w-3.5 h-3.5 flex-shrink-0 ${file.isBlank ? 'text-indigo-400' : 'text-blue-400'}`} />
            <span className="font-commons text-xs text-neutral-600 flex-1 truncate">
              {file.name}
            </span>
            {file.isBlank ? (
              <span className="font-commons text-xs text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">
                bos
              </span>
            ) : (
              <span className="font-commons text-xs text-neutral-400">
                {(file.size / 1024).toFixed(0)} KB
              </span>
            )}
            <button
              onClick={() => handleDeleteFile(file.id)}
              className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          </div>
        ))}

        {/* Child folders */}
        {children.map((child) => renderFolder(child, depth + 1))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input — accepts project files + common media types */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".prproj,.aep,.mogrt,.fcpxml,.xml,.zip,.pdf,.jpg,.jpeg,.png,.psd,.ai,.indd"
        onChange={handleFileUpload}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              to="/admin/filing"
              className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-600" />
            </Link>
            <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
              Sablon Yonetimi
            </h1>
          </div>
          <p className="font-grotesk text-neutral-500 mt-1 ml-10">
            Dosyalama sablonlarini olusturun ve yonetin
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="font-grotesk text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            &times;
          </button>
        </motion.div>
      )}

      {/* Seed dosyaları — gizli input'lar */}
      {FILE_TYPE_PRESETS.filter((p) => p.seedKey).map((preset) => (
        <input
          key={preset.seedKey}
          ref={(el) => { seedInputRefs.current[preset.seedKey] = el; }}
          type="file"
          className="hidden"
          accept={preset.accept}
          onChange={(e) => handleSeedUpload(e, preset.seedKey)}
        />
      ))}

      {/* Uygulama Başlangıç Dosyaları — collapsible */}
      <div className="admin-card">
        <button
          onClick={() => setSeedsExpanded((v) => !v)}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <h2 className="font-grotesk text-base font-semibold text-[#171717]">
              Uygulama Baslangic Dosyalari
            </h2>
            {Object.keys(appSeeds).length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-commons text-xs">
                <CheckCircle2 className="w-3 h-3" />
                {Object.keys(appSeeds).length} seed yuklendi
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-neutral-400 transition-transform ${seedsExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {seedsExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="font-grotesk text-sm text-neutral-500 mt-3 mb-4">
                Post Haste gibi — her proje olusturulunca bu dosyalar kopyalanir. Bir kere yukle, her zaman kullan.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {FILE_TYPE_PRESETS.filter((p) => p.seedKey).map((preset) => {
                  const seed = appSeeds[preset.seedKey];
                  const isUploading = uploadingSeedKey === preset.seedKey;
                  return (
                    <div
                      key={preset.seedKey}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-colors ${
                        seed ? 'border-green-200 bg-green-50' : 'border-neutral-100 bg-neutral-50'
                      }`}
                    >
                      <span className="text-2xl">{preset.icon}</span>
                      <p className="font-commons text-xs font-medium text-[#171717] leading-tight">
                        {preset.label}
                      </p>
                      {seed ? (
                        <>
                          <p className="font-commons text-xs text-green-600 truncate w-full" title={seed.fileName}>
                            {seed.fileName}
                          </p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => seedInputRefs.current[preset.seedKey]?.click()}
                              disabled={isUploading}
                              className="px-2 py-1 text-xs font-commons text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 disabled:opacity-50"
                            >
                              {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guncelle'}
                            </button>
                            <button
                              onClick={() => handleDeleteSeed(preset.seedKey)}
                              disabled={isUploading}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => seedInputRefs.current[preset.seedKey]?.click()}
                          disabled={isUploading}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-commons text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 disabled:opacity-50"
                        >
                          {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          Yukle
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Template List */}
        <div className="admin-card-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-grotesk text-lg font-bold text-[#171717]">
              Sablonlar
            </h2>
            <div className="flex gap-1">
              <button
                onClick={() => setShowNewForm(true)}
                className="p-1.5 bg-[#171717] text-white rounded-lg hover:bg-neutral-800 transition-colors"
                title="Yeni sablon"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* New template form */}
          <AnimatePresence>
            {showNewForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 overflow-hidden"
              >
                <div className="p-3 bg-neutral-50 rounded-xl space-y-2">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Sablon adi..."
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={newTemplateDesc}
                    onChange={(e) => setNewTemplateDesc(e.target.value)}
                    placeholder="Aciklama (opsiyonel)..."
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateTemplate}
                      disabled={saving || !newTemplateName.trim()}
                      className="flex-1 px-3 py-1.5 bg-[#171717] text-white rounded-lg font-commons text-sm disabled:opacity-50"
                    >
                      {saving ? 'Olusturuluyor...' : 'Olustur'}
                    </button>
                    <button
                      onClick={() => { setShowNewForm(false); setNewTemplateName(''); setNewTemplateDesc(''); }}
                      className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-200 rounded-lg font-commons text-sm"
                    >
                      Iptal
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Template list */}
          <div className="space-y-1">
            {templates.length === 0 ? (
              <p className="font-commons text-sm text-neutral-400 py-4 text-center">
                Henuz sablon yok
              </p>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    selectedTemplateId === template.id
                      ? 'bg-[#171717] text-white'
                      : 'hover:bg-neutral-50 text-[#171717]'
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <Folder
                    className={`w-5 h-5 flex-shrink-0 ${
                      selectedTemplateId === template.id ? 'text-white' : 'text-amber-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-commons text-sm font-medium truncate">
                      {template.name}
                    </p>
                    <p
                      className={`font-commons text-xs truncate ${
                        selectedTemplateId === template.id ? 'text-neutral-300' : 'text-neutral-400'
                      }`}
                    >
                      {template.folders.length} klasor, {template.files.length} dosya
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id);
                    }}
                    className={`p-1 rounded hover:bg-red-100 transition-colors ${
                      selectedTemplateId === template.id
                        ? 'hover:bg-white/20 text-neutral-300 hover:text-white'
                        : 'text-neutral-400 hover:text-red-500'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Template Detail */}
        <div className="lg:col-span-2 admin-card-sm">
          {!selectedTemplate ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-400">
              <Folder className="w-12 h-12 mb-3" />
              <p className="font-commons text-sm">Bir sablon secin veya yeni olusturun</p>
            </div>
          ) : (
            <>
              {/* Template header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-grotesk text-lg font-bold text-[#171717]">
                    {selectedTemplate.name}
                  </h2>
                  {selectedTemplate.description && (
                    <p className="font-commons text-sm text-neutral-500 mt-0.5">
                      {selectedTemplate.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setNewFolderParentId(undefined);
                      setShowNewFolder(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg font-commons text-sm transition-colors"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Klasor Ekle
                  </button>
                </div>
              </div>

              {/* New folder form */}
              <AnimatePresence>
                {showNewFolder && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="p-3 bg-neutral-50 rounded-xl">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Klasor adi (orn: 01_Project_Files)..."
                          className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddFolder();
                          }}
                        />
                        <button
                          onClick={handleAddFolder}
                          disabled={saving || !newFolderName.trim()}
                          className="px-3 py-2 bg-[#171717] text-white rounded-lg font-commons text-sm disabled:opacity-50"
                        >
                          Ekle
                        </button>
                        <button
                          onClick={() => {
                            setShowNewFolder(false);
                            setNewFolderName('');
                            setNewFolderParentId(undefined);
                          }}
                          className="px-3 py-2 text-neutral-600 hover:bg-neutral-200 rounded-lg font-commons text-sm"
                        >
                          Iptal
                        </button>
                      </div>
                      {newFolderParentId && (
                        <p className="font-commons text-xs text-neutral-500 mt-2">
                          Alt klasor: {selectedTemplate.folders.find((f) => f.id === newFolderParentId)?.name}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Folder tree */}
              <div className="border border-neutral-100 rounded-xl p-4 min-h-[200px]">
                {getRootFolders().length === 0 && selectedTemplate.files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-neutral-400">
                    <FolderPlus className="w-8 h-8 mb-2" />
                    <p className="font-commons text-sm">Klasor ekleyerek baslayın</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {getRootFolders().map((folder) => renderFolder(folder))}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="mt-4 p-3 bg-blue-50 rounded-xl space-y-1.5">
                <p className="font-commons text-xs text-blue-700">
                  <strong>Ipucu:</strong> Dosya adlarinda <code className="bg-blue-100 px-1 rounded">[template]</code> placeholder'ini
                  kullanin. Proje olusturulurken otomatik olarak proje adiyla degistirilecektir.
                  Ornek: <code className="bg-blue-100 px-1 rounded">[template].prproj</code> → <code className="bg-blue-100 px-1 rounded">Sevgililer Gunu.prproj</code>
                </p>
                <p className="font-commons text-xs text-blue-600">
                  <strong>Desteklenen dosyalar:</strong> .prproj (Premiere Pro), .aep (After Effects), .mogrt, .fcpxml, .zip, .pdf, .psd, .ai ve diger proje dosyalari
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilingTemplatesPage;
