import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FilePlus2, Inbox, Clock, MessageSquareWarning, Loader2, CalendarOff, AlertTriangle } from 'lucide-react';
import { Timestamp, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ContentPlan, SocialMediaPost } from '@/shared/types/socialMedia';
import CreatePostPanel from '@/admin/social-media/components/CreatePostPanel';
import { useStudio } from '../StudioLayout';
import CalendarBoard from '../components/CalendarBoard';
import StudioPostCard from '../components/StudioPostCard';
import StudioPostDetail, { EDITABLE_STATUSES } from '../components/StudioPostDetail';
import LibraryDrawer from '../components/LibraryDrawer';
import { isConsistentAsset, type BrandMediaAsset } from '@/shared/types/brandMedia';
import { getClientMediaPolicy } from '../library/mediaPolicy';
import { runApprovalAction } from '@/shared/services/contentApprovalApi';
import { LAST_PROJECT_KEY } from './StudioHomePage';
import { NEEDS_ME, WITH_CLIENT, STUDIO_STATUS_LABEL, daysSince, formatDate, getProjectPlans, getProjectPosts } from '../studioData';

type SideTab = 'todo' | 'undated' | 'library';

/** Onaylı/firmadaki içeriğin taşınması: kullanıcıya yeniden onay sonucu açıkça sorulur */
interface PendingMove {
  post: SocialMediaPost;
  date: Date;
}

/**
 * Studio açılış sayfası: markanın içerik takvimi (Meta Business Suite mantığında)
 * + sağ panelde yapılacaklar (senden bekleyenler, firma revizyonları, firmada bekleyen planlar).
 */
const StudioCalendarHomeInner: React.FC = () => {
  const { project, tenantId, timeZone, timeZoneIsDefault } = useStudio();
  /** Bu bileşen marka (tenant+proje) anahtarıyla kurulur; yine de geç gelen yanıtlar nesille elenir */
  const generation = useRef(0);
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SocialMediaPost | null>(null);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<SideTab>('todo');
  const [libraryAssets, setLibraryAssets] = useState<BrandMediaAsset[]>([]);
  const [createAssets, setCreateAssets] = useState<BrandMediaAsset[] | undefined>(undefined);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moving, setMoving] = useState(false);

  const load = useCallback(async () => {
    if (!project) return;
    const gen = ++generation.current;
    setError(null);
    try {
      const [ps, pl] = await Promise.all([getProjectPosts(tenantId, project.id), getProjectPlans(tenantId, project.id)]);
      if (gen !== generation.current) return;
      setPosts(ps.filter((p) => p.projectId === project.id));
      setPlans(pl.filter((p) => p.projectId === project.id));
    } catch (err) {
      console.error('[Studio] Takvim yüklenemedi:', err);
      if (gen === generation.current) setError('İçerikler yüklenemedi.');
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, [project?.id, tenantId]);

  // Unmount (marka değişimi dahil): bekleyen tüm yanıtlar yok sayılır
  useEffect(
    () => () => {
      generation.current++;
    },
    []
  );

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

  /** Henüz onaya gitmemiş içerik: yalnız zaman (istemci, kurallar izin verir) */
  const rescheduleDraft = async (post: SocialMediaPost, date: Date) => {
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

  /** Firmadaki/onaylı içerik: zaman onayın parçası → sunucu 'reschedule' (iç incelemeye döner, yeni tur) */
  const reschedule = (post: SocialMediaPost, date: Date) => {
    if (!project || post.projectId !== project.id) return;
    if (EDITABLE_STATUSES.has(post.status)) return rescheduleDraft(post, date);
    if (!post.contentPlanId) {
      setError('Bu içerik bir plana bağlı değil; zamanı değiştirilemez.');
      return;
    }
    setPendingMove({ post, date });
  };

  const confirmMove = async () => {
    if (!pendingMove?.post.contentPlanId || !project) return;
    // Savunma: taşıma yalnız açık markanın içeriği ve onun planı için
    const plan = plans.find((p) => p.id === pendingMove.post.contentPlanId);
    if (pendingMove.post.projectId !== project.id || !plan || plan.projectId !== project.id) {
      setPendingMove(null);
      setError('Bu içerik açık markaya ait değil.');
      return;
    }
    setMoving(true);
    setError(null);
    try {
      await runApprovalAction({
        planId: pendingMove.post.contentPlanId,
        action: 'reschedule',
        postIds: [pendingMove.post.id],
        scheduledAt: pendingMove.date.getTime(),
      });
      setPendingMove(null);
      await load();
    } catch (err: any) {
      console.error('[Studio] Yeniden zamanlama başarısız:', err);
      setError(err?.message || 'Zaman değiştirilemedi.');
      setPendingMove(null);
    } finally {
      setMoving(false);
    }
  };

  /** Hücreye tıklama veya kütüphane dosyası bırakma: o gün/saatle yeni içerik */
  const createAt = (date: Date, libraryAssetId?: string) => {
    const found = libraryAssetId ? libraryAssets.find((a) => a.id === libraryAssetId) : undefined;
    // Savunma: bırakılan dosya bu tenant/projeye ait ve katalog–dosya tutarlı olmalı
    const asset = found && project && isConsistentAsset(found, tenantId, project.id, getClientMediaPolicy()) ? found : undefined;
    if (libraryAssetId && !asset) {
      setError('Bırakılan dosya bu markanın kütüphanesinde bulunamadı.');
      return;
    }
    setCreateDate(date);
    setCreateAssets(asset ? [asset] : undefined);
    setCreateOpen(true);
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
        {(['todo', 'undated', 'library'] as SideTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg font-grotesk text-sm ${tab === t ? 'bg-neutral-100 text-[#171717] font-medium' : 'text-neutral-500'}`}
          >
            {t === 'todo' ? 'Yapılacaklar' : t === 'undated' ? `Tarihsiz (${undated.length})` : 'Kütüphane'}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setCreateDate(null);
              setCreateAssets(undefined);
              setCreateOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#111] text-white rounded-full font-grotesk text-sm hover:bg-neutral-800"
          >
            <Plus className="w-4 h-4" /> İçerik oluştur
          </button>
          <Link
            to={`/studio/${project.id}/planlar/yeni`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 glass-chip font-grotesk text-sm hover:bg-neutral-50"
          >
            <FilePlus2 className="w-4 h-4" /> Haftalık plan
          </Link>
        </div>

        {tab === 'library' ? (
          <LibraryDrawer tenantId={tenantId} projectId={project.id} onAssets={setLibraryAssets} />
        ) : tab === 'todo' ? (
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
                      className="block glass-tile !bg-amber-50/70 !border-amber-200 p-2.5 hover:border-amber-300"
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
          onCreate={createAt}
          onReschedule={reschedule}
          sidebar={sidebar}
          timeZone={timeZone}
          timeZoneIsDefault={timeZoneIsDefault}
        />
      )}

      <StudioPostDetail
        post={detail}
        tenantId={tenantId}
        onClose={() => setDetail(null)}
        onSaved={load}
        onOpenPlan={
          detail?.contentPlanId ? () => navigate(`/studio/${project.id}/planlar/${detail.contentPlanId}`) : undefined
        }
      />
      <CreatePostPanel
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateAssets(undefined);
        }}
        onPostCreated={load}
        projectId={project.id}
        prefilledDate={createDate || undefined}
        studioMode
        timeZone={timeZone}
        initialLibraryAssets={createAssets}
      />
      {pendingMove && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => !moving && setPendingMove(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3" role="dialog" aria-label="Yeniden onay gerekli" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-center gap-2 font-grotesk text-base font-semibold text-[#171717]">
              <AlertTriangle className="w-5 h-5 text-amber-600" /> Yeniden onay gerekli
            </p>
            <p className="font-grotesk text-sm text-neutral-700">
              Bu içerik şu an “{STUDIO_STATUS_LABEL[pendingMove.post.status] || pendingMove.post.status}”. Paylaşım zamanı onayın parçasıdır:
              yeni zaman ({formatDate({ toDate: () => pendingMove.date }, true)}) kaydedilince içerik iç incelemeye döner, mevcut onaylar
              temizlenir ve firmanın açık onay ekranı geçersiz olur. Firmaya yeniden göndermeniz gerekir.
            </p>
            <div className="flex justify-end gap-2">
              <button disabled={moving} onClick={() => setPendingMove(null)} className="px-4 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm">
                Vazgeç
              </button>
              <button disabled={moving} onClick={confirmMove} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#111] text-white rounded-full font-grotesk text-sm disabled:opacity-50">
                {moving && <Loader2 className="w-4 h-4 animate-spin" />} Zamanı değiştir ve iç incelemeye al
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Marka değişince sayfa yeniden kurulur: açık editör, taşıma penceresi, seçimler ve eski yanıtlar taşınmaz */
const StudioCalendarHome: React.FC = () => {
  const { project, tenantId } = useStudio();
  return <StudioCalendarHomeInner key={`${tenantId}:${project?.id || ''}`} />;
};

export default StudioCalendarHome;
