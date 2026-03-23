import React from 'react';
import { motion } from 'framer-motion';
import type { SectionVisual } from '../SectionBase';
import { C } from '../SectionBase';

interface Props {
  businessName: string;
  sector: string;
  maturityLevel?: string;
  brandClaim?: string;
  consultantIntro?: string;
  analyzedAt?: string;
  visual: SectionVisual | undefined;
  confidence?: number;
}

const MATURITY_LABELS: Record<string, string> = {
  pre_brand: 'Ön-Marka', emerging: 'Gelişen', developing: 'Olgunlaşan', mature: 'Olgun',
};

export default function CoverSection({
  businessName, sector, maturityLevel, brandClaim, consultantIntro, analyzedAt, visual, confidence,
}: Props) {
  const isBgImage = !!visual?.imageB64;
  const bgStyle = isBgImage
    ? `url(data:image/png;base64,${visual!.imageB64})`
    : (visual?.fallbackGradient || C.bg);

  return (
    <section id="cover" style={{
      minHeight: '100vh', scrollSnapAlign: 'start',
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      background: isBgImage ? undefined : bgStyle,
      boxSizing: 'border-box', width: '100%',
    }}>
      {isBgImage && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: bgStyle, backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'saturate(0.3) brightness(1.15)',
          }} />
          <div style={{ position: 'absolute', inset: 0, background: C.overlay, zIndex: 1 }} />
        </>
      )}

      {/* Header bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3,
        padding: '24px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.cardBorder}`,
        background: 'rgba(245,242,236,0.7)',
        backdropFilter: 'blur(12px)',
      }}>
        <span style={{ color: C.text, fontSize: 15, fontWeight: 800, letterSpacing: '-0.03em' }}>
          intiba<span style={{ color: C.faint }}>.</span>
        </span>
        <span style={{ color: C.faint, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          Marka Analiz Raporu
        </span>
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 40px', maxWidth: 900 }}
      >
        {maturityLevel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            style={{
              display: 'inline-block',
              background: 'rgba(255,255,255,0.7)', border: `1px solid ${C.cardBorder}`,
              borderRadius: 20, padding: '5px 18px',
              color: C.mid, fontSize: 10,
              letterSpacing: '0.25em', textTransform: 'uppercase',
              fontFamily: 'monospace', marginBottom: 22,
            }}
          >
            {sector?.replace(/_/g, ' ')} · {MATURITY_LABELS[maturityLevel] || maturityLevel}
          </motion.div>
        )}

        <h1 style={{
          color: C.text, fontSize: 'clamp(38px, 7vw, 88px)',
          fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
          marginBottom: 28,
        }}>
          {businessName}
        </h1>

        {brandClaim && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.8 }}
            style={{
              color: C.mid,
              fontSize: 'clamp(15px, 1.8vw, 22px)',
              fontStyle: 'italic', lineHeight: 1.55,
              maxWidth: 680, margin: '0 auto 36px',
              borderLeft: `3px solid rgba(0,0,0,0.15)`,
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
            transition={{ delay: 0.65 }}
            style={{
              color: C.mid, fontSize: 14, lineHeight: 1.7,
              maxWidth: 600, margin: '0 auto 36px',
            }}
          >
            {consultantIntro.slice(0, 200)}…
          </motion.p>
        )}
      </motion.div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3,
        padding: '18px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: `1px solid ${C.cardBorder}`,
        background: 'rgba(245,242,236,0.7)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {analyzedAt && (
            <span style={{ color: C.faint, fontSize: 10, fontFamily: 'monospace' }}>
              {analyzedAt}
            </span>
          )}
          {confidence !== undefined && confidence > 0 && (
            <span style={{
              color: C.pos, fontSize: 10, fontFamily: 'monospace',
              background: C.posBg, border: `1px solid ${C.pos}30`,
              borderRadius: 10, padding: '2px 10px',
            }}>
              %{confidence} Doğrulanmış
            </span>
          )}
        </div>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ color: C.xfaint, fontSize: 16 }}
        >
          ↓
        </motion.div>
      </div>
    </section>
  );
}
