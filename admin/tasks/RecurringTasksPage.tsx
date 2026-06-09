/**
 * RecurringTasksPage — periyodik (tekrarlayan) görev şablonları.
 * Şablonlar cron'a göre otomatik olarak `tasks` koleksiyonuna görev üretir.
 * Route: /admin/tasks/recurring
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Repeat,
  Plus,
  ArrowLeft,
  Clock,
  CalendarClock,
  Trash2,
  Pencil,
  Loader2,
  X,
  Power,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import { useRecurringTasks } from '@/shared/hooks/useRecurringTasks';
import { useActiveProjects } from '@/shared/hooks/useActiveProjects';
import {
  createRecurringTask,
  updateRecurringTask,
  deleteRecurringTask,
  type RecurringTaskInput,
} from '@/shared/services/recurringTaskService';
import { describeCron, isValidCron, formatNextRun } from '@/shared/utils/cron';
import ScheduleBuilder from './components/ScheduleBuilder';
import { TASK_PRIORITY_LABELS } from '@/shared/types/task';
import type { TaskCategory, TaskPriority } from '@/shared/types/task';
import type { RecurringTaskTemplate } from '@/shared/types/recurringTask';

const TZ = 'Europe/Istanbul';

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  brand: 'Markalarımız',
  admin: 'İdari',
  personal: 'Kişisel',
};

interface TenantUser {
  uid: string;
  name: string;
  role?: string;
}

function nextRunDate(t: RecurringTaskTemplate): Date | null {
  const v = t.schedule?.nextRunAt as any;
  if (!v) return null;
  if (typeof v === 'number') return new Date(v);
  if (v.toDate) return v.toDate();
  return new Date(v);
}

// ─── Form modal ───────────────────────────────────────────────────────────────
interface FormState {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  estimatedMinutes: string;
  cronExpression: string;
  enabled: boolean;
  assigneeId: string;
  projectId: string;
  dueOffsetHours: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  category: 'admin',
  priority: 'medium',
  estimatedMinutes: '',
  cronExpression: '0 9 * * *',
  enabled: true,
  assigneeId: '',
  projectId: '',
  dueOffsetHours: '',
};

interface ModalProps {
  open: boolean;
  editing: RecurringTaskTemplate | null;
  users: TenantUser[];
  projects: { id: string; name: string }[];
  onClose: () => void;
  onSave: (form: FormState) => Promise<void>;
}

const RecurringTaskModal: React.FC<ModalProps> = ({ open, editing, users, projects, onClose, onSave }) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description || '',
        category: editing.category || 'admin',
        priority: editing.priority || 'medium',
        estimatedMinutes: editing.estimatedMinutes ? String(editing.estimatedMinutes) : '',
        cronExpression: editing.schedule?.cronExpression || '0 9 * * *',
        enabled: editing.schedule?.enabled ?? true,
        assigneeId: editing.assigneeId || '',
        projectId: editing.projectId || '',
        dueOffsetHours: editing.dueOffsetHours ? String(editing.dueOffsetHours) : '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editing]);

  if (!open) return null;

  const cronValid = isValidCron(form.cronExpression);

  const handleSubmit = async () => {
    if (!form.title.trim() || !cronValid || saving) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 sticky top-0 bg-white">
          <h2 className="font-grotesk font-semibold text-lg text-[#171717] flex items-center gap-2">
            <Repeat className="w-5 h-5 text-violet-500" />
            {editing ? 'Periyodik Görevi Düzenle' : 'Yeni Periyodik Görev'}
          </h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Başlık */}
          <div>
            <label className="font-commons text-xs font-medium text-neutral-600 block mb-1">
              Görev başlığı *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Örn. Haftalık içerik planı hazırla"
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="font-commons text-xs font-medium text-neutral-600 block mb-1">Açıklama</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400 resize-none"
            />
          </div>

          {/* Kategori + Öncelik */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 block mb-1">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as TaskCategory })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
              >
                {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 block mb-1">Öncelik</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
              >
                {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tekrar sıklığı */}
          <div>
            <label className="font-commons text-xs font-medium text-neutral-600 block mb-1.5">
              Tekrar sıklığı *
            </label>
            <ScheduleBuilder
              value={form.cronExpression}
              onChange={(c) => setForm({ ...form, cronExpression: c })}
            />
          </div>

          {/* Atama + Proje */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 block mb-1">Ata (opsiyonel)</label>
              <select
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
              >
                <option value="">— Kimse —</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 block mb-1">Proje (opsiyonel)</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
              >
                <option value="">— Yok —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tahmini süre + Deadline ofseti */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 block mb-1">Tahmini süre (dk)</label>
              <input
                type="number"
                min={0}
                value={form.estimatedMinutes}
                onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })}
                placeholder="örn. 30"
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="font-commons text-xs font-medium text-neutral-600 block mb-1">
                Deadline (spawn+saat)
              </label>
              <input
                type="number"
                min={0}
                value={form.dueOffsetHours}
                onChange={(e) => setForm({ ...form, dueOffsetHours: e.target.value })}
                placeholder="örn. 24"
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm font-commons focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>

          {/* Aktif toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="font-commons text-sm text-[#171717]">
              {form.enabled ? 'Aktif — otomatik üretilecek' : 'Pasif — duraklatıldı'}
            </span>
            <button
              type="button"
              onClick={() => setForm({ ...form, enabled: !form.enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.enabled ? 'bg-emerald-500' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  form.enabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Vazgeç
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim() || !cronValid || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171717] text-white font-commons text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Kaydet' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const RecurringTasksPage: React.FC = () => {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { items, loading } = useRecurringTasks();
  const { projects: activeProjects } = useActiveProjects();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTaskTemplate | null>(null);

  // Tenant kullanıcıları (atama için)
  useEffect(() => {
    if (!db || !tenantId) return;
    let cancelled = false;
    getDocs(query(collection(db, 'users'), where('tenantId', '==', tenantId)))
      .then((snap) => {
        if (cancelled) return;
        setUsers(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return { uid: d.id, name: data.displayName || data.email || 'Üye', role: data.role };
          })
        );
      })
      .catch((err) => console.warn('[RecurringTasks] users load failed:', err));
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const projects = useMemo(
    () => (activeProjects || []).map((p: any) => ({ id: p.id, name: p.name })),
    [activeProjects]
  );

  const buildInput = (form: FormState): RecurringTaskInput => {
    const assignee = users.find((u) => u.uid === form.assigneeId);
    const project = projects.find((p) => p.id === form.projectId);
    const input: RecurringTaskInput = {
      title: form.title.trim(),
      priority: form.priority,
      category: form.category,
      schedule: {
        cronExpression: form.cronExpression.trim(),
        timezone: TZ,
        enabled: form.enabled,
      },
      createdBy: user?.uid || 'unknown',
      createdByName: user?.displayName || user?.email || 'Bilinmeyen',
    };
    if (form.description.trim()) input.description = form.description.trim();
    if (form.estimatedMinutes) input.estimatedMinutes = Number(form.estimatedMinutes);
    if (form.dueOffsetHours) input.dueOffsetHours = Number(form.dueOffsetHours);
    if (assignee) {
      input.assigneeId = assignee.uid;
      input.assigneeName = assignee.name;
      if (assignee.role) input.assigneeRole = assignee.role;
    }
    if (project) {
      input.projectId = project.id;
      input.projectName = project.name;
    }
    return input;
  };

  const handleSave = async (form: FormState) => {
    const input = buildInput(form);
    if (editing) {
      await updateRecurringTask(tenantId, editing.id, input);
    } else {
      await createRecurringTask(tenantId, input);
    }
  };

  const toggleEnabled = async (t: RecurringTaskTemplate) => {
    await updateRecurringTask(tenantId, t.id, {
      schedule: {
        cronExpression: t.schedule.cronExpression,
        timezone: t.schedule.timezone || TZ,
        enabled: !t.schedule.enabled,
      },
    });
  };

  const handleDelete = async (t: RecurringTaskTemplate) => {
    if (!window.confirm(`"${t.title}" periyodik görevini silmek istediğine emin misin?`)) return;
    await deleteRecurringTask(tenantId, t.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/admin/now"
            className="inline-flex items-center gap-1.5 font-commons text-xs text-neutral-500 hover:text-neutral-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Görevlere dön
          </Link>
          <h1 className="text-2xl font-grotesk font-bold text-[#171717] flex items-center gap-2">
            <Repeat className="w-6 h-6 text-violet-600" />
            Periyodik Görevler
          </h1>
          <p className="font-commons text-sm text-neutral-500 mt-0.5">
            Belirli aralıklarla otomatik olarak görev listesine eklenen tekrarlayan işler
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171717] text-white hover:bg-neutral-800 transition-colors font-commons text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Yeni Periyodik Görev
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-neutral-200 rounded-2xl">
          <Repeat className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="font-commons text-sm text-neutral-500">
            Henüz periyodik görev yok. Tekrar eden işlerini bir kez tanımla, gerisini sistem halletsin.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((t) => {
            const next = nextRunDate(t);
            return (
              <div
                key={t.id}
                className={`rounded-2xl border bg-white p-4 transition-colors ${
                  t.schedule?.enabled ? 'border-neutral-200' : 'border-neutral-100 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-commons font-semibold text-[#171717] truncate">{t.title}</h3>
                    {t.description && (
                      <p className="font-commons text-xs text-neutral-500 mt-0.5 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-commons font-medium ${
                      t.schedule?.enabled
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {t.schedule?.enabled ? 'Aktif' : 'Pasif'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 font-commons text-xs text-neutral-600">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-violet-500" />
                    {describeCron(t.schedule?.cronExpression || '')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-neutral-400" />
                    Sıradaki: <span className="text-neutral-800">{formatNextRun(next)}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  {t.category && (
                    <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[10px] font-commons">
                      {CATEGORY_LABELS[t.category]}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[10px] font-commons">
                    {TASK_PRIORITY_LABELS[t.priority]}
                  </span>
                  {t.assigneeName && (
                    <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-600 text-[10px] font-commons">
                      {t.assigneeName}
                    </span>
                  )}
                  {typeof t.spawnCount === 'number' && t.spawnCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-neutral-50 text-neutral-400 text-[10px] font-commons">
                      {t.spawnCount} kez üretildi
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-end gap-1">
                  <button
                    onClick={() => toggleEnabled(t)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-neutral-500 hover:bg-neutral-50 text-xs font-commons"
                    title={t.schedule?.enabled ? 'Duraklat' : 'Aktifleştir'}
                  >
                    <Power className={`w-3.5 h-3.5 ${t.schedule?.enabled ? 'text-emerald-500' : 'text-neutral-400'}`} />
                  </button>
                  <button
                    onClick={() => {
                      setEditing(t);
                      setModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-neutral-500 hover:bg-neutral-50 text-xs font-commons"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-50 text-xs font-commons"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecurringTaskModal
        open={modalOpen}
        editing={editing}
        users={users}
        projects={projects}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};

export default RecurringTasksPage;
