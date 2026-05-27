import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pause, Play, CircleDashed, Sparkles, Clock, Plus, Check, CheckCircle2, Layers, ChevronDown, ChevronRight, Flag } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  orderBy,
  limit as fbLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useUnifiedTasks } from '@/shared/hooks/useUnifiedTasks';
import { updateTask } from '@/shared/services/taskService';
import { useTenantId } from '@/shared/hooks/useTenant';
import type { TaskStatus, UnifiedTaskItem } from '@/shared/types/task';

interface TenantUser {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
}

interface NowAllTasksPanelProps {
  open: boolean;
  currentTaskId?: string;
  scope?: 'mine' | 'all';            // admin → 'all', diğerleri → 'mine'
  onClose: () => void;
  onSelectTask?: (item: UnifiedTaskItem) => void;
}

interface ColConf {
  key: 'active' | 'open' | 'completed';
  title: string;
  statuses: string[];
  dropStatus: TaskStatus;
  Icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}

const COLUMNS: ColConf[] = [
  { key: 'open',      title: 'Sırada',     statuses: ['open', 'ready', 'awaiting_review', 'blocked'],  dropStatus: 'open',      Icon: CircleDashed, iconColor: 'text-neutral-400' },
  { key: 'active',    title: 'Devam Eden', statuses: ['in_progress', 'paused'],                        dropStatus: 'paused',    Icon: Play,         iconColor: 'text-violet-500' },
  { key: 'completed', title: 'Tamamlandı', statuses: ['completed', 'cancelled'],                       dropStatus: 'completed', Icon: CheckCircle2, iconColor: 'text-emerald-500' },
];

// ─── Avatar ──────────────────────────────────────────────────────────────────
const AVATAR_BG = [
  'bg-rose-200 text-rose-700',
  'bg-amber-200 text-amber-700',
  'bg-emerald-200 text-emerald-700',
  'bg-sky-200 text-sky-700',
  'bg-violet-200 text-violet-700',
  'bg-pink-200 text-pink-700',
];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
}

const Avatar: React.FC<{
  name: string;
  id: string;
  avatarUrl?: string;
  size?: number;
}> = ({ name, id, avatarUrl, size = 22 }) => {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const cls = colorFor(id || name);
  return (
    <span
      title={name}
      className={`inline-flex items-center justify-center rounded-full ring-2 ring-white font-commons font-semibold ${cls}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
};

// ─── Card (draggable) ────────────────────────────────────────────────────────
interface CardProps {
  item: UnifiedTaskItem;
  isCurrent: boolean;
  users: TenantUser[];
  children?: UnifiedTaskItem[];        // nested SOP alt-görevleri (varsa)
  currentTaskId?: string;              // hangi child aktif onu vurgu için
  onClick: () => void;
  onChildClick?: (child: UnifiedTaskItem) => void;
}

const TaskCard: React.FC<CardProps> = ({
  item,
  isCurrent,
  users,
  children: nestedChildren,
  currentTaskId,
  onClick,
  onChildClick,
}) => {
  const tenantId = useTenantId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const draggable = item.source === 'standalone';

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: item.id,
    disabled: !draggable,
  });

  // Aynı kart aynı zamanda drop hedefi (reorder için)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: item.id,
    disabled: !draggable,
  });

  // Ref'leri birleştir
  const setNodeRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : undefined,
    touchAction: draggable ? 'none' : undefined,
  };


  const task = item.task;
  const isPaused = item.status === 'paused';
  const isRunning = item.status === 'in_progress';
  const isParent = (nestedChildren?.length ?? 0) > 0;
  const isFlagged = Boolean(task?.flagged);
  const [childrenOpen, setChildrenOpen] = useState(true);

  const toggleFlag = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!db || !tenantId) return;
    try {
      await updateDoc(doc(db, 'tasks', item.id), {
        flagged: !isFlagged,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('[TaskCard] flag toggle failed:', err);
    }
  };

  // Children stats — parent karttaki progress için
  const childCompleted = (nestedChildren ?? []).filter(
    (c) => c.status === 'completed' || c.status === 'cancelled'
  ).length;
  const childTotal = nestedChildren?.length ?? 0;
  const childProgress = childTotal > 0 ? Math.round((childCompleted / childTotal) * 100) : 0;

  // Üye listesi: assigneeId + collaboratorIds
  const memberIds: string[] = [];
  if (task?.assigneeId) memberIds.push(task.assigneeId);
  (task?.collaboratorIds || []).forEach((id) => {
    if (!memberIds.includes(id)) memberIds.push(id);
  });

  const members = memberIds.map((id) => {
    const cached = task?.collaborators?.find((c) => c.id === id);
    if (cached) return cached;
    const u = users.find((x) => x.uid === id);
    if (u) return { id: u.uid, name: u.displayName || u.email || 'Üye', avatarUrl: u.photoURL };
    if (id === task?.assigneeId) {
      return { id, name: task.assigneeName || 'Üye', avatarUrl: undefined as string | undefined };
    }
    return { id, name: '?', avatarUrl: undefined as string | undefined };
  });

  const visible = members.slice(0, 3);
  const extraCount = members.length - visible.length;
  const pickable = users.filter((u) => !memberIds.includes(u.uid));

  const addCollab = async (userId: string) => {
    const u = users.find((x) => x.uid === userId);
    if (!u || !db || !tenantId) return;
    try {
      const ref = doc(db, 'tasks', item.id);
      const entry: Record<string, any> = { id: userId, name: u.displayName || u.email || 'Üye' };
      if (u.photoURL) entry.avatarUrl = u.photoURL;
      await updateDoc(ref, {
        collaboratorIds: arrayUnion(userId),
        collaborators: arrayUnion(entry),
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('[NowAllTasksPanel] addCollab failed:', err);
    }
    setPickerOpen(false);
  };

  const removeCollab = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (!db || !tenantId) return;
    if (userId === task?.assigneeId) return;
    try {
      const cached = task?.collaborators?.find((c) => c.id === userId);
      const ref = doc(db, 'tasks', item.id);
      const upd: Record<string, any> = {
        collaboratorIds: arrayRemove(userId),
        updatedAt: new Date(),
      };
      if (cached) upd.collaborators = arrayRemove(cached);
      await updateDoc(ref, upd);
    } catch (err) {
      console.error('[NowAllTasksPanel] removeCollab failed:', err);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) onClick();
      }}
      className="relative"
    >
      {/* Drop indicator çizgisi — kart üstüne taşıyorsa */}
      {isOver && !isDragging && (
        <div className="absolute -top-1 left-2 right-2 h-0.5 bg-violet-400 rounded-full z-10" />
      )}
      <div
        className={`w-full text-left p-3 rounded-xl border transition-all ${
          isCurrent
            ? 'border-violet-300 bg-violet-50/60 ring-2 ring-violet-100'
            : isOver && !isDragging
            ? 'border-violet-200 bg-violet-50/30'
            : 'border-neutral-100 bg-white hover:border-neutral-300 hover:shadow-sm'
        }`}
      >
        <div className="flex items-start gap-2">
          {/* Status indicator */}
          <div className="flex-shrink-0 mt-1 select-none">
            {isRunning ? (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </span>
            ) : isPaused ? (
              <Pause className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <span className="block w-3.5 h-3.5 rounded-full border border-neutral-300" />
            )}
          </div>

          {/* Kırmızı bayrak */}
          <button
            type="button"
            onClick={toggleFlag}
            onPointerDown={(e) => e.stopPropagation()}
            title={isFlagged ? 'Bayrağı kaldır' : 'Önemli işaretle'}
            className={`flex-shrink-0 mt-0.5 p-0.5 rounded transition-colors ${
              isFlagged ? 'text-rose-500 hover:text-rose-600' : 'text-neutral-300 hover:text-rose-400'
            }`}
          >
            <Flag
              className="w-3.5 h-3.5"
              fill={isFlagged ? 'currentColor' : 'none'}
            />
          </button>

          <div className="flex-1 min-w-0">
            <p
              className={`font-commons text-sm leading-snug ${
                isCurrent ? 'text-[#171717] font-semibold' : 'text-neutral-700'
              }`}
            >
              {item.title}
            </p>
            {(item.projectName || task?.estimatedMinutes) && (
              <div className="flex items-center gap-2 mt-1.5">
                {item.projectName && (
                  <span className="font-commons text-[10px] uppercase tracking-wider text-neutral-400">
                    {item.projectName}
                  </span>
                )}
                {task?.estimatedMinutes && (
                  <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-neutral-400">
                    <Clock className="w-2.5 h-2.5" />
                    {task.estimatedMinutes}dk
                  </span>
                )}
              </div>
            )}
          </div>

          <div
            className="flex-shrink-0 flex items-center"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex -space-x-1.5">
              {visible.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={(e) => removeCollab(e, m.id)}
                  title={`${m.name}${m.id === task?.assigneeId ? ' (asıl sorumlu)' : ' — kaldır'}`}
                  className="hover:scale-110 transition-transform"
                >
                  <Avatar id={m.id} name={m.name} avatarUrl={m.avatarUrl} size={22} />
                </button>
              ))}
              {extraCount > 0 && (
                <span
                  className="inline-flex items-center justify-center rounded-full ring-2 ring-white bg-neutral-200 text-neutral-600 font-mono text-[9px]"
                  style={{ width: 22, height: 22 }}
                >
                  +{extraCount}
                </span>
              )}
            </div>
            {pickable.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPickerOpen((v) => !v);
                }}
                className="ml-1 rounded-full flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-neutral-500 transition-colors"
                style={{ width: 22, height: 22 }}
                title="Üye ekle"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Parent kart: progress bar + nested children */}
        {isParent && (
          <div
            className="mt-3 pt-2.5 border-t border-neutral-100"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setChildrenOpen((v) => !v);
              }}
              className="w-full flex items-center gap-2 text-left group"
            >
              {childrenOpen ? (
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-neutral-400" />
              )}
              <Layers className="w-3 h-3 text-violet-400" />
              <span className="font-commons text-[10px] uppercase tracking-wider text-neutral-500 flex-1">
                {childCompleted}/{childTotal} adım
              </span>
              <span className="font-mono text-[10px] text-emerald-600 tabular-nums">
                %{childProgress}
              </span>
            </button>
            <div className="mt-1.5 h-0.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${childProgress}%` }}
              />
            </div>

            {childrenOpen && (
              <div className="mt-2 space-y-0.5">
                {nestedChildren!.map((child, idx) => {
                  const childDone =
                    child.status === 'completed' || child.status === 'cancelled';
                  const childActive = child.id === currentTaskId;
                  const childRunning = child.status === 'in_progress';
                  const childPaused = child.status === 'paused';
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChildClick?.(child);
                      }}
                      className={`w-full flex items-center gap-2 px-1.5 py-1 rounded-md text-left transition-colors ${
                        childActive
                          ? 'bg-violet-100/60'
                          : 'hover:bg-neutral-50'
                      }`}
                    >
                      <span className="font-mono text-[9px] text-neutral-400 w-3 flex-shrink-0 tabular-nums">
                        {idx + 1}
                      </span>
                      <span className="flex-shrink-0 inline-flex items-center justify-center w-3.5 h-3.5">
                        {childDone ? (
                          <Check className="w-3 h-3 text-emerald-500" strokeWidth={3} />
                        ) : childRunning ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        ) : childPaused ? (
                          <Pause className="w-2.5 h-2.5 text-amber-500" />
                        ) : (
                          <span className="block w-2.5 h-2.5 rounded-full border border-neutral-300" />
                        )}
                      </span>
                      <span
                        className={`flex-1 min-w-0 truncate font-commons text-[11px] ${
                          childActive
                            ? 'text-[#171717] font-semibold'
                            : childDone
                            ? 'text-neutral-400 line-through'
                            : 'text-neutral-600'
                        }`}
                      >
                        {child.title}
                      </span>
                      {child.task?.estimatedMinutes && (
                        <span className="font-mono text-[9px] text-neutral-400 flex-shrink-0 tabular-nums">
                          {child.task.estimatedMinutes}dk
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
          <div className="absolute z-40 right-0 mt-1 w-56 bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-neutral-100">
              <p className="font-commons text-[10px] uppercase tracking-wider text-neutral-500">
                Üye ekle
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {pickable.map((u) => (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => addCollab(u.uid)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-50 transition-colors"
                >
                  <Avatar
                    id={u.uid}
                    name={u.displayName || u.email || 'Üye'}
                    avatarUrl={u.photoURL}
                    size={20}
                  />
                  <span className="font-commons text-xs text-[#171717] truncate">
                    {u.displayName || u.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Droppable column ────────────────────────────────────────────────────────
const DroppableColumn: React.FC<{
  col: ColConf;
  count: number;
  children: React.ReactNode;
}> = ({ col, count, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  const Icon = col.Icon;
  return (
    <div ref={setNodeRef} className="flex flex-col">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon className={`w-3.5 h-3.5 ${col.iconColor}`} />
        <h3 className="font-commons text-[11px] uppercase tracking-[0.16em] text-neutral-500 font-medium">
          {col.title}
        </h3>
        <span className="font-mono text-[10px] text-neutral-400 tabular-nums">{count}</span>
      </div>
      <div
        className={`space-y-1.5 min-h-[80px] rounded-xl transition-colors p-1 ${
          isOver ? 'bg-violet-50/40 ring-2 ring-violet-200' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
};

// ─── Main panel ──────────────────────────────────────────────────────────────
const NowAllTasksPanel: React.FC<NowAllTasksPanelProps> = ({
  open,
  currentTaskId,
  scope = 'mine',
  onClose,
  onSelectTask,
}) => {
  const tenantId = useTenantId();
  const { items, loading } = useUnifiedTasks({ mode: scope });
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [completedItems, setCompletedItems] = useState<UnifiedTaskItem[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Mevcut kullanıcı — scope=mine için filtre
  const { user } = useAuth();
  const myUid = user?.uid;

  // Son 30 tamamlanan ROOT görev (subtask'lar parent içinde zaten görünüyor)
  useEffect(() => {
    if (!open || !db || !tenantId) return;
    let cancelled = false;
    const q = query(
      collection(db, 'tasks'),
      where('tenantId', '==', tenantId),
      where('status', 'in', ['completed', 'cancelled']),
      orderBy('completedAt', 'desc'),
      fbLimit(30)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return;
        const list: UnifiedTaskItem[] = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((t: any) => !t.parentTaskId)  // sadece root
          .filter((t: any) => {
            // scope=mine → sadece bana atanmış veya benim oluşturduğum
            if (scope === 'all') return true;
            if (!myUid) return false;
            return t.assigneeId === myUid || t.createdBy === myUid || (t.collaboratorIds || []).includes(myUid);
          })
          .map((t: any) => ({
            source: 'standalone' as const,
            id: t.id,
            title: t.title,
            status: t.status,
            dueDate: t.dueDate ? t.dueDate.toDate() : undefined,
            aiPriorityScore: t.aiPriorityScore ?? 0,
            aiRiskLevel: t.aiRiskLevel ?? 'none',
            assigneeId: t.assigneeId,
            assigneeName: t.assigneeName,
            projectId: t.projectId,
            projectName: t.projectName,
            category: t.category,
            task: t,
          }));
        setCompletedItems(list);
      },
      (err) => console.warn('[NowAllTasksPanel] completed sub failed:', err)
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [open, tenantId, scope, myUid]);

  // Tenant kullanıcılarını panel açıldığında tek seferde çek (read-only)
  useEffect(() => {
    if (!open || !db || !tenantId) return;
    let cancelled = false;
    getDocs(query(collection(db, 'users'), where('tenantId', '==', tenantId)))
      .then((snap) => {
        if (cancelled) return;
        const list: TenantUser[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            uid: d.id,
            displayName: data.displayName,
            email: data.email,
            photoURL: data.photoURL,
          };
        });
        setUsers(list);
      })
      .catch((err) => console.warn('[NowAllTasksPanel] users load failed:', err));
    return () => {
      cancelled = true;
    };
  }, [open, tenantId]);

  // visibleItems: ROOT görevler (parent veya standalone) — child task'lar parent'ın içinde nested
  const visibleItems = useMemo(
    () => items.filter((it) => !it.task?.parentTaskId),
    [items]
  );

  // Her parent için child listesi
  const childrenByParent = useMemo(() => {
    const map = new Map<string, UnifiedTaskItem[]>();
    items.forEach((it) => {
      const pid = it.task?.parentTaskId;
      if (!pid) return;
      const arr = map.get(pid) || [];
      arr.push(it);
      map.set(pid, arr);
    });
    map.forEach((arr) =>
      arr.sort((a, b) => (a.task?.sortOrder ?? 0) - (b.task?.sortOrder ?? 0))
    );
    return map;
  }, [items]);

  const grouped = useMemo(() => {
    const out: Record<string, UnifiedTaskItem[]> = {
      active: [],
      open: [],
      completed: completedItems, // ayrı subscription'dan
    };
    visibleItems.forEach((it) => {
      const col = COLUMNS.find((c) => c.statuses.includes(it.status));
      if (col && col.key !== 'completed') out[col.key].push(it);
    });

    // Sıralama: flagged önce, sonra manualOrder, sonra skor
    const baseSort = (a: UnifiedTaskItem, b: UnifiedTaskItem): number => {
      const flagA = a.task?.flagged ? 1 : 0;
      const flagB = b.task?.flagged ? 1 : 0;
      if (flagA !== flagB) return flagB - flagA;
      const orderA = a.task?.manualOrder;
      const orderB = b.task?.manualOrder;
      if (typeof orderA === 'number' && typeof orderB === 'number') return orderA - orderB;
      if (typeof orderA === 'number') return -1;
      if (typeof orderB === 'number') return 1;
      return (b.aiPriorityScore ?? 0) - (a.aiPriorityScore ?? 0);
    };

    out.active.sort((a, b) => {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
      return baseSort(a, b);
    });
    out.open.sort(baseSort);
    return out;
  }, [visibleItems, completedItems]);

  // Hedef sütundaki targetIdx'e göre manualOrder hesapla — komşuların ortalaması
  const computeNewOrder = (
    columnItems: UnifiedTaskItem[],
    targetIdx: number,
    excludeId: string
  ): number => {
    const others = columnItems.filter((it) => it.id !== excludeId);
    const valueOf = (it: UnifiedTaskItem) =>
      it.task?.manualOrder ?? (it.aiPriorityScore ?? 50) * 100;
    if (others.length === 0) return 1000;
    if (targetIdx <= 0) return valueOf(others[0]) - 1000;
    if (targetIdx >= others.length) return valueOf(others[others.length - 1]) + 1000;
    return (valueOf(others[targetIdx - 1]) + valueOf(others[targetIdx])) / 2;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;
    const item = visibleItems.find((i) => i.id === active.id);
    if (!item || item.source !== 'standalone') return;

    const sourceCol = COLUMNS.find((c) => c.statuses.includes(item.status));
    const updates: Record<string, any> = {};

    // Hedef bir sütun başlığı mı yoksa bir kart mı?
    const overCol = COLUMNS.find((c) => c.key === over.id);

    if (overCol) {
      // Sütun başlığına/boş alanına drop → cross-column, sona ekle
      if (sourceCol?.key === overCol.key) return;
      updates.status = overCol.dropStatus;
      const colItems = grouped[overCol.key] || [];
      updates.manualOrder = computeNewOrder(colItems, colItems.length, item.id);
    } else {
      // Başka bir kart üzerine drop → reorder (aynı veya farklı sütun)
      const overItem = visibleItems.find((i) => i.id === over.id);
      if (!overItem) return;
      const targetCol = COLUMNS.find((c) => c.statuses.includes(overItem.status));
      if (!targetCol) return;
      // Cross-column ise status değişir
      if (sourceCol?.key !== targetCol.key) {
        updates.status = targetCol.dropStatus;
      }
      const colItems = grouped[targetCol.key] || [];
      const targetIdx = colItems.findIndex((it) => it.id === overItem.id);
      updates.manualOrder = computeNewOrder(colItems, targetIdx, item.id);
    }

    try {
      await updateTask(tenantId, item.id, updates);
      // AI öğrenme — bu manuel sıralamayı sonraki AI çağrılarında örnek olarak kullan
      if (db && tenantId) {
        try {
          const { addDoc, serverTimestamp } = await import('firebase/firestore');
          addDoc(collection(db, 'priority_signals'), {
            tenantId,
            taskId: item.id,
            taskTitle: item.title,
            category: item.task?.category || null,
            projectId: item.task?.projectId || null,
            projectName: item.task?.projectName || null,
            fromColumn: sourceCol?.key || '?',
            toColumn: overCol ? overCol.key : (COLUMNS.find((c) =>
              c.statuses.includes(visibleItems.find((i) => i.id === over.id)?.status || '')
            )?.key || '?'),
            wasFlagged: !!item.task?.flagged,
            createdAt: serverTimestamp(),
          }).catch(() => {});
        } catch {/* non-fatal */}
      }
    } catch (err) {
      console.error('[NowAllTasksPanel] drag failed:', err);
    }
  };

  const draggingItem = draggingId ? visibleItems.find((i) => i.id === draggingId) : null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[55]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full h-full flex flex-col"
          >
            <div className="flex items-center justify-between px-8 py-5">
              <div>
                <p className="font-commons text-[10px] uppercase tracking-[0.22em] text-neutral-400 mb-1">
                  Tüm Görevler
                </p>
                <h2 className="font-commons text-xl font-semibold text-[#171717]">
                  {visibleItems.length} aktif görev
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/60 text-neutral-500 hover:text-neutral-700 transition-colors"
                title="Kapat (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 px-8 pb-8 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : visibleItems.length === 0 ? (
                <div className="text-center py-16">
                  <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                  <p className="font-commons text-base font-medium text-neutral-700">
                    Hepsi temiz.
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={(e: DragStartEvent) => setDraggingId(String(e.active.id))}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => setDraggingId(null)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {COLUMNS.map((col) => {
                      const list = grouped[col.key];
                      return (
                        <DroppableColumn
                          key={col.key}
                          col={col}
                          count={list.length}
                        >
                          {list.length === 0 ? (
                            <p className="font-commons text-xs text-neutral-300 italic px-2 py-3">
                              Buraya sürükle…
                            </p>
                          ) : (
                            list.map((item) => (
                              <TaskCard
                                key={item.id}
                                item={item}
                                isCurrent={item.id === currentTaskId}
                                users={users}
                                children={childrenByParent.get(item.id)}
                                currentTaskId={currentTaskId}
                                onClick={() => onSelectTask?.(item)}
                                onChildClick={(c) => onSelectTask?.(c)}
                              />
                            ))
                          )}
                        </DroppableColumn>
                      );
                    })}
                  </div>

                  <DragOverlay
                    dropAnimation={{
                      duration: 180,
                      easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                    }}
                  >
                    {draggingItem ? (
                      <div className="rotate-2 scale-105 shadow-2xl ring-2 ring-violet-300 rounded-xl bg-white p-3 max-w-xs">
                        <p className="font-commons text-sm text-[#171717] truncate">
                          {draggingItem.title}
                        </p>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NowAllTasksPanel;
