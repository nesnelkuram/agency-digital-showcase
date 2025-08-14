import React, { useState, useEffect, lazy, Suspense } from 'react';
import SimpleLoadingScreen from './components/SimpleLoadingScreen';
import { PHONE_MEDIA_CONTENT, PHONE_IMAGES } from './constants';
import { videoCache } from './utils/videoCache';

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
  
  useEffect(() => {
    // Only preload critical assets for initial view
    const criticalAssets = [
      '/images/intibalogo.svg',
      '/images/cursor.svg'
    ];
    
    // Get only first 6 videos for initial load
    const priorityVideos = Array.from(new Set(
      PHONE_IMAGES.slice(0, 6).map(phone => phone.src)
    ));
    
    const totalAssets = criticalAssets.length + priorityVideos.length;
    let loadedAssets = 0;
    
    const updateProgress = () => {
      loadedAssets++;
      const progress = (loadedAssets / totalAssets) * 100;
      setLoadingProgress(progress);
      
      if (loadedAssets === totalAssets) {
        setLoadingProgress(100);
      }
    };
    
    // Preload critical images
    criticalAssets.forEach(src => {
      const img = new Image();
      img.onload = updateProgress;
      img.onerror = updateProgress;
      img.src = src;
    });
    
    // Preload priority videos
    priorityVideos.forEach(url => {
      videoCache.preloadVideo(url).then(updateProgress).catch(updateProgress);
    });
    
    // Faster timeout - 3 seconds
    const timeout = setTimeout(() => {
      if (loadingProgress < 100) {
        setLoadingProgress(100);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, []);
  
  const handleLoadComplete = () => {
    setIsLoading(false);
  };
  
  if (isLoading) {
    return <SimpleLoadingScreen onLoadComplete={handleLoadComplete} progress={loadingProgress} />;
  }
  
  return (
    <div className="min-h-screen">
      <Suspense fallback={<div className="h-screen bg-[#ebeef8]" />}>
        <Header3D />
      </Suspense>
      
      <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <Services />
        <Portfolio />
        <About />
        <Contact />
        <Footer />
      </Suspense>
    </div>
  );
};

export default App;