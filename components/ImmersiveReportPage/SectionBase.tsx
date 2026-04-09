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
  hidden: { opacity: 0, y: 36 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Google Fonts ───────────────────────────────────────────────
let _fontsInjected = false;
function injectFonts() {
  if (_fontsInjected || typeof document === 'undefined') return;
  _fontsInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Space+Mono:wght@400;700&display=swap';
  document.head.appendChild(link);
}
injectFonts();

// ─── Design Tokens ──────────────────────────────────────────────
export const C = {
  bg:       'linear-gradient(168deg, #faf8f5 0%, #f4f0ea 100%)',
  bgFlat:   '#faf8f5',
  overlay:  'rgba(250,248,245,0.92)',

  text:     '#1a1614',
  mid:      '#4a433c',
  faint:    '#7d7268',
  xfaint:   '#a89e93',

  card:       'rgba(255,255,255,0.96)',
  cardBorder: 'rgba(0,0,0,0.06)',
  cardShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.04)',

  pos:    '#1a7a42',
  posBg:  'rgba(26,122,66,0.08)',
  neg:    '#c43d3d',
  negBg:  'rgba(196,61,61,0.06)',
  warn:   '#b8860b',
  warnBg: 'rgba(184,134,11,0.07)',
  blue:   '#2563eb',
  blueBg: 'rgba(37,99,235,0.06)',
  tagBg:  'rgba(26,22,20,0.05)',
  accent: '#c8553d',

  serif: "'Fraunces', Georgia, 'Times New Roman', serif",
  sans:  "'Plus Jakarta Sans', 'Helvetica Neue', sans-serif",
  mono:  "'Space Mono', 'Courier New', monospace",
};

// ─── Shadows by tier ────────────────────────────────────────────
const SHADOW = {
  feature:  '0 2px 4px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)',
  standard: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.04)',
  compact:  'none',
};

// ─── SectionBase ────────────────────────────────────────────────
export default function SectionBase({
  id, index, total = 7, label, visual, children,
}: SectionBaseProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });

  const isBgImage = !!visual?.imageB64;
  const bgImage = isBgImage ? `url(data:image/png;base64,${visual!.imageB64})` : undefined;

  return (
    <section
      id={id} ref={ref}
      style={{
        minHeight: '100vh', scrollSnapAlign: 'start',
        position: 'relative', display: 'flex', alignItems: 'flex-start',
        overflow: 'hidden', background: isBgImage ? undefined : C.bg,
        boxSizing: 'border-box', width: '100%', fontFamily: C.sans,
      }}
    >
      {isBgImage && (
        <>
          <div style={{
            position: 'absolute', inset: 0, backgroundImage: bgImage,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'saturate(0.3) brightness(1.15)',
          }} />
          <div style={{ position: 'absolute', inset: 0, background: C.overlay, zIndex: 1 }} />
        </>
      )}

      <div style={{
        position: 'absolute', top: 36, left: 48, zIndex: 3,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ color: C.xfaint, fontSize: 13, fontWeight: 600, fontFamily: C.mono, letterSpacing: '0.12em' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{ width: 28, height: 1, background: C.xfaint, display: 'block' }} />
        <span style={{ color: C.faint, fontSize: 12, fontWeight: 600, fontFamily: C.sans, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>

      <motion.div
        variants={fadeUp} initial="hidden" animate={inView ? 'visible' : 'hidden'}
        style={{
          position: 'relative', zIndex: 2, width: '100%',
          padding: 'clamp(88px, 10vh, 120px) clamp(28px, 6vw, 80px) clamp(56px, 7vh, 88px)',
          boxSizing: 'border-box', overflowX: 'hidden', wordBreak: 'break-word',
        }}
      >
        {children}
      </motion.div>

      {index < total - 1 && (
        <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ color: C.xfaint, fontSize: 18, opacity: 0.7 }}
          >↓</motion.div>
        </div>
      )}
    </section>
  );
}

// ─── Safe coercion ──────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
// CARD HIERARCHY — 3 tiers
// ═══════════════════════════════════════════════════════════════

/** Tier 1 — Feature Card: Primary content with accent border, elevated shadow */
export function FeatureCard({
  children, accent, tint, style = {},
}: { children: React.ReactNode; accent?: string; tint?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: tint || C.card,
      borderRadius: 18,
      padding: '28px 32px',
      boxShadow: SHADOW.feature,
      boxSizing: 'border-box',
      borderLeft: accent ? `4px solid ${accent}` : undefined,
      ...style,
    }}>
      {children}
    </div>
  );
}

