import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import SimpleLoadingScreen from './components/SimpleLoadingScreen';
import SimpleQuoteLightbox from './components/SimpleQuoteLightbox';
import UrgencyBar from './components/UrgencyBar';
import { videoCache } from './utils/videoCache';
import { useBreakpoint } from './hooks/useMediaQuery';
import { useDeviceCapability } from './hooks/useDeviceCapability';
import { selectInitialVideos } from './utils/selectInitialVideos';
import { getActiveHomepageVideosAsMedia } from './shared/services/homepageVideoService';
import { MediaContent } from './types';
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
const AgentOfficeSimulator = lazy(() => import('./components/AgentOfficeSimulator'));
const FeedbackSharePage = lazy(() => import('./components/FeedbackSharePage'));
const AnalysisReportPage = lazy(() => import('./components/AnalysisReportPage'));
const ImmersiveReportPage = lazy(() => import('./components/ImmersiveReportPage'));
const CemilayHero = lazy(() => import('./components/CemilayHero'));
const ContentPlanSharePage = lazy(() => import('./components/ContentPlanSharePage'));
const ProposalSharePage = lazy(() => import('./components/ProposalSharePage'));

const HomePage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isQuoteLightboxOpen, setIsQuoteLightboxOpen] = useState(false);
  const [is3DReady, setIs3DReady] = useState(false);
  const [videosReady, setVideosReady] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();
  const capability = useDeviceCapability();

  // Admin-managed videos (from the public homepage_videos collection). Loaded
  // once on mount; resolves fast (and to [] on any error), so it merges into
  // the grid during the loading screen without a post-reveal flash. Static
  // catalogue keeps working regardless.
  const [dynamicVideos, setDynamicVideos] = useState<MediaContent[]>([]);
  useEffect(() => {
    let alive = true;
    getActiveHomepageVideosAsMedia().then(vids => {
      if (alive && vids.length > 0) setDynamicVideos(vids);
    });
    return () => { alive = false; };
  }, []);

  // Single source of truth for the videos shown on the phone grid.
  // Same list is consumed by the preloader below AND by <Header3D> via the
  // initialVideos prop, so what we wait to preload is exactly what renders.
  const initialVideos = useMemo(() => {
    const totalPhones = isMobile ? 11 : isTablet ? 7 : 10;
    return selectInitialVideos(totalPhones, dynamicVideos);
  }, [isMobile, isTablet, dynamicVideos]);

  useEffect(() => {
    const criticalAssets = ['/images/intibalogo.svg', '/images/cursor.svg'];

    // Only the N videos that orchestrator will activate on first paint must be
    // ready before reveal. The rest preload in the background after reveal so
    // scroll/orchestrator activations feel instant.
    const preloadCount = Math.max(1, Math.min(capability.maxConcurrentVideos || 1, initialVideos.length));
    const criticalVideos = initialVideos
      .slice(0, preloadCount)
      .map(v => v.preview)
      .filter((u): u is string => !!u);
    const backgroundVideos = initialVideos
      .slice(preloadCount)
      .map(v => v.preview)
      .filter((u): u is string => !!u);

    console.log(`[App] Tier=${capability.tier}, preloading ${criticalVideos.length} critical / ${backgroundVideos.length} background videos`);

    let loadedImages = 0;
    let lastVideoProgress = 0;

    const updateProgress = () => {
      const videoProgress = videoCache.getProgress(criticalVideos, false);
      const imageProgress = (loadedImages / criticalAssets.length) * 10;
      const videoProgressPercent = criticalVideos.length > 0
        ? (videoProgress.loaded / videoProgress.total) * 90
        : 90;
      // Cap at 99 — only the preloadBatch resolution flips us to 100.
      const totalProgress = Math.min(99, Math.round(imageProgress + videoProgressPercent));
      setLoadingProgress(totalProgress);

      if (Math.abs(videoProgress.percentage - lastVideoProgress) >= 10) {
        console.log(`[App] Video progress: ${videoProgress.loaded}/${videoProgress.total} (${videoProgress.percentage}%)`);
        lastVideoProgress = videoProgress.percentage;
      }
    };

    criticalAssets.forEach(src => {
      const img = new Image();
      img.onload = () => { loadedImages++; updateProgress(); };
      img.onerror = () => { loadedImages++; updateProgress(); };
      img.src = src;
    });

    const preloadPromise = criticalVideos.length > 0
      ? videoCache.preloadBatch(criticalVideos)
      : Promise.resolve(new Map());

    preloadPromise.then(() => {
      console.log('[App] ✅ Critical videos loaded — revealing page');
      setLoadingProgress(100);
      setVideosReady(true);

      // Background-preload remaining grid videos so scroll/orchestrator
      // activations land into a warm browser cache instead of a fresh fetch.
      if (backgroundVideos.length > 0) {
        setTimeout(() => {
          videoCache.preloadBatch(backgroundVideos).then(() => {
            console.log('[App] Background videos preloaded');
          });
        }, 1500);
      }
    });

    const progressInterval = setInterval(updateProgress, 100);

    // Fail-safe — if Vercel Blob 503s never recover and retries exhaust,
    // reveal the page anyway after 20s so the user isn't stuck forever.
    const failSafe = setTimeout(() => {
      console.warn('[App] ⚠️ Fail-safe (20s) — videos not ready, revealing anyway');
      setLoadingProgress(100);
      setVideosReady(true);
    }, 20_000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(failSafe);
    };
  }, [initialVideos, capability.tier, capability.maxConcurrentVideos]);
  
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
          initialVideos={initialVideos}
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

        {/* Agent Office Simulator — Pipeline Visualizer */}
        <Route
          path="/pipeline-visualizer"
          element={
            <Suspense fallback={<div className="min-h-screen bg-[#05050f]" />}>
              <AgentOfficeSimulator />
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

        {/* Immersive full-screen report */}
        <Route
          path="/rapor-immersive/:shareToken"
          element={
            <Suspense fallback={<div className="min-h-screen" style={{ background: '#f5f2ec' }} />}>
              <ImmersiveReportPage />
            </Suspense>
          }
        />

        {/* Cemilay Hero Slideshow */}
        <Route
          path="/cemilay"
          element={
            <Suspense fallback={<div style={{ height: '100vh', background: '#f5f0e8' }} />}>
              <CemilayHero />
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