import React, { useState, useEffect, lazy, Suspense } from 'react';
import SimpleLoadingScreen from './components/SimpleLoadingScreen';
import SimpleQuoteLightbox from './components/SimpleQuoteLightbox';
import UrgencyBar from './components/UrgencyBar';
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
  const [is3DReady, setIs3DReady] = useState(false);
  const [videosReady, setVideosReady] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();
  
  useEffect(() => {
    // Critical assets for initial view
    const criticalAssets = [
      '/images/intibalogo.svg',
      '/images/cursor.svg'
    ];
    
    // VERY CONSERVATIVE: Only load absolutely necessary videos
    const visiblePhones = isMobile ? 1 : isTablet ? 2 : 3; // Even more conservative for smooth loading
    
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
    
    // Set minimum loading time to ensure videos are truly ready
    setTimeout(() => {
      minimumTimeElapsed = true;
    }, 300); // Quick minimum time
    
    const updateProgress = () => {
      // Use STRICT mode to ensure videos are really ready
      const videoProgress = videoCache.getProgress(requiredVideos, true); // strict = true
      
      // Calculate total progress: 10% images + 90% videos
      const imageProgress = (loadedImages / criticalAssets.length) * 10;
      const videoProgressPercent = (videoProgress.loaded / videoProgress.total) * 90;
      let totalProgress = Math.round(imageProgress + videoProgressPercent);
      
      // Don't jump to 100% unless minimum time has elapsed AND videos are ready
      if ((!minimumTimeElapsed || videoProgress.loaded < videoProgress.total) && totalProgress >= 100) {
        totalProgress = 95; // Stay at 95% until really ready
      }
      
      setLoadingProgress(totalProgress);
      
      // More detailed logging
      if (Math.abs(videoProgress.percentage - lastVideoProgress) >= 5) {
        console.log(`[App] Video progress: ${videoProgress.loaded}/${videoProgress.total} (${videoProgress.percentage}%)`)
        if (videoProgress.details) {
          console.log('[App] Video details:', videoProgress.details);
        }
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
      console.log('[App] Initial videos loaded, checking readiness...');
      
      // Double-check videos are REALLY ready with strict mode
      const checkReadiness = setInterval(() => {
        const strictProgress = videoCache.getProgress(initialVideos, true);
        console.log(`[App] Strict readiness check: ${strictProgress.loaded}/${strictProgress.total}`);
        
        if (strictProgress.loaded === strictProgress.total && minimumTimeElapsed) {
          clearInterval(checkReadiness);
          console.log('[App] ✅ All videos FULLY ready!');
          updateProgress();

          // Videos are ready - no delay
          setLoadingProgress(100);
          setVideosReady(true);
        }
      }, 200); // Check every 200ms
      
      // Safety timeout
      setTimeout(() => {
        clearInterval(checkReadiness);
      }, 5000);
      
      // Load category videos in background AFTER site is shown
      if (categoryVideos.length > 0) {
        setTimeout(() => {
          videoCache.preloadBatch(categoryVideos).then(() => {
            console.log('[App] Category preview videos preloaded');
          });
        }, 3000); // Load after user starts interacting
      }

      // Preload FULL videos in background for instant playback when clicked
      setTimeout(() => {
        const fullVideoUrls = initialVideos.map(url =>
          url.replace('/preview/', '/full/')
        );
        console.log(`[App] Starting full video preload in background (${fullVideoUrls.length} videos)`);
        videoCache.preloadBatch(fullVideoUrls).then(() => {
          console.log('[App] ✅ Full videos preloaded - clicks will be instant!');
        });
      }, 5000); // Wait 5 seconds after site loads
    });
    
    // Progress polling for smooth updates
    const progressInterval = setInterval(updateProgress, 50);
    
    // Maximum loading time - increased for better video loading
    const timeout = setTimeout(() => {
      console.log('[App] Maximum loading time reached, checking strict video status...');
      const strictReady = videoCache.getProgress(initialVideos, true);
      const basicReady = videoCache.getProgress(initialVideos, false);
      console.log(`[App] Videos ready (strict): ${strictReady.loaded}/${strictReady.total} (${strictReady.percentage}%)`);
      console.log(`[App] Videos ready (basic): ${basicReady.loaded}/${basicReady.total} (${basicReady.percentage}%)`);
      
      // Only proceed if at least basic loading is complete
      if (basicReady.percentage >= 100) {
        console.log('[App] ⚠️ Proceeding with basic readiness');
        setLoadingProgress(100);
        setVideosReady(true);
      } else {
        // Give it more time if not even basically ready
        console.log('[App] ⏳ Extending loading time...');
        setTimeout(() => {
          setLoadingProgress(100);
          setVideosReady(true);
        }, 2000);
      }
    }, 4000); // Increased to 4 seconds for better guarantee
    
    return () => {
      clearInterval(progressInterval);
      clearTimeout(timeout);
    };
  }, [isMobile, isTablet]);
  
  // When videos are ready, allow loading to complete
  useEffect(() => {
    if (videosReady) {
      console.log('[App] ✅ Videos ready - loading can complete');
    }
  }, [videosReady]);

  const handleLoadComplete = () => {
    // Loading animation finished
    console.log('[App] Loading animation complete');
    setIsLoading(false);
  };

  // Handle 3D ready callback
  const handle3DReady = () => {
    console.log('[App] 🎮 3D content ready');
    setIs3DReady(true);
  };

  // Revealed state - triggers content animations after loading
  const [isRevealed, setIsRevealed] = useState(false);

  // When loading finishes, trigger reveal after shrink animation completes
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setIsRevealed(true);
      }, 300); // Wait for loading screen to finish shrinking
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  return (
    <>
      {/* Main page always renders - loading screen is on top */}
      <Suspense fallback={<div className="h-screen bg-[#ebeef8]" />}>
        <Header3D
          onOpenQuote={() => setIsQuoteLightboxOpen(true)}
          onReady={handle3DReady}
          revealed={isRevealed}
        />
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

      <SimpleQuoteLightbox
        isOpen={isQuoteLightboxOpen}
        onClose={() => setIsQuoteLightboxOpen(false)}
      />

      <UrgencyBar onOpenQuote={() => setIsQuoteLightboxOpen(true)} />

      {/* Loading screen overlays the page and shrinks into yellow circle */}
      <SimpleLoadingScreen
        onLoadComplete={handleLoadComplete}
        progress={loadingProgress}
        isActive={isLoading}
      />
    </>
  );
};

export default App;