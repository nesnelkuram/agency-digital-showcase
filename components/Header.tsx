import React, { useMemo, useState, useEffect, useRef } from 'react';
import PhoneMockup from './PhoneMockup';
import { PHONE_IMAGES } from '../constants';
import { usePriorityVideoPreloader } from '../hooks/usePriorityVideoPreloader';

const Header: React.FC = () => {
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const headerRef = useRef<HTMLElement>(null);
  const [showContent, setShowContent] = useState(false);
  
  // Split videos into priority (first 3 rows = 12 phones) and remaining
  const { priorityVideos, remainingVideos } = useMemo(() => {
    // First 12 phones are priority (3 rows x 4 columns)
    const priorityPhones = PHONE_IMAGES.slice(0, 12);
    const remainingPhones = PHONE_IMAGES.slice(12);
    
    // Get unique URLs for each group
    const priorityUrls = new Set<string>();
    const remainingUrls = new Set<string>();
    
    priorityPhones.forEach(phone => priorityUrls.add(phone.src));
    remainingPhones.forEach(phone => remainingUrls.add(phone.src));
    
    return {
      priorityVideos: Array.from(priorityUrls),
      remainingVideos: Array.from(remainingUrls)
    };
  }, []);
  
  const preloadProgress = usePriorityVideoPreloader(priorityVideos, remainingVideos);
  
  // Show content when ALL priority videos are loaded
  useEffect(() => {
    if (preloadProgress.isPriorityComplete) {
      setShowContent(true);
    }
  }, [preloadProgress.isPriorityComplete]);
  
  // Configuration for parallax
  const PARALLAX_DURATION_VIEWPORTS = 5; // Extended duration for longer scrolling effect

  // Phone grid properties - Keep horizontal count same, add more rows
  const colsPerRow = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]; // 12 rows, 48 phones total
  const totalPhones = colsPerRow.reduce((sum, count) => sum + count, 0);
  
  const baseRotateXDeg = 35;
  const baseRotateYDeg = -20;
  const baseScale = 1;
  const baseTranslateXPercent = 38;
  // Adjusted Y position to better center the now-taller grid
  const initialPhoneGridYPercent = -20; 

  useEffect(() => {
    const handleScroll = () => {
      if (!headerRef.current) return;

      const scrollY = window.scrollY;
      const headerElement = headerRef.current;
      const headerTopOffset = headerElement.offsetTop;
      const headerClientHeight = headerElement.offsetHeight; 
      const viewportHeight = window.innerHeight;

      // Calculate scroll progress relative to when the sticky container is active
      const scrollRelativeToStickyActive = Math.max(0, scrollY - headerTopOffset);
      
      // The total range of scroll pixels over which the parallax effect should occur.
      const parallaxActiveScrollRange = headerClientHeight - viewportHeight;

      if (parallaxActiveScrollRange <= 0) { // Avoid division by zero or negative range
        setParallaxOffset(0);
        return;
      }
      
      // Effective scroll for parallax, clamped
      let effectiveParallaxScroll = Math.max(0, Math.min(scrollRelativeToStickyActive, parallaxActiveScrollRange));
      
      // If we are scrolled above the header, parallax should be at its start
      if (scrollY < headerTopOffset) {
        effectiveParallaxScroll = 0;
      }

      // Calculate scroll progress as a value from 0 to 1
      const scrollProgress = effectiveParallaxScroll / parallaxActiveScrollRange;
      
      // Increased max offset for a faster, more pronounced parallax effect.
      const MAX_OFFSET_PERCENT = 120; // Much faster vertical movement
      const newParallaxOffset = scrollProgress * MAX_OFFSET_PERCENT;
      
      setParallaxOffset(newParallaxOffset);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Call once to set initial state based on current scroll (e.g. if page reloads scrolled)
    handleScroll(); 

    return () => window.removeEventListener('scroll', handleScroll);
  }, []); // Dependencies are constant, so this effect runs once on mount.

  const phoneConfigs = useMemo(() => {
    // Use PHONE_IMAGES which already has the correct video assignments
    return PHONE_IMAGES.map((phone, index) => {
      return {
        key: `phone-${index}`,
        videoSrc: phone.src,
        altText: phone.alt,
      };
    });
  }, []);

  let currentPhoneIndex = 0;

  return (
    <header 
      ref={headerRef} 
      className="relative w-full" 
      style={{ height: `${PARALLAX_DURATION_VIEWPORTS * 100}vh` }}
      aria-label="Interactive agency showcase header with parallax scrolling phones"
    >
      {/* Loading overlay */}
      {!showContent && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white/70 text-sm">
              Loading videos... {preloadProgress.priorityPercentage}%
            </p>
            <div className="w-48 h-1 bg-white/20 rounded-full mt-2 mx-auto overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${preloadProgress.priorityPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}
      
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center">
        {/* Perspective Phone Grid Background Layer */}
        <div 
          className="absolute inset-0 z-10 flex justify-center items-center"
          style={{ 
            perspective: '1800px', 
            perspectiveOrigin: '75% 25%',
            opacity: showContent ? 0 : 0,
            animation: showContent ? 'fade-in 1.2s ease-out 0.8s forwards' : 'none'
          }}
          role="group"
          aria-label="Grid of multiple phone mockups displaying videos, with a parallax scroll effect."
        >
          <div 
            className="flex flex-col items-center" 
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${baseRotateXDeg}deg) rotateY(${baseRotateYDeg}deg) scale(${baseScale}) translateY(${initialPhoneGridYPercent}%) translateX(${baseTranslateXPercent}%)`, 
            }}
          >
            {colsPerRow.map((numColsInRow, rowIndex) => {
              const phonesInThisRow = phoneConfigs.slice(currentPhoneIndex, currentPhoneIndex + numColsInRow);
              currentPhoneIndex += numColsInRow;

              return (
                <div 
                  key={`row-${rowIndex}`}
                  className="flex justify-center items-center gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3 md:mb-4"
                >
                  {phonesInThisRow.map((config, colIndex) => {
                    // colIndex 0 & 2 move up, 1 & 3 move down
                    const isMovingDown = colIndex % 2 !== 0; 
                    const columnStyle: React.CSSProperties = {
                      // Apply opposing transforms for the up/down parallax effect
                      transform: `translateY(${isMovingDown ? parallaxOffset : -parallaxOffset}%)`,
                      // Smooth continuous scrolling
                      transition: 'transform 10ms linear',
                    };
                    return (
                      <div key={config.key} style={columnStyle}>
                        <PhoneMockup
                          videoSrc={config.videoSrc}
                          altText={config.altText}
                          className="w-36 sm:w-44 md:w-48 lg:w-52 xl:w-56" 
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        
        
        {/* Content Layer */}
        <div className="relative z-30 text-left max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl p-6 sm:p-8 md:p-12 lg:p-16 xl:p-20">
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6 leading-tight"
            style={{ 
              opacity: 0, 
              animation: showContent ? 'fade-in-left 0.8s ease-out 0.2s forwards' : 'none' 
            }}
          >
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-red-600">
              Digital Prowess,
            </span>
            <span className="block mt-1 sm:mt-2 text-neutral-900">Creative Edge.</span>
          </h1>
          <p 
            className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-600 mb-6 sm:mb-8 md:mb-10"
            style={{ 
              opacity: 0, 
              animation: showContent ? 'fade-in-left 0.8s ease-out 0.4s forwards' : 'none' 
            }}
          >
            We fuse innovative strategy with cutting-edge design and technology to forge digital experiences that captivate and convert for forward-thinking brands.
          </p>
          <div 
            className="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-3 sm:gap-4"
            style={{ 
              opacity: 0, 
              animation: showContent ? 'fade-in-left 0.8s ease-out 0.6s forwards' : 'none' 
            }}
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

export default Header;
