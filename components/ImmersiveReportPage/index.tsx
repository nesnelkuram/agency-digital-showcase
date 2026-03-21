import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getBrandLeadByShareToken } from '@/shared/services/brandLeadService';
import type { BrandLead } from '@/shared/types/brandLead';
import CoverSection from './sections/CoverSection';
import BrandIdentitySection from './sections/BrandIdentitySection';
import MarketSection from './sections/MarketSection';
import AudienceSection from './sections/AudienceSection';
import StrategySection from './sections/StrategySection';
import LanguageSection from './sections/LanguageSection';
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

  // Fetch lead data
  useEffect(() => {
    if (!shareToken) { setError(true); setLoading(false); return; }
    getBrandLeadByShareToken(shareToken)
      .then(data => {
        if (!data) { setError(true); } else { setLead(data); }
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [shareToken]);

  // Fetch visuals once lead is loaded
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
      <div style={{
        height: '100vh', background: '#0a0a0a', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, letterSpacing: '0.3em', fontFamily: 'monospace', textTransform: 'uppercase' }}
        >
          Rapor Yükleniyor…
        </motion.div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div style={{
        height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Rapor bulunamadı.</div>
        <Link to="/" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Ana sayfaya dön</Link>
      </div>
    );
  }

  const a = lead.aiAnalysis;
  const businessName = lead.contact?.businessName || '';
  const sector = lead.sector || '';

  return (
    <div style={{ position: 'relative' }}>
      {/* Nav dots */}
      <NavDots />

      {/* Visual generation status (unobtrusive) */}
      {visualState === 'loading' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 100,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, padding: '10px 16px',
            color: 'rgba(255,255,255,0.5)', fontSize: 11,
            fontFamily: 'monospace', letterSpacing: '0.1em',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >●</motion.span>
          Görseller üretiliyor…
        </motion.div>
      )}

      {/* Scroll container */}
      <div style={{
        height: '100vh',
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        scrollBehavior: 'smooth',
      }}>
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

        {/* 2. Brand Identity */}
        <BrandIdentitySection
          index={1}
          visual={visuals.identity}
          brandPersonality={a?.brandPersonality}
          brandCharacter={a?.brandCharacter}
          visualWorld={a?.visualWorld}
          qualityMetrics={a?.qualityMetrics}
          brandNarrative={a?.brandNarrative}
          emotionalNarrative={a?.emotionalNarrative}
        />

        {/* 3. Market */}
        <MarketSection
          index={2}
          visual={visuals.market}
          sectorResearch={a?.sectorResearch}
          competitorDiscovery={a?.competitorDiscovery}
        />

        {/* 4. Audience */}
        <AudienceSection
          index={3}
          visual={visuals.audience}
          positioning={a?.positioning}
          consumerTest={a?.consumerTest}
        />

        {/* 5. Strategy */}
        <StrategySection
          index={4}
          visual={visuals.strategy}
          positioning={a?.positioning}
          strategicDepth={a?.strategicDepth}
          strategyScenarios={a?.strategyScenarios}
          analysis={a?.analysis}
        />

        {/* 6. Language & Claim */}
        <LanguageSection
          index={5}
          visual={visuals.language}
          brandClaim={a?.brandClaim}
          contentStrategy={a?.contentStrategy}
          messagingArchitecture={a?.messagingArchitecture}
        />

        {/* 7. Action Plan */}
        <ActionSection
          index={6}
          visual={visuals.action}
          actionPlan={a?.actionPlan}
          kpiFramework={a?.kpiFramework}
          intibaRoadmap={a?.intibaRoadmap}
        />

        {/* 8. Intiba Services */}
        <IntibaSection
          index={7}
          visual={visuals.intiba}
          intibaEngagement={a?.intibaEngagement}
          intibaRoadmap={a?.intibaRoadmap}
          brandName={businessName}
        />
      </div>

      {/* Back to classic report */}
      <Link
        to={`/rapor/${shareToken}`}
        style={{
          position: 'fixed', top: 20, right: 20, zIndex: 200,
          background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.5)', fontSize: 11,
          padding: '6px 14px', borderRadius: 20, textDecoration: 'none',
          letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'monospace',
          transition: 'all 0.2s',
        }}
      >
        ← Klasik Görünüm
      </Link>
    </div>
  );
}

// Simple scroll-position nav dots
function NavDots() {
  const SECTIONS = ['cover', 'identity', 'market', 'audience', 'strategy', 'language', 'action', 'intiba'];
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = document.querySelector('[style*="scroll-snap-type"]') as HTMLElement;
    if (!container) return;

    const onScroll = () => {
      const scrollTop = container.scrollTop;
      const sectionHeight = container.clientHeight;
      const idx = Math.round(scrollTop / sectionHeight);
      setActive(Math.min(idx, SECTIONS.length - 1));
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (i: number) => {
    const container = document.querySelector('[style*="scroll-snap-type"]') as HTMLElement;
    if (container) container.scrollTo({ top: i * container.clientHeight, behavior: 'smooth' });
  };

  return (
    <div style={{
      position: 'fixed', right: 20, top: '50%', transform: 'translateY(-50%)',
      zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {SECTIONS.map((_, i) => (
        <button
          key={i}
          onClick={() => scrollTo(i)}
          style={{
            width: active === i ? 8 : 5,
            height: active === i ? 8 : 5,
            borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
            background: active === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}
