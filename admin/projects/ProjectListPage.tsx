import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  FolderKanban,
  Briefcase,
  ArrowUpRight,
  Zap,
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
} from '@/shared/types/project';
import { DocumentSnapshot } from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/firebase/config';

type StatusTab = 'all' | ProjectStatus;

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'paused', label: 'Duraklatıldı' },
  { key: 'completed', label: 'Tamamlandı' },
  { key: 'cancelled', label: 'İptal' },
];

// Neobrutalism kart renk paleti — her marka için döngüsel atama
const BRAND_COLORS = [
  { bg: '#FFE74C', text: '#1a1a1a', accent: '#FF5A5F' }, // sarı
  { bg: '#FF5A5F', text: '#ffffff', accent: '#FFE74C' }, // kırmızı
  { bg: '#7CF6A0', text: '#1a1a1a', accent: '#0066FF' }, // yeşil
  { bg: '#A8E6FF', text: '#1a1a1a', accent: '#FF5A5F' }, // mavi
  { bg: '#FFAFD7', text: '#1a1a1a', accent: '#7C3AED' }, // pembe
  { bg: '#C5A3FF', text: '#1a1a1a', accent: '#FFE74C' }, // mor
  { bg: '#FFB347', text: '#1a1a1a', accent: '#0066FF' }, // turuncu
  { bg: '#1a1a1a', text: '#FFE74C', accent: '#7CF6A0' }, // siyah
];

