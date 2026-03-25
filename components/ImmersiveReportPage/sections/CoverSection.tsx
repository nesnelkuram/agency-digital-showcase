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
}

const MATURITY_LABELS: Record<string, string> = {
  pre_brand: 'Ön-Marka', emerging: 'Gelişen', developing: 'Olgunlaşan', mature: 'Olgun',
};

export default function CoverSection({
  businessName, sector, maturityLevel, brandClaim, consultantIntro, analyzedAt, visual,
}: Props) {
  const isBgImage = !!visual?.imageB64;
  const bgStyle = isBgImage
    ? `url(data:image/png;base64,${visual!.imageB64})`
    : C.bg;

  // Split "Aslan Yapı / DesignFloor" → ["Aslan Yapı", "DesignFloor"]
  const nameParts = businessName.split(/\s*[\/]\s*/);
  const primaryName = nameParts[0] || businessName;
  const subName = nameParts[1] || null;

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
        padding: '22px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.cardBorder}`,
        background: 'rgba(245,242,236,0.82)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: C.text, fontSize: 16, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
            intiba<span style={{ color: C.faint }}>.</span>
          </span>
          <span style={{ color: C.xfaint, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            Marka Stratejisi
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: C.faint, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            Marka Analiz Raporu
          </div>
          {analyzedAt && (
            <div style={{ color: C.xfaint, fontSize: 9, fontFamily: 'monospace', marginTop: 2 }}>{analyzedAt}</div>
          )}
        </div>
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 40px', maxWidth: 860 }}
      >
        {/* intiba hazırladı badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28,
            background: 'rgba(255,255,255,0.55)', border: `1px solid ${C.cardBorder}`,
            borderRadius: 24, padding: '6px 20px',
          }}
        >
          <span style={{ color: C.text, fontSize: 11, fontWeight: 700, letterSpacing: '-0.02em' }}>intiba<span style={{ color: C.faint }}>.</span></span>
          <span style={{ color: C.xfaint, fontSize: 9 }}>|</span>
          <span style={{ color: C.faint, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'monospace' }}>Marka Strateji Raporu</span>
        </motion.div>

        {maturityLevel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            style={{
              display: 'flex', justifyContent: 'center', marginBottom: 20,
            }}
          >
            <span style={{
              background: 'rgba(255,255,255,0.6)', border: `1px solid ${C.cardBorder}`,
              borderRadius: 20, padding: '4px 16px',
              color: C.faint, fontSize: 9,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              fontFamily: 'monospace',
            }}>
              {sector?.replace(/_/g, ' ')} · {MATURITY_LABELS[maturityLevel] || maturityLevel}
            </span>
          </motion.div>
        )}

        {/* Business name — split on "/" */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            color: C.text, fontSize: 'clamp(34px, 6.5vw, 78px)',
            fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
            marginBottom: subName ? 10 : 0,
          }}>
            {primaryName}
          </h1>
          {subName && (
            <div style={{
              color: C.mid, fontSize: 'clamp(16px, 2.2vw, 28px)',
              fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.2,
            }}>
              {subName}
            </div>
          )}
        </div>

        {brandClaim && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.8 }}
            style={{
              color: C.mid,
              fontSize: 'clamp(14px, 1.6vw, 20px)',
              fontStyle: 'italic', lineHeight: 1.6,
              maxWidth: 640, margin: '0 auto',
              borderLeft: `3px solid rgba(0,0,0,0.12)`,
              paddingLeft: 18, textAlign: 'left',
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
              maxWidth: 580, margin: '0 auto',
            }}
          >
            {consultantIntro.slice(0, 180)}…
          </motion.p>
        )}
      </motion.div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3,
        padding: '16px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderTop: `1px solid ${C.cardBorder}`,
        background: 'rgba(245,242,236,0.7)',
        backdropFilter: 'blur(12px)',
      }}>
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
