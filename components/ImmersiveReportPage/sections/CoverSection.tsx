import React from 'react';
import { motion } from 'framer-motion';
import type { SectionVisual } from '../SectionBase';
import { C } from '../SectionBase';

interface Props {
  businessName: string;
  sector: string;
  maturityLevel?: string;
  brandClaim?: string;
  analyzedAt?: string;
  visual: SectionVisual | undefined;
}

export default function CoverSection({
  businessName, sector, maturityLevel, brandClaim, analyzedAt, visual,
}: Props) {
  const isBgImage = !!visual?.imageB64;
  const staticBg = '/cemilay-hero.png';

  const nameParts = businessName.split(/\s*[\/]\s*/);
  const primaryName = nameParts[0] || businessName;
  const subName = nameParts[1] || null;

  const bgUrl = isBgImage
    ? `url(data:image/png;base64,${visual!.imageB64})`
    : `url(${staticBg})`;

  return (
    <section id="cover" style={{
      minHeight: '100vh', scrollSnapAlign: 'start',
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      boxSizing: 'border-box', width: '100%', fontFamily: C.sans,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: bgUrl, backgroundSize: 'cover', backgroundPosition: 'center',
        filter: isBgImage ? 'saturate(0.25) brightness(1.1)' : 'saturate(0.8) brightness(0.88)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(168deg, rgba(250,248,245,0.18) 0%, rgba(244,240,234,0.15) 100%)',
      }} />

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3,
        padding: '24px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.cardBorder}`,
        background: 'rgba(250,248,245,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div>
          <span style={{ color: C.text, fontSize: 20, fontWeight: 800, fontFamily: C.serif, letterSpacing: '-0.03em', lineHeight: 1 }}>
            intiba<span style={{ color: C.faint }}>.</span>
          </span>
          <div style={{ color: C.xfaint, fontSize: 11, fontFamily: C.mono, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 3 }}>
            Marka Stratejisi
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: C.faint, fontSize: 12, fontFamily: C.sans, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Marka Analiz Raporu
          </div>
          {analyzedAt && (
            <div style={{ color: C.xfaint, fontSize: 12, fontFamily: C.mono, marginTop: 4 }}>{analyzedAt}</div>
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 48px', maxWidth: 920 }}
      >
        <div style={{ marginBottom: 36 }}>
          {subName ? (
            <>
              <div style={{
                color: C.faint, fontSize: 'clamp(15px, 1.6vw, 20px)',
                fontWeight: 500, fontFamily: C.sans, letterSpacing: '0.06em', marginBottom: 12, lineHeight: 1,
              }}>
                {primaryName}
              </div>
              <h1 style={{
                color: C.text, fontSize: 'clamp(44px, 8vw, 100px)',
                fontWeight: 800, fontFamily: C.serif, letterSpacing: '-0.04em', lineHeight: 0.95,
                margin: 0,
              }}>
                {subName}
              </h1>
            </>
          ) : (
            <h1 style={{
              color: C.text, fontSize: 'clamp(40px, 7.5vw, 92px)',
              fontWeight: 800, fontFamily: C.serif, letterSpacing: '-0.04em', lineHeight: 0.95, margin: 0,
            }}>
              {primaryName}
            </h1>
          )}
        </div>

        {brandClaim && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.9 }}
            style={{
              color: C.mid, fontSize: 'clamp(16px, 1.8vw, 22px)',
              fontStyle: 'italic', lineHeight: 1.6, fontFamily: C.serif,
              maxWidth: 680, margin: '0 auto',
              borderLeft: `3px solid rgba(0,0,0,0.15)`,
              paddingLeft: 24, textAlign: 'left',
            }}
          >
            "{brandClaim}"
          </motion.p>
        )}

      </motion.div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3,
        padding: '20px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderTop: `1px solid ${C.cardBorder}`,
        background: 'rgba(250,248,245,0.72)',
        backdropFilter: 'blur(16px)',
      }}>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ color: C.xfaint, fontSize: 18 }}
        >
          ↓
        </motion.div>
      </div>
    </section>
  );
}
