import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useStudio } from '../StudioLayout';
import PlannerApp, { type ReviewData } from '../feedPlanner/review/App';
import '../feedPlanner/review/scoped.css';
import { candidateFromInventory } from '../feedPlanner/integration/fromInventory';
import { createBlobResolver, createCopyPort, createPersistencePort, fetchInventory } from '../feedPlanner/live/livePorts';
import type { PlannerPorts } from '../feedPlanner/ports';
import BrandVoiceCard from '../components/BrandVoiceCard';

/** Verilen tarihin haftasının Pazartesi'si (yerel), YYYY-MM-DD */
export function mondayOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const REASONS: Record<string, string> = { inconsistent_asset: 'depolama kaydı tutarsız', not_ready: 'hiçbir Instagram biçimine hazır değil', dimensions_invalid: 'boyut bilgisi geçersiz' };

/** Yetkili haftalık planlayıcı: gerçek kütüphane (sayfalı), gerçek model hattı, kalıcı taslak. Örnek/yerel veri yok. */
const StudioPlannerPage: React.FC = () => {
  const { project } = useStudio();
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; pages: number } | null>(null);
  const blobs = useMemo(() => createBlobResolver(), []);
  useEffect(() => () => blobs.dispose(), [blobs]);

  useEffect(() => {
    if (!project) return;
    let alive = true;
    setData(null);
    setError(null);
    setProgress({ loaded: 0, pages: 0 });
    fetchInventory(project.id, (loaded, pages) => alive && setProgress({ loaded, pages }))
      .then((inv) => {
        if (!alive) return;
        const notes: string[] = [];
        const candidates = inv.items.flatMap((dto) => {
          const r = candidateFromInventory(dto, { projectId: project.id });
          if (r.ok) return [r.candidate];
          notes.push(`${dto.id}: ${REASONS[r.reason] ?? r.reason} (planlayıcıya alınmadı)`);
          return [];
        });
        for (const e of inv.excluded) notes.push(`${e.id}: ${REASONS[e.reason] ?? e.reason} (sunucu envanterinden elendi)`);
        setData({
          title: `${project.name} · haftalık plan`,
          dateLabel: `Hafta: ${week}`,
          archiveNote: 'Yayımlanmış geçmiş bu ekranda bağlı değil; tekrar/ritim değerlendirmesi yalnız bu haftanın planını dikkate alır.',
          scope: `Kütüphane: ${inv.items.length} kayıt, ${inv.pages} sayfada yüklendi (sayfa başına ≤100; imleç tükenene kadar). Elenen/alınmayan: ${notes.length}.`,
          weeklyStory: [],
          candidates,
          published: [],
          inventoryNotes: notes,
        });
      })
      .catch((e) => alive && setError(e?.message ?? 'Katalog yüklenemedi'))
      .finally(() => alive && setProgress(null));
    return () => { alive = false; };
  }, [project?.id, project?.name, week]);

  const ports = useMemo<PlannerPorts | null>(
    () => (project ? { mode: 'studio', imageSrc: blobs.resolve, copy: createCopyPort(), persistence: createPersistencePort(project.id) } : null),
    [project?.id, blobs]
  );
  if (!project || !ports) return null;

  return (
    <div className="planner-scope" data-testid="studio-planner">
      <div className="shell" style={{ paddingBottom: 0 }}>
        <label className="field" style={{ maxWidth: 260 }}>Hafta (Pazartesi)
          <input type="date" value={week} onChange={(e) => e.target.value && setWeek(mondayOf(new Date(`${e.target.value}T12:00:00`)))} />
        </label>
      </div>
      <BrandVoiceCard projectId={project.id} />
      {progress && (
        <p className="counts" role="status" style={{ padding: '0 16px' }}><Loader2 className="inline w-3.5 h-3.5 animate-spin" /> Katalog yükleniyor: {progress.loaded} kayıt · {progress.pages} sayfa</p>
      )}
      {error && <p className="err shell" role="alert">Katalog yüklenemedi: {error}. Liste eksik olabileceği için planlayıcı açılmadı.</p>}
      {data && <PlannerApp key={week} data={data} ports={ports} projectId={project.id} weekStart={week} />}
    </div>
  );
};

export default StudioPlannerPage;
