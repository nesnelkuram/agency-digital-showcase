import React from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  CheckSquare,
  Users,
  TrendingUp,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/shared/hooks/usePermission';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin, isStaff } = usePermission();

  const stats = [
    {
      label: 'Aktif Projeler',
      value: '12',
      change: '+2',
      changeType: 'positive' as const,
      icon: <FolderKanban className="w-6 h-6" />,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Bekleyen Onaylar',
      value: '5',
      change: '3 acil',
      changeType: 'warning' as const,
      icon: <CheckSquare className="w-6 h-6" />,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Takim Uyeleri',
      value: '8',
      change: '+1 bu ay',
      changeType: 'positive' as const,
      icon: <Users className="w-6 h-6" />,
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Bu Ay Tamamlanan',
      value: '24',
      change: '%15 artis',
      changeType: 'positive' as const,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  const recentActivity = [
    {
      user: 'Ahmet Yilmaz',
      action: 'yeni proje olusturdu',
      target: 'ABC Restoran Sosyal Medya',
      time: '2 saat once',
    },
    {
      user: 'Ayse Demir',
      action: 'icerik onayladi',
      target: 'XYZ Cafe Instagram Post',
      time: '3 saat once',
    },
    {
      user: 'Mehmet Kaya',
      action: 'dosya yukledi',
      target: 'Logo Tasarimi v2.png',
      time: '5 saat once',
    },
    {
      user: 'Fatma Ozturk',
      action: 'egitimi tamamladi',
      target: 'Sosyal Medya Yonetimi 101',
      time: 'dun',
    },
  ];

  const pendingApprovals = [
    {
      title: 'ABC Restoran - Haftalik Post Plani',
      type: 'Paylasim Plani',
      client: 'ABC Restoran',
      dueDate: 'Yarin',
      urgent: true,
    },
    {
      title: 'XYZ Cafe - Story Tasarimlari',
      type: 'Tasarim',
      client: 'XYZ Cafe',
      dueDate: '3 gun',
      urgent: false,
    },
    {
      title: 'DEF Hotel - Reklam Filmi',
      type: 'Video',
      client: 'DEF Hotel',
      dueDate: '1 hafta',
      urgent: false,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
            Hos geldin, {user?.displayName?.split(' ')[0] || 'User'}!
          </h1>
          <p className="font-grotesk text-neutral-600 mt-1">
            Bugun neler var, bir bakalim.
          </p>
        </div>
        <div className="flex gap-2">
          <motion.a
            href="/admin/projects"
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
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl p-7 shadow-sm border border-neutral-100"
          >
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-lg ${stat.color}`}>{stat.icon}</div>
              <span
                className={`text-xs font-grotesk font-medium px-2 py-1 rounded-full ${
                  stat.changeType === 'positive'
                    ? 'bg-green-50 text-green-600'
                    : stat.changeType === 'warning'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-neutral-50 text-neutral-600'
                }`}
              >
                {stat.change}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-ramillas font-bold text-[#171717]">
                {stat.value}
              </p>
              <p className="font-grotesk text-sm text-neutral-500 mt-1">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-neutral-100"
        >
          <div className="p-7 border-b border-neutral-100">
            <h2 className="font-ramillas text-xl font-bold text-[#171717]">
              Son Aktiviteler
            </h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {recentActivity.map((activity, index) => (
              <div key={index} className="p-5 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#fffceb] flex items-center justify-center flex-shrink-0">
                    <span className="font-grotesk font-bold text-[#171717]">
                      {activity.user.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-grotesk text-sm text-[#171717]">
                      <span className="font-semibold">{activity.user}</span>{' '}
                      {activity.action}:{' '}
                      <span className="font-medium text-neutral-700">{activity.target}</span>
                    </p>
                    <p className="font-grotesk text-xs text-neutral-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {activity.time}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-5 border-t border-neutral-100">
            <a
              href="/admin/activity"
              className="font-grotesk text-sm text-neutral-600 hover:text-[#171717] transition-colors"
            >
              Tum aktiviteleri gor →
            </a>
          </div>
        </motion.div>

        {/* Pending Approvals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-sm border border-neutral-100"
        >
          <div className="p-7 border-b border-neutral-100">
            <h2 className="font-ramillas text-xl font-bold text-[#171717]">
              Bekleyen Onaylar
            </h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {pendingApprovals.map((approval, index) => (
              <div key={index} className="p-5 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-grotesk text-sm font-medium text-[#171717] truncate">
                      {approval.title}
                    </p>
                    <p className="font-grotesk text-xs text-neutral-500 mt-1">
                      {approval.type} • {approval.client}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-grotesk font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                      approval.urgent
                        ? 'bg-red-50 text-red-600'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {approval.dueDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-5 border-t border-neutral-100">
            <a
              href="/admin/approvals"
              className="font-grotesk text-sm text-neutral-600 hover:text-[#171717] transition-colors"
            >
              Tum onaylari gor →
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;
