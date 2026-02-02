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

    const docRef = doc(db, 'brand_leads', leadId);
    const unsubscribe = onSnapshot(
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

    return () => unsubscribe();
  }, [leadId]);

  const now = Date.now();
  const isRunning = progress?.status === 'running' && (progress?.lockExpiresAt ?? 0) > now;
  const isStale = progress?.status === 'running' && (progress?.lockExpiresAt ?? 0) <= now;
  const isCompleted = progress?.status === 'completed';
  const isFailed = progress?.status === 'failed';

  return { progress, isRunning, isStale, isCompleted, isFailed };
}
