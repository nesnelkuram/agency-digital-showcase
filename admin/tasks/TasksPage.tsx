import React, { useMemo, useState } from 'react';
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
  Briefcase,
  Settings2,
  User,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useUnifiedTasks } from '@/shared/hooks/useUnifiedTasks';
import { useActiveProjects } from '@/shared/hooks/useActiveProjects';
import { useTenantId } from '@/shared/hooks/useTenant';
import { updateTask } from '@/shared/services/taskService';
import UnifiedTaskCard from './components/UnifiedTaskCard';
import QuickAddTaskModal from './QuickAddTaskModal';
import TaskDetailPanel from './TaskDetailPanel';
import TelegramLinkModal from './TelegramLinkModal';
import type { UnifiedTaskItem, TaskCategory, TaskStatus } from '@/shared/types/task';

// ─── Kanban column config ─────────────────────────────────────────────────────
const KANBAN_COLUMNS: Array<{
  id: string;
  title: string;
  statuses: string[];
  color: string;
}> = [
  { id: 'todo',        title: 'Yapılacak',     statuses: ['open', 'ready'],                                 color: 'border-blue-300' },
  { id: 'in_progress', title: 'Devam Eden',    statuses: ['in_progress', 'revision_needed'],                color: 'border-amber-300' },
  { id: 'ai_review',   title: 'AI / İnceleme', statuses: ['awaiting_review', 'ai_processing', 'ai_review'], color: 'border-violet-300' },
  { id: 'blocked',     title: 'Engellendi',    statuses: ['blocked'],                                       color: 'border-red-300' },
];

// Drop target column → new TaskStatus for standalone tasks
const COLUMN_TARGET_STATUS: Record<string, TaskStatus> = {
  todo:        'open',
  in_progress: 'in_progress',
  ai_review:   'awaiting_review',
  blocked:     'blocked',
};

// ─── Drag wrapper for a single card (standalone tasks only) ──────────────────
const DraggableCard: React.FC<{
  item: UnifiedTaskItem;
  onClick?: (item: UnifiedTaskItem) => void;
}> = ({ item, onClick }) => {
  const isDraggable = item.source === 'standalone';
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !isDraggable,
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : undefined,
    touchAction: isDraggable ? 'none' : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <UnifiedTaskCard item={item} onClick={onClick} />
    </div>
  );
};

