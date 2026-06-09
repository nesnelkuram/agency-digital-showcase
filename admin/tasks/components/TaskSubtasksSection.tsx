import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Loader2,
  Sparkles,
  Trash2,
  Play,
  CheckCircle2,
  Circle,
  FileEdit,
  Check,
  GitBranch,
} from 'lucide-react';
import type { Task } from '@/shared/types/task';
import { TASK_STATUS_LABELS } from '@/shared/types/task';
import {
  getSubtasks,
  saveBreakdown,
  updateTask,
  deleteTask,
} from '@/shared/services/taskService';
import { createTemplateFromSubtasks } from '@/shared/services/workflowTemplateService';
import { createSop } from '@/shared/services/sopService';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import NowBreakdownPreview, {
  type BreakdownStepDraft,
  type BreakdownAcceptPayload,
  type MatchedSopInfo,
} from '@/admin/now/components/NowBreakdownPreview';

interface TaskSubtasksSectionProps {
  task: Task;
}

async function getAuthToken(): Promise<string> {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  return currentUser.getIdToken();
}

interface AiBreakdownState {
  reason: string;
  steps: BreakdownStepDraft[];
  matchedSop: MatchedSopInfo | null;
  isNewPattern: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-emerald-50 text-emerald-700',
  paused: 'bg-amber-50 text-amber-700',
  awaiting_review: 'bg-violet-50 text-violet-700',
  blocked: 'bg-rose-50 text-rose-700',
  completed: 'bg-neutral-100 text-neutral-500',
  cancelled: 'bg-neutral-100 text-neutral-400',
};

