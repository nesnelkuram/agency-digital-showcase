import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDES = [
  { id: 'light',  label: 'Açık Kül Lamine Parke',   src: '/cemilay-hero.png' },
  { id: 'medium', label: 'Orta Meşe Lamine Parke',  src: '/cemilay-marble.png' },
  { id: 'honey',  label: 'Bal Meşe Balıksırtı',      src: '/cemilay-walnut.png' },
  { id: 'blonde', label: 'Beyazlatılı Lamine Parke', src: '/cemilay-concrete.png' },
  { id: 'dark',   label: 'Koyu Ceviz Lamine Parke',  src: '/cemilay-dark.png' },
];

const SLIDE_DURATION = 5500; // ms

export default function CemilayHero() {
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = (startFrom: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % SLIDES.length);
    }, SLIDE_DURATION);
  };

  useEffect(() => {
    startTimer(0);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const goTo = (i: number) => {
    setActiveIdx(i);
    startTimer(i);
  };

  const slide = SLIDES[activeIdx];

  return (
    <div style={{
      width: '100%', height: '100vh', position: 'relative',
      overflow: 'hidden', background: '#ece7dd',
    }}>

      {/* Background slideshow */}
      <AnimatePresence mode="sync">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: `url(${slide.src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </AnimatePresence>

      {/* Gradient overlay — bottom-heavy for text readability */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(to top, rgba(10,8,6,0.55) 0%, rgba(10,8,6,0.12) 40%, transparent 70%)',
      }} />

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3,
        padding: '28px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{
            color: 'rgba(255,255,255,0.95)', fontSize: 18, fontWeight: 800,
            letterSpacing: '-0.04em', lineHeight: 1,
          }}>
            Design Floor
          </span>
          <span style={{
            color: 'rgba(255,255,255,0.4)', fontSize: 9,
            letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: 'monospace',
          }}>
            Cemilay
          </span>
        </div>
        <nav style={{ display: 'flex', gap: 32 }}>
          {['Koleksiyon', 'Projeler', 'Hakkımızda', 'İletişim'].map(item => (
            <span key={item} style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 12,
              letterSpacing: '0.06em', cursor: 'pointer',
              transition: 'color 0.2s',
            }}>
              {item}
            </span>
          ))}
        </nav>
      </div>

      {/* Center / hero content */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', padding: '0 48px 80px',
      }}>

        {/* Active floor label chip */}
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id + '_label'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 24, padding: '5px 16px',
              alignSelf: 'flex-start', marginBottom: 18,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', display: 'inline-block' }} />
            <span style={{
              color: 'rgba(255,255,255,0.88)', fontSize: 11,
              letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: 'monospace',
            }}>
              {slide.label}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Brand headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          style={{
            color: '#fff', fontSize: 'clamp(44px, 6.5vw, 96px)',
            fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.95,
            margin: '0 0 12px',
          }}
        >
          Her mekan<br />
          <span style={{ fontWeight: 300, letterSpacing: '-0.02em' }}>bir hikaye.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          style={{
            color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.6,
            maxWidth: 380, margin: '0 0 36px',
          }}
        >
          Premium zemin kaplama çözümleri ile yaşam alanlarınızı dönüştürün.
        </motion.p>

        {/* CTA + dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <button style={{
            background: '#fff', color: '#1a1612',
            border: 'none', borderRadius: 28, padding: '13px 32px',
            fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
            cursor: 'pointer',
          }}>
            Koleksiyonu İncele
          </button>

          {/* Slide dots */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                style={{
                  width: i === activeIdx ? 32 : 8, height: 4, borderRadius: 2,
                  border: 'none', cursor: 'pointer', padding: 0,
                  background: i === activeIdx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.35s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 4,
        height: 2, background: 'rgba(255,255,255,0.12)',
      }}>
        <motion.div
          key={activeIdx + '_prog'}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
          style={{ height: '100%', background: 'rgba(255,255,255,0.55)' }}
        />
      </div>
    </div>
  );
}
