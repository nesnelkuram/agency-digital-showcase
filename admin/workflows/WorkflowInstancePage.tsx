import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { GitBranch, ArrowLeft, Play, Pause, CheckCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { useWorkflowInstance } from '@/shared/hooks/useWorkflowInstances';

const stepStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-neutral-100', text: 'text-neutral-500', label: 'Bekliyor' },
  ready: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Hazir' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Devam Ediyor' },
  awaiting_review: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Review Bekliyor' },
  revision_needed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Revizyon Gerekli' },
  ai_processing: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'AI Calisiyor' },
  ai_review: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'AI Review' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Tamamlandi' },
  skipped: { bg: 'bg-neutral-100', text: 'text-neutral-400', label: 'Atlandi' },
  blocked: { bg: 'bg-red-200', text: 'text-red-800', label: 'Engellendi' },
};

const WorkflowInstancePage: React.FC = () => {
  const { id, instanceId } = useParams<{ id?: string; projectId?: string; instanceId?: string }>();
  const effectiveId = instanceId || id;
  const { instance, loading, error } = useWorkflowInstance(effectiveId);

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
        <Link to="/admin/workflows" className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-commons text-sm">
          <ArrowLeft className="w-4 h-4" />
          Workflow'lara Don
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="font-commons text-red-700">{error || 'Workflow bulunamadi'}</p>
        </div>
      </div>
    );
  }

  const steps = instance.steps ? Object.entries(instance.steps) : [];
  const instanceStatusLabel = {
    pending: 'Bekliyor',
    active: 'Aktif',
    paused: 'Duraklatildi',
    completed: 'Tamamlandi',
    cancelled: 'Iptal Edildi',
  }[instance.status] || instance.status;

  return (
    <div className="space-y-6">
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
            <h1 className="text-xl md:text-2xl font-ramillas font-bold text-[#171717] flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-indigo-600" />
              {instance.templateName}
            </h1>
            <p className="font-commons text-sm text-neutral-500 mt-0.5">
              {instance.projectName} &middot; {instance.clientName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            instance.status === 'active' ? 'bg-green-100 text-green-700' :
            instance.status === 'completed' ? 'bg-blue-100 text-blue-700' :
            instance.status === 'paused' ? 'bg-amber-100 text-amber-700' :
            'bg-neutral-100 text-neutral-700'
          }`}>
            {instanceStatusLabel}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl p-6 border border-neutral-100">
        <div className="flex items-center justify-between mb-2">
          <span className="font-commons text-sm font-medium text-neutral-700">Genel Ilerleme</span>
          <span className="font-commons text-sm font-bold text-indigo-600">{instance.progress}%</span>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-3">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${instance.progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-xl border border-neutral-100">
        <div className="p-4 border-b border-neutral-100">
          <h2 className="font-commons text-lg font-semibold text-[#171717]">Adimlar</h2>
        </div>
        {steps.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="font-commons text-sm text-neutral-500">Henuz adim baslamamis.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {steps.map(([nodeId, step]) => {
              const statusInfo = stepStatusColors[step.status] || stepStatusColors.pending;
              return (
                <Link
                  key={nodeId}
                  to={`/admin/workflows/instance/${effectiveId}/step/${nodeId}`}
                  className="block p-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        step.status === 'completed' ? 'bg-green-500' :
                        step.status === 'in_progress' ? 'bg-amber-500 animate-pulse' :
                        step.status === 'ready' ? 'bg-blue-500' :
                        'bg-neutral-300'
                      }`} />
                      <span className="font-commons text-sm font-medium text-[#171717]">{nodeId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                        {statusInfo.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-300" />
                    </div>
                  </div>
                  {step.assignment && (
                    <p className="font-commons text-xs text-neutral-500 mt-1 ml-6">
                      Atanan: {step.assignment.userName}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Audit Log */}
      {instance.auditLog && instance.auditLog.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-100">
          <div className="p-4 border-b border-neutral-100">
            <h2 className="font-commons text-lg font-semibold text-[#171717]">Aktivite Gecmisi</h2>
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
    </div>
  );
};

export default WorkflowInstancePage;
