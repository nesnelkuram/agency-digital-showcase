import React, { useEffect, useState, useRef, Component } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getBrandLeadByShareToken } from '@/shared/services/brandLeadService';
import type { BrandLead } from '@/shared/types/brandLead';
import CoverSection from './sections/CoverSection';
import DiagnosisSection from './sections/DiagnosisSection';
import BrandIdentitySection from './sections/BrandIdentitySection';
import NarrativeSection from './sections/NarrativeSection';
import StrategySection from './sections/StrategySection';
import AudienceSection from './sections/AudienceSection';
import JourneySection from './sections/JourneySection';
import LanguageSection from './sections/LanguageSection';
import ContentSection from './sections/ContentSection';
import MarketSection from './sections/MarketSection';
import DigitalSection from './sections/DigitalSection';
import RisksSection from './sections/RisksSection';
import ActionSection from './sections/ActionSection';
import IntibaSection from './sections/IntibaSection';
import type { SectionVisual } from './SectionBase';

type Visuals = Record<string, SectionVisual>;
type VisualState = 'idle' | 'loading' | 'done' | 'error';

class SectionErrorBoundary extends Component<
  { children: React.ReactNode; name: string },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode; name: string }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message || String(err) };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#fff5f5', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 40,
        }}>
          <div style={{ maxWidth: 600 }}>
            <div style={{ color: '#9b2335', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              RENDER HATASI — {this.props.name}
            </div>
            <pre style={{ color: '#333', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {this.state.error}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function formatDate(ts: any): string {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

const SECTION_IDS = [
  'cover', 'diagnosis', 'identity', 'narrative', 'strategy',
  'audience', 'journey', 'language', 'content',
  'market', 'digital', 'risks', 'action', 'intiba',
];
const TOTAL = SECTION_IDS.length;

export default function ImmersiveReportPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [lead, setLead] = useState<BrandLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visuals, setVisuals] = useState<Visuals>({});
  const [visualState, setVisualState] = useState<VisualState>('idle');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shareToken) { setError(true); setLoading(false); return; }
    getBrandLeadByShareToken(shareToken)
      .then(data => {
        if (!data) { setError(true); } else { setLead(data); }
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [shareToken]);

  useEffect(() => {
    if (!lead || !shareToken) return;
    setVisualState('loading');
    fetch('/api/generate-report-visuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareToken }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.visuals) { setVisuals(data.visuals); setVisualState('done'); }
        else setVisualState('error');
      })
      .catch(() => setVisualState('error'));
  }, [lead, shareToken]);

  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#f5f2ec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ color: 'rgba(28,25,22,0.4)', fontSize: 12, letterSpacing: '0.3em', fontFamily: 'monospace', textTransform: 'uppercase' }}
        >
          Rapor Yükleniyor…
        </motion.div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div style={{ height: '100vh', background: '#f5f2ec', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ color: 'rgba(28,25,22,0.45)', fontSize: 14 }}>Rapor bulunamadı.</div>
        <Link to="/" style={{ color: 'rgba(28,25,22,0.3)', fontSize: 12 }}>Ana sayfaya dön</Link>
      </div>
    );
  }

  const a = lead.aiAnalysis;
  const businessName = lead.contact?.businessName || '';
  const sector = lead.sector || '';
  const bc = (lead as any).wizard?.businessContext;

  return (
    <div style={{ position: 'relative' }}>
      <NavDots sections={SECTION_IDS} containerRef={containerRef} />

      {/* Visual generation status */}
      {visualState === 'loading' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 100,
            background: 'rgba(245,242,236,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '10px 16px',
            color: 'rgba(28,25,22,0.45)', fontSize: 11,
            fontFamily: 'monospace', letterSpacing: '0.1em',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>●</motion.span>
          Görseller üretiliyor…
        </motion.div>
      )}

      {/* Scroll container */}
      <div
        ref={containerRef}
        data-scroll-container
        style={{
          height: '100vh', overflowY: 'auto', overflowX: 'hidden',
          scrollSnapType: 'y proximity', scrollBehavior: 'smooth',
        }}
      >
        {/* 1. Cover */}
        <SectionErrorBoundary name="Cover">
          <CoverSection
            businessName={businessName}
            sector={sector}
            maturityLevel={a?.brandMaturity?.level}
            brandClaim={a?.brandClaim?.claim}
            consultantIntro={a?.consultantIntro}
            analyzedAt={formatDate((lead as any).analyzedAt || (lead as any).updatedAt)}
            visual={visuals.cover}
          />
        </SectionErrorBoundary>

        {/* 2. Diagnosis */}
        <SectionErrorBoundary name="Diagnosis">
          <DiagnosisSection
            index={1} total={TOTAL}
            visual={visuals.diagnosis}
            diagnosisSummary={a?.diagnosisSummary}
            brandMaturity={a?.brandMaturity}
            dataQuality={a?.dataQuality}
            synthesisRationale={(a as any)?.debate?.synthesisRationale || (a as any)?.synthesisRationale}
            consultantIntro={a?.consultantIntro}
            businessContext={bc}
          />
        </SectionErrorBoundary>

        {/* 3. Brand Identity */}
        <SectionErrorBoundary name="BrandIdentity">
          <BrandIdentitySection
            index={2} total={TOTAL}
            visual={visuals.identity}
            brandPersonality={a?.brandPersonality}
            brandCharacter={a?.brandCharacter}
            visualWorld={a?.visualWorld}
            qualityMetrics={a?.qualityMetrics}
            brandNarrative={a?.brandNarrative}
            emotionalNarrative={a?.emotionalNarrative}
            brandEnemy={a?.strategicDepth?.brandEnemy}
          />
        </SectionErrorBoundary>

        {/* 4. Narrative & Messaging */}
        <SectionErrorBoundary name="Narrative">
          <NarrativeSection
            index={3} total={TOTAL}
            visual={visuals.narrative}
            brandNarrative={a?.brandNarrative}
            emotionalNarrative={a?.emotionalNarrative}
            messagingArchitecture={a?.messagingArchitecture}
          />
        </SectionErrorBoundary>

        {/* 5. Strategic Depth */}
        <SectionErrorBoundary name="Strategy">
          <StrategySection
            index={4} total={TOTAL}
            visual={visuals.strategy}
            strategicDepth={a?.strategicDepth}
            strategyScenarios={a?.strategyScenarios}
          />
        </SectionErrorBoundary>

        {/* 6. Audience & Positioning */}
        <SectionErrorBoundary name="Audience">
          <AudienceSection
            index={5} total={TOTAL}
            visual={visuals.audience}
            positioning={a?.positioning}
            consumerTest={a?.consumerTest}
          />
        </SectionErrorBoundary>

        {/* 7. Customer Journey */}
        <SectionErrorBoundary name="Journey">
          <JourneySection
            index={6} total={TOTAL}
            visual={visuals.journey}
            customerJourney={a?.customerJourney as any[]}
            consumerTest={a?.consumerTest}
            perceptualMap={a?.perceptualMap}
            businessName={businessName}
          />
        </SectionErrorBoundary>

        {/* 8. Language, Message & Claim */}
        <SectionErrorBoundary name="Language">
          <LanguageSection
            index={7} total={TOTAL}
            visual={visuals.language}
            brandClaim={a?.brandClaim}
            contentStrategy={a?.contentStrategy}
            messagingArchitecture={a?.messagingArchitecture}
          />
        </SectionErrorBoundary>

        {/* 9. Content Strategy */}
        <SectionErrorBoundary name="Content">
          <ContentSection
            index={8} total={TOTAL}
            visual={visuals.content}
            contentStrategy={a?.contentStrategy}
            socialMediaTemplates={a?.socialMediaTemplates as any[]}
            blogInsights={(a as any)?.blogAdvisorInsights}
          />
        </SectionErrorBoundary>

        {/* 10. Market & Competition */}
        <SectionErrorBoundary name="Market">
          <MarketSection
            index={9} total={TOTAL}
            visual={visuals.market}
            sectorResearch={a?.sectorResearch}
            competitorDiscovery={a?.competitorDiscovery}
            analysis={a?.analysis}
            digitalPresence={a?.digitalPresence}
          />
        </SectionErrorBoundary>

        {/* 11. Digital Presence & Visual World */}
        <SectionErrorBoundary name="Digital">
          <DigitalSection
            index={10} total={TOTAL}
            visual={visuals.digital}
            digitalPresence={a?.digitalPresence}
            visualWorld={a?.visualWorld}
          />
        </SectionErrorBoundary>

        {/* 12. Risks & Quality */}
        <SectionErrorBoundary name="Risks">
          <RisksSection
            index={11} total={TOTAL}
            visual={visuals.risks}
            riskMitigationPlans={a?.riskMitigationPlans as any[]}
            qualityMetrics={a?.qualityMetrics}
            revenueImpact={a?.revenueImpact}
          />
        </SectionErrorBoundary>

        {/* 13. Action Plan */}
        <SectionErrorBoundary name="Action">
          <ActionSection
            index={12} total={TOTAL}
            visual={visuals.action}
            actionPlan={a?.actionPlan}
            kpiFramework={a?.kpiFramework}
            intibaRoadmap={a?.intibaRoadmap}
          />
        </SectionErrorBoundary>

        {/* 14. Intiba Services */}
        <SectionErrorBoundary name="Intiba">
          <IntibaSection
            index={13} total={TOTAL}
            visual={visuals.intiba}
            intibaEngagement={a?.intibaEngagement}
            intibaRoadmap={a?.intibaRoadmap}
            brandName={businessName}
          />
        </SectionErrorBoundary>

      </div>

    </div>
  );
}

function NavDots({
  sections,
  containerRef,
}: {
  sections: string[];
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observers: IntersectionObserver[] = [];

    sections.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(i);
        },
        { root: container, threshold: 0.4 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, [sections, containerRef]);

  const scrollTo = (i: number) => {
    const container = containerRef.current;
    const el = document.getElementById(sections[i]);
    if (container && el) {
      container.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
    }
  };

  return (
    <div style={{
      position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)',
      zIndex: 200, display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      {sections.map((_, i) => (
        <button key={i} onClick={() => scrollTo(i)} style={{
          width: active === i ? 6 : 3, height: active === i ? 6 : 3,
          borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
          background: active === i ? 'rgba(28,25,22,0.7)' : 'rgba(28,25,22,0.18)',
          transition: 'all 0.25s ease',
        }} />
      ))}
    </div>
  );
}
