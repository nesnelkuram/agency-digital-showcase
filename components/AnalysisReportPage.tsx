import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Compass, Users, Lightbulb, Palette, Building2,
  MessageSquare, Hash, Target, TrendingUp, BarChart3, Shield,
  ExternalLink, ChevronRight, Sparkles,
  CheckCircle2, AlertTriangle, Zap, ArrowRight, Clock,
} from 'lucide-react';
import { getBrandLeadByShareToken } from '@/shared/services/brandLeadService';
import { SECTOR_LABELS } from '@/shared/types/brandLead';
import type { BrandLead, AIAnalysis, BusinessContext } from '@/shared/types/brandLead';

// ─── BusinessContext Label Maps ──────────────────────────

const GEO_SCOPE_LABELS: Record<string, string> = {
  local: 'Yerel (Mahalle/Semt)',
  city: 'Tek Sehir',
  multi_city: 'Birden Fazla Sehir',
  national: 'Turkiye Geneli',
  international: 'Uluslararasi',
};

const BUSINESS_STAGE_LABELS: Record<string, string> = {
  idea: 'Fikir Asamasi',
  new: 'Yeni Kuruldu (0-1 yil)',
  growing: 'Buyume Asamasi (1-3 yil)',
  established: 'Yerlesik (3+ yil)',
};

const DIGITAL_PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  website: 'Web Sitesi',
  google_business: 'Google Business',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  none: 'Aktif Platform Yok',
};

// ─── Helpers ───────────────────────────────────────────

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-7 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, color }: { icon: any; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className={`w-8 h-8 rounded-lg bg-${color}-50 flex items-center justify-center`}>
        <Icon className={`w-4 h-4 text-${color}-600`} />
      </div>
      <h2 className="font-ramillas text-lg sm:text-xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  return (
    <span className={`inline-block text-xs font-commons font-medium px-2.5 py-1 rounded-full bg-${color}-50 text-${color}-700`}>
      {children}
    </span>
  );
}

