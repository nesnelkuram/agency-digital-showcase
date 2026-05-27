import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
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
  Calendar as CalendarIcon,
  Loader2,
} from 'lucide-react';
import type {
  SocialPostSummary,
  SocialMediaStats,
  SocialPlatform,
  CreateSocialPostData,
} from '@/shared/types/socialMedia';
import {
  POST_TYPE_COLORS,
  POST_TYPE_LABELS,
  POST_STATUS_LABELS,
  POST_STATUS_COLORS,
  SOCIAL_PLATFORM_LABELS,
} from '@/shared/types/socialMedia';
import {
  getSocialPostsByDate,
  getProjectSocialStats,
  createMultiplePosts,
  getSocialPosts,
  updatePostSchedule,
} from '@/shared/services/socialMediaService';
import { getProject, getProjects } from '@/shared/services/projectService';
import type { Project, ProjectSummary } from '@/shared/types/project';
import {
  createContentPlan,
  assignAndSubmitToClient,
  findTenantUserByEmail,
} from '@/shared/services/contentPlanService';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import type { User } from '@/shared/types/user';
import { collection, query as fsQuery, where, getDocs } from 'firebase/firestore';
import { Mail, Send, UserPlus } from 'lucide-react';
import InviteUserWizard, { InvitePayload } from '../settings/components/invite/InviteUserWizard';
import { useUserManagement } from '@/shared/hooks/useUserManagement';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';
import ProjectBreadcrumb from '@/admin/projects/components/ProjectBreadcrumb';
import CreatePostPanel from './components/CreatePostPanel';
import BulkMediaUploader from './components/BulkMediaUploader';
import CalendarView from './components/calendar/CalendarView';
import InstagramProfileView from './components/grid/InstagramProfileView';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import { Grid3x3 } from 'lucide-react';

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

/**
 * Takvim gün hücresi — hem click (gün seçimi) hem drop target (post sürükle).
 */
function DayCell({
  day,
  dateIso,
  children,
  onClick,
  className,
}: {
  day: number;
  dateIso: string;
  children: React.ReactNode;
  onClick: () => void;
  className: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `smcal-day-${dateIso}`,
    data: { dateIso },
  });
  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      data-day={day}
      className={`${className} ${isOver ? 'ring-2 ring-[#171717] ring-offset-1 bg-neutral-100' : ''}`}
    >
      {children}
    </div>
  );
}

/**
 * Sürüklenebilir planlanmamış post tile'ı.
 */
