import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getBrandLeadByShareToken } from '@/shared/services/brandLeadService';
import type { BrandLead } from '@/shared/types/brandLead';
import CoverSection from './sections/CoverSection';
import DiagnosisSection from './sections/DiagnosisSection';
import BrandIdentitySection from './sections/BrandIdentitySection';
import StrategySection from './sections/StrategySection';
import AudienceSection from './sections/AudienceSection';
import LanguageSection from './sections/LanguageSection';
import MarketSection from './sections/MarketSection';
import ActionSection from './sections/ActionSection';
import IntibaSection from './sections/IntibaSection';
import type { SectionVisual } from './SectionBase';

type Visuals = Record<string, SectionVisual>;
type VisualState = 'idle' | 'loading' | 'done' | 'error';

function formatDate(ts: any): string {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

export default function ImmersiveReportPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [lead, setLead] = useState<BrandLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visuals, setVisuals] = useState<Visuals>({});
  const [visualState, setVisualState] = useState<VisualState>('idle');

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

  // Section order: Cover → Diagnosis → Identity → Strategy → Audience → Language → Market → Action+Intiba
  // Nav dot labels
  const SECTIONS = ['cover', 'diagnosis', 'identity', 'strategy', 'audience', 'language', 'market', 'action'];

  return (
    <div style={{ position: 'relative' }}>
      <NavDots sections={SECTIONS} />

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
      <div style={{ height: '100vh', overflowY: 'scroll', scrollSnapType: 'y mandatory', scrollBehavior: 'smooth' }}>

        {/* 1. Cover */}
        <CoverSection
          businessName={businessName}
          sector={sector}
          maturityLevel={a?.brandMaturity?.level}
          brandClaim={a?.brandClaim?.claim}
          consultantIntro={a?.consultantIntro}
          analyzedAt={formatDate((lead as any).analyzedAt || (lead as any).updatedAt)}
          visual={visuals.cover}
          confidence={a?.evidenceSummaryV2?.overallConfidence}
        />

        {/* 2. Diagnosis */}
        <DiagnosisSection
          index={1}
          visual={visuals.diagnosis}
          diagnosisSummary={a?.diagnosisSummary}
          brandMaturity={a?.brandMaturity}
          dataQuality={a?.dataQuality}
          synthesisRationale={(a as any)?.debate?.synthesisRationale || (a as any)?.synthesisRationale}
          consultantIntro={a?.consultantIntro}
        />

        {/* 3. Brand Identity */}
        <BrandIdentitySection
          index={2}
          visual={visuals.identity}
          brandPersonality={a?.brandPersonality}
          brandCharacter={a?.brandCharacter}
          visualWorld={a?.visualWorld}
          qualityMetrics={a?.qualityMetrics}
          brandNarrative={a?.brandNarrative}
          emotionalNarrative={a?.emotionalNarrative}
          brandEnemy={a?.strategicDepth?.brandEnemy}
        />

        {/* 4. Strategic Depth */}
        <StrategySection
          index={3}
          visual={visuals.strategy}
          strategicDepth={a?.strategicDepth}
          strategyScenarios={a?.strategyScenarios}
        />

        {/* 5. Audience & Positioning */}
        <AudienceSection
          index={4}
          visual={visuals.audience}
          positioning={a?.positioning}
          consumerTest={a?.consumerTest}
        />

        {/* 6. Language, Message & Claim */}
        <LanguageSection
          index={5}
          visual={visuals.language}
          brandClaim={a?.brandClaim}
          contentStrategy={a?.contentStrategy}
          messagingArchitecture={a?.messagingArchitecture}
        />

        {/* 7. Market & Competition */}
        <MarketSection
          index={6}
          visual={visuals.market}
          sectorResearch={a?.sectorResearch}
          competitorDiscovery={a?.competitorDiscovery}
          analysis={a?.analysis}
          digitalPresence={a?.digitalPresence}
        />

        {/* 8. Action Plan + Intiba */}
        <ActionSection
          index={7}
          visual={visuals.action}
          actionPlan={a?.actionPlan}
          kpiFramework={a?.kpiFramework}
          intibaRoadmap={a?.intibaRoadmap}
        />

      </div>

      {/* Back to classic */}
      <Link
        to={`/rapor/${shareToken}`}
        style={{
          position: 'fixed', top: 18, right: 18, zIndex: 200,
          background: 'rgba(245,242,236,0.88)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0,0,0,0.1)',
          color: 'rgba(28,25,22,0.5)', fontSize: 10,
          padding: '6px 14px', borderRadius: 20, textDecoration: 'none',
          letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace',
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        }}
      >
        ← Klasik Görünüm
      </Link>
    </div>
  );
}

function NavDots({ sections }: { sections: string[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = document.querySelector('[style*="scroll-snap-type"]') as HTMLElement;
    if (!container) return;
    const onScroll = () => {
      const idx = Math.round(container.scrollTop / container.clientHeight);
      setActive(Math.min(idx, sections.length - 1));
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [sections.length]);

  const scrollTo = (i: number) => {
    const container = document.querySelector('[style*="scroll-snap-type"]') as HTMLElement;
    if (container) container.scrollTo({ top: i * container.clientHeight, behavior: 'smooth' });
  };

  return (
    <div style={{
      position: 'fixed', right: 20, top: '50%', transform: 'translateY(-50%)',
      zIndex: 200, display: 'flex', flexDirection: 'column', gap: 7,
    }}>
      {sections.map((_, i) => (
        <button key={i} onClick={() => scrollTo(i)} style={{
          width: active === i ? 7 : 4, height: active === i ? 7 : 4,
          borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
          background: active === i ? 'rgba(28,25,22,0.7)' : 'rgba(28,25,22,0.18)',
          transition: 'all 0.25s ease',
        }} />
      ))}
    </div>
  );
}