function InfoBlock({ label, children, color = 'gray' }: { label: string; children: React.ReactNode; color?: string }) {
  return (
    <div className={`bg-${color}-50 rounded-xl p-4`}>
      <p className={`font-commons text-[11px] text-${color}-500 uppercase tracking-wider font-medium mb-1.5`}>{label}</p>
      <div className="font-commons text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────

const AnalysisReportPage: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [lead, setLead] = useState<BrandLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!shareToken) { setError(true); setLoading(false); return; }

    // noindex meta tag
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    getBrandLeadByShareToken(shareToken)
      .then((result) => {
        if (!result || !result.aiAnalysis) { setError(true); } else { setLead(result); }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    return () => { document.head.removeChild(meta); };
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-300 border-t-gray-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="font-commons text-sm text-gray-500">Rapor yukleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !lead || !lead.aiAnalysis) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="font-ramillas text-2xl font-bold text-gray-900 mb-2">Rapor Bulunamadi</h1>
          <p className="font-commons text-gray-500 mb-6">Bu rapor linki gecersiz veya suresi dolmus olabilir.</p>
          <a href="https://intiba.co.uk" className="font-commons text-sm text-indigo-600 hover:text-indigo-700">
            intiba.co.uk &rarr;
          </a>
        </div>
      </div>
    );
  }

  const a = lead.aiAnalysis;
  const businessName = lead.contact.businessName;
  const sector = SECTOR_LABELS[lead.sector] || lead.sector;
  const bc = lead.wizard?.businessContext;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── HEADER ─── */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between">
          <img src="/images/intibalogo.svg" alt="intiba" className="h-6 sm:h-7 invert" />
          <span className="font-commons text-xs text-gray-400">Marka Strateji Raporu</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 sm:space-y-8">
        {/* ─── COVER / TITLE ─── */}
        <SectionCard className="!p-8 sm:!p-10 bg-gradient-to-br from-white to-gray-50">
          <p className="font-commons text-xs text-gray-400 uppercase tracking-widest mb-3">{sector}</p>
          <h1 className="font-ramillas text-3xl sm:text-4xl font-bold text-gray-900 mb-3">{businessName}</h1>
          <p className="font-commons text-sm text-gray-500">
            {formatDate(a.analyzedAt)}
          </p>
        </SectionCard>

        {/* ─── CONSULTANT INTRO (danışman giriş yorumu) ─── */}
        {a.consultantIntro && (
          <SectionCard className="border-l-4 border-l-indigo-400">
            <p className="font-commons text-sm sm:text-base text-gray-700 leading-relaxed italic">
              {a.consultantIntro}
            </p>
          </SectionCard>
        )}

        {/* ─── BUSINESS PROFILE (from v2.0 wizard context) ─── */}
        {bc && <BusinessProfileSection bc={bc} />}

        {/* ─── UNIFIED STRATEGY (synthesisRationale from debate) ─── */}
        {a.debate?.synthesisRationale && (
          <SectionCard>
            <SectionTitle icon={Sparkles} title="Strateji Ozeti" color="indigo" />
            <p className="font-commons text-sm text-gray-700 leading-relaxed">{a.debate.synthesisRationale}</p>
          </SectionCard>
        )}

        {/* ─── BRAND PERSONALITY (isletmenin kendi analizi — rakiplerden once) ─── */}
        {a.brandPersonality && <BrandPersonalityReport bp={a.brandPersonality} />}

        {/* ─── POSITIONING ─── */}
        {a.positioning && <PositioningReport positioning={a.positioning} />}

        {/* ─── SWOT (isletme analizi — rakiplerden once) ─── */}
        {a.analysis && <SwotReport analysis={a.analysis} />}

        {/* ─── COMPETITOR ANALYSIS ─── */}
        {a.sectorResearch?.competitors && a.sectorResearch.competitors.length > 0 && (
          <CompetitorReport competitors={a.sectorResearch.competitors} />
        )}

        {/* ─── MARKET DATA ─── */}
        {a.sectorResearch?.marketData && <MarketDataReport md={a.sectorResearch.marketData} />}

        {/* ─── VISUAL WORLD ─── */}
        {a.visualWorld && <VisualWorldReport vw={a.visualWorld} />}

        {/* ─── CONTENT STRATEGY (blog advisor insights merged) ─── */}
        {a.contentStrategy && <ContentStrategyReport cs={a.contentStrategy} blogInsights={(a as any).blogAdvisorInsights} />}

        {/* ─── ACTION PLAN ─── */}
        {a.actionPlan && <ActionPlanReport ap={a.actionPlan} />}

        {/* ─── CTA: Intiba ile Nasil Calisabilirsiniz ─── */}
        <CTASection requestedServices={lead.requestedServices} businessName={businessName} />
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-gray-100 bg-white mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/images/intibalogo.svg" alt="intiba" className="h-5 invert" />
            <p className="font-commons text-xs text-gray-400">Bu rapor intiba marka strateji analiz sistemi ile olusturulmustur.</p>
          </div>
          <a href="https://intiba.co.uk" target="_blank" rel="noopener noreferrer" className="font-commons text-xs text-indigo-500 hover:text-indigo-600">
            intiba.co.uk
          </a>
        </div>
      </footer>
    </div>
  );
};

// ─── Section Components ────────────────────────────────

