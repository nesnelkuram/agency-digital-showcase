import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  CheckSquare,
  Users,
  TrendingUp,
  Clock,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/shared/hooks/useDashboardStats';
import DashboardTaskWidget from '@/admin/tasks/components/DashboardTaskWidget';


const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { stats, recentActivity, pendingApprovals, loading: statsLoading } = useDashboardStats();

  const statCards = [
    {
      label: 'Aktif Projeler',
      value: statsLoading ? '-' : String(stats.activeProjects),
      change: null,
      changeType: 'positive' as const,
      icon: <FolderKanban className="w-6 h-6" />,
      color: 'bg-blue-50 text-blue-600',
      href: '/admin/projects',
    },
    {
      label: 'Bekleyen Onaylar',
      value: statsLoading ? '-' : String(stats.pendingApprovals),
      change: stats.urgentApprovals > 0 ? `${stats.urgentApprovals} acil` : null,
      changeType: 'warning' as const,
      icon: <CheckSquare className="w-6 h-6" />,
      color: 'bg-amber-50 text-amber-600',
      href: '/admin/approvals',
    },
    {
      label: 'Takim Uyeleri',
      value: statsLoading ? '-' : String(stats.teamMembers),
      change: null,
      changeType: 'positive' as const,
      icon: <Users className="w-6 h-6" />,
      color: 'bg-green-50 text-green-600',
      href: '/admin/settings/users',
    },
    {
      label: 'Bu Ay Tamamlanan',
      value: statsLoading ? '-' : String(stats.completedThisMonth),
      change: null,
      changeType: 'positive' as const,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'bg-purple-50 text-purple-600',
      href: '/admin/projects',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Hos geldin, {user?.displayName?.split(' ')[0] || 'User'}!
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1">
            Bugun neler var, bir bakalim.
          </p>
        </div>
        <div className="flex gap-2">
          <motion.a
            href="/admin/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Yeni Proje
            <ArrowRight className="w-4 h-4" />
          </motion.a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.a
            key={stat.label}
            href={stat.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="admin-stat-card block hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-xl ${stat.color}`}>{stat.icon}</div>
              {stat.change && (
                <span
                  className={`text-xs font-grotesk font-medium px-2.5 py-1 rounded-full backdrop-blur-sm ${
                    stat.changeType === 'positive'
                      ? 'bg-green-500/10 text-green-600'
                      : stat.changeType === 'warning'
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-neutral-500/10 text-neutral-600'
                  }`}
                >
                  {stat.change}
                </span>
              )}
            </div>
            <div className="mt-5">
              {statsLoading ? (
                <div className="h-9 w-16 bg-neutral-200 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-grotesk font-bold text-[#1a1a2e]">
                  {stat.value}
                </p>
              )}
              <p className="font-grotesk text-sm text-neutral-500 mt-1">{stat.label}</p>
            </div>
          </motion.a>
        ))}
      </div>

      {/* My Tasks — AI Unified Widget */}
      <DashboardTaskWidget />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 admin-card p-0"
        >
          <div className="p-7 border-b border-neutral-100">
            <h2 className="font-grotesk text-xl font-bold text-[#171717]">
              Son Aktiviteler
            </h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {statsLoading && (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-5 animate-pulse flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-neutral-200 rounded w-3/4" />
                      <div className="h-3 bg-neutral-100 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </>
            )}
            {!statsLoading && recentActivity.length === 0 && (
              <div className="p-10 text-center">
                <p className="font-grotesk text-sm text-neutral-400">Henuz aktivite yok</p>
              </div>
            )}
            {!statsLoading && recentActivity.map((activity) => (
              <div key={activity.id} className="p-5 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#fffceb] flex items-center justify-center flex-shrink-0">
                    <span className="font-grotesk font-bold text-[#171717]">
                      {activity.user.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-grotesk text-sm text-[#171717]">
                      <span className="font-semibold">{activity.user}</span>{' '}
                      {activity.action}
                      {activity.target && (
                        <>: <span className="font-medium text-neutral-700">{activity.target}</span></>
                      )}
                    </p>
                    <p className="font-grotesk text-xs text-neutral-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {activity.timeAgo}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pending Approvals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="admin-card p-0"
        >
          <div className="p-7 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="font-grotesk text-xl font-bold text-[#171717]">
              Bekleyen Onaylar
            </h2>
            {stats.urgentApprovals > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-full font-grotesk text-xs font-medium">
                <AlertTriangle className="w-3 h-3" />
                {stats.urgentApprovals} acil
              </span>
            )}
          </div>
          <div className="divide-y divide-neutral-100">
            {statsLoading && (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-5 animate-pulse">
                    <div className="space-y-2">
                      <div className="h-4 bg-neutral-200 rounded w-3/4" />
                      <div className="h-3 bg-neutral-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </>
            )}
            {!statsLoading && pendingApprovals.length === 0 && (
              <div className="p-10 text-center">
                <CheckSquare className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                <p className="font-grotesk text-sm text-neutral-400">Bekleyen onay yok</p>
              </div>
            )}
            {!statsLoading && pendingApprovals.map((approval) => (
              <Link
                key={approval.id}
                to="/admin/approvals"
                className="block p-5 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-grotesk text-sm font-medium text-[#171717] truncate">
                      {approval.title}
                    </p>
                    <p className="font-grotesk text-xs text-neutral-500 mt-1">
                      {approval.type} &bull; {approval.client}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-grotesk font-medium px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                      approval.urgent
                        ? 'bg-red-50 text-red-600'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {approval.dueDateText}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="p-5 border-t border-neutral-100">
            <Link
              to="/admin/approvals"
              className="font-grotesk text-sm text-neutral-600 hover:text-[#171717] transition-colors"
            >
              Tum onaylari gor &rarr;
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;
