import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Compass, Users, Lightbulb, Palette, Building2,
  MessageSquare, Hash, Target, TrendingUp, BarChart3, Shield,
  ExternalLink, ChevronRight, Sparkles,
  CheckCircle2, AlertTriangle, Zap, ArrowRight, Clock,
  Layers, BookOpen, Globe, Instagram,
  Activity, Star, Minus, AlertCircle,
  Gauge, Copy, ThumbsUp, ThumbsDown, Swords, Brain,
  LayoutGrid, Rocket, ShieldAlert,
  Map, Megaphone, FileText, Printer, ChevronDown, ChevronUp, Layout,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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

const MATURITY_LABELS: Record<string, string> = {
  pre_brand: 'On-Marka',
  emerging: 'Gelisen',
  developing: 'Olgunlasan',
  mature: 'Olgun',
};

const MATURITY_COLORS: Record<string, string> = {
  pre_brand: 'red',
  emerging: 'amber',
  developing: 'blue',
  mature: 'emerald',
};

const VALUE_LEVEL_LABELS: Record<string, string> = {
  commodity: 'Emtia',
  product: 'Urun',
  service: 'Hizmet',
  experience: 'Deneyim',
  transformation: 'Donusum',
};

const VALUE_LEVELS = ['commodity', 'product', 'service', 'experience', 'transformation'];

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

function SectionTitle({ icon: Icon, title, color, badge }: { icon: any; title: string; color: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className={`w-8 h-8 rounded-lg bg-${color}-50 flex items-center justify-center`}>
        <Icon className={`w-4 h-4 text-${color}-600`} />
      </div>
      <h2 className="font-ramillas text-lg sm:text-xl font-bold text-gray-900">{title}</h2>
      {badge && <div className="ml-auto">{badge}</div>}
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

function CircularGauge({ value, max = 100, size = 80, color = 'indigo', label }: { value: number; max?: number; size?: number; color?: string; label?: string }) {
  const pct = Math.min(Math.max(value / max, 0), 1);
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - pct);
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth="6" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth="6" fill="none"
          className={`text-${color}-500`}
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" />
      </svg>
      <p className="font-commons text-lg font-bold text-gray-900 -mt-[52px] mb-6">{value}</p>
      {label && <p className="font-commons text-[10px] text-gray-500 mt-1">{label}</p>}
    </div>
  );
}

function SliderBar({ label, leftLabel, rightLabel, value }: { label: string; leftLabel: string; rightLabel: string; value: number }) {
  return (
    <div className="mb-3">
      <p className="font-commons text-xs font-medium text-gray-700 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="font-commons text-[10px] text-gray-400 w-16 text-right">{leftLabel}</span>
        <div className="flex-1 h-2 bg-gray-100 rounded-full relative">
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-500 rounded-full shadow-sm"
            style={{ left: `${value}%` }} />
        </div>
        <span className="font-commons text-[10px] text-gray-400 w-16">{rightLabel}</span>
      </div>
    </div>
  );
}

// ─── Confidence & Evidence Components ──────────────────

type ConfidenceLevel = 'verified' | 'grounded' | 'inferred' | 'speculative';

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  verified: 'Dogrulanmis',
  grounded: 'Cercevelenmis',
  inferred: 'Cikarim',
  speculative: 'Varsayim',
};

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  verified: 'emerald',
  grounded: 'blue',
  inferred: 'amber',
  speculative: 'red',
};

const CONFIDENCE_ICONS: Record<ConfidenceLevel, string> = {
  verified: '🟢',
  grounded: '🔵',
  inferred: '🟡',
  speculative: '🔴',
};

function getConfidenceLevelFromScore(score: number): ConfidenceLevel {
  if (score >= 80) return 'verified';
  if (score >= 55) return 'grounded';
  if (score >= 30) return 'inferred';
  return 'speculative';
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const color = CONFIDENCE_COLORS[level];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-commons font-medium px-2 py-0.5 rounded-full bg-${color}-50 text-${color}-700`}>
      {CONFIDENCE_ICONS[level]} {CONFIDENCE_LABELS[level]}
    </span>
  );
}

function OverallConfidenceBanner({ score, totalClaims, verifiedClaims, strongestSection, weakestSection }: {
  score: number;
  totalClaims: number;
  verifiedClaims: number;
  strongestSection: string;
  weakestSection: string;
}) {
  const level = getConfidenceLevelFromScore(score);
  const color = CONFIDENCE_COLORS[level];

  let contextText: string;
  if (score < 40) {
    contextText = 'Bu analiz harici arastirma verisi olmadan olusturuldu. Sektor arastirmasi eklenerek skor arttirilabilir.';
  } else if (score < 70) {
    contextText = 'Analiz kismi arastirma verisiyle desteklenmis.';
  } else {
    contextText = 'Analiz kapsamli arastirma verisiyle guclendirilmis.';
  }

  return (
    <div className={`bg-${color}-50 border border-${color}-200 rounded-2xl p-4 sm:p-5`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 text-${color}-600`} />
          <h3 className="font-commons text-sm font-semibold text-gray-900">Arastirma Destekleme Skoru</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-commons text-xl font-bold text-${color}-700`}>{score}/100</span>
          <ConfidenceBadge level={level} />
        </div>
      </div>
      <p className={`font-commons text-[11px] text-${color}-700 mb-3`}>{contextText}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="font-commons text-lg font-bold text-gray-900">{totalClaims}</p>
          <p className="font-commons text-[10px] text-gray-500">Toplam Iddia</p>
        </div>
        <div className="text-center">
          <p className="font-commons text-lg font-bold text-emerald-600">{verifiedClaims > 0 ? verifiedClaims : '-'}</p>
          <p className="font-commons text-[10px] text-gray-500">{verifiedClaims > 0 ? 'Arastirmali Iddia' : 'Arastirma Yok'}</p>
        </div>
        <div className="text-center">
          <p className="font-commons text-[11px] font-medium text-emerald-700 truncate">{strongestSection || '-'}</p>
          <p className="font-commons text-[10px] text-gray-500">En Guclu Bolum</p>
        </div>
        <div className="text-center">
          <p className="font-commons text-[11px] font-medium text-amber-700 truncate">{weakestSection || '-'}</p>
          <p className="font-commons text-[10px] text-gray-500">En Zayif Bolum</p>
        </div>
      </div>
    </div>
  );
}

function SectionConfidenceIndicator({ sectionName, confidence, evidenceV2 }: {
  sectionName: string;
  confidence?: number;
  evidenceV2?: any;
}) {
  if (!evidenceV2?.sectionBreakdown) return null;

  const section = evidenceV2.sectionBreakdown.find((s: any) => s.sectionName === sectionName);
  if (!section) return null;

  const score = confidence ?? section.overallConfidence;
  const level = getConfidenceLevelFromScore(score);

  return <ConfidenceBadge level={level} />;
}

// ─── Main Component ────────────────────────────────────

const AnalysisReportPage: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [lead, setLead] = useState<BrandLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Tab state must be declared before early returns (Rules of Hooks)
  const [activeTab, setActiveTab] = useState<string>('all');

  const tabs = [
    { id: 'all', label: 'Tumu' },
    { id: 'kimlik', label: 'Marka Kimligi' },
    { id: 'hedef', label: 'Hedef Kitle' },
    { id: 'aksiyon', label: 'Ne Yapmali' },
    { id: 'pazar', label: 'Pazar Analizi' },
  ];

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

  // URL hash routing
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && tabs.some(t => t.id === hash)) {
      setActiveTab(hash);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'all') {
      window.location.hash = activeTab;
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [activeTab]);

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

  const showSection = (group: string) => activeTab === 'all' || activeTab === group;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── HEADER ─── */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between">
          <img src="/images/intibalogo.svg" alt="intiba" className="h-6 sm:h-7 invert" />
          <div className="flex items-center gap-3">
            <span className="font-commons text-xs text-gray-400 hidden sm:block">Marka Strateji Raporu</span>
            <Link
              to={`/rapor-immersive/${shareToken}`}
              className="font-commons flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-colors print:hidden"
            >
              <span>✦</span>
              <span>İmmersive</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 sm:space-y-8">
        {/* 1. COVER / TITLE */}
        <SectionCard className="!p-8 sm:!p-10 bg-gradient-to-br from-white to-gray-50">
          <p className="font-commons text-xs text-gray-400 uppercase tracking-widest mb-3">{sector}</p>
          <h1 className="font-ramillas text-3xl sm:text-4xl font-bold text-gray-900 mb-3">{businessName}</h1>
          <p className="font-commons text-sm text-gray-500">
            {formatDate(a.analyzedAt)}
          </p>
        </SectionCard>

        {/* 2. CONSULTANT INTRO */}
        {a.consultantIntro && (
          <SectionCard className="border-l-4 border-l-indigo-400">
            <p className="font-commons text-sm sm:text-base text-gray-700 leading-relaxed italic">
              {a.consultantIntro}
            </p>
          </SectionCard>
        )}

        {/* DEBATE (Faz E3) — collapsible, always visible when data exists */}
        {(a.debate || (a as any).synthesisRationale) && (
          <DebateSection debate={a.debate} synthesisRationale={(a as any).synthesisRationale} />
        )}

        {/* BRAND BRIEF (always visible) */}
        <BrandBriefCard a={a} businessName={businessName} />

        {/* BRAND CLAIM (always visible, after brief) */}
        {a.brandClaim && <BrandClaimSection brandClaim={a.brandClaim} />}

        {/* ─── TAB NAVIGATION (Faz D1) ─── */}
        <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-sm -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 border-b border-gray-200">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`font-commons text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── kimlik group ─── */}

        {/* 3. DIAGNOSIS */}
        {showSection('kimlik') && (a.diagnosisSummary || a.brandMaturity || a.dataQuality) && (
          <DiagnosisSection
            diagnosisSummary={a.diagnosisSummary}
            brandMaturity={a.brandMaturity}
            dataQuality={a.dataQuality}
          />
        )}

        {/* 4. BUSINESS PROFILE */}
        {showSection('kimlik') && bc && <BusinessProfileSection bc={bc} />}

        {/* 5. BRAND PERSONALITY + CHARACTER */}
        {showSection('kimlik') && a.brandPersonality && (
          <BrandPersonalityReport bp={a.brandPersonality} character={a.brandCharacter} />
        )}

        {/* QUALITY METRICS (Faz E2) */}
        {showSection('kimlik') && a.qualityMetrics && (
          <QualityMetricsSection metrics={a.qualityMetrics} />
        )}

        {/* 6. STRATEGIC DEPTH */}
        {showSection('kimlik') && a.strategicDepth && <StrategicDepthSection depth={a.strategicDepth} />}

        {/* 8. BRAND NARRATIVE */}
        {showSection('kimlik') && (a.brandNarrative || a.emotionalNarrative) && (
          <BrandNarrativeSection
            narrative={a.brandNarrative}
            emotional={a.emotionalNarrative}
            maturityLevel={a.brandMaturity?.level}
          />
        )}

        {/* MESSAGING ARCHITECTURE (Faz B1) */}
        {showSection('kimlik') && a.messagingArchitecture && (
          <MessagingArchitectureSection messaging={a.messagingArchitecture} />
        )}

        {/* ─── hedef group ─── */}

        {/* 7. POSITIONING + PERCEPTUAL MAP */}
        {showSection('hedef') && a.positioning && <PositioningReport positioning={a.positioning} />}
        {showSection('hedef') && a.perceptualMap && <PerceptualMapSection map={a.perceptualMap} businessName={businessName} />}

        {/* CUSTOMER JOURNEY (Faz C1) */}
        {showSection('hedef') && a.customerJourney && a.customerJourney.length > 0 && (
          <CustomerJourneySection journey={a.customerJourney} />
        )}

        {/* CONSUMER TEST (Faz E1) */}
        {showSection('hedef') && a.consumerTest && (
          <ConsumerTestSection consumerTest={a.consumerTest} />
        )}

        {/* ─── aksiyon group ─── */}

        {/* 14. CONTENT STRATEGY */}
        {showSection('aksiyon') && a.contentStrategy && (
          <ContentStrategyReport cs={a.contentStrategy} blogInsights={(a as any).blogAdvisorInsights} templates={a.socialMediaTemplates} />
        )}

        {/* 15. STRATEGY SCENARIOS */}
        {showSection('aksiyon') && a.strategyScenarios && <StrategyScenariosSection scenarios={a.strategyScenarios} />}

        {/* 16. RISK MATRIX */}
        {showSection('aksiyon') && a.riskMitigationPlans && a.riskMitigationPlans.length > 0 && (
          <RiskMatrixSection plans={a.riskMitigationPlans} />
        )}

        {/* 17. ACTION PLAN */}
        {showSection('aksiyon') && a.actionPlan && <ActionPlanReport ap={a.actionPlan} />}

        {/* KPI FRAMEWORK (Faz A1) */}
        {showSection('aksiyon') && a.kpiFramework && (
          <KPIFrameworkSection kpi={a.kpiFramework} />
        )}

        {/* ─── pazar group ─── */}

        {/* 9. STRATEGIC ANALYSIS (SWOT) */}
        {showSection('pazar') && a.analysis && <SwotReport analysis={a.analysis} />}

        {/* 10. COMPETITOR ANALYSIS */}
        {showSection('pazar') && (
          <CompetitorSection
            competitors={a.sectorResearch?.competitors}
            discovery={a.competitorDiscovery}
          />
        )}

        {/* 11. MARKET DATA */}
        {showSection('pazar') && a.sectorResearch?.marketData && <MarketDataReport md={a.sectorResearch.marketData} />}

        {/* 12. DIGITAL PRESENCE */}
        {showSection('pazar') && a.digitalPresence && <DigitalPresenceSection dp={a.digitalPresence} />}

        {/* 13. VISUAL WORLD */}
        {showSection('pazar') && a.visualWorld && <VisualWorldReport vw={a.visualWorld} />}

        {/* ─── always visible ─── */}

        {/* 18. INTIBA ENGAGEMENT PLAN (replaces generic CTA) */}
        {a.intibaEngagement ? (
          <IntibaEngagementSection
            engagement={a.intibaEngagement}
            businessName={businessName}
            revenueImpact={a.revenueImpact}
          />
        ) : (
          <CTASection requestedServices={lead.requestedServices} businessName={businessName} />
        )}
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

