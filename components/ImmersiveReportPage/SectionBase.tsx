import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export interface SectionVisual {
  imageB64?: string;
  fallbackGradient: string;
}

interface SectionBaseProps {
  id: string;
  index: number;
  label: string;
  visual: SectionVisual | undefined;
  children: React.ReactNode;
  overlayOpacity?: number; // 0-1, default 0.6
}

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export default function SectionBase({
  id, index, label, visual, children, overlayOpacity = 0.65,
}: SectionBaseProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });

  const bg = visual?.imageB64
    ? `url(data:image/png;base64,${visual.imageB64})`
    : visual?.fallbackGradient || 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)';

  const isBgImage = !!visual?.imageB64;

  return (
    <section
      id={id}
      ref={ref}
      style={{
        height: '100vh',
        scrollSnapAlign: 'start',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: isBgImage ? undefined : bg,
      }}
    >
      {/* Background image */}
      {isBgImage && (
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: bg,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.85)',
          }}
        />
      )}

      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `rgba(0,0,0,${overlayOpacity})`,
          zIndex: 1,
        }}
      />

      {/* Section number */}
      <div style={{
        position: 'absolute', top: 32, left: 40, zIndex: 3,
        color: 'rgba(255,255,255,0.25)', fontSize: 11, letterSpacing: '0.25em',
        fontFamily: 'monospace', textTransform: 'uppercase',
      }}>
        {String(index + 1).padStart(2, '0')} / 08 — {label}
      </div>

      {/* Content */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        style={{
          position: 'relative', zIndex: 2, width: '100%',
          padding: 'clamp(48px, 6vh, 72px) clamp(24px, 5vw, 64px)',
          maxHeight: 'calc(100vh - clamp(80px, 10vh, 140px))',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </motion.div>

      {/* Scroll indicator (not on last section) */}
      {index < 7 && (
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 3, color: 'rgba(255,255,255,0.35)', textAlign: 'center',
        }}>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontSize: 18 }}
          >
            ↓
          </motion.div>
        </div>
      )}
    </section>
  );
}

// Glassmorphism card helper
export function GlassCard({
  children, className = '', style = {},
}: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14,
        padding: '18px 22px',
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
      color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: '0.3em',
      textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 12,
    }}>
      {children}
    </h2>
  );
}

export function BigText({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      color: '#fff', fontSize: 'clamp(24px, 3.5vw, 52px)',
      fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em',
      ...style,
    }}>
      {children}
    </p>
  );
}

export function Tag({ children, color = 'rgba(255,255,255,0.15)' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      background: color,
      color: '#fff', fontSize: 11, padding: '4px 10px', borderRadius: 20,
      letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
      display: 'inline-block',
    }}>
      {children}
    </span>
  );
}
