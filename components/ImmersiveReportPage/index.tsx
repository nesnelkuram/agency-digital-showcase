import React, { useEffect, useState, useRef, Component } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getBrandLeadByShareToken } from '@/shared/services/brandLeadService';
import type { BrandLead } from '@/shared/types/brandLead';
import CoverSection from './sections/CoverSection';
import CurrentStateSection from './sections/CurrentStateSection';
import BrandIdentitySection from './sections/BrandIdentitySection';
import PositioningSection from './sections/PositioningSection';
import MessagingSection from './sections/MessagingSection';
import MarketDigitalSection from './sections/MarketDigitalSection';
import ActionPlanSection from './sections/ActionPlanSection';
import { C, type SectionVisual } from './SectionBase';

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
          minHeight: '100vh', background: '#fef5f5', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 48,
          fontFamily: C.sans,
        }}>
          <div style={{ maxWidth: 600 }}>
            <div style={{ color: C.neg, fontSize: 13, fontWeight: 700, marginBottom: 10, fontFamily: C.mono, letterSpacing: '0.1em' }}>
              RENDER HATASI — {this.props.name}
            </div>
            <pre style={{ color: C.mid, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
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
  'cover', 'currentstate', 'identity', 'positioning',
  'messaging', 'marketdigital', 'actionplan',
];
const TOTAL = SECTION_IDS.length;

const SECTION_LABELS: Record<string, string> = {
  cover: 'Kapak',
  currentstate: 'Mevcut Durum',
  identity: 'Marka Kimliği',
  positioning: 'Konumlandırma',
  messaging: 'Mesaj & İçerik',
  marketdigital: 'Pazar & Dijital',
  actionplan: 'Eylem Planı',
};

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
      <div style={{
        height: '100vh', background: C.bgFlat, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        fontFamily: C.sans,
      }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{ color: C.text, fontSize: 20, fontWeight: 800, fontFamily: C.serif, letterSpacing: '-0.03em', marginBottom: 8, textAlign: 'center' }}>
            intiba<span style={{ color: C.faint }}>.</span>
          </div>
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ color: C.xfaint, fontSize: 13, letterSpacing: '0.2em', fontFamily: C.mono, textTransform: 'uppercase', textAlign: 'center' }}
          >
            Rapor Yükleniyor
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div style={{
        height: '100vh', background: C.bgFlat, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20, fontFamily: C.sans,
      }}>
        <div style={{ color: C.mid, fontSize: 16, fontWeight: 500 }}>Rapor bulunamadı.</div>
        <Link to="/" style={{ color: C.faint, fontSize: 14, textDecoration: 'none', borderBottom: `1px solid ${C.xfaint}`, paddingBottom: 2 }}>
          Ana sayfaya dön
        </Link>
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

      {visualState === 'loading' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 100,
            background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: '12px 20px',
            color: C.faint, fontSize: 13, fontFamily: C.mono, letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 10, boxShadow: C.cardShadow,
          }}
        >
          <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>●</motion.span>
          Görseller üretiliyor
        </motion.div>
      )}

      <div
        ref={containerRef}
        data-scroll-container
        style={{
          height: '100vh', overflowY: 'auto', overflowX: 'hidden',
          scrollSnapType: 'y proximity', scrollBehavior: 'smooth',
        }}
      >
        {/* 1. Kapak */}
        <SectionErrorBoundary name="Cover">
          <CoverSection
            businessName={businessName}
            sector={sector}
            maturityLevel={a?.brandMaturity?.level}
            brandClaim={a?.brandClaim?.claim}
            analyzedAt={formatDate((lead as any).analyzedAt || (lead as any).updatedAt)}
            visual={visuals.cover}
          />
        </SectionErrorBoundary>

        {/* 2. Mevcut Durum */}
        <SectionErrorBoundary name="CurrentState">
          <CurrentStateSection
            index={1} total={TOTAL}
            visual={visuals.currentstate}
            executiveSummary={(a as any)?.executiveSummary}
            brandMaturity={a?.brandMaturity}
            businessContext={bc}
            soWhatAnalysis={(a as any)?.soWhatAnalysis}
            blindSpots={a?.diagnosisSummary?.blindSpots}
          />
        </SectionErrorBoundary>

        {/* 3. Marka Kimliği */}
        <SectionErrorBoundary name="BrandIdentity">
          <BrandIdentitySection
            index={2} total={TOTAL}
            visual={visuals.identity}
            brandPersonality={a?.brandPersonality}
            brandCharacter={a?.brandCharacter}
            visualWorld={a?.visualWorld}
            emotionalNarrative={a?.emotionalNarrative}
            brandEnemy={a?.strategicDepth?.brandEnemy}
          />
        </SectionErrorBoundary>

        {/* 4. Konumlandırma */}
        <SectionErrorBoundary name="Positioning">
          <PositioningSection
            index={3} total={TOTAL}
            visual={visuals.positioning}
            positioning={a?.positioning}
            strategicDepth={a?.strategicDepth}
            recommendedScenario={a?.strategyScenarios?.recommended}
            perceptualMap={a?.perceptualMap}
            businessName={businessName}
          />
        </SectionErrorBoundary>

        {/* 5. Mesaj & İçerik */}
        <SectionErrorBoundary name="Messaging">
          <MessagingSection
            index={4} total={TOTAL}
            visual={visuals.messaging}
            brandClaim={a?.brandClaim}
            brandNarrative={a?.brandNarrative}
            messagingArchitecture={a?.messagingArchitecture}
            contentStrategy={a?.contentStrategy}
            socialMediaTemplates={a?.socialMediaTemplates as any[]}
          />
        </SectionErrorBoundary>

        {/* 6. Pazar & Dijital */}
        <SectionErrorBoundary name="MarketDigital">
          <MarketDigitalSection
            index={5} total={TOTAL}
            visual={visuals.marketdigital}
            sectorResearch={a?.sectorResearch}
            competitorDiscovery={a?.competitorDiscovery}
            analysis={a?.analysis}
            digitalPresence={a?.digitalPresence}
          />
        </SectionErrorBoundary>

        {/* 7. Eylem Planı */}
        <SectionErrorBoundary name="ActionPlan">
          <ActionPlanSection
            index={6} total={TOTAL}
            visual={visuals.actionplan}
            actionPlan={a?.actionPlan}
            kpiFramework={a?.kpiFramework}
            intibaRoadmap={a?.intibaRoadmap}
            intibaEngagement={a?.intibaEngagement}
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
  const [hovered, setHovered] = useState<number | null>(null);

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
      position: 'fixed', right: 22, top: '50%', transform: 'translateY(-50%)',
      zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    }}>
      {sections.map((id, i) => (
        <div
          key={i}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => scrollTo(i)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '5px 0', cursor: 'pointer',
          }}
        >
          <motion.span
            initial={false}
            animate={{ opacity: hovered === i ? 1 : 0, x: hovered === i ? 0 : 8 }}
            transition={{ duration: 0.2 }}
            style={{
              color: C.faint, fontSize: 12, fontFamily: C.sans,
              fontWeight: 500, whiteSpace: 'nowrap', pointerEvents: 'none',
              letterSpacing: '0.04em',
            }}
          >
            {SECTION_LABELS[id] || id}
          </motion.span>

          <div style={{
            width: active === i ? 10 : 5,
            height: active === i ? 10 : 5,
            borderRadius: '50%',
            background: active === i ? C.text : C.xfaint,
            transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
            border: active === i ? `2px solid ${C.xfaint}` : '2px solid transparent',
            boxSizing: 'content-box',
          }} />
        </div>
      ))}
    </div>
  );
}