const TaskSubtasksSection: React.FC<TaskSubtasksSectionProps> = ({ task }) => {
  const tenantId = useTenantId();
  const { user } = useAuth();

  // Alt görevler her zaman KÖK göreve kardeş olarak eklenir. Odaktaki görev
  // kendisi bir alt görevse (ŞİMDİ akışında parent'a tıklayınca ilk açık child'a
  // gidiyoruz), yeni adımları onun altına değil — aynı seviyeye, parent'ına yazarız.
  // Böylece iç içe "torun" oluşmaz; adımlar yan yana sıralanır.
  const containerId = task.parentTaskId || task.id;

  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  // Kaydedildi onay mesajını birkaç saniye sonra otomatik gizle
  const flashSaved = useCallback((msg: string) => {
    setSavedNote(msg);
    setTimeout(() => setSavedNote(null), 4000);
  }, []);

  // Manual add
  const [newTitle, setNewTitle] = useState('');
  const [newMinutes, setNewMinutes] = useState('');
  const [addAsDraft, setAddAsDraft] = useState(false);

  // AI breakdown
  const [aiLoading, setAiLoading] = useState(false);
  const [aiBreakdown, setAiBreakdown] = useState<AiBreakdownState | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiEmptyNote, setAiEmptyNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tenantId) return;
    try {
      const children = await getSubtasks(tenantId, containerId);
      setSubtasks(children);
    } catch (err: any) {
      console.error('[TaskSubtasksSection] load failed:', err);
      setError(err?.message || 'Alt görevler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [tenantId, containerId]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const breakdownMeta = (asDraft: boolean) => ({
    createdBy: user?.uid || '',
    createdByName: user?.displayName || user?.email || '',
    inheritedProjectId: task.projectId,
    inheritedProjectName: task.projectName,
    inheritedCategory: task.category,
    parentPriorityScore: task.aiPriorityScore ?? 50,
    asDraft,
  });

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || busy || !tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const minutes = parseInt(newMinutes, 10);
      await saveBreakdown(
        tenantId,
        containerId,
        [{ title, estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 15 }],
        breakdownMeta(addAsDraft)
      );
      setNewTitle('');
      setNewMinutes('');
      await reload();
      flashSaved(addAsDraft ? '1 alt görev taslak olarak kaydedildi.' : '1 alt görev eklendi.');
    } catch (err: any) {
      console.error('[TaskSubtasksSection] manual add failed:', err);
      setError(err?.message || 'Alt görev eklenemedi');
    } finally {
      setBusy(false);
    }
  };

  const handleAiSuggest = async () => {
    if (aiLoading || !tenantId) return;
    setAiLoading(true);
    setAiError(null);
    setAiEmptyNote(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/tasks/breakdown-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taskId: containerId }),
      });
      if (!res.ok) throw new Error('AI önerisi alınamadı');
      const data: {
        shouldBreakdown: boolean;
        reason?: string;
        steps?: BreakdownStepDraft[];
        matchedSop?: MatchedSopInfo | null;
        isNewPattern?: boolean;
      } = await res.json();

      const steps = data.steps || [];
      if (data.shouldBreakdown && steps.length > 0) {
        setAiBreakdown({
          reason: data.reason || '',
          steps,
          matchedSop: data.matchedSop || null,
          isNewPattern: Boolean(data.isNewPattern),
        });
      } else {
        // Alt görevi olan görevler için backend yeniden öneri vermez — elle ekleyebilir
        setAiEmptyNote(
          subtasks.length > 0
            ? 'Bu görev için AI yeni öneri vermedi. Aşağıdan elle adım ekleyebilirsin.'
            : 'AI bu işi alt adımlara bölmeyi gerekli görmedi.'
        );
      }
    } catch (err: any) {
      console.error('[TaskSubtasksSection] AI suggest failed:', err);
      setAiError(err?.message || 'AI önerisi alınamadı');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiAccept = async (payload: BreakdownAcceptPayload) => {
    if (!aiBreakdown || !tenantId) return;
    setAiSaving(true);
    setAiError(null);
    try {
      await saveBreakdown(
        tenantId,
        containerId,
        payload.steps.map((s) => ({
          title: s.title,
          estimatedMinutes: s.estimatedMinutes,
          alreadyDone: s.alreadyDone,
          trainingResourceId: s.trainingResourceId,
        })),
        {
          ...breakdownMeta(Boolean(payload.asDraft)),
          ...(aiBreakdown.matchedSop
            ? { sopId: aiBreakdown.matchedSop.id, sopName: aiBreakdown.matchedSop.name }
            : {}),
        }
      );
      const count = payload.steps.length;
      setAiBreakdown(null);
      await reload();
      flashSaved(
        payload.asDraft
          ? `${count} alt görev taslak olarak kaydedildi (akışta görünmez, "Aktifleştir" ile başlatabilirsin).`
          : `${count} alt görev eklendi.`
      );
    } catch (err: any) {
      console.error('[TaskSubtasksSection] AI accept failed:', err);
      setAiError(err?.message || 'Kaydedilemedi');
    } finally {
      setAiSaving(false);
    }
  };

  const handleActivate = async (child: Task) => {
    if (!tenantId) return;
    try {
      await updateTask(tenantId, child.id, { status: 'open' });
      await reload();
    } catch (err) {
      console.error('[TaskSubtasksSection] activate failed:', err);
    }
  };

  const handleDelete = async (child: Task) => {
    if (!tenantId) return;
    try {
      await deleteTask(tenantId, child.id);
      const remaining = subtasks.filter((s) => s.id !== child.id);
      await updateTask(tenantId, containerId, { subTaskCount: remaining.length });
      setSubtasks(remaining);
    } catch (err) {
      console.error('[TaskSubtasksSection] delete failed:', err);
    }
  };

  // Alt görevleri yeniden kullanılabilir bir İŞ AKIŞINA çevir.
  // Köprü davranışı: hem Workflow Template (Workflows menüsünde görünür +
  // builder'da düzenlenir) hem SOP (AI gelecekte benzer görevlerde otomatik
  // çağırır) olarak kaydeder.
  const handleSaveAsWorkflow = async () => {
    if (savingWorkflow || !tenantId || subtasks.length === 0) return;
    setSavingWorkflow(true);
    setError(null);
    try {
      const createdBy = user?.uid || '';
      const createdByName = user?.displayName || user?.email || '';
      const name = task.title?.trim() || 'Yeni İş Akışı';
      // Tamamlanmış/iptal hariç — taslak dahil tüm adımlar akışa girsin
      const steps = subtasks
        .filter((s) => s.status !== 'cancelled')
        .map((s) => ({
          title: s.title,
          estimatedMinutes: s.estimatedMinutes,
          assigneeRole: s.assigneeRole,
        }));

      // 1) Workflow Template — Workflows menüsünde görünür, builder'da düzenlenir
      await createTemplateFromSubtasks(tenantId, {
        name,
        description: task.description?.trim() || undefined,
        steps,
        createdBy,
        createdByName,
      });

      // 2) SOP — görev alt görevi tanımlarken AI'nın çağırması için kalıp
      //    (zaten bir SOP'tan türemişse tekrar oluşturma)
      let sopCreated = false;
      if (!task.derivedFromSopId) {
        try {
          await createSop({
            tenantId,
            name,
            description: `"${name}" görevinden öğrenildi`,
            matchKeywords: extractKeywords(name),
            steps: steps.map((s) => ({
              title: s.title,
              estimatedMinutes: s.estimatedMinutes && s.estimatedMinutes > 0 ? s.estimatedMinutes : 30,
              ...(s.assigneeRole ? { assigneeRole: s.assigneeRole } : {}),
            })),
            createdBy,
            createdByName,
          });
          sopCreated = true;
        } catch (sopErr) {
          // SOP başarısız olsa da workflow kaydedildi — sessiz geç
          console.warn('[TaskSubtasksSection] SOP kaydı başarısız:', sopErr);
        }
      }

      flashSaved(
        sopCreated
          ? 'İş akışı kaydedildi — Workflows menüsünde görünür; AI benzer görevlerde bu kalıbı önerecek.'
          : 'İş akışı kaydedildi — Workflows menüsünde görebilirsin.'
      );
    } catch (err: any) {
      console.error('[TaskSubtasksSection] save as workflow failed:', err);
      setError(err?.message || 'İş akışı kaydedilemedi');
    } finally {
      setSavingWorkflow(false);
    }
  };

  const draftCount = subtasks.filter((s) => s.status === 'draft').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-commons text-xs font-medium text-neutral-500 uppercase tracking-wide">
          Alt Görevler
          {subtasks.length > 0 && (
            <span className="ml-1.5 text-neutral-400 normal-case tracking-normal">
              ({subtasks.length}
              {draftCount > 0 && <span className="text-amber-600"> · {draftCount} taslak</span>})
            </span>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          {subtasks.length > 0 && (
            <button
              type="button"
              onClick={handleSaveAsWorkflow}
              disabled={savingWorkflow}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-commons text-[11px] font-medium transition-colors disabled:opacity-50"
              title="Bu alt görevleri yeniden kullanılabilir bir iş akışı olarak kaydet (Workflows menüsünde görünür; AI benzer görevlerde önerir)"
            >
              {savingWorkflow ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <GitBranch className="w-3 h-3" />
              )}
              İş akışı olarak kaydet
            </button>
          )}
          <button
            type="button"
            onClick={handleAiSuggest}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 font-commons text-[11px] font-medium transition-colors disabled:opacity-50"
            title="AI önce kayıtlı bir iş akışı (SOP) var mı bakar, yoksa adım önerir"
          >
            {aiLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            AI ile böl
          </button>
        </div>
      </div>

      {/* Kaydedildi onayı */}
      {savedNote && (
        <div className="flex items-start gap-1.5 mb-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
          <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={3} />
          <span className="font-commons text-[11px] text-emerald-800">{savedNote}</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-neutral-400 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="font-commons text-xs">Yükleniyor…</span>
        </div>
      ) : subtasks.length === 0 ? (
        <p className="font-commons text-xs text-neutral-400 py-1">
          Henüz alt görev yok. AI ile bölebilir veya aşağıdan elle ekleyebilirsin.
        </p>
      ) : (
        <div className="space-y-1.5">
          {subtasks.map((child, idx) => {
            const isDone = child.status === 'completed' || child.status === 'cancelled';
            const isDraft = child.status === 'draft';
            return (
              <div
                key={child.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg group ${
                  isDraft ? 'bg-amber-50/50' : 'bg-neutral-50'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />
                )}
                <span className="font-mono text-[10px] text-neutral-400 w-4 text-right flex-shrink-0">
                  {idx + 1}.
                </span>
                <span
                  className={`flex-1 min-w-0 truncate font-commons text-sm ${
                    isDone ? 'line-through text-neutral-400' : 'text-[#171717]'
                  }`}
                >
                  {child.title}
                </span>
                <span
                  className={`flex-shrink-0 font-commons text-[10px] px-1.5 py-0.5 rounded-full ${
                    STATUS_BADGE[child.status] || 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {TASK_STATUS_LABELS[child.status] || child.status}
                </span>
                {isDraft && (
                  <button
                    type="button"
                    onClick={() => handleActivate(child)}
                    title="Aktifleştir — akışa al"
                    className="p-1 rounded text-emerald-500 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(child)}
                  title="Sil"
                  className="p-1 rounded text-neutral-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {aiEmptyNote && (
        <p className="mt-2 font-commons text-[11px] text-neutral-500 italic">{aiEmptyNote}</p>
      )}
      {aiError && !aiBreakdown && (
        <p className="mt-2 font-commons text-[11px] text-rose-600">{aiError}</p>
      )}

      {/* Manual add */}
      <form onSubmit={handleManualAdd} className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            disabled={busy}
            placeholder="Alt görev başlığı…"
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm text-[#171717] placeholder:text-neutral-300 focus:outline-none focus:border-neutral-400 disabled:opacity-50"
          />
          <input
            type="number"
            min={1}
            value={newMinutes}
            onChange={(e) => setNewMinutes(e.target.value)}
            disabled={busy}
            placeholder="dk"
            className="w-16 px-2 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm text-center text-[#171717] placeholder:text-neutral-300 focus:outline-none focus:border-neutral-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !newTitle.trim()}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#171717] text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
            title="Ekle"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={addAsDraft}
            onChange={(e) => setAddAsDraft(e.target.checked)}
            disabled={busy}
            className="accent-amber-600"
          />
          <FileEdit className="w-3 h-3 text-amber-600" />
          <span className="font-commons text-[11px] text-neutral-600">
            Taslak olarak ekle (akışta görünmez)
          </span>
        </label>
      </form>

      {error && <p className="mt-2 font-commons text-[11px] text-rose-600">{error}</p>}

      {/* AI breakdown preview (reused from ŞİMDİ quick-add) */}
      <NowBreakdownPreview
        open={!!aiBreakdown}
        taskTitle={task.title}
        reason={aiBreakdown?.reason}
        initialSteps={aiBreakdown?.steps || []}
        matchedSop={aiBreakdown?.matchedSop || null}
        isNewPattern={aiBreakdown?.isNewPattern || false}
        saving={aiSaving}
        error={aiError}
        onCancel={() => setAiBreakdown(null)}
        onAccept={handleAiAccept}
        cancelLabel="Vazgeç"
        acceptLabel="Alt görevleri ekle"
      />
    </div>
  );
};

// Görev başlığından SOP eşleştirme için basit anahtar kelimeler çıkar
function extractKeywords(title: string): string[] {
  const stopwords = new Set([
    'için', 'bir', 'bu', 'şu', 'çekilecek', 'yapılacak', 'olacak', 've', 'ile', 'da', 'de', 'ya',
  ]);
  const words = title
    .toLowerCase()
    .replace(/[^\wçğıöşüâî\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopwords.has(w));
  return Array.from(new Set(words)).slice(0, 8);
}

export default TaskSubtasksSection;