// Durum rozetleri için neobrutalism palet
const NEO_STATUS_STYLES: Record<ProjectStatus, { bg: string; text: string }> = {
  active: { bg: '#7CF6A0', text: '#0a3d1f' },
  paused: { bg: '#FFE74C', text: '#3d3500' },
  completed: { bg: '#A8E6FF', text: '#003d4d' },
  cancelled: { bg: '#FF5A5F', text: '#ffffff' },
};

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

  if (!isFirebaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white border-[3px] border-black p-8 shadow-[8px_8px_0px_0px_#000] max-w-md text-center">
          <div className="inline-flex w-16 h-16 items-center justify-center bg-[#FFE74C] border-[3px] border-black mb-4">
            <FolderKanban className="w-8 h-8 text-black" strokeWidth={2.5} />
          </div>
          <h3 className="font-grotesk text-2xl font-black text-black mb-2 uppercase">
            Firebase Yapılandırılmadı
          </h3>
          <p className="font-grotesk text-black/70">
            Proje özelliğini kullanmak için Firebase'i yapılandırmanız gerekiyor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white border-[3px] border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_#000] relative overflow-hidden">
        {/* Dekoratif desen */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFE74C] border-l-[3px] border-b-[3px] border-black -translate-y-1 translate-x-1 hidden md:block" />
        <div className="absolute top-4 right-4 hidden md:block">
          <Zap className="w-8 h-8 text-black" strokeWidth={3} fill="black" />
        </div>

        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-block bg-black text-white px-3 py-1 mb-3 font-grotesk text-xs font-black uppercase tracking-wider">
              Marka Paneli
            </div>
            <h1 className="text-4xl md:text-6xl font-grotesk font-black text-black uppercase leading-none tracking-tight">
              Projeler
            </h1>
            <p className="font-grotesk text-black/70 mt-3 font-medium">
              Tüm markaları yönetin · Karta tıkla, içeri gir
            </p>
          </div>
          <Link to="/admin/projects/new">
            <motion.button
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFE74C] text-black border-[3px] border-black font-grotesk text-sm font-black uppercase tracking-wide shadow-[6px_6px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
              whileTap={{ scale: 0.97 }}
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
              Yeni Marka
            </motion.button>
          </Link>
        </div>
      </div>

      {/* Filtre + Arama */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Status Tabs */}
        <div className="flex gap-3 overflow-x-auto pb-1 flex-1">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 border-[3px] border-black font-grotesk text-sm font-black uppercase whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-black text-white shadow-[4px_4px_0px_0px_#FFE74C]'
                    : 'bg-white text-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative lg:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black" strokeWidth={3} />
          <input
            type="text"
            placeholder="Marka ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 border-[3px] border-black bg-white font-grotesk text-sm font-bold placeholder-black/40 focus:outline-none shadow-[4px_4px_0px_0px_#000] focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
          />
        </div>
      </div>

      {/* Projeler Grid */}
      {loading && projects.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-[4px] border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white border-[3px] border-black p-12 shadow-[8px_8px_0px_0px_#000] text-center">
          <div className="inline-flex w-20 h-20 items-center justify-center bg-[#FFAFD7] border-[3px] border-black mb-5">
            <FolderKanban className="w-10 h-10 text-black" strokeWidth={2.5} />
          </div>
          <h3 className="font-grotesk text-2xl font-black text-black mb-2 uppercase">
            Henüz Marka Yok
          </h3>
          <p className="font-grotesk text-black/70 max-w-md mx-auto">
            İlk markanızı oluşturmak için "Yeni Marka" butonuna tıklayın.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {projects.map((project, index) => {
            const palette = BRAND_COLORS[index % BRAND_COLORS.length];
            const statusStyle = NEO_STATUS_STYLES[project.status];
            const brandLabel = project.clientCompany || project.clientName;
            const initial = (brandLabel || project.name).charAt(0).toUpperCase();

            return (
              <motion.button
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.25 }}
                onClick={() => navigate(`/admin/projects/${project.id}`)}
                className="group relative text-left bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] hover:shadow-[10px_10px_0px_0px_#000] hover:-translate-x-[2px] hover:-translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] transition-all duration-150 overflow-hidden"
              >
                {/* Üst: Marka avatarı bloğu */}
                <div
                  className="relative border-b-[3px] border-black px-5 py-7 flex items-center justify-between"
                  style={{ backgroundColor: palette.bg }}
                >
                  {/* Köşe aksanı */}
                  <div
                    className="absolute top-0 right-0 w-12 h-12 border-l-[3px] border-b-[3px] border-black flex items-center justify-center"
                    style={{ backgroundColor: palette.accent }}
                  >
                    <ArrowUpRight
                      className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      style={{ color: palette.bg === '#1a1a1a' ? '#1a1a1a' : '#1a1a1a' }}
                      strokeWidth={3}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div
                      className="w-16 h-16 border-[3px] border-black bg-white flex items-center justify-center shadow-[3px_3px_0px_0px_#000]"
                    >
                      <span className="font-grotesk font-black text-3xl text-black">
                        {initial}
                      </span>
                    </div>
                    {/* Durum rozeti */}
                    <div
                      className="px-2.5 py-1 border-[2px] border-black font-grotesk text-[10px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                    >
                      {PROJECT_STATUS_LABELS[project.status]}
                    </div>
                  </div>
                </div>

                {/* Alt: Bilgi bloğu */}
                <div className="p-5 space-y-3">
                  {/* Marka adı */}
                  <div>
                    <p className="font-grotesk text-[10px] font-black uppercase tracking-wider text-black/50">
                      Marka
                    </p>
                    <h3 className="font-grotesk font-black text-lg text-black leading-tight truncate uppercase">
                      {brandLabel}
                    </h3>
                  </div>

                  {/* Proje adı */}
                  <div className="border-t-[2px] border-dashed border-black/30 pt-3">
                    <p className="font-grotesk text-[10px] font-black uppercase tracking-wider text-black/50">
                      Proje
                    </p>
                    <p className="font-grotesk font-bold text-sm text-black truncate">
                      {project.name}
                    </p>
                  </div>

                  {/* Müşteri + hizmet sayısı */}
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Briefcase className="w-3.5 h-3.5 text-black flex-shrink-0" strokeWidth={2.5} />
                      <span className="font-grotesk text-xs font-bold text-black/70 truncate">
                        {project.clientName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-black text-white px-2 py-1 font-grotesk text-[10px] font-black uppercase flex-shrink-0">
                      <FolderKanban className="w-3 h-3" strokeWidth={3} />
                      {project.activeServicesCount}
                    </div>
                  </div>

                  {/* Hizmet ikonları */}
                  {project.serviceCategories.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-3 border-t-[2px] border-dashed border-black/30">
                      {project.serviceCategories.slice(0, 5).map((cat) => {
                        const config = SERVICE_MODULE_CONFIG[cat];
                        if (!config) return null;
                        const Icon = config.icon;
                        return (
                          <div
                            key={cat}
                            className="w-7 h-7 border-[2px] border-black bg-white flex items-center justify-center"
                            title={config.label}
                          >
                            <Icon className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
                          </div>
                        );
                      })}
                      {project.serviceCategories.length > 5 && (
                        <span className="font-grotesk text-[10px] font-black text-black/60">
                          +{project.serviceCategories.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {hasMore && projects.length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => loadProjects(false)}
            disabled={loading}
            className="px-6 py-3 bg-white border-[3px] border-black font-grotesk text-sm font-black uppercase shadow-[6px_6px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Yükleniyor...' : 'Daha Fazla Yükle'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectListPage;
