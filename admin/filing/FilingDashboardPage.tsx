import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  FolderOpen,
  HardDrive,
  Calendar,
  User,
  Settings2,
  Loader2,
  AlertCircle,
  FileText,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { useTenantId } from '@/shared/hooks/useTenant';
import {
  getFilingProjects,
  getFilingStats,
  deleteFilingProject,
} from '@/shared/services/filingService';
import {
  FILING_STATUS_LABELS,
  FILING_STATUS_COLORS,
} from '@/shared/types/filing';
import type { FilingProject } from '@/shared/types/filing';

const FilingDashboardPage: React.FC = () => {
  const tenantId = useTenantId();

  const [projects, setProjects] = useState<FilingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    thisMonth: number;
    editors: Record<string, number>;
    templates: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [projectsResult, statsResult] = await Promise.all([
        getFilingProjects(tenantId),
        getFilingStats(tenantId),
      ]);

      setProjects(projectsResult.projects);
      setStats(statsResult);
    } catch (err: any) {
      setError(err.message || 'Veriler yuklenirken hata olustu');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (project: FilingProject) => {
    if (!confirm(`"#${project.projectNumber} ${project.projectName}" projesini silmek istediginizden emin misiniz?\n\nBu islem geri alinamaz. Lokal klasorler etkilenmez.`)) return;

    try {
      setDeletingId(project.id);
      await deleteFilingProject(tenantId, project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch (err: any) {
      setError(err.message || 'Proje silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  // Client-side search
  const filteredProjects = searchTerm
    ? projects.filter(
        (p) =>
          p.projectNumber.includes(searchTerm) ||
          p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.editor.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.folderName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : projects;

  // Most used template
  const topTemplate = stats?.templates
    ? Object.entries(stats.templates).sort(([, a], [, b]) => b - a)[0]
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Dosyalama
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1">
            Proje dosyalama sistemi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/filing/templates"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-200 rounded-full font-grotesk text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Sablonlar
          </Link>
          <Link
            to="/admin/filing/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Dosyala
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="admin-stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-commons text-2xl font-bold text-[#1a1a2e]">
                  {stats.total}
                </p>
                <p className="font-commons text-xs text-neutral-500">Toplam Proje</p>
              </div>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-commons text-2xl font-bold text-[#1a1a2e]">
                  {stats.thisMonth}
                </p>
                <p className="font-commons text-xs text-neutral-500">Bu Ay</p>
              </div>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-commons text-2xl font-bold text-[#1a1a2e]">
                  {Object.keys(stats.editors).length}
                </p>
                <p className="font-commons text-xs text-neutral-500">Editor</p>
              </div>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-commons text-2xl font-bold text-[#1a1a2e] truncate">
                  {topTemplate ? topTemplate[0] : '-'}
                </p>
                <p className="font-commons text-xs text-neutral-500">En Cok Sablon</p>
              </div>
            </div>
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

      {/* Search */}
      <div className="admin-card-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Proje numarasi, musteri, proje adi veya editor ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-neutral-400 transition-colors"
          />
        </div>
      </div>

      {/* Projects Table */}
      <div className="admin-card p-0 overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
            <FolderOpen className="w-12 h-12 mb-3" />
            <p className="font-commons text-sm">
              {searchTerm ? 'Arama sonucu bulunamadi' : 'Henuz dosyalama yapilmamis'}
            </p>
            {!searchTerm && (
              <Link
                to="/admin/filing/new"
                className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-[#171717] text-white rounded-full font-commons text-sm hover:bg-neutral-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ilk Projeyi Dosyala
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-5 py-3 font-commons text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    No
                  </th>
                  <th className="text-left px-5 py-3 font-commons text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Musteri
                  </th>
                  <th className="text-left px-5 py-3 font-commons text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Proje
                  </th>
                  <th className="text-left px-5 py-3 font-commons text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Tarih
                  </th>
                  <th className="text-left px-5 py-3 font-commons text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Editor
                  </th>
                  <th className="text-left px-5 py-3 font-commons text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Sablon
                  </th>
                  <th className="text-left px-5 py-3 font-commons text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Disk
                  </th>
                  <th className="text-left px-5 py-3 font-commons text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <motion.tr
                    key={project.id}
                    className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-sm font-medium text-[#171717]">
                        {project.projectNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-commons text-sm text-[#171717]">
                        {project.clientName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-commons text-sm text-[#171717]">
                        {project.projectName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-commons text-sm text-neutral-500">
                        {project.date}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-commons text-sm text-neutral-600">
                        {project.editor}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-commons text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md">
                        {project.templateName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {project.hardDisk ? (
                        <span className="font-commons text-xs text-neutral-500 flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {project.hardDisk}
                        </span>
                      ) : (
                        <span className="text-neutral-300">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full font-commons text-xs font-medium ${
                          FILING_STATUS_COLORS[project.status]
                        }`}
                      >
                        {FILING_STATUS_LABELS[project.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(project)}
                          disabled={deletingId === project.id}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors inline-flex text-neutral-300 hover:text-red-400 disabled:opacity-50"
                          title="Sil"
                        >
                          {deletingId === project.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                        <Link
                          to={`/admin/filing/${project.id}`}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors inline-flex"
                        >
                          <ChevronRight className="w-4 h-4 text-neutral-400" />
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilingDashboardPage;
