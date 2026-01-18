import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import SimpleLoadingScreen from './SimpleLoadingScreen';
import SimpleQuoteLightbox from './SimpleQuoteLightbox';
import UrgencyBar from './UrgencyBar';
import SEOHead from './SEOHead';
import { videoCache } from '../utils/videoCache';
import { useBreakpoint } from '../hooks/useMediaQuery';
import { getVideosByCategory } from '../videoUtils';
import { getLandingPageBySlug, LandingPageConfig } from '../config/landingPages';

// Lazy load heavy components
const Header3D = lazy(() => import('./Header3D'));
const Services = lazy(() => import('./Services'));
const About = lazy(() => import('./About'));
const Contact = lazy(() => import('./Contact'));
const Footer = lazy(() => import('./Footer'));

interface LandingPageProps {
  config?: LandingPageConfig;  // Can be passed directly or fetched from URL slug
}

const LandingPage: React.FC<LandingPageProps> = ({ config: propConfig }) => {
  const { slug } = useParams<{ slug: string }>();
  const config = propConfig || (slug ? getLandingPageBySlug(slug) : undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isQuoteLightboxOpen, setIsQuoteLightboxOpen] = useState(false);
  const [is3DReady, setIs3DReady] = useState(false);
  const [videosReady, setVideosReady] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();

  // If no config found, show error
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ebeef8]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 mb-4">Page Not Found</h1>
          <p className="text-neutral-600">The landing page you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Video preloading logic (simplified from HomePage)
  useEffect(() => {
    const criticalAssets = ['/images/intibalogo.svg', '/images/cursor.svg'];
    const visiblePhones = isMobile ? 1 : isTablet ? 2 : 3;

    // Get videos based on the landing page's default category
    const categoryVideos = getVideosByCategory(config.defaultCategory);
    const uniqueVideoUrls = new Set<string>();

    categoryVideos.slice(0, visiblePhones).forEach(video => {
      if (video.preview) {
        uniqueVideoUrls.add(video.preview);
      }
    });

    const requiredVideos = Array.from(uniqueVideoUrls);
    let loadedImages = 0;
    let minimumTimeElapsed = false;

    setTimeout(() => {
      minimumTimeElapsed = true;
    }, 300);

    const updateProgress = () => {
      const videoProgress = videoCache.getProgress(requiredVideos, true);
      const imageProgress = (loadedImages / criticalAssets.length) * 10;
      const videoProgressPercent = (videoProgress.loaded / videoProgress.total) * 90;
      let totalProgress = Math.round(imageProgress + videoProgressPercent);

      if ((!minimumTimeElapsed || videoProgress.loaded < videoProgress.total) && totalProgress >= 100) {
        totalProgress = 95;
      }

      setLoadingProgress(totalProgress);
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

    // Load videos
    videoCache.preloadBatch(requiredVideos).then(() => {
      const checkReadiness = setInterval(() => {
        const strictProgress = videoCache.getProgress(requiredVideos, true);

        if (strictProgress.loaded === strictProgress.total && minimumTimeElapsed) {
          clearInterval(checkReadiness);
          updateProgress();
          setLoadingProgress(100);
          setVideosReady(true);
        }
      }, 200);

      setTimeout(() => {
        clearInterval(checkReadiness);
      }, 5000);
    });

    const progressInterval = setInterval(updateProgress, 50);
    const timeout = setTimeout(() => {
      setLoadingProgress(100);
      setVideosReady(true);
    }, 4000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timeout);
    };
  }, [isMobile, isTablet, config.defaultCategory]);

  const handleLoadComplete = () => {
    setIsLoading(false);
  };

  const handle3DReady = () => {
    setIs3DReady(true);
  };

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setIsRevealed(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Convert config hero to Header3D format
  const heroContent = {
    headline: config.hero.headline,
    highlightedText: config.hero.highlightedText,
    subheadline: config.hero.subheadline,
    subtext: config.hero.subtext,
    ctaText: config.hero.ctaText,
  };

  return (
    <>
      {/* SEO Meta Tags */}
      <SEOHead
        title={config.meta.title}
        description={config.meta.description}
        keywords={config.meta.keywords}
        ogImage={config.meta.ogImage}
        ogUrl={`https://intiba.com/${config.slug}`}
        lang={config.lang}
      />

      {/* Main Content */}
      <Suspense fallback={<div className="h-screen bg-[#ebeef8]" />}>
        <Header3D
          onOpenQuote={() => setIsQuoteLightboxOpen(true)}
          onReady={handle3DReady}
          revealed={isRevealed}
          heroContent={heroContent}
          defaultCategory={config.defaultCategory}
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

      <SimpleLoadingScreen
        onLoadComplete={handleLoadComplete}
        progress={loadingProgress}
        isActive={isLoading}
      />
    </>
  );
};

export default LandingPage;
