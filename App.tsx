import React, { useState, useEffect } from 'react';
import Header3D from './components/Header3D';
import Services from './components/Services';
import Portfolio from './components/Portfolio';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';
import SimpleLoadingScreen from './components/SimpleLoadingScreen';
import * as THREE from 'three';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  useEffect(() => {
    // Preload critical assets
    const assetsToLoad = {
      videos: [
        // First 12 preview videos for visible phones
        '/videos/preview/1.mp4',
        '/videos/preview/2.mp4',
        '/videos/preview/3.mp4',
        '/videos/preview/4.mp4',
        '/videos/preview/5.mp4',
        '/videos/preview/6.mp4',
        '/videos/preview/7.mp4',
        '/videos/preview/8.mp4',
        '/videos/preview/9.mp4',
        '/videos/preview/10..mp4',
        '/videos/preview/11.mp4',
        '/videos/preview/12.mp4',
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
      video.preload = 'metadata';
      
      const handleLoad = () => {
        updateProgress();
        video.removeEventListener('loadedmetadata', handleLoad);
      };
      
      video.addEventListener('loadedmetadata', handleLoad);
      video.addEventListener('error', () => {
        console.warn(`Failed to load video: ${src}`);
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
    
    // Fallback timeout after 10 seconds
    const timeout = setTimeout(() => {
      if (loadingProgress < 100) {
        console.warn('Loading timeout reached, proceeding anyway');
        setLoadingProgress(100);
      }
    }, 10000);
    
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