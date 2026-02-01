import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutGrid,
  FileText,
  Clock,
  CheckCircle,
  Plus,
  CalendarDays,
  Megaphone,
} from 'lucide-react';
import type { SocialPostSummary, SocialMediaStats } from '@/shared/types/socialMedia';
import {
  getSocialPosts,
  getProjectSocialStats,
} from '@/shared/services/socialMediaService';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';
import PostCard from './components/PostCard';

const SocialMediaDashboard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [posts, setPosts] = useState<SocialPostSummary[]>([]);
  const [stats, setStats] = useState<SocialMediaStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [statsResult, postsResult] = await Promise.all([
        getProjectSocialStats(projectId),
        getSocialPosts({ projectId }, 10),
      ]);
      setStats(statsResult);
      setPosts(postsResult.posts);
    } catch (err) {
      console.error('[SocialMediaDashboard] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = stats
    ? [
        {
          label: 'Total Posts',
          value: stats.totalPosts,
          icon: LayoutGrid,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
        },
        {
          label: 'Taslak',
          value: stats.drafts,
          icon: FileText,
          color: 'text-gray-600',
          bg: 'bg-gray-50',
        },
        {
          label: 'Planlanan',
          value: stats.scheduled,
          icon: Clock,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
        },
        {
          label: 'Yayinlanan',
          value: stats.published,
          icon: CheckCircle,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      {projectId && (
        <ProjectBreadcrumb projectId={projectId} currentPage="Sosyal Medya" />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
            Sosyal Medya
          </h1>
          <p className="font-grotesk text-neutral-600 mt-1">
            Post planlama, takvim ve icerik yonetimi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/admin/projects/${projectId}/social-media/calendar`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            <CalendarDays className="w-4 h-4" />
            Takvim
          </Link>
          <Link
            to={`/admin/projects/${projectId}/social-media/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Post
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl border border-neutral-100 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-grotesk text-neutral-500">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-grotesk font-bold text-[#171717] mt-1">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Posts */}
      <div>
        <h2 className="text-lg font-ramillas font-semibold text-[#171717] mb-4">
          Son Postlar
        </h2>

        {posts.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-100 p-12 text-center">
            <Megaphone className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <h3 className="font-ramillas text-xl font-bold text-neutral-400 mb-2">
              Henuz post yok
            </h3>
            <p className="font-grotesk text-neutral-400 mb-6 max-w-md mx-auto">
              Ilk sosyal medya postunuzu olusturarak baslayabilirsiniz.
            </p>
            <Link
              to={`/admin/projects/${projectId}/social-media/new`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Yeni Post Olustur
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <PostCard post={post} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialMediaDashboard;
