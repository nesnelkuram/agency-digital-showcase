import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  SkipForward,
  Clock,
  AlertCircle,
  User,
  FileText,
  MessageSquare,
  Bot,
  RotateCcw,
  Paperclip,
  Send,
} from 'lucide-react';
import { useWorkflowInstance } from '@/shared/hooks/useWorkflowInstances';
import type { StepInstance, StepInstanceStatus } from '@/shared/types/workflow/instance';

const stepStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
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

const WorkflowStepDetailPage: React.FC = () => {
  const { id, instanceId, stepId } = useParams<{ id?: string; instanceId?: string; stepId?: string }>();
  const effectiveInstanceId = instanceId || id;
  const { instance, loading, error } = useWorkflowInstance(effectiveInstanceId);
  const [commentText, setCommentText] = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !instance || !stepId) {
    return (
      <div className="space-y-6">
        <Link
          to={effectiveInstanceId ? `/admin/workflows/instance/${effectiveInstanceId}` : '/admin/workflows'}
          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-commons text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Geri Don
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="font-commons text-red-700">{error || 'Adim bulunamadi'}</p>
        </div>
      </div>
    );
  }

  const step: StepInstance | undefined = instance.steps
    ? (instance.steps as Record<string, StepInstance>)[stepId]
    : undefined;

  if (!step) {
    return (
      <div className="space-y-6">
        <Link
          to={`/admin/workflows/instance/${effectiveInstanceId}`}
          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-commons text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Workflow'a Don
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="font-commons text-red-700">Adim bulunamadi: {stepId}</p>
        </div>
      </div>
    );
  }

  const statusInfo = stepStatusConfig[step.status] || stepStatusConfig.pending;
  const canStart = step.status === 'ready';
  const canComplete = step.status === 'in_progress' || step.status === 'ai_review';
  const canReject = step.status === 'awaiting_review' || step.status === 'ai_review';
  const canSkip = step.status === 'ready' || step.status === 'pending';

  const formatDate = (ts: any) => {
    if (!ts) return '-';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/admin/workflows/instance/${effectiveInstanceId}`}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-ramillas font-bold text-[#171717]">
              {stepId}
            </h1>
            <p className="font-commons text-sm text-neutral-500 mt-0.5">
              {instance.templateName} &middot; {instance.projectName}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Action Buttons */}
      {(canStart || canComplete || canReject || canSkip) && (
        <div className="bg-white rounded-xl border border-neutral-100 p-4">
          <div className="flex items-center gap-3">
            {canStart && (
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-commons text-sm font-medium">
                <Play className="w-4 h-4" />
                Basla
              </button>
            )}
            {canComplete && (
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-commons text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Tamamla
              </button>
            )}
            {canReject && (
              <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-commons text-sm font-medium">
                <XCircle className="w-4 h-4" />
                Reddet
              </button>
            )}
            {canSkip && (
              <button className="flex items-center gap-2 px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors font-commons text-sm font-medium">
                <SkipForward className="w-4 h-4" />
                Atla
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assignment Info */}
          {step.assignment && (
            <div className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Atama Bilgisi
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-commons text-xs text-neutral-400">Atanan Kisi</p>
                  <p className="font-commons text-sm text-[#171717] font-medium">{step.assignment.userName}</p>
                </div>
                <div>
                  <p className="font-commons text-xs text-neutral-400">Rol</p>
                  <p className="font-commons text-sm text-[#171717]">{step.assignment.userRole}</p>
                </div>
                <div>
                  <p className="font-commons text-xs text-neutral-400">Atanma Tarihi</p>
                  <p className="font-commons text-sm text-[#171717]">{formatDate(step.assignment.assignedAt)}</p>
                </div>
                {step.startedAt && (
                  <div>
                    <p className="font-commons text-xs text-neutral-400">Baslanma Tarihi</p>
                    <p className="font-commons text-sm text-[#171717]">{formatDate(step.startedAt)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Data */}
          {step.formData && Object.keys(step.formData).length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Form Verileri
              </h3>
              <div className="space-y-3">
                {Object.entries(step.formData).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3">
                    <span className="font-commons text-xs text-neutral-400 min-w-[120px] pt-0.5">{key}</span>
                    <span className="font-commons text-sm text-[#171717]">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables */}
          {step.deliverables && step.deliverables.length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Teslim Edilenler
              </h3>
              <div className="space-y-2">
                {step.deliverables.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-neutral-400" />
                      <div>
                        <p className="font-commons text-sm font-medium text-[#171717]">{d.name}</p>
                        <p className="font-commons text-xs text-neutral-400">{d.type} &middot; {formatDate(d.uploadedAt)}</p>
                      </div>
                    </div>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-commons text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Goruntule
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Executions */}
          {step.aiExecutions && step.aiExecutions.length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                AI Calismalari
              </h3>
              <div className="space-y-3">
                {step.aiExecutions.map((exec) => (
                  <div key={exec.executionId} className="border border-neutral-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-commons text-sm font-medium text-[#171717]">{exec.agentType}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          exec.status === 'completed' ? 'bg-green-100 text-green-700' :
                          exec.status === 'running' ? 'bg-amber-100 text-amber-700' :
                          exec.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {exec.status === 'completed' ? 'Tamamlandi' :
                           exec.status === 'running' ? 'Calisiyor' :
                           exec.status === 'failed' ? 'Basarisiz' :
                           'Review Bekliyor'}
                        </span>
                      </div>
                      {exec.confidenceScore !== undefined && (
                        <span className="font-commons text-xs text-neutral-500">
                          Guven: %{Math.round(exec.confidenceScore * 100)}
                        </span>
                      )}
                    </div>
                    {exec.output && (
                      <pre className="mt-2 p-3 bg-neutral-50 rounded-lg font-mono text-xs text-neutral-700 overflow-x-auto max-h-48 overflow-y-auto">
                        {JSON.stringify(exec.output, null, 2)}
                      </pre>
                    )}
                    {exec.error && (
                      <p className="mt-2 font-commons text-xs text-red-600 bg-red-50 p-2 rounded">
                        {exec.error}
                      </p>
                    )}
                    {exec.tokensUsed && (
                      <p className="mt-2 font-commons text-xs text-neutral-400">
                        Token: {exec.tokensUsed.input} girdi / {exec.tokensUsed.output} cikti
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-white rounded-xl border border-neutral-100 p-5">
            <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Yorumlar
            </h3>
            {step.comments && step.comments.length > 0 ? (
              <div className="space-y-3 mb-4">
                {step.comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-commons text-sm font-medium text-[#171717]">{comment.userName}</span>
                      <span className="font-commons text-xs text-neutral-400">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="font-commons text-sm text-neutral-700">{comment.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-commons text-sm text-neutral-400 mb-4">Henuz yorum yok.</p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Yorum yaz..."
                className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
              />
              <button
                disabled={!commentText.trim()}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Step Info */}
          <div className="bg-white rounded-xl border border-neutral-100 p-5">
            <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Adim Detaylari
            </h3>
            <div className="space-y-3">
              <div>
                <p className="font-commons text-xs text-neutral-400">Durum</p>
                <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </span>
              </div>
              <div>
                <p className="font-commons text-xs text-neutral-400">Revizyon</p>
                <p className="font-commons text-sm text-[#171717]">#{step.currentRevision}</p>
              </div>
              {step.startedAt && (
                <div>
                  <p className="font-commons text-xs text-neutral-400">Baslama</p>
                  <p className="font-commons text-sm text-[#171717]">{formatDate(step.startedAt)}</p>
                </div>
              )}
              {step.completedAt && (
                <div>
                  <p className="font-commons text-xs text-neutral-400">Tamamlanma</p>
                  <p className="font-commons text-sm text-[#171717]">{formatDate(step.completedAt)}</p>
                </div>
              )}
              {step.dueDate && (
                <div>
                  <p className="font-commons text-xs text-neutral-400">Son Tarih</p>
                  <p className="font-commons text-sm text-[#171717]">{formatDate(step.dueDate)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Output Data */}
          {step.outputData && Object.keys(step.outputData).length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-3">
                Cikti Verileri
              </h3>
              <pre className="p-3 bg-neutral-50 rounded-lg font-mono text-xs text-neutral-700 overflow-x-auto max-h-48 overflow-y-auto">
                {JSON.stringify(step.outputData, null, 2)}
              </pre>
            </div>
          )}

          {/* Revisions */}
          {step.revisions && step.revisions.length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Revizyon Gecmisi
              </h3>
              <div className="space-y-3">
                {step.revisions.map((rev) => (
                  <div key={rev.revisionNumber} className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-commons text-xs font-medium text-red-700">
                        Revizyon #{rev.revisionNumber}
                      </span>
                      <span className="font-commons text-xs text-neutral-400">
                        {formatDate(rev.rejectedAt)}
                      </span>
                    </div>
                    <p className="font-commons text-sm text-red-800">{rev.reason}</p>
                    <p className="font-commons text-xs text-neutral-500 mt-1">
                      Reddeden: {rev.rejectedBy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SOP Progress */}
          {step.sopProgress && Object.keys(step.sopProgress).length > 0 && (
            <div className="bg-white rounded-xl border border-neutral-100 p-5">
              <h3 className="font-commons text-sm font-semibold text-neutral-700 mb-3">
                SOP Ilerleme
              </h3>
              <div className="space-y-2">
                {Object.entries(step.sopProgress).map(([sopId, progress]) => (
                  <div key={sopId} className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg">
                    <span className="font-commons text-xs text-neutral-700">{sopId}</span>
                    <span className={`font-commons text-xs font-medium ${
                      progress.completedAt ? 'text-green-600' : progress.viewedAt ? 'text-amber-600' : 'text-neutral-400'
                    }`}>
                      {progress.completedAt ? 'Tamamlandi' : progress.viewedAt ? 'Goruntulendi' : 'Bekliyor'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowStepDetailPage;
