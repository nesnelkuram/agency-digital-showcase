import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  User,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Tag,
  FolderOpen,
  Building2,
} from 'lucide-react';
import type { Task, TaskStatus } from '@/shared/types/task';
import { updateTask } from '@/shared/services/taskService';
import { useTenantId } from '@/shared/hooks/useTenant';
import AIPriorityBadge from './components/AIPriorityBadge';
import DelegationApprovalBar from './components/DelegationApprovalBar';

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'open', label: 'Açık' },
  { value: 'in_progress', label: 'Devam Ediyor' },
  { value: 'awaiting_review', label: 'İnceleme Bekliyor' },
  { value: 'blocked', label: 'Engellendi' },
  { value: 'completed', label: 'Tamamlandı' },
];

const RISK_COLORS: Record<string, string> = {
  none: 'text-emerald-600 bg-emerald-50',
  low: 'text-blue-600 bg-blue-50',
  medium: 'text-amber-600 bg-amber-50',
  high: 'text-red-600 bg-red-50',
};

async function getAuthToken(): Promise<string> {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  return currentUser.getIdToken();
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({ task, onClose, onUpdated }) => {
  const tenantId = useTenantId();
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleStatusChange = async (status: TaskStatus) => {
    setUpdatingStatus(true);
    try {
      await updateTask(tenantId, task.id, { status });
      onUpdated();
    } catch (err) {
      console.error('[TaskDetailPanel] status update failed:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleApproveDelegation = async () => {
    const token = await getAuthToken();
    const res = await fetch(`/api/tasks/update-task?taskId=${task.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ approveDelegation: true }),
    });
    if (!res.ok) throw new Error('Delegasyon onaylanamadı');
    onUpdated();
  };

  const dueDate = task.dueDate ? task.dueDate.toDate() : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'completed';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative z-10 w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <AIPriorityBadge score={task.aiPriorityScore} size="md" />
              <h2 className="font-commons text-sm font-semibold text-[#171717] truncate">
                {task.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Description */}
            {task.description && (
              <div>
                <p className="font-commons text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1.5">
                  Açıklama
                </p>
                <p className="font-commons text-sm text-neutral-700 leading-relaxed">
                  {task.description}
                </p>
              </div>
            )}

            {/* Status */}
            <div>
              <p className="font-commons text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1.5">
                Durum
              </p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    disabled={updatingStatus || task.status === opt.value}
                    className={`px-3 py-1.5 rounded-lg font-commons text-xs font-medium transition-all ${
                      task.status === opt.value
                        ? 'bg-[#171717] text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    } disabled:opacity-50`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Analysis */}
            <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4 space-y-3">
              <p className="font-commons text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                AI Analizi
              </p>

              {/* Priority */}
              <div className="flex items-center justify-between">
                <span className="font-commons text-xs text-neutral-500">Öncelik Skoru</span>
                <AIPriorityBadge score={task.aiPriorityScore} />
              </div>

              {/* Risk */}
              <div className="flex items-center justify-between">
                <span className="font-commons text-xs text-neutral-500">Risk Seviyesi</span>
                <span
                  className={`font-commons text-xs font-medium px-2 py-0.5 rounded-full ${
                    RISK_COLORS[task.aiRiskLevel] || 'text-neutral-600 bg-neutral-100'
                  }`}
                >
                  {task.aiRiskLevel === 'none'
                    ? 'Risk Yok'
                    : task.aiRiskLevel === 'low'
                    ? 'Düşük Risk'
                    : task.aiRiskLevel === 'medium'
                    ? 'Orta Risk'
                    : 'Yüksek Risk'}
                </span>
              </div>

              {/* Risk flags */}
              {task.aiRiskFlags && task.aiRiskFlags.length > 0 && (
                <div>
                  <span className="font-commons text-xs text-neutral-500 block mb-1.5">
                    Risk Faktörleri
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {task.aiRiskFlags.map((flag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-commons text-[10px]"
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rationale */}
              {task.aiScoreRationale && (
                <p className="font-commons text-xs text-neutral-500 italic">
                  {task.aiScoreRationale}
                </p>
              )}
            </div>

            {/* Delegation */}
            <DelegationApprovalBar
              task={task}
              onApprove={handleApproveDelegation}
            />

            {/* Meta */}
            <div className="space-y-2">
              {dueDate && (
                <div className="flex items-center gap-2">
                  <Calendar className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-neutral-400'}`} />
                  <span className={`font-commons text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-neutral-600'}`}>
                    Son tarih: {dueDate.toLocaleDateString('tr-TR')}
                    {isOverdue && ' — GECİKTİ'}
                  </span>
                </div>
              )}
              {task.estimatedHours && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-neutral-400" />
                  <span className="font-commons text-xs text-neutral-600">
                    Tahmini: {task.estimatedHours} saat
                  </span>
                </div>
              )}
              {task.assigneeName && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-neutral-400" />
                  <span className="font-commons text-xs text-neutral-600">
                    Atanan: {task.assigneeName}
                    {task.delegationApproved && (
                      <CheckCircle className="inline w-3 h-3 text-green-500 ml-1" />
                    )}
                  </span>
                </div>
              )}
              {task.projectName && (
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-neutral-400" />
                  <span className="font-commons text-xs text-neutral-600">{task.projectName}</span>
                </div>
              )}
              {task.clientName && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-neutral-400" />
                  <span className="font-commons text-xs text-neutral-600">{task.clientName}</span>
                </div>
              )}
              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-neutral-400" />
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-commons text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TaskDetailPanel;