// ─── Drop target wrapper for a Kanban column ─────────────────────────────────
const DroppableColumn: React.FC<{
  id: string;
  color: string;
  children: React.ReactNode;
}> = ({ id, color, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-t-2 ${color} bg-neutral-50 p-3 transition-shadow ${
        isOver ? 'ring-2 ring-indigo-400 ring-offset-1 bg-indigo-50/40' : ''
      }`}
    >
      {children}
    </div>
  );
};

// ─── Category tab config ──────────────────────────────────────────────────────
type CategoryTab = 'all' | TaskCategory;

const CATEGORY_TABS: Array<{ id: CategoryTab; label: string; icon: React.ComponentType<any> }> = [
  { id: 'all',      label: 'Tümü',         icon: LayoutGrid },
  { id: 'brand',    label: 'Markalarımız', icon: Briefcase },
  { id: 'admin',    label: 'İdari İşler',  icon: Settings2 },
  { id: 'personal', label: 'Kişisel',      icon: User },
];

const TasksPage: React.FC = () => {
  const tenantId = useTenantId();
  const { items, loading, error, refresh } = useUnifiedTasks({ mode: 'all' });
  const { projects } = useActiveProjects();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnifiedTaskItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all');
  const [activeBrandId, setActiveBrandId] = useState<string | 'all' | 'unassigned'>('all');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, string>>({});
  const [dragError, setDragError] = useState<string | null>(null);

  // 5px movement before drag starts → clicks still pass through to open detail panel
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
    setDragError(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const itemId = String(active.id);
    const targetCol = String(over.id);
    const newStatus = COLUMN_TARGET_STATUS[targetCol];
    if (!newStatus) return;

    const item = items.find((i) => i.id === itemId);
    if (!item || item.source !== 'standalone' || !item.task) return;

    // No-op: dropped on the same column it came from
    const currentCol = KANBAN_COLUMNS.find((c) => c.statuses.includes(item.status));
    if (currentCol?.id === targetCol) return;

    // Optimistic: render the card in its new column immediately
    setOptimisticStatus((prev) => ({ ...prev, [itemId]: newStatus }));

    try {
      await updateTask(tenantId, item.task.id, { status: newStatus });
      // Firestore real-time listener picks up the change → clear optimistic flag
      setTimeout(() => {
        setOptimisticStatus((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }, 600);
    } catch (e: any) {
      console.error('Task status drag update failed:', e);
      setDragError(e?.message || 'Durum güncellenemedi');
      // Revert optimistic so card snaps back to original column
      setOptimisticStatus((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  };

  // Tasks missing category — backfill candidates
  const uncategorizedCount = useMemo(
    () => items.filter((i) => i.source === 'standalone' && !i.category).length,
    [items]
  );

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const u = getAuth().currentUser;
      if (!u) throw new Error('Oturum bulunamadı');
      const token = await u.getIdToken();

      let totalProcessed = 0;
      let hasMore = true;
      // Loop in batches of 10 (server caps each call)
      while (hasMore) {
        const res = await fetch('/api/tasks/backfill-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Backfill başarısız');
        totalProcessed += json.processed || 0;
        hasMore = json.hasMore;
        setBackfillMsg(`İşleniyor... (${totalProcessed} tamamlandı, ${json.remaining} kaldı)`);
        if (!hasMore) break;
      }
      setBackfillMsg(`✓ ${totalProcessed} eski görev sınıflandırıldı`);
      refresh();
    } catch (err: any) {
      setBackfillMsg(`Hata: ${err.message}`);
    } finally {
      setBackfilling(false);
    }
  };

  // Brands present in current task list (sorted; "isimsiz" / unassigned grouped at end)
  const brandsInUse = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    let hasUnassigned = false;
    items.forEach((item) => {
      const cat = item.category ?? (item.source === 'workflow_step' ? 'brand' : undefined);
      if (cat !== 'brand') return;
      if (item.projectId && item.projectName) {
        if (!map.has(item.projectId)) map.set(item.projectId, { id: item.projectId, name: item.projectName });
      } else {
        hasUnassigned = true;
      }
    });
    // Merge with project list so empty brands also appear (Rakle, Dieci even if no task yet)
    projects.forEach((p) => {
      if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name });
    });
    const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return { list, hasUnassigned };
  }, [items, projects]);

  // Counts per category (for stat tiles)
  const counts = useMemo(() => {
    const c = { all: items.length, brand: 0, admin: 0, personal: 0 };
    items.forEach((item) => {
      const cat = item.category ?? (item.source === 'workflow_step' ? 'brand' : undefined);
      if (cat === 'brand') c.brand++;
      else if (cat === 'admin') c.admin++;
      else if (cat === 'personal') c.personal++;
    });
    return c;
  }, [items]);

  // Filtered items based on active tab + brand chip — with optimistic status overlay applied
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const cat = item.category ?? (item.source === 'workflow_step' ? 'brand' : undefined);
        if (activeCategory !== 'all' && cat !== activeCategory) return false;
        if (activeCategory === 'brand') {
          if (activeBrandId === 'unassigned') return !item.projectId;
          if (activeBrandId !== 'all' && item.projectId !== activeBrandId) return false;
        }
        return true;
      })
      .map((item) =>
        optimisticStatus[item.id] ? { ...item, status: optimisticStatus[item.id] } : item
      );
  }, [items, activeCategory, activeBrandId, optimisticStatus]);

  // Item currently being dragged (for DragOverlay preview)
  const draggingItem = useMemo(
    () => (draggingId ? filteredItems.find((i) => i.id === draggingId) ?? null : null),
    [draggingId, filteredItems]
  );

  const stats = {
    total: filteredItems.length,
    todo: filteredItems.filter((i) => ['open', 'ready'].includes(i.status)).length,
    inProgress: filteredItems.filter((i) => ['in_progress', 'revision_needed'].includes(i.status)).length,
    aiReview: filteredItems.filter((i) =>
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
            Markalarımız, idari işler ve kişisel görevler — AI öncelikli sıralama
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

      {/* Category tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl w-fit">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id];
          const active = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveCategory(tab.id);
                if (tab.id !== 'brand') setActiveBrandId('all');
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-commons text-sm font-medium transition-all ${
                active
                  ? 'bg-white text-[#171717] shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                active ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-200 text-neutral-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Brand chips (only when Markalarımız is active) */}
      {activeCategory === 'brand' && (brandsInUse.list.length > 0 || brandsInUse.hasUnassigned) && (
        <div className="flex items-center gap-2 flex-wrap pl-1">
          <button
            onClick={() => setActiveBrandId('all')}
            className={`px-3 py-1 rounded-full font-commons text-xs font-medium transition-all ${
              activeBrandId === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:border-indigo-300'
            }`}
          >
            Tüm Markalar
          </button>
          {brandsInUse.list.map((brand) => {
            const taskCount = items.filter((i) => i.projectId === brand.id).length;
            const active = activeBrandId === brand.id;
            return (
              <button
                key={brand.id}
                onClick={() => setActiveBrandId(brand.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-commons text-xs font-medium transition-all ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:border-indigo-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-indigo-400'}`} />
                {brand.name}
                {taskCount > 0 && (
                  <span className={`text-[10px] font-semibold ${active ? 'text-indigo-100' : 'text-neutral-400'}`}>
                    {taskCount}
                  </span>
                )}
              </button>
            );
          })}
          {brandsInUse.hasUnassigned && (
            <button
              onClick={() => setActiveBrandId('unassigned')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-commons text-xs font-medium transition-all ${
                activeBrandId === 'unassigned'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white border border-amber-200 text-amber-700 hover:border-amber-400'
              }`}
            >
              ⚠️ Marka Atanmamış
            </button>
          )}
        </div>
      )}

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
      {!loading && !error && filteredItems.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-neutral-100">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="font-grotesk text-lg font-semibold text-neutral-700">
            {activeCategory === 'all' ? 'Tüm görevler tamamlandı!' : 'Bu kategoride görev yok'}
          </p>
          <p className="font-commons text-sm text-neutral-400 mt-1">
            {activeCategory === 'all'
              ? 'Şu an aktif görev bulunmuyor.'
              : 'Filtreyi değiştir veya yeni görev ekle.'}
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

      {/* Drag error toast */}
      {dragError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="font-commons text-xs text-red-700 flex-1">{dragError}</p>
          <button
            onClick={() => setDragError(null)}
            className="font-commons text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Kanban */}
      {!loading && !error && filteredItems.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {KANBAN_COLUMNS.map((col) => {
              const columnItems = filteredItems.filter((i) => col.statuses.includes(i.status));
              return (
                <DroppableColumn key={col.id} id={col.id} color={col.color}>
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
                      <p className="font-commons text-xs text-neutral-400">
                        Görevi buraya bırak
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {columnItems.map((item) => (
                        <DraggableCard
                          key={item.id}
                          item={item}
                          onClick={item.source === 'standalone' ? setSelectedItem : undefined}
                        />
                      ))}
                    </div>
                  )}
                </DroppableColumn>
              );
            })}
          </div>

          {/* Floating preview while dragging */}
          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {draggingItem ? (
              <div className="rotate-2 scale-105 shadow-2xl ring-2 ring-indigo-300 rounded-xl">
                <UnifiedTaskCard item={draggingItem} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Backfill banner — shown when there are tasks without category */}
      {uncategorizedCount > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="font-commons text-xs text-amber-800">
              {uncategorizedCount} eski görev henüz kategorize edilmemiş.
              {backfillMsg && <span className="ml-2 font-medium">{backfillMsg}</span>}
            </p>
          </div>
          <button
            onClick={runBackfill}
            disabled={backfilling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white font-commons text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {backfilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {backfilling ? 'Sınıflandırılıyor...' : 'AI ile Sınıflandır'}
          </button>
        </div>
      )}

      {telegramOpen && <TelegramLinkModal onClose={() => setTelegramOpen(false)} />}
      {intakeOpen && (
        <QuickAddTaskModal onClose={() => setIntakeOpen(false)} onTaskCreated={handleTaskCreated} />
      )}
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