function PositioningReport({ positioning }: { positioning: NonNullable<AIAnalysis['positioning']> }) {
  const vpr = positioning.valuePropositionReasoning;
  const segments = positioning.targetSegments;

  return (
    <SectionCard>
      <SectionTitle icon={Compass} title="Marka Konumlandirmasi" color="cyan" />

      {/* Statement */}
      <div className="bg-cyan-50 rounded-xl p-5 mb-5">
        <p className="font-commons text-[11px] text-cyan-500 uppercase tracking-wider font-medium mb-2">Konumlandirma Ifadesi</p>
        <p className="font-commons text-base text-gray-900 font-medium leading-relaxed italic">
          &ldquo;{positioning.statement}&rdquo;
        </p>
      </div>

      {/* Value Proposition */}
      {vpr && vpr.whatBusinessProduces && (
        <div className="bg-amber-50 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <p className="font-commons text-[11px] text-amber-600 uppercase tracking-wider font-medium">Deger Onerisi Analizi</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              ['Ne Uretiyor', vpr.whatBusinessProduces],
              ['Temel Fayda', vpr.coreBenefit],
              ['Kimin Icin', vpr.whoBenefits],
              ['Fiyat Konumu', vpr.pricePositioning],
              ['Odemeye Istekli Profil', vpr.willingToPayProfile],
            ].map(([label, value]) => value ? (
              <div key={label} className="bg-white rounded-lg p-3 border border-amber-200">
                <p className="font-commons text-[10px] text-amber-500 uppercase font-medium mb-0.5">{label}</p>
                <p className="font-commons text-sm text-gray-700">{value}</p>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* Target Audience + Differentiator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <InfoBlock label="Hedef Kitle" color="indigo">{positioning.targetAudience}</InfoBlock>
        <InfoBlock label="Temel Farklilik" color="teal">{positioning.differentiator}</InfoBlock>
      </div>

      <InfoBlock label="Rekabet Avantaji" color="violet">{positioning.competitiveAdvantage}</InfoBlock>

      {/* Target Segments */}
      {segments && segments.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-pink-600" />
            <p className="font-commons text-[11px] text-pink-600 uppercase tracking-wider font-medium">Hedef Kitle Segmentleri</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {segments.map((seg, i) => (
              <div key={i} className="bg-pink-50 rounded-xl p-4 border border-pink-100">
                <p className="font-commons text-sm font-semibold text-gray-900 mb-2">{seg.segmentLabel}</p>
                <div className="space-y-1.5 text-xs font-commons text-gray-600">
                  <p><span className="text-pink-500 font-medium">Demografi:</span> {seg.demographics}</p>
                  <p><span className="text-pink-500 font-medium">Davranis:</span> {seg.behavioralProfile}</p>
                  <p><span className="text-pink-500 font-medium">Ihtiyac:</span> {seg.coreNeed}</p>
                  <p><span className="text-pink-500 font-medium">Medya:</span> {seg.mediaHabits}</p>
                  {seg.purchaseTriggers?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {seg.purchaseTriggers.map((t, j) => (
                        <span key={j} className="text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function BusinessProfileSection({ bc }: { bc: BusinessContext }) {
  const hasContent = bc.businessDescription || bc.geoScope || bc.businessStage ||
    (bc.digitalPresence && bc.digitalPresence.length > 0 && !bc.digitalPresence.includes('none'));
  if (!hasContent) return null;

  return (
    <SectionCard>
      <SectionTitle icon={Building2} title="Isletme Profili" color="slate" />

      {bc.businessDescription && (
        <p className="font-commons text-sm text-gray-700 leading-relaxed mb-4">{bc.businessDescription}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {bc.geoScope && (
          <InfoBlock label="Cografi Kapsam" color="slate">
            {GEO_SCOPE_LABELS[bc.geoScope] || bc.geoScope}
          </InfoBlock>
        )}
        {bc.businessStage && (
          <InfoBlock label="Isletme Asamasi" color="slate">
            {BUSINESS_STAGE_LABELS[bc.businessStage] || bc.businessStage}
          </InfoBlock>
        )}
        {bc.digitalPresence && bc.digitalPresence.length > 0 && !bc.digitalPresence.includes('none') && (
          <InfoBlock label="Dijital Varlik" color="slate">
            {bc.digitalPresence.map(p => DIGITAL_PLATFORM_LABELS[p] || p).join(', ')}
          </InfoBlock>
        )}
      </div>
    </SectionCard>
  );
}

function BrandPersonalityReport({ bp }: { bp: NonNullable<AIAnalysis['brandPersonality']> }) {
  return (
    <SectionCard>
      <SectionTitle icon={Sparkles} title="Marka Kisiligi" color="purple" />
      <div className="bg-purple-50 rounded-xl p-5 mb-4">
        <p className="font-commons text-[11px] text-purple-500 uppercase tracking-wider font-medium mb-1">Arketip</p>
        <p className="font-ramillas text-xl font-bold text-gray-900">{bp.archetype}</p>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {bp.traits.map((t, i) => <Badge key={i} color="purple">{t}</Badge>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoBlock label="Iletisim Tonu" color="purple">{bp.tone}</InfoBlock>
        <InfoBlock label="Marka Sesi" color="purple">{bp.voice}</InfoBlock>
      </div>
    </SectionCard>
  );
}

function CompetitorReport({ competitors }: { competitors: NonNullable<AIAnalysis['sectorResearch']>['competitors'] }) {
  return (
    <SectionCard>
      <SectionTitle icon={Target} title="Rekabet Analizi" color="emerald" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {competitors.map((c, i) => (
          <div key={i} className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
            <div className="flex items-center justify-between mb-2">
              <p className="font-commons text-sm font-semibold text-gray-900">{c.name}</p>
              {c.website && (
                <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-600">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            <p className="font-commons text-xs text-gray-600 mb-3">{c.positioning}</p>
            {c.strengths?.length > 0 && (
              <div className="mb-2">
                <p className="font-commons text-[10px] text-emerald-600 uppercase font-medium mb-1">Guclu Yonler</p>
                <ul className="space-y-0.5">
                  {c.strengths.map((s, j) => (
                    <li key={j} className="font-commons text-xs text-gray-600 flex gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {c.weaknesses?.length > 0 && (
              <div>
                <p className="font-commons text-[10px] text-orange-600 uppercase font-medium mb-1">Zayif Yonler</p>
                <ul className="space-y-0.5">
                  {c.weaknesses.map((w, j) => (
                    <li key={j} className="font-commons text-xs text-gray-600 flex gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function MarketDataReport({ md }: { md: NonNullable<NonNullable<AIAnalysis['sectorResearch']>['marketData']> }) {
  return (
    <SectionCard>
      <SectionTitle icon={BarChart3} title="Pazar Verileri" color="blue" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          ['Pazar Buyuklugu', md.marketSize],
          ['Buyume Hizi', md.growthRate],
        ].map(([label, val]) => val ? (
          <div key={label as string} className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="font-commons text-[10px] text-blue-500 uppercase font-medium mb-1">{label}</p>
            <p className="font-commons text-sm font-semibold text-gray-900">{val}</p>
          </div>
        ) : null)}
        {md.keyPlayers?.length > 0 && (
          <div className="col-span-2 bg-blue-50 rounded-xl p-4">
            <p className="font-commons text-[10px] text-blue-500 uppercase font-medium mb-1">Anahtar Oyuncular</p>
            <p className="font-commons text-sm text-gray-700">{md.keyPlayers.join(', ')}</p>
          </div>
        )}
      </div>
      {md.consumerTrends?.length > 0 && (
        <div className="bg-sky-50 rounded-xl p-4">
          <p className="font-commons text-[10px] text-sky-500 uppercase font-medium mb-2">Tuketici Trendleri</p>
          <div className="flex flex-wrap gap-2">
            {md.consumerTrends.map((t, i) => <Badge key={i} color="sky">{t}</Badge>)}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function SwotReport({ analysis }: { analysis: NonNullable<AIAnalysis['analysis']> }) {
  const sections = [
    { key: 'strengths', label: 'Guclu Yonler', items: analysis.strengths, color: 'emerald', icon: CheckCircle2 },
    { key: 'opportunities', label: 'Firsatlar', items: analysis.opportunities, color: 'blue', icon: TrendingUp },
    { key: 'challenges', label: 'Zorluklar', items: analysis.challenges, color: 'amber', icon: AlertTriangle },
    { key: 'recommendations', label: 'Oneriler', items: analysis.recommendations, color: 'purple', icon: Sparkles },
  ];

  return (
    <SectionCard>
      <SectionTitle icon={Shield} title="Stratejik Analiz" color="indigo" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => s.items?.length > 0 ? (
          <div key={s.key} className={`bg-${s.color}-50 rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <s.icon className={`w-4 h-4 text-${s.color}-600`} />
              <p className={`font-commons text-[11px] text-${s.color}-600 uppercase tracking-wider font-medium`}>{s.label}</p>
            </div>
            <ul className="space-y-2">
              {s.items.map((item, i) => (
                <li key={i} className="font-commons text-sm text-gray-700 flex gap-2">
                  <ChevronRight className={`w-3.5 h-3.5 text-${s.color}-500 mt-0.5 shrink-0`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null)}
      </div>
    </SectionCard>
  );
}

function VisualWorldReport({ vw }: { vw: NonNullable<AIAnalysis['visualWorld']> }) {
  return (
    <SectionCard>
      <SectionTitle icon={Palette} title="Gorsel Dunya" color="rose" />

      {/* Color Palette */}
      {vw.colorPalette?.length > 0 && (
        <div className="mb-5">
          <p className="font-commons text-[11px] text-rose-500 uppercase tracking-wider font-medium mb-3">Renk Paleti</p>
          <div className="flex flex-wrap gap-3">
            {vw.colorPalette.map((c, i) => (
              <div key={i} className="text-center">
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl shadow-sm border border-gray-200"
                  style={{ backgroundColor: c.hex }}
                />
                <p className="font-commons text-[10px] text-gray-700 font-medium mt-1.5">{c.name}</p>
                <p className="font-commons text-[9px] text-gray-400">{c.usage}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mood Keywords */}
      {vw.moodKeywords?.length > 0 && (
        <div className="mb-4">
          <p className="font-commons text-[11px] text-rose-500 uppercase tracking-wider font-medium mb-2">Mood</p>
          <div className="flex flex-wrap gap-2">
            {vw.moodKeywords.map((m, i) => <Badge key={i} color="rose">{m}</Badge>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {vw.typographyStyle && <InfoBlock label="Tipografi Stili" color="rose">{vw.typographyStyle}</InfoBlock>}
        {vw.imageryStyle && <InfoBlock label="Gorsel Stili" color="rose">{vw.imageryStyle}</InfoBlock>}
      </div>
    </SectionCard>
  );
}

function ContentStrategyReport({ cs, blogInsights }: { cs: NonNullable<AIAnalysis['contentStrategy']>; blogInsights?: any }) {
  return (
    <SectionCard>
      <SectionTitle icon={MessageSquare} title="Icerik Stratejisi" color="indigo" />

      {cs.pillars?.length > 0 && (
        <div className="mb-5">
          <p className="font-commons text-[11px] text-indigo-500 uppercase tracking-wider font-medium mb-2">Icerik Sutunlari</p>
          <div className="flex flex-wrap gap-2">
            {cs.pillars.map((p, i) => <Badge key={i} color="indigo">{p}</Badge>)}
          </div>
        </div>
      )}

      {cs.keyMessages?.length > 0 && (
        <div className="bg-indigo-50 rounded-xl p-4 mb-4">
          <p className="font-commons text-[11px] text-indigo-500 uppercase tracking-wider font-medium mb-2">Anahtar Mesajlar</p>
          <ul className="space-y-1.5">
            {cs.keyMessages.map((m, i) => (
              <li key={i} className="font-commons text-sm text-gray-700 flex gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />{m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cs.toneGuidelines?.length > 0 && (
        <div className="bg-indigo-50 rounded-xl p-4 mb-4">
          <p className="font-commons text-[11px] text-indigo-500 uppercase tracking-wider font-medium mb-2">Ton Rehberi</p>
          <ul className="space-y-1.5">
            {cs.toneGuidelines.map((t, i) => (
              <li key={i} className="font-commons text-sm text-gray-700">{t}</li>
            ))}
          </ul>
        </div>
      )}

      {cs.hashtags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {cs.hashtags.map((h, i) => (
            <span key={i} className="font-commons text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
              <Hash className="w-3 h-3 inline mr-0.5" />{h.replace(/^#/, '')}
            </span>
          ))}
        </div>
      )}

      {/* Blog advisor strategic recommendations merged into content strategy */}
      {blogInsights?.keyRecommendations?.length > 0 && (
        <div className="bg-teal-50 rounded-xl p-4 mt-4">
          <p className="font-commons text-[11px] text-teal-500 uppercase tracking-wider font-medium mb-2">Ek Stratejik Oneriler</p>
          <ul className="space-y-1.5">
            {blogInsights.keyRecommendations.map((r: string, i: number) => (
              <li key={i} className="font-commons text-sm text-gray-700 flex gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-teal-500 mt-0.5 shrink-0" />{r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

function ActionPlanReport({ ap }: { ap: NonNullable<AIAnalysis['actionPlan']> }) {
  const phases = [
    { key: 'immediate', label: 'Acil Aksiyonlar', sub: '0-30 Gun', items: ap.immediate, color: 'red', icon: Zap },
    { key: 'shortTerm', label: 'Kisa Vade', sub: '30-60 Gun', items: ap.shortTerm, color: 'amber', icon: Clock },
    { key: 'mediumTerm', label: 'Orta Vade', sub: '60-90 Gun', items: ap.mediumTerm, color: 'emerald', icon: TrendingUp },
  ];

  return (
    <SectionCard>
      <SectionTitle icon={Target} title="90 Gunluk Eylem Plani" color="red" />
      <div className="space-y-5">
        {phases.map((phase) => phase.items?.length > 0 ? (
          <div key={phase.key}>
            <div className="flex items-center gap-2 mb-3">
              <phase.icon className={`w-4 h-4 text-${phase.color}-600`} />
              <p className={`font-commons text-sm font-semibold text-${phase.color}-700`}>{phase.label}</p>
              <span className={`font-commons text-[10px] text-${phase.color}-500 bg-${phase.color}-50 px-2 py-0.5 rounded-full`}>{phase.sub}</span>
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block">
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b border-${phase.color}-100`}>
                    <th className="font-commons text-[10px] text-gray-500 uppercase pb-2 pr-3">Aksiyon</th>
                    <th className="font-commons text-[10px] text-gray-500 uppercase pb-2 pr-3 w-28">Sorumlu</th>
                    <th className="font-commons text-[10px] text-gray-500 uppercase pb-2 pr-3 w-36">Metrik</th>
                    <th className="font-commons text-[10px] text-gray-500 uppercase pb-2 w-36">Etki</th>
                  </tr>
                </thead>
                <tbody>
                  {phase.items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="font-commons text-sm text-gray-700 py-2.5 pr-3">{item.action}</td>
                      <td className="font-commons text-xs text-gray-500 py-2.5 pr-3">{item.owner}</td>
                      <td className="font-commons text-xs text-gray-500 py-2.5 pr-3">{item.metric}</td>
                      <td className="font-commons text-xs text-gray-500 py-2.5">{item.estimatedImpact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="sm:hidden space-y-2">
              {phase.items.map((item, i) => (
                <div key={i} className={`bg-${phase.color}-50 rounded-lg p-3 border border-${phase.color}-100`}>
                  <p className="font-commons text-sm text-gray-800 font-medium mb-1.5">{item.action}</p>
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-commons">
                    <div><span className="text-gray-400 block">Sorumlu</span><span className="text-gray-600">{item.owner}</span></div>
                    <div><span className="text-gray-400 block">Metrik</span><span className="text-gray-600">{item.metric}</span></div>
                    <div><span className="text-gray-400 block">Etki</span><span className="text-gray-600">{item.estimatedImpact}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null)}
      </div>
    </SectionCard>
  );
}

// ─── CTA Section ────────────────────────────────────

function CTASection({ requestedServices, businessName }: { requestedServices: { id: string; title: string }[]; businessName: string }) {
  const serviceMapping: Record<string, { title: string; description: string }> = {
    'social-media': { title: 'Sosyal Medya Yonetimi', description: 'Marka stratejinize uygun icerik planlama, uretim ve topluluk yonetimi.' },
    'video-production': { title: 'Video Produksiyon', description: 'Profesyonel tanitim filmleri, reklam videolari ve sosyal medya icerikleri.' },
    'digital-marketing': { title: 'Dijital Pazarlama', description: 'Performans odakli reklam kampanyalari, SEO ve dijital strateji.' },
    'branding': { title: 'Marka Kimligi', description: 'Logo, kurumsal kimlik, marka rehberi ve gorsel dunya tasarimi.' },
    'web-development': { title: 'Web Gelistirme', description: 'Modern, responsive ve donusum odakli web siteleri.' },
    'content-creation': { title: 'Icerik Uretimi', description: 'Blog, fotograf, grafik tasarim ve editoryal icerik uretimi.' },
  };

  return (
    <SectionCard className="!p-8 sm:!p-10 bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
      <div className="text-center mb-6">
        <h2 className="font-ramillas text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          intiba ile Nasil Calisabilirsiniz?
        </h2>
        <p className="font-commons text-sm text-gray-500 max-w-lg mx-auto">
          {businessName} icin hazirlanan bu strateji raporundaki onerileri hayata gecirmek icin intiba ekibi sizinle birlikte calisabilir.
        </p>
      </div>

      {requestedServices?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {requestedServices.map((svc) => {
            const mapped = serviceMapping[svc.id];
            return (
              <div key={svc.id} className="bg-white rounded-xl p-4 border border-indigo-100">
                <p className="font-commons text-sm font-semibold text-gray-900 mb-1">{mapped?.title || svc.title}</p>
                <p className="font-commons text-xs text-gray-500">{mapped?.description || 'Profesyonel hizmet destegiyle markanizi buyutun.'}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center">
        <a
          href="https://intiba.co.uk/iletisim"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-full font-commons text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Bizimle Iletisime Gecin
          <ArrowRight className="w-4 h-4" />
        </a>
        <p className="font-commons text-xs text-gray-400 mt-3">
          veya <a href="mailto:info@intiba.co.uk" className="text-indigo-500 hover:underline">info@intiba.co.uk</a> adresine yazin
        </p>
      </div>
    </SectionCard>
  );
}

export default AnalysisReportPage;