function DraggableUnscheduledTile({
  postId,
  thumbUrl,
  typeLabel,
  onQuickSchedule,
}: {
  postId: string;
  thumbUrl?: string;
  typeLabel: string;
  onQuickSchedule: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unscheduled-${postId}`,
    data: { postId },
  });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative aspect-square bg-white rounded-lg border border-amber-200 overflow-hidden hover:border-amber-400 transition-colors cursor-grab active:cursor-grabbing"
      {...listeners}
      {...attributes}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center pointer-events-none">
          <Film className="w-5 h-5 text-neutral-300" />
        </div>
      )}
      <div className="absolute top-1 right-1 px-1 py-px rounded bg-black/60 text-white text-[9px] font-grotesk pointer-events-none">
        {typeLabel}
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onQuickSchedule();
        }}
        className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 px-1 py-0.5 bg-white rounded text-[9px] font-grotesk text-[#171717] transition-opacity"
      >
        Bugüne ata
      </button>
    </div>
  );
}

const SocialMediaCalendar: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [posts, setPosts] = useState<SocialPostSummary[]>([]);
  const [unscheduledPosts, setUnscheduledPosts] = useState<SocialPostSummary[]>([]);
  const [stats, setStats] = useState<SocialMediaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'grid'>('month');
  const [allProjectPosts, setAllProjectPosts] = useState<SocialPostSummary[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // CreatePostPanel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<Date | undefined>();

  // BulkMediaUploader modal state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPlatform, setBulkPlatform] = useState<SocialPlatform>('instagram');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Proje picker (projectId yoksa)
  const [tenantProjects, setTenantProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Müşteri davet modal
  const [showInviteClient, setShowInviteClient] = useState(false);
  const { inviteUser: inviteClientUser, users: tenantUsers } = useUserManagement();

  // Müşteriye gönder modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [projectInfo, setProjectInfo] = useState<Project | null>(null);
  const [projectClients, setProjectClients] = useState<User[]>([]);
  const [sendStartDate, setSendStartDate] = useState('');
  const [sendEndDate, setSendEndDate] = useState('');
  const [sendClientUid, setSendClientUid] = useState('');
  const [sendClientName, setSendClientName] = useState('');
  const [sendClientEmail, setSendClientEmail] = useState('');
  const [showManualRecipient, setShowManualRecipient] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Projeye bağlı müşteri kullanıcıları + proje bilgisi
  useEffect(() => {
    if (!projectId || !db) return;
    let cancelled = false;
    (async () => {
      try {
        const project = await getProject(tenantId, projectId);
        if (!cancelled) setProjectInfo(project);

        const snap = await getDocs(
          fsQuery(
            collection(db!, 'users'),
            where('tenantId', '==', tenantId),
            where('role', '==', 'client')
          )
        );
        const list: User[] = [];
        snap.forEach((d) => {
          const u = { uid: d.id, ...d.data() } as User;
          const assigned = (u.profile as any)?.assignedProjectIds || [];
          if (Array.isArray(assigned) && assigned.includes(projectId)) list.push(u);
        });
        if (!cancelled) setProjectClients(list);
      } catch (e) {
        console.warn('[SocialMediaCalendar] Project clients load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, tenantId]);

  useEffect(() => {
    if (projectId) return;
    let cancelled = false;
    setProjectsLoading(true);
    getProjects(tenantId, { status: ['active', 'paused'] }, 50)
      .then((r) => {
        if (!cancelled) setTenantProjects(r.projects);
      })
      .catch((e) => console.error('[SocialMediaCalendar] getProjects failed', e))
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, projectId]);

  const loadData = useCallback(async () => {
    if (!projectId) {
      // Proje yoksa loader'ı kapat — empty-state göstereceğiz
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [postsResult, project, statsResult, allPostsResult] = await Promise.all([
        getSocialPostsByDate(tenantId, projectId, currentMonth, currentYear),
        getProject(tenantId, projectId),
        getProjectSocialStats(tenantId, projectId),
        getSocialPosts(tenantId, { projectId }, 100),
      ]);
      setPosts(postsResult);
      setStats(statsResult);
      setAllProjectPosts(allPostsResult.posts);
      setUnscheduledPosts(
        allPostsResult.posts.filter((p) => !p.scheduledAt && p.status === 'draft')
      );
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
    // Her zaman detay drawer'ını aç (post varsa listeler, yoksa empty state)
    setSelectedDay(day);
  };

  const handleAddPostForSelectedDay = () => {
    if (!selectedDay) return;
    const clickedDate = new Date(currentYear, currentMonth - 1, selectedDay, 10, 0);
    setPrefillDate(clickedDate);
    setPanelOpen(true);
  };

  const handleUnschedulePost = async (postId: string) => {
    try {
      if (!db) return;
      const docRef = doc(db, 'social_media_posts', postId);
      await updateDoc(docRef, { scheduledAt: null, updatedAt: serverTimestamp() });
      await loadData();
    } catch (e) {
      console.error('[SocialMediaCalendar] unschedule failed', e);
    }
  };

  const startEditingPost = (post: SocialPostSummary) => {
    setEditingPostId(post.id);
    setEditTitle(post.title || '');
    setEditCaption(post.caption || '');
    const sched = post.scheduledAt?.toDate?.();
    if (sched) {
      const pad = (n: number) => String(n).padStart(2, '0');
      setEditScheduledAt(
        `${sched.getFullYear()}-${pad(sched.getMonth() + 1)}-${pad(sched.getDate())}T${pad(
          sched.getHours()
        )}:${pad(sched.getMinutes())}`
      );
    } else {
      setEditScheduledAt('');
    }
  };

  const cancelEditingPost = () => {
    setEditingPostId(null);
    setEditTitle('');
    setEditCaption('');
    setEditScheduledAt('');
  };

  const savePostEdit = async () => {
    if (!editingPostId || !db) return;
    setSavingEdit(true);
    try {
      const patch: Record<string, any> = {
        title: editTitle.trim() || null,
        caption: editCaption.trim() || null,
        updatedAt: serverTimestamp(),
      };
      if (editScheduledAt) {
        patch.scheduledAt = Timestamp.fromDate(new Date(editScheduledAt));
      }
      await updateDoc(doc(db, 'social_media_posts', editingPostId), patch);
      cancelEditingPost();
      await loadData();
    } catch (e) {
      console.error('[SocialMediaCalendar] save edit failed', e);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleNewPost = () => {
    setPrefillDate(undefined);
    setPanelOpen(true);
  };

  const handlePostCreated = () => {
    loadData();
  };

  const openSendModal = () => {
    // Default tarih aralığı: mevcut ay
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = new Date(currentYear, currentMonth - 1, 1);
    const end = new Date(currentYear, currentMonth, 0);
    setSendStartDate(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
    setSendEndDate(`${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`);
    setSendError(null);
    setSendSuccess(false);
    setShowManualRecipient(false);
    // Tek müşteri varsa otomatik seç
    if (projectClients.length === 1) {
      const c = projectClients[0];
      setSendClientUid(c.uid);
      setSendClientName(c.displayName || c.email);
      setSendClientEmail(c.email);
    } else {
      setSendClientUid('');
      setSendClientName('');
      setSendClientEmail('');
    }
    setShowSendModal(true);
  };

  // Modal zaten açıkken projectClients geç yüklenirse ve tek kişiyse otomatik seç
  useEffect(() => {
    if (showSendModal && !sendClientEmail && projectClients.length === 1) {
      const c = projectClients[0];
      setSendClientUid(c.uid);
      setSendClientName(c.displayName || c.email);
      setSendClientEmail(c.email);
    }
  }, [showSendModal, projectClients, sendClientEmail]);

  const handleSendToClient = async () => {
    if (!projectId || !user) return;
    if (!sendClientName.trim() || !sendClientEmail.trim()) {
      setSendError('Alıcı adı ve e-posta gerekli');
      return;
    }
    if (!sendStartDate || !sendEndDate) {
      setSendError('Tarih aralığı gerekli');
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const startDate = new Date(sendStartDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(sendEndDate);
      endDate.setHours(23, 59, 59, 999);

      // 1) Tarih aralığındaki post'ları topla
      const postsInRange = allProjectPosts.filter((p) => {
        const d = (p.scheduledAt as any)?.toDate?.();
        return d && d >= startDate && d <= endDate;
      });
      if (postsInRange.length === 0) {
        throw new Error('Seçilen tarih aralığında planlanmış post yok');
      }

      // 2) Platform çıkarımı: en çok kullanılan
      const platformCounts = new Map<string, number>();
      postsInRange.forEach((p) => {
        (p.platforms || []).forEach((pl) => {
          platformCounts.set(pl, (platformCounts.get(pl) || 0) + 1);
        });
      });
      const platform =
        Array.from(platformCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'instagram';

      // 3) ContentPlan otomatik oluştur
      const planId = await createContentPlan(
        tenantId,
        {
          projectId,
          title: `${projectInfo?.name || 'Marka'} — ${startDate.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
          })} / ${endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`,
          platform: platform as any,
          postIds: postsInRange.map((p) => p.id),
          weekStartDate: Timestamp.fromDate(startDate),
          weekEndDate: Timestamp.fromDate(endDate),
        },
        user.uid,
        user.displayName || user.email || 'Ekip'
      );

      // 3.5) Eğer uid yoksa e-postadan kullanıcıyı bul (manuel girilmiş olsa bile bağla)
      let resolvedUid = sendClientUid;
      if (!resolvedUid) {
        try {
          const found = await findTenantUserByEmail(tenantId, sendClientEmail);
          if (found) {
            resolvedUid = found.uid;
            console.info('[SocialMediaCalendar] Manuel e-posta için uid bulundu:', found);
          } else {
            console.warn(
              '[SocialMediaCalendar] Bu e-posta sistemde yok — plan sadece e-posta ile bağlanacak. Kullanıcı önce davet edilmeli:',
              sendClientEmail
            );
          }
        } catch (e) {
          console.warn('[SocialMediaCalendar] uid lookup hata:', e);
        }
      }

      // 4) Müşteriye ata + pending_approval
      const assignResult = await assignAndSubmitToClient(planId, {
        clientId: resolvedUid || undefined,
        clientName: sendClientName.trim(),
        clientEmail: sendClientEmail.trim().toLowerCase(),
        sentByUid: user.uid,
        sentByName: user.displayName || user.email || 'Ekip',
      });
      console.info('[SocialMediaCalendar] Plan müşteriye atandı:', {
        planId,
        tenantId,
        assignedClientId: assignResult.assignedClientId || null,
        assignedClientEmail: assignResult.assignedClientEmail,
        assignedClientName: sendClientName.trim(),
        postCount: postsInRange.length,
      });

      // 5) Share URL + e-posta gönder
      const plan = await import('@/shared/services/contentPlanService').then((m) =>
        m.getContentPlan(tenantId, planId)
      );
      const shareUrl = `${window.location.origin}/icerik-plani/${plan?.shareToken || ''}`;
      const weekRange = `${startDate.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })} – ${endDate.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`;
      await authenticatedFetch('/api/send-content-plan-notification', {
        method: 'POST',
        body: JSON.stringify({
          type: 'submitted',
          recipientEmail: sendClientEmail.trim(),
          recipientName: sendClientName.trim(),
          senderName: user.displayName || 'intiba ekibi',
          planTitle: projectInfo?.name || 'Sosyal medya planı',
          brandName: projectInfo?.name,
          postCount: postsInRange.length,
          shareUrl,
          weekRange,
        }),
      });

      setSendSuccess(true);
      setTimeout(() => {
        setShowSendModal(false);
        setSendSuccess(false);
      }, 1800);
    } catch (err: any) {
      console.error('[SocialMediaCalendar] send failed', err);
      setSendError(err?.message || 'Gönderim başarısız');
    } finally {
      setSending(false);
    }
  };

  const handleBulkComplete = async (
    postsData: Array<{ media: any[]; postType: any; caption?: string; scheduledAt?: Date }>
  ) => {
    if (!projectId || !user) return;
    setBulkSaving(true);
    setBulkError(null);
    try {
      const payload: CreateSocialPostData[] = postsData.map((p) => ({
        projectId,
        postType: p.postType,
        platforms: [bulkPlatform],
        media: p.media,
        mediaUrls: p.media.map((m: any) => m.url),
        caption: p.caption,
        scheduledAt: p.scheduledAt ? Timestamp.fromDate(p.scheduledAt) : undefined,
      }));
      await createMultiplePosts(
        tenantId,
        payload,
        user.uid,
        user.displayName || user.email || 'Kullanıcı'
      );
      setBulkOpen(false);
      // Auto-schedule yapıldıysa ilgili aya geç
      const firstScheduled = postsData.find((p) => p.scheduledAt)?.scheduledAt;
      if (firstScheduled) {
        setCurrentMonth(firstScheduled.getMonth() + 1);
        setCurrentYear(firstScheduled.getFullYear());
      }
      await loadData();
    } catch (err: any) {
      console.error('[SocialMediaCalendar] bulk create failed:', err);
      setBulkError(err?.message || 'Post oluşturulamadı');
    } finally {
      setBulkSaving(false);
    }
  };

  // Proje yoksa seçici göster (admin nav'dan geldiğinde)
  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-[#1a1a2e]">
            Sosyal Medya
          </h1>
          <p className="font-grotesk text-neutral-500 mt-1">
            İçerik takvimini görüntülemek için bir proje seçin.
          </p>
        </div>
        {projectsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-flex items-center gap-2 font-grotesk text-sm text-neutral-500">
              <span className="w-4 h-4 border-2 border-neutral-300 border-t-[#171717] rounded-full animate-spin" />
              Projeler yükleniyor...
            </div>
          </div>
        ) : tenantProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-100 p-12 text-center">
            <LayoutGrid className="w-10 h-10 text-neutral-300 mx-auto" />
            <p className="font-grotesk text-neutral-500 mt-3">
              Aktif proje yok. Önce bir proje oluşturun.
            </p>
            <Link
              to="/admin/projects"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm"
            >
              <Plus className="w-4 h-4" />
              Projelere git
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tenantProjects.map((p) => (
              <Link
                key={p.id}
                to={`/admin/projects/${p.id}/social-media`}
                className="bg-white rounded-xl border border-neutral-100 p-4 hover:border-neutral-300 hover:shadow-sm transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <LayoutGrid className="w-5 h-5 text-purple-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-grotesk font-semibold text-[#171717] truncate">
                    {p.name}
                  </p>
                  <p className="font-grotesk text-xs text-neutral-500 truncate">
                    {p.clientCompany || p.clientName}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const dragData: any = active.data.current || {};
    const dropData: any = over.data.current || {};
    const postId = dragData.postId as string | undefined;
    const dateIso = dropData.dateIso as string | undefined;
    if (!postId || !dateIso) return;

    // Hedef tarih: gün + (tray'den geliyorsa 10:00, takvim-içi taşıma için mevcut saat)
    const fromMonth = posts.find((p) => p.id === postId);
    const target = new Date(dateIso);
    if (fromMonth?.scheduledAt) {
      const prev = (fromMonth.scheduledAt as any).toDate?.() || new Date();
      target.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    } else {
      target.setHours(10, 0, 0, 0);
    }

    try {
      await updatePostSchedule(postId, target);
      await loadData();
    } catch (e) {
      console.error('[SocialMediaCalendar] drop schedule failed', e);
    }
  };

  return (
    <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
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
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            <Film className="w-4 h-4" />
            Toplu Yükle
          </button>
          <button
            onClick={handleNewPost}
            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-full font-grotesk text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Post
          </button>
          <button
            onClick={openSendModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#171717] text-white rounded-full font-grotesk text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            <Send className="w-4 h-4" />
            Müşteriye Gönder
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

      {/* View Switcher */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-full">
          {[
            { v: 'month' as const, label: 'Ay', Icon: CalendarIcon },
            { v: 'week' as const, label: 'Hafta', Icon: CalendarIcon },
            { v: 'day' as const, label: 'Gün', Icon: CalendarIcon },
            { v: 'grid' as const, label: 'Grid', Icon: Grid3x3 },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setViewMode(o.v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-colors ${
                viewMode === o.v
                  ? 'bg-white text-[#171717] shadow-sm'
                  : 'text-neutral-500 hover:text-[#171717]'
              }`}
            >
              <o.Icon className="w-3.5 h-3.5" />
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Month Navigation + Calendar (sadece ay modunda) */}
      {viewMode === 'month' && (
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
                <div key={`empty-${i}`} className="min-h-[140px] p-1" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayPosts = postsByDay[day] || [];
                const isToday = isCurrentMonthYear && day === todayDate;
                const isSelected = selectedDay === day;
                const hasPosts = dayPosts.length > 0;
                const dateIso = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                return (
                  <DayCell
                    key={day}
                    day={day}
                    dateIso={dateIso}
                    onClick={() => handleDayClick(day)}
                    className={`
                      min-h-[140px] p-1.5 rounded-lg text-left transition-all relative group cursor-pointer overflow-hidden
                      ${isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                      ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-neutral-50 border border-transparent'}
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
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

                    {/* Post previews — gerçek en-boy oranıyla mini thumb grid */}
                    {dayPosts.length > 0 && (
                      <div
                        className={`grid gap-1 ${
                          dayPosts.length === 1
                            ? 'grid-cols-1'
                            : dayPosts.length === 2
                            ? 'grid-cols-2'
                            : 'grid-cols-2'
                        }`}
                      >
                        {dayPosts.slice(0, dayPosts.length === 1 ? 1 : 4).map((post) => {
                          const thumb = post.media?.[0];
                          const aspect =
                            thumb?.width && thumb?.height
                              ? `${thumb.width} / ${thumb.height}`
                              : post.postType === 'story' || post.postType === 'reels'
                              ? '9 / 16'
                              : '1 / 1';
                          return (
                            <div
                              key={post.id}
                              className="relative rounded-md overflow-hidden bg-neutral-100 border border-neutral-200"
                              style={{ aspectRatio: aspect }}
                              title={POST_TYPE_LABELS[post.postType]}
                            >
                              {thumb?.url || thumb?.thumbnailUrl ? (
                                thumb.type === 'video' ? (
                                  <>
                                    <video
                                      src={thumb.url}
                                      poster={thumb.thumbnailUrl}
                                      preload="metadata"
                                      muted
                                      playsInline
                                      className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <Film className="w-4 h-4 text-white drop-shadow" />
                                    </div>
                                  </>
                                ) : (
                                  <img
                                    src={thumb.url || thumb.thumbnailUrl}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                )
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <FileText className="w-4 h-4 text-neutral-400" />
                                </div>
                              )}
                              <span
                                className={`absolute top-0.5 left-0.5 px-1 py-px rounded text-[8px] font-grotesk font-medium leading-tight ${POST_TYPE_COLORS[post.postType]}`}
                              >
                                {POST_TYPE_LABELS[post.postType]}
                              </span>
                            </div>
                          );
                        })}
                        {dayPosts.length > 4 && (
                          <div className="col-span-2 text-[9px] font-grotesk text-neutral-400 leading-none text-center mt-0.5">
                            +{dayPosts.length - 4} daha
                          </div>
                        )}
                      </div>
                    )}
                  </DayCell>
                );
              })}
            </div>
          </>
        )}
      </div>
      )}

      {/* Haftalık / Günlük takvim görünümü (CalendarView internal month/week/day switcher) */}
      {(viewMode === 'week' || viewMode === 'day') && (
        <CalendarView
          posts={allProjectPosts as unknown as SocialMediaPost[]}
          initialMode={viewMode}
          onPostClick={(p) => {
            const d = (p.scheduledAt as any)?.toDate?.();
            if (d && d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear) {
              setSelectedDay(d.getDate());
            }
          }}
        />
      )}

      {/* Instagram Profili görünümü */}
      {viewMode === 'grid' && (
        <InstagramProfileView
          posts={allProjectPosts as unknown as SocialMediaPost[]}
          brandName={projectName || 'Marka'}
          readOnly
        />
      )}

      {/* Unscheduled posts tray */}
      {unscheduledPosts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-amber-600" />
              <h3 className="font-grotesk text-sm font-semibold text-amber-900">
                Planlanmamış ({unscheduledPosts.length})
              </h3>
            </div>
            <p className="font-grotesk text-[11px] text-amber-700">
              Post'ları takvimde bir güne sürükleyerek planlayın.
            </p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {unscheduledPosts.map((post) => {
              const thumb = post.media?.[0]?.url || post.media?.[0]?.thumbnailUrl;
              return (
                <DraggableUnscheduledTile
                  key={post.id}
                  postId={post.id}
                  thumbUrl={thumb}
                  typeLabel={POST_TYPE_LABELS[post.postType]}
                  onQuickSchedule={async () => {
                    const at = new Date();
                    at.setHours(10, 0, 0, 0);
                    try {
                      await updatePostSchedule(post.id, at);
                      await loadData();
                    } catch (e) {
                      console.error('[SocialMediaCalendar] schedule failed', e);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Day Detail Drawer (slide-over) */}
      <AnimatePresence>
        {selectedDay !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex"
          >
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setSelectedDay(null)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="relative ml-auto w-full max-w-lg bg-white shadow-2xl h-full overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-grotesk text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      {new Date(currentYear, currentMonth - 1, selectedDay).toLocaleDateString(
                        'tr-TR',
                        { weekday: 'long' }
                      )}
                    </p>
                    <h2 className="font-grotesk text-2xl font-bold text-[#171717]">
                      {selectedDay} {MONTH_LABELS[currentMonth - 1]} {currentYear}
                    </h2>
                    <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                      {selectedDayPosts.length === 0
                        ? 'Planlanmış post yok'
                        : `${selectedDayPosts.length} planlanmış post`}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="p-2 hover:bg-neutral-100 rounded-lg"
                  >
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleAddPostForSelectedDay}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] text-white rounded-full font-grotesk text-xs font-medium hover:bg-neutral-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Bu güne post ekle
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {selectedDayPosts.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full bg-neutral-100 mx-auto flex items-center justify-center mb-3">
                      <CalendarIcon className="w-6 h-6 text-neutral-400" />
                    </div>
                    <p className="font-grotesk text-sm text-neutral-500">
                      Bu güne planlanmış post yok.
                    </p>
                    <p className="font-grotesk text-xs text-neutral-400 mt-1">
                      Sarı paneldeki planlanmamış post'ları buraya sürükleyebilir ya da yeni post ekleyebilirsiniz.
                    </p>
                  </div>
                ) : (
                  selectedDayPosts
                    .slice()
                    .sort((a, b) => {
                      const at = a.scheduledAt?.toDate?.()?.getTime?.() || 0;
                      const bt = b.scheduledAt?.toDate?.()?.getTime?.() || 0;
                      return at - bt;
                    })
                    .map((post) => {
                      const thumb = post.media?.[0];
                      const scheduled = post.scheduledAt?.toDate?.();
                      // Gerçek en-boy oranını hesapla; yoksa story için 9/16, video için 16/9, default 1/1
                      const previewAspect =
                        thumb?.width && thumb?.height
                          ? `${thumb.width} / ${thumb.height}`
                          : post.postType === 'story'
                          ? '9 / 16'
                          : post.postType === 'reels' || thumb?.type === 'video'
                          ? '9 / 16'
                          : '1 / 1';
                      return (
                        <div
                          key={post.id}
                          className="bg-white rounded-xl border border-neutral-200 overflow-hidden"
                        >
                          {/* Media preview — gerçek en-boy oranıyla */}
                          {thumb && (
                            <div
                              className="bg-neutral-100 relative max-h-[520px] mx-auto"
                              style={{ aspectRatio: previewAspect }}
                            >
                              {thumb.type === 'image' ? (
                                <img
                                  src={thumb.url}
                                  alt=""
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <video
                                  src={thumb.url}
                                  poster={thumb.thumbnailUrl}
                                  controls
                                  preload="metadata"
                                  playsInline
                                  className="w-full h-full object-contain bg-black"
                                />
                              )}
                              <span
                                className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-grotesk font-medium ${POST_TYPE_COLORS[post.postType]}`}
                              >
                                {POST_TYPE_LABELS[post.postType]}
                              </span>
                              <span
                                className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-grotesk font-medium ${POST_STATUS_COLORS[post.status]}`}
                              >
                                {POST_STATUS_LABELS[post.status]}
                              </span>
                            </div>
                          )}

                          <div className="p-3 space-y-2">
                            {editingPostId === post.id ? (
                              <>
                                <div>
                                  <label className="block font-grotesk text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                                    Yayın tarih/saat
                                  </label>
                                  <input
                                    type="datetime-local"
                                    value={editScheduledAt}
                                    onChange={(e) => setEditScheduledAt(e.target.value)}
                                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs focus:outline-none focus:border-neutral-400 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block font-grotesk text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                                    Başlık
                                  </label>
                                  <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Opsiyonel"
                                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs focus:outline-none focus:border-neutral-400 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block font-grotesk text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                                    Caption
                                  </label>
                                  <textarea
                                    value={editCaption}
                                    onChange={(e) => setEditCaption(e.target.value)}
                                    rows={4}
                                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-xs focus:outline-none focus:border-neutral-400 bg-white resize-none"
                                  />
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    disabled={savingEdit}
                                    onClick={savePostEdit}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#171717] text-white rounded-lg font-grotesk text-[11px] hover:bg-neutral-800 disabled:opacity-50"
                                  >
                                    {savingEdit ? 'Kaydediliyor...' : 'Kaydet'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditingPost}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-200 rounded-lg font-grotesk text-[11px] text-neutral-600 hover:bg-neutral-100"
                                  >
                                    Vazgeç
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                {/* Schedule + platform row */}
                                <div className="flex items-center justify-between text-xs font-grotesk text-neutral-500">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {scheduled
                                      ? scheduled.toLocaleTimeString('tr-TR', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : '—'}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {post.platforms.map((platform) => (
                                      <span
                                        key={platform}
                                        className="px-1.5 py-0.5 bg-neutral-100 rounded text-[10px]"
                                      >
                                        {SOCIAL_PLATFORM_LABELS[platform]}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                {/* Title */}
                                {post.title && (
                                  <h4 className="font-grotesk text-sm font-semibold text-[#171717]">
                                    {post.title}
                                  </h4>
                                )}

                                {/* Caption */}
                                {post.caption && (
                                  <p className="font-grotesk text-xs text-neutral-700 whitespace-pre-wrap line-clamp-4">
                                    {post.caption}
                                  </p>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-1 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => startEditingPost(post)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-grotesk text-[11px] text-neutral-600 hover:bg-neutral-100"
                                  >
                                    Düzenle
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUnschedulePost(post.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-grotesk text-[11px] text-amber-700 hover:bg-amber-50"
                                  >
                                    Planlamayı kaldır
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </motion.aside>
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

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {bulkOpen && projectId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => !bulkSaving && setBulkOpen(false)} />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white">
                <div>
                  <h2 className="font-grotesk text-xl font-bold text-[#171717]">Toplu Fotoğraf Yükle</h2>
                  <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                    Birden fazla dosya seçin, her biri için post tipini belirleyin.
                  </p>
                </div>
                <button
                  onClick={() => !bulkSaving && setBulkOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-700 mb-1.5">
                    Platform
                  </label>
                  <select
                    value={bulkPlatform}
                    onChange={(e) => setBulkPlatform(e.target.value as SocialPlatform)}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl font-grotesk text-sm bg-white focus:outline-none focus:border-neutral-400"
                  >
                    {(Object.keys(SOCIAL_PLATFORM_LABELS) as SocialPlatform[]).map((p) => (
                      <option key={p} value={p}>
                        {SOCIAL_PLATFORM_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <BulkMediaUploader
                  projectId={projectId}
                  platform={bulkPlatform}
                  onComplete={handleBulkComplete}
                  onCancel={() => !bulkSaving && setBulkOpen(false)}
                />
                {bulkError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-grotesk text-xs text-red-700">{bulkError}</p>
                  </div>
                )}
                {bulkSaving && (
                  <p className="font-grotesk text-xs text-amber-700">Post'lar oluşturuluyor...</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Müşteri Davet Wizard (lockedRole=client + projectId prefill) */}
      <InviteUserWizard
        open={showInviteClient}
        onClose={() => setShowInviteClient(false)}
        onSubmit={async (payload: InvitePayload) => {
          const result = await inviteClientUser(payload.email, payload.displayName, payload.role, {
            extraFields: payload.extraFields,
            forceTwoFactor: payload.forceTwoFactor,
            expiresInDays: payload.expiresInDays,
            useTemporaryPassword: payload.useTemporaryPassword,
          });
          // Proje müşterilerini yenile
          try {
            const snap = await getDocs(
              fsQuery(
                collection(db!, 'users'),
                where('tenantId', '==', tenantId),
                where('role', '==', 'client')
              )
            );
            const list: User[] = [];
            snap.forEach((d) => {
              const u = { uid: d.id, ...d.data() } as User;
              const assigned = (u.profile as any)?.assignedProjectIds || [];
              if (Array.isArray(assigned) && projectId && assigned.includes(projectId)) list.push(u);
            });
            setProjectClients(list);
          } catch (e) {
            console.warn('[SocialMediaCalendar] reload clients failed', e);
          }
          if (result.temporaryPassword) return { temporaryPassword: result.temporaryPassword };
        }}
        tenantUsers={tenantUsers}
        currentUserRole={user?.role}
        lockedRole="client"
        title="Projeye Müşteri Kişisi Ekle"
        prefillExtra={{
          assignedProjectIds: projectId ? [projectId] : [],
          clientCompany: projectInfo?.clientCompany || projectInfo?.clientName,
        }}
      />

      {/* Müşteriye Gönder Modal */}
      <AnimatePresence>
        {showSendModal && projectId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !sending && setShowSendModal(false)}
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="sticky top-0 bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="font-grotesk text-xl font-bold text-[#171717]">
                    Müşteriye Onaya Gönder
                  </h2>
                  <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                    Seçilen tarih aralığındaki post'lar müşteriye iletilir.
                  </p>
                </div>
                <button
                  onClick={() => !sending && setShowSendModal(false)}
                  className="p-2 hover:bg-neutral-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Tarih aralığı */}
                <div>
                  <label className="block font-grotesk text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                    Yayın dönemi
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={sendStartDate}
                      onChange={(e) => setSendStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                    />
                    <input
                      type="date"
                      value={sendEndDate}
                      onChange={(e) => setSendEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                  {sendStartDate && sendEndDate && (() => {
                    const start = new Date(sendStartDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(sendEndDate);
                    end.setHours(23, 59, 59, 999);
                    const count = allProjectPosts.filter((p) => {
                      const d = (p.scheduledAt as any)?.toDate?.();
                      return d && d >= start && d <= end;
                    }).length;
                    return (
                      <p className="font-grotesk text-[11px] text-neutral-500 mt-1">
                        Bu aralıkta <strong className="text-[#171717]">{count}</strong> planlanmış post
                      </p>
                    );
                  })()}
                </div>

                {/* Müşteri seçici */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-grotesk text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Kime gönderilecek?
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowInviteClient(true)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-grotesk text-neutral-600 hover:bg-neutral-100"
                    >
                      <UserPlus className="w-3 h-3" />
                      Yeni Kişi Ekle
                    </button>
                  </div>

                  {/* Seçilmiş alıcı özeti */}
                  {sendClientEmail && !showManualRecipient ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-3 border border-[#171717] bg-neutral-50 rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#fffceb] flex items-center justify-center flex-shrink-0">
                          <span className="font-grotesk font-bold text-[#171717] text-sm">
                            {(sendClientName || sendClientEmail).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-grotesk text-sm font-medium text-[#171717] truncate">
                            {sendClientName || sendClientEmail}
                          </p>
                          <p className="font-grotesk text-xs text-neutral-500 truncate">
                            {sendClientEmail}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSendClientUid('');
                          setSendClientName('');
                          setSendClientEmail('');
                          setShowManualRecipient(false);
                        }}
                        className="p-1.5 hover:bg-white rounded-md text-neutral-400 hover:text-red-500"
                        title="Alıcıyı değiştir"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : projectClients.length === 0 && !showManualRecipient ? (
                    <div className="space-y-2">
                      <p className="font-grotesk text-xs text-neutral-500 italic px-3 py-4 border border-dashed border-neutral-200 rounded-lg text-center">
                        Bu projeye bağlı müşteri kullanıcısı yok.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowInviteClient(true)}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#171717] text-white rounded-lg font-grotesk text-xs hover:bg-neutral-800"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Yeni kişi davet et
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowManualRecipient(true)}
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-xs text-neutral-700 hover:bg-neutral-50"
                        >
                          Manuel e-posta gir
                        </button>
                      </div>
                    </div>
                  ) : showManualRecipient ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                        <input
                          type="text"
                          value={sendClientName}
                          onChange={(e) => {
                            setSendClientName(e.target.value);
                            if (sendClientUid) setSendClientUid('');
                          }}
                          placeholder="Alıcı adı (örn. Ayşe Yılmaz)"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                          autoFocus
                        />
                        <input
                          type="email"
                          value={sendClientEmail}
                          onChange={(e) => {
                            setSendClientEmail(e.target.value);
                            if (sendClientUid) setSendClientUid('');
                          }}
                          placeholder="musteri@ornek.com"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm focus:outline-none focus:border-neutral-400"
                        />
                      </div>
                      {projectClients.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowManualRecipient(false);
                            setSendClientName('');
                            setSendClientEmail('');
                          }}
                          className="font-grotesk text-[11px] text-neutral-500 hover:text-[#171717]"
                        >
                          ← Listeden seç
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {projectClients.map((u) => (
                        <button
                          key={u.uid}
                          type="button"
                          onClick={() => {
                            setSendClientUid(u.uid);
                            setSendClientName(u.displayName || u.email);
                            setSendClientEmail(u.email);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-left transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#fffceb] flex items-center justify-center flex-shrink-0">
                              <span className="font-grotesk font-bold text-[#171717] text-xs">
                                {(u.displayName || u.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-grotesk text-sm font-medium text-[#171717] truncate">
                                {u.displayName || u.email}
                              </p>
                              <p className="font-grotesk text-xs text-neutral-500 truncate">
                                {u.email}
                                {(u.profile as any)?.clientCompany
                                  ? ` · ${(u.profile as any).clientCompany}`
                                  : ''}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShowManualRecipient(true)}
                        className="w-full mt-1 font-grotesk text-[11px] text-neutral-500 hover:text-[#171717] text-center py-1"
                      >
                        + Farklı bir e-posta
                      </button>
                    </div>
                  )}
                </div>

                {sendError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-grotesk text-xs text-red-700">{sendError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSendToClient}
                  disabled={sending || sendSuccess}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#171717] text-white rounded-xl font-grotesk text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
                >
                  {sendSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      Gönderildi
                    </>
                  ) : sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Onaya Gönder ve E-posta At
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </DndContext>
  );
};

export default SocialMediaCalendar;
