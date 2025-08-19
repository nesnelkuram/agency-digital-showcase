import React, { useState, useEffect, lazy, Suspense } from 'react';
import SimpleLoadingScreen from './components/SimpleLoadingScreen';
import QuoteLightbox from './components/QuoteLightbox';
import { PHONE_IMAGES } from './constants';
import { videoCache } from './utils/videoCache';
import { useBreakpoint } from './hooks/useMediaQuery';

// Lazy load heavy components
const Header3D = lazy(() => import('./components/Header3D'));
const Services = lazy(() => import('./components/Services'));
const Portfolio = lazy(() => import('./components/Portfolio'));
const About = lazy(() => import('./components/About'));
const Contact = lazy(() => import('./components/Contact'));
const Footer = lazy(() => import('./components/Footer'));

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isQuoteLightboxOpen, setIsQuoteLightboxOpen] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();
  
  useEffect(() => {
    // Critical assets for initial view
    const criticalAssets = [
      '/images/intibalogo.svg',
      '/images/cursor.svg'
    ];
    
    // Calculate required phone count based on screen size (same logic as Header3D)
    const rows = isMobile ? 3 : isTablet ? 5 : 7;
    const totalPhones = rows * 3; // 3 columns per row
    
    // Get all unique videos for required phone count
    const requiredVideos = Array.from(new Set(
      PHONE_IMAGES.slice(0, totalPhones).map(phone => phone.src)
    ));
    
    console.log(`[App] Loading ${totalPhones} phones (${rows} rows) = ${requiredVideos.length} unique videos`);
    
    let loadedImages = 0;
    let lastVideoProgress = 0;
    
    const updateProgress = () => {
      // Get current video cache progress
      const videoProgress = videoCache.getProgress(requiredVideos);
      
      // Calculate total progress: 20% images + 80% videos
      const imageProgress = (loadedImages / criticalAssets.length) * 20;
      const videoProgressPercent = (videoProgress.loaded / videoProgress.total) * 80;
      const totalProgress = Math.min(100, imageProgress + videoProgressPercent);
      
      setLoadingProgress(totalProgress);
      
      // Log only when video progress changes significantly
      if (Math.abs(videoProgress.percentage - lastVideoProgress) >= 5) {
        console.log(`[App] Video progress: ${videoProgress.loaded}/${videoProgress.total} (${videoProgress.percentage}%)`);
        lastVideoProgress = videoProgress.percentage;
      }
    };
    
    // Preload critical images
    criticalAssets.forEach(src => {
      const img = new Image();
      img.onload = () => {
        loadedImages++;
        updateProgress();
      };
      img.onerror = () => {
        loadedImages++;
        updateProgress();
      };
      img.src = src;
    });
    
    // Preload all required videos in batches
    videoCache.preloadBatch(requiredVideos, 4).then(() => {
      console.log('[App] All videos preloaded');
      updateProgress();
    });
    
    // Progress polling for real-time updates
    const progressInterval = setInterval(updateProgress, 100);
    
    // Extended timeout for all videos to load
    const timeout = setTimeout(() => {
      console.log('[App] Loading timeout reached, proceeding...');
      setLoadingProgress(100);
    }, 10000); // 10 seconds timeout
    
    return () => {
      clearInterval(progressInterval);
      clearTimeout(timeout);
    };
  }, [isMobile, isTablet]);
  
  const handleLoadComplete = () => {
    setIsLoading(false);
  };
  
  if (isLoading) {
    return <SimpleLoadingScreen onLoadComplete={handleLoadComplete} progress={loadingProgress} />;
  }
  
  return (
    <div className="min-h-screen">
      <Suspense fallback={<div className="h-screen bg-[#ebeef8]" />}>
        <Header3D onOpenQuote={() => setIsQuoteLightboxOpen(true)} />
      </Suspense>
      
      <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <Services onOpenQuote={() => setIsQuoteLightboxOpen(true)} />
        <Portfolio />
        <About />
        <Contact />
        <Footer />
      </Suspense>

      <QuoteLightbox 
        isOpen={isQuoteLightboxOpen} 
        onClose={() => setIsQuoteLightboxOpen(false)} 
      />
    </div>
  );
};

export default App;