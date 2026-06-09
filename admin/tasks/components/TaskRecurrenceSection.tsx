/**
 * TaskRecurrenceSection — bir görevin detayında "bunu tekrarla" bölümü.
 * Görev alanlarından bir `recurring_tasks` şablonu kurar; kurulduğunda görevin
 * `recurringTemplateId` alanı şablona bağlanır. Açıkken şablonu düzenleyebilir,
 * duraklatabilir veya kaldırabilirsin.
 */
import React, { useEffect, useState } from 'react';
import { Repeat, Clock, CalendarClock, Loader2, Power, Trash2, ChevronDown } from 'lucide-react';
import { useTenantId } from '@/shared/hooks/useTenant';
import { updateTask } from '@/shared/services/taskService';
import {
  createRecurringTask,
  updateRecurringTask,
  deleteRecurringTask,
  getRecurringTask,
  type RecurringTaskInput,
} from '@/shared/services/recurringTaskService';
import { describeCron, isValidCron, formatNextRun } from '@/shared/utils/cron';
import ScheduleBuilder from './ScheduleBuilder';
import type { Task } from '@/shared/types/task';
import type { RecurringTaskTemplate } from '@/shared/types/recurringTask';

const TZ = 'Europe/Istanbul';

interface Props {
  task: Task;
  onUpdated?: () => void;
}

function nextRunDate(t: RecurringTaskTemplate | null): Date | null {
  const v = t?.schedule?.nextRunAt as any;
  if (!v) return null;
  if (typeof v === 'number') return new Date(v);
  if (v.toDate) return v.toDate();
  return new Date(v);
}

// Görev alanlarından şablon girdisi türet
function buildInputFromTask(task: Task, cron: string, enabled: boolean): RecurringTaskInput {
  const estimatedMinutes =
    task.estimatedMinutes ?? (task.estimatedHours ? Math.round(task.estimatedHours * 60) : undefined);

  const input: RecurringTaskInput = {
    title: task.title,
    priority: task.priority,
    schedule: { cronExpression: cron, timezone: TZ, enabled },
    createdBy: task.createdBy || 'unknown',
    createdByName: task.createdByName || '',
  };
  if (task.description) input.description = task.description;
  if (task.category) input.category = task.category;
  if (estimatedMinutes) input.estimatedMinutes = estimatedMinutes;
  if (task.tags?.length) input.tags = task.tags;
  if (task.assigneeId) {
    input.assigneeId = task.assigneeId;
    if (task.assigneeName) input.assigneeName = task.assigneeName;
    if (task.assigneeRole) input.assigneeRole = task.assigneeRole;
  }
  if (task.projectId) {
    input.projectId = task.projectId;
    if (task.projectName) input.projectName = task.projectName;
  }
  if (task.clientId) input.clientId = task.clientId;
  if (task.clientName) input.clientName = task.clientName;
  return input;
}

const TaskRecurrenceSection: React.FC<Props> = ({ task, onUpdated }) => {
  const tenantId = useTenantId();
  const [template, setTemplate] = useState<RecurringTaskTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cron, setCron] = useState('0 9 * * *');
  const [busy, setBusy] = useState(false);

  // Mevcut şablonu yükle (görev bir şablona bağlıysa)
  useEffect(() => {
    let cancelled = false;
    if (!task.recurringTemplateId) {
      setTemplate(null);
      return;
    }
    setLoading(true);
    getRecurringTask(task.recurringTemplateId)
      .then((t) => {
        if (cancelled) return;
        setTemplate(t);
        if (t?.schedule?.cronExpression) {
          setCron(t.schedule.cronExpression);
        }
      })
      .catch((err) => console.warn('[Recurrence] load failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [task.recurringTemplateId]);

  const cronValid = isValidCron(cron);

  const reload = async (id: string) => {
    const t = await getRecurringTask(id);
    setTemplate(t);
  };

  // Tekrarı kur (yeni şablon)
  const handleCreate = async () => {
    if (!cronValid || busy) return;
    setBusy(true);
    try {
      const input = buildInputFromTask(task, cron.trim(), true);
      const id = await createRecurringTask(tenantId, input);
      await updateTask(tenantId, task.id, { recurringTemplateId: id });
      await reload(id);
      setExpanded(false);
      onUpdated?.();
    } catch (err) {
      console.error('[Recurrence] create failed:', err);
    } finally {
      setBusy(false);
    }
  };

  // Sıklığı güncelle
  const handleUpdateCron = async () => {
    if (!template || !cronValid || busy) return;
    setBusy(true);
    try {
      await updateRecurringTask(tenantId, template.id, {
        schedule: { cronExpression: cron.trim(), timezone: TZ, enabled: template.schedule.enabled },
      });
      await reload(template.id);
      setExpanded(false);
      onUpdated?.();
    } catch (err) {
      console.error('[Recurrence] update failed:', err);
    } finally {
      setBusy(false);
    }
  };

  // Aktif/Pasif
  const handleToggle = async () => {
    if (!template || busy) return;
    setBusy(true);
    try {
      await updateRecurringTask(tenantId, template.id, {
        schedule: {
          cronExpression: template.schedule.cronExpression,
          timezone: template.schedule.timezone || TZ,
          enabled: !template.schedule.enabled,
        },
      });
      await reload(template.id);
      onUpdated?.();
    } catch (err) {
      console.error('[Recurrence] toggle failed:', err);
    } finally {
      setBusy(false);
    }
  };

  // Tekrarı kaldır
  const handleRemove = async () => {
    if (!template || busy) return;
    if (!window.confirm('Bu görevin tekrarını kaldırmak istediğine emin misin?')) return;
    setBusy(true);
    try {
      await deleteRecurringTask(tenantId, template.id);
      await updateTask(tenantId, task.id, { recurringTemplateId: '' });
      setTemplate(null);
      setExpanded(false);
      onUpdated?.();
    } catch (err) {
      console.error('[Recurrence] remove failed:', err);
    } finally {
      setBusy(false);
    }
  };

  // ─── Zamanlama seçici (ortak) ─────────────────────────────────────────────
  const cronPicker = <ScheduleBuilder value={cron} onChange={setCron} />;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <p className="font-commons text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
        <Repeat className="w-3.5 h-3.5" />
        Tekrar
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-neutral-400 text-xs font-commons py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Yükleniyor…
        </div>
      ) : template ? (
        // ── Bağlı şablon var ──
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-commons font-medium ${
                template.schedule.enabled
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {template.schedule.enabled ? 'Tekrarlanıyor' : 'Duraklatıldı'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggle}
                disabled={busy}
                className="p-1 rounded-md hover:bg-white text-neutral-500 disabled:opacity-50"
                title={template.schedule.enabled ? 'Duraklat' : 'Aktifleştir'}
              >
                <Power className={`w-3.5 h-3.5 ${template.schedule.enabled ? 'text-emerald-500' : 'text-neutral-400'}`} />
              </button>
              <button
                onClick={() => setExpanded((v) => !v)}
                disabled={busy}
                className="p-1 rounded-md hover:bg-white text-neutral-500 disabled:opacity-50"
                title="Sıklığı değiştir"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={handleRemove}
                disabled={busy}
                className="p-1 rounded-md hover:bg-white text-neutral-400 hover:text-rose-500 disabled:opacity-50"
                title="Tekrarı kaldır"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1 font-commons text-xs text-neutral-600">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              {describeCron(template.schedule.cronExpression)}
            </div>
            {template.schedule.enabled && (
              <div className="flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-neutral-400" />
                Sıradaki: <span className="text-neutral-800">{formatNextRun(nextRunDate(template))}</span>
              </div>
            )}
          </div>

          {expanded && (
            <div className="pt-2 border-t border-violet-100">
              {cronPicker}
              <button
                onClick={handleUpdateCron}
                disabled={!cronValid || busy}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-[#171717] text-white font-commons text-xs font-medium hover:bg-neutral-800 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sıklığı kaydet
              </button>
            </div>
          )}
        </div>
      ) : expanded ? (
        // ── Yeni tekrar kurma ──
        <div className="rounded-xl border border-neutral-200 bg-white p-3 space-y-2">
          {cronPicker}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={!cronValid || busy}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-[#171717] text-white font-commons text-xs font-medium hover:bg-neutral-800 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Tekrarı kur
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 font-commons text-xs text-neutral-500 hover:bg-neutral-50"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        // ── Henüz tekrar yok ──
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-neutral-300 text-neutral-500 hover:border-violet-300 hover:text-violet-600 transition-colors font-commons text-xs"
        >
          <Repeat className="w-3.5 h-3.5" />
          Bu görevi tekrarla
        </button>
      )}
    </div>
  );
};

export default TaskRecurrenceSection;
