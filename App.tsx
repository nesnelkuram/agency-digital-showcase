import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import SimpleLoadingScreen from './components/SimpleLoadingScreen';
import SimpleQuoteLightbox from './components/SimpleQuoteLightbox';
import UrgencyBar from './components/UrgencyBar';
import { videoCache } from './utils/videoCache';
import { useBreakpoint } from './hooks/useMediaQuery';
import { getVideosByCategory } from './videoUtils';
import { AuthProvider } from '@/contexts/AuthContext';
import { TenantProvider } from '@/contexts/TenantContext';

// Lazy load heavy components
const Header3D = lazy(() => import('./components/Header3D'));
const Services = lazy(() => import('./components/Services'));
// Portfolio section removed
const About = lazy(() => import('./components/About'));
const Contact = lazy(() => import('./components/Contact'));
const Footer = lazy(() => import('./components/Footer'));
const BrandStrategyWizard = lazy(() => import('./components/BrandStrategyWizard'));
const LandingPage = lazy(() => import('./components/LandingPage'));

// Admin Panel (lazy loaded)
const AdminApp = lazy(() => import('./admin/AdminApp'));
const LoginPage = lazy(() => import('./admin/auth/LoginPage'));
const JoinPage = lazy(() => import('./admin/auth/JoinPage'));
const PortalApp = lazy(() => import('./portal/PortalApp'));
const FeedbackSharePage = lazy(() => import('./components/FeedbackSharePage'));
const AnalysisReportPage = lazy(() => import('./components/AnalysisReportPage'));
const ContentPlanSharePage = lazy(() => import('./components/ContentPlanSharePage'));
const ProposalSharePage = lazy(() => import('./components/ProposalSharePage'));

const HomePage: React.FC = () => {
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
    
    // Category videos loaded lazily after reveal — not blocking initial load
    
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
      // Basic readiness is sufficient — strict mode adds latency
      const videoProgress = videoCache.getProgress(requiredVideos, false);
      
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
    
    // Load initial videos — proceed as soon as batch resolves
    videoCache.preloadBatch(initialVideos).then(() => {
      console.log('[App] Initial videos loaded');
      if (minimumTimeElapsed) {
        setLoadingProgress(100);
        setVideosReady(true);
      } else {
        // Wait for minimum time to pass
        const wait = setInterval(() => {
          if (minimumTimeElapsed) {
            clearInterval(wait);
            setLoadingProgress(100);
            setVideosReady(true);
          }
        }, 50);
        setTimeout(() => clearInterval(wait), 2000);
      }

      // Load category videos in background AFTER site is shown
      if (categoryVideos.length > 0) {
        setTimeout(() => {
          videoCache.preloadBatch(categoryVideos).then(() => {
            console.log('[App] Category preview videos preloaded');
          });
        }, 3000);
      }

      // Preload FULL videos in background for instant playback when clicked
      setTimeout(() => {
        const fullVideoUrls = initialVideos.map(url =>
          url.replace('/preview/', '/full/')
        );
        videoCache.preloadBatch(fullVideoUrls).catch(() => {});
      }, 5000);
    });
    
    // Progress polling for smooth updates
    const progressInterval = setInterval(updateProgress, 50);
    
    // Maximum loading time — force proceed after 2.5s
    const timeout = setTimeout(() => {
      console.log('[App] Maximum loading time reached, proceeding');
      setLoadingProgress(100);
      setVideosReady(true);
    }, 2500);
    
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

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route
          path="/brand-strategy"
          element={
            <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: '#ebeef8' }} />}>
              <BrandStrategyWizard />
            </Suspense>
          }
        />

        {/* Feedback Share Page - Public video sharing */}
        <Route
          path="/feedback/:shareToken"
          element={
            <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }} />}>
              <FeedbackSharePage />
            </Suspense>
          }
        />

        {/* AI Analysis Report - Public share page */}
        <Route
          path="/rapor/:shareToken"
          element={
            <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
              <AnalysisReportPage />
            </Suspense>
          }
        />

        {/* Content Plan Share - Public client approval page */}
        <Route
          path="/icerik-plani/:shareToken"
          element={
            <Suspense fallback={<div className="min-h-screen bg-[#fafafa]" />}>
              <ContentPlanSharePage />
            </Suspense>
          }
        />

        {/* Proposal Share - Public interactive proposal page */}
        <Route
          path="/teklif/:shareToken"
          element={
            <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
              <ProposalSharePage />
            </Suspense>
          }
        />

        {/* SEO Landing Pages - Dynamic route for all landing page variations */}
        <Route
          path="/:slug"
          element={
            <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: '#ebeef8' }} />}>
              <LandingPage />
            </Suspense>
          }
        />

        {/* Invitation Accept Page - Public */}
        <Route
          path="/join"
          element={
            <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
              <JoinPage />
            </Suspense>
          }
        />

        {/* Client Portal */}
        <Route
          path="/portal/*"
          element={
            <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
              <TenantProvider>
                <PortalApp />
              </TenantProvider>
            </Suspense>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/login"
          element={
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#ebeef8' }}>
                <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <LoginPage />
            </Suspense>
          }
        />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#ebeef8' }}>
                <div className="w-8 h-8 border-2 border-[#171717] border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <TenantProvider>
                <AdminApp />
              </TenantProvider>
            </Suspense>
          }
        />
      </Routes>
    </AuthProvider>
  );
};

export default App;