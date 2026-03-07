import React, { useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, GitBranch, ExternalLink, Trash2,
  Loader2, ChevronDown, ChevronRight, Settings,
} from 'lucide-react';
import { SERVICE_MODULE_CONFIG } from '@/admin/projects/constants';
import { useServiceWorkflows } from '@/shared/hooks/useServiceWorkflows';
import { removeServiceFromProject } from '@/shared/services/projectService';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkflowTemplate } from '@/shared/services/workflowTemplateService';
import type { WorkflowTemplate } from '@/shared/types/workflow/template';
import type { WorkflowInstance } from '@/shared/types/workflow/instance';
import type { ServiceCategory } from '@/shared/types/pricing/services';
import type { Project } from '@/shared/types/project';
import VerticalStepTimeline from './components/VerticalStepTimeline';
import RecurringWorkflowCard from './components/RecurringWorkflowCard';
import StartWorkflowModal from './components/StartWorkflowModal';

// Hooks for project data
import { useEffect } from 'react';
import { getProject } from '@/shared/services/projectService';

type TabType = 'setup' | 'recurring' | 'on_demand';

const TABS: { key: TabType; label: string }[] = [
  { key: 'setup', label: 'Kurulum' },
  { key: 'recurring', label: 'Periyodik Islemler' },
  { key: 'on_demand', label: 'Tek Seferlik' },
];

// Instance card with collapsible timeline
const SetupInstanceCard: React.FC<{
  instance: WorkflowInstance;
  projectId: string;
}> = ({ instance, projectId }) => {
  const [expanded, setExpanded] = useState(instance.status === 'active');
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const tenantId = useTenantId();

  useEffect(() => {
    if (!expanded || !tenantId || template) return;
    getWorkflowTemplate(tenantId, instance.templateId).then(setTemplate);
  }, [expanded, tenantId, instance.templateId, template]);

  return (
    <div className="border border-neutral-100 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <GitBranch className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <div className="min-w-0 text-left">
            <h4 className="font-grotesk text-sm font-medium text-[#171717] truncate">
              {instance.templateName}
            </h4>
            <p className="font-grotesk text-[10px] text-neutral-400">
              {instance.status === 'completed' ? 'Tamamlandi' : `%${instance.progress} tamamlandi`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-24 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                instance.progress === 100
                  ? 'bg-green-500'
                  : instance.progress > 0
                  ? 'bg-blue-500'
                  : 'bg-neutral-200'
              }`}
              style={{ width: `${instance.progress}%` }}
            />
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-neutral-50">
              <div className="pt-4">
                <VerticalStepTimeline
                  instance={instance}
                  template={template}
                  projectId={projectId}
                />
              </div>
              <Link
                to={`/admin/projects/${projectId}/workflow/${instance.id}`}
                className="inline-flex items-center gap-1.5 font-grotesk text-xs font-medium text-blue-600 hover:text-blue-700 mt-2 transition-colors"
              >
                Detaya Git
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Simple on-demand instance card (no timeline, just link)
const OnDemandInstanceCard: React.FC<{
  instance: WorkflowInstance;
  projectId: string;
}> = ({ instance, projectId }) => {
  const statusColors: Record<string, string> = {
    active: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    paused: 'bg-yellow-100 text-yellow-700',
    pending: 'bg-neutral-100 text-neutral-500',
  };

  return (
    <Link
      to={`/admin/projects/${projectId}/workflow/${instance.id}`}
      className="flex items-center justify-between p-4 rounded-xl border border-neutral-100 bg-white hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center gap-3 min-w-0">
        <GitBranch className="w-4 h-4 text-neutral-400 flex-shrink-0" />
        <div className="min-w-0">
          <h4 className="font-grotesk text-sm font-medium text-[#171717] truncate">
            {instance.templateName}
          </h4>
          <p className="font-grotesk text-[10px] text-neutral-400">
            %{instance.progress} tamamlandi
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-grotesk font-medium px-2 py-0.5 rounded-full ${
            statusColors[instance.status] || statusColors.pending
          }`}
        >
          {instance.status === 'active'
            ? 'Aktif'
            : instance.status === 'completed'
            ? 'Tamamlandi'
            : instance.status === 'cancelled'
            ? 'Iptal'
            : 'Bekliyor'}
        </span>
        <ChevronRight className="w-4 h-4 text-neutral-300" />
      </div>
    </Link>
  );
};

