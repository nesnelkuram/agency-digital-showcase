import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface DashboardStats {
  activeProjects: number;
  pendingApprovals: number;
  urgentApprovals: number;
  teamMembers: number;
  completedThisMonth: number;
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
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    pendingApprovals: 0,
    urgentApprovals: 0,
    teamMembers: 0,
    completedThisMonth: 0,
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

      // Fetch counts in parallel
      const [
        projectsSnapshot,
        approvalsSnapshot,
        usersSnapshot,
        completedSnapshot,
        activitySnapshot,
      ] = await Promise.all([
        // Active projects
        getDocs(
          query(collection(db, 'projects'), where('status', '==', 'active'))
        ),
        // Pending approvals
        getDocs(
          query(collection(db, 'approvals'), where('status', '==', 'pending'))
        ),
        // Team members (active users)
        getDocs(
          query(collection(db, 'users'), where('status', '==', 'active'))
        ),
        // Completed this month
        getDocs(
          query(
            collection(db, 'projects'),
            where('status', '==', 'completed'),
            where('completedAt', '>=', Timestamp.fromDate(firstDayOfMonth))
          )
        ),
        // Recent activity
        getDocs(
          query(
            collection(db, 'activityLog'),
            orderBy('createdAt', 'desc'),
            limit(10)
          )
        ),
      ]);

      // Count urgent approvals (due within 2 days)
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

      let urgentCount = 0;
      const approvalsList: PendingApproval[] = [];

      approvalsSnapshot.forEach((doc) => {
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
      activitySnapshot.forEach((doc) => {
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
        activeProjects: projectsSnapshot.size,
        pendingApprovals: approvalsSnapshot.size,
        urgentApprovals: urgentCount,
        teamMembers: usersSnapshot.size,
        completedThisMonth: completedSnapshot.size,
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
  }, []);

  return {
    stats,
    recentActivity,
    pendingApprovals,
    loading,
    error,
    refetch: fetchStats,
  };
}
