import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloorImage {
  id: string;
  label: string;
  imageB64: string | null;
}

const SLIDE_DURATION = 5000; // ms per slide
const TRANSITION_DURATION = 1.2; // seconds

const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(160deg, #f0ebe3 0%, #e2d8cc 100%)',
  'linear-gradient(160deg, #e8e0d4 0%, #d4c8b8 100%)',
  'linear-gradient(160deg, #ece6de 0%, #d8cfc4 100%)',
  'linear-gradient(160deg, #f5f0e8 0%, #e8dfd4 100%)',
];

export default function CemilayHero() {
  const [images, setImages] = useState<FloorImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/cemilay-visuals', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.images) setImages(data.images);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Auto-advance slideshow
  useEffect(() => {
    const total = images.length || 4;
    timerRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % total);
    }, SLIDE_DURATION);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [images.length]);

  const goTo = (i: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveIdx(i);
    timerRef.current = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % images.length);
    }, SLIDE_DURATION);
  };

  const total = images.length || 4;
  const currentImage = images[activeIdx];

  return (
    <div style={{
      width: '100%', height: '100vh', position: 'relative',
      overflow: 'hidden', background: '#f5f0e8',
    }}>

      {/* Background images slideshow */}
      <AnimatePresence mode="sync">
        <motion.div
          key={activeIdx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: TRANSITION_DURATION, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, zIndex: 0,
            background: currentImage?.imageB64
              ? undefined
              : PLACEHOLDER_GRADIENTS[activeIdx % PLACEHOLDER_GRADIENTS.length],
            backgroundImage: currentImage?.imageB64
              ? `url(data:image/png;base64,${currentImage.imageB64})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center bottom',
          }}
        />
      </AnimatePresence>

      {/* Subtle overlay for text readability */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(to top, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.08) 50%, transparent 100%)',
      }} />

      {/* Loading spinner */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 11,
              letterSpacing: '0.3em', fontFamily: 'monospace', textTransform: 'uppercase',
            }}
          >
            Görseller Hazırlanıyor…
          </motion.div>
        </div>
      )}

      {/* Content layer */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end', padding: '0 60px 72px',
      }}>

        {/* Brand name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        >
          <div style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 11,
            letterSpacing: '0.3em', textTransform: 'uppercase',
            fontFamily: 'monospace', marginBottom: 10,
          }}>
            Zemin & Kaplama
          </div>
          <h1 style={{
            color: '#fff', fontSize: 'clamp(42px, 6vw, 88px)',
            fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
            margin: 0,
          }}>
            Cemilay
          </h1>
        </motion.div>

        {/* Active floor label */}
        <AnimatePresence mode="wait">
          {currentImage?.label && (
            <motion.div
              key={currentImage.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.4 }}
              style={{
                marginTop: 14,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 20, padding: '5px 16px',
                alignSelf: 'flex-start',
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
              <span style={{
                color: 'rgba(255,255,255,0.85)', fontSize: 12,
                letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'monospace',
              }}>
                {currentImage.label}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slide dots */}
        <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === activeIdx ? 28 : 8, height: 4, borderRadius: 2,
                border: 'none', cursor: 'pointer', padding: 0,
                background: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3, height: 2,
        background: 'rgba(255,255,255,0.15)',
      }}>
        <motion.div
          key={activeIdx}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
          style={{ height: '100%', background: 'rgba(255,255,255,0.7)' }}
        />
      </div>
    </div>
  );
}
