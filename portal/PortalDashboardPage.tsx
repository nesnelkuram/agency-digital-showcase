import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  CheckSquare,
  Share2,
  ArrowRight,
  Loader2,
  Clock,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';

interface PortalStats {
  activeProjects: number;
  pendingApprovals: number;
  contentPlans: number;
}

interface RecentItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'project' | 'approval' | 'content';
  link: string;
  createdAt: Date;
}

const PortalDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [stats, setStats] = useState<PortalStats>({ activeProjects: 0, pendingApprovals: 0, contentPlans: 0 });
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !user?.uid || !tenantId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        // Active projects for this client
        const projectsSnap = await getDocs(
          query(
            collection(db!, 'projects'),
            where('tenantId', '==', tenantId),
            where('clientId', '==', user.uid),
            where('status', 'in', ['active', 'in_progress', 'review']),
            limit(10)
          )
        );

        // Content plans pending approval
        const plansSnap = await getDocs(
          query(
            collection(db!, 'content_plans'),
            where('tenantId', '==', tenantId),
            where('status', '==', 'pending_approval'),
            orderBy('createdAt', 'desc'),
            limit(5)
          )
        );

        const items: RecentItem[] = [];

        projectsSnap.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: doc.id,
            title: data.name || 'Proje',
            subtitle: `Durum: ${data.status === 'active' ? 'Aktif' : data.status === 'review' ? 'İncelemede' : 'Devam Ediyor'}`,
            type: 'project',
            link: `/portal/projects/${doc.id}`,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          });
        });

        plansSnap.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: doc.id,
            title: data.title || 'İçerik Planı',
            subtitle: 'Onay bekliyor',
            type: 'content',
            link: `/portal/social-media/${doc.id}`,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          });
        });

        items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setStats({
          activeProjects: projectsSnap.size,
          pendingApprovals: plansSnap.size,
          contentPlans: plansSnap.size,
        });
        setRecentItems(items.slice(0, 6));
      } catch {
        // Fail silently
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.uid, tenantId]);

  const firstName = user?.displayName?.split(' ')[0] || 'Hoş geldiniz';

  const statCards = [
    {
      label: 'Aktif Proje',
      value: stats.activeProjects,
      icon: FolderKanban,
      color: 'bg-blue-50 text-blue-600',
      link: '/portal/projects',
    },
    {
      label: 'Onay Bekleyen',
      value: stats.pendingApprovals,
      icon: CheckSquare,
      color: 'bg-amber-50 text-amber-600',
      link: '/portal/approvals',
    },
    {
      label: 'İçerik Planı',
      value: stats.contentPlans,
      icon: Share2,
      color: 'bg-purple-50 text-purple-600',
      link: '/portal/social-media',
    },
  ];

  const typeIcon = {
    project: <FolderKanban className="w-4 h-4 text-blue-500" />,
    approval: <CheckSquare className="w-4 h-4 text-amber-500" />,
    content: <Share2 className="w-4 h-4 text-purple-500" />,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">
          Merhaba, {firstName} 👋
        </h1>
        <p className="font-grotesk text-neutral-500 mt-1">
          Projelerinizin durumunu takip edin ve içerikleri onaylayın.
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Link
                to={card.link}
                className="block bg-white rounded-xl border border-neutral-100 p-5 hover:border-neutral-200 hover:shadow-sm transition-all"
              >
                <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-grotesk text-3xl font-bold text-[#171717]">{card.value}</p>
                <p className="font-grotesk text-sm text-neutral-500 mt-0.5">{card.label}</p>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-white rounded-xl border border-neutral-100"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="font-grotesk text-base font-bold text-[#171717]">Son Aktiviteler</h2>
          <Clock className="w-4 h-4 text-neutral-400" />
        </div>

        {recentItems.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-grotesk text-sm text-neutral-400">Henüz aktivite yok.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {recentItems.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                to={item.link}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                  {typeIcon[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-grotesk text-sm font-medium text-[#171717] truncate">{item.title}</p>
                  <p className="font-grotesk text-xs text-neutral-500">{item.subtitle}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick Links */}
      {stats.pendingApprovals > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-grotesk font-semibold text-amber-900 text-sm">
                {stats.pendingApprovals} içerik planı onayınızı bekliyor
              </p>
              <p className="font-grotesk text-xs text-amber-700">
                İçerikleri inceleyip onaylayın veya düzeltme isteyin.
              </p>
            </div>
          </div>
          <Link
            to="/portal/social-media"
            className="flex items-center gap-1 px-4 py-2 bg-amber-600 text-white rounded-full font-grotesk text-sm hover:bg-amber-700 transition-colors flex-shrink-0"
          >
            İncele
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      )}
    </div>
  );
};

export default PortalDashboardPage;
