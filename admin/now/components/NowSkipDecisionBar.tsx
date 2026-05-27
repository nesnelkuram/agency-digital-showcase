import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronDown, ChevronUp, Trash2, Clock, UserCheck, Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { updateTask } from '@/shared/services/taskService';
import { useTenantId } from '@/shared/hooks/useTenant';
import type { UnifiedTaskItem } from '@/shared/types/task';

interface NowSkipDecisionBarProps {
  items: UnifiedTaskItem[];
}

const SNOOZE_DAYS = 7;

const NowSkipDecisionBar: React.FC<NowSkipDecisionBarProps> = ({ items }) => {
  const tenantId = useTenantId();
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) return null;

  const act = async (
    taskId: string,
    action: 'snooze' | 'cancel' | 'delegate',
    suggestedAssigneeId?: string,
    suggestedAssigneeName?: string
  ) => {
    setBusyId(taskId);
    try {
      if (action === 'snooze') {
        const until = new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000);
        await updateTask(tenantId, taskId, {
          snoozedUntil: Timestamp.fromDate(until),
        });
      } else if (action === 'cancel') {
        await updateTask(tenantId, taskId, { status: 'cancelled' });
      } else if (action === 'delegate') {
        if (suggestedAssigneeId) {
          await updateTask(tenantId, taskId, {
            assigneeId: suggestedAssigneeId,
            assigneeName: suggestedAssigneeName,
            delegationApproved: true,
            // skipCount sıfırla — başka birine geçtikten sonra temiz başla
            skipCount: 0,
          });
        } else {
          // Önerilen kişi yoksa snooze gibi davran — kullanıcı detay panelinde elle atayacak
          const until = new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000);
          await updateTask(tenantId, taskId, {
            snoozedUntil: Timestamp.fromDate(until),
          });
        }
      }
    } catch (err) {
      console.error('[NowSkipDecisionBar] action failed:', err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-6 mt-2 rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-100/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-amber-800">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="font-commons text-xs">
            {items.length} görevi 3+ kez atladın — karar ver:
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 space-y-1">
              {items.map((item) => {
                const t = item.task;
                const skips = t?.skipCount ?? 0;
                const lastReason = t?.lastSkipReason;
                const canDelegate = Boolean(t?.suggestedAssigneeId);
                const isBusy = busyId === item.id;

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/60"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-commons text-xs text-neutral-700 truncate">
                        {item.title}
                      </p>
                      <p className="font-commons text-[10px] text-neutral-400">
                        {skips} kez atlandı
                        {lastReason && ` · son sebep: ${lastReason}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          act(
                            item.id,
                            'delegate',
                            t?.suggestedAssigneeId,
                            t?.suggestedAssigneeName
                          )
                        }
                        disabled={isBusy}
                        title={canDelegate ? `Devret: ${t?.suggestedAssigneeName}` : '7 gün sonra hatırlat'}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-commons text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        <UserCheck className="w-3 h-3" />
                        {canDelegate ? 'Devret' : 'Sonra'}
                      </button>
                      <button
                        type="button"
                        onClick={() => act(item.id, 'snooze')}
                        disabled={isBusy}
                        title="7 gün sonra hatırlat"
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-commons text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        <Clock className="w-3 h-3" />
                        7g
                      </button>
                      <button
                        type="button"
                        onClick={() => act(item.id, 'cancel')}
                        disabled={isBusy}
                        title="İptal et — yapılmayacak"
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-commons text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Sil
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default NowSkipDecisionBar;
