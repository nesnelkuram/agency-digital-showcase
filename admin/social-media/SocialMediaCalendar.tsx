import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { SocialPostSummary } from '@/shared/types/socialMedia';
import {
  POST_TYPE_COLORS,
  POST_TYPE_LABELS,
  POST_STATUS_LABELS,
  POST_STATUS_COLORS,
  SOCIAL_PLATFORM_LABELS,
} from '@/shared/types/socialMedia';
import { getSocialPostsByDate } from '@/shared/services/socialMediaService';
import { getProject } from '@/shared/services/projectService';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';

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
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [posts, setPosts] = useState<SocialPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [postsResult, project] = await Promise.all([
        getSocialPostsByDate(projectId, currentMonth, currentYear),
        getProject(projectId),
      ]);
      setPosts(postsResult);
      if (project) {
        setProjectName(project.name);
      }
    } catch (err) {
      console.error('[SocialMediaCalendar] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, currentMonth, currentYear]);

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

  const postsByDay: Record<number, SocialPostSummary[]> = {};
  posts.forEach((post) => {
    if (post.scheduledAt) {
      const date = post.scheduledAt.toDate();
      const day = date.getDate();
      if (!postsByDay[day]) {
        postsByDay[day] = [];
      }
      postsByDay[day].push(post);
    }
  });

  const selectedDayPosts = selectedDay ? postsByDay[selectedDay] || [] : [];

  const today = new Date();
  const isCurrentMonthYear =
    today.getMonth() + 1 === currentMonth && today.getFullYear() === currentYear;
  const todayDate = today.getDate();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      {projectId && (
        <nav className="flex items-center gap-1.5 text-sm font-grotesk text-neutral-500 mb-2">
          <Link
            to="/admin/projects"
            className="hover:text-indigo-600 transition-colors"
          >
            Projeler
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
          <Link
            to={`/admin/projects/${projectId}`}
            className="hover:text-indigo-600 transition-colors"
          >
            {projectName || 'Proje'}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
          <Link
            to={`/admin/projects/${projectId}/social-media`}
            className="hover:text-indigo-600 transition-colors"
          >
            Sosyal Medya
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
          <span className="text-neutral-700">Takvim</span>
        </nav>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-ramillas font-bold text-[#171717]">
            Icerik Takvimi
          </h1>
          <p className="font-grotesk text-neutral-600 mt-1">
            Planlanan postlari takvim uzerinde goruntuleyebilirsiniz
          </p>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="bg-white rounded-xl border border-neutral-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <h2 className="text-lg font-ramillas font-semibold text-[#171717]">
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
                <div key={`empty-${i}`} className="aspect-square p-1" />
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
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`
                      aspect-square p-1.5 rounded-lg text-left transition-all relative
                      ${isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                      ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-neutral-50 border border-transparent'}
                      ${hasPosts ? 'cursor-pointer' : 'cursor-default'}
                    `}
                  >
                    <span
                      className={`
                        text-xs font-grotesk font-medium block
                        ${isToday ? 'text-indigo-600' : 'text-neutral-700'}
                      `}
                    >
                      {day}
                    </span>

                    {/* Post dots */}
                    {dayPosts.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {dayPosts.slice(0, 4).map((post) => (
                          <span
                            key={post.id}
                            className={`w-1.5 h-1.5 rounded-full ${POST_TYPE_COLORS[post.postType].split(' ')[0]}`}
                            title={`${POST_TYPE_LABELS[post.postType]}: ${post.title}`}
                          />
                        ))}
                        {dayPosts.length > 4 && (
                          <span className="text-[8px] font-grotesk text-neutral-400 leading-none">
                            +{dayPosts.length - 4}
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
              <h3 className="font-ramillas text-lg font-semibold text-[#171717]">
                {selectedDay} {MONTH_LABELS[currentMonth - 1]} - {selectedDayPosts.length} Post
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedDayPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-grotesk font-medium ${POST_TYPE_COLORS[post.postType]}`}
                    >
                      {POST_TYPE_LABELS[post.postType]}
                    </span>
                    <span className="font-grotesk text-sm text-[#171717] truncate">
                      {post.title}
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
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Day Empty */}
      <AnimatePresence>
        {selectedDay !== null && selectedDayPosts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-white rounded-xl border border-neutral-100 p-6 text-center"
          >
            <p className="font-grotesk text-sm text-neutral-500">
              {selectedDay} {MONTH_LABELS[currentMonth - 1]} tarihinde planlanan post bulunmuyor.
            </p>
            <button
              onClick={() => setSelectedDay(null)}
              className="mt-2 text-xs font-grotesk text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Kapat
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SocialMediaCalendar;
