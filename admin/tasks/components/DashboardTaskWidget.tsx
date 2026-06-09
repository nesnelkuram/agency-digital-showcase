import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Plus,
  ChevronRight,
  GitBranch,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import { useUnifiedTasks } from '@/shared/hooks/useUnifiedTasks';
import AIPriorityBadge from './AIPriorityBadge';
import QuickAddTaskModal from '../QuickAddTaskModal';
import type { UnifiedTaskItem } from '@/shared/types/task';

const DashboardTaskWidget: React.FC = () => {
  const { items, loading, refresh } = useUnifiedTasks();
  const [intakeOpen, setIntakeOpen] = useState(false);

  // Top 5 by aiPriorityScore
  const top5 = items.slice(0, 5);

  const getItemHref = (item: UnifiedTaskItem): string => {
    if (item.source === 'workflow_step' && item.instanceId && item.nodeId) {
      return `/admin/workflows/instance/${item.instanceId}/step/${encodeURIComponent(item.nodeId)}`;
    }
    return `/admin/now?task=${item.id}`;
  };

  const formatDueDate = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Gecikmiş';
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Yarın';
    return `${diffDays} gün`;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="admin-card p-0"
      >
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-grotesk text-base font-bold text-[#171717]">
                Görevlerim
              </h2>
              <p className="font-commons text-[10px] text-neutral-400">AI Öncelikli</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIntakeOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#171717] text-white hover:bg-neutral-800 transition-colors font-commons text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Yeni
            </button>
            <Link
              to="/admin/now"
              className="font-commons text-xs text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-0.5"
            >
              Tümünü Gör
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && top5.length === 0 && (
          <div className="py-10 text-center">
            <ClipboardList className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
            <p className="font-commons text-sm text-neutral-400">Aktif görev yok</p>
            <button
              onClick={() => setIntakeOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 font-commons text-xs text-neutral-600 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Görev Oluştur
            </button>
          </div>
        )}

        {/* Task List */}
        {!loading && top5.length > 0 && (
          <div className="divide-y divide-neutral-50">
            {top5.map((item) => {
              const isWorkflow = item.source === 'workflow_step';
              const hasRisk = item.aiRiskLevel === 'high' || item.aiRiskLevel === 'medium';
              const isOverdue = item.dueDate && item.dueDate < new Date();

              return (
                <Link
                  key={item.id}
                  to={getItemHref(item)}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 transition-colors group"
                >
                  {/* Priority badge */}
                  <AIPriorityBadge score={item.aiPriorityScore} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isWorkflow && (
                        <GitBranch className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                      )}
                      <p className="font-commons text-sm font-medium text-[#171717] truncate group-hover:text-indigo-700 transition-colors">
                        {item.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.projectName && (
                        <span className="font-commons text-[10px] text-neutral-400 truncate">
                          {item.projectName}
                        </span>
                      )}
                      {isWorkflow && (
                        <span className="font-commons text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-400 uppercase tracking-wide flex-shrink-0">
                          Workflow
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasRisk && (
                      <AlertTriangle
                        className={`w-3.5 h-3.5 ${
                          item.aiRiskLevel === 'high' ? 'text-red-500' : 'text-amber-500'
                        }`}
                      />
                    )}
                    {item.dueDate && (
                      <span
                        className={`font-commons text-[10px] flex items-center gap-0.5 ${
                          isOverdue ? 'text-red-600 font-semibold' : 'text-neutral-400'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {formatDueDate(item.dueDate)}
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!loading && items.length > 5 && (
          <div className="px-5 py-3 border-t border-neutral-100">
            <Link
              to="/admin/now"
              className="font-commons text-xs text-neutral-500 hover:text-indigo-600 transition-colors"
            >
              +{items.length - 5} görev daha →
            </Link>
          </div>
        )}
      </motion.div>

      {/* Quick Add Modal */}
      {intakeOpen && (
        <QuickAddTaskModal
          onClose={() => setIntakeOpen(false)}
          onTaskCreated={() => {
            setIntakeOpen(false);
            refresh();
          }}
        />
      )}
    </>
  );
};

export default DashboardTaskWidget;
