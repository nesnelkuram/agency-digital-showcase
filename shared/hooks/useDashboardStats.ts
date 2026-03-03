import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useTenantId } from '@/shared/hooks/useTenant';

interface DashboardStats {
  activeProjects: number;
  pendingApprovals: number;
  urgentApprovals: number;
  teamMembers: number;
  completedThisMonth: number;
  activeTasks: number;
}

interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  time: Date;
  timeAgo: string;
}

interface PendingApproval {
  id: string;
  title: string;
  type: string;
  client: string;
  dueDate: Date;
  dueDateText: string;
  urgent: boolean;
}

interface UseDashboardStatsReturn {
  stats: DashboardStats;
  recentActivity: ActivityItem[];
  pendingApprovals: PendingApproval[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Helper to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins} dakika once`;
  } else if (diffHours < 24) {
    return `${diffHours} saat once`;
  } else if (diffDays === 1) {
    return 'dun';
  } else if (diffDays < 7) {
    return `${diffDays} gun once`;
  } else {
    return date.toLocaleDateString('tr-TR');
  }
}

// Helper to format due date
function getDueDateText(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Gecikti';
  } else if (diffDays === 0) {
    return 'Bugun';
  } else if (diffDays === 1) {
    return 'Yarin';
  } else if (diffDays < 7) {
    return `${diffDays} gun`;
  } else if (diffDays < 30) {
    return `${Math.ceil(diffDays / 7)} hafta`;
  } else {
    return date.toLocaleDateString('tr-TR');
  }
}

export function useDashboardStats(): UseDashboardStatsReturn {
  const tenantId = useTenantId();
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    pendingApprovals: 0,
    urgentApprovals: 0,
    teamMembers: 0,
    completedThisMonth: 0,
    activeTasks: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!db) {
      setError('Firestore baglantisi kurulamadi');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get first day of current month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch counts in parallel — each wrapped so one failure doesn't break the dashboard
      const safe = <T,>(p: Promise<T>, fallback: T) => p.catch((err) => { console.warn('[Dashboard] query failed:', err.message); return fallback; });

      const [
        projectsSnapshot,
        approvalsSnapshot,
        usersSnapshot,
        completedSnapshot,
        activitySnapshot,
        tasksSnapshot,
      ] = await Promise.all([
        // Active projects
        safe(getDocs(
          query(collection(db, 'projects'), where('tenantId', '==', tenantId), where('status', '==', 'active'))
        ), null),
        // Pending approvals
        safe(getDocs(
          query(collection(db, 'approvals'), where('tenantId', '==', tenantId), where('status', '==', 'pending'))
        ), null),
        // Team members (active users)
        safe(getDocs(
          query(collection(db, 'users'), where('tenantId', '==', tenantId), where('status', '==', 'active'))
        ), null),
        // Completed this month — two equality filters + client-side date filter
        safe(getDocs(
          query(
            collection(db, 'projects'),
            where('tenantId', '==', tenantId),
            where('status', '==', 'completed')
          )
        ), null),
        // Recent activity
        safe(getDocs(
          query(
            collection(db, 'activityLog'),
            where('tenantId', '==', tenantId),
            orderBy('createdAt', 'desc'),
            limit(10)
          )
        ), null),
        // Active tasks (standalone)
        safe(getDocs(
          query(
            collection(db, 'tasks'),
            where('tenantId', '==', tenantId),
            where('status', 'in', ['open', 'in_progress', 'awaiting_review', 'blocked'])
          )
        ), null),
      ]);

      // Count completed this month (client-side date filter)
      let completedThisMonth = 0;
      completedSnapshot?.forEach((doc) => {
        const data = doc.data();
        const completedAt = data.completedAt?.toDate?.() || data.completedAt;
        if (completedAt && completedAt >= firstDayOfMonth) {
          completedThisMonth++;
        }
      });

      // Count urgent approvals (due within 2 days)
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

      let urgentCount = 0;
      const approvalsList: PendingApproval[] = [];

      approvalsSnapshot?.forEach((doc) => {
        const data = doc.data();
        const dueDate = data.dueDate?.toDate?.() || new Date();
        const isUrgent = dueDate <= twoDaysFromNow;

        if (isUrgent) urgentCount++;

        approvalsList.push({
          id: doc.id,
          title: data.title || 'Isimsiz Onay',
          type: data.type || 'Diger',
          client: data.clientName || 'Bilinmeyen Musteri',
          dueDate,
          dueDateText: getDueDateText(dueDate),
          urgent: isUrgent,
        });
      });

      // Sort approvals by due date
      approvalsList.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      // Process activity log
      const activityList: ActivityItem[] = [];
      activitySnapshot?.forEach((doc) => {
        const data = doc.data();
        const time = data.createdAt?.toDate?.() || new Date();

        activityList.push({
          id: doc.id,
          user: data.userName || 'Bilinmeyen Kullanici',
          action: data.action || 'eylem gerceklestirdi',
          target: data.target || '',
          time,
          timeAgo: getTimeAgo(time),
        });
      });

      setStats({
        activeProjects: projectsSnapshot?.size || 0,
        pendingApprovals: approvalsSnapshot?.size || 0,
        urgentApprovals: urgentCount,
        teamMembers: usersSnapshot?.size || 0,
        completedThisMonth,
        activeTasks: tasksSnapshot?.size || 0,
      });

      setPendingApprovals(approvalsList.slice(0, 5));
      setRecentActivity(activityList);

    } catch (err) {
      console.error('[Dashboard] Error fetching stats:', err);
      setError('Veriler yuklenirken bir hata olustu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [tenantId]);

  return {
    stats,
    recentActivity,
    pendingApprovals,
    loading,
    error,
    refetch: fetchStats,
  };
}
