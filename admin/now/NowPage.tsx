import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Menu, Plus, FolderTree } from 'lucide-react';
import { useNowTask } from '@/shared/hooks/useNowTask';
import { useNowKeyboard } from '@/shared/hooks/useNowKeyboard';
import { useChronicallySkipped } from '@/shared/hooks/useChronicallySkipped';
import { useFlowSteps } from '@/shared/hooks/useFlowSteps';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/shared/hooks/usePermission';
import { useTenantId } from '@/shared/hooks/useTenant';
import { startTask, pauseTask, completeTask, skipTask, type SkipReason } from '@/shared/services/nowService';
import { getTodayTheme } from '@/shared/utils/dayTheme';
import NowTaskCard from './components/NowTaskCard';
import NowFlowCard from './components/NowFlowCard';
import NowControls from './components/NowControls';
import NowEmptyState from './components/NowEmptyState';
import SkipReasonModal from './components/SkipReasonModal';
import NowQuickAdd from './components/NowQuickAdd';
import NowSkipDecisionBar from './components/NowSkipDecisionBar';
import TrainingVideoModal from './components/TrainingVideoModal';
import NowAllTasksPanel from './components/NowAllTasksPanel';

const TURKISH_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const NowPage: React.FC = () => {
  const now = useNow();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { isAdmin } = usePermission();
  const actor = user
    ? { uid: user.uid, name: user.displayName || user.email || 'Bilinmeyen' }
    : undefined;
  // Admin → tüm tenant görevleri. Diğerleri → sadece kendine atanmış.
  const taskScope: 'mine' | 'all' = isAdmin() ? 'all' : 'mine';

  // State declarations — useNowTask'tan ÖNCE olmalı (TDZ)
  const [busy, setBusy] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [allTasksOpen, setAllTasksOpen] = useState(false);
  const [pinnedTaskId, setPinnedTaskId] = useState<string | null>(null);
  const [trainingVideoId, setTrainingVideoId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    now: currentTask,
    parentFlow,
    flowSteps,
    loading,
    error,
  } = useNowTask({ pinnedId: pinnedTaskId, scope: taskScope });

  const dayName = TURKISH_DAYS[now.getDay()];
  const theme = getTodayTheme(now);
  const timeLabel = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const { items: skippedItems } = useChronicallySkipped(taskScope);

  // Parent header'ı tüm child'ları (tamamlanmış dahil) bilmek için
  const allFlowSteps = useFlowSteps(tenantId, parentFlow?.id || null);

  const isRunning = currentTask?.status === 'in_progress';
  const isPaused = currentTask?.status === 'paused';

  // ─── Actions ─────────────────────────────────────────────────────────────
  // BAŞLA veya DEVAM — duruma göre dispatch
  const handleStart = async () => {
    if (!currentTask || busy || isRunning) return;
    setActionError(null);
    setBusy(true);
    try {
      // paused olsa da startTask resume davranışı yapıyor (accumulated korunur)
      await startTask(tenantId, currentTask.id, actor);
    } catch (err: any) {
      setActionError(err?.message || 'Başlatılamadı');
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    if (!currentTask || busy || !isRunning) return;
    setActionError(null);
    setBusy(true);
    try {
      await pauseTask(tenantId, currentTask.id);
    } catch (err: any) {
      setActionError(err?.message || 'Duraklatılamadı');
    } finally {
      setBusy(false);
    }
  };

  // Aktif task tamamlandı/atlandıktan sonra aynı flow'da kalmak için
  // sıradaki açık (open/paused/in_progress) child'ı bul ve pin et
  const findNextChildInFlow = (): string | null => {
    if (!flowSteps || flowSteps.length === 0 || !currentTask) return null;
    const idx = flowSteps.findIndex((s) => s.id === currentTask.id);
    if (idx < 0) return null;
    // idx+1'den itibaren ilk tamamlanmamış child
    for (let i = idx + 1; i < flowSteps.length; i++) {
      const s = flowSteps[i];
      if (s.status !== 'completed' && s.status !== 'cancelled') {
        return s.id;
      }
    }
    // Sıradaki kalmadı — belki önceki atlanmış varsa o
    for (let i = 0; i < idx; i++) {
      const s = flowSteps[i];
      if (s.status !== 'completed' && s.status !== 'cancelled') {
        return s.id;
      }
    }
    return null;
  };

  const handleDone = async () => {
    if (!currentTask || busy) return;
    setActionError(null);
    setBusy(true);
    // Önce bir sonraki child'ı belirle (state taze)
    const nextId = findNextChildInFlow();
    try {
      await completeTask(tenantId, currentTask.id, actor);
      // Flow içindeysek pin'i sıradaki child'a kaydır
      if (nextId) {
        setPinnedTaskId(nextId);
      } else if (pinnedTaskId === currentTask.id) {
        // Flow bittiyse pin'i temizle ki normal sıralama devreye girsin
        setPinnedTaskId(null);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Tamamlanamadı');
    } finally {
      setBusy(false);
    }
  };

  const handleSkipRequest = () => {
    if (!currentTask || busy) return;
    setSkipModalOpen(true);
  };

  const handleSkipConfirm = async (reason: SkipReason) => {
    if (!currentTask) return;
    setSkipModalOpen(false);
    setActionError(null);
    setBusy(true);
    const nextId = findNextChildInFlow();
    try {
      await skipTask(tenantId, currentTask.id, reason);
      if (nextId) {
        setPinnedTaskId(nextId);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Atlanamadı');
    } finally {
      setBusy(false);
    }
  };

  // Keyboard — Space çalışıyorsa duraklat, değilse başla/devam
  useNowKeyboard({
    onStart: isRunning ? handlePause : handleStart,
    onDone: handleDone,
    onSkip: handleSkipRequest,
    onAdd: () => setQuickAddOpen(true),
    disabled: skipModalOpen || quickAddOpen || allTasksOpen || busy,
  });

  // Panel açıkken Esc paneli kapatsın
  useEffect(() => {
    if (!allTasksOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        setAllTasksOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allTasksOpen]);


  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen admin-bg flex flex-col">
      {/* Minimal top bar: time + theme on left, panel link on right */}
      <header className="flex items-center justify-between px-6 py-5">
        <div className="font-commons text-xs text-neutral-500">
          <span className="text-neutral-700 font-medium">{timeLabel}</span>
          <span className="mx-2 text-neutral-300">·</span>
          <span>{dayName}</span>
          {theme && theme !== 'OFF' && (
            <>
              <span className="mx-2 text-neutral-300">·</span>
              <span className="uppercase tracking-wider text-neutral-500">{theme}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAllTasksOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-white/40 transition-all font-commons text-xs"
            title="Tüm görevler"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tümü</span>
          </button>

          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-white/40 transition-all font-commons text-xs"
            title="Yeni görev (N)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ekle</span>
            <span className="hidden sm:inline font-mono text-[10px] text-neutral-300 ml-0.5">N</span>
          </button>

          <Link
            to="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-white/40 transition-all font-commons text-xs"
            title="Panele dön"
          >
            <Menu className="w-3.5 h-3.5" />
            Panel
          </Link>
        </div>
      </header>

      {/* Sürekli atlanan görevler için karar bandı (varsa) */}
      <NowSkipDecisionBar items={skippedItems} />

      {/* SOP parent başlığı — sayfanın üstünde sticky, slider'ı dikey
          ortada özgür bırakır */}
      {parentFlow && allFlowSteps.length >= 1 && (
        <div className="px-6 pt-2 pb-1 text-center">
          <p className="font-commons text-[10px] uppercase tracking-[0.22em] text-neutral-400 mb-0.5">
            {parentFlow.projectName || 'Görev Akışı'}
          </p>
          <h2 className="font-commons text-sm md:text-base font-semibold text-neutral-600 leading-tight">
            {parentFlow.title}
          </h2>
          {(() => {
            const done = allFlowSteps.filter(
              (s) => s.status === 'completed' || s.status === 'cancelled'
            ).length;
            const total = allFlowSteps.length;
            return (
              <div className="mt-2 max-w-xs mx-auto">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-commons text-[10px] text-neutral-400">
                    {done}/{total} adım
                  </span>
                  <span className="font-commons text-[10px] text-emerald-600 font-medium">
                    %{Math.round((done / total) * 100)}
                  </span>
                </div>
                <div className="h-0.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(done / total) * 100}%` }}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Main centered content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        {loading ? (
          <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
        ) : error ? (
          <p className="font-commons text-sm text-rose-600">{error}</p>
        ) : !currentTask ? (
          <NowEmptyState onAdd={() => setQuickAddOpen(true)} />
        ) : (
          <>
            <AnimatePresence mode="wait">
              {parentFlow && flowSteps.length >= 1 ? (
                <NowFlowCard
                  key={`flow-${currentTask.id}`}
                  parent={parentFlow}
                  current={currentTask}
                  isRunning={isRunning}
                  onOpenTraining={setTrainingVideoId}
                />
              ) : (
                <NowTaskCard
                  key={currentTask.id}
                  item={currentTask}
                  isRunning={isRunning}
                  onOpenTraining={setTrainingVideoId}
                />
              )}
            </AnimatePresence>

            <NowControls
              isRunning={isRunning}
              isPaused={isPaused}
              busy={busy}
              onStart={handleStart}
              onPause={handlePause}
              onDone={handleDone}
              onSkip={handleSkipRequest}
            />

            {actionError && (
              <p className="mt-4 font-commons text-xs text-rose-600">{actionError}</p>
            )}
          </>
        )}
      </main>

      <SkipReasonModal
        open={skipModalOpen}
        onClose={() => setSkipModalOpen(false)}
        onSelect={handleSkipConfirm}
      />

      <NowQuickAdd
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />

      <TrainingVideoModal
        open={!!trainingVideoId}
        resourceId={trainingVideoId}
        onClose={() => setTrainingVideoId(null)}
      />

      <NowAllTasksPanel
        open={allTasksOpen}
        currentTaskId={currentTask?.id}
        scope={taskScope}
        onClose={() => setAllTasksOpen(false)}
        onSelectTask={(item) => {
          setPinnedTaskId(item.id);
          setAllTasksOpen(false);
        }}
      />
    </div>
  );
};

export default NowPage;
