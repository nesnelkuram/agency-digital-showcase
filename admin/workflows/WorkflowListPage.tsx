import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GitBranch,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  Eye,
  CheckCircle,
  Archive,
  Sparkles,
} from 'lucide-react';
import { useWorkflowTemplates } from '@/shared/hooks/useWorkflowTemplates';
import { usePermission } from '@/shared/hooks/usePermission';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import type { WorkflowTemplate } from '@/shared/types/workflow';

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-neutral-100', text: 'text-neutral-700', label: 'Taslak' },
  published: { bg: 'bg-green-100', text: 'text-green-700', label: 'Yayinda' },
  archived: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Arsivlendi' },
};

const categoryLabels: Record<string, string> = {
  social_media: 'Sosyal Medya',
  video_production: 'Video Produksiyon',
  photography: 'Fotograf',
  web_development: 'Web Gelistirme',
  graphic_design: 'Grafik Tasarim',
  consulting: 'Danismanlik',
  other: 'Diger',
};

const WorkflowListPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { can } = usePermission();
  const { templates, loading, error, deleteTemplate, publishTemplate, archiveTemplate } =
    useWorkflowTemplates({ status: statusFilter || undefined });

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePublish = async (id: string) => {
    await publishTemplate(id);
    setMenuOpenId(null);
  };

  const handleArchive = async (id: string) => {
    await archiveTemplate(id);
    setMenuOpenId(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bu sablonu silmek istediginizden emin misiniz?')) {
      await deleteTemplate(id);
    }
    setMenuOpenId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717] flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-indigo-600" />
            Workflow Sablonlari
          </h1>
          <p className="font-grotesk text-neutral-600 mt-1">
            Hizmet teslimat sureclerinizi gorsel olarak tasarlayin ve yonetin.
          </p>
        </div>
        {can(PERMISSIONS.WORKFLOWS_CREATE) && (
          <div className="flex items-center gap-2">
            <Link
              to="/admin/workflows/ai-designer"
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-commons text-sm font-medium"
            >
              <Sparkles className="w-4 h-4" />
              AI Tasarimci
            </Link>
            <Link
              to="/admin/workflows/builder"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Yeni Sablon
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Sablon ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="">Tum Durumlar</option>
          <option value="draft">Taslak</option>
          <option value="published">Yayinda</option>
          <option value="archived">Arsivlendi</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-neutral-100 animate-pulse">
              <div className="h-5 bg-neutral-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-neutral-100 rounded w-1/2 mb-4" />
              <div className="h-3 bg-neutral-100 rounded w-full mb-2" />
              <div className="h-3 bg-neutral-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 font-commons text-sm">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredTemplates.length === 0 && (
        <div className="bg-white rounded-xl p-12 border border-neutral-100 text-center">
          <GitBranch className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="font-commons text-lg font-semibold text-neutral-700 mb-2">
            Henuz workflow sablonu yok
          </h3>
          <p className="font-commons text-sm text-neutral-500 mb-6">
            Hizmet teslimat sureclerinizi standartlastirmak icin ilk sablonunuzu olusturun.
          </p>
          {can(PERMISSIONS.WORKFLOWS_CREATE) && (
            <Link
              to="/admin/workflows/builder"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Sablon Olustur
            </Link>
          )}
        </div>
      )}

      {/* Template Grid */}
      {!loading && filteredTemplates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const status = statusColors[template.status] || statusColors.draft;
            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl p-6 border border-neutral-100 hover:border-neutral-200 hover:shadow-sm transition-all relative group"
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === template.id ? null : template.id)}
                      className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpenId === template.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50">
                          <Link
                            to={`/admin/workflows/builder/${template.id}`}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-commons text-neutral-700 hover:bg-neutral-50"
                          >
                            <Edit3 className="w-4 h-4" />
                            Duzenle
                          </Link>
                          {template.status === 'draft' && (
                            <button
                              onClick={() => handlePublish(template.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-commons text-green-700 hover:bg-green-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Yayinla
                            </button>
                          )}
                          {template.status === 'published' && (
                            <button
                              onClick={() => handleArchive(template.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-commons text-amber-700 hover:bg-amber-50"
                            >
                              <Archive className="w-4 h-4" />
                              Arsivle
                            </button>
                          )}
                          <hr className="my-1 border-neutral-100" />
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-commons text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Sil
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Template Info */}
                <Link to={`/admin/workflows/builder/${template.id}`}>
                  <h3 className="font-commons text-lg font-semibold text-[#171717] mb-1 hover:text-indigo-600 transition-colors">
                    {template.name}
                  </h3>
                </Link>
                <p className="font-commons text-sm text-neutral-500 mb-3 line-clamp-2">
                  {template.description || 'Aciklama eklenmemis'}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs font-commons text-neutral-400">
                  <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                    {categoryLabels[template.serviceCategory] || template.serviceCategory}
                  </span>
                  <span>v{template.version}</span>
                  <span>{template.nodes?.length || 0} adim</span>
                  <span>~{template.defaultEstimatedDays} gun</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkflowListPage;
