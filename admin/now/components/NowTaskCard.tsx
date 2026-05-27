import React from 'react';
import { motion } from 'framer-motion';
import { Clock, HelpCircle, Timer } from 'lucide-react';
import { useElapsed } from '@/shared/hooks/useElapsed';
import type { UnifiedTaskItem } from '@/shared/types/task';

interface NowTaskCardProps {
  item: UnifiedTaskItem;
  isRunning: boolean;            // true when status === 'in_progress'
  onOpenTraining?: (resourceId: string) => void;
}

const NowTaskCard: React.FC<NowTaskCardProps> = ({ item, isRunning, onOpenTraining }) => {
  const task = item.task;
  const estimatedHours = task?.estimatedHours;
  const estimatedMinutes =
    task?.estimatedMinutes ?? (estimatedHours ? Math.round(estimatedHours * 60) : null);
  const rationale = task?.aiScoreRationale?.trim();
  const stepNo = typeof task?.sortOrder === 'number' ? task.sortOrder + 1 : null;
  const trainingId = task?.linkedTrainingResourceId;

  // Canlı sayaç — BAŞLA bastıktan sonra; paused iken sabit
  const isPaused = task?.status === 'paused';
  const elapsed = useElapsed(
    task?.startedAt,
    isRunning,
    task?.accumulatedSeconds ?? 0
  );
  const overEstimate = estimatedMinutes && elapsed.seconds > estimatedMinutes * 60;
  const showTimer = (isRunning || isPaused) && (elapsed.seconds > 0 || isRunning);

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="w-full max-w-3xl px-6 text-center"
    >
      {/* Project + (varsa) SOP adım rozeti */}
      {(item.projectName || stepNo) && (
        <p className="font-commons text-xs uppercase tracking-[0.18em] text-neutral-400 mb-6 flex items-center justify-center gap-2">
          {item.projectName && <span>{item.projectName}</span>}
          {item.projectName && stepNo && <span className="text-neutral-300">·</span>}
          {stepNo && (
            <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 text-[10px] tracking-wider">
              ADIM {stepNo}
            </span>
          )}
        </p>
      )}

      {/* The task title — devasa */}
      <h1
        className="font-commons font-semibold text-[#171717] leading-[1.08] tracking-tight"
        style={{
          fontSize: 'clamp(2rem, 5.5vw, 4rem)',
        }}
      >
        {item.title}
      </h1>

      {/* AI rationale — neden bu işi şimdi? */}
      {rationale && (
        <p className="mt-6 font-commons text-sm italic text-neutral-500 max-w-xl mx-auto leading-relaxed">
          {rationale}
        </p>
      )}

      {/* Süre / canlı sayaç + eğitim videosu */}
      {(estimatedMinutes || showTimer || trainingId) && (
        <div className="mt-6 flex items-center justify-center gap-3 text-neutral-400">
          {showTimer ? (
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
                isPaused
                  ? 'bg-amber-50 text-amber-700'
                  : overEstimate
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <Timer className="w-4 h-4" />
              <span className="font-mono text-base tabular-nums font-medium">
                {elapsed.mmss}
              </span>
              {isPaused && (
                <span className="font-commons text-xs font-medium">duraklatıldı</span>
              )}
              {!isPaused && estimatedMinutes && (
                <span className="font-commons text-xs opacity-70">
                  / {estimatedMinutes}dk
                </span>
              )}
            </span>
          ) : (
            estimatedMinutes && (
              <span className="inline-flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-commons text-sm">{estimatedMinutes} dk</span>
              </span>
            )
          )}
          {trainingId && onOpenTraining && (
            <>
              <span className="w-1 h-1 rounded-full bg-neutral-300" />
              <button
                type="button"
                onClick={() => onOpenTraining(trainingId)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors font-commons text-xs"
                title="Bu adım için eğitim videosu"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Nasıl yapılır?
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default NowTaskCard;
