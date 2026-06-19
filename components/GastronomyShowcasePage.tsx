import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, ChevronLeft, ChevronRight, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { getVideoMetadata, getVideosByCategory } from '../videoMetadata';
import { getBlobUrl } from '../constants';

interface GastroVideo {
  id: number;
  title: string;
  location?: string;
  description?: string;
  year?: number;
  services?: string;
  preview: string;
  full: string;
}

// All gastronomy videos, resolved from the shared metadata catalogue so this
// page stays in sync with the rest of the site as the catalogue grows.
function useGastronomyVideos(): GastroVideo[] {
  return useMemo(() => {
    return getVideosByCategory('Gastronomy')
      .map((m) => {
        const meta = getVideoMetadata(m.id);
        if (!meta || !meta.title) return null;
        return {
          id: m.id,
          title: meta.title,
          location: meta.location,
          description: meta.description,
          year: meta.year,
          services: meta.services,
          preview: getBlobUrl(`${m.id}.mp4`, 'preview'),
          full: getBlobUrl(`${m.id}.mp4`, 'full'),
        } as GastroVideo;
      })
      .filter((v): v is GastroVideo => v !== null);
  }, []);
}

// A single vertical video tile. Loops a muted preview once it scrolls into
// view; click opens the lightbox with full audio.
const VideoTile: React.FC<{ video: GastroVideo; index: number; onOpen: () => void }> = ({
  video,
  index,
  onOpen,
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.06 }}
      className="group relative block w-full overflow-hidden rounded-2xl bg-neutral-900 text-left focus:outline-none focus:ring-2 focus:ring-white/40"
      style={{ aspectRatio: '9 / 16' }}
    >
      <video
        ref={ref}
        src={inView ? video.preview : undefined}
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
      {/* gradient + meta overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-90" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <h3 className="font-ramillas text-lg leading-tight text-white sm:text-xl">{video.title}</h3>
        {video.location && (
          <p className="mt-1 font-grotesk text-xs uppercase tracking-[0.18em] text-white/60">
            {video.location}
            {video.year ? ` · ${video.year}` : ''}
          </p>
        )}
      </div>
      {/* play affordance */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur-md opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 scale-75">
          <Play className="h-6 w-6 translate-x-0.5 fill-white text-white" />
        </div>
      </div>
    </motion.button>
  );
};

// Fullscreen lightbox player with prev/next navigation.
const Lightbox: React.FC<{
  videos: GastroVideo[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}> = ({ videos, index, onClose, onNavigate }) => {
  const video = videos[index];
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);

  const goNext = useCallback(() => onNavigate((index + 1) % videos.length), [index, videos.length, onNavigate]);
  const goPrev = useCallback(
    () => onNavigate((index - 1 + videos.length) % videos.length),
    [index, videos.length, onNavigate]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, goNext, goPrev]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Kapat"
      >
        <X className="h-5 w-5" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); goPrev(); }}
        className="absolute left-2 z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:flex sm:left-6"
        aria-label="Önceki"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); goNext(); }}
        className="absolute right-2 z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:flex sm:right-6"
        aria-label="Sonraki"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <motion.div
        key={video.id}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex max-h-[92vh] w-full max-w-md flex-col items-center px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '9 / 16' }}>
          <video
            ref={ref}
            src={video.full}
            autoPlay
            controls
            playsInline
            muted={muted}
            className="h-full w-full object-contain"
          />
          <button
            onClick={() => setMuted((m) => !m)}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-4 text-center">
          <h2 className="font-ramillas text-2xl text-white">{video.title}</h2>
          {video.location && (
            <p className="mt-1 font-grotesk text-xs uppercase tracking-[0.2em] text-white/50">
              {video.location}
              {video.year ? ` · ${video.year}` : ''}
            </p>
          )}
          {video.description && (
            <p className="mx-auto mt-3 max-w-sm font-grotesk text-sm leading-relaxed text-white/70">
              {video.description}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const GastronomyShowcasePage: React.FC = () => {
  const videos = useGastronomyVideos();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="mx-auto max-w-6xl px-5 pt-10 sm:px-8 sm:pt-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-grotesk text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Anasayfa
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-8 sm:mt-12"
        >
          <p className="font-grotesk text-xs uppercase tracking-[0.3em] text-white/40">Çalışmalarımız</p>
          <h1 className="mt-3 font-ramillas text-5xl leading-[0.95] sm:text-7xl">Gastronomi</h1>
          <p className="mt-5 max-w-xl font-grotesk text-base leading-relaxed text-white/60 sm:text-lg">
            Mutfağın arkasındaki tutkuyu, dokuyu ve lezzeti perdeye taşıdığımız işler.
            Her kareye dokunmak için bir videoya tıklayın.
          </p>
        </motion.div>
      </header>

      {/* Grid */}
      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        {videos.length === 0 ? (
          <p className="py-24 text-center font-grotesk text-white/40">Henüz gastronomi videosu eklenmedi.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {videos.map((v, i) => (
              <VideoTile key={v.id} video={v} index={i} onOpen={() => setActiveIndex(i)} />
            ))}
          </div>
        )}
      </main>

      {/* CTA */}
      <footer className="mx-auto max-w-6xl px-5 pb-20 text-center sm:px-8">
        <p className="font-ramillas text-2xl text-white/90 sm:text-3xl">Markanızın hikâyesini birlikte anlatalım.</p>
        <Link
          to="/#contact"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 font-grotesk text-sm font-medium text-black transition hover:bg-white/85"
        >
          İletişime geçin
        </Link>
      </footer>

      <AnimatePresence>
        {activeIndex !== null && (
          <Lightbox
            videos={videos}
            index={activeIndex}
            onClose={() => setActiveIndex(null)}
            onNavigate={setActiveIndex}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GastronomyShowcasePage;
