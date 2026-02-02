import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
} from 'lucide-react';
import type {
  CampaignSummary,
  CampaignStatus,
  AdPlatform,
} from '@/shared/types/marketing';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from '@/shared/types/marketing';
import { getCampaigns } from '@/shared/services/marketingService';
import { useProjectScope } from '@/shared/hooks/useProjectScope';

// ============================================
// CONSTANTS
// ============================================

const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'];

const MONTH_LABELS = [
  'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
  'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik',
];

const ALL_STATUSES: CampaignStatus[] = [
  'draft', 'proposed', 'approved', 'rejected', 'revision',
  'publishing', 'active', 'paused', 'completed', 'failed',
];

const ALL_PLATFORMS: AdPlatform[] = ['meta', 'google', 'tiktok', 'linkedin', 'email'];

// ============================================
// TYPES
// ============================================

interface CalendarCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  platforms: AdPlatform[];
  totalBudget: number;
  startDate: Date;
  endDate: Date | null; // null = ongoing
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

interface TooltipData {
  campaign: CalendarCampaign;
  x: number;
  y: number;
}

// ============================================
// DATE HELPERS
// ============================================

function getCalendarDays(year: number, month: number): CalendarDay[] {
  const days: CalendarDay[] = [];
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  // Monday-based: getDay() returns 0=Sun, we need Mon=0
  let startDayOfWeek = firstOfMonth.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Previous month overflow
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({
      date: d,
      isCurrentMonth: false,
      isToday: d.getTime() === today.getTime(),
    });
  }

  // Current month
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: date.getTime() === today.getTime(),
    });
  }

  // Next month overflow to fill grid (must be multiple of 7)
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
      });
    }
  }

  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDateInRange(date: Date, start: Date, end: Date | null): boolean {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);

  if (d < s) return false;

  if (end) {
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    return d <= e;
  }

  // No end date: campaign is ongoing, show it up to 60 days from start
  const maxOngoing = new Date(s);
  maxOngoing.setDate(maxOngoing.getDate() + 60);
  return d <= maxOngoing;
}

function formatDateRange(start: Date, end: Date | null): string {
  const formatDate = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = MONTH_LABELS[d.getMonth()];
    return `${day} ${month}`;
  };

  if (!end) {
    return `${formatDate(start)} - Devam ediyor`;
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
}

// ============================================
// STATUS BAR COLOR (for calendar bars)
// ============================================

function getStatusBarColor(status: CampaignStatus): string {
  const colorMap: Record<CampaignStatus, string> = {
    draft: 'bg-neutral-300',
    proposed: 'bg-amber-400',
    approved: 'bg-green-400',
    rejected: 'bg-red-400',
    revision: 'bg-orange-400',
    publishing: 'bg-purple-400',
    active: 'bg-emerald-500',
    paused: 'bg-yellow-400',
    completed: 'bg-blue-400',
    failed: 'bg-red-500',
  };
  return colorMap[status] || 'bg-neutral-300';
}

// ============================================
// COMPONENT
// ============================================

