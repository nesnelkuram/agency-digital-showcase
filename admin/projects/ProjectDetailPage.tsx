import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  Mail,
  User,
  DollarSign,
  Clock,
  Edit3,
  Send,
  Plus,
  FileText,
  Zap,
  GitBranch,
  MessageSquare,
  UserCheck,
  LinkIcon,
  FolderKanban,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import { getProject, addTimelineEvent } from '@/shared/services/projectService';
import { useProjectWorkflows } from '@/shared/hooks/useProjectWorkflows';
import { SERVICE_MODULE_CONFIG } from './constants';
import type {
  Project,
  ProjectTimelineEventType,
} from '@/shared/types/project';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
} from '@/shared/types/project';
import type { ServiceCategory } from '@/shared/types/pricing/services';
import { Timestamp } from 'firebase/firestore';
import ServiceCard from './components/ServiceCard';
import ServiceWorkflowSection from './components/ServiceWorkflowSection';
import StartWorkflowModal from './components/StartWorkflowModal';
import ProjectBreadcrumb from './components/ProjectBreadcrumb';

const TIMELINE_EVENT_ICONS: Record<ProjectTimelineEventType, React.ElementType> = {
  created: Plus,
  status_change: GitBranch,
  service_activated: Zap,
  service_deactivated: Clock,
  service_status_change: GitBranch,
  note: MessageSquare,
  quote_linked: LinkIcon,
  client_assigned: UserCheck,
};

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = useTenantId();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Workflow modal state
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [workflowModalCategory, setWorkflowModalCategory] = useState<ServiceCategory | null>(null);

  const loadProject = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getProject(tenantId, id);
      setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Workflow hook
  const {
    instancesByCategory,
    templatesByCategory,
    startWorkflow,
    refetch: refetchWorkflows,
  } = useProjectWorkflows(id || '', project);

  const handleOpenWorkflowModal = useCallback((category: ServiceCategory) => {
    setWorkflowModalCategory(category);
    setWorkflowModalOpen(true);
  }, []);

  const handleCloseWorkflowModal = useCallback(() => {
    setWorkflowModalOpen(false);
    setWorkflowModalCategory(null);
  }, []);

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return '-';
    return timestamp.toDate().toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatRelativeDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes} dk once`;
      }
      return `${hours} saat once`;
    }
    if (days === 1) return 'Dun';
    if (days < 7) return `${days} gun once`;
    if (days < 30) return `${Math.floor(days / 7)} hafta once`;

    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !user || !id) return;

    setSubmittingNote(true);
    try {
      await addTimelineEvent(tenantId, id, {
        type: 'note',
        title: 'Not eklendi',
        description: noteText.trim(),
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Unknown',
      });
      setNoteText('');
      await loadProject();
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setSubmittingNote(false);
    }
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
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FolderKanban className="w-12 h-12 text-neutral-300 mb-4" />
        <h3 className="font-ramillas text-xl font-bold text-neutral-700 mb-2">
          Proje bulunamadi
        </h3>
        <p className="font-grotesk text-neutral-500 mb-4">
          Bu proje mevcut degil veya silinmis olabilir.
        </p>
        <button
          onClick={() => navigate('/admin/projects')}
          className="font-grotesk text-sm text-[#171717] hover:underline"
        >
          Projelere don
        </button>
      </div>
    );
  }

  const sortedTimeline = [...project.timeline].sort(
    (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()
  );

  // Filter workflow-enabled services
  const workflowServices = project.services.filter(
    s => SERVICE_MODULE_CONFIG[s.category]?.supportsWorkflow
  );

  // Modal templates for selected category
  const modalTemplates = workflowModalCategory
    ? templatesByCategory[workflowModalCategory] || []
    : [];
  const modalCategoryLabel = workflowModalCategory
    ? SERVICE_MODULE_CONFIG[workflowModalCategory]?.label || ''
    : '';

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <ProjectBreadcrumb
        projectId={project.id}
        currentPage={project.name}
      />

      {/* Project Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
                {project.name}
              </h1>
              <span
                className={`text-xs font-grotesk font-medium px-3 py-1 rounded-full ${
                  PROJECT_STATUS_COLORS[project.status]
                }`}
              >
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
            </div>
            {project.description && (
              <p className="font-grotesk text-neutral-600 text-sm max-w-2xl">
                {project.description}
              </p>
            )}
          </div>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-200 bg-white text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Edit3 className="w-4 h-4" />
            Duzenle
          </motion.button>
        </div>

        {/* Client & Budget Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Client */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-neutral-50">
            <div className="p-2 rounded-lg bg-white">
              <User className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="min-w-0">
              <p className="font-grotesk text-xs text-neutral-500">Musteri</p>
              <p className="font-grotesk text-sm font-medium text-[#171717] truncate">
                {project.clientName}
              </p>
              {project.clientCompany && (
                <p className="font-grotesk text-xs text-neutral-500 truncate">
                  {project.clientCompany}
                </p>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-neutral-50">
            <div className="p-2 rounded-lg bg-white">
              <Mail className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="min-w-0">
              <p className="font-grotesk text-xs text-neutral-500">Iletisim</p>
              {project.clientEmail && (
                <p className="font-grotesk text-xs text-[#171717] truncate">
                  {project.clientEmail}
                </p>
              )}
              {project.clientPhone && (
                <p className="font-grotesk text-xs text-neutral-500 truncate">
                  {project.clientPhone}
                </p>
              )}
              {!project.clientEmail && !project.clientPhone && (
                <p className="font-grotesk text-xs text-neutral-400">Belirtilmemis</p>
              )}
            </div>
          </div>

          {/* Budget */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-neutral-50">
            <div className="p-2 rounded-lg bg-white">
              <DollarSign className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="min-w-0">
              <p className="font-grotesk text-xs text-neutral-500">Butce</p>
              {project.totalBudget ? (
                <p className="font-grotesk text-sm font-medium text-[#171717]">
                  {formatCurrency(project.totalBudget)}
                </p>
              ) : (
                <p className="font-grotesk text-xs text-neutral-400">Belirtilmemis</p>
              )}
              {project.monthlyFee && (
                <p className="font-grotesk text-xs text-neutral-500">
                  {formatCurrency(project.monthlyFee)}/ay
                </p>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-neutral-50">
            <div className="p-2 rounded-lg bg-white">
              <Calendar className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="min-w-0">
              <p className="font-grotesk text-xs text-neutral-500">Tarihler</p>
              <p className="font-grotesk text-xs text-[#171717]">
                Baslangic: {formatDate(project.startDate)}
              </p>
              {project.endDate && (
                <p className="font-grotesk text-xs text-neutral-500">
                  Bitis: {formatDate(project.endDate)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Services & Workflows Section */}
      <div>
        <h2 className="font-ramillas text-xl font-bold text-[#171717] mb-4">
          Hizmetler ve Is Akislari
        </h2>
        {project.services.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-100 p-8 text-center">
            <FolderKanban className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="font-grotesk text-sm text-neutral-500">
              Bu projeye henuz hizmet eklenmemis.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Service Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.services.map((service) => {
                const config = SERVICE_MODULE_CONFIG[service.category];
                const categoryInstances = instancesByCategory[service.category] || [];
                return (
                  <ServiceCard
                    key={service.category}
                    category={service.category}
                    status={service.status}
                    projectId={project.id}
                    onStartWorkflow={config?.supportsWorkflow ? handleOpenWorkflowModal : undefined}
                    workflowCount={categoryInstances.length}
                  />
                );
              })}
            </div>

            {/* Workflow sections for each workflow-enabled service */}
            {workflowServices.map((service) => {
              const config = SERVICE_MODULE_CONFIG[service.category];
              const categoryInstances = instancesByCategory[service.category] || [];
              const categoryTemplates = templatesByCategory[service.category] || [];

              if (!config?.supportsWorkflow) return null;

              return (
                <div key={`wf-${service.category}`} className="bg-white rounded-xl border border-neutral-100 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: `${config.color}15` }}
                    >
                      <config.icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                    </div>
                    <h3 className="font-grotesk text-sm font-semibold text-[#171717]">
                      {config.label} - Is Akislari
                    </h3>
                  </div>
                  <ServiceWorkflowSection
                    instances={categoryInstances}
                    hasTemplates={categoryTemplates.length > 0}
                    onAddWorkflow={() => handleOpenWorkflowModal(service.category)}
                    onRefetch={refetchWorkflows}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h2 className="font-ramillas text-xl font-bold text-[#171717] mb-4">
          Zaman Cizelgesi
        </h2>
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
          {/* Add Note Input */}
          <div className="px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  placeholder="Not ekle..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-grotesk text-sm focus:outline-none focus:border-neutral-400 transition-colors"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAddNote}
                disabled={!noteText.trim() || submittingNote}
                className="p-2.5 rounded-xl bg-[#171717] text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* Timeline Events */}
          <div className="divide-y divide-neutral-100">
            {sortedTimeline.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Clock className="w-8 h-8 text-neutral-300 mx-auto" />
                <p className="mt-2 text-sm font-grotesk text-neutral-400">
                  Henuz etkinlik yok
                </p>
              </div>
            ) : (
              sortedTimeline.map((event) => {
                const EventIcon = TIMELINE_EVENT_ICONS[event.type] || Clock;
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-4 px-5 py-4"
                  >
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <EventIcon className="w-4 h-4 text-neutral-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-grotesk text-sm font-medium text-[#171717]">
                          {event.title}
                        </p>
                        <span className="font-grotesk text-xs text-neutral-400">
                          {formatRelativeDate(event.createdAt)}
                        </span>
                      </div>
                      {event.description && (
                        <p className="font-grotesk text-sm text-neutral-500 mt-0.5">
                          {event.description}
                        </p>
                      )}
                      {event.createdByName && (
                        <p className="font-grotesk text-xs text-neutral-400 mt-1">
                          {event.createdByName}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Start Workflow Modal */}
      {workflowModalCategory && (
        <StartWorkflowModal
          isOpen={workflowModalOpen}
          onClose={handleCloseWorkflowModal}
          templates={modalTemplates}
          category={workflowModalCategory}
          categoryLabel={modalCategoryLabel}
          onStart={startWorkflow}
        />
      )}
    </div>
  );
};

export default ProjectDetailPage;
