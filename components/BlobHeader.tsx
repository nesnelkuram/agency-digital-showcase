import React, { useMemo, useState, useEffect, useRef } from 'react';
import BlobPhoneMockup from './BlobPhoneMockup';
import { loadBlobUrls, PREVIEW_VIDEOS_BLOB } from '../constants-blob';
import { VideoInfo } from '../types';

const BlobHeader: React.FC = () => {
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [blobVideos, setBlobVideos] = useState<VideoInfo[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const headerRef = useRef<HTMLElement>(null);
  
  // Configuration for parallax
  const PARALLAX_DURATION_VIEWPORTS = 5;

  // Optimized phone count for better performance
  const colsPerRow = [3, 3, 3, 3, 3, 3]; // 6 rows, 18 phones total
  const totalPhones = colsPerRow.reduce((sum, count) => sum + count, 0);
  
  const baseRotateXDeg = 35;
  const baseRotateYDeg = -20;
  const baseScale = 1.3;
  const baseTranslateXPercent = 38;
  const initialPhoneGridYPercent = -20;

  // Load blob URLs dynamically
  useEffect(() => {
    const loadVideos = async () => {
      try {
        const blobUrls = await loadBlobUrls();
        const videoList: VideoInfo[] = [];
        
        // If we have blob URLs, use them
        if (Object.keys(blobUrls).length > 0) {
          Object.entries(blobUrls).forEach(([fileName, url]) => {
            videoList.push({
              src: url as string,
              alt: `Creative showcase ${fileName}`
            });
          });
        } else {
          // Fallback to preview videos if no blob URLs
          setBlobVideos(PREVIEW_VIDEOS_BLOB);
          setIsLoadingVideos(false);
          return;
        }
        
        setBlobVideos(videoList);
      } catch (error) {
        console.warn('Failed to load blob URLs, using preview videos', error);
        setBlobVideos(PREVIEW_VIDEOS_BLOB);
      } finally {
        setIsLoadingVideos(false);
      }
    };

    loadVideos();
  }, []);

  // Show content after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsContentVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let rafId: number;
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      if (!headerRef.current) return;

      const scrollY = window.scrollY;
      
      // Only update if scroll changed significantly (throttling)
      if (Math.abs(scrollY - lastScrollY) < 2) return;
      lastScrollY = scrollY;

      const headerElement = headerRef.current;
      const headerTopOffset = headerElement.offsetTop;
      const headerClientHeight = headerElement.offsetHeight; 
      const viewportHeight = window.innerHeight;

      const scrollRelativeToStickyActive = Math.max(0, scrollY - headerTopOffset);
      const parallaxActiveScrollRange = headerClientHeight - viewportHeight;

      if (parallaxActiveScrollRange <= 0) {
        setParallaxOffset(0);
        return;
      }
      
      let effectiveParallaxScroll = Math.max(0, Math.min(scrollRelativeToStickyActive, parallaxActiveScrollRange));
      
      if (scrollY < headerTopOffset) {
        effectiveParallaxScroll = 0;
      }

      const scrollProgress = effectiveParallaxScroll / parallaxActiveScrollRange;
      const MAX_OFFSET_PERCENT = 120;
      const newParallaxOffset = scrollProgress * MAX_OFFSET_PERCENT;
      
      setParallaxOffset(newParallaxOffset);
    };

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScroll);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const phoneConfigs = useMemo(() => {
    const videos = blobVideos.length > 0 ? blobVideos : PREVIEW_VIDEOS_BLOB;
    
    return Array.from({ length: totalPhones }).map((_, index) => {
      const videoIndex = index % videos.length;
      const video = videos[videoIndex];
      
      // Use preview for initial display, blob URL for full video
      const previewSrc = PREVIEW_VIDEOS_BLOB[videoIndex % PREVIEW_VIDEOS_BLOB.length]?.src;
      
      return {
        key: `phone-${index}`,
        videoSrc: video.src,
        previewSrc: previewSrc,
        altText: video.alt,
      };
    });
  }, [totalPhones, blobVideos]);

  let currentPhoneIndex = 0;

  return (
    <header 
      ref={headerRef} 
      className="relative w-full" 
      style={{ height: `${PARALLAX_DURATION_VIEWPORTS * 100}vh` }}
      aria-label="Interactive agency showcase header with parallax scrolling phones"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center">
        {/* Loading indicator */}
        {isLoadingVideos && (
          <div className="absolute top-4 right-4 z-50">
            <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm">
              Loading videos...
            </div>
          </div>
        )}

        {/* Perspective Phone Grid Background Layer */}
        {isContentVisible && !isLoadingVideos && (
          <div 
            className="absolute inset-0 z-10 flex justify-center items-center"
            style={{ 
              perspective: '1800px', 
              perspectiveOrigin: '75% 25%',
              opacity: 0,
              animation: 'fade-in 1.2s ease-out 0.4s forwards'
            }}
            role="group"
            aria-label="Grid of multiple phone mockups displaying videos, with a parallax scroll effect."
          >
            <div 
              className="flex flex-col items-center" 
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateX(${baseRotateXDeg}deg) rotateY(${baseRotateYDeg}deg) scale(${baseScale}) translateY(${initialPhoneGridYPercent}%) translateX(${baseTranslateXPercent}%)`,
                willChange: 'transform',
              }}
            >
              {colsPerRow.map((numColsInRow, rowIndex) => {
                const phonesInThisRow = phoneConfigs.slice(currentPhoneIndex, currentPhoneIndex + numColsInRow);
                currentPhoneIndex += numColsInRow;

                return (
                  <div 
                    key={`row-${rowIndex}`}
                    className="flex justify-center items-center gap-4 sm:gap-6 md:gap-8 mb-4 sm:mb-6 md:mb-8"
                  >
                    {phonesInThisRow.map((config, colIndex) => {
                      const isMovingDown = colIndex % 2 !== 0; 
                      const columnStyle: React.CSSProperties = {
                        transform: `translateY(${isMovingDown ? parallaxOffset : -parallaxOffset}%)`,
                        willChange: 'transform',
                      };
                      
                      // First 6 phones have priority loading
                      const isPriority = rowIndex === 0 || (rowIndex === 1 && colIndex < 3);
                      
                      return (
                        <div key={config.key} style={columnStyle}>
                          <BlobPhoneMockup
                            videoSrc={config.videoSrc}
                            previewSrc={config.previewSrc}
                            altText={config.altText}
                            className="w-48 sm:w-56 md:w-64 lg:w-72 xl:w-80"
                            lazy={!isPriority}
                            priority={isPriority}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Content Layer */}
        <div className="relative z-30 text-left max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl p-6 sm:p-8 md:p-12 lg:p-16 xl:p-20">
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6 leading-tight"
            style={{ opacity: 0, animation: 'fade-in-left 0.8s ease-out 0.2s forwards' }}
          >
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-red-600">
              Digital Prowess,
            </span>
            <span className="block mt-1 sm:mt-2 text-neutral-900">Creative Edge.</span>
          </h1>
          <p 
            className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-600 mb-6 sm:mb-8 md:mb-10"
            style={{ opacity: 0, animation: 'fade-in-left 0.8s ease-out 0.4s forwards' }}
          >
            We fuse innovative strategy with cutting-edge design and technology to forge digital experiences that captivate and convert for forward-thinking brands.
          </p>
          <div 
            className="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-3 sm:gap-4"
            style={{ opacity: 0, animation: 'fade-in-left 0.8s ease-out 0.6s forwards' }}
          >
            <a
              href="#start" 
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-base md:text-lg"
            >
              Launch Your Vision
            </a>
            <a
              href="#work"
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-3.5 bg-transparent border-2 border-purple-500 hover:bg-purple-600 hover:text-white text-purple-600 font-semibold rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 text-base md:text-lg"
            >
              See Our Portfolio
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};

export default BlobHeader;