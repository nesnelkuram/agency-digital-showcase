import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Loader2, Clock, CheckCircle2, Inbox, FilePlus2 } from 'lucide-react';
import type { ContentPlan, SocialMediaPost } from '@/shared/types/socialMedia';
import CreatePostPanel from '@/admin/social-media/components/CreatePostPanel';
import { useStudio } from '../StudioLayout';
import StudioPostCard from '../components/StudioPostCard';
import StudioPostDetail from '../components/StudioPostDetail';
import { DONE, NEEDS_ME, WITH_CLIENT, daysSince, getProjectPlans, getProjectPosts } from '../studioData';

/**
 * Bu Hafta — Şeyma'nın ana ekranı. Teknik adımlar değil, yapılacak iş:
 * senden bekleyenler, firmada bekleyenler, yayına hazır olanlar.
 */
const StudioThisWeekPage: React.FC = () => {
  const { project, tenantId } = useStudio();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<SocialMediaPost | null>(null);

  const load = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    setError(null);
    try {
      const [ps, pl] = await Promise.all([getProjectPosts(tenantId, project.id), getProjectPlans(tenantId, project.id)]);
      setPosts(ps);
      setPlans(pl);
    } catch (err: any) {
      console.error('[Studio] Bu hafta yüklenemedi:', err);
      setError('İçerikler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [project?.id, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const needsMe = posts.filter((p) => NEEDS_ME.has(p.status));
  const clientRevisions = needsMe.filter((p) => p.status === 'revision_requested');
  const toReview = needsMe.filter((p) => p.status !== 'revision_requested');
  const unplannedDrafts = posts.filter((p) => p.status === 'draft' && !p.contentPlanId);
  const withClientPlans = plans.filter((p) => posts.some((post) => post.contentPlanId === p.id && WITH_CLIENT.has(post.status)));
  const done = posts.filter((p) => DONE.has(p.status)).slice(0, 8);

  // Plana bağlı içerik → plan ekranı (onay işlemleri orada); plansız taslak → detay/düzenleme
  const openPost = (post: SocialMediaPost) => {
    if (post.contentPlanId && planById.has(post.contentPlanId)) navigate(`/studio/${project!.id}/planlar/${post.contentPlanId}`);
    else setDetail(post);
  };

  if (!project) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-grotesk text-2xl font-bold text-[#171717]">Bu Hafta</h1>
          <p className="font-grotesk text-sm text-neutral-500 mt-1">{project.name} için yapılacaklar</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-200 bg-white rounded-lg font-grotesk text-sm hover:bg-neutral-50"
          >
            <Plus className="w-4 h-4" /> Yeni post
          </button>
          <Link
            to={`/studio/${project.id}/planlar/yeni`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#171717] text-white rounded-lg font-grotesk text-sm hover:bg-neutral-800"
          >
            <FilePlus2 className="w-4 h-4" /> Haftalık plan
          </Link>
        </div>
      </div>

      {error && <p className="font-grotesk text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <>
          {/* Senden bekleyenler */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-grotesk text-sm font-semibold text-[#171717]">
              <Inbox className="w-4 h-4" /> Senden bekleyenler
              <span className="text-neutral-400 font-normal">({needsMe.length})</span>
            </h2>
            {needsMe.length === 0 ? (
              <p className="font-grotesk text-sm text-neutral-500 bg-white border border-neutral-200 rounded-xl p-4">
                Şu an senden bekleyen bir içerik yok.
              </p>
            ) : (
              <>
                {clientRevisions.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-grotesk text-xs text-red-600 font-medium">Firma revizyon istedi</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {clientRevisions.map((p) => (
                        <StudioPostCard key={p.id} post={p} onClick={() => openPost(p)} />
                      ))}
                    </div>
                  </div>
                )}
                {toReview.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-grotesk text-xs text-neutral-500 font-medium">Hazırlık ve kontrol</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {toReview.map((p) => (
                        <StudioPostCard key={p.id} post={p} onClick={() => openPost(p)} />
                      ))}
                    </div>
                  </div>
                )}
                {unplannedDrafts.length > 0 && (
                  <p className="font-grotesk text-xs text-neutral-500">
                    {unplannedDrafts.length} taslak henüz bir plana eklenmedi.{' '}
                    <Link to={`/studio/${project.id}/planlar/yeni`} className="underline text-neutral-700">
                      Haftalık plan oluştur
                    </Link>
                  </p>
                )}
              </>
            )}
          </section>

          {/* Firmada bekleyenler */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-grotesk text-sm font-semibold text-[#171717]">
              <Clock className="w-4 h-4" /> Firmada bekleyenler
            </h2>
            {withClientPlans.length === 0 ? (
              <p className="font-grotesk text-sm text-neutral-500 bg-white border border-neutral-200 rounded-xl p-4">
                Firma onayında bekleyen plan yok.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {withClientPlans.map((plan) => {
                  const waiting = daysSince(plan.sentToClientAt);
                  const count = posts.filter((p) => p.contentPlanId === plan.id && WITH_CLIENT.has(p.status)).length;
                  return (
                    <Link
                      key={plan.id}
                      to={`/studio/${project.id}/planlar/${plan.id}`}
                      className="bg-white border border-amber-200 rounded-xl p-3 hover:border-amber-300"
                    >
                      <p className="font-grotesk text-sm font-medium text-[#171717]">{plan.title}</p>
                      <p className="font-grotesk text-xs text-neutral-500 mt-0.5">
                        {count} içerik firmada
                        {waiting !== null && ` · ${waiting === 0 ? 'bugün gönderildi' : `${waiting} gündür bekliyor`}`}
                        {plan.assignedClientName && ` · ${plan.assignedClientName}`}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Yayına hazır */}
          {done.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-grotesk text-sm font-semibold text-[#171717]">
                <CheckCircle2 className="w-4 h-4" /> Onaylandı — yayına hazır
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {done.map((p) => (
                  <StudioPostCard key={p.id} post={p} compact onClick={() => openPost(p)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <StudioPostDetail post={detail} onClose={() => setDetail(null)} onSaved={load} />
      <CreatePostPanel open={createOpen} onClose={() => setCreateOpen(false)} onPostCreated={load} projectId={project.id} studioMode />
    </div>
  );
};

export default StudioThisWeekPage;
