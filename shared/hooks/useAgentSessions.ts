import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';

export interface SessionSummary {
  id: string;
  title: string | null;
  updatedAt: number;
  messageCount: number;
}

interface UseAgentSessionsReturn {
  sessions: SessionSummary[];
  loading: boolean;
  loadSession: <T = unknown>(sessionId: string) => Promise<T | null>;
}

export function useAgentSessions(collectionName: string): UseAgentSessionsReturn {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !user?.uid || !tenantId) {
      setLoading(false);
      return;
    }

    // Defer subscription by one tick — React 18 StrictMode protection
    // (same pattern as useNotifications.ts)
    let cancelled = false;
    let unsubFn: (() => void) | undefined;

    const timer = setTimeout(() => {
      if (cancelled) return;

      const q = query(
        collection(db, collectionName),
        where('tenantId', '==', tenantId),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc'),
        limit(20)
      );

      unsubFn = onSnapshot(q, (snapshot) => {
        const items: SessionSummary[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const messages = data.messages || [];
          // Filter out sessions with 0 messages (never started)
          if (messages.length === 0) return;
          items.push({
            id: docSnap.id,
            title: data.title || null,
            updatedAt: data.updatedAt || data.createdAt || 0,
            messageCount: messages.length,
          });
        });
        setSessions(items);
        setLoading(false);
      }, () => {
        setLoading(false);
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubFn?.();
    };
  }, [user?.uid, tenantId, collectionName]);

  const loadSession = useCallback(async <T = unknown>(sessionId: string): Promise<T | null> => {
    if (!db) return null;
    const docSnap = await getDoc(doc(db, collectionName, sessionId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as T;
  }, [collectionName]);

  return { sessions, loading, loadSession };
}
