import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getVideosByCategory } from '../videoUtils';
import { useBreakpoint } from '../hooks/useMediaQuery';

interface WebGLFallbackProps {
  category?: string;
  parallaxOffset?: number;
}

const WebGLFallback: React.FC<WebGLFallbackProps> = ({
  category = 'all',
  parallaxOffset = 0,
}) => {
  const { isMobile, isTablet } = useBreakpoint();
  const columns = isMobile ? 2 : isTablet ? 3 : 3;
  const rows = isMobile ? 3 : 4;

  const videos = useMemo(() => {
    const allVideos = getVideosByCategory(category);
    return allVideos.slice(0, columns * rows);
  }, [category, columns, rows]);

  // Split videos into columns for alternating parallax
  const columnData = useMemo(() => {
    const cols: typeof videos[] = Array.from({ length: columns }, () => []);
    videos.forEach((v, i) => cols[i % columns].push(v));
    return cols;
  }, [videos, columns]);

  return (
    <div className="w-full h-full flex items-center justify-center gap-3 md:gap-5 px-4 overflow-hidden">
      {columnData.map((col, colIdx) => {
        const direction = colIdx % 2 === 0 ? 1 : -1;
        const offset = parallaxOffset * direction * 50;

        return (
          <div
            key={colIdx}
            className="flex flex-col gap-3 md:gap-5 transition-transform"
            style={{
              transform: `translateY(${offset}px)`,
              transition: 'transform 20ms linear',
            }}
          >
            {col.map((video, rowIdx) => (
              <FallbackPhone
                key={`${colIdx}-${rowIdx}`}
                videoSrc={video.preview}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

const FallbackPhone: React.FC<{ videoSrc: string }> = ({ videoSrc }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isInView) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isInView]);

  return (
    <div
      ref={containerRef}
      className="relative w-[120px] md:w-[160px] aspect-[9/19.5] rounded-[20px] md:rounded-[28px] overflow-hidden bg-neutral-900 shadow-xl border-2 border-neutral-700"
    >
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-[14px] md:h-[18px] bg-black rounded-b-xl z-10" />

      <video
        ref={videoRef}
        src={videoSrc}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        loop
        playsInline
        preload="metadata"
      />
    </div>
  );
};

export default WebGLFallback;
