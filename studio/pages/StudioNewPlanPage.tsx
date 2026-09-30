import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { SocialMediaPost, SocialPlatform } from '@/shared/types/socialMedia';
import { createContentPlan } from '@/shared/services/contentPlanService';
import { useAuth } from '@/contexts/AuthContext';
import { useStudio } from '../StudioLayout';
import StudioPostCard from '../components/StudioPostCard';
import { getProjectPosts } from '../studioData';

/** Pazartesi başlangıçlı hafta (yerel saat) */
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}
const toInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Yeni haftalık plan: hafta seç → henüz plana bağlanmamış taslakları seç → oluştur */
const StudioNewPlanPage: React.FC = () => {
  const { project, tenantId } = useStudio();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  // Varsayılan: bir sonraki hafta (iki onay turuna zaman kalsın)
  const [weekStart, setWeekStart] = useState(() => {
    const next = mondayOf(new Date());
    next.setDate(next.getDate() + 7);
    return toInput(next);
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    getProjectPosts(tenantId, project.id)
      .then((all) => setPosts(all.filter((p) => !p.contentPlanId && ['draft', 'internal_review'].includes(p.status))))
      .catch((err) => console.error('[Studio] Taslaklar yüklenemedi:', err))
      .finally(() => setLoading(false));
  }, [project?.id, tenantId]);

  const range = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [weekStart]);

  // Hafta içine düşen taslakları varsayılan seç
  useEffect(() => {
    const inWeek = posts.filter((p) => {
      const d: Date | undefined = (p.scheduledAt as any)?.toDate?.();
      return d && d >= range.start && d <= range.end;
    });
    setSelected(new Set(inWeek.map((p) => p.id)));
  }, [posts, range.start.getTime()]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleCreate = async () => {
    if (!project || !user || selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const chosen = posts.filter((p) => selected.has(p.id));
      const counts = new Map<string, number>();
      chosen.forEach((p) => (p.platforms || []).forEach((pl) => counts.set(pl, (counts.get(pl) || 0) + 1)));
      const platform = (Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'instagram') as SocialPlatform;
      const fmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      const planId = await createContentPlan(
        tenantId,
        {
          projectId: project.id,
          title: `${project.name} — ${fmt(range.start)} / ${fmt(range.end)}`,
          platform,
          postIds: chosen.map((p) => p.id),
          weekStartDate: Timestamp.fromDate(range.start),
          weekEndDate: Timestamp.fromDate(range.end),
        },
        user.uid,
        user.displayName || user.email || 'Studio'
      );
      navigate(`/studio/${project.id}/planlar/${planId}`);
    } catch (err: any) {
      console.error('[Studio] Plan oluşturulamadı:', err);
      setError('Plan oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  if (!project) return null;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">Haftalık plan</h1>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">
          Haftayı seçin ve plana eklenecek içerikleri işaretleyin. Kontrol ve firma onayı plan ekranından yapılır.
        </p>
      </div>

      <div className="glass-card p-4 flex items-end gap-3 flex-wrap">
        <label className="font-grotesk text-xs text-neutral-600">
          Hafta başlangıcı (Pazartesi)
          <input
            type="date"
            value={weekStart}
            onChange={(e) => e.target.value && setWeekStart(toInput(mondayOf(new Date(`${e.target.value}T00:00:00`))))}
            className="block mt-1 px-3 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm"
          />
        </label>
        <p className="font-grotesk text-xs text-neutral-500 pb-2">
          {range.start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} – {range.end.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : posts.length === 0 ? (
        <p className="font-grotesk text-sm text-neutral-500 glass-card p-6 text-center">
          Plana eklenecek taslak yok. Önce "Bu Hafta" ekranından post oluşturun.
        </p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <label key={p.id} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="mt-4" />
              <div className="flex-1">
                <StudioPostCard post={p} compact />
              </div>
            </label>
          ))}
        </div>
      )}

      {error && <p className="font-grotesk text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={saving || selected.size === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#111] text-white rounded-full font-grotesk text-sm disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Planı oluştur ({selected.size})
        </button>
        <button onClick={() => navigate(-1)} className="px-4 py-2 border border-neutral-200 rounded-lg font-grotesk text-sm">
          Vazgeç
        </button>
      </div>
    </div>
  );
};

export default StudioNewPlanPage;