const ServiceDetailPage: React.FC = () => {
  const { projectId, category } = useParams<{ projectId: string; category: string }>();
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('setup');
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [removing, setRemoving] = useState(false);

  const serviceCategory = category as ServiceCategory;
  const config = SERVICE_MODULE_CONFIG[serviceCategory];

  // Fetch project
  useEffect(() => {
    if (!tenantId || !projectId) return;
    setProjectLoading(true);
    getProject(tenantId, projectId)
      .then(setProject)
      .finally(() => setProjectLoading(false));
  }, [tenantId, projectId]);

  const {
    setupInstances,
    recurringInstances,
    onDemandInstances,
    templates,
    recurringTemplates,
    loading: workflowsLoading,
    startWorkflow,
  } = useServiceWorkflows(projectId || '', serviceCategory, project);

  const service = project?.services.find((s) => s.category === serviceCategory);

  const handleStartWorkflow = useCallback(
    async (templateId: string, _cat: ServiceCategory, customName?: string) => {
      const result = await startWorkflow(templateId, customName);
      if (result) {
        // Refresh project data
        if (tenantId && projectId) {
          getProject(tenantId, projectId).then(setProject);
        }
      }
      return result;
    },
    [startWorkflow, tenantId, projectId]
  );

  const handleRemoveService = async () => {
    if (!tenantId || !projectId || !user) return;
    const confirmed = window.confirm(
      `${config?.label || category} hizmetini bu projeden kaldirmak istediginize emin misiniz?`
    );
    if (!confirmed) return;

    setRemoving(true);
    try {
      await removeServiceFromProject(
        tenantId,
        projectId,
        serviceCategory,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      navigate(`/admin/projects/${projectId}`);
    } catch (err) {
      console.error('Error removing service:', err);
    } finally {
      setRemoving(false);
    }
  };

  // Find latest recurring instance per template
  const latestRecurringByTemplate = useMemo(() => {
    const map = new Map<string, WorkflowInstance>();
    for (const inst of recurringInstances) {
      const tid = inst.recurringTemplateId || inst.templateId;
      const existing = map.get(tid);
      if (!existing || (inst.createdAt && existing.createdAt && inst.createdAt > existing.createdAt)) {
        map.set(tid, inst);
      }
    }
    return map;
  }, [recurringInstances]);

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!project || !config) {
    return (
      <div className="text-center py-12">
        <p className="font-grotesk text-sm text-neutral-500">Proje veya hizmet bulunamadi.</p>
        <Link to="/admin/projects" className="font-grotesk text-sm text-blue-600 mt-2 inline-block">
          Projelere Don
        </Link>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link to="/admin/projects" className="font-grotesk text-neutral-400 hover:text-neutral-600 transition-colors">
          Projeler
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
        <Link
          to={`/admin/projects/${projectId}`}
          className="font-grotesk text-neutral-400 hover:text-neutral-600 transition-colors truncate max-w-[200px]"
        >
          {project.name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
        <span className="font-grotesk text-[#171717] font-medium">{config.label}</span>
      </div>

      {/* Service Header */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${config.color}15` }}
            >
              <Icon className="w-6 h-6" style={{ color: config.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-grotesk text-xl font-bold text-[#171717]">
                  {config.label}
                </h1>
                {service && (
                  <span
                    className={`text-xs font-grotesk font-medium px-2.5 py-0.5 rounded-full ${
                      service.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : service.status === 'not_started'
                        ? 'bg-neutral-100 text-neutral-500'
                        : service.status === 'completed'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {service.status === 'active'
                      ? 'Aktif'
                      : service.status === 'not_started'
                      ? 'Baslamadi'
                      : service.status === 'completed'
                      ? 'Tamamlandi'
                      : 'Duraklatildi'}
                  </span>
                )}
              </div>
              <p className="font-grotesk text-sm text-neutral-500 mt-0.5">{config.description}</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/admin/projects/${projectId}`)}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Module link */}
          {config.route && (
            <Link
              to={`/admin/projects/${projectId}/${config.route}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100 text-neutral-700 font-grotesk text-xs font-medium hover:bg-neutral-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {config.label} Paneline Git
            </Link>
          )}

          {/* Start workflow */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowWorkflowModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#171717] text-white font-grotesk text-xs font-medium hover:bg-neutral-800 transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5" />
            Workflow Baslat
          </motion.button>

          {/* Remove service */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRemoveService}
            disabled={removing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 font-grotesk text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Hizmeti Kaldir
          </motion.button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-50 rounded-xl p-1 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2.5 rounded-lg font-grotesk text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-[#171717] shadow-sm'
                : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            {tab.label}
            {tab.key === 'setup' && setupInstances.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                {setupInstances.length}
              </span>
            )}
            {tab.key === 'recurring' && recurringTemplates.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                {recurringTemplates.length}
              </span>
            )}
            {tab.key === 'on_demand' && onDemandInstances.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded-full">
                {onDemandInstances.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {workflowsLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
        </div>
      ) : (
        <>
          {/* Setup Tab */}
          {activeTab === 'setup' && (
            <div className="space-y-3">
              {setupInstances.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-neutral-100">
                  <Settings className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="font-grotesk text-sm font-medium text-neutral-500">
                    Kurulum sureci baslatilmamis
                  </p>
                  <p className="font-grotesk text-xs text-neutral-400 mt-1">
                    Yukaridaki "Workflow Baslat" butonunu kullanarak kurulum surecini baslatabilirsiniz.
                  </p>
                </div>
              ) : (
                setupInstances.map((instance) => (
                  <SetupInstanceCard
                    key={instance.id}
                    instance={instance}
                    projectId={projectId!}
                  />
                ))
              )}
            </div>
          )}

          {/* Recurring Tab */}
          {activeTab === 'recurring' && (
            <div className="space-y-3">
              {recurringTemplates.length === 0 && recurringInstances.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-neutral-100">
                  <GitBranch className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="font-grotesk text-sm font-medium text-neutral-500">
                    Henuz periyodik is akisi yok
                  </p>
                  <p className="font-grotesk text-xs text-neutral-400 mt-1">
                    Workflow Builder'da bir sablon olusturup periyodik olarak ayarlayabilirsiniz.
                  </p>
                </div>
              ) : (
                recurringTemplates.map((template) => (
                  <RecurringWorkflowCard
                    key={template.id}
                    template={template}
                    latestInstance={latestRecurringByTemplate.get(template.id)}
                    projectId={projectId!}
                    category={category!}
                  />
                ))
              )}
            </div>
          )}

          {/* On-demand Tab */}
          {activeTab === 'on_demand' && (
            <div className="space-y-3">
              {onDemandInstances.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-neutral-100">
                  <GitBranch className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="font-grotesk text-sm font-medium text-neutral-500">
                    Henuz tek seferlik is akisi yok
                  </p>
                </div>
              ) : (
                onDemandInstances.map((instance) => (
                  <OnDemandInstanceCard
                    key={instance.id}
                    instance={instance}
                    projectId={projectId!}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Start Workflow Modal */}
      <StartWorkflowModal
        isOpen={showWorkflowModal}
        onClose={() => setShowWorkflowModal(false)}
        templates={templates}
        category={serviceCategory}
        categoryLabel={config.label}
        onStart={handleStartWorkflow}
      />
    </div>
  );
};

export default ServiceDetailPage;
