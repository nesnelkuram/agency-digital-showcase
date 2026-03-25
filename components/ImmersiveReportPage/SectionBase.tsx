import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export interface SectionVisual {
  imageB64?: string;
  fallbackGradient: string;
}

interface SectionBaseProps {
  id: string;
  index: number;
  total?: number;
  label: string;
  visual: SectionVisual | undefined;
  children: React.ReactNode;
  overlayOpacity?: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

// Light theme palette
export const C = {
  bg:         'linear-gradient(160deg, #f5f2ec 0%, #ece7dd 100%)',
  overlay:    'rgba(243,239,231,0.88)',
  text:       '#1c1916',
  mid:        'rgba(28,25,22,0.62)',
  faint:      'rgba(28,25,22,0.38)',
  xfaint:     'rgba(28,25,22,0.22)',
  card:       'rgba(255,255,255,0.82)',
  cardBorder: 'rgba(0,0,0,0.07)',
  pos:    '#2d6a4f',
  posBg:  'rgba(45,106,79,0.1)',
  neg:    '#9b2335',
  negBg:  'rgba(155,35,53,0.09)',
  warn:   '#a16207',
  warnBg: 'rgba(161,98,7,0.09)',
  blue:   '#1d4ed8',
  blueBg: 'rgba(29,78,216,0.08)',
  tagBg:  'rgba(28,25,22,0.07)',
};

export default function SectionBase({
  id, index, total = 14, label, visual, children, overlayOpacity = 0.88,
}: SectionBaseProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });

  const isBgImage = !!visual?.imageB64;
  const bgImage = isBgImage ? `url(data:image/png;base64,${visual!.imageB64})` : undefined;

  return (
    <section
      id={id}
      ref={ref}
      style={{
        minHeight: '100vh',
        scrollSnapAlign: 'start',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        overflow: 'hidden',
        background: isBgImage ? undefined : C.bg,
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Background image */}
      {isBgImage && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: bgImage,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'saturate(0.35) brightness(1.1)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: C.overlay,
            zIndex: 1,
          }} />
        </>
      )}

      {/* Section label */}
      <div style={{
        position: 'absolute', top: 28, left: 36, zIndex: 3,
        color: C.xfaint, fontSize: 11, letterSpacing: '0.28em',
        fontFamily: 'monospace', textTransform: 'uppercase',
      }}>
        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')} — {label}
      </div>

      {/* Content */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        style={{
          position: 'relative', zIndex: 2, width: '100%',
          padding: 'clamp(72px, 9vh, 100px) clamp(20px, 5vw, 72px) clamp(48px, 6vh, 80px)',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {children}
      </motion.div>

      {/* Scroll hint */}
      {index < total - 1 && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 3, color: C.xfaint, textAlign: 'center',
        }}>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontSize: 16 }}
          >
            ↓
          </motion.div>
        </div>
      )}
    </section>
  );
}

// ─── Safe string coercion (AI data may return objects instead of strings) ─────
export function toStr(val: any): string {
  if (typeof val === 'string') return val;
  if (!val) return '';
  if (val.value) return String(val.value);
  if (val.label) return String(val.label);
  if (val.text) return String(val.text);
  if (val.name) return String(val.name);
  const strs = Object.values(val).filter(v => typeof v === 'string') as string[];
  return strs.length > 0 ? strs.join(' — ') : JSON.stringify(val);
}

// ─── Shared UI helpers ────────────────────────────────────

export function GlassCard({
  children, className = '', style = {},
}: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        background: C.card,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 14,
        padding: '16px 20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: C.faint, fontSize: 10, letterSpacing: '0.32em',
      textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 10,
    }}>
      {children}
    </h2>
  );
}

export function BigText({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      color: C.text, fontSize: 'clamp(22px, 3vw, 48px)',
      fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em',
      ...style,
    }}>
      {children}
    </p>
  );
}

export function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      background: color || 'rgba(0,0,0,0.07)',
      color: C.text, fontSize: 10, padding: '4px 10px', borderRadius: 20,
      letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
      display: 'inline-block', border: '1px solid rgba(0,0,0,0.07)',
    }}>
      {children}
    </span>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: '10px 0' }} />;
}

export function TwoCol({ children, minWidth = 300 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minWidth}px), 1fr))`,
      gap: 18,
    }}>
      {children}
    </div>
  );
}

export function ThreeCol({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
      gap: 14,
    }}>
      {children}
    </div>
  );
}