const CampaignCalendarPage: React.FC = () => {
  const { projectId, basePath } = useProjectScope();
  const navigate = useNavigate();

  // State
  const [campaigns, setCampaigns] = useState<CalendarCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('');
  const [platformFilter, setPlatformFilter] = useState<AdPlatform | ''>('');
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // ---- Load campaigns ----

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (projectId) filters.projectId = projectId;
      if (statusFilter) filters.status = [statusFilter];

      const result = await getCampaigns(
        Object.keys(filters).length > 0 ? filters : undefined,
        100 // Load enough campaigns for calendar
      );

      // We need to load full campaign data to get schedules
      // getCampaigns returns CampaignSummary which doesn't include schedule
      // We'll fetch the full campaigns for each
      const { collection: fbCollection, getDocs, query, where, orderBy, limit: fbLimit } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase/config');

      if (!db) {
        setLoading(false);
        return;
      }

      const constraints: any[] = [];
      if (projectId) {
        constraints.push(where('projectId', '==', projectId));
      }
      if (statusFilter) {
        constraints.push(where('status', '==', statusFilter));
      }
      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(fbLimit(100));

      const q = query(fbCollection(db, 'marketing_campaigns'), ...constraints);
      const snapshot = await getDocs(q);

      const calendarCampaigns: CalendarCampaign[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (!data.schedule?.startDate) return;

        const startDate = new Date(data.schedule.startDate);
        const endDate = data.schedule.endDate ? new Date(data.schedule.endDate) : null;

        // Platform filter
        if (platformFilter && !data.platforms?.includes(platformFilter)) return;

        calendarCampaigns.push({
          id: doc.id,
          name: data.name || 'Isimsiz Kampanya',
          status: data.status || 'draft',
          platforms: data.platforms || [],
          totalBudget: data.budget?.totalBudget || 0,
          startDate,
          endDate,
        });
      });

      setCampaigns(calendarCampaigns);
    } catch (err) {
      console.error('Failed to load campaigns for calendar:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter, platformFilter]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // ---- Calendar days ----

  const calendarDays = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const weeks = useMemo(() => {
    const w: CalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      w.push(calendarDays.slice(i, i + 7));
    }
    return w;
  }, [calendarDays]);

  // ---- Campaigns per day lookup ----

  const campaignsForDay = useCallback(
    (day: Date): CalendarCampaign[] => {
      return campaigns.filter((c) => isDateInRange(day, c.startDate, c.endDate));
    },
    [campaigns]
  );

  // ---- Campaigns active this month ----

  const monthCampaigns = useMemo(() => {
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);

    return campaigns.filter((c) => {
      const cStart = new Date(c.startDate);
      cStart.setHours(0, 0, 0, 0);

      if (c.endDate) {
        const cEnd = new Date(c.endDate);
        cEnd.setHours(0, 0, 0, 0);
        // Campaign overlaps with month if start <= monthEnd AND end >= monthStart
        return cStart <= monthEnd && cEnd >= monthStart;
      }

      // Ongoing campaign: starts before or during month
      return cStart <= monthEnd;
    });
  }, [campaigns, currentYear, currentMonth]);

  // ---- Navigation ----

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setCurrentYear(new Date().getFullYear());
    setCurrentMonth(new Date().getMonth());
  };

  // ---- Bar rendering helpers ----

  // Check if a day is the start of a campaign bar in the calendar row
  function isBarStart(day: Date, campaign: CalendarCampaign, weekStart: Date): boolean {
    const campStart = new Date(campaign.startDate);
    campStart.setHours(0, 0, 0, 0);
    const wStart = new Date(weekStart);
    wStart.setHours(0, 0, 0, 0);
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);

    // Bar starts on the campaign start date or the first day of the week (if campaign started before this week)
    return isSameDay(d, campStart) || (campStart < wStart && isSameDay(d, wStart));
  }

  // Calculate bar span within a week row
  function getBarSpan(startDay: Date, campaign: CalendarCampaign, weekEnd: Date): number {
    const d = new Date(startDay);
    d.setHours(0, 0, 0, 0);
    const wEnd = new Date(weekEnd);
    wEnd.setHours(0, 0, 0, 0);

    let span = 0;
    const current = new Date(d);

    while (current <= wEnd) {
      if (isDateInRange(current, campaign.startDate, campaign.endDate)) {
        span++;
      } else {
        break;
      }
      current.setDate(current.getDate() + 1);
    }

    return Math.max(span, 1);
  }

  // Check if ongoing (no end date) and the day is far from start
  function isOngoingFade(day: Date, campaign: CalendarCampaign): boolean {
    if (campaign.endDate) return false;
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    const s = new Date(campaign.startDate);
    s.setHours(0, 0, 0, 0);
    const diff = Math.floor((d.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 30;
  }

  // ---- Tooltip ----

  const showTooltipFor = (campaign: CalendarCampaign, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      campaign,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const hideTooltip = () => setTooltip(null);

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-commons font-bold text-[#171717]">
            Kampanya Takvimi
          </h1>
          <p className="text-sm font-commons text-neutral-500 mt-1">
            Kampanyalarinizin zaman cizelgesi gorunumu
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-commons rounded-lg border transition-colors ${
              showFilters || statusFilter || platformFilter
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtre
            {(statusFilter || platformFilter) && (
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
            )}
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-2 text-sm font-commons text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
          >
            Bugun
          </button>
        </div>
      </div>

      {/* Filters row */}
      {showFilters && (
        <div className="flex items-center gap-3 bg-white rounded-xl border border-neutral-200/50 px-4 py-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | '')}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
          >
            <option value="">Tum Durumlar</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CAMPAIGN_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as AdPlatform | '')}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-sm focus:outline-none focus:border-indigo-400"
          >
            <option value="">Tum Platformlar</option>
            {ALL_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
          {(statusFilter || platformFilter) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setPlatformFilter('');
              }}
              className="text-xs font-commons text-neutral-500 hover:text-neutral-700 underline"
            >
              Temizle
            </button>
          )}
        </div>
      )}

      {/* Main Content: Calendar + Side Panel */}
      <div className="flex gap-6">
        {/* Calendar Grid */}
        <div className="flex-1 bg-white rounded-xl border border-neutral-200/50 overflow-hidden">
          {/* Month Navigation */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <button
              onClick={goToPrevMonth}
              className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-600" />
            </button>
            <h2 className="text-lg font-commons font-semibold text-[#171717]">
              {MONTH_LABELS[currentMonth]} {currentYear}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-neutral-600" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-3">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-px mb-1">
                {WEEKDAY_LABELS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-commons font-semibold text-neutral-500 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              <div className="grid gap-px">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="grid grid-cols-7 gap-px">
                    {week.map((day, dayIdx) => {
                      const dayCampaigns = campaignsForDay(day.date);
                      // Only show first 3 campaigns per day, with overflow indicator
                      const maxVisible = 3;
                      const visibleCampaigns = dayCampaigns.slice(0, maxVisible);
                      const overflowCount = dayCampaigns.length - maxVisible;

                      return (
                        <div
                          key={dayIdx}
                          className={`min-h-[80px] p-1 rounded-md border transition-colors ${
                            day.isToday
                              ? 'border-indigo-300 bg-indigo-50/30'
                              : day.isCurrentMonth
                                ? 'border-neutral-100 bg-white hover:bg-neutral-50/50'
                                : 'border-neutral-50 bg-neutral-50/30'
                          }`}
                        >
                          {/* Day number */}
                          <div className="flex items-center justify-between px-1">
                            <span
                              className={`text-xs font-commons ${
                                day.isToday
                                  ? 'w-5 h-5 flex items-center justify-center bg-indigo-600 text-white rounded-full font-bold'
                                  : day.isCurrentMonth
                                    ? 'text-neutral-700 font-medium'
                                    : 'text-neutral-300'
                              }`}
                            >
                              {day.date.getDate()}
                            </span>
                          </div>

                          {/* Campaign bars */}
                          <div className="mt-0.5 space-y-0.5">
                            {visibleCampaigns.map((campaign) => {
                              const hasOngoingFade = isOngoingFade(day.date, campaign);

                              return (
                                <button
                                  key={campaign.id}
                                  onClick={() =>
                                    navigate(`${basePath}/campaigns/${campaign.id}`)
                                  }
                                  onMouseEnter={(e) => showTooltipFor(campaign, e)}
                                  onMouseLeave={hideTooltip}
                                  className={`w-full text-left px-1 py-0.5 rounded text-[10px] font-commons font-medium text-white truncate transition-opacity cursor-pointer hover:opacity-80 ${getStatusBarColor(
                                    campaign.status
                                  )} ${hasOngoingFade ? 'opacity-40' : ''}`}
                                  style={{
                                    // Create a subtle gradient for ongoing campaigns
                                    ...(hasOngoingFade
                                      ? {
                                          background: `linear-gradient(90deg, currentColor 0%, transparent 100%)`,
                                        }
                                      : {}),
                                  }}
                                  title={campaign.name}
                                >
                                  {campaign.name}
                                </button>
                              );
                            })}
                            {overflowCount > 0 && (
                              <div className="px-1 text-[9px] font-commons text-neutral-400 font-medium">
                                +{overflowCount} daha
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[11px] font-commons text-neutral-500 font-medium">
                Durum:
              </span>
              {ALL_STATUSES.filter((s) =>
                campaigns.some((c) => c.status === s)
              ).map((status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div
                    className={`w-3 h-2 rounded-sm ${getStatusBarColor(status)}`}
                  />
                  <span className="text-[10px] font-commons text-neutral-500">
                    {CAMPAIGN_STATUS_LABELS[status]}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm bg-gradient-to-r from-neutral-400 to-transparent" />
                <span className="text-[10px] font-commons text-neutral-500">
                  Devam eden (sonlanan)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-[280px] shrink-0">
          <div className="bg-white rounded-xl border border-neutral-200/50 sticky top-4">
            <div className="px-4 py-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-commons font-semibold text-[#171717]">
                  Bu Aydaki Kampanyalar
                </h3>
              </div>
              <p className="text-xs font-commons text-neutral-400 mt-0.5">
                {MONTH_LABELS[currentMonth]} {currentYear} - {monthCampaigns.length} kampanya
              </p>
            </div>

            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {monthCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <Calendar className="w-8 h-8 text-neutral-200 mb-2" />
                  <p className="text-xs font-commons text-neutral-500 text-center">
                    Bu ayda planlanmis kampanya bulunmuyor
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-50">
                  {monthCampaigns.map((campaign) => (
                    <Link
                      key={campaign.id}
                      to={`${basePath}/campaigns/${campaign.id}`}
                      className="block px-4 py-3 hover:bg-neutral-50 transition-colors"
                    >
                      {/* Campaign name */}
                      <p className="text-sm font-commons font-semibold text-[#171717] truncate">
                        {campaign.name}
                      </p>

                      {/* Date range */}
                      <p className="text-[11px] font-commons text-neutral-500 mt-1">
                        {formatDateRange(campaign.startDate, campaign.endDate)}
                      </p>

                      {/* Status + Platforms row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-commons font-medium ${
                            CAMPAIGN_STATUS_COLORS[campaign.status]
                          }`}
                        >
                          {CAMPAIGN_STATUS_LABELS[campaign.status]}
                        </span>
                        {campaign.platforms.map((p) => (
                          <span
                            key={p}
                            className={`px-1 py-0.5 rounded text-[10px] font-commons ${
                              PLATFORM_COLORS[p]
                            }`}
                          >
                            {p}
                          </span>
                        ))}
                      </div>

                      {/* Budget */}
                      {campaign.totalBudget > 0 && (
                        <p className="text-[11px] font-commons text-neutral-400 mt-1.5">
                          Butce: {campaign.totalBudget.toLocaleString('tr-TR')} TL
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip (portal-free, fixed position) */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-[#171717] text-white rounded-lg px-4 py-3 shadow-xl max-w-[260px]">
            <p className="text-sm font-commons font-semibold mb-1.5">
              {tooltip.campaign.name}
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-commons font-medium ${
                    CAMPAIGN_STATUS_COLORS[tooltip.campaign.status]
                  }`}
                >
                  {CAMPAIGN_STATUS_LABELS[tooltip.campaign.status]}
                </span>
              </div>
              <p className="text-xs font-commons text-neutral-300">
                {formatDateRange(tooltip.campaign.startDate, tooltip.campaign.endDate)}
              </p>
              <div className="flex gap-1 flex-wrap">
                {tooltip.campaign.platforms.map((p) => (
                  <span
                    key={p}
                    className="text-[10px] font-commons text-neutral-300"
                  >
                    {PLATFORM_LABELS[p]}
                  </span>
                ))}
              </div>
              {tooltip.campaign.totalBudget > 0 && (
                <p className="text-xs font-commons text-neutral-300">
                  Butce: {tooltip.campaign.totalBudget.toLocaleString('tr-TR')} TL
                </p>
              )}
              {!tooltip.campaign.endDate && (
                <div className="flex items-center gap-1 mt-1">
                  <Info className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-commons text-amber-400">
                    Devam eden kampanya (bitis tarihi yok)
                  </span>
                </div>
              )}
            </div>
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#171717]" />
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignCalendarPage;
