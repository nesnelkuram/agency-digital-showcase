import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  writeBatch,
  doc,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';

export type NotificationType =
  | 'approval_pending'
  | 'new_lead'
  | 'workflow_step'
  | 'mention'
  | 'social_media'
  | 'system';

export interface AppNotification {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

const TYPE_ICONS: Record<NotificationType, string> = {
  approval_pending: '✅',
  new_lead: '🎯',
  workflow_step: '⚙️',
  mention: '💬',
  social_media: '📱',
  system: '🔔',
};

export function getNotificationIcon(type: NotificationType): string {
  return TYPE_ICONS[type] || '🔔';
}

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !user?.uid) {
      setLoading(false);
      return;
    }

    // Defer subscription by one tick so React 18 StrictMode's synchronous
    // mount→cleanup→mount cycle cancels the first timer before it fires,
    // preventing the rapid subscribe/unsubscribe that corrupts Firestore's
    // internal watch-stream target state (SDK bug: ID b815/ca9, ve=-1).
    let cancelled = false;
    let unsubFn: (() => void) | undefined;

    const timer = setTimeout(() => {
      if (cancelled) return;

      const q = query(
        collection(db, 'notifications'),
        where('tenantId', '==', tenantId),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      unsubFn = onSnapshot(q, (snapshot) => {
        const items: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: docSnap.id,
            tenantId: data.tenantId,
            userId: data.userId,
            type: data.type || 'system',
            title: data.title || '',
            message: data.message || '',
            link: data.link,
            read: data.read ?? false,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          });
        });
        setNotifications(items);
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
  }, [user?.uid, tenantId]);

  const markAsRead = useCallback(async (id: string) => {
    if (!db) return;
    await updateDoc(doc(db, 'notifications', id), { read: true });
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!db) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
}
