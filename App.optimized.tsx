import React, { useState, useEffect, Suspense, lazy } from 'react';
import OptimizedHeader from './components/OptimizedHeader';
import SimpleLoadingScreen from './components/SimpleLoadingScreen';
import { useVideoPreloader } from './hooks/useVideoPreloader';
import { HEADER_VIDEOS } from './constants';

// Lazy load heavy components
const Services = lazy(() => import('./components/Services'));
const Portfolio = lazy(() => import('./components/Portfolio'));
const About = lazy(() => import('./components/About'));
const Contact = lazy(() => import('./components/Contact'));
const Footer = lazy(() => import('./components/Footer'));

const OptimizedApp: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  
  // Preload only preview videos for header
  const previewVideos = HEADER_VIDEOS.slice(0, 6).map(v => v.src.replace('/full/', '/preview/'));
  const { loadingProgress } = useVideoPreloader(previewVideos, { priority: 'high' });
  
  useEffect(() => {
    // Faster loading experience
    const minLoadTime = setTimeout(() => {
      if (loadingProgress > 50) {
        setIsLoading(false);
      }
    }, 1500);
    
    // Maximum wait time
    const maxLoadTime = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    
    if (loadingProgress === 100) {
      setIsLoading(false);
    }
    
    return () => {
      clearTimeout(minLoadTime);
      clearTimeout(maxLoadTime);
    };
  }, [loadingProgress]);
  
  const handleLoadComplete = () => {
    setShowContent(true);
  };
  
  if (isLoading) {
    return <SimpleLoadingScreen onLoadComplete={handleLoadComplete} progress={loadingProgress} />;
  }
  
  return (
    <div className="min-h-screen">
      <OptimizedHeader />
      
      {/* Lazy load other sections */}
      <Suspense fallback={
        <div className="h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <Services />
        <Portfolio />
        <About />
        <Contact />
        <Footer />
      </Suspense>
    </div>
  );
};

export default OptimizedApp;