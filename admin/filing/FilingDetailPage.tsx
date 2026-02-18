import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Folder,
  File,
  HardDrive,
  Calendar,
  User,
  FileText,
  Save,
  Loader2,
  AlertCircle,
  Archive,
  Copy,
  CheckCircle2,
  Trash2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useTenantId } from '@/shared/hooks/useTenant';
import {
  getFilingProject,
  updateFilingProject,
  deleteFilingProject,
  getFilingTemplate,
} from '@/shared/services/filingService';
import {
  isFileSystemAccessSupported,
  selectRootDirectory,
  persistDirectoryHandle,
  getPersistedDirectoryHandle,
  verifyPermission,
  createProjectFolders,
  copyTemplateFiles,
} from '@/shared/utils/fileSystemAccess';
import {
  FILING_STATUS_LABELS,
  FILING_STATUS_COLORS,
} from '@/shared/types/filing';
import type { FilingProject, FilingTemplate } from '@/shared/types/filing';

const FilingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tenantId = useTenantId();

  const [project, setProject] = useState<FilingProject | null>(null);
  const [template, setTemplate] = useState<FilingTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  // Lokal klasör yeniden oluşturma
  type StepStatus = 'success' | 'error' | 'skipped';
  type StepResult = { label: string; status: StepStatus; detail?: string };
  const [fsSupported] = useState(isFileSystemAccessSupported());
  const [rootDirHandle, setRootDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [recreating, setRecreating] = useState(false);
  const [recreateSteps, setRecreateSteps] = useState<StepResult[]>([]);

  useEffect(() => {
    if (id) loadProject();
    loadPersistedHandle();
  }, [id, tenantId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const proj = await getFilingProject(tenantId, id!);
      if (!proj) {
        setError('Proje bulunamadi');
        return;
      }
      setProject(proj);
      setNotes(proj.notes || '');

      // Load template for folder structure
      if (proj.templateId) {
        const tmpl = await getFilingTemplate(tenantId, proj.templateId);
        setTemplate(tmpl);
      }
    } catch (err: any) {
      setError(err.message || 'Proje yuklenirken hata olustu');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!project) return;
    try {
      setSaving(true);
      await updateFilingProject(tenantId, project.id, { notes });
      setProject({ ...project, notes });
    } catch (err: any) {
      setError(err.message || 'Notlar kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!confirm(`"#${project.projectNumber} ${project.projectName}" projesini silmek istediginizden emin misiniz?\n\nBu islem geri alinamaz. Lokal klasorler etkilenmez.`)) return;

    try {
      setSaving(true);
      await deleteFilingProject(tenantId, project.id);
      navigate('/admin/filing');
    } catch (err: any) {
      setError(err.message || 'Proje silinemedi');
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!project) return;
    if (!confirm('Bu projeyi arsivlemek istediginizden emin misiniz?')) return;

    try {
      setSaving(true);
      const newStatus = project.status === 'archived' ? 'created' : 'archived';
      await updateFilingProject(tenantId, project.id, { status: newStatus });
      setProject({ ...project, status: newStatus });
    } catch (err: any) {
      setError(err.message || 'Durum degistirilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFolderName = async () => {
    if (!project) return;
    try {
      await navigator.clipboard.writeText(project.folderName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const loadPersistedHandle = async () => {
    if (!isFileSystemAccessSupported()) return;
    try {
      const handle = await getPersistedDirectoryHandle();
      if (handle) {
        const hasPermission = await verifyPermission(handle);
        if (hasPermission) setRootDirHandle(handle);
      }
    } catch {
      // Ignore
    }
  };

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

  const handleRecreate = async () => {
    if (!project || !template) return;

    setRecreating(true);
    setRecreateSteps([]);
    const steps: StepResult[] = [];

    // Disk seçimi
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
        steps.push({ label: 'Disk secimi', status: 'skipped', detail });
        setRecreateSteps([...steps]);
        setRecreating(false);
        return;
      }
    }

    // Klasör oluşturma
    let projectDirHandle: FileSystemDirectoryHandle | null = null;
    try {
      const hasPermission = await verifyPermission(dirHandle!);
      if (!hasPermission) {
        throw new Error(`"${dirHandle!.name}" diskine erisim izni verilemedi — disk takili mi?`);
      }
      projectDirHandle = await createProjectFolders(dirHandle!, project.folderName, template);
      steps.push({
        label: 'Klasorler olusturuldu',
        status: 'success',
        detail: `${template.folders.length} klasor — ${dirHandle!.name}/${project.folderName}`,
      });
    } catch (err: any) {
      steps.push({
        label: 'Klasorler olusturulamadi',
        status: 'error',
        detail: err.message || 'Disk erisim hatasi — dogru diski sectiniz mi?',
      });
      setRecreateSteps([...steps]);
      setRecreating(false);
      return;
    }

    // Dosya oluşturma
    const fileCount = template.files.length;
    if (fileCount === 0) {
      steps.push({ label: 'Dosya olusturma', status: 'skipped', detail: 'Sablonda dosya tanimlanmamis' });
    } else {
      try {
        await copyTemplateFiles(projectDirHandle!, template, project.folderName);
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

    setRecreateSteps([...steps]);
    setRecreating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-neutral-300 mb-3" />
        <p className="font-commons text-neutral-500">Proje bulunamadi</p>
        <Link
          to="/admin/filing"
          className="mt-4 text-sm font-commons text-indigo-600 hover:underline"
        >
          Dosyalama listesine don
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
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
              #{project.projectNumber} {project.projectName}
            </h1>
          </div>
          <p className="font-grotesk text-neutral-500 mt-1 ml-10">
            {project.clientName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex px-3 py-1.5 rounded-full font-commons text-xs font-medium ${
              FILING_STATUS_COLORS[project.status]
            }`}
          >
            {FILING_STATUS_LABELS[project.status]}
          </span>
          <button
            onClick={handleArchive}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-full font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
            {project.status === 'archived' ? 'Arsivden Cikar' : 'Arsivle'}
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-full font-commons text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Sil
          </button>
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
        </motion.div>
      )}

      {/* Folder Name */}
      <div className="admin-card">
        <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-3">
          Klasor Adi
        </h2>
        <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-xl">
          <Folder className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <span className="font-mono text-sm text-[#171717] font-medium flex-1 break-all">
            {project.folderName}
          </span>
          <button
            onClick={handleCopyFolderName}
            className="p-2 hover:bg-neutral-200 rounded-lg transition-colors flex-shrink-0"
            title="Kopyala"
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-neutral-400" />
            )}
          </button>
        </div>
      </div>

      {/* Project Details */}
      <div className="admin-card">
        <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-5">
          Proje Bilgileri
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <span className="font-mono text-xs font-bold text-blue-600">
                #{project.projectNumber}
              </span>
            </div>
            <div>
              <p className="font-commons text-xs text-neutral-500">Proje No</p>
              <p className="font-commons text-sm text-[#171717] font-medium">
                {project.projectNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="font-commons text-xs text-neutral-500">Musteri</p>
              <p className="font-commons text-sm text-[#171717] font-medium">
                {project.clientName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="font-commons text-xs text-neutral-500">Tarih</p>
              <p className="font-commons text-sm text-[#171717] font-medium">
                {project.date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="font-commons text-xs text-neutral-500">Editor</p>
              <p className="font-commons text-sm text-[#171717] font-medium">
                {project.editor}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="font-commons text-xs text-neutral-500">Sablon</p>
              <p className="font-commons text-sm text-[#171717] font-medium">
                {project.templateName}
              </p>
            </div>
          </div>

          {project.hardDisk && (
            <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <HardDrive className="w-4 h-4 text-neutral-600" />
              </div>
              <div>
                <p className="font-commons text-xs text-neutral-500">Harddisk</p>
                <p className="font-commons text-sm text-[#171717] font-medium">
                  {project.hardDisk}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Folder Structure */}
      {template && (
        <div className="admin-card">
          <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-4">
            Klasor Yapisi
          </h2>
          <div className="p-4 bg-neutral-50 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-500" />
              <span className="font-mono text-xs text-[#171717] font-medium">
                {project.folderName}/
              </span>
            </div>
            {template.folders
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
                  {template.files
                    .filter((f) => f.folderId === folder.id)
                    .map((file) => (
                      <div key={file.id} className="flex items-center gap-2 ml-10">
                        <File className="w-3 h-3 text-blue-400" />
                        <span className="font-mono text-xs text-neutral-500">
                          {file.name.replace(/\[template\]/gi, project.folderName)}
                        </span>
                      </div>
                    ))}
                  {template.folders
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

      {/* Recreate Local Folders */}
      {template && (
        <div className="admin-card">
          <h2 className="font-grotesk text-lg font-bold text-[#171717] mb-1">
            Bilgisayarda Yeniden Olustur
          </h2>
          <p className="font-grotesk text-sm text-neutral-500 mb-5">
            Klasor yapisini ve dosyalari bilgisayarinizda tekrar olusturun
          </p>

          {!fsSupported ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="font-commons text-sm text-amber-700">
                Lokal klasor olusturmak icin Chrome veya Edge tarayicisi gereklidir.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Disk Seçimi */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectDirectory}
                  disabled={recreating}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-200 rounded-xl font-commons text-sm hover:bg-neutral-50 transition-colors disabled:opacity-50"
                >
                  <HardDrive className="w-4 h-4" />
                  {rootDirHandle ? `Disk: ${rootDirHandle.name}` : 'Disk Sec'}
                </button>
                {rootDirHandle && (
                  <span className="font-commons text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {rootDirHandle.name}
                  </span>
                )}
              </div>

              {/* Oluştur Butonu */}
              <motion.button
                type="button"
                onClick={handleRecreate}
                disabled={recreating}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white rounded-full font-commons text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                whileHover={{ scale: recreating ? 1 : 1.02 }}
                whileTap={{ scale: recreating ? 1 : 0.98 }}
              >
                {recreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Olusturuluyor...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Klasorleri Yeniden Olustur
                  </>
                )}
              </motion.button>

              {/* Adım Sonuçları */}
              {recreateSteps.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    borderColor: recreateSteps.some(s => s.status === 'error') ? '#fca5a5' : '#86efac',
                    backgroundColor: recreateSteps.some(s => s.status === 'error') ? '#fff1f2' : '#f0fdf4',
                  }}
                >
                  <div
                    className="px-4 py-3 border-b flex items-center gap-2"
                    style={{ borderColor: recreateSteps.some(s => s.status === 'error') ? '#fca5a5' : '#86efac' }}
                  >
                    {recreateSteps.some(s => s.status === 'error') ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                    <span className="font-grotesk text-sm font-semibold text-[#171717]">
                      {recreateSteps.some(s => s.status === 'error')
                        ? 'Bazi adimlar tamamlanamadi'
                        : 'Klasorler basariyla olusturuldu'}
                    </span>
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {recreateSteps.map((step, i) => (
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
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="admin-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-grotesk text-lg font-bold text-[#171717]">
            Notlar
          </h2>
          {notes !== (project.notes || '') && (
            <motion.button
              onClick={handleSaveNotes}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] text-white rounded-lg font-commons text-sm disabled:opacity-50"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Kaydet
            </motion.button>
          )}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notlarinizi buraya yazin..."
          rows={4}
          className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400 transition-colors resize-none"
        />
      </div>

      {/* Meta */}
      <div className="text-center">
        <p className="font-commons text-xs text-neutral-400">
          Olusturan: {project.createdByName} &middot;{' '}
          {project.createdAt?.toDate?.()
            ? new Date(project.createdAt.toDate()).toLocaleString('tr-TR')
            : project.date}
        </p>
      </div>
    </div>
  );
};

export default FilingDetailPage;
