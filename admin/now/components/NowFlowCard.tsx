import React from 'react';
import { motion } from 'framer-motion';
import { Clock, HelpCircle, Check, Timer } from 'lucide-react';
import { useFlowSteps } from '@/shared/hooks/useFlowSteps';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useElapsed } from '@/shared/hooks/useElapsed';
import type { Task, UnifiedTaskItem } from '@/shared/types/task';

interface NowFlowCardProps {
  parent: UnifiedTaskItem;          // ana görev (SOP parent)
  current: UnifiedTaskItem;          // şu an aktif adım
  isRunning: boolean;
  onOpenTraining?: (resourceId: string) => void;
}

const isCompleted = (s: { status: string }) =>
  s.status === 'completed' || s.status === 'cancelled';

// Her slide tam genişlik — viewport'a göre ayarlanıyor
// (viewport-relative değerler runtime'da CSS'le hesaplanır)

const NowFlowCard: React.FC<NowFlowCardProps> = ({
  parent,
  current,
  isRunning,
  onOpenTraining,
}) => {
  const tenantId = useTenantId();
  const allSteps: Task[] = useFlowSteps(tenantId, parent.id);
  const steps = allSteps.length > 0 ? allSteps : current.task ? [current.task as Task] : [];

  const activeIndex = Math.max(0, steps.findIndex((s) => s.id === current.id));
  const total = steps.length;
  const doneCount = steps.filter(isCompleted).length;

  // Canlı sayaç — paused iken sabit, in_progress iken tick eder
  const currentTask = current.task as Task | undefined;
  const isPaused = currentTask?.status === 'paused';
  const elapsed = useElapsed(
    currentTask?.startedAt,
    isRunning,
    currentTask?.accumulatedSeconds ?? 0
  );
  const estimated = currentTask?.estimatedMinutes ?? null;
  const overEstimate = estimated && elapsed.seconds > estimated * 60;
  const showTimer = (isRunning || isPaused) && (elapsed.seconds > 0 || isRunning);

  return (
    <motion.div
      key={current.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="w-full"
    >
      {/* Parent header ve ilerleme barı NowPage seviyesinde absolute olarak yaşıyor.
          Burada sadece slider — sayfa dikey ortasında durur. */}

      {/* TEXT SLIDER */}
      <div
        className="relative overflow-hidden"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)',
        }}
      >
        <motion.div
          className="flex items-center"
          initial={false}
          animate={{
            // Slide genişliği = 45vw, aktif slot tam ortada
            x: `calc(50vw - ${(activeIndex + 0.5) * 45}vw)`,
          }}
          transition={{ type: 'spring', damping: 28, stiffness: 160 }}
        >
          {steps.map((step, idx) => {
            const distance = idx - activeIndex;
            const isActive = distance === 0;
            const done = isCompleted(step);

            // Yan slide'lar daha küçük ve silik
            const opacity = isActive
              ? 1
              : Math.abs(distance) === 1
              ? 0.5
              : Math.abs(distance) === 2
              ? 0.22
              : 0.08;
            const scale = isActive ? 1 : 0.55 - Math.min(0.08, Math.abs(distance) * 0.04);

            const isCurrent = step.id === current.id;
            const trainingId = isCurrent ? step.linkedTrainingResourceId : undefined;
            const rationale = isCurrent ? step.aiScoreRationale?.trim() : undefined;
            const estMin = step.estimatedMinutes ?? null;
            // Sayaç aktif step için (paused da dahil — sabit gösterilir)
            const showLiveTimer = isCurrent && showTimer;

            return (
              <motion.div
                key={step.id}
                className="flex-shrink-0 flex flex-col items-center justify-center text-center px-6"
                style={{ width: '45vw' }}
                animate={{ opacity, scale }}
                transition={{ type: 'spring', damping: 24, stiffness: 160 }}
              >
                {/* Adım rozeti */}
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : isActive
                        ? 'bg-violet-500 text-white ring-4 ring-violet-100'
                        : 'bg-neutral-200 text-neutral-500'
                    }`}
                  >
                    {done ? (
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    ) : (
                      <span className="font-mono text-[11px] font-medium">{idx + 1}</span>
                    )}
                  </div>
                  <p
                    className={`font-commons text-[10px] uppercase tracking-[0.18em] ${
                      done ? 'text-emerald-600' : isActive ? 'text-violet-500' : 'text-neutral-400'
                    }`}
                  >
                    {done ? 'Tamamlandı' : `Adım ${idx + 1}`}
                  </p>
                </div>

                {/* Başlık — daha kompakt */}
                <h1
                  className={`font-commons font-semibold leading-[1.1] tracking-tight max-w-3xl ${
                    done ? 'text-neutral-500 line-through' : 'text-[#171717]'
                  }`}
                  style={{
                    fontSize: 'clamp(1.25rem, 3.2vw, 2.5rem)',
                  }}
                >
                  {step.title}
                </h1>

                {/* Aktif slide'da ekstra meta */}
                {isCurrent && rationale && (
                  <p className="mt-5 font-commons text-sm italic text-neutral-500 max-w-xl leading-relaxed">
                    {rationale}
                  </p>
                )}
                {(estMin || showLiveTimer || (isCurrent && trainingId)) && (
                  <div className="mt-5 flex items-center justify-center gap-3 text-neutral-400">
                    {showLiveTimer ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
                          isPaused
                            ? 'bg-amber-50 text-amber-700'
                            : overEstimate
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        <Timer className="w-3.5 h-3.5" />
                        <span className="font-mono text-sm tabular-nums font-medium">
                          {elapsed.mmss}
                        </span>
                        {isPaused && (
                          <span className="font-commons text-[10px] font-medium">duraklatıldı</span>
                        )}
                        {!isPaused && estMin && (
                          <span className="font-commons text-[10px] opacity-70">
                            / {estMin}dk
                          </span>
                        )}
                      </span>
                    ) : (
                      estMin && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="font-commons text-xs tabular-nums">
                            {estMin} dk
                          </span>
                        </span>
                      )
                    )}
                    {isCurrent && trainingId && onOpenTraining && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-neutral-300" />
                        <button
                          type="button"
                          onClick={() => onOpenTraining(trainingId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors font-commons text-xs"
                          title="Bu adım için eğitim videosu"
                        >
                          <HelpCircle className="w-3 h-3" />
                          Nasıl yapılır?
                        </button>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default NowFlowCard;
