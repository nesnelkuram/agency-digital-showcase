import React, { useState, useEffect, lazy, Suspense } from 'react';
import SimpleLoadingScreen from './components/SimpleLoadingScreen';
import QuoteLightbox from './components/QuoteLightbox';
import { videoCache } from './utils/videoCache';
import { useBreakpoint } from './hooks/useMediaQuery';
import { getVideosByCategory } from './videoUtils';

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
    
    // Optimize preload: Only load initially visible phones
    const visiblePhones = isMobile ? 3 : isTablet ? 4 : 5; // Reduced from 6 to 5 for desktop
    
    // Get videos from 'all' category (matching Header3D initial state)
    const allVideos = getVideosByCategory('all');
    
    // Get unique preview URLs for only visible phones
    const uniqueVideoUrls = new Set<string>();
    
    // Only preload videos for initially visible phones
    allVideos.slice(0, visiblePhones).forEach(video => {
      if (video.preview) {
        uniqueVideoUrls.add(video.preview);
      }
    });
    
    // Reduce category preloading to just 1 video per category (was 3)
    const categories = ['fashion', 'commercial'];
    categories.forEach(category => {
      const categoryVideos = getVideosByCategory(category);
      // Preload only first video from each category
      if (categoryVideos.length > 0 && categoryVideos[0].preview) {
        uniqueVideoUrls.add(categoryVideos[0].preview);
      }
    });
    
    const requiredVideos = Array.from(uniqueVideoUrls);
    
    console.log(`[App] Preloading ${visiblePhones} visible phones = ${requiredVideos.length} unique videos`);
    
    let loadedImages = 0;
    let lastVideoProgress = 0;
    let minimumTimeElapsed = false;
    
    // Set minimum loading time (2.5 seconds to ensure videos are ready)
    setTimeout(() => {
      minimumTimeElapsed = true;
    }, 2500);
    
    const updateProgress = () => {
      // Get current video cache progress
      const videoProgress = videoCache.getProgress(requiredVideos);
      
      // Calculate total progress: 10% images + 90% videos
      const imageProgress = (loadedImages / criticalAssets.length) * 10;
      const videoProgressPercent = (videoProgress.loaded / videoProgress.total) * 90;
      let totalProgress = Math.round(imageProgress + videoProgressPercent);
      
      // Don't jump to 100% unless minimum time has elapsed
      if (!minimumTimeElapsed && totalProgress >= 100) {
        totalProgress = 99;
      }
      
      setLoadingProgress(totalProgress);
      
      // Log only when video progress changes significantly
      if (Math.abs(videoProgress.percentage - lastVideoProgress) >= 10) {
        console.log(`[App] Video progress: ${videoProgress.loaded}/${videoProgress.total} (${videoProgress.percentage}%)`)
        lastVideoProgress = videoProgress.percentage;
      }
    };
    
    // Preload critical images first
    criticalAssets.forEach(src => {
      const img = new Image();
      img.onload = () => {
        loadedImages++;
        updateProgress();
      };
      img.onerror = () => {
        console.error(`[App] Failed to load image: ${src}`);
        loadedImages++;
        updateProgress();
      };
      img.src = src;
    });
    
    // Load ALL initial videos before showing site
    const allUniqueVideos = Array.from(uniqueVideoUrls);
    const initialVideos = allUniqueVideos.slice(0, visiblePhones); // Only visible phones
    const categoryVideos = allUniqueVideos.slice(visiblePhones);
    
    console.log(`[App] Loading ${initialVideos.length} initial videos before showing site`);
    
    // Load ALL initial videos - site won't show until these are ready
    videoCache.preloadBatch(initialVideos).then(() => {
      console.log('[App] All initial videos preloaded and ready!');
      updateProgress();
      
      // Only show site when ALL initial videos are ready
      setTimeout(() => {
        setLoadingProgress(100);
      }, 200); // Small delay to ensure smooth transition
      
      // Load category videos in background AFTER site is shown
      if (categoryVideos.length > 0) {
        setTimeout(() => {
          videoCache.preloadBatch(categoryVideos).then(() => {
            console.log('[App] Category preview videos preloaded');
          });
        }, 3000); // Load after user starts interacting
      }
    });
    
    // Progress polling for smooth updates
    const progressInterval = setInterval(updateProgress, 50);
    
    // Maximum loading time (12 seconds - give videos time to load)
    const timeout = setTimeout(() => {
      console.log('[App] Maximum loading time reached, checking video status...');
      const ready = videoCache.getProgress(initialVideos);
      console.log(`[App] Videos ready: ${ready.loaded}/${ready.total} (${ready.percentage}%)`);
      if (ready.percentage >= 80) {
        // If most videos are ready, proceed
        setLoadingProgress(100);
      } else {
        // Give a bit more time
        setTimeout(() => {
          setLoadingProgress(100);
        }, 3000);
      }
    }, 12000);
    
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
    <>
      <Suspense fallback={<div className="h-screen bg-[#ebeef8]" />}>
        <Header3D onOpenQuote={() => setIsQuoteLightboxOpen(true)} />
      </Suspense>
      
      <main className="min-h-screen">
        <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
          <Services onOpenQuote={() => setIsQuoteLightboxOpen(true)} />
          <Portfolio />
          <About />
          <Contact />
          <Footer />
        </Suspense>
      </main>

      <QuoteLightbox 
        isOpen={isQuoteLightboxOpen} 
        onClose={() => setIsQuoteLightboxOpen(false)} 
      />
    </>
  );
};

export default App;