import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { GitBranch, ArrowLeft, Save, Settings2, Loader2, Check, ChevronRight, RefreshCw, CheckCircle } from 'lucide-react';
import { useWorkflowTemplate, useWorkflowTemplates } from '@/shared/hooks/useWorkflowTemplates';
import { useWorkflowBuilderStore } from './store/workflowBuilderStore';
import WorkflowCanvas from './components/canvas/WorkflowCanvas';
import NodePalette from './components/canvas/NodePalette';
import NodeConfigPanel from './components/canvas/NodeConfigPanel';
import type { WorkflowNodeTemplate, WorkflowEdgeTemplate, ServiceCategory } from '@/shared/types/workflow';

const categoryOptions: { value: ServiceCategory; label: string }[] = [
  { value: 'social_media', label: 'Sosyal Medya' },
  { value: 'video_production', label: 'Video Produksiyon' },
  { value: 'photography', label: 'Fotograf' },
  { value: 'web_development', label: 'Web Gelistirme' },
  { value: 'graphic_design', label: 'Grafik Tasarim' },
  { value: 'consulting', label: 'Danismanlik' },
  { value: 'other', label: 'Diger' },
];

const WorkflowBuilderPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { template, loading } = useWorkflowTemplate(id);
  const { createTemplate, updateTemplate, publishTemplate } = useWorkflowTemplates();

  const {
    nodes,
    edges,
    selectedNodeId,
    isDirty,
    templateName,
    templateDescription,
    serviceCategory,
    defaultEstimatedDays,
    parentTemplateId,
    depth,
    recurringConfig,
    setTemplateInfo,
    loadFromTemplate,
    reset,
  } = useWorkflowBuilderStore();

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isNew = !id;
  const title = isNew ? 'Yeni Workflow Sablonu' : templateName || 'Workflow Builder';

  // Load template data into store when template is fetched
  useEffect(() => {
    if (template) {
      loadFromTemplate(template);
    } else if (isNew) {
      reset();
    }
  }, [template, isNew]);

  // Convert React Flow state back to WorkflowTemplate format
  const buildTemplateData = useCallback(() => {
    const templateNodes: WorkflowNodeTemplate[] = nodes.map((node) => ({
      id: node.id,
      type: node.data.nodeType as WorkflowNodeTemplate['type'],
      label: (node.data.label as string) || '',
      description: (node.data.description as string) || undefined,
      position: { x: node.position.x, y: node.position.y },
      assigneeRole: (node.data.assigneeRole as string) || undefined,
      estimatedDurationHours: (node.data.estimatedDurationHours as number) || undefined,
      sopResources: [],
      agentId: (node.data.agentId as string) || undefined,
      agentName: (node.data.agentName as string) || undefined,
      reviewConfig: node.data.reviewConfig as WorkflowNodeTemplate['reviewConfig'],
      conditionConfig: node.data.conditionConfig as WorkflowNodeTemplate['conditionConfig'],
      notificationConfig: node.data.notificationConfig as WorkflowNodeTemplate['notificationConfig'],
      formSchema: node.data.formSchema as WorkflowNodeTemplate['formSchema'],
      inputSchema: node.data.inputSchema as WorkflowNodeTemplate['inputSchema'],
      outputSchema: node.data.outputSchema as WorkflowNodeTemplate['outputSchema'],
      aiAgentConfig: node.data.aiAgentConfig as WorkflowNodeTemplate['aiAgentConfig'],
      subprocessConfig: node.data.subprocessConfig as WorkflowNodeTemplate['subprocessConfig'],
    }));

    const templateEdges: WorkflowEdgeTemplate[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: (edge.data?.edgeType as WorkflowEdgeTemplate['type']) || 'default',
      label: edge.label as string | undefined,
      conditionValue: edge.data?.conditionValue as string | undefined,
    }));

    return {
      name: templateName || 'Isimsiz Sablon',
      description: templateDescription || '',
      serviceCategory: (serviceCategory as ServiceCategory) || 'other',
      defaultEstimatedDays: defaultEstimatedDays || 7,
      nodes: templateNodes,
      edges: templateEdges,
      phases: [],
      depth,
      ...(parentTemplateId && { parentTemplateId }),
      ...(recurringConfig && { recurringConfig }),
      status: 'draft' as const,
      createdBy: '',
      createdByName: '',
    };
  }, [nodes, edges, templateName, templateDescription, serviceCategory, defaultEstimatedDays, depth, parentTemplateId, recurringConfig]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const data = buildTemplateData();

      if (isNew) {
        const newId = await createTemplate(data);
        if (newId) {
          navigate(`/admin/workflows/builder/${newId}`, { replace: true });
        }
      } else if (id) {
        await updateTemplate(id, {
          ...data,
          nodes: data.nodes,
          edges: data.edges,
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Kaydetme hatasi:', err);
    } finally {
      setSaving(false);
    }
  }, [isNew, id, buildTemplateData, createTemplate, updateTemplate, navigate]);

  const handlePublish = useCallback(async () => {
    if (!id || isNew) return;
    setPublishing(true);
    try {
      // Save first to make sure latest changes are persisted
      const data = buildTemplateData();
      await updateTemplate(id, { ...data, nodes: data.nodes, edges: data.edges });
      await publishTemplate(id);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Yayinlama hatasi:', err);
    } finally {
      setPublishing(false);
    }
  }, [id, isNew, buildTemplateData, updateTemplate, publishTemplate]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/workflows"
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            {/* Breadcrumb for child templates */}
            {depth > 0 && parentTemplateId && (
              <div className="flex items-center gap-1.5 mb-1 text-xs font-commons text-neutral-500">
                <Link to="/admin/workflows" className="hover:text-indigo-600 transition-colors">
                  Sablonlar
                </Link>
                <ChevronRight className="w-3 h-3" />
                <Link
                  to={`/admin/workflows/builder/${parentTemplateId}`}
                  className="hover:text-indigo-600 transition-colors"
                >
                  Ust Sablon
                </Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-cyan-600 font-medium">Alt Sablon</span>
              </div>
            )}
            <h1 className="text-xl md:text-2xl font-grotesk font-bold text-[#171717] flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-indigo-600" />
              {title}
              {depth > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
                  Alt Sablon
                </span>
              )}
            </h1>
            {template && (
              <p className="font-commons text-sm text-neutral-500 mt-0.5">
                v{template.version} &middot;{' '}
                {template.status === 'draft'
                  ? 'Taslak'
                  : template.status === 'published'
                    ? 'Yayinda'
                    : 'Arsivlendi'}
              </p>
            )}
            {isDirty && (
              <span className="inline-block mt-0.5 font-commons text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                Kaydedilmemis degisiklikler
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-neutral-50 transition-colors font-commons text-sm text-neutral-700 ${
              showSettings ? 'border-indigo-300 bg-indigo-50' : 'border-neutral-200'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Ayarlar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || publishing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-60 transition-colors font-commons text-sm font-medium"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          {/* Publish button — only shown for existing (non-new) templates */}
          {!isNew && template?.status !== 'published' && (
            <button
              onClick={handlePublish}
              disabled={saving || publishing}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors font-commons text-sm font-medium"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {publishing ? 'Yayınlanıyor...' : 'Yayınla'}
            </button>
          )}
          {!isNew && template?.status === 'published' && (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg font-commons text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Yayında
            </span>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Sablon Adi
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateInfo({ name: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                placeholder="Ornek: Sosyal Medya Yonetimi"
              />
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Aciklama
              </label>
              <input
                type="text"
                value={templateDescription}
                onChange={(e) => setTemplateInfo({ description: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                placeholder="Sablon aciklamasi"
              />
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Hizmet Kategorisi
              </label>
              <select
                value={serviceCategory}
                onChange={(e) => setTemplateInfo({ serviceCategory: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                Tahmini Sure (gun)
              </label>
              <input
                type="number"
                min={1}
                value={defaultEstimatedDays}
                onChange={(e) => setTemplateInfo({ defaultEstimatedDays: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>

          {/* Recurring Config */}
          <div className="border-t border-neutral-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-4 h-4 text-indigo-500" />
              <span className="font-commons text-sm font-medium text-neutral-700">Tekrar Eden İş Akışı</span>
              <label className="ml-auto flex items-center gap-2 cursor-pointer">
                <span className="font-commons text-xs text-neutral-500">Aktif</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={recurringConfig?.enabled ?? false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTemplateInfo({
                          recurringConfig: {
                            enabled: true,
                            cronExpression: recurringConfig?.cronExpression || '0 9 * * 1',
                            timezone: recurringConfig?.timezone || 'Europe/Istanbul',
                            autoStartOnCreate: recurringConfig?.autoStartOnCreate ?? true,
                          },
                        });
                      } else {
                        setTemplateInfo({ recurringConfig: null });
                      }
                    }}
                  />
                  <div className="w-9 h-5 bg-neutral-200 peer-checked:bg-indigo-600 rounded-full transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
                </div>
              </label>
            </div>

            {recurringConfig?.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-indigo-50 rounded-lg p-3">
                <div>
                  <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                    Cron İfadesi
                  </label>
                  <input
                    type="text"
                    value={recurringConfig.cronExpression}
                    onChange={(e) =>
                      setTemplateInfo({
                        recurringConfig: { ...recurringConfig, cronExpression: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm font-mono focus:outline-none focus:border-indigo-400 transition-colors"
                    placeholder="0 9 * * 1"
                  />
                  <p className="font-commons text-[10px] text-neutral-400 mt-1">
                    dk saat gün/ay ay gün/hafta — ör: <code>0 9 * * 1</code> = Pzt 09:00
                  </p>
                </div>
                <div>
                  <label className="font-commons text-xs font-medium text-neutral-600 mb-1 block">
                    Saat Dilimi
                  </label>
                  <select
                    value={recurringConfig.timezone}
                    onChange={(e) =>
                      setTemplateInfo({
                        recurringConfig: { ...recurringConfig, timezone: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                  >
                    <option value="Europe/Istanbul">Europe/Istanbul (UTC+3)</option>
                    <option value="Europe/London">Europe/London (UTC+0)</option>
                    <option value="America/New_York">America/New_York (UTC-5)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recurringConfig.autoStartOnCreate}
                      onChange={(e) =>
                        setTemplateInfo({
                          recurringConfig: { ...recurringConfig, autoStartOnCreate: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded border-neutral-300 text-indigo-600"
                    />
                    <span className="font-commons text-sm text-neutral-700">Oluşturulunca otomatik başlat</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Builder Canvas */}
      <div
        className="bg-white rounded-xl border border-neutral-200 overflow-hidden"
        style={{ height: showSettings ? 'calc(100vh - 280px)' : 'calc(100vh - 180px)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex h-full">
            {/* Left Panel - Node Palette */}
            <NodePalette />

            {/* Center - Canvas */}
            <WorkflowCanvas />

            {/* Right Panel - Node Config */}
            {selectedNodeId && <NodeConfigPanel />}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowBuilderPage;