// ═══════════════════════════════════════════════════════
// SECTION COMPONENTS
// ═══════════════════════════════════════════════════════

// ─── 3. Diagnosis Panel (merged: algı vs gerçeklik + olgunluk + veri kalitesi) ───

function DiagnosisSection({ diagnosisSummary, brandMaturity, dataQuality }: {
  diagnosisSummary?: AIAnalysis['diagnosisSummary'];
  brandMaturity?: AIAnalysis['brandMaturity'];
  dataQuality?: AIAnalysis['dataQuality'];
}) {
  const maturityLevels = ['pre_brand', 'emerging', 'developing', 'mature'];

  return (
    <SectionCard>
      <SectionTitle icon={Activity} title="Marka Teshis Paneli" color="violet" />

      {/* Perception vs Reality (from brandValueMaximizer) */}
      {diagnosisSummary && (
        <div className="mb-6">
          {diagnosisSummary.criticalMisalignment && (
            <div className="bg-rose-50 rounded-xl p-4 mb-4 border border-rose-200">
              <p className="font-commons text-[11px] text-rose-600 uppercase tracking-wider font-medium mb-1">Kritik Uyumsuzluk</p>
              <p className="font-commons text-sm text-gray-800 font-medium">{diagnosisSummary.criticalMisalignment}</p>
            </div>
          )}

          {diagnosisSummary.perceptionVsReality?.length > 0 && (
            <div className="space-y-3 mb-4">
              <p className="font-commons text-[11px] text-rose-500 uppercase tracking-wider font-medium">Algi vs Gerceklik</p>
              {diagnosisSummary.perceptionVsReality.map((item, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <p className="font-commons text-[10px] text-amber-600 uppercase font-medium mb-1">Algi</p>
                    <p className="font-commons text-sm text-gray-700">{item.perception}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <p className="font-commons text-[10px] text-emerald-600 uppercase font-medium mb-1">Gerceklik</p>
                    <p className="font-commons text-sm text-gray-700">{item.reality}</p>
                  </div>
                  {(item.gap || item.recommendation) && (
                    <div className="md:col-span-2 bg-gray-50 rounded-lg p-3">
                      {item.gap && <p className="font-commons text-xs text-gray-600 mb-1"><span className="font-medium text-gray-700">Fark:</span> {item.gap}</p>}
                      {item.recommendation && <p className="font-commons text-xs text-gray-600"><span className="font-medium text-indigo-600">Oneri:</span> {item.recommendation}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {diagnosisSummary.blindSpots?.length > 0 && (
            <div>
              <p className="font-commons text-[11px] text-violet-600 uppercase tracking-wider font-medium mb-2">Gorulmeyen Gucler</p>
              <div className="flex flex-wrap gap-2">
                {diagnosisSummary.blindSpots.map((b, i) => (
                  <span key={i} className="font-commons text-xs bg-violet-50 text-violet-700 px-3 py-1.5 rounded-lg">{b}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Brand Maturity Gauge */}
      {brandMaturity && (
        <div className="mb-6">
          <p className="font-commons text-[11px] text-violet-500 uppercase tracking-wider font-medium mb-3">Marka Olgunluk Seviyesi</p>
          <div className="flex items-center gap-1 mb-3">
            {maturityLevels.map((level) => {
              const isActive = maturityLevels.indexOf(brandMaturity.level) >= maturityLevels.indexOf(level);
              const c = MATURITY_COLORS[level] || 'gray';
              return (
                <div key={level} className={`flex-1 h-3 rounded-full ${isActive ? `bg-${c}-400` : 'bg-gray-100'}`} />
              );
            })}
          </div>
          <div className="flex justify-between mb-4">
            {maturityLevels.map((level) => (
              <p key={level} className={`font-commons text-[10px] ${brandMaturity.level === level ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                {MATURITY_LABELS[level]}
              </p>
            ))}
          </div>

          {/* Factor bars */}
          {brandMaturity.factors && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Is Yasi', value: brandMaturity.factors.businessAge ?? 0 },
              { label: 'Marka Varliklari', value: brandMaturity.factors.brandAssets ?? 0 },
              { label: 'Dijital Varlik', value: brandMaturity.factors.digitalPresence ?? 0 },
              { label: 'Kitle Buyuklugu', value: brandMaturity.factors.audienceSize ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-violet-50 rounded-lg p-3">
                <p className="font-commons text-[10px] text-violet-500 font-medium mb-1">{label}</p>
                <div className="flex gap-0.5">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className={`flex-1 h-2 rounded-full ${n <= value ? 'bg-violet-400' : 'bg-violet-100'}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>}
        </div>
      )}

      {/* Data Quality: Contradictions */}
      {dataQuality?.contradictions && dataQuality.contradictions.length > 0 && (
        <div className="mb-4">
          <p className="font-commons text-[11px] text-amber-600 uppercase tracking-wider font-medium mb-2">Dikkat Gerektiren Noktalar</p>
          <div className="space-y-2">
            {dataQuality.contradictions.map((c, i) => (
              <div key={i} className="bg-amber-50 rounded-lg p-3 flex gap-2 border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="font-commons text-sm text-gray-700">{c}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Quality: Patterns */}
      {dataQuality?.patterns && dataQuality.patterns.length > 0 && (
        <div>
          <p className="font-commons text-[11px] text-blue-600 uppercase tracking-wider font-medium mb-2">Tespit Edilen Oruntuler</p>
          <div className="space-y-2">
            {dataQuality.patterns.map((p, i) => (
              <div key={i} className="bg-blue-50 rounded-lg p-3 flex gap-2 border border-blue-100">
                <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="font-commons text-sm text-gray-700">{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Strategic Depth (Faz 1) ─────────────────────────────

function StrategicDepthSection({ depth }: { depth: NonNullable<AIAnalysis['strategicDepth']> }) {
  const currentIndex = VALUE_LEVELS.indexOf(depth.valueLevel);

  return (
    <SectionCard>
      <SectionTitle icon={Brain} title="Stratejik Derinlik" color="indigo" />

      {/* Customer Problem Pyramid */}
      {depth.customerProblem && (
        <div className="mb-5">
          <p className="font-commons text-[11px] text-indigo-500 uppercase tracking-wider font-medium mb-3">Musteri Problemi (3 Katman)</p>
          <div className="space-y-2">
            {[
              { label: 'Dis (Somut)', text: depth.customerProblem.external, color: 'blue' },
              { label: 'Ic (Duygusal)', text: depth.customerProblem.internal, color: 'purple' },
              { label: 'Felsefi (Ahlaki)', text: depth.customerProblem.philosophical, color: 'rose' },
            ].map(({ label, text, color }) => text ? (
              <div key={label} className={`bg-${color}-50 rounded-xl p-4 border border-${color}-100`}>
                <p className={`font-commons text-[10px] text-${color}-600 uppercase font-medium mb-1`}>{label}</p>
                <p className="font-commons text-sm text-gray-700">{text}</p>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* Transformation Statement */}
      {depth.transformationStatement && (
        <div className="bg-indigo-50 rounded-xl p-5 mb-5 text-center">
          <p className="font-commons text-[11px] text-indigo-500 uppercase tracking-wider font-medium mb-2">Donusum Ifadesi</p>
          <p className="font-ramillas text-xl sm:text-2xl font-bold text-indigo-900">&ldquo;{depth.transformationStatement}&rdquo;</p>
        </div>
      )}

      {/* Brand Enemy */}
      {depth.brandEnemy && (
        <div className="bg-red-50 rounded-xl p-4 mb-5 border border-red-100">
          <div className="flex items-center gap-2 mb-1">
            <Swords className="w-4 h-4 text-red-600" />
            <p className="font-commons text-[11px] text-red-600 uppercase tracking-wider font-medium">Karsi Durdugunuz Guc</p>
          </div>
          <p className="font-commons text-sm text-gray-800 font-medium">{depth.brandEnemy}</p>
        </div>
      )}

      {/* We Stand For / Against */}
      {(depth.weStandFor?.length > 0 || depth.weStandAgainst?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          {depth.weStandFor?.length > 0 && (
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="font-commons text-[11px] text-emerald-600 uppercase tracking-wider font-medium mb-2">Inaniyoruz Ki</p>
              <ul className="space-y-1.5">
                {depth.weStandFor.map((item, i) => (
                  <li key={i} className="font-commons text-sm text-gray-700 flex gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {depth.weStandAgainst?.length > 0 && (
            <div className="bg-red-50 rounded-xl p-4">
              <p className="font-commons text-[11px] text-red-600 uppercase tracking-wider font-medium mb-2">Reddediyoruz</p>
              <ul className="space-y-1.5">
                {depth.weStandAgainst.map((item, i) => (
                  <li key={i} className="font-commons text-sm text-gray-700 flex gap-2">
                    <Minus className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Value Level Ladder */}
      {depth.valueLevel && (
        <div className="mb-5">
          <p className="font-commons text-[11px] text-indigo-500 uppercase tracking-wider font-medium mb-3">Deger Merdiveni</p>
          <div className="flex items-end gap-1">
            {VALUE_LEVELS.map((level, i) => {
              const isActive = i <= currentIndex;
              const isCurrent = level === depth.valueLevel;
              return (
                <div key={level} className="flex-1 flex flex-col items-center">
                  <div className={`w-full rounded-t-lg ${isCurrent ? 'bg-indigo-500' : isActive ? 'bg-indigo-200' : 'bg-gray-100'}`}
                    style={{ height: `${20 + i * 16}px` }} />
                  <p className={`font-commons text-[9px] sm:text-[10px] mt-1 ${isCurrent ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
                    {VALUE_LEVEL_LABELS[level]}
                  </p>
                </div>
              );
            })}
          </div>
          {depth.valueLevelUpgrade && (
            <div className="bg-indigo-50 rounded-lg p-3 mt-3 flex gap-2">
              <ArrowRight className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <p className="font-commons text-xs text-gray-700">{depth.valueLevelUpgrade}</p>
            </div>
          )}
        </div>
      )}

      {/* Cultural Tension */}
      {depth.culturalTension && (
        <div>
          <p className="font-commons text-[11px] text-indigo-500 uppercase tracking-wider font-medium mb-2">Kulturel Gerilim</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoBlock label="Beklenti" color="amber">{depth.culturalTension.expectation}</InfoBlock>
            <InfoBlock label="Gerceklik" color="red">{depth.culturalTension.reality}</InfoBlock>
            <InfoBlock label="Firsat" color="emerald">{depth.culturalTension.opportunity}</InfoBlock>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── 9a. Positioning (existing, unchanged) ─────────────

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

// ─── 9b. Perceptual Map (Faz 1) ────────────────────────

function PerceptualMapSection({ map, businessName }: { map: NonNullable<AIAnalysis['perceptualMap']>; businessName: string }) {
  const mapSize = 300;
  const padding = 40;
  const plotSize = mapSize - padding * 2;

  const toPixel = (val: number) => padding + ((val + 5) / 10) * plotSize;

  return (
    <SectionCard>
      <SectionTitle icon={LayoutGrid} title="Algisal Harita" color="cyan" />
      <div className="flex justify-center">
        <div className="relative" style={{ width: mapSize, height: mapSize }}>
          <svg width={mapSize} height={mapSize} className="overflow-visible">
            {/* Quadrant backgrounds */}
            <rect x={padding} y={padding} width={plotSize / 2} height={plotSize / 2} fill="#f0fdf4" opacity="0.5" />
            <rect x={padding + plotSize / 2} y={padding} width={plotSize / 2} height={plotSize / 2} fill="#eff6ff" opacity="0.5" />
            <rect x={padding} y={padding + plotSize / 2} width={plotSize / 2} height={plotSize / 2} fill="#fefce8" opacity="0.5" />
            <rect x={padding + plotSize / 2} y={padding + plotSize / 2} width={plotSize / 2} height={plotSize / 2} fill="#fef2f2" opacity="0.5" />

            {/* Axes */}
            <line x1={padding} y1={mapSize / 2} x2={mapSize - padding} y2={mapSize / 2} stroke="#d1d5db" strokeWidth="1" />
            <line x1={mapSize / 2} y1={padding} x2={mapSize / 2} y2={mapSize - padding} stroke="#d1d5db" strokeWidth="1" />

            {/* Axis labels */}
            <text x={padding - 4} y={mapSize / 2 - 4} textAnchor="end" className="fill-gray-400 text-[9px] font-commons">{map.xAxis.lowEnd}</text>
            <text x={mapSize - padding + 4} y={mapSize / 2 - 4} textAnchor="start" className="fill-gray-400 text-[9px] font-commons">{map.xAxis.highEnd}</text>
            <text x={mapSize / 2} y={padding - 8} textAnchor="middle" className="fill-gray-400 text-[9px] font-commons">{map.yAxis.highEnd}</text>
            <text x={mapSize / 2} y={mapSize - padding + 16} textAnchor="middle" className="fill-gray-400 text-[9px] font-commons">{map.yAxis.lowEnd}</text>

            {/* Competitor positions */}
            {map.competitorPositions?.map((c, i) => (
              <g key={i}>
                <circle cx={toPixel(c.x)} cy={toPixel(-c.y)} r={6} fill="#9ca3af" opacity="0.6" />
                <text x={toPixel(c.x)} y={toPixel(-c.y) - 10} textAnchor="middle" className="fill-gray-500 text-[9px] font-commons">
                  {c.name}
                </text>
              </g>
            ))}

            {/* Brand position */}
            <circle cx={toPixel(map.brandPosition.x)} cy={toPixel(-map.brandPosition.y)} r={10} fill="#6366f1" />
            <text x={toPixel(map.brandPosition.x)} y={toPixel(-map.brandPosition.y) - 14} textAnchor="middle" className="fill-indigo-600 text-[10px] font-commons font-semibold">
              {businessName}
            </text>
          </svg>
        </div>
      </div>
      <div className="flex justify-center gap-6 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span className="font-commons text-[10px] text-gray-500">{businessName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gray-400 opacity-60" />
          <span className="font-commons text-[10px] text-gray-500">Rakipler</span>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── 10. Brand Narrative (Faz 1) ────────────────────────

function BrandNarrativeSection({ narrative, emotional, maturityLevel }: { narrative?: AIAnalysis['brandNarrative']; emotional?: AIAnalysis['emotionalNarrative']; maturityLevel?: string }) {
  const [bioCopied, setBioCopied] = useState(false);

  const copyBio = () => {
    if (!narrative?.socialMediaBio) return;
    navigator.clipboard.writeText(narrative.socialMediaBio);
    setBioCopied(true);
    setTimeout(() => setBioCopied(false), 2000);
  };

  return (
    <SectionCard>
      <SectionTitle icon={BookOpen} title="Marka Anlatisi" color="teal" />

      {/* One-Line Promise (from emotional narrative) */}
      {emotional?.oneLinePromise && (
        <div className="bg-rose-50 rounded-xl p-5 mb-4 text-center">
          <p className="font-commons text-[11px] text-rose-500 uppercase tracking-wider font-medium mb-2">Marka Sozu</p>
          <p className="font-ramillas text-xl sm:text-2xl font-bold text-rose-900">&ldquo;{emotional.oneLinePromise}&rdquo;</p>
        </div>
      )}

      {/* Elevator Pitch */}
      {narrative?.elevatorPitch && (
        <div className="bg-teal-50 rounded-xl p-5 mb-4">
          <p className="font-commons text-[11px] text-teal-500 uppercase tracking-wider font-medium mb-2">30 Saniye Tanitim</p>
          <p className="font-commons text-base text-gray-800 leading-relaxed italic">&ldquo;{narrative.elevatorPitch}&rdquo;</p>
        </div>
      )}

      {/* Social Media Bio */}
      {narrative?.socialMediaBio && (
        <div className="bg-gray-50 rounded-xl p-4 mb-4 relative">
          <div className="flex items-center justify-between mb-2">
            <p className="font-commons text-[11px] text-gray-500 uppercase tracking-wider font-medium">Sosyal Medya Bio</p>
            <button onClick={copyBio} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <Copy className="w-3 h-3" />
              {bioCopied ? 'Kopyalandi' : 'Kopyala'}
            </button>
          </div>
          <p className="font-commons text-sm text-gray-700">{narrative.socialMediaBio}</p>
          <p className="font-commons text-[10px] text-gray-400 mt-1">{narrative.socialMediaBio.length} karakter</p>
        </div>
      )}

      {/* Brand Story */}
      {narrative?.brandStory && (
        <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
          <p className="font-commons text-[11px] text-teal-500 uppercase tracking-wider font-medium mb-2">Hakkimizda Metni</p>
          <p className="font-commons text-sm text-gray-700 leading-relaxed">{narrative.brandStory}</p>
        </div>
      )}

      {/* Manifesto (from emotional narrative or brand narrative) */}
      {emotional?.manifesto && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 mb-4 text-white">
          <p className="font-commons text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-3">Marka Manifestosu</p>
          <p className="font-ramillas text-base sm:text-lg leading-relaxed text-gray-100">{emotional.manifesto}</p>
        </div>
      )}
      {!emotional?.manifesto && narrative?.brandManifesto && (maturityLevel === 'mature' || maturityLevel === 'developing') && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 mb-4 text-white">
          <p className="font-commons text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-3">Marka Manifestosu</p>
          <p className="font-ramillas text-base sm:text-lg leading-relaxed text-gray-100 italic">{narrative.brandManifesto}</p>
        </div>
      )}

      {/* Transformation Story (from emotional narrative) */}
      {emotional?.transformationStory && (
        <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-l-teal-300">
          <p className="font-commons text-[11px] text-teal-500 uppercase tracking-wider font-medium mb-2">Donusum Hikayesi</p>
          <p className="font-commons text-sm text-gray-700 leading-relaxed">{emotional.transformationStory}</p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Digital Presence ────────────────────────────────────

function DigitalPresenceSection({ dp }: { dp: NonNullable<AIAnalysis['digitalPresence']> }) {
  return (
    <SectionCard>
      <SectionTitle icon={Globe} title="Dijital Varlik Analizi" color="blue" />

      {/* Overall Score */}
      <div className="flex items-center gap-4 mb-5">
        <CircularGauge value={dp.overallDigitalScore} max={10} size={72} color="blue" />
        <div>
          <p className="font-commons text-sm font-semibold text-gray-800">Dijital Olgunluk: {dp.digitalMaturityLevel}</p>
          <p className="font-commons text-xs text-gray-500">Genel Dijital Skor: {dp.overallDigitalScore}/10</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Website */}
        {dp.website && dp.website.status === 'analyzed' && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-blue-600" />
              <p className="font-commons text-sm font-semibold text-gray-900">Web Sitesi</p>
              <span className="font-commons text-[10px] text-blue-600 font-medium ml-auto">Tasarim: {dp.website.designQuality}/10</span>
            </div>
            <p className="font-commons text-xs text-gray-600 mb-2">{dp.website.overallImpression}</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {dp.website.seoBasics?.hasTitle && <Badge color="emerald">Title</Badge>}
              {dp.website.seoBasics?.hasDescription && <Badge color="emerald">Meta Desc</Badge>}
              {dp.website.seoBasics?.hasOGTags && <Badge color="emerald">OG Tags</Badge>}
              {dp.website.mobileOptimized && <Badge color="emerald">Mobil</Badge>}
            </div>
            {dp.website.strengths?.length > 0 && (
              <div className="mb-1">{dp.website.strengths.slice(0, 2).map((s, i) => (
                <p key={i} className="font-commons text-[11px] text-emerald-600">+ {s}</p>
              ))}</div>
            )}
            {dp.website.weaknesses?.length > 0 && (
              <div>{dp.website.weaknesses.slice(0, 2).map((w, i) => (
                <p key={i} className="font-commons text-[11px] text-red-600">- {w}</p>
              ))}</div>
            )}
          </div>
        )}

        {/* Instagram */}
        {dp.instagram && dp.instagram.status !== 'not_provided' && (
          <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
            <div className="flex items-center gap-2 mb-2">
              <Instagram className="w-4 h-4 text-pink-600" />
              <p className="font-commons text-sm font-semibold text-gray-900">Instagram</p>
              <span className="font-commons text-[10px] text-pink-600 font-medium ml-auto">{dp.instagram.engagementLevel}</span>
            </div>
            <div className="space-y-1 text-xs font-commons text-gray-600 mb-2">
              {dp.instagram.followerRange && <p>Takipci: {dp.instagram.followerRange}</p>}
              {dp.instagram.postingFrequency && <p>Paylasim: {dp.instagram.postingFrequency}</p>}
              {dp.instagram.visualStyle && <p>Gorsel: {dp.instagram.visualStyle}</p>}
            </div>
            {dp.instagram.contentThemes?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {dp.instagram.contentThemes.map((t, i) => <Badge key={i} color="pink">{t}</Badge>)}
              </div>
            )}
            {dp.instagram.strengths?.length > 0 && (
              <div className="mb-1">{dp.instagram.strengths.slice(0, 2).map((s, i) => (
                <p key={i} className="font-commons text-[11px] text-emerald-600">+ {s}</p>
              ))}</div>
            )}
            {dp.instagram.weaknesses?.length > 0 && (
              <div>{dp.instagram.weaknesses.slice(0, 2).map((w, i) => (
                <p key={i} className="font-commons text-[11px] text-red-600">- {w}</p>
              ))}</div>
            )}
          </div>
        )}
      </div>

      {/* Critical Gaps & Quick Wins */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {dp.criticalGaps?.length > 0 && (
          <div className="bg-red-50 rounded-xl p-4">
            <p className="font-commons text-[11px] text-red-600 uppercase tracking-wider font-medium mb-2">Kritik Eksikler</p>
            <ul className="space-y-1">{dp.criticalGaps.map((g, i) => (
              <li key={i} className="font-commons text-xs text-gray-700 flex gap-1.5"><AlertCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />{g}</li>
            ))}</ul>
          </div>
        )}
        {dp.quickWins?.length > 0 && (
          <div className="bg-emerald-50 rounded-xl p-4">
            <p className="font-commons text-[11px] text-emerald-600 uppercase tracking-wider font-medium mb-2">Hizli Kazanimlar</p>
            <ul className="space-y-1">{dp.quickWins.map((w, i) => (
              <li key={i} className="font-commons text-xs text-gray-700 flex gap-1.5"><Zap className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />{w}</li>
            ))}</ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Strategy Scenarios (Faz 2) ──────────────────────────

function StrategyScenariosSection({ scenarios }: { scenarios: NonNullable<AIAnalysis['strategyScenarios']> }) {
  const tiers = [
    { key: 'conservative', label: 'Tutucu', data: scenarios.conservative, color: 'blue', icon: Shield },
    { key: 'recommended', label: 'Onerilen', data: scenarios.recommended, color: 'emerald', icon: Star },
    { key: 'aggressive', label: 'Agresif', data: scenarios.aggressive, color: 'rose', icon: Rocket },
  ];

  return (
    <SectionCard>
      <SectionTitle icon={Layers} title="Strateji Senaryolari" color="indigo" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map(({ key, label, data, color, icon: TierIcon }) => data ? (
          <div key={key} className={`bg-${color}-50 rounded-xl p-4 border ${key === 'recommended' ? `border-${color}-300 ring-1 ring-${color}-200` : `border-${color}-100`}`}>
            <div className="flex items-center gap-2 mb-3">
              <TierIcon className={`w-4 h-4 text-${color}-600`} />
              <p className={`font-commons text-sm font-semibold text-${color}-700`}>{label}</p>
            </div>
            <p className="font-commons text-xs text-gray-700 mb-3">{data.description}</p>
            <div className="space-y-1.5 text-[11px] font-commons">
              <p className="text-gray-600"><span className="text-gray-400">Sonuc:</span> {data.expectedOutcome}</p>
              <p className="text-gray-600"><span className="text-gray-400">Sure:</span> {data.timeframe}</p>
              <p className="text-gray-600"><span className="text-gray-400">Risk:</span> {data.risk}</p>
              {(data as any).probabilityWeight !== undefined && (
                <p className="text-gray-600"><span className="text-gray-400">Olasilik:</span> %{Math.round((data as any).probabilityWeight * 100)}</p>
              )}
              {(data as any).decisionCriteria && (
                <p className="text-gray-600"><span className="text-gray-400">Karar Kriteri:</span> {(data as any).decisionCriteria}</p>
              )}
            </div>
          </div>
        ) : null)}
      </div>
    </SectionCard>
  );
}

// ─── 21. Risk Matrix (Faz 2) ────────────────────────────

function RiskMatrixSection({ plans }: { plans: NonNullable<AIAnalysis['riskMitigationPlans']> }) {
  const impactColors: Record<string, string> = { yuksek: 'red', orta: 'amber', dusuk: 'emerald' };

  return (
    <SectionCard>
      <SectionTitle icon={ShieldAlert} title="Risk Azaltma Plani" color="red" />
      <div className="space-y-3">
        {plans.map((plan, i) => {
          const severity = plan.likelihood === 'yuksek' && plan.impact === 'yuksek' ? 'red' :
            plan.likelihood === 'yuksek' || plan.impact === 'yuksek' ? 'amber' : 'emerald';
          return (
            <div key={i} className={`bg-${severity}-50 rounded-xl p-4 border border-${severity}-100`}>
              <div className="flex items-start justify-between mb-2">
                <p className="font-commons text-sm font-semibold text-gray-900">{plan.risk}</p>
                <div className="flex gap-1.5 shrink-0 ml-3">
                  <span className={`font-commons text-[9px] px-1.5 py-0.5 rounded-full bg-${impactColors[plan.likelihood]}-100 text-${impactColors[plan.likelihood]}-700`}>
                    Olasilik: {plan.likelihood}
                  </span>
                  <span className={`font-commons text-[9px] px-1.5 py-0.5 rounded-full bg-${impactColors[plan.impact]}-100 text-${impactColors[plan.impact]}-700`}>
                    Etki: {plan.impact}
                  </span>
                </div>
              </div>
              {(plan as any).expectedValue !== undefined && (
                <div className="mb-2">
                  <span className="font-commons text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    EV: {(plan as any).expectedValue.toFixed(2)}
                  </span>
                </div>
              )}
              <p className="font-commons text-xs text-gray-700 mb-1"><span className="font-medium text-gray-800">Azaltma:</span> {plan.mitigation}</p>
              <p className="font-commons text-xs text-gray-700"><span className="font-medium text-amber-700">Erken Uyari:</span> {plan.earlyWarning}</p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── intiba Engagement Plan ──────────────────────────────

function IntibaEngagementSection({ engagement, businessName, revenueImpact }: { engagement: NonNullable<AIAnalysis['intibaEngagement']>; businessName: string; revenueImpact?: AIAnalysis['revenueImpact'] }) {
  const priorityColors: Record<string, string> = { kritik: 'red', onemli: 'amber', opsiyonel: 'gray' };
  const priorityLabels: Record<string, string> = { kritik: 'Kritik', onemli: 'Onemli', opsiyonel: 'Opsiyonel' };

  return (
    <SectionCard className="!p-8 sm:!p-10 bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
      <div className="text-center mb-6">
        <h2 className="font-ramillas text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          intiba Engagement Plan
        </h2>
        <p className="font-commons text-sm text-gray-500 max-w-lg mx-auto">
          {businessName} icin onerilen isbirligi plani
        </p>
      </div>

      {/* Recommended Services */}
      {engagement.recommendedServices?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {engagement.recommendedServices.map((svc, i) => {
            const color = priorityColors[svc.priority] || 'gray';
            return (
              <div key={i} className="bg-white rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-commons text-sm font-semibold text-gray-900">{svc.service}</p>
                  <span className={`font-commons text-[9px] px-2 py-0.5 rounded-full bg-${color}-100 text-${color}-700`}>
                    {priorityLabels[svc.priority] || svc.priority}
                  </span>
                </div>
                <p className="font-commons text-xs text-gray-600 mb-2">{svc.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* 3-Month Roadmap */}
      {engagement.threeMonthRoadmap && (
        <div className="bg-white rounded-xl p-4 border border-indigo-100 mb-4">
          <p className="font-commons text-[11px] text-indigo-500 uppercase tracking-wider font-medium mb-2">3 Aylik Yol Haritasi</p>
          <p className="font-commons text-sm text-gray-700 leading-relaxed">{engagement.threeMonthRoadmap}</p>
        </div>
      )}

      {/* Expected Outcomes */}
      {engagement.expectedOutcomes?.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-indigo-100 mb-4">
          <p className="font-commons text-[11px] text-emerald-500 uppercase tracking-wider font-medium mb-2">Beklenen Sonuclar</p>
          <ul className="space-y-1">{engagement.expectedOutcomes.map((o, i) => (
            <li key={i} className="font-commons text-sm text-gray-700 flex gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{o}
            </li>
          ))}</ul>
        </div>
      )}

      {/* Client Readiness Notes */}
      {engagement.clientReadinessNotes && (
        <div className="bg-amber-50 rounded-xl p-4 mb-4">
          <p className="font-commons text-[11px] text-amber-600 uppercase tracking-wider font-medium mb-1">Hazirlik Notu</p>
          <p className="font-commons text-xs text-gray-700">{engagement.clientReadinessNotes}</p>
        </div>
      )}

      {/* Revenue Impact / Growth Projection (merged from Faz 3) */}
      {revenueImpact && (
        <div className="bg-white rounded-xl p-4 border border-indigo-100 mb-6">
          <p className="font-commons text-[11px] text-emerald-500 uppercase tracking-wider font-medium mb-3">Buyume Projeksiyonu</p>
          {revenueImpact.currentState && (
            <p className="font-commons text-sm text-gray-700 mb-3">{revenueImpact.currentState}</p>
          )}
          {revenueImpact.growthDrivers?.length > 0 && (
            <div className="space-y-2 mb-3">
              {revenueImpact.growthDrivers.map((d, i) => (
                <div key={i} className="bg-emerald-50 rounded-lg p-3">
                  <p className="font-commons text-sm font-medium text-gray-800">{d.driver}</p>
                  <div className="flex gap-4 text-xs font-commons text-gray-600">
                    <span>Etki: <span className="text-emerald-700 font-medium">{d.estimatedImpact}</span></span>
                    <span>Sure: {d.timeframe}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-center">
        <a href="https://intiba.co.uk/iletisim" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-full font-commons text-sm font-medium hover:bg-gray-800 transition-colors">
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

// ─── Existing Section Components (preserved) ────────────

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

function BrandPersonalityReport({ bp, character }: { bp: NonNullable<AIAnalysis['brandPersonality']>; character?: AIAnalysis['brandCharacter'] }) {
  return (
    <SectionCard>
      <SectionTitle icon={Sparkles} title="Marka Kisiligi & Karakteri" color="purple" />
      <div className="bg-purple-50 rounded-xl p-5 mb-4">
        <p className="font-commons text-[11px] text-purple-500 uppercase tracking-wider font-medium mb-1">Arketip</p>
        <p className="font-ramillas text-xl font-bold text-gray-900">{bp.archetype}</p>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {bp.traits.map((t, i) => <Badge key={i} color="purple">{t}</Badge>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <InfoBlock label="Iletisim Tonu" color="purple">{bp.tone}</InfoBlock>
        <InfoBlock label="Marka Sesi" color="purple">{bp.voice}</InfoBlock>
      </div>

      {/* Character Sliders (merged from BrandCharacterSection) */}
      {character?.sliders && (
        <div className="mb-5 bg-purple-50 rounded-xl p-4">
          <SliderBar label="Iletisim Tarzi" leftLabel="Arkadas" rightLabel="Otorite" value={character.sliders.friendAuthority} />
          <SliderBar label="Enerji" leftLabel="Genc" rightLabel="Olgun" value={character.sliders.youngMature} />
          <SliderBar label="Atmosfer" leftLabel="Eglenceli" rightLabel="Ciddi" value={character.sliders.playfulSerious} />
          <SliderBar label="Segment" leftLabel="Kitle" rightLabel="Elit" value={character.sliders.massElite} />
        </div>
      )}

      {/* We Are This / We Are Not This */}
      {(character?.weAreThis?.length || character?.weAreNotThis?.length) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          {character.weAreThis?.length > 0 && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsUp className="w-4 h-4 text-emerald-600" />
                <p className="font-commons text-[11px] text-emerald-600 uppercase tracking-wider font-medium">Biz Buyuz</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {character.weAreThis.map((item, i) => (
                  <span key={i} className="font-commons text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">{item}</span>
                ))}
              </div>
            </div>
          )}
          {character.weAreNotThis?.length > 0 && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsDown className="w-4 h-4 text-red-600" />
                <p className="font-commons text-[11px] text-red-600 uppercase tracking-wider font-medium">Biz Bu Degiliz</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {character.weAreNotThis.map((item, i) => (
                  <span key={i} className="font-commons text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full">{item}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Behaviors Table */}
      {character?.behaviors?.length > 0 && (
        <div className="mb-5">
          <p className="font-commons text-[11px] text-purple-500 uppercase tracking-wider font-medium mb-2">Deger Davranislari</p>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-purple-100">
                  <th className="font-commons text-[10px] text-gray-500 uppercase pb-2 pr-3">Deger</th>
                  <th className="font-commons text-[10px] text-emerald-500 uppercase pb-2 pr-3">Yap</th>
                  <th className="font-commons text-[10px] text-red-500 uppercase pb-2 pr-3">Yapma</th>
                  <th className="font-commons text-[10px] text-gray-500 uppercase pb-2">Ornek</th>
                </tr>
              </thead>
              <tbody>
                {character.behaviors.map((b, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="font-commons text-sm font-medium text-gray-900 py-2.5 pr-3">{b.value}</td>
                    <td className="font-commons text-xs text-emerald-700 py-2.5 pr-3">{b.do}</td>
                    <td className="font-commons text-xs text-red-600 py-2.5 pr-3">{b.dont}</td>
                    <td className="font-commons text-xs text-gray-500 py-2.5">{b.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden space-y-2">
            {character.behaviors.map((b, i) => (
              <div key={i} className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                <p className="font-commons text-sm font-semibold text-gray-900 mb-1">{b.value}</p>
                <p className="font-commons text-xs text-emerald-700 mb-0.5"><CheckCircle2 className="w-3 h-3 inline mr-1" />{b.do}</p>
                <p className="font-commons text-xs text-red-600 mb-0.5"><Minus className="w-3 h-3 inline mr-1" />{b.dont}</p>
                <p className="font-commons text-xs text-gray-500 italic">{b.example}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dinner Party Description */}
      {character?.dinnerPartyDescription && (
        <div className="bg-gray-50 rounded-xl p-5 border-l-4 border-l-purple-300">
          <p className="font-commons text-[11px] text-purple-500 uppercase tracking-wider font-medium mb-2">Aksam Yemegi Tasviri</p>
          <p className="font-commons text-sm text-gray-700 italic leading-relaxed">&ldquo;{character.dinnerPartyDescription}&rdquo;</p>
        </div>
      )}
    </SectionCard>
  );
}

function CompetitorSection({ competitors, discovery }: { competitors?: AIAnalysis['sectorResearch'] extends infer R ? R extends { competitors: infer C } ? C : never : never; discovery?: AIAnalysis['competitorDiscovery'] }) {
  const hasEnriched = discovery && ([...(discovery.knownCompetitors || []), ...(discovery.discoveredCompetitors || [])].length > 0);
  const hasBase = competitors && competitors.length > 0;
  if (!hasEnriched && !hasBase) return null;

  // If enriched data exists, prefer it (it's a superset of base competitors)
  if (hasEnriched) {
    const allCompetitors = [...(discovery!.knownCompetitors || []), ...(discovery!.discoveredCompetitors || [])];
    return (
      <SectionCard>
        <SectionTitle icon={Target} title="Rekabet Analizi" color="emerald" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          {allCompetitors.slice(0, 6).map((c, i) => (
            <div key={i} className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="font-commons text-sm font-semibold text-gray-900">{c.name}</p>
                  <span className={`font-commons text-[9px] px-1.5 py-0.5 rounded-full ${
                    c.source === 'declared' ? 'bg-blue-100 text-blue-600' :
                    c.source === 'research' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {c.source === 'declared' ? 'Beyan' : c.source === 'research' ? 'Arastirma' : 'Kesfedilen'}
                  </span>
                </div>
                {c.website && (
                  <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="text-emerald-500">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <p className="font-commons text-xs text-gray-600 mb-2">{c.positioning}</p>
              <div className="flex items-center gap-3 text-[10px] font-commons text-gray-500">
                <span>Fiyat: {c.priceSegment}</span>
                <span>Dijital: {c.digitalPresenceScore}/10</span>
              </div>
            </div>
          ))}
        </div>

        {discovery!.digitalBenchmark && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="font-commons text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">Dijital Benchmark</p>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="font-commons text-[10px] text-gray-400">Ort. Web Kalitesi</p><p className="font-commons text-sm font-semibold text-gray-800">{discovery!.digitalBenchmark.avgWebsiteQuality}/10</p></div>
              <div><p className="font-commons text-[10px] text-gray-400">Ort. Takipci</p><p className="font-commons text-sm font-semibold text-gray-800">{discovery!.digitalBenchmark.avgSocialFollowing}</p></div>
              <div><p className="font-commons text-[10px] text-gray-400">Ort. Paylasim</p><p className="font-commons text-sm font-semibold text-gray-800">{discovery!.digitalBenchmark.avgPostingFrequency}</p></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {discovery!.entryBarriers?.length > 0 && (
            <div className="bg-red-50 rounded-xl p-4">
              <p className="font-commons text-[11px] text-red-600 uppercase tracking-wider font-medium mb-2">Giris Engelleri</p>
              <ul className="space-y-1">{discovery!.entryBarriers.map((b, i) => (
                <li key={i} className="font-commons text-xs text-gray-700 flex gap-1.5"><AlertCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />{b}</li>
              ))}</ul>
            </div>
          )}
          {discovery!.competitiveOpportunities?.length > 0 && (
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="font-commons text-[11px] text-emerald-600 uppercase tracking-wider font-medium mb-2">Rekabet Firsatlari</p>
              <ul className="space-y-1">{discovery!.competitiveOpportunities.map((o, i) => (
                <li key={i} className="font-commons text-xs text-gray-700 flex gap-1.5"><Zap className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />{o}</li>
              ))}</ul>
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  // Fallback: base competitors only
  return <CompetitorReportBase competitors={competitors!} />;
}

function CompetitorReportBase({ competitors }: { competitors: NonNullable<AIAnalysis['sectorResearch']>['competitors'] }) {
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

      {vw.colorPalette?.length > 0 && (
        <div className="mb-5">
          <p className="font-commons text-[11px] text-rose-500 uppercase tracking-wider font-medium mb-3">Renk Paleti</p>
          <div className="flex flex-wrap gap-3">
            {vw.colorPalette.map((c, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl shadow-sm border border-gray-200" style={{ backgroundColor: c.hex }} />
                <p className="font-commons text-[10px] text-gray-700 font-medium mt-1.5">{c.name}</p>
                <p className="font-commons text-[9px] text-gray-400">{c.usage}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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

function ContentStrategyReport({ cs, blogInsights, templates }: { cs: NonNullable<AIAnalysis['contentStrategy']>; blogInsights?: any; templates?: AIAnalysis['socialMediaTemplates'] }) {
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

      {/* Social Media Templates (Faz C2) */}
      {templates && templates.length > 0 && (
        <SocialMediaTemplatesAccordion templates={templates} />
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
                      <td className="font-commons text-sm text-gray-700 py-2.5 pr-3">
                        {item.action}
                        {item.bottleneck && item.bottleneck !== 'none' && (
                          <span className={`ml-1.5 inline-block text-[9px] px-1.5 py-0.5 rounded-full ${
                            item.bottleneck === 'motivation' ? 'bg-amber-50 text-amber-700' :
                            item.bottleneck === 'ability' ? 'bg-blue-50 text-blue-700' :
                            'bg-purple-50 text-purple-700'
                          }`}>
                            {item.bottleneck === 'motivation' ? 'Motivasyon' : item.bottleneck === 'ability' ? 'Yetenek' : 'Tetikleyici'}
                          </span>
                        )}
                      </td>
                      <td className="font-commons text-xs text-gray-500 py-2.5 pr-3">{item.owner}</td>
                      <td className="font-commons text-xs text-gray-500 py-2.5 pr-3">{item.metric}</td>
                      <td className="font-commons text-xs text-gray-500 py-2.5">{item.estimatedImpact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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

// ─── CTA Section (fallback when no intibaEngagement) ───

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
        <a href="https://intiba.co.uk/iletisim" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-full font-commons text-sm font-medium hover:bg-gray-800 transition-colors">
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

// ─── KPI Framework (Faz A1) ──────────────────────────────

function KPIFrameworkSection({ kpi }: { kpi: NonNullable<AIAnalysis['kpiFramework']> }) {
  return (
    <SectionCard>
      <SectionTitle icon={Gauge} title="Performans Olcum Cercevesi (KPI)" color="emerald" />

      {/* North Star */}
      <div className="bg-emerald-50 rounded-xl p-5 mb-5 text-center border-2 border-emerald-200">
        <p className="font-commons text-[11px] text-emerald-500 uppercase tracking-wider font-medium mb-2">North Star Metrigi</p>
        <p className="font-ramillas text-xl sm:text-2xl font-bold text-emerald-900 mb-3">{kpi.northStar.metric}</p>
        <div className="flex justify-center gap-6">
          <div>
            <p className="font-commons text-[10px] text-gray-400 uppercase">Mevcut Tahmin</p>
            <p className="font-commons text-sm font-semibold text-gray-700">{kpi.northStar.currentEstimate}</p>
          </div>
          <div className="w-px bg-emerald-200" />
          <div>
            <p className="font-commons text-[10px] text-gray-400 uppercase">90 Gun Hedefi</p>
            <p className="font-commons text-sm font-semibold text-emerald-700">{kpi.northStar.target90Day}</p>
          </div>
        </div>
      </div>

      {/* Leading & Lagging Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {kpi.leading?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <p className="font-commons text-[11px] text-blue-600 uppercase tracking-wider font-medium">Oncu Gostergeler</p>
            </div>
            <div className="space-y-2">
              {kpi.leading.map((ind, i) => (
                <div key={i} className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <p className="font-commons text-sm font-medium text-gray-800">{ind.metric}</p>
                  <div className="flex gap-4 mt-1 text-xs font-commons text-gray-600">
                    <span><span className="text-blue-500 font-medium">Hedef:</span> {ind.target}</span>
                    <span><span className="text-blue-500 font-medium">Olcum:</span> {ind.measurementMethod}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {kpi.lagging?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <p className="font-commons text-[11px] text-purple-600 uppercase tracking-wider font-medium">Sonuc Metrikleri</p>
            </div>
            <div className="space-y-2">
              {kpi.lagging.map((ind, i) => (
                <div key={i} className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                  <p className="font-commons text-sm font-medium text-gray-800">{ind.metric}</p>
                  <div className="flex gap-4 mt-1 text-xs font-commons text-gray-600">
                    <span><span className="text-purple-500 font-medium">Hedef:</span> {ind.target}</span>
                    <span><span className="text-purple-500 font-medium">Olcum:</span> {ind.measurementMethod}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Review Cadence */}
      {kpi.reviewCadence && (
        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <p className="font-commons text-sm text-gray-700"><span className="font-medium">Gozden Gecirme Periyodu:</span> {kpi.reviewCadence}</p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Brand Claim Section ─────────────────────────────────────

function BrandClaimSection({ brandClaim }: { brandClaim: NonNullable<AIAnalysis['brandClaim']> }) {
  const [copiedClaim, setCopiedClaim] = useState(false);
  const [copiedContent, setCopiedContent] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string>(brandClaim.contentExamples[0]?.channel || '');

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      if (key === 'claim') { setCopiedClaim(true); setTimeout(() => setCopiedClaim(false), 1500); }
      else { setCopiedContent(key); setTimeout(() => setCopiedContent(null), 1500); }
    });
  };

  const channelLabel: Record<string, string> = {
    instagram: 'Instagram',
    website_hero: 'Web Hero',
    campaign_tagline: 'Kampanya',
    email_subject: 'E-posta',
    linkedin: 'LinkedIn',
    story: 'Story',
  };

  const activeExample = brandClaim.contentExamples.find(e => e.channel === activeChannel);

  return (
    <SectionCard className="border-2 border-amber-100 bg-gradient-to-br from-white to-amber-50/20 print:break-before-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="font-commons text-[11px] text-amber-600 uppercase tracking-widest mb-1">Marka İddiaası</p>
          <h2 className="font-ramillas text-xl sm:text-2xl font-bold text-gray-900">İddia, Dil Rehberi & İçerik Örnekleri</h2>
        </div>
        <div className="p-2 bg-amber-100 rounded-xl">
          <Megaphone className="w-5 h-5 text-amber-600" />
        </div>
      </div>

      {/* Claim */}
      <div className="mb-6 p-5 bg-gray-900 rounded-2xl relative group">
        <p className="font-ramillas text-xl sm:text-2xl font-bold text-white leading-snug pr-10">{brandClaim.claim}</p>
        <button
          onClick={() => copyText(brandClaim.claim, 'claim')}
          className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          title="Kopyala"
        >
          {copiedClaim ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/60" />}
        </button>
        {brandClaim.claimRationale && (
          <p className="font-commons text-sm text-white/70 mt-3 leading-relaxed">{brandClaim.claimRationale}</p>
        )}
        {brandClaim.blogEvidence?.sourceArticles?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {brandClaim.blogEvidence.sourceArticles.map((a, i) => (
              <span key={i} className="font-commons text-[11px] text-amber-300 bg-amber-900/30 px-2.5 py-1 rounded-full">
                {a.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Two-column grid: Language Guide + Content Examples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Language Guide */}
        <div className="space-y-4">
          <h3 className="font-commons text-sm font-semibold text-gray-700 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-500" /> Dil Rehberi
          </h3>

          {brandClaim.languageGuide.usePhrases.length > 0 && (
            <div>
              <p className="font-commons text-[11px] text-emerald-600 font-semibold uppercase tracking-wide mb-2">✅ Kullan</p>
              <ul className="space-y-1.5">
                {brandClaim.languageGuide.usePhrases.map((phrase, i) => (
                  <li key={i} className="font-commons text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
                    <span>{phrase}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brandClaim.languageGuide.avoidPhrases.length > 0 && (
            <div>
              <p className="font-commons text-[11px] text-red-500 font-semibold uppercase tracking-wide mb-2">❌ Kullanma</p>
              <ul className="space-y-1.5">
                {brandClaim.languageGuide.avoidPhrases.map((phrase, i) => (
                  <li key={i} className="font-commons text-sm text-gray-500 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{phrase}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brandClaim.languageGuide.toneExamples.length > 0 && (
            <div>
              <p className="font-commons text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-2">Ton Örnekleri</p>
              <div className="space-y-3">
                {brandClaim.languageGuide.toneExamples.map((ex, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2">
                      <p className="font-commons text-[11px] font-semibold text-gray-500">{ex.situation}</p>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-red-400 text-xs flex-shrink-0 mt-0.5">✗</span>
                        <p className="font-commons text-xs text-gray-400 line-through leading-relaxed">{ex.wrongWay}</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500 text-xs flex-shrink-0 mt-0.5">✓</span>
                        <p className="font-commons text-xs text-gray-700 leading-relaxed font-medium">{ex.rightWay}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content Examples */}
        <div className="space-y-4">
          <h3 className="font-commons text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" /> İçerik Örnekleri
          </h3>

          {/* Channel Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {brandClaim.contentExamples.map(ex => (
              <button
                key={ex.channel}
                onClick={() => setActiveChannel(ex.channel)}
                className={`font-commons text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  activeChannel === ex.channel
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
                }`}
              >
                {channelLabel[ex.channel] || ex.channel}
              </button>
            ))}
          </div>

          {/* Active Example */}
          {activeExample && (
            <div className="relative bg-gray-50 rounded-xl border border-gray-200 p-4">
              <p className="font-commons text-sm text-gray-800 leading-relaxed whitespace-pre-line pr-8">{activeExample.content}</p>
              <button
                onClick={() => copyText(activeExample.content, activeExample.channel)}
                className="absolute top-3 right-3 p-1.5 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                title="Kopyala"
              >
                {copiedContent === activeExample.channel
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  : <Copy className="w-3.5 h-3.5 text-gray-400" />}
              </button>
              {activeExample.note && (
                <p className="font-commons text-[11px] text-gray-400 mt-3 border-t border-gray-200 pt-2">{activeExample.note}</p>
              )}
            </div>
          )}

          {/* Blog Pattern Summary */}
          {brandClaim.blogEvidence?.patternSummary && (
            <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
              <p className="font-commons text-[11px] text-amber-600 font-semibold uppercase tracking-wide mb-1.5">Blog Kanıtı</p>
              <p className="font-commons text-sm text-amber-800 leading-relaxed">{brandClaim.blogEvidence.patternSummary}</p>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Brand Brief Card (Faz A2) ──────────────────────────────

function BrandBriefCard({ a, businessName }: { a: AIAnalysis; businessName: string }) {
  return (
    <SectionCard className="!p-8 sm:!p-10 print:break-before-page border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-commons text-[11px] text-indigo-500 uppercase tracking-widest mb-1">Marka Ozet Karti</p>
          <h2 className="font-ramillas text-2xl sm:text-3xl font-bold text-gray-900">{businessName}</h2>
        </div>
        <img src="/images/intibalogo.svg" alt="intiba" className="h-5 invert opacity-30" />
      </div>

      {/* Transformation Statement */}
      {a.strategicDepth?.transformationStatement && (
        <div className="bg-indigo-50 rounded-xl p-4 mb-5 text-center">
          <p className="font-ramillas text-lg sm:text-xl font-bold text-indigo-900">&ldquo;{a.strategicDepth.transformationStatement}&rdquo;</p>
        </div>
      )}

      {/* Core Message / Positioning */}
      <div className="bg-white rounded-xl p-4 mb-4 border border-gray-100">
        <p className="font-commons text-[10px] text-gray-400 uppercase font-medium mb-1">Marka Mesaji</p>
        <p className="font-commons text-sm text-gray-800 leading-relaxed">{a.messagingArchitecture?.coreMessage || a.positioning?.statement || ''}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {/* Traits + Tone */}
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="font-commons text-[10px] text-purple-500 uppercase font-medium mb-2">Kisilik & Ton</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {a.brandPersonality?.traits?.slice(0, 5).map((t, i) => (
              <span key={i} className="font-commons text-[11px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
          {a.brandPersonality?.tone && (
            <p className="font-commons text-xs text-gray-600">{a.brandPersonality.tone}</p>
          )}
        </div>

        {/* We Are / We Are Not */}
        {a.brandCharacter && (
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="mb-2">
              <p className="font-commons text-[10px] text-emerald-500 uppercase font-medium mb-1">Biz Buyuz</p>
              <p className="font-commons text-xs text-gray-700">{a.brandCharacter.weAreThis?.slice(0, 3).join(' · ')}</p>
            </div>
            <div>
              <p className="font-commons text-[10px] text-red-500 uppercase font-medium mb-1">Biz Bu Degiliz</p>
              <p className="font-commons text-xs text-gray-700">{a.brandCharacter.weAreNotThis?.slice(0, 3).join(' · ')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Color Palette */}
      {a.visualWorld?.colorPalette?.length > 0 && (
        <div className="flex items-center gap-3 mb-5">
          <p className="font-commons text-[10px] text-gray-400 uppercase font-medium shrink-0">Renkler</p>
          <div className="flex gap-2">
            {a.visualWorld.colorPalette.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} />
                <span className="font-commons text-[10px] text-gray-500">{c.hex}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom row: North Star + First 3 Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {a.kpiFramework?.northStar && (
          <div className="bg-emerald-50 rounded-xl p-4">
            <p className="font-commons text-[10px] text-emerald-500 uppercase font-medium mb-1">North Star KPI</p>
            <p className="font-commons text-sm font-semibold text-gray-800">{a.kpiFramework.northStar.metric}</p>
            <p className="font-commons text-xs text-gray-500 mt-1">90-gun hedefi: {a.kpiFramework.northStar.target90Day}</p>
          </div>
        )}

        {a.actionPlan?.immediate?.length > 0 && (
          <div className="bg-red-50 rounded-xl p-4">
            <p className="font-commons text-[10px] text-red-500 uppercase font-medium mb-2">Ilk Aksiyonlar</p>
            <ul className="space-y-1">
              {a.actionPlan.immediate.slice(0, 3).map((item, i) => (
                <li key={i} className="font-commons text-xs text-gray-700 flex gap-1.5">
                  <span className="text-red-400 font-bold">{i + 1}.</span> {item.action}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Social Media Templates Accordion (Faz C2) ──────────────

function SocialMediaTemplatesAccordion({ templates }: { templates: NonNullable<AIAnalysis['socialMediaTemplates']> }) {
  const [expanded, setExpanded] = useState(false);

  const platformColors: Record<string, string> = {
    Instagram: 'pink',
    LinkedIn: 'blue',
    TikTok: 'violet',
  };

  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <FileText className="w-4 h-4 text-indigo-500" />
        <p className="font-commons text-[11px] text-indigo-500 uppercase tracking-wider font-medium">
          Hazir Icerik Sablonlari ({templates.length})
        </p>
        <div className="ml-auto">
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {templates.map((tpl, i) => {
            const color = platformColors[tpl.platform] || 'gray';
            return (
              <div key={i} className={`bg-${color}-50 rounded-xl p-4 border border-${color}-100`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-commons text-[9px] px-1.5 py-0.5 rounded-full bg-${color}-100 text-${color}-700 font-medium`}>{tpl.platform}</span>
                    <span className="font-commons text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{tpl.format}</span>
                  </div>
                  <span className="font-commons text-[9px] text-gray-400">{tpl.pillar}</span>
                </div>
                <p className={`font-commons text-sm font-semibold text-${color}-800 mb-1`}>{tpl.hookLine}</p>
                <p className="font-commons text-xs text-gray-600 mb-2 whitespace-pre-line">{tpl.bodyTemplate}</p>
                <p className={`font-commons text-xs font-medium text-${color}-700 mb-3`}>CTA: {tpl.callToAction}</p>
                <div className="bg-white rounded-lg p-3 border border-gray-100">
                  <p className="font-commons text-[10px] text-gray-400 uppercase font-medium mb-1">Ornek Caption (Kopyala-Yapistir)</p>
                  <p className="font-commons text-xs text-gray-700 leading-relaxed whitespace-pre-line">{tpl.exampleCaption}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Messaging Architecture (Faz B1) ────────────────────────

function MessagingArchitectureSection({ messaging }: { messaging: NonNullable<AIAnalysis['messagingArchitecture']> }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <SectionCard>
      <SectionTitle icon={Megaphone} title="Mesajlasma Mimarisi" color="orange" />

      {/* Core Message */}
      <div className="bg-orange-50 rounded-xl p-5 mb-5 text-center">
        <p className="font-commons text-[11px] text-orange-500 uppercase tracking-wider font-medium mb-2">Marka Vaadi</p>
        <p className="font-ramillas text-lg sm:text-xl font-bold text-gray-900">{messaging.coreMessage}</p>
      </div>

      {/* Tagline Candidates */}
      {messaging.taglineCandidates?.length > 0 && (
        <div className="mb-5">
          <p className="font-commons text-[11px] text-orange-500 uppercase tracking-wider font-medium mb-3">Slogan Onerileri</p>
          <div className="flex flex-wrap gap-2">
            {messaging.taglineCandidates.map((t, i) => (
              <span key={i} className="font-commons text-sm bg-orange-50 text-orange-800 px-4 py-2 rounded-full border border-orange-200 font-medium">
                &ldquo;{t}&rdquo;
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Elevator Pitches */}
      {messaging.elevatorPitches && (
        <div className="mb-5">
          <p className="font-commons text-[11px] text-orange-500 uppercase tracking-wider font-medium mb-3">Tanitim Metinleri</p>
          <div className="space-y-3">
            {[
              { label: '30 Saniye — Networking', text: messaging.elevatorPitches.thirtySecond, idx: 0 },
              { label: '2 Dakika — Website Hakkimizda', text: messaging.elevatorPitches.twoMinute, idx: 1 },
              { label: 'Yatirimci Pitch', text: messaging.elevatorPitches.investor, idx: 2 },
            ].map(({ label, text, idx }) => text ? (
              <div key={idx} className="bg-white rounded-xl p-4 border border-gray-100 relative">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-commons text-[10px] text-orange-500 uppercase font-medium">{label}</p>
                  <button onClick={() => copyText(text, idx)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                    <Copy className="w-3 h-3" />
                    {copiedIdx === idx ? 'Kopyalandi' : 'Kopyala'}
                  </button>
                </div>
                <p className="font-commons text-sm text-gray-700 leading-relaxed">{text}</p>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* Audience Messages */}
      {messaging.audienceMessages?.length > 0 && (
        <div>
          <p className="font-commons text-[11px] text-orange-500 uppercase tracking-wider font-medium mb-3">Segmente Ozel Mesajlar</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {messaging.audienceMessages.map((msg, i) => (
              <div key={i} className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                <p className="font-commons text-[10px] text-orange-600 uppercase font-medium mb-2">{msg.segment}</p>
                <p className="font-commons text-sm font-semibold text-gray-900 mb-1">{msg.headline}</p>
                <p className="font-commons text-xs text-gray-700 mb-2">{msg.subheadline}</p>
                <p className="font-commons text-[11px] text-gray-500 italic">Kanit: {msg.proof}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Customer Journey Map (Faz C1) ──────────────────────────

const JOURNEY_STAGE_COLORS: Record<string, string> = {
  farkindalik: 'blue',
  ilgi: 'cyan',
  degerlendirme: 'amber',
  satin_alma: 'emerald',
  sadakat: 'purple',
};

const JOURNEY_STAGE_ICONS: Record<string, string> = {
  farkindalik: '👁️',
  ilgi: '💡',
  degerlendirme: '🔍',
  satin_alma: '🛒',
  sadakat: '❤️',
};

function CustomerJourneySection({ journey }: { journey: NonNullable<AIAnalysis['customerJourney']> }) {
  return (
    <SectionCard>
      <SectionTitle icon={Map} title="Musteri Yolculugu Haritasi" color="cyan" />

      {/* Horizontal flow on desktop, vertical on mobile */}
      <div className="hidden md:flex gap-2 mb-4">
        {journey.map((stage, i) => {
          const color = JOURNEY_STAGE_COLORS[stage.stage] || 'gray';
          return (
            <div key={i} className={`flex-1 bg-${color}-50 rounded-xl p-4 border border-${color}-100 relative`}>
              {i < journey.length - 1 && (
                <div className="absolute top-1/2 -right-2 w-4 h-4 flex items-center justify-center z-10">
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              )}
              <div className="text-center mb-3">
                <span className="text-2xl">{JOURNEY_STAGE_ICONS[stage.stage] || '📍'}</span>
                <p className={`font-commons text-xs font-semibold text-${color}-700 mt-1`}>{stage.stageLabel}</p>
              </div>
              <p className="font-commons text-[11px] text-gray-700 mb-2">{stage.customerAction}</p>
              <div className="space-y-1.5">
                <div>
                  <p className={`font-commons text-[9px] text-${color}-500 uppercase font-medium`}>Temas Noktalari</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {stage.touchpoints?.map((t, j) => (
                      <span key={j} className={`font-commons text-[10px] bg-${color}-100 text-${color}-700 px-1.5 py-0.5 rounded`}>{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={`font-commons text-[9px] text-${color}-500 uppercase font-medium`}>Duygu</p>
                  <p className="font-commons text-[10px] text-gray-600 italic">{stage.emotion}</p>
                </div>
                <div>
                  <p className={`font-commons text-[9px] text-${color}-500 uppercase font-medium`}>Firsat</p>
                  <p className="font-commons text-[10px] text-gray-700">{stage.brandOpportunity}</p>
                </div>
                <div>
                  <p className={`font-commons text-[9px] text-${color}-500 uppercase font-medium`}>Icerik</p>
                  <p className={`font-commons text-[10px] font-medium text-${color}-700`}>{stage.contentType}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: Vertical flow */}
      <div className="md:hidden space-y-3">
        {journey.map((stage, i) => {
          const color = JOURNEY_STAGE_COLORS[stage.stage] || 'gray';
          return (
            <div key={i} className={`bg-${color}-50 rounded-xl p-4 border border-${color}-100`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{JOURNEY_STAGE_ICONS[stage.stage] || '📍'}</span>
                <p className={`font-commons text-sm font-semibold text-${color}-700`}>{stage.stageLabel}</p>
              </div>
              <p className="font-commons text-xs text-gray-700 mb-2">{stage.customerAction}</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {stage.touchpoints?.map((t, j) => (
                  <span key={j} className={`font-commons text-[10px] bg-${color}-100 text-${color}-700 px-1.5 py-0.5 rounded`}>{t}</span>
                ))}
              </div>
              <p className="font-commons text-[11px] text-gray-600 italic mb-1">{stage.emotion}</p>
              <p className="font-commons text-[11px] text-gray-700">{stage.brandOpportunity}</p>
              <p className={`font-commons text-[11px] font-medium text-${color}-700 mt-1`}>{stage.contentType}</p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── Consumer Test Section (Faz E1) ──────────────────────

function ConsumerTestSection({ consumerTest }: { consumerTest: NonNullable<AIAnalysis['consumerTest']> }) {
  const [expandedJtbd, setExpandedJtbd] = useState(false);

  const readinessConfig = {
    hazir: { label: 'Pazar Hazir', color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', desc: 'Hedef kitleniz stratejinize yuksek uyum gosteriyor.' },
    iyilestirme_gerekli: { label: 'Iyilestirme Gerekli', color: 'amber', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', desc: 'Bazi segmentlerde mesajlasma optimizasyonu onerilir.' },
    yeniden_dusunulmeli: { label: 'Yeniden Dusunulmeli', color: 'red', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', desc: 'Strateji veya hedef kitle secimi gozden gecirilmeli.' },
  };

  const readiness = readinessConfig[consumerTest.marketReadiness] || readinessConfig.iyilestirme_gerekli;

  const likelihoodColors: Record<string, string> = { yuksek: 'emerald', orta: 'amber', dusuk: 'orange', cok_dusuk: 'red' };
  const likelihoodLabels: Record<string, string> = { yuksek: 'Yuksek', orta: 'Orta', dusuk: 'Dusuk', cok_dusuk: 'Cok Dusuk' };

  return (
    <SectionCard>
      <SectionTitle icon={Users} title="Tuketici Dogrulama Paneli" color="blue" />

      {/* Market Readiness Banner */}
      <div className={`${readiness.bg} border ${readiness.border} rounded-xl p-4 mb-5 flex items-center gap-4`}>
        <div className="flex-1">
          <p className={`font-commons text-sm font-semibold ${readiness.text}`}>{readiness.label}</p>
          <p className="font-commons text-xs text-gray-600 mt-0.5">{readiness.desc}</p>
        </div>
        <div className="text-center shrink-0">
          <p className={`font-commons text-3xl font-bold ${readiness.text}`}>{consumerTest.overallViabilityScore}</p>
          <p className="font-commons text-[10px] text-gray-400 uppercase">Uygunluk Skoru</p>
        </div>
      </div>

      {/* Strongest / Weakest Fit */}
      {(consumerTest.strongestFit || consumerTest.weakestFit) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {consumerTest.strongestFit && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="font-commons text-[11px] text-emerald-600 uppercase tracking-wider font-medium">En Guclu Segment</p>
              </div>
              <p className="font-commons text-sm text-gray-800 font-medium">{consumerTest.strongestFit}</p>
            </div>
          )}
          {consumerTest.weakestFit && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <p className="font-commons text-[11px] text-red-600 uppercase tracking-wider font-medium">En Zayif Segment</p>
              </div>
              <p className="font-commons text-sm text-gray-800 font-medium">{consumerTest.weakestFit}</p>
            </div>
          )}
        </div>
      )}

      {/* Persona Cards */}
      {consumerTest.personas?.length > 0 && (
        <div className="mb-5">
          <p className="font-commons text-[11px] text-blue-600 uppercase tracking-wider font-medium mb-3">Persona Uyum Analizi</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {consumerTest.personas.map((p, i) => {
              const lColor = likelihoodColors[p.purchaseLikelihood] || 'gray';
              return (
                <div key={i} className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-commons text-sm font-semibold text-gray-900">{p.personaLabel}</p>
                    <span className={`font-commons text-[9px] px-1.5 py-0.5 rounded-full bg-${lColor}-100 text-${lColor}-700 font-medium shrink-0 ml-2`}>
                      {likelihoodLabels[p.purchaseLikelihood] || p.purchaseLikelihood}
                    </span>
                  </div>
                  <p className="font-commons text-xs text-gray-500 mb-3">{p.demographics}</p>

                  {/* Alignment bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-commons text-[10px] text-blue-500 uppercase font-medium">Strateji Uyumu</p>
                      <p className="font-commons text-[10px] font-bold text-blue-700">{p.alignmentScore}/100</p>
                    </div>
                    <div className="h-1.5 bg-blue-100 rounded-full">
                      <div
                        className={`h-full rounded-full ${p.alignmentScore >= 70 ? 'bg-emerald-400' : p.alignmentScore >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${p.alignmentScore}%` }}
                      />
                    </div>
                  </div>

                  {p.resonancePoints?.length > 0 && (
                    <div className="mb-2">
                      <p className="font-commons text-[9px] text-blue-500 uppercase font-medium mb-1">Rezonans Noktalari</p>
                      <div className="flex flex-wrap gap-1">
                        {p.resonancePoints.slice(0, 3).map((r, j) => (
                          <span key={j} className="font-commons text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {p.recommendedMessageAngle && (
                    <p className="font-commons text-[11px] text-gray-600 italic mt-1">{p.recommendedMessageAngle}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* JTBD Scenarios (collapsible) */}
      {consumerTest.jtbdScenarios && consumerTest.jtbdScenarios.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={() => setExpandedJtbd(!expandedJtbd)}
            className="flex items-center gap-2 w-full text-left"
          >
            <p className="font-commons text-[11px] text-blue-500 uppercase tracking-wider font-medium">
              Ise Alinma Senaryolari (JTBD) — {consumerTest.jtbdScenarios.length} senaryo
            </p>
            <div className="ml-auto">
              {expandedJtbd ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {expandedJtbd && (
            <div className="mt-3 space-y-3">
              {consumerTest.jtbdScenarios.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-commons text-sm font-semibold text-gray-900">{s.situationLabel}</p>
                    <span className={`font-commons text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${
                      s.strategyJobFitScore >= 70 ? 'bg-emerald-100 text-emerald-700' :
                      s.strategyJobFitScore >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      Uyum: {s.strategyJobFitScore}/100
                    </span>
                  </div>
                  <p className="font-commons text-xs text-gray-700 mb-3">{s.jobToBeDone}</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-commons">
                    {s.pushForces?.length > 0 && (
                      <div>
                        <p className="text-emerald-500 uppercase font-medium mb-1">Iten Gucler</p>
                        <ul className="space-y-0.5">{s.pushForces.map((f, j) => <li key={j} className="text-gray-600">+ {f}</li>)}</ul>
                      </div>
                    )}
                    {s.anxieties?.length > 0 && (
                      <div>
                        <p className="text-red-500 uppercase font-medium mb-1">Endiseler</p>
                        <ul className="space-y-0.5">{s.anxieties.map((ax, j) => <li key={j} className="text-gray-600">- {ax}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  {s.fitRationale && (
                    <p className="font-commons text-[11px] text-gray-500 italic mt-2">{s.fitRationale}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cross-persona concerns */}
      {consumerTest.crossPersonaConcerns?.length > 0 && (
        <div className="mt-4 bg-amber-50 rounded-xl p-4 border border-amber-100">
          <p className="font-commons text-[11px] text-amber-600 uppercase tracking-wider font-medium mb-2">Genel Endiseler</p>
          <ul className="space-y-1">
            {consumerTest.crossPersonaConcerns.map((c, i) => (
              <li key={i} className="font-commons text-xs text-gray-700 flex gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />{c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Quality Metrics Section (Faz E2) ────────────────────

function QualityMetricsSection({ metrics }: { metrics: NonNullable<AIAnalysis['qualityMetrics']> }) {
  const score = metrics.distinctivenessScore;
  const gaugeColor = score >= 70 ? 'emerald' : score >= 40 ? 'amber' : 'red';

  return (
    <SectionCard>
      <SectionTitle icon={Gauge} title="Konumlandirma Kalite Skoru" color="violet" />

      {/* Distinctiveness Gauge */}
      <div className="flex items-center gap-6 mb-5">
        <CircularGauge value={score} max={100} size={88} color={gaugeColor} label="Ozgunluk" />
        <div>
          <p className="font-commons text-sm font-semibold text-gray-900 mb-1">
            {score >= 70 ? 'Guclu Ozgunluk' : score >= 40 ? 'Orta Ozgunluk' : 'Ozgunluk Riski'}
          </p>
          <p className="font-commons text-xs text-gray-500">
            {score >= 70
              ? 'Konumlandirmaniz rakiplerden belirgin sekilde ayrisiyor.'
              : score >= 40
              ? 'Bazi alanlarda rakiplerle ortusme mevcut, iyilestirme onerilir.'
              : 'Konumlandirma cok jenerik, ciddi farklilasma gerekli.'}
          </p>
          {metrics.genericPhraseCount === 0 ? (
            <p className="font-commons text-xs text-emerald-600 font-medium mt-2">Sifir jenerik ifade — Mukemmel!</p>
          ) : (
            <p className="font-commons text-xs text-amber-600 mt-2">{metrics.genericPhraseCount} jenerik ifade tespit edildi</p>
          )}
        </div>
      </div>

      {/* Onlyness Test */}
      {metrics.onlynessTest && (
        <div>
          <p className="font-commons text-[11px] text-violet-600 uppercase tracking-wider font-medium mb-2">Onlyness Testi (Marty Neumeier)</p>
          <div className="bg-violet-50 rounded-xl p-4 border border-violet-100 mb-3">
            <p className="font-commons text-sm font-medium text-gray-800 mb-1">&ldquo;{metrics.onlynessTest.statement}&rdquo;</p>
            <p className="font-commons text-[11px] text-violet-500">Bu ifade yalnizca sizin icin dogru mu?</p>
          </div>

          {metrics.onlynessTest.competitorSwaps?.length > 0 && (
            <div>
              <p className="font-commons text-[10px] text-gray-400 uppercase font-medium mb-2">Rakip Swap Testi — Rakip Adi Koyunca Hala Gecerli mi?</p>
              <div className="space-y-1.5">
                {metrics.onlynessTest.competitorSwaps.map((swap, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${swap.stillValid ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                    <span className={`text-sm font-bold ${swap.stillValid ? 'text-red-500' : 'text-emerald-500'}`}>
                      {swap.stillValid ? '✗' : '✓'}
                    </span>
                    <p className="font-commons text-sm text-gray-800 flex-1">{swap.name}</p>
                    <p className={`font-commons text-[11px] ${swap.stillValid ? 'text-red-600' : 'text-emerald-600'}`}>
                      {swap.stillValid ? 'Gecerli (Risk!)' : 'Gecersiz (Iyi!)'}
                    </p>
                  </div>
                ))}
              </div>
              <p className="font-commons text-[10px] text-gray-400 mt-2">
                ✓ Gecersiz = Rakip icin bu ifade dogru degil = Sizin icin ozgun. ✗ Gecerli = Rakip icin de dogru = Farklilasma yetersiz.
              </p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Debate Section (Faz E3) ────────────────────────────

function DebateSection({ debate, synthesisRationale }: {
  debate?: AIAnalysis['debate'];
  synthesisRationale?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!debate && !synthesisRationale) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-5 sm:p-7 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-gray-600" />
        </div>
        <div>
          <p className="font-commons text-sm font-semibold text-gray-800">Strateji Tartismasi</p>
          <p className="font-commons text-xs text-gray-400">Nasil bu sonuca vardik? Degerlendirilen alternatifler.</p>
        </div>
        <div className="ml-auto">
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 sm:px-7 pb-5 sm:pb-7 space-y-4">
          {debate && (
            <>
              {/* Strategist vs Challenger */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {debate.strategistPosition && (
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-indigo-600" />
                      <p className="font-commons text-[11px] text-indigo-600 uppercase tracking-wider font-medium">Strateji Uzmani</p>
                    </div>
                    <p className="font-commons text-sm text-gray-700 leading-relaxed">{debate.strategistPosition}</p>
                  </div>
                )}
                {debate.challengerPosition && (
                  <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Swords className="w-4 h-4 text-rose-600" />
                      <p className="font-commons text-[11px] text-rose-600 uppercase tracking-wider font-medium">Challenger</p>
                    </div>
                    <p className="font-commons text-sm text-gray-700 leading-relaxed">{debate.challengerPosition}</p>
                  </div>
                )}
              </div>

              {/* Alternatives considered */}
              {debate.challengerAlternatives?.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="font-commons text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">Degerlendirilen Alternatifler</p>
                  <ul className="space-y-1.5">
                    {debate.challengerAlternatives.map((alt, i) => (
                      <li key={i} className="font-commons text-sm text-gray-700 flex gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />{alt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Why this path was chosen */}
              {(debate.synthesisRationale || synthesisRationale) && (
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <p className="font-commons text-[11px] text-emerald-600 uppercase tracking-wider font-medium">Secilen Yolun Gerekcesi</p>
                  </div>
                  <p className="font-commons text-sm text-gray-700 leading-relaxed">{debate.synthesisRationale || synthesisRationale}</p>
                </div>
              )}
            </>
          )}

          {/* Top-level synthesisRationale if no debate object */}
          {!debate && synthesisRationale && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="font-commons text-[11px] text-emerald-600 uppercase tracking-wider font-medium">Sentez Gerekcesi</p>
              </div>
              <p className="font-commons text-sm text-gray-700 leading-relaxed">{synthesisRationale}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AnalysisReportPage;
