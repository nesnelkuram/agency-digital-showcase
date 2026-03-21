import React from 'react';
import { motion } from 'framer-motion';
import type { SectionVisual } from '../SectionBase';

interface Props {
  businessName: string;
  sector: string;
  maturityLevel?: string;
  brandClaim?: string;
  consultantIntro?: string;
  analyzedAt?: string;
  visual: SectionVisual | undefined;
}

const MATURITY_LABELS: Record<string, string> = {
  pre_brand: 'Ön-Marka', emerging: 'Gelişen', developing: 'Olgunlaşan', mature: 'Olgun',
};

export default function CoverSection({
  businessName, sector, maturityLevel, brandClaim, consultantIntro, analyzedAt, visual,
}: Props) {
  const bg = visual?.imageB64
    ? `url(data:image/png;base64,${visual.imageB64})`
    : visual?.fallbackGradient || 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)';
  const isBgImage = !!visual?.imageB64;

  return (
    <section style={{
      height: '100vh', scrollSnapAlign: 'start',
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      background: isBgImage ? undefined : bg,
    }}>
      {isBgImage && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: bg, backgroundSize: 'cover', backgroundPosition: 'center',
          filter: 'brightness(0.75)',
        }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1 }} />

      {/* Header bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3,
        padding: '28px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{
          color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em',
        }}>
          intiba<span style={{ color: 'rgba(255,255,255,0.4)' }}>.</span>
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          Marka Analiz Raporu
        </span>
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 40px', maxWidth: 900 }}
      >
        {maturityLevel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              display: 'inline-block',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 20, padding: '5px 16px',
              color: 'rgba(255,255,255,0.6)', fontSize: 11,
              letterSpacing: '0.25em', textTransform: 'uppercase',
              fontFamily: 'monospace', marginBottom: 24,
            }}
          >
            {sector?.replace(/_/g, ' ')} · {MATURITY_LABELS[maturityLevel] || maturityLevel}
          </motion.div>
        )}

        <h1 style={{
          color: '#fff', fontSize: 'clamp(40px, 7vw, 96px)',
          fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
          marginBottom: 32,
        }}>
          {businessName}
        </h1>

        {brandClaim && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 'clamp(16px, 2vw, 26px)',
              fontStyle: 'italic', lineHeight: 1.5,
              maxWidth: 700, margin: '0 auto 40px',
              borderLeft: '3px solid rgba(255,255,255,0.3)',
              paddingLeft: 20, textAlign: 'left',
            }}
          >
            "{brandClaim}"
          </motion.p>
        )}

        {!brandClaim && consultantIntro && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            style={{
              color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.7,
              maxWidth: 600, margin: '0 auto 40px',
            }}
          >
            {consultantIntro.slice(0, 200)}…
          </motion.p>
        )}
      </motion.div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3,
        padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        {analyzedAt && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace' }}>
            {analyzedAt}
          </span>
        )}
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ color: 'rgba(255,255,255,0.35)', fontSize: 18, marginLeft: 'auto' }}
        >
          ↓
        </motion.div>
      </div>
    </section>
  );
}
