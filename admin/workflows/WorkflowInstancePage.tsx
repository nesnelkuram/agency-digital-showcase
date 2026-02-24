import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, ArrowLeft, Clock, AlertCircle, ChevronRight,
  ChevronDown, Network, X, Bot, Play, ArrowRight,
  Info, Database, Loader2,
} from 'lucide-react';
import { useWorkflowInstance } from '@/shared/hooks/useWorkflowInstances';
import { getWorkflowTemplate } from '@/shared/services/workflowTemplateService';
import { startStep } from '@/shared/services/workflowEngineService';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import type { WorkflowNodeTemplate } from '@/shared/types/workflow/template';
import DynamicStepForm from './components/instance/DynamicStepForm';

const stepStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending:          { bg: 'bg-neutral-100',  text: 'text-neutral-500',  label: 'Bekliyor' },
  ready:            { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Hazır' },
  in_progress:      { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Devam Ediyor' },
  awaiting_review:  { bg: 'bg-purple-100',  text: 'text-purple-700',  label: 'İnceleme Bekliyor' },
  revision_needed:  { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Revizyon Gerekli' },
  ai_processing:    { bg: 'bg-indigo-100',  text: 'text-indigo-700',  label: 'AI Çalışıyor' },
  ai_review:        { bg: 'bg-violet-100',  text: 'text-violet-700',  label: 'AI İnceleme' },
  completed:        { bg: 'bg-green-100',   text: 'text-green-700',   label: 'Tamamlandı' },
  skipped:          { bg: 'bg-neutral-100', text: 'text-neutral-400', label: 'Atlandı' },
  blocked:          { bg: 'bg-red-200',     text: 'text-red-800',     label: 'Engellendi' },
};

const nodeTypeIcon: Record<string, string> = {
  task:        '📋',
  ai_task:     '🤖',
  review:      '👁️',
  approval:    '✅',
  milestone:   '🏁',
  notification:'🔔',
  subprocess:  '🔗',
  condition:   '🔀',
};

// ─── Step Detail Drawer ───────────────────────────────────────────────────────
interface StepDrawerProps {
  instanceId: string;
  nodeId: string;
  node: WorkflowNodeTemplate | null;
  step: any;
  context: Record<string, any>;
  onClose: () => void;
  onActionDone: () => void;
}

const StepDrawer: React.FC<StepDrawerProps> = ({
  instanceId,
  nodeId,
  node,
  step,
  context,
  onClose,
  onActionDone,
}) => {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusInfo = stepStatusColors[step?.status] || stepStatusColors.pending;
  const hasForm = (node?.formSchema?.fields?.length ?? 0) > 0;
  const hasInputSchema = (node?.inputSchema?.length ?? 0) > 0;
  const lastAiExec = step?.aiExecutions?.[step.aiExecutions.length - 1];

  const handleStart = async () => {
    if (!tenantId || !user) return;
    setStarting(true);
    setActionError(null);
    try {
      await startStep(
        tenantId,
        instanceId,
        nodeId,
        user.uid,
        user.displayName || user.email || 'Kullanıcı',
        'staff'
      );
      onActionDone();
    } catch (err: any) {
      setActionError(err.message || 'Adım başlatılamadı');
    } finally {
      setStarting(false);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-40 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl">{node ? (nodeTypeIcon[node.type] || '📋') : '📋'}</span>
          <div className="min-w-0">
            <h3 className="font-grotesk text-base font-bold text-[#171717] truncate">
              {step?.label || node?.label || nodeId}
            </h3>
            {node?.description && (
              <p className="font-commons text-xs text-neutral-500 mt-0.5 line-clamp-1">
                {node.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
            {statusInfo.label}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Assignee */}
        {step?.assignment && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="font-commons text-xs font-semibold text-indigo-700">
                {step.assignment.userName?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-commons text-xs font-medium text-neutral-700">
                {step.assignment.userName}
              </p>
              <p className="font-commons text-[10px] text-neutral-400">Atanan kişi</p>
            </div>
          </div>
        )}

        {/* Gelen Veriler — inputSchema */}
        {hasInputSchema && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Database className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-commons text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                Gelen Veriler
              </span>
            </div>
            <div className="space-y-2">
              {node!.inputSchema!.map((schema) => {
                const value = schema.key.split('.').reduce((obj: any, k) => obj?.[k], context);
                const hasValue = value !== undefined && value !== null;
                return (
                  <div
                    key={schema.key}
                    className={`p-2.5 rounded-lg border text-xs font-commons ${
                      hasValue
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-neutral-200 bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-neutral-700">{schema.label}</span>
                      {schema.required && !hasValue && (
                        <span className="text-red-500 text-[10px]">Eksik</span>
                      )}
                    </div>
                    <p className="text-neutral-500 font-mono text-[10px] break-all">
                      {hasValue
                        ? typeof value === 'object'
                          ? JSON.stringify(value, null, 2)
                          : String(value)
                        : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Execution Result */}
        {lastAiExec && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Bot className="w-3.5 h-3.5 text-violet-500" />
              <span className="font-commons text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                AI Çıktısı
              </span>
              <span className={`ml-auto text-[10px] font-commons px-1.5 py-0.5 rounded ${
                lastAiExec.status === 'completed' ? 'bg-green-100 text-green-700' :
                lastAiExec.status === 'review_pending' ? 'bg-violet-100 text-violet-700' :
                'bg-red-100 text-red-700'
              }`}>
                {lastAiExec.status === 'completed' ? 'Tamamlandı' :
                 lastAiExec.status === 'review_pending' ? 'İnceleme Bekliyor' : 'Başarısız'}
              </span>
            </div>
            <div className="p-3 rounded-lg border border-violet-200 bg-violet-50">
              {lastAiExec.confidenceScore !== undefined && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1.5 bg-violet-200 rounded-full">
                    <div
                      className="h-1.5 bg-violet-600 rounded-full"
                      style={{ width: `${Math.round(lastAiExec.confidenceScore * 100)}%` }}
                    />
                  </div>
                  <span className="font-commons text-[10px] text-violet-700">
                    {Math.round(lastAiExec.confidenceScore * 100)}% güven
                  </span>
                </div>
              )}
              {step?.outputData && Object.keys(step.outputData).length > 0 && (
                <div className="space-y-1.5">
                  {Object.entries(step.outputData).map(([key, val]) => (
                    <div key={key} className="text-xs font-commons">
                      <span className="font-medium text-violet-800">{key}:</span>{' '}
                      <span className="text-violet-700 break-all">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {lastAiExec.error && (
                <p className="font-commons text-xs text-red-600">{lastAiExec.error}</p>
              )}
            </div>
          </div>
        )}

        {/* Form — only show if step is in_progress or revision_needed */}
        {hasForm && (step?.status === 'in_progress' || step?.status === 'revision_needed') && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Info className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-commons text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                Form Bilgileri
              </span>
            </div>
            <DynamicStepForm
              instanceId={instanceId}
              nodeId={nodeId}
              node={node!}
              existingData={step?.formData}
              onCompleted={() => { onActionDone(); onClose(); }}
            />
          </div>
        )}

        {/* Simple complete (no form, in_progress) */}
        {!hasForm && step?.status === 'in_progress' && node?.type !== 'ai_task' && (
          <div>
            <DynamicStepForm
              instanceId={instanceId}
              nodeId={nodeId}
              node={node || ({ formSchema: undefined } as any)}
              onCompleted={() => { onActionDone(); onClose(); }}
            />
            {/* Since no formSchema, show a manual complete button */}
          </div>
        )}

        {/* Output schema preview */}
        {(node?.outputSchema?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowRight className="w-3.5 h-3.5 text-green-500" />
              <span className="font-commons text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                Bu Adımın Çıktısı
              </span>
            </div>
            <div className="space-y-1.5">
              {node!.outputSchema!.map((s) => (
                <div key={s.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200">
                  <span className="font-commons text-[10px] font-mono text-green-800 flex-1">{s.key}</span>
                  <span className="font-commons text-[10px] text-green-600">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {actionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="font-commons text-xs text-red-700">{actionError}</p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {step?.status === 'ready' && (
        <div className="flex-shrink-0 px-5 py-4 border-t border-neutral-100 bg-neutral-50">
          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#171717] text-white rounded-xl font-commons text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {starting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Adımı Başlat
          </button>
        </div>
      )}
    </motion.div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const WorkflowInstancePage: React.FC = () => {
  const { id, projectId, instanceId } = useParams<{ id?: string; projectId?: string; instanceId?: string }>();
  const effectiveId = instanceId || id;
  const backTo = projectId ? `/admin/projects/${projectId}` : '/admin/workflows';
  const backLabel = projectId ? 'Projeye Dön' : "Workflow'lara Dön";

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedStepId = searchParams.get('step');

  const { instance, loading, error, refetch } = useWorkflowInstance(effectiveId);
  const [expandedSubprocess, setExpandedSubprocess] = useState<Record<string, boolean>>({});

  // Template loading for node metadata (formSchema, inputSchema, outputSchema)
  const tenantId = useTenantId();
  const [templateNodes, setTemplateNodes] = useState<Record<string, WorkflowNodeTemplate>>({});
  const [templateLoading, setTemplateLoading] = useState(false);

  const loadTemplate = useCallback(async () => {
    if (!tenantId || !instance?.templateId) return;
    setTemplateLoading(true);
    try {
      const tmpl = await getWorkflowTemplate(tenantId, instance.templateId);
      if (tmpl) {
        const nodeMap: Record<string, WorkflowNodeTemplate> = {};
        for (const node of tmpl.nodes) {
          nodeMap[node.id] = node;
        }
        setTemplateNodes(nodeMap);
      }
    } catch (e) {
      console.error('Template load failed:', e);
    } finally {
      setTemplateLoading(false);
    }
  }, [tenantId, instance?.templateId]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const openStep = (nodeId: string) => {
    setSearchParams({ step: nodeId });
  };

  const closeStep = () => {
    setSearchParams({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="space-y-6">
        <Link to={backTo} className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-commons text-sm">
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="font-commons text-red-700">{error || 'Workflow bulunamadı'}</p>
        </div>
      </div>
    );
  }

  const allStepEntries = instance.steps ? Object.entries(instance.steps) : [];
  const topLevelSteps = allStepEntries.filter(([, step]) => !step.isSubStep);
  const subStepsByParent: Record<string, [string, typeof allStepEntries[0][1]][]> = {};
  allStepEntries
    .filter(([, step]) => step.isSubStep && step.parentStepId)
    .forEach(([nodeId, step]) => {
      const parent = step.parentStepId!;
      if (!subStepsByParent[parent]) subStepsByParent[parent] = [];
      subStepsByParent[parent].push([nodeId, step]);
    });

  const instanceStatusLabel = {
    pending: 'Bekliyor',
    active: 'Aktif',
    paused: 'Duraklatıldı',
    completed: 'Tamamlandı',
    cancelled: 'İptal Edildi',
  }[instance.status] || instance.status;

  // Drawer data
  const selectedStep = selectedStepId ? instance.steps[selectedStepId] : null;
  const selectedNode = selectedStepId ? (templateNodes[selectedStepId] || null) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={backTo}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
            title={backLabel}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-grotesk font-bold text-[#171717] flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-indigo-600" />
              {instance.templateName}
            </h1>
            <p className="font-commons text-sm text-neutral-500 mt-0.5">
              {instance.projectName} &middot; {instance.clientName}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          instance.status === 'active' ? 'bg-green-100 text-green-700' :
          instance.status === 'completed' ? 'bg-blue-100 text-blue-700' :
          instance.status === 'paused' ? 'bg-amber-100 text-amber-700' :
          'bg-neutral-100 text-neutral-700'
        }`}>
          {instanceStatusLabel}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl p-6 border border-neutral-100">
        <div className="flex items-center justify-between mb-2">
          <span className="font-commons text-sm font-medium text-neutral-700">Genel İlerleme</span>
          <span className="font-commons text-sm font-bold text-indigo-600">{instance.progress}%</span>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-3">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${instance.progress}%` }}
          />
        </div>
        {instance.activeStepLabels?.length > 0 && (
          <p className="font-commons text-xs text-neutral-400 mt-2">
            Aktif: {instance.activeStepLabels.join(' · ')}
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="bg-white rounded-xl border border-neutral-100">
        <div className="p-4 border-b border-neutral-100">
          <h2 className="font-commons text-lg font-semibold text-[#171717]">Adımlar</h2>
          {templateLoading && (
            <p className="font-commons text-xs text-neutral-400 mt-0.5">Şablon yükleniyor...</p>
          )}
        </div>
        {topLevelSteps.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="font-commons text-sm text-neutral-500">Henüz adım başlamamış.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {topLevelSteps.map(([nodeId, step]) => {
              const statusInfo = stepStatusColors[step.status] || stepStatusColors.pending;
              const isSubprocess = step.isSubProcess;
              const childSteps = subStepsByParent[nodeId] || [];
              const isExpanded = expandedSubprocess[nodeId] ?? false;

              if (isSubprocess) {
                return (
                  <div key={nodeId}>
                    <button
                      onClick={() => setExpandedSubprocess((prev) => ({ ...prev, [nodeId]: !isExpanded }))}
                      className="w-full p-4 hover:bg-cyan-50 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Network className="w-4 h-4 text-cyan-600" />
                          <span className="font-commons text-sm font-semibold text-cyan-800">
                            {step.label || nodeId}
                          </span>
                          {childSteps.length > 0 && (
                            <span className="font-commons text-[10px] text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded">
                              {childSteps.filter(([, s]) => s.status === 'completed').length}/{childSteps.length} tamamlandı
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                            {statusInfo.label}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-neutral-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-neutral-400" />
                          )}
                        </div>
                      </div>
                    </button>
                    {isExpanded && childSteps.length > 0 && (
                      <div className="border-t border-cyan-100 divide-y divide-cyan-50">
                        {childSteps.map(([childNodeId, childStep]) => {
                          const childStatusInfo = stepStatusColors[childStep.status] || stepStatusColors.pending;
                          return (
                            <button
                              key={childNodeId}
                              onClick={() => openStep(childNodeId)}
                              className="block w-full text-left pl-10 pr-4 py-3 hover:bg-cyan-50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2.5 h-2.5 rounded-full ${
                                    childStep.status === 'completed' ? 'bg-green-500' :
                                    childStep.status === 'in_progress' ? 'bg-amber-500 animate-pulse' :
                                    childStep.status === 'ready' ? 'bg-blue-500' :
                                    'bg-neutral-300'
                                  }`} />
                                  <span className="font-commons text-xs font-medium text-neutral-700">
                                    {childStep.label || childNodeId.split('::')[1] || childNodeId}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${childStatusInfo.bg} ${childStatusInfo.text}`}>
                                    {childStatusInfo.label}
                                  </span>
                                  <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
                                </div>
                              </div>
                              {childStep.assignment && (
                                <p className="font-commons text-xs text-neutral-400 mt-1 ml-5">
                                  Atanan: {childStep.assignment.userName}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={nodeId}
                  onClick={() => openStep(nodeId)}
                  className="block w-full text-left p-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        step.status === 'completed' ? 'bg-green-500' :
                        step.status === 'in_progress' ? 'bg-amber-500 animate-pulse' :
                        step.status === 'ai_processing' ? 'bg-indigo-500 animate-pulse' :
                        step.status === 'ready' ? 'bg-blue-500' :
                        'bg-neutral-300'
                      }`} />
                      <div>
                        <span className="font-commons text-sm font-medium text-[#171717]">
                          {step.label || nodeId}
                        </span>
                        {step.assignment && (
                          <p className="font-commons text-xs text-neutral-400 mt-0.5">
                            {step.assignment.userName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Show AI badge */}
                      {(step.status === 'ai_processing' || step.status === 'ai_review') && (
                        <Bot className="w-3.5 h-3.5 text-violet-500" />
                      )}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                        {statusInfo.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-300" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Audit Log */}
      {instance.auditLog && instance.auditLog.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-100">
          <div className="p-4 border-b border-neutral-100">
            <h2 className="font-commons text-lg font-semibold text-[#171717]">Aktivite Geçmişi</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {instance.auditLog.slice(-10).reverse().map((entry) => (
              <div key={entry.id} className="p-4">
                <p className="font-commons text-sm text-[#171717]">{entry.description}</p>
                <p className="font-commons text-xs text-neutral-400 mt-1">{entry.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step Detail Drawer overlay */}
      <AnimatePresence>
        {selectedStepId && selectedStep && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-30"
              onClick={closeStep}
            />
            <StepDrawer
              key={selectedStepId}
              instanceId={effectiveId!}
              nodeId={selectedStepId}
              node={selectedNode}
              step={selectedStep}
              context={instance.context || {}}
              onClose={closeStep}
              onActionDone={() => { refetch(); }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkflowInstancePage;
