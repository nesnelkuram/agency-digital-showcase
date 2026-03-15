import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  Loader2,
  AlertCircle,
  CheckCircle,
  Layers,
  Clock,
  Bot,
  Plus,
  RefreshCw,
  Send,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { useUnifiedTasks } from '@/shared/hooks/useUnifiedTasks';
import UnifiedTaskCard from './components/UnifiedTaskCard';
import QuickAddTaskModal from './QuickAddTaskModal';
import TaskDetailPanel from './TaskDetailPanel';
import TelegramLinkModal from './TelegramLinkModal';
import type { UnifiedTaskItem } from '@/shared/types/task';
import type { StepInstance } from '@/shared/types/workflow/instance';

// ─── Kanban column config ─────────────────────────────────────────────────────
const KANBAN_COLUMNS: Array<{
  id: string;
  title: string;
  statuses: string[];
  color: string;
}> = [
  {
    id: 'todo',
    title: 'Yapılacak',
    statuses: ['open', 'ready'],
    color: 'border-blue-300',
  },
  {
    id: 'in_progress',
    title: 'Devam Eden',
    statuses: ['in_progress', 'revision_needed'],
    color: 'border-amber-300',
  },
  {
    id: 'ai_review',
    title: 'AI / İnceleme',
    statuses: ['awaiting_review', 'ai_processing', 'ai_review'],
    color: 'border-violet-300',
  },
  {
    id: 'blocked',
    title: 'Engellendi',
    statuses: ['blocked'],
    color: 'border-red-300',
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
const TasksPage: React.FC = () => {
  const { items, loading, error, refresh } = useUnifiedTasks({ mode: 'all' });
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnifiedTaskItem | null>(null);

  const stats = {
    total: items.length,
    todo: items.filter((i) => ['open', 'ready'].includes(i.status)).length,
    inProgress: items.filter((i) => ['in_progress', 'revision_needed'].includes(i.status)).length,
    aiReview: items.filter((i) =>
      ['awaiting_review', 'ai_processing', 'ai_review'].includes(i.status)
    ).length,
  };

  const handleTaskCreated = () => {
    setIntakeOpen(false);
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-grotesk font-bold text-[#171717] flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            Görevlerim
          </h1>
          <p className="font-commons text-sm text-neutral-500 mt-0.5">
            Tüm görevler (standalone + workflow adımları) — AI öncelikli sıralama
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTelegramOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors font-commons text-sm text-neutral-700"
            title="Telegram Bot Bağla"
          >
            <Send className="w-4 h-4 text-blue-500" />
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors font-commons text-sm text-neutral-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setIntakeOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171717] text-white hover:bg-neutral-800 transition-colors font-commons text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Yeni Görev
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Görev', value: stats.total, icon: Layers, color: 'text-indigo-600' },
          { label: 'Yapılacak', value: stats.todo, icon: Clock, color: 'text-blue-600' },
          { label: 'Devam Eden', value: stats.inProgress, icon: CheckCircle, color: 'text-amber-600' },
          { label: 'AI İnceleme', value: stats.aiReview, icon: Bot, color: 'text-violet-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-neutral-100 p-4">
            <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
            <p className="font-grotesk text-2xl font-bold text-[#171717]">{stat.value}</p>
            <p className="font-commons text-xs text-neutral-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="font-commons text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-neutral-100">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="font-grotesk text-lg font-semibold text-neutral-700">
            Tüm görevler tamamlandı!
          </p>
          <p className="font-commons text-sm text-neutral-400 mt-1">
            Şu an size atanmış aktif görev yok.
          </p>
          <button
            onClick={() => setIntakeOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171717] text-white font-commons text-sm hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Görev Oluştur
          </button>
        </div>
      )}

      {/* Kanban */}
      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((col) => {
            const columnItems = items.filter((i) => col.statuses.includes(i.status));
            return (
              <div
                key={col.id}
                className={`rounded-xl border-t-2 ${col.color} bg-neutral-50 p-3`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-commons text-sm font-semibold text-neutral-700">
                    {col.title}
                  </h3>
                  <span className="font-commons text-xs text-neutral-500 bg-white border border-neutral-200 px-2 py-0.5 rounded-full">
                    {columnItems.length}
                  </span>
                </div>
                {columnItems.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="font-commons text-xs text-neutral-400">Görev yok</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {columnItems.map((item) => (
                      <UnifiedTaskCard
                        key={item.id}
                        item={item}
                        onClick={item.source === 'standalone' ? setSelectedItem : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Telegram Link Modal */}
      {telegramOpen && (
        <TelegramLinkModal onClose={() => setTelegramOpen(false)} />
      )}

      {/* Quick Add Modal */}
      {intakeOpen && (
        <QuickAddTaskModal
          onClose={() => setIntakeOpen(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}

      {/* Detail Panel */}
      {selectedItem && selectedItem.source === 'standalone' && selectedItem.task && (
        <TaskDetailPanel
          task={selectedItem.task}
          onClose={() => setSelectedItem(null)}
          onUpdated={() => {
            setSelectedItem(null);
            refresh();
          }}
        />
      )}
    </div>
  );
};

export default TasksPage;
