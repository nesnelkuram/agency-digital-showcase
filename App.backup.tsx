import React, { useState, useEffect } from 'react';
import Header3D from './components/Header3D';
import Services from './components/Services';
import Portfolio from './components/Portfolio';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';
import SimpleLoadingScreen from './components/SimpleLoadingScreen';
import * as THREE from 'three';
import { PHONE_MEDIA_CONTENT, PHONE_IMAGES } from './constants';
import { videoCache } from './utils/videoCache';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  useEffect(() => {
    // Get priority videos from PHONE_IMAGES (first 12)
    const priorityVideos = Array.from(new Set(
      PHONE_IMAGES.slice(0, 12).map(phone => phone.src)
    ));
    
    // Also add preview videos from PHONE_MEDIA_CONTENT
    PHONE_MEDIA_CONTENT.slice(0, 12).forEach(media => {
      if (media.preview) {
        priorityVideos.push(media.preview);
      }
    });
    
    // Remove duplicates
    const uniqueVideos = Array.from(new Set(priorityVideos));
    
    // Other assets to load
    const otherAssets = {
      images: [
        '/images/intibalogo.svg',
        '/images/photo1.jpg'
      ],
      models: [
        '/models/iphone_14_pro_max/scene.gltf'
      ]
    };
    
    const totalAssets = uniqueVideos.length + otherAssets.images.length + otherAssets.models.length;
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
    
    // Preload videos using video cache with batch loading
    const loadVideos = async () => {
      // Load videos in parallel batches for faster loading
      const batchSize = 4;
      for (let i = 0; i < uniqueVideos.length; i += batchSize) {
        const batch = uniqueVideos.slice(i, i + batchSize);
        await Promise.all(batch.map(url => 
          videoCache.preloadVideo(url).then(() => updateProgress())
        ));
      }
    };
    
    loadVideos();
    
    // Preload images
    otherAssets.images.forEach(src => {
      const img = new Image();
      img.onload = updateProgress;
      img.onerror = () => {
        console.warn(`Failed to load image: ${src}`);
        updateProgress();
      };
      img.src = src;
    });
    
    // Preload GLTF models
    otherAssets.models.forEach(src => {
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
    
    // Fallback timeout after 8 seconds (reduced since we're only loading metadata)
    const timeout = setTimeout(() => {
      if (loadingProgress < 100) {
        console.warn('[App] Loading timeout reached after 8s, proceeding anyway');
        setLoadingProgress(100);
      }
    }, 8000);
    
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