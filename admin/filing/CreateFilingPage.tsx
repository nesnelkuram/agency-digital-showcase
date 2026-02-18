import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Save,
  Loader2,
  AlertCircle,
  ArrowLeft,
  FolderOpen,
  HardDrive,
  Eye,
  Folder,
  File,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import {
  createFilingProject,
  getFilingTemplates,
  peekNextProjectNumber,
} from '@/shared/services/filingService';
import {
  isFileSystemAccessSupported,
  selectRootDirectory,
  persistDirectoryHandle,
  getPersistedDirectoryHandle,
  verifyPermission,
  createProjectFolders,
  copyTemplateFiles,
  generateFolderName,
} from '@/shared/utils/fileSystemAccess';
import type { FilingTemplate } from '@/shared/types/filing';

const CreateFilingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = useTenantId();

  // Form state
  const [projectNumber, setProjectNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [editor, setEditor] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [hardDisk, setHardDisk] = useState('');
  const [notes, setNotes] = useState('');

  // Data
  const [templates, setTemplates] = useState<FilingTemplate[]>([]);
  const [loadingNumber, setLoadingNumber] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Adim adim sonuc takibi
  type StepStatus = 'success' | 'error' | 'skipped' | 'pending';
  type StepResult = { label: string; status: StepStatus; detail?: string };
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  // File System
  const [fsSupported] = useState(isFileSystemAccessSupported());
  const [rootDirHandle, setRootDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [localFolderCreation, setLocalFolderCreation] = useState(true);

  // Load initial data
  useEffect(() => {
    loadProjectNumber();
    loadTemplates();
    loadPersistedHandle();
  }, [tenantId]);

  // Set default editor from user name
  useEffect(() => {
    if (user?.displayName && !editor) {
      setEditor(user.displayName);
    }
  }, [user]);

  const loadProjectNumber = async () => {
    try {
      setLoadingNumber(true);
      const num = await peekNextProjectNumber(tenantId);
      setProjectNumber(num);
    } catch (err) {
      console.error('Error loading project number:', err);
    } finally {
      setLoadingNumber(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const result = await getFilingTemplates(tenantId);
      setTemplates(result);
      if (result.length > 0) {
        setSelectedTemplateId(result[0].id);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadPersistedHandle = async () => {
    if (!fsSupported) return;
    try {
      const handle = await getPersistedDirectoryHandle();
      if (handle) {
        const hasPermission = await verifyPermission(handle);
        if (hasPermission) {
          setRootDirHandle(handle);
        }
      }
    } catch {
      // Ignore - handle may have expired
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  // Live preview of folder name
  const previewFolderName = useMemo(() => {
    if (!clientName.trim() || !projectName.trim()) return '';
    return generateFolderName(
      projectNumber || '0001',
      clientName.trim(),
      projectName.trim(),
      date,
      editor.trim() || 'editor'
    );
  }, [projectNumber, clientName, projectName, date, editor]);

  const handleSelectDirectory = async () => {
    try {
      const handle = await selectRootDirectory();
      setRootDirHandle(handle);
      await persistDirectoryHandle(handle);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('Klasor secimi basarisiz: ' + err.message);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) { setError('Musteri adi zorunludur'); return; }
    if (!projectName.trim()) { setError('Proje adi zorunludur'); return; }
    if (!editor.trim()) { setError('Editor adi zorunludur'); return; }
    if (!selectedTemplateId) { setError('Sablon secimi zorunludur'); return; }
    if (!user) { setError('Oturum bulunamadi'); return; }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setStepResults([]);
    setCreatedProjectId(null);

    const steps: StepResult[] = [];

    // ── Adim 1: Firestore kaydı ──────────────────────────────
    let result: { id: string; projectNumber: string; folderName: string } | null = null;
    try {
      result = await createFilingProject(
        tenantId,
        {
          clientName: clientName.trim(),
          projectName: projectName.trim(),
          date,
          editor: editor.trim(),
          templateId: selectedTemplateId,
          templateName: selectedTemplate?.name || '',
          hardDisk: hardDisk.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      steps.push({ label: 'Proje kaydedildi', status: 'success', detail: `#${result.projectNumber} — ${result.folderName}` });
      setCreatedProjectId(result.id);
    } catch (err: any) {
      steps.push({ label: 'Proje kaydedilemedi', status: 'error', detail: err.message || 'Firestore hatasi' });
      setStepResults([...steps]);
      setSubmitting(false);
      return;
    }

    // ── Adim 2: Lokal klasör oluşturma ───────────────────────
    if (!fsSupported || !localFolderCreation || !selectedTemplate) {
      steps.push({ label: 'Lokal klasorler', status: 'skipped', detail: 'Lokal klasor olusturma kapali veya desteklenmiyor' });
      setStepResults([...steps]);
      setSubmitting(false);
      return;
    }

    let dirHandle = rootDirHandle;
    if (!dirHandle) {
      try {
        dirHandle = await selectRootDirectory();
        setRootDirHandle(dirHandle);
        await persistDirectoryHandle(dirHandle);
      } catch (err: any) {
        const detail = err.name === 'AbortError'
          ? 'Klasor secimi iptal edildi'
          : `Klasor secimi basarisiz: ${err.message}`;
        steps.push({ label: 'Lokal klasorler', status: 'skipped', detail });
        setStepResults([...steps]);
        setSubmitting(false);
        return;
      }
    }

    let projectDirHandle: FileSystemDirectoryHandle | null = null;
    try {
      const hasPermission = await verifyPermission(dirHandle!);
      if (!hasPermission) {
        throw new Error(`"${dirHandle!.name}" diskine erisim izni verilemedi — disk takili mi?`);
      }
      projectDirHandle = await createProjectFolders(dirHandle!, result.folderName, selectedTemplate);
      steps.push({
        label: 'Klasorler olusturuldu',
        status: 'success',
        detail: `${selectedTemplate.folders.length} klasor — ${dirHandle!.name}/${result.folderName}`,
      });
    } catch (err: any) {
      steps.push({
        label: 'Klasorler olusturulamadi',
        status: 'error',
        detail: err.message || 'Disk erisim hatasi — dogru diski sectiniz mi?',
      });
      setStepResults([...steps]);
      setSubmitting(false);
      return;
    }

    // ── Adim 3: Dosya oluşturma ──────────────────────────────
    const fileCount = selectedTemplate.files.length;
    if (fileCount === 0) {
      steps.push({ label: 'Dosya olusturma', status: 'skipped', detail: 'Sablonda dosya tanimlanmamis' });
    } else {
      try {
        await copyTemplateFiles(projectDirHandle!, selectedTemplate, result.folderName);
        steps.push({
          label: 'Dosyalar olusturuldu',
          status: 'success',
          detail: `${fileCount} dosya klasore eklendi`,
        });
      } catch (err: any) {
        steps.push({
          label: 'Dosyalar olusturulamadi',
          status: 'error',
          detail: err.message || 'Dosya yazma hatasi',
        });
      }
    }

    setStepResults([...steps]);
    setSubmitting(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link
            to="/admin/filing"
            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </Link>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Yeni Proje Dosyala
          </h1>
        </div>
        <p className="font-grotesk text-neutral-500 mt-1 ml-10">
          Proje bilgilerini girin ve dosyalama yapisini olusturun
        </p>
      </div>

      {/* Browser support warning */}
      {!fsSupported && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="font-grotesk text-sm font-medium text-amber-800">
              File System Access API desteklenmiyor
            </p>
            <p className="font-grotesk text-xs text-amber-600 mt-0.5">
              Lokal klasor olusturmak icin Chrome veya Edge tarayicisini kullanin.
              Proje kaydi yine de Firestore'a kaydedilecektir.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="font-grotesk text-sm text-red-700">{error}</p>
        </motion.div>
      )}

      {/* Adim adim sonuc paneli */}
      {stepResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border overflow-hidden"
          style={{
            borderColor: stepResults.some(s => s.status === 'error') ? '#fca5a5' : '#86efac',
            backgroundColor: stepResults.some(s => s.status === 'error') ? '#fff1f2' : '#f0fdf4',
          }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: stepResults.some(s => s.status === 'error') ? '#fca5a5' : '#86efac' }}
          >
            <div className="flex items-center gap-2">
              {stepResults.some(s => s.status === 'error') ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
              <span className="font-grotesk text-sm font-semibold text-[#171717]">
                {stepResults.some(s => s.status === 'error') ? 'Bazi adimlar tamamlanamadi' : 'Proje basariyla olusturuldu'}
              </span>
            </div>
            {createdProjectId && (
              <button
                onClick={() => navigate(`/admin/filing/${createdProjectId}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] text-white rounded-lg font-commons text-xs font-medium hover:bg-neutral-800 transition-colors"
              >
                Projeyi Goruntule
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="divide-y divide-neutral-100">
            {stepResults.map((step, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />}
                {step.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
                {step.status === 'skipped' && <div className="w-4 h-4 rounded-full border-2 border-neutral-300 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className={`font-commons text-sm font-medium ${
                    step.status === 'error' ? 'text-red-700' :
                    step.status === 'skipped' ? 'text-neutral-500' : 'text-[#171717]'
                  }`}>{step.label}</p>
                  {step.detail && (
                    <p className={`font-commons text-xs mt-0.5 ${
                      step.status === 'error' ? 'text-red-500' : 'text-neutral-500'
                    }`}>{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {stepResults.some(s => s.status === 'error' && s.label.includes('Klasor')) && (
            <div className="px-4 py-3 border-t bg-amber-50 border-amber-200">
              <p className="font-commons text-xs text-amber-700">
                💡 Proje Firestore'a kaydedildi. Klasor olusturmak icin dogru diski secip tekrar deneyebilirsiniz.
              </p>
            </div>
          )}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Info */}
        <div className="admin-card">
          <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-5">
            Proje Bilgileri
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Number */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Proje Numarasi
              </label>
              <div className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-commons text-sm text-neutral-600">
                {loadingNumber ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Yukleniyor...
                  </span>
                ) : (
                  <span className="font-mono font-medium">{projectNumber}</span>
                )}
              </div>
              <p className="font-grotesk text-xs text-neutral-400 mt-1">
                Otomatik artar
              </p>
            </div>

            {/* Date */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Tarih
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            {/* Client Name */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Musteri <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Selen Magazcioglu"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            {/* Project Name */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Proje Adi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Sevgililer Gunu"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            {/* Editor */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Editor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editor}
                onChange={(e) => setEditor(e.target.value)}
                placeholder="intiba"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>

            {/* Hard Disk */}
            <div>
              <label className="block font-grotesk text-sm font-medium text-[#171717] mb-1.5">
                Harddisk Etiketi
              </label>
              <input
                type="text"
                value={hardDisk}
                onChange={(e) => setHardDisk(e.target.value)}
                placeholder="SSD-01, WD-4TB, vb."
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Template Selection */}
        <div className="admin-card">
          <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-2">
            Sablon
          </h2>
          <p className="font-grotesk text-sm text-neutral-500 mb-5">
            Dosyalama yapisini belirleyen sablonu secin
          </p>

          {loadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-commons text-sm text-neutral-400 mb-3">
                Henuz sablon olusturulmamis
              </p>
              <Link
                to="/admin/filing/templates"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-xl font-commons text-sm hover:bg-neutral-800 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Sablon Olustur
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((template) => {
                const isSelected = selectedTemplateId === template.id;
                return (
                  <motion.button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                      isSelected
                        ? 'border-[#171717] bg-neutral-50'
                        : 'border-neutral-100 bg-white hover:border-neutral-200'
                    }`}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-[#171717]' : 'bg-amber-50'
                    }`}>
                      <Folder className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-amber-500'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-commons text-sm font-medium text-[#171717]">
                        {template.name}
                      </p>
                      <p className="font-commons text-xs text-neutral-500 mt-0.5">
                        {template.folders.length} klasor, {template.files.length} dosya
                      </p>
                      {template.description && (
                        <p className="font-commons text-xs text-neutral-400 mt-1 truncate">
                          {template.description}
                        </p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 ${
                      isSelected ? 'border-[#171717] bg-[#171717]' : 'border-neutral-300 bg-white'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Local Folder Settings */}
        {fsSupported && (
          <div className="admin-card">
            <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-2">
              Lokal Klasor Ayarlari
            </h2>
            <p className="font-grotesk text-sm text-neutral-500 mb-5">
              Bilgisayarinizda klasor yapisi olusturun
            </p>

            <div className="space-y-4">
              {/* Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    localFolderCreation ? 'bg-[#171717]' : 'bg-neutral-300'
                  }`}
                  onClick={() => setLocalFolderCreation(!localFolderCreation)}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      localFolderCreation ? 'translate-x-5' : ''
                    }`}
                  />
                </div>
                <span className="font-commons text-sm text-[#171717]">
                  Lokal klasor olustur
                </span>
              </label>

              {localFolderCreation && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSelectDirectory}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-200 rounded-xl font-commons text-sm hover:bg-neutral-50 transition-colors"
                  >
                    <HardDrive className="w-4 h-4" />
                    {rootDirHandle ? 'Klasor Degistir' : 'Root Klasor Sec'}
                  </button>
                  {rootDirHandle && (
                    <span className="font-commons text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Klasor secildi: {rootDirHandle.name}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview */}
        {previewFolderName && (
          <div className="admin-card">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-neutral-500" />
              <h2 className="font-grotesk text-lg font-bold text-[#171717]">
                Onizleme
              </h2>
            </div>

            {/* Folder name preview */}
            <div className="p-4 bg-neutral-50 rounded-xl mb-4">
              <p className="font-commons text-xs text-neutral-500 mb-1">Klasor Adi:</p>
              <p className="font-mono text-sm text-[#171717] font-medium break-all">
                {previewFolderName}
              </p>
            </div>

            {/* Folder structure preview */}
            {selectedTemplate && (
              <div className="p-4 bg-neutral-50 rounded-xl">
                <p className="font-commons text-xs text-neutral-500 mb-2">Klasor Yapisi:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-amber-500" />
                    <span className="font-mono text-xs text-[#171717] font-medium">
                      {previewFolderName}/
                    </span>
                  </div>
                  {selectedTemplate.folders
                    .filter((f) => !f.parentId)
                    .sort((a, b) => a.order - b.order)
                    .map((folder) => (
                      <React.Fragment key={folder.id}>
                        <div className="flex items-center gap-2 ml-5">
                          <Folder className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-mono text-xs text-neutral-600">
                            {folder.name}/
                          </span>
                        </div>
                        {/* Show files in this folder */}
                        {selectedTemplate.files
                          .filter((f) => f.folderId === folder.id)
                          .map((file) => (
                            <div key={file.id} className="flex items-center gap-2 ml-10">
                              <File className="w-3 h-3 text-blue-400" />
                              <span className="font-mono text-xs text-neutral-500">
                                {file.name.replace(/\[template\]/gi, previewFolderName || 'KlasorAdi')}
                              </span>
                            </div>
                          ))}
                        {/* Show child folders */}
                        {selectedTemplate.folders
                          .filter((f) => f.parentId === folder.id)
                          .sort((a, b) => a.order - b.order)
                          .map((child) => (
                            <div key={child.id} className="flex items-center gap-2 ml-10">
                              <Folder className="w-3 h-3 text-amber-300" />
                              <span className="font-mono text-xs text-neutral-500">
                                {child.name}/
                              </span>
                            </div>
                          ))}
                      </React.Fragment>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="admin-card">
          <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-4">
            Notlar
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opsiyonel notlar..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400 transition-colors resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/filing')}
            className="px-6 py-2.5 rounded-full font-grotesk text-sm font-medium text-neutral-600 hover:text-[#171717] transition-colors"
          >
            Iptal
          </button>
          <motion.button
            type="submit"
            disabled={submitting || !clientName.trim() || !projectName.trim() || !editor.trim() || !selectedTemplateId}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            whileHover={{ scale: submitting ? 1 : 1.02 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Olusturuluyor...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Proje Olustur
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default CreateFilingPage;
