import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import WorkflowDesignChat from './components/ai-designer/WorkflowDesignChat';
import WorkflowDesignPreview from './components/ai-designer/WorkflowDesignPreview';
import { createWorkflowTemplate } from '@/shared/services/workflowTemplateService';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import type { WorkflowDraft } from '@/shared/types/workflowDesign';

const AIWorkflowDesigner: React.FC = () => {
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { user } = useAuth();

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);

    try {
      const templateId = await createWorkflowTemplate(tenantId, {
        name: draft.name,
        description: draft.description,
        serviceCategory: draft.serviceCategory,
        defaultEstimatedDays: draft.defaultEstimatedDays,
        nodes: draft.nodes,
        edges: draft.edges,
        phases: draft.phases,
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

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/workflows"
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl md:text-2xl font-ramillas font-bold text-[#171717]">
            AI Workflow Tasarimcisi
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="font-grotesk text-sm text-red-500">{saveError}</span>
          )}
          <button
            onClick={handleSave}
            disabled={!draft || saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-neutral-300 disabled:text-neutral-500 transition-colors font-commons text-sm font-medium"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Kaydet
          </button>
        </div>
      </div>

      {/* Split Panel */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        style={{ height: 'calc(100vh - 180px)' }}
      >
        {/* Chat Panel */}
        <WorkflowDesignChat onDraftUpdate={setDraft} />

        {/* Preview Panel */}
        <WorkflowDesignPreview draft={draft} />
      </div>
    </div>
  );
};

export default AIWorkflowDesigner;
