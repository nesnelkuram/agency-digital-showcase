import React, { useState, useRef, useEffect, useCallback } from 'react';

interface OptimizedPhoneMockupProps {
  videoSrc: string;
  previewSrc?: string;
  className?: string;
  altText: string;
  lazy?: boolean;
}

const OptimizedPhoneMockup: React.FC<OptimizedPhoneMockupProps> = ({ 
  videoSrc, 
  previewSrc,
  className, 
  altText,
  lazy = true 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(!lazy);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0.01
      }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [lazy]);

  // Preload video when in view
  useEffect(() => {
    if (!isInView || !videoRef.current) return;

    const video = videoRef.current;
    
    const handleCanPlay = () => {
      setIsLoading(false);
      setVideoLoaded(true);
    };

    video.addEventListener('canplay', handleCanPlay);
    
    // Start loading the video
    video.load();

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [isInView, videoSrc]);

  const handlePlayPause = useCallback(() => {
    if (!videoRef.current || !videoLoaded) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, videoLoaded]);

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        transformStyle: 'preserve-3d',
        transform: 'rotateY(-5deg) rotateX(2deg)',
      }}
      role="figure"
      aria-label={`Phone mockup playing ${altText}`}
    >
      {/* Phone body */}
      <div 
        className="relative bg-gradient-to-b from-neutral-900 to-neutral-800 rounded-[3rem] overflow-hidden aspect-[9/16] shadow-2xl"
        style={{
          boxShadow: `
            0 25px 50px rgba(0, 0, 0, 0.4),
            0 0 0 2px rgba(180, 180, 180, 0.3),
            inset 0 0 0 2px rgba(255, 255, 255, 0.1)
          `,
          background: 'linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 50%, #1a1a1a 100%)',
        }}
      >
        {/* Side buttons */}
        <div className="absolute -left-[2px] top-24 w-[3px] h-10 bg-neutral-600 rounded-r-lg" style={{ boxShadow: 'inset -1px 0 2px rgba(0,0,0,0.5)' }}></div>
        <div className="absolute -left-[2px] top-36 w-[3px] h-14 bg-neutral-600 rounded-r-lg" style={{ boxShadow: 'inset -1px 0 2px rgba(0,0,0,0.5)' }}></div>
        <div className="absolute -right-[2px] top-32 w-[3px] h-20 bg-neutral-600 rounded-l-lg" style={{ boxShadow: 'inset 1px 0 2px rgba(0,0,0,0.5)' }}></div>
        
        {/* Dynamic Island */}
        <div 
          className="absolute top-[14px] left-1/2 transform -translate-x-1/2 w-[30%] max-w-[80px] h-[32px] bg-black rounded-[16px] z-30"
          style={{
            boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.9), 0 1px 2px rgba(255,255,255,0.05)',
          }}
        ></div>
        
        {/* Screen bezel */}
        <div 
          className="absolute inset-[6px] bg-black rounded-[2.6rem] overflow-hidden"
          style={{
            boxShadow: 'inset 0 0 15px rgba(0,0,0,0.9)',
          }}
        >
          <div className="absolute inset-[3px] rounded-[2.4rem] overflow-hidden bg-black">
            {/* Glass reflection overlay */}
            <div 
              className="absolute inset-0 z-20 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%)',
              }}
            ></div>
            
            {/* Loading placeholder */}
            {isLoading && (
              <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {/* Video content */}
            {isInView && (
              <video
                ref={videoRef}
                key={videoSrc}
                className={`w-full h-full object-contain transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
                src={previewSrc || videoSrc}
                loop
                muted
                playsInline
                preload="metadata"
                aria-label={altText}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              >
                Your browser does not support the video tag.
              </video>
            )}
            
            {/* Play button overlay */}
            {!isPlaying && videoLoaded && (
              <div 
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                style={{ zIndex: 25 }}
                onClick={handlePlayPause}
              >
                <div 
                  className="w-20 h-20 bg-white/80 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-white/90"
                  style={{
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 40px rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <svg 
                    width="28" 
                    height="28" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    className="ml-1"
                  >
                    <path 
                      d="M8 5v14l11-7z" 
                      fill="rgba(0, 0, 0, 0.8)"
                    />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedPhoneMockup;