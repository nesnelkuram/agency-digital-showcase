import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { PipelineRunDoc } from '@/shared/types/pipelineRun';

interface UseAnalysisProgressReturn {
  progress: PipelineRunDoc | null;
  isRunning: boolean;
  isStale: boolean;
  isCompleted: boolean;
  isFailed: boolean;
}

/**
 * Real-time Firestore listener for pipeline progress.
 * Listens to brand_leads/{leadId}.pipelineRun field.
 * Updates automatically whenever backend writes a checkpoint.
 */
export function useAnalysisProgress(leadId: string | null | undefined): UseAnalysisProgressReturn {
  const [progress, setProgress] = useState<PipelineRunDoc | null>(null);

  useEffect(() => {
    if (!leadId || !db) {
      setProgress(null);
      return;
    }

    // Defer subscription by one tick — prevents React 18 StrictMode's
    // double-mount from creating a rapid subscribe/unsubscribe pair that
    // corrupts the Firestore SDK's internal watch-stream state (ve=-1).
    let cancelled = false;
    let unsubFn: (() => void) | undefined;

    const timer = setTimeout(() => {
      if (cancelled) return;

      const docRef = doc(db, 'brand_leads', leadId);
      unsubFn = onSnapshot(
        docRef,
        (snapshot) => {
          const data = snapshot.data();
          const pipelineRun = data?.pipelineRun as PipelineRunDoc | undefined;
          setProgress(pipelineRun || null);
        },
        (error) => {
          console.error('[useAnalysisProgress] Listener error:', error);
          // Don't set progress to null on error — keep last known state
        },
      );
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubFn?.();
    };
  }, [leadId]);

  const now = Date.now();
  const isRunning = progress?.status === 'running' && (progress?.lockExpiresAt ?? 0) > now;
  const isStale = progress?.status === 'running' && (progress?.lockExpiresAt ?? 0) <= now;
  const isCompleted = progress?.status === 'completed';
  const isFailed = progress?.status === 'failed';

  return { progress, isRunning, isStale, isCompleted, isFailed };
}