/** Tier 2 — GlassCard: Standard content card */
export function GlassCard({
  children, className = '', style = {},
}: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={{
      background: C.card,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 16,
      padding: '22px 26px',
      boxShadow: SHADOW.standard,
      boxSizing: 'border-box',
      ...style,
    }}>
      {children}
    </div>
  );
}

/** Tier 3 — CompactCard: Inline items, stat chips, sub-items */
export function CompactCard({
  children, style = {},
}: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.tagBg,
      borderRadius: 12,
      padding: '12px 16px',
      boxSizing: 'border-box',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DATA VIZ COMPONENTS
// ═══════════════════════════════════════════════════════════════

/** Big number stat display */
export function StatBlock({ label, value, unit, color, size = 'large' }: {
  label: string; value: string | number; unit?: string; color?: string; size?: 'large' | 'medium';
}) {
  const lg = size === 'large';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        color: C.faint, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        fontFamily: C.sans, marginBottom: lg ? 10 : 6,
      }}>
        {label}
      </div>
      <div style={{
        color: color || C.text, fontSize: lg ? 56 : 36, fontWeight: 800,
        fontFamily: C.serif, lineHeight: 1, letterSpacing: '-0.03em',
      }}>
        {value}
        {unit && <span style={{ fontSize: lg ? 18 : 14, color: C.faint, fontFamily: C.mono, marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

/** Progress bar with label */
export function MetricBar({ label, value, max = 100, color, height = 10 }: {
  label?: string; value: number; max?: number; color?: string; height?: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const barColor = color || (pct >= 70 ? C.pos : pct >= 40 ? C.warn : C.neg);
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: C.mid, fontSize: 13 }}>{label}</span>
          <span style={{ color: C.text, fontSize: 13, fontWeight: 700, fontFamily: C.mono }}>{value}/{max}</span>
        </div>
      )}
      <div style={{ height, background: 'rgba(0,0,0,0.06)', borderRadius: height / 2 }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: barColor,
          borderRadius: height / 2, transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TYPOGRAPHY COMPONENTS
// ═══════════════════════════════════════════════════════════════

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      color: C.faint, fontSize: 12, fontWeight: 700,
      letterSpacing: '0.28em', textTransform: 'uppercase',
      fontFamily: C.sans, marginBottom: 16, marginTop: 0,
    }}>
      {children}
    </h3>
  );
}

export function BigText({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      color: C.text, fontSize: 'clamp(24px, 3.2vw, 52px)',
      fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.03em',
      fontFamily: C.serif, margin: 0,
      ...style,
    }}>
      {children}
    </p>
  );
}

/** Pull-quote with accent border */
export function QuoteBlock({ children, accent, style = {} }: {
  children: React.ReactNode; accent?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={{ borderLeft: `4px solid ${accent || 'rgba(0,0,0,0.15)'}`, paddingLeft: 24, ...style }}>
      {children}
    </div>
  );
}

export function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      background: color || C.tagBg, color: C.text, fontSize: 11,
      padding: '5px 12px', borderRadius: 20, letterSpacing: '0.06em',
      textTransform: 'uppercase', fontWeight: 600, fontFamily: C.sans,
      display: 'inline-block', border: '1px solid rgba(0,0,0,0.06)',
    }}>
      {children}
    </span>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '16px 0' }} />;
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT HELPERS
// ═══════════════════════════════════════════════════════════════

/** Responsive two-column grid */
export function TwoCol({ children, minWidth = 340, gap = 28 }: {
  children: React.ReactNode; minWidth?: number; gap?: number;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minWidth}px), 1fr))`,
      gap, alignItems: 'start',
    }}>
      {children}
    </div>
  );
}

export function ThreeCol({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
      gap: 18, alignItems: 'start',
    }}>
      {children}
    </div>
  );
}

/** Column of cards with consistent gap */
export function CardStack({ children, gap = 16 }: { children: React.ReactNode; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {children}
    </div>
  );
}

/** Horizontal row of equal-width cards */
export function CardRow({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
  return (
    <div style={{ display: 'flex', gap, alignItems: 'stretch' }}>
      {children}
    </div>
  );
}

/** Tab/pill buttons */
export function PillTabs({ tabs, active, onChange }: {
  tabs: { key: string; label: string }[];
  active: number;
  onChange: (i: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
      {tabs.map((tab, i) => (
        <button key={tab.key} onClick={() => onChange(i)} style={{
          padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
          border: `1px solid ${active === i ? 'rgba(0,0,0,0.18)' : C.cardBorder}`,
          background: active === i ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.5)',
          color: active === i ? C.text : C.faint,
          fontSize: 13, fontWeight: active === i ? 700 : 400,
          transition: 'all 0.15s ease', fontFamily: C.sans,
        }}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
