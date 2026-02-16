import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  FolderKanban,
  ChevronRight,
  Briefcase,
  DollarSign,
} from 'lucide-react';
import { getProjects } from '@/shared/services/projectService';
import { useTenantId } from '@/shared/hooks/useTenant';
import { SERVICE_MODULE_CONFIG } from '@/admin/projects/constants';
import type {
  ProjectSummary,
  ProjectStatus,
  ProjectFilters,
} from '@/shared/types/project';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
} from '@/shared/types/project';
import type { ServiceCategory } from '@/shared/types/pricing/services';
import { DocumentSnapshot } from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/firebase/config';

type StatusTab = 'all' | ProjectStatus;

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'Tum' },
  { key: 'active', label: 'Aktif' },
  { key: 'paused', label: 'Duraklatildi' },
  { key: 'completed', label: 'Tamamlandi' },
  { key: 'cancelled', label: 'Iptal' },
];

const ProjectListPage: React.FC = () => {
  const navigate = useNavigate();
  const tenantId = useTenantId();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadProjects = useCallback(
    async (reset = false) => {
      if (!isFirebaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const filters: ProjectFilters = {};

        if (activeTab !== 'all') {
          filters.status = [activeTab];
        }

        if (searchQuery.trim()) {
          filters.search = searchQuery.trim();
        }

        const result = await getProjects(
          tenantId,
          filters,
          20,
          reset ? undefined : lastDoc || undefined
        );

        if (reset) {
          setProjects(result.projects);
        } else {
          setProjects((prev) => [...prev, ...result.projects]);
        }

        setLastDoc(result.lastDoc);
        setHasMore(result.projects.length === 20);
      } catch (error) {
        console.error('Error loading projects:', error);
      } finally {
        setLoading(false);
      }
    },
    [tenantId, activeTab, searchQuery, lastDoc]
  );

  useEffect(() => {
    loadProjects(true);
  }, [activeTab]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadProjects(true);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FolderKanban className="w-12 h-12 text-neutral-300 mb-4" />
        <h3 className="font-ramillas text-xl font-bold text-neutral-700 mb-2">
          Firebase Yapilandirilmadi
        </h3>
        <p className="font-grotesk text-neutral-500 max-w-md">
          Proje ozelligini kullanmak icin Firebase'i yapilandirmaniz gerekiyor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
            Projeler
          </h1>
          <p className="font-grotesk text-neutral-600 mt-1">
            Tum projeleri yonetin ve takip edin
          </p>
        </div>
        <Link to="/admin/projects/new">
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            Yeni Proje
          </motion.button>
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full font-grotesk text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-[#171717] text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Proje adi, musteri adi veya sirket ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
        />
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        {loading && projects.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
            <FolderKanban className="w-12 h-12 text-neutral-300 mb-4" />
            <h3 className="font-ramillas text-xl font-bold text-neutral-700 mb-2">
              Henuz proje yok
            </h3>
            <p className="font-grotesk text-neutral-500 max-w-md">
              Ilk projenizi olusturmak icin "Yeni Proje" butonuna tiklayin.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => navigate(`/admin/projects/${project.id}`)}
                className="flex items-center gap-4 p-5 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-[#fffceb] flex items-center justify-center flex-shrink-0">
                  <span className="font-grotesk font-bold text-[#171717] text-lg">
                    {project.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-grotesk font-semibold text-[#171717] truncate">
                      {project.name}
                    </h3>
                    <span
                      className={`text-xs font-grotesk font-medium px-2 py-0.5 rounded-full ${
                        PROJECT_STATUS_COLORS[project.status]
                      }`}
                    >
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-sm text-neutral-500 font-grotesk">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" />
                      {project.clientName}
                      {project.clientCompany && ` - ${project.clientCompany}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <FolderKanban className="w-3.5 h-3.5" />
                      {project.activeServicesCount} aktif hizmet
                    </span>
                  </div>
                </div>

                {/* Service Icons */}
                <div className="hidden md:flex items-center gap-1.5">
                  {project.serviceCategories.slice(0, 4).map((cat) => {
                    const config = SERVICE_MODULE_CONFIG[cat];
                    if (!config) return null;
                    const Icon = config.icon;
                    return (
                      <div
                        key={cat}
                        className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}
                        title={config.label}
                      >
                        <Icon className="w-4 h-4" style={{ color: config.color }} />
                      </div>
                    );
                  })}
                  {project.serviceCategories.length > 4 && (
                    <span className="text-xs font-grotesk text-neutral-400 ml-1">
                      +{project.serviceCategories.length - 4}
                    </span>
                  )}
                </div>

                {/* Budget */}
                <div className="hidden lg:block text-right">
                  {project.monthlyFee ? (
                    <div>
                      <p className="font-grotesk text-sm font-medium text-[#171717]">
                        {formatCurrency(project.monthlyFee)}
                        <span className="text-neutral-400 font-normal">/ay</span>
                      </p>
                    </div>
                  ) : project.totalBudget ? (
                    <p className="font-grotesk text-sm font-medium text-[#171717]">
                      {formatCurrency(project.totalBudget)}
                    </p>
                  ) : (
                    <p className="font-grotesk text-xs text-neutral-400">-</p>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              </motion.div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && projects.length > 0 && (
          <div className="p-5 border-t border-neutral-100">
            <button
              onClick={() => loadProjects(false)}
              disabled={loading}
              className="w-full py-2 font-grotesk text-sm text-neutral-600 hover:text-[#171717] transition-colors disabled:opacity-50"
            >
              {loading ? 'Yukleniyor...' : 'Daha fazla yukle'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectListPage;
