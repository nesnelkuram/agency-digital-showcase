import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FilePlus2, Inbox, Clock, MessageSquareWarning, Loader2, CalendarOff } from 'lucide-react';
import { Timestamp, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ContentPlan, SocialMediaPost } from '@/shared/types/socialMedia';
import CreatePostPanel from '@/admin/social-media/components/CreatePostPanel';
import { useStudio } from '../StudioLayout';
import CalendarBoard from '../components/CalendarBoard';
import StudioPostCard from '../components/StudioPostCard';
import StudioPostDetail from '../components/StudioPostDetail';
import { LAST_PROJECT_KEY } from './StudioHomePage';
import { NEEDS_ME, WITH_CLIENT, daysSince, getProjectPlans, getProjectPosts } from '../studioData';

type SideTab = 'todo' | 'undated';

/**
 * Studio açılış sayfası: markanın içerik takvimi (Meta Business Suite mantığında)
 * + sağ panelde yapılacaklar (senden bekleyenler, firma revizyonları, firmada bekleyen planlar).
 */
const StudioCalendarHome: React.FC = () => {
  const { project, tenantId } = useStudio();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SocialMediaPost | null>(null);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<SideTab>('todo');

  const load = useCallback(async () => {
    if (!project) return;
    setError(null);
    try {
      const [ps, pl] = await Promise.all([getProjectPosts(tenantId, project.id), getProjectPlans(tenantId, project.id)]);
      setPosts(ps);
      setPlans(pl);
    } catch (err) {
      console.error('[Studio] Takvim yüklenemedi:', err);
      setError('İçerikler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [project?.id, tenantId]);

  useEffect(() => {
    setLoading(true);
    load();
    if (project) {
      try {
        localStorage.setItem(LAST_PROJECT_KEY, project.id);
      } catch {
        // yok say
      }
    }
  }, [load]);

  const reschedule = async (post: SocialMediaPost, date: Date) => {
    if (!db) return;
    const prev = posts;
    setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, scheduledAt: Timestamp.fromDate(date) } : p)));
    try {
      await updateDoc(doc(db, 'social_media_posts', post.id), { scheduledAt: Timestamp.fromDate(date), updatedAt: serverTimestamp() });
    } catch (err) {
      console.error('[Studio] Tarih değiştirilemedi:', err);
      setPosts(prev);
      setError('Tarih değiştirilemedi.');
    }
  };

  const needsMe = useMemo(() => posts.filter((p) => NEEDS_ME.has(p.status) && p.status !== 'revision_requested'), [posts]);
  const clientRevisions = useMemo(() => posts.filter((p) => p.status === 'revision_requested'), [posts]);
  const undated = useMemo(() => posts.filter((p) => !p.scheduledAt && p.status !== 'published'), [posts]);
  const withClientPlans = useMemo(
    () => plans.filter((pl) => posts.some((p) => p.contentPlanId === pl.id && WITH_CLIENT.has(p.status))),
    [plans, posts]
  );

  if (!project) return null;

  const sidebar = (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-neutral-200">
        {(['todo', 'undated'] as SideTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg font-grotesk text-sm ${tab === t ? 'bg-neutral-100 text-[#171717] font-medium' : 'text-neutral-500'}`}
          >
            {t === 'todo' ? 'Yapılacaklar' : `Tarihsiz (${undated.length})`}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setCreateDate(null);
              setCreateOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#171717] text-white rounded-lg font-grotesk text-sm hover:bg-neutral-800"
          >
            <Plus className="w-4 h-4" /> İçerik oluştur
          </button>
          <Link
            to={`/studio/${project.id}/planlar/yeni`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-neutral-300 rounded-lg font-grotesk text-sm hover:bg-neutral-50"
          >
            <FilePlus2 className="w-4 h-4" /> Haftalık plan
          </Link>
        </div>

        {tab === 'todo' ? (
          <>
            {clientRevisions.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 font-grotesk text-sm font-semibold text-red-700">
                  <MessageSquareWarning className="w-4 h-4" /> Firma revizyon istedi ({clientRevisions.length})
                </h3>
                {clientRevisions.map((p) => (
                  <StudioPostCard key={p.id} post={p} compact onClick={() => setDetail(p)} />
                ))}
              </section>
            )}

            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 font-grotesk text-sm font-semibold text-[#171717]">
                <Inbox className="w-4 h-4" /> Senden bekleyenler ({needsMe.length})
              </h3>
              {needsMe.length === 0 ? (
                <p className="font-grotesk text-xs text-neutral-500">Şu an senden bekleyen içerik yok.</p>
              ) : (
                needsMe.slice(0, 8).map((p) => <StudioPostCard key={p.id} post={p} compact onClick={() => setDetail(p)} />)
              )}
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 font-grotesk text-sm font-semibold text-[#171717]">
                <Clock className="w-4 h-4" /> Firmada bekleyenler
              </h3>
              {withClientPlans.length === 0 ? (
                <p className="font-grotesk text-xs text-neutral-500">Firma onayında bekleyen plan yok.</p>
              ) : (
                withClientPlans.map((plan) => {
                  const waiting = daysSince(plan.sentToClientAt);
                  return (
                    <Link
                      key={plan.id}
                      to={`/studio/${project.id}/planlar/${plan.id}`}
                      className="block bg-amber-50 border border-amber-200 rounded-lg p-2.5 hover:border-amber-300"
                    >
                      <p className="font-grotesk text-sm font-medium text-[#171717] truncate">{plan.title}</p>
                      <p className="font-grotesk text-[11px] text-neutral-600">
                        {waiting === null ? 'Firmada' : waiting === 0 ? 'Bugün gönderildi' : `${waiting} gündür bekliyor`}
                        {plan.assignedClientName && ` · ${plan.assignedClientName}`}
                      </p>
                    </Link>
                  );
                })
              )}
            </section>
          </>
        ) : undated.length === 0 ? (
          <div className="text-center py-6">
            <CalendarOff className="w-6 h-6 text-neutral-300 mx-auto" />
            <p className="font-grotesk text-xs text-neutral-500 mt-2">Tarihsiz içerik yok.</p>
          </div>
        ) : (
          <section className="space-y-2">
            <p className="font-grotesk text-[11px] text-neutral-500">Takvime eklemek için bir güne sürükleyin.</p>
            {undated.map((p) => (
              <div key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/post-id', p.id)}>
                <StudioPostCard post={p} compact onClick={() => setDetail(p)} />
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {error && <p className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 font-grotesk text-sm text-red-700">{error}</p>}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <CalendarBoard
          posts={posts}
          onPostClick={setDetail}
          onCreate={(d) => {
            setCreateDate(d);
            setCreateOpen(true);
          }}
          onReschedule={reschedule}
          sidebar={sidebar}
        />
      )}

      <StudioPostDetail
        post={detail}
        onClose={() => setDetail(null)}
        onSaved={load}
        onOpenPlan={
          detail?.contentPlanId ? () => navigate(`/studio/${project.id}/planlar/${detail.contentPlanId}`) : undefined
        }
      />
      <CreatePostPanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onPostCreated={load}
        projectId={project.id}
        prefilledDate={createDate || undefined}
        studioMode
      />
    </div>
  );
};

export default StudioCalendarHome;
