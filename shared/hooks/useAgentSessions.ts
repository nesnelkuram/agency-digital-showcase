import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
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
  error: string | null;
  refresh: () => void;
  loadSession: <T = unknown>(sessionId: string) => Promise<T | null>;
}

export function useAgentSessions(collectionName: string): UseAgentSessionsReturn {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const fetchSessions = useCallback(async () => {
    if (!db || !user?.uid || !tenantId) {
      setLoading(false);
      return;
    }

    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      // Two equality filters — no composite index needed (zig-zag merge).
      // Sort + limit applied client-side to avoid orderBy composite index requirement.
      const q = query(
        collection(db, collectionName),
        where('tenantId', '==', tenantId),
        where('userId', '==', user.uid)
      );

      const snapshot = await getDocs(q);
      if (id !== fetchIdRef.current) return; // stale

      const items: SessionSummary[] = [];
      console.log('[useAgentSessions] snapshot size:', snapshot.size);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const messages = data.messages || [];
        console.log('[useAgentSessions] doc:', docSnap.id, 'messages type:', typeof data.messages, 'isArray:', Array.isArray(data.messages), 'length:', messages.length, 'keys:', Object.keys(data));
        items.push({
          id: docSnap.id,
          title: data.title || null,
          updatedAt: data.updatedAt || data.createdAt || 0,
          messageCount: messages.length,
        });
      });

      // Client-side sort by updatedAt DESC, take 20
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      setSessions(items.slice(0, 20));
    } catch (err: any) {
      if (id !== fetchIdRef.current) return;
      console.error('[useAgentSessions] fetch error:', err);
      setError(err.message || 'Oturumlar yuklenemedi');
    } finally {
      if (id === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [user?.uid, tenantId, collectionName]);

  // Fetch on mount and when deps change
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const loadSession = useCallback(async <T = unknown>(sessionId: string): Promise<T | null> => {
    if (!db) return null;
    const docSnap = await getDoc(doc(db, collectionName, sessionId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as T;
  }, [collectionName]);

  return { sessions, loading, error, refresh: fetchSessions, loadSession };
}
