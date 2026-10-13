import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStudio } from '../StudioLayout';
import { getBrandKit, type BrandKit } from '../studioData';
import BrandVoiceCard from '../components/BrandVoiceCard';
import BrandGuideChat from '../components/BrandGuideChat';
import { loadVoiceState, type VoiceState } from '../brandGuideApi';
import '../feedPlanner/review/scoped.css';

const List: React.FC<{ title: string; items?: string[] }> = ({ title, items }) =>
  items && items.length > 0 ? (
    <div>
      <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it} className="px-2 py-0.5 bg-neutral-100 rounded-full font-grotesk text-xs text-neutral-700">
            {it}
          </span>
        ))}
      </div>
    </div>
  ) : null;

/**
 * Marka dili (yazı rehberi) yönetimi: durum, "birlikte oluştur" sohbeti, onay ve gelişmiş paket yükleme BURADADIR.
 * Post planlayıcı yüzeyini doldurmaz; onaylı rehber metin üretiminde arka planda kullanılmaya devam eder.
 */
const VoiceSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { plannerDrafts, tenantId } = useStudio();
  const { user } = useAuth();
  const { hash } = useLocation();
  const ref = useRef<HTMLElement | null>(null);
  const [voice, setVoice] = useState<VoiceState>({ approved: null, bundle: false, guideVersion: null, loading: true });
  const [guideOpen, setGuideOpen] = useState(false);
  /** Yanıt yalnız İSTEĞİN yapıldığı kapsam (tenant+proje+uid) hâlâ geçerliyse yazılır: eski kapsamın geç rehber sürümü yeni kapsamda görünmez */
  const scope = `${tenantId ?? ''}|${projectId}|${user?.uid ?? ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const refresh = useCallback(() => {
    const at = scope;
    loadVoiceState(projectId)
      .then((v) => { if (scopeRef.current === at) setVoice(v); })
      .catch(() => { if (scopeRef.current === at) setVoice({ approved: null, bundle: false, guideVersion: null, loading: false, error: 'Marka dili durumu okunamadı.' }); });
  }, [projectId, scope]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (hash === '#marka-dili') ref.current?.scrollIntoView?.({ block: 'start' }); }, [hash]);
  const draft = plannerDrafts?.get(`${tenantId ?? ''}|${projectId}|${user?.uid ?? ''}`);
  return (
    <section id="marka-dili" ref={ref} className="planner-scope" aria-label="Marka dili" data-testid="brand-kit-voice">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="font-grotesk text-lg font-bold text-[#171717]">Marka dili (yazı rehberi)</h2>
        <Link to={`/studio/${projectId}/planlayici`} className="font-grotesk text-sm underline text-neutral-700" data-testid="back-to-planner">← Planlayıcıya dön</Link>
      </div>
      {draft && draft.plan.posts.length > 0 && (
        <p className="font-grotesk text-xs text-neutral-500 mb-2" data-testid="draft-kept-note">Post planınız ({draft.plan.posts.length} post) bu oturumda korunuyor; sayfayı yenilerseniz ya da kapatırsanız kaybolur.</p>
      )}
      <div style={{ margin: '0 -16px' }}>
        <BrandVoiceCard projectId={projectId} guideVersion={voice.guideVersion} onStartGuide={() => setGuideOpen(true)} />
        {guideOpen && <div style={{ margin: '0 16px 12px' }}><BrandGuideChat projectId={projectId} onClose={() => setGuideOpen(false)} onApproved={refresh} /></div>}
      </div>
    </section>
  );
};

/** Marka Kiti — marka sesi ve kimlik özeti (AI üretimi de bunu kullanır) + marka dili (yazı rehberi) yönetimi */
const StudioBrandKitPage: React.FC = () => {
  const { project, tenantId } = useStudio();
  const { user } = useAuth();
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scope = `${tenantId ?? ''}|${project?.id ?? ''}|${user?.uid ?? ''}`;

  useEffect(() => {
    if (!project) return;
    let alive = true; // kapsam değişince eski kapsamın geç yanıtı (başarı ya da hata) yazılmaz
    setKit(null);
    setError(null);
    getBrandKit(project.id)
      .then((k) => { if (alive) setKit(k); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [project?.id, scope]);

  if (!project) return null;
  if (error) return <div className="space-y-5 max-w-3xl"><p className="font-grotesk text-sm text-red-600">{error}</p><VoiceSection key={scope} projectId={project.id} /></div>;
  if (!kit) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const f = kit.brand?.sourceFields || {};
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="font-grotesk text-2xl font-bold text-[#171717]">Marka Kiti</h1>
        <p className="font-grotesk text-sm text-neutral-500 mt-1">{kit.project.name}</p>
      </div>

      {!kit.brand || !kit.brand.hasAnalysis ? (
        <p className="font-grotesk text-sm text-neutral-500 glass-card p-6">
          Bu marka için henüz marka analizi yok. Analiz tamamlandığında marka sesi burada görünecek.
        </p>
      ) : (
        <div className="glass-card p-5 space-y-4">
          <div>
            <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">Marka sesi</p>
            <p className="font-grotesk text-sm text-[#171717]">{kit.brand.voiceSummary}</p>
          </div>
          {f.oneLinePromise && (
            <div>
              <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">Tek cümlelik vaat</p>
              <p className="font-grotesk text-sm text-neutral-700">{f.oneLinePromise}</p>
            </div>
          )}
          {f.targetAudience && (
            <div>
              <p className="font-grotesk text-xs font-medium text-neutral-500 mb-1">Hedef kitle</p>
              <p className="font-grotesk text-sm text-neutral-700">{f.targetAudience}</p>
            </div>
          )}
          <List title="Kişilik" items={f.traits} />
          <List title="Biz buyuz" items={f.weAreThis} />
          <List title="Biz bu değiliz" items={f.weAreNotThis} />
          <List title="Duygu / ton anahtar kelimeleri" items={f.moodKeywords} />
          {Array.isArray(f.behaviors) && f.behaviors.length > 0 && (
            <div>
              <p className="font-grotesk text-xs font-medium text-neutral-500 mb-2">Yapılacaklar / yapılmayacaklar</p>
              <div className="space-y-2">
                {f.behaviors.map((b: any, i: number) => (
                  <div key={i} className="bg-neutral-50 rounded-lg p-3">
                    <p className="font-grotesk text-xs font-semibold text-[#171717]">{b.value}</p>
                    <p className="font-grotesk text-xs text-green-700 mt-1">✓ {b.do}</p>
                    <p className="font-grotesk text-xs text-red-600">✕ {b.dont}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <VoiceSection key={scope} projectId={project.id} />
    </div>
  );
};

export default StudioBrandKitPage;
