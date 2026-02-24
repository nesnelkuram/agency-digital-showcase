import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, ChevronRight, Network } from 'lucide-react';
import WorkflowDesignChat from './components/ai-designer/WorkflowDesignChat';
import WorkflowDesignPreview from './components/ai-designer/WorkflowDesignPreview';
import { createWorkflowTemplate } from '@/shared/services/workflowTemplateService';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import type { WorkflowDraft } from '@/shared/types/workflowDesign';
import type { SubprocessSuggestion, LinkedParentNode, ParentContext } from './components/ai-designer/WorkflowDesignChat';

// Each level in the view stack
interface DesignerLevel {
  // unique key → forces WorkflowDesignChat to fully remount when switching levels
  key: number;
  label: string;
  draft: WorkflowDraft | null;
  sessionId: string | null;
  // Only populated for subprocess levels
  parentContext?: ParentContext;
  parentNodeId?: string;
}

const AIWorkflowDesigner: React.FC = () => {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { user } = useAuth();

  // --- View stack ---
  const [levelKeyCounter, setLevelKeyCounter] = useState(0);
  const [levels, setLevels] = useState<DesignerLevel[]>([
    { key: 0, label: 'Ana Workflow', draft: null, sessionId: null },
  ]);

  // subprocessSuggestions come from the current level's AI response
  const [subprocessSuggestions, setSubprocessSuggestions] = useState<SubprocessSuggestion[]>([]);

  // Save state (only relevant for main/top level)
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Derived: current active level
  const currentLevel = levels[levels.length - 1];
  const isSubLevel = levels.length > 1;

  // --- Callbacks ---

  const handleDraftUpdate = useCallback((draft: WorkflowDraft) => {
    setLevels(prev => prev.map((l, i) =>
      i === prev.length - 1 ? { ...l, draft } : l
    ));
    // Clear suggestions when draft changes (they'll come from next API response)
    setSubprocessSuggestions([]);
  }, []);

  const handleSessionStart = useCallback((sessionId: string) => {
    setLevels(prev => prev.map((l, i) =>
      i === prev.length - 1 ? { ...l, sessionId } : l
    ));
  }, []);

  const handleSubprocessSuggestions = useCallback((nodes: SubprocessSuggestion[]) => {
    setSubprocessSuggestions(nodes);
  }, []);

  // User clicks "AI ile Tasarla →" on a subprocess node in the preview
  const handleSubprocessDesign = useCallback((nodeId: string, nodeLabel: string) => {
    const parentLevel = levels[levels.length - 1];
    if (!parentLevel.sessionId) return;

    const newKey = levelKeyCounter + 1;
    setLevelKeyCounter(newKey);
    setSubprocessSuggestions([]);

    setLevels(prev => [
      ...prev,
      {
        key: newKey,
        label: nodeLabel,
        draft: null,
        sessionId: null,
        parentNodeId: nodeId,
        parentContext: {
          parentSessionId: parentLevel.sessionId!,
          parentWorkflowName: parentLevel.draft?.name || parentLevel.label,
          nodeId,
          nodeLabel,
        },
      },
    ]);
  }, [levels, levelKeyCounter]);

  // Sub-session saved → backend linked the child template back to parent session's draft
  // Update the parent level's draft in the stack so breadcrumb/preview reflects it
  const handleLinkedParentNode = useCallback((linked: LinkedParentNode) => {
    setLevels(prev => prev.map((l, i) => {
      // Find the level whose sessionId matches the parent
      if (i === prev.length - 2 && l.draft) {
        const updatedNodes = l.draft.nodes.map((n: any) =>
          n.id === linked.nodeId
            ? {
                ...n,
                subprocessConfig: {
                  childTemplateId: linked.childTemplateId,
                  childTemplateName: linked.childTemplateName,
                },
              }
            : n
        );
        return { ...l, draft: { ...l.draft, nodes: updatedNodes } };
      }
      return l;
    }));
  }, []);

  // Navigate back to the previous level
  const handleGoBack = useCallback(() => {
    setLevels(prev => prev.slice(0, -1));
    setSubprocessSuggestions([]);
  }, []);

  // Save the root-level draft as a template (manual save button)
  const handleSave = async () => {
    const rootDraft = levels[0].draft;
    if (!rootDraft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const templateId = await createWorkflowTemplate(tenantId, {
        name: rootDraft.name,
        description: rootDraft.description,
        serviceCategory: rootDraft.serviceCategory,
        defaultEstimatedDays: rootDraft.defaultEstimatedDays,
        nodes: rootDraft.nodes,
        edges: rootDraft.edges,
        phases: rootDraft.phases,
        depth: 0,
        status: 'draft',
        createdBy: user?.uid || '',
        createdByName: user?.displayName || user?.email || '',
      });
      navigate(`/admin/workflows/builder/${templateId}`);
    } catch (err: any) {
      setSaveError(err.message || 'Kaydetme hatasi');
    } finally {
      setSaving(false);
    }
  };

  const rootDraft = levels[0].draft;
  const undesignedCount = (currentLevel.draft?.nodes || [])
    .filter((n: any) => n.type === 'subprocess' && !n.subprocessConfig?.childTemplateId).length
    + subprocessSuggestions.length;

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSubLevel ? (
            <button
              onClick={handleGoBack}
              className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <Link
              to="/admin/workflows"
              className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5">
            {levels.map((level, i) => (
              <React.Fragment key={level.key}>
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
                <button
                  onClick={i < levels.length - 1 ? () => setLevels(prev => prev.slice(0, i + 1)) : undefined}
                  className={`font-grotesk text-sm font-semibold transition-colors ${
                    i === levels.length - 1
                      ? isSubLevel && i > 0
                        ? 'text-cyan-700'
                        : 'text-[#171717]'
                      : 'text-neutral-400 hover:text-neutral-700 cursor-pointer'
                  }`}
                >
                  {i > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Network className="w-3.5 h-3.5" />
                      {level.label}
                    </span>
                  )}
                  {i === 0 && (
                    <span>AI Workflow Tasarimcisi</span>
                  )}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Subprocess badge — show in main level when there are undesigned subprocesses */}
          {!isSubLevel && undesignedCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-grotesk">
              <Network className="w-3.5 h-3.5" />
              {undesignedCount} alt süreç bekliyor
            </span>
          )}

          {saveError && (
            <span className="font-grotesk text-sm text-red-500">{saveError}</span>
          )}

          {/* Only show save button for root level */}
          {!isSubLevel && (
            <button
              onClick={handleSave}
              disabled={!rootDraft || saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-neutral-300 disabled:text-neutral-500 transition-colors font-commons text-sm font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          )}
        </div>
      </div>

      {/* Split Panel — key forces remount on level change */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        style={{ height: 'calc(100vh - 180px)' }}
      >
        {/* Chat Panel — key forces full remount when switching levels */}
        <WorkflowDesignChat
          key={currentLevel.key}
          onDraftUpdate={handleDraftUpdate}
          onSessionStart={handleSessionStart}
          onSubprocessSuggestions={handleSubprocessSuggestions}
          onLinkedParentNode={handleLinkedParentNode}
          parentContext={currentLevel.parentContext}
          initialSessionId={currentLevel.sessionId || undefined}
        />

        {/* Preview Panel */}
        <WorkflowDesignPreview
          draft={currentLevel.draft}
          subprocessSuggestions={subprocessSuggestions}
          onSubprocessDesign={handleSubprocessDesign}
        />
      </div>
    </div>
  );
};

export default AIWorkflowDesigner;
