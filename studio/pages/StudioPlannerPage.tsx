import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useStudio } from '../StudioLayout';
import PlannerApp, { type ReviewData } from '../feedPlanner/review/App';
import PostPlanner from '../feedPlanner/post/PostPlanner';
import { useAuth } from '@/contexts/AuthContext';
import '../feedPlanner/review/scoped.css';
import { candidateFromInventory } from '../feedPlanner/integration/fromInventory';
import { createBlobResolver, createCopyPort, createCreativePort, createPersistencePort, fetchInventory } from '../feedPlanner/live/livePorts';
import type { PlannerPorts } from '../feedPlanner/ports';
import BrandVoiceCard from '../components/BrandVoiceCard';
import BrandGuideChat from '../components/BrandGuideChat';
import { loadVoiceState, type VoiceState } from '../brandGuideApi';

/** Verilen tarihin haftasının Pazartesi'si (yerel), YYYY-MM-DD */
export function mondayOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const REASONS: Record<string, string> = { inconsistent_asset: 'depolama kaydı tutarsız', not_ready: 'hiçbir Instagram biçimine hazır değil', dimensions_invalid: 'boyut bilgisi geçersiz' };

/** Yetkili haftalık planlayıcı: gerçek kütüphane (sayfalı), gerçek model hattı, kalıcı taslak. Örnek/yerel veri yok. */
const StudioPlannerPage: React.FC = () => {
  const { project, tenantId } = useStudio();
  // Yetkili kullanıcı: plan, yaratıcı durum ve insan metni YALNIZ bu kullanıcının oturumuna aittir; aynı tenant+proje içinde UID değişirse hepsi sıfırlanır
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  // Yüklenen veri YÜKLENDİĞİ kapsamla (tenant+proje) saklanır: kapsam değişince eski kapsamın verisi hiçbir koşulda çizilmez
  const scopeKey = `${tenantId ?? ''}|${project?.id ?? ''}|${uid}`;
  const [loaded, setLoaded] = useState<{ key: string; data: ReviewData } | null>(null);
  const data = loaded && loaded.key === scopeKey ? loaded.data : null;
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; pages: number } | null>(null);
  const [voice, setVoice] = useState<VoiceState>({ approved: null, bundle: false, guideVersion: null, loading: true });
  const [guideOpen, setGuideOpen] = useState(false);
  const [tab, setTab] = useState<'post' | 'story'>('post');
  const refreshVoice = useCallback(() => {
    if (!project) return;
    const at = scopeKey;
    // Eski kapsamın (tenant/proje) marka dili yanıtı yeni kapsama YAZILMAZ (başarı da hata da)
    loadVoiceState(project.id)
      .then((v) => { if (scopeRef.current === at) setVoice(v); })
      .catch(() => { if (scopeRef.current === at) setVoice({ approved: null, bundle: false, guideVersion: null, loading: false, error: 'Marka dili durumu okunamadı.' }); });
  }, [project?.id, scopeKey]);
  useEffect(() => { setVoice({ approved: null, bundle: false, guideVersion: null, loading: true }); setGuideOpen(false); refreshVoice(); }, [refreshVoice]);
  const blobs = useMemo(() => createBlobResolver(), [scopeKey]);
  useEffect(() => () => blobs.dispose(), [blobs]);

  useEffect(() => {
    if (!project) return;
    let alive = true;
    const at = scopeKey;
    setLoaded(null);
    setError(null);
    setProgress({ loaded: 0, pages: 0 });
    fetchInventory(project.id, (loaded, pages) => alive && setProgress({ loaded, pages }))
      .then((inv) => {
        if (!alive || scopeRef.current !== at) return;
        const notes: string[] = [];
        const candidates = inv.items.flatMap((dto) => {
          const r = candidateFromInventory(dto, { projectId: project.id });
          if (r.ok) return [r.candidate];
          notes.push(`${dto.id}: ${REASONS[r.reason] ?? r.reason} (planlayıcıya alınmadı)`);
          return [];
        });
        for (const e of inv.excluded) notes.push(`${e.id}: ${REASONS[e.reason] ?? e.reason} (sunucu envanterinden elendi)`);
        setLoaded({ key: at, data: {
          title: `${project.name} · haftalık plan`,
          dateLabel: `Hafta: ${week}`,
          archiveNote: 'Yayımlanmış geçmiş bu ekranda bağlı değil; tekrar/ritim değerlendirmesi yalnız bu haftanın planını dikkate alır.',
          scope: `Kütüphane: ${inv.items.length} kayıt, ${inv.pages} sayfada yüklendi (sayfa başına ≤100; imleç tükenene kadar). Elenen/alınmayan: ${notes.length}.`,
          weeklyStory: [],
          candidates,
          published: [],
          inventoryNotes: notes,
        } });
      })
      .catch((e) => alive && scopeRef.current === at && setError(e?.message ?? 'Katalog yüklenemedi'))
      .finally(() => alive && scopeRef.current === at && setProgress(null));
    return () => { alive = false; };
  }, [project?.id, project?.name, week, scopeKey]);

  const ports = useMemo<PlannerPorts | null>(
    () => (project ? { mode: 'studio', imageSrc: blobs.resolve, copy: createCopyPort(), creative: createCreativePort(), persistence: createPersistencePort(project.id) } : null),
    [project?.id, tenantId, uid, blobs]
  );
  if (!project || !ports) return null;

  return (
    <div className="planner-scope" data-testid="studio-planner">
      <div className="shell" style={{ paddingBottom: 0 }}>
        <label className="field" style={{ maxWidth: 260 }}>Hafta (Pazartesi)
          <input type="date" value={week} onChange={(e) => e.target.value && setWeek(mondayOf(new Date(`${e.target.value}T12:00:00`)))} />
        </label>
      </div>
      <BrandVoiceCard projectId={project.id} guideVersion={voice.guideVersion} onStartGuide={() => setGuideOpen(true)} />
      {guideOpen && <div style={{ margin: '0 16px 12px' }}><BrandGuideChat projectId={project.id} onClose={() => setGuideOpen(false)} onApproved={refreshVoice} /></div>}
      {progress && (
        <p className="counts" role="status" style={{ padding: '0 16px' }}><Loader2 className="inline w-3.5 h-3.5 animate-spin" /> Katalog yükleniyor: {progress.loaded} kayıt · {progress.pages} sayfa</p>
      )}
      {error && <p className="err shell" role="alert">Katalog yüklenemedi: {error}. Liste eksik olabileceği için planlayıcı açılmadı.</p>}
      {data && (
        <>
          {/* Post ve Story AYRI sekmelerdir. İkisi de bağlı kalır (Story durumu sekme değişince kaybolmasın); etkin olmayan gizlenir. */}
          <div role="tablist" aria-label="Planlayıcı" className="shell" style={{ display: 'flex', gap: 8, paddingBottom: 0 }}>
            <button role="tab" id="tab-post" aria-selected={tab === 'post'} aria-controls="panel-post" data-testid="tab-post" className={tab === 'post' ? 'primary' : ''} onClick={() => setTab('post')}>Post Planlayıcı</button>
            <button role="tab" id="tab-story" aria-selected={tab === 'story'} aria-controls="panel-story" data-testid="tab-story" className={tab === 'story' ? 'primary' : ''} onClick={() => setTab('story')}>Story Planlayıcı</button>
          </div>
          <div role="tabpanel" id="panel-post" aria-labelledby="tab-post" hidden={tab !== 'post'}>
            <PostPlanner
              key={`post-${scopeKey}-${week}`}
              candidates={data.candidates}
              published={data.published}
              historySource="Yayımlanmış geçmiş snapshot'ı"
              ports={ports}
              projectId={project.id}
              tenantId={tenantId}
              userId={uid}
              weekStart={week}
              voice={{ approved: voice.loading ? null : voice.approved, guideVersion: voice.guideVersion, bundle: voice.bundle }}
              onStartGuide={() => setGuideOpen(true)}
            />
          </div>
          <div role="tabpanel" id="panel-story" aria-labelledby="tab-story" hidden={tab !== 'story'}>
            <PlannerApp key={`${scopeKey}-${week}`} data={data} ports={ports} projectId={project.id} tenantId={tenantId} weekStart={week} lanes={['story']} voice={{ approved: voice.loading ? null : voice.approved }} onStartGuide={() => setGuideOpen(true)} />
          </div>
        </>
      )}
    </div>
  );
};

export default StudioPlannerPage;
