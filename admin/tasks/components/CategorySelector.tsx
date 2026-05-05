import React, { useState } from 'react';
import { Briefcase, Settings2, User, Sparkles, Check, Loader2 } from 'lucide-react';
import type { Task, TaskCategory } from '@/shared/types/task';
import { TASK_CATEGORY_COLORS, TASK_CATEGORY_LABELS } from '@/shared/types/task';
import { useActiveProjects } from '@/shared/hooks/useActiveProjects';

interface CategorySelectorProps {
  task: Task;
  onUpdated: () => void;
}

const CATEGORY_OPTIONS: Array<{ id: TaskCategory; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'brand',    icon: Briefcase },
  { id: 'admin',    icon: Settings2 },
  { id: 'personal', icon: User },
];

async function getAuthToken(): Promise<string> {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const u = auth.currentUser;
  if (!u) throw new Error('Not authenticated');
  return u.getIdToken();
}

const CategorySelector: React.FC<CategorySelectorProps> = ({ task, onUpdated }) => {
  const { projects, loading: projectsLoading } = useActiveProjects();
  const [saving, setSaving] = useState<string | null>(null); // tracks which field is updating

  const updateTask = async (patch: Record<string, any>, key: string) => {
    setSaving(key);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/tasks/update-task?taskId=${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Güncellenemedi');
      onUpdated();
    } catch (err) {
      console.error('[CategorySelector] update failed:', err);
    } finally {
      setSaving(null);
    }
  };

  const handleCategoryChange = (cat: TaskCategory) => {
    if (cat === task.category && task.categorySource === 'manual') return;
    const patch: Record<string, any> = { category: cat };
    if (cat !== 'brand') {
      // Drop brand link when leaving brand category
      patch.projectId = null;
      patch.projectName = null;
    }
    updateTask(patch, 'category');
  };

  const handleBrandChange = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    updateTask(
      {
        category: 'brand',
        projectId: project?.id || null,
        projectName: project?.name || null,
      },
      'brand'
    );
  };

  const isAiGuess =
    task.categorySource === 'ai' &&
    typeof task.categoryConfidence === 'number' &&
    task.categoryConfidence < 0.6;

  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-commons text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Kategori
        </p>
        {task.categorySource && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
            task.categorySource === 'manual'
              ? 'bg-emerald-50 text-emerald-700'
              : isAiGuess
              ? 'bg-amber-50 text-amber-700'
              : 'bg-indigo-50 text-indigo-700'
          }`}>
            {task.categorySource === 'manual' ? (
              <>
                <Check className="w-2.5 h-2.5" /> Manuel
              </>
            ) : (
              <>
                <Sparkles className="w-2.5 h-2.5" />
                AI {task.categoryConfidence != null ? `· %${Math.round(task.categoryConfidence * 100)}` : ''}
              </>
            )}
          </span>
        )}
      </div>

      {/* Category radio buttons */}
      <div className="grid grid-cols-3 gap-2">
        {CATEGORY_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const colors = TASK_CATEGORY_COLORS[opt.id];
          const active = task.category === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleCategoryChange(opt.id)}
              disabled={saving !== null}
              className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border font-commons text-xs font-medium transition-all ${
                active
                  ? `${colors.bg} ${colors.text} ${colors.border}`
                  : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50'
              } disabled:opacity-50 disabled:cursor-wait`}
            >
              {saving === 'category' && active ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              {TASK_CATEGORY_LABELS[opt.id]}
            </button>
          );
        })}
      </div>

      {/* Brand selector — only for 'brand' category */}
      {task.category === 'brand' && (
        <div className="pt-2 border-t border-neutral-100 space-y-1.5">
          <label className="font-commons text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
            Marka
          </label>
          <div className="relative">
            <select
              value={task.projectId || ''}
              onChange={(e) => handleBrandChange(e.target.value)}
              disabled={projectsLoading || saving !== null}
              className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border border-neutral-200 bg-white font-commons text-sm text-neutral-700 focus:outline-none focus:border-indigo-300 disabled:opacity-50"
            >
              <option value="">Marka seç...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.clientName ? ` — ${p.clientName}` : ''}
                </option>
              ))}
            </select>
            {saving === 'brand' && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-neutral-400" />
            )}
          </div>
          {task.projectName && !task.projectId && (
            <p className="font-commons text-[10px] text-amber-600">
              ⚠️ "{task.projectName}" listede değil — yukarıdan seç
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CategorySelector;
