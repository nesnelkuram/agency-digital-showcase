import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  ClipboardList,
  FileText,
  Clock,
  CheckCircle,
  LayoutGrid,
  Film,
} from 'lucide-react';
import type { SocialPostSummary, SocialMediaStats } from '@/shared/types/socialMedia';
import {
  POST_TYPE_COLORS,
  POST_TYPE_LABELS,
  POST_STATUS_LABELS,
  POST_STATUS_COLORS,
  SOCIAL_PLATFORM_LABELS,
} from '@/shared/types/socialMedia';
import { getSocialPostsByDate, getProjectSocialStats } from '@/shared/services/socialMediaService';
import { getProject } from '@/shared/services/projectService';
import { useTenantId } from '@/shared/hooks/useTenant';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';
import CreatePostPanel from './components/CreatePostPanel';

const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'];

const MONTH_LABELS = [
  'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
  'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const SocialMediaCalendar: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const tenantId = useTenantId();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [posts, setPosts] = useState<SocialPostSummary[]>([]);
  const [stats, setStats] = useState<SocialMediaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // CreatePostPanel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<Date | undefined>();

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [postsResult, project, statsResult] = await Promise.all([
        getSocialPostsByDate(tenantId, projectId, currentMonth, currentYear),
        getProject(tenantId, projectId),
        getProjectSocialStats(tenantId, projectId),
      ]);
      setPosts(postsResult);
      setStats(statsResult);
      if (project) {
        setProjectName(project.name);
      }
    } catch (err) {
      console.error('[SocialMediaCalendar] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, projectId, currentMonth, currentYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
    setSelectedDay(null);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfWeek(currentYear, currentMonth);

  const postsByDay: Record<number, SocialPostSummary[]> = useMemo(() => {
    const result: Record<number, SocialPostSummary[]> = {};
    posts.forEach((post) => {
      if (post.scheduledAt) {
        const date = post.scheduledAt.toDate();
        const day = date.getDate();
        if (!result[day]) {
          result[day] = [];
        }
        result[day].push(post);
      }
    });
    return result;
  }, [posts]);

  const selectedDayPosts = selectedDay ? postsByDay[selectedDay] || [] : [];

  const today = new Date();
  const isCurrentMonthYear =
    today.getMonth() + 1 === currentMonth && today.getFullYear() === currentYear;
  const todayDate = today.getDate();

  const handleDayClick = (day: number) => {
    const dayPosts = postsByDay[day] || [];
    if (dayPosts.length > 0) {
      // Toggle detail panel for days with posts
      setSelectedDay(selectedDay === day ? null : day);
    } else {
      // Open create panel for empty days
      const clickedDate = new Date(currentYear, currentMonth - 1, day, 10, 0);
      setPrefillDate(clickedDate);
      setPanelOpen(true);
    }
  };

  const handleNewPost = () => {
    setPrefillDate(undefined);
    setPanelOpen(true);
  };

  const handlePostCreated = () => {
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      {projectId && (
        <ProjectBreadcrumb projectId={projectId} currentPage="Sosyal Medya" />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Icerik Takvimi
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1">
            Postlari planlayip takvim uzerinde yonetin
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/admin/projects/${projectId}/social-media/plans`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            Icerik Planlari
          </Link>
          <Link
            to={`/admin/projects/${projectId}/social-media/dashboard`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            Dashboard
          </Link>
          <button
            onClick={handleNewPost}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Post
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="flex items-center gap-6 bg-white rounded-xl border border-neutral-100 px-6 py-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-indigo-500" />
            <span className="font-grotesk text-sm text-neutral-600">
              <span className="font-semibold text-[#171717]">{stats.totalPosts}</span> toplam
            </span>
          </div>
          <div className="w-px h-5 bg-neutral-200" />
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="font-grotesk text-sm text-neutral-600">
              <span className="font-semibold text-[#171717]">{stats.drafts}</span> taslak
            </span>
          </div>
          <div className="w-px h-5 bg-neutral-200" />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="font-grotesk text-sm text-neutral-600">
              <span className="font-semibold text-[#171717]">{stats.scheduled}</span> planlanan
            </span>
          </div>
          <div className="w-px h-5 bg-neutral-200" />
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="font-grotesk text-sm text-neutral-600">
              <span className="font-semibold text-[#171717]">{stats.published}</span> yayinlanan
            </span>
          </div>
        </div>
      )}

      {/* Month Navigation + Calendar */}
      <div className="bg-white rounded-xl border border-neutral-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <h2 className="text-lg font-grotesk font-semibold text-[#171717]">
            {MONTH_LABELS[currentMonth - 1]} {currentYear}
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-grotesk font-medium text-neutral-400 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] p-1" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayPosts = postsByDay[day] || [];
                const isToday = isCurrentMonthYear && day === todayDate;
                const isSelected = selectedDay === day;
                const hasPosts = dayPosts.length > 0;

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`
                      min-h-[80px] p-1.5 rounded-lg text-left transition-all relative group
                      ${isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                      ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-neutral-50 border border-transparent'}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`
                          text-xs font-grotesk font-medium
                          ${isToday ? 'text-indigo-600' : 'text-neutral-700'}
                        `}
                      >
                        {day}
                      </span>
                      {/* Hover "+" button */}
                      {!hasPosts && (
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full bg-neutral-200 flex items-center justify-center">
                          <Plus className="w-3 h-3 text-neutral-500" />
                        </span>
                      )}
                    </div>

                    {/* Post previews (first 2 posts) */}
                    {dayPosts.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {dayPosts.slice(0, 2).map((post) => {
                          const thumb = post.media?.[0];
                          return (
                            <div
                              key={post.id}
                              className="flex items-center gap-1 overflow-hidden"
                            >
                              {thumb && (
                                <div className="w-4 h-4 rounded overflow-hidden flex-shrink-0 bg-neutral-100">
                                  {thumb.type === 'image' ? (
                                    <img
                                      src={thumb.thumbnailUrl || thumb.url}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Film className="w-3 h-3 text-neutral-400 m-0.5" />
                                  )}
                                </div>
                              )}
                              <span
                                className={`inline-block px-1 py-px rounded text-[9px] font-grotesk font-medium leading-tight truncate ${POST_TYPE_COLORS[post.postType]}`}
                              >
                                {POST_TYPE_LABELS[post.postType]}
                              </span>
                            </div>
                          );
                        })}
                        {dayPosts.length > 2 && (
                          <span className="text-[9px] font-grotesk text-neutral-400 leading-none">
                            +{dayPosts.length - 2} daha
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Selected Day Detail Panel */}
      <AnimatePresence>
        {selectedDay !== null && selectedDayPosts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-white rounded-xl border border-neutral-100 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-grotesk text-lg font-semibold text-[#171717]">
                {selectedDay} {MONTH_LABELS[currentMonth - 1]} - {selectedDayPosts.length} Post
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const clickedDate = new Date(currentYear, currentMonth - 1, selectedDay, 10, 0);
                    setPrefillDate(clickedDate);
                    setPanelOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Post Ekle
                </button>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {selectedDayPosts.map((post) => {
                const thumb = post.media?.[0];
                const displayTitle = post.title || post.caption?.slice(0, 60) || 'Isimsiz Post';
                return (
                  <div
                    key={post.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {thumb && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                          {thumb.type === 'image' ? (
                            <img
                              src={thumb.thumbnailUrl || thumb.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Film className="w-4 h-4 text-neutral-400" />
                            </div>
                          )}
                        </div>
                      )}
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-grotesk font-medium ${POST_TYPE_COLORS[post.postType]}`}
                      >
                        {POST_TYPE_LABELS[post.postType]}
                      </span>
                      <span className="font-grotesk text-sm text-[#171717] truncate">
                        {displayTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {post.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="text-xs font-grotesk text-neutral-500"
                        >
                          {SOCIAL_PLATFORM_LABELS[platform]}
                        </span>
                      ))}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-grotesk font-medium ${POST_STATUS_COLORS[post.status]}`}
                      >
                        {POST_STATUS_LABELS[post.status]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CreatePostPanel Drawer */}
      {projectId && (
        <CreatePostPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          onPostCreated={handlePostCreated}
          projectId={projectId}
          prefilledDate={prefillDate}
        />
      )}
    </div>
  );
};

export default SocialMediaCalendar;
