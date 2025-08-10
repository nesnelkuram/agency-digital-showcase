import React, { useState, useEffect } from 'react';
import Header3D from './components/Header3D';
import Services from './components/Services';
import Portfolio from './components/Portfolio';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';
import SimpleLoadingScreen from './components/SimpleLoadingScreen';
import * as THREE from 'three';
import { PHONE_MEDIA_CONTENT } from './constants';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  useEffect(() => {
    // Preload critical assets
    const assetsToLoad = {
      videos: [
        // Get preview URLs from first 12 phones
        ...PHONE_MEDIA_CONTENT.slice(0, 12).map(media => media.preview)
      ],
      images: [
        '/images/intibalogo.svg',
        '/images/photo1.jpg'
      ],
      models: [
        '/models/iphone_14_pro_max/scene.gltf'
      ]
    };
    
    const totalAssets = assetsToLoad.videos.length + assetsToLoad.images.length + assetsToLoad.models.length;
    let loadedAssets = 0;
    
    const updateProgress = () => {
      loadedAssets++;
      const progress = (loadedAssets / totalAssets) * 100;
      setLoadingProgress(progress);
      console.log(`Loading progress: ${progress.toFixed(0)}% (${loadedAssets}/${totalAssets})`);
      
      if (loadedAssets === totalAssets) {
        console.log('All critical assets loaded!');
        setLoadingProgress(100);
      }
    };
    
    // Preload videos
    assetsToLoad.videos.forEach(src => {
      const video = document.createElement('video');
      video.src = src;
      video.preload = 'auto'; // Changed to auto for better loading
      video.muted = true; // Ensure muted for autoplay policy
      
      const handleLoad = () => {
        console.log(`[App] Video ready: ${src}`);
        updateProgress();
        video.removeEventListener('canplaythrough', handleLoad);
      };
      
      // Use canplaythrough for better loading detection
      video.addEventListener('canplaythrough', handleLoad);
      video.addEventListener('error', (e) => {
        console.error(`[App] Failed to load video: ${src}`, video.error);
        updateProgress(); // Count as loaded even if failed
      });
      
      video.load();
    });
    
    // Preload images
    assetsToLoad.images.forEach(src => {
      const img = new Image();
      img.onload = updateProgress;
      img.onerror = () => {
        console.warn(`Failed to load image: ${src}`);
        updateProgress();
      };
      img.src = src;
    });
    
    // Preload GLTF models
    assetsToLoad.models.forEach(src => {
      fetch(src)
        .then(response => {
          if (response.ok) {
            updateProgress();
          } else {
            console.warn(`Failed to load model: ${src}`);
            updateProgress();
          }
        })
        .catch(() => {
          console.warn(`Failed to load model: ${src}`);
          updateProgress();
        });
    });
    
    // Fallback timeout after 20 seconds (increased for video loading)
    const timeout = setTimeout(() => {
      if (loadingProgress < 100) {
        console.warn('[App] Loading timeout reached after 20s, proceeding anyway');
        setLoadingProgress(100);
      }
    }, 20000);
    
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
      <Header3D />
      
      {/* Services Section */}
      <Services />
      
      {/* Portfolio Section */}
      <Portfolio />
      
      {/* About Section */}
      <About />
      
      {/* Contact Section */}
      <Contact />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;