import React, { useEffect, useState } from 'react';

interface SimpleLoadingScreenProps {
  onLoadComplete: () => void;
  progress: number;
}

const SimpleLoadingScreen: React.FC<SimpleLoadingScreenProps> = ({ onLoadComplete, progress }) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [minimumTimePassed, setMinimumTimePassed] = useState(false);
  
  // Ensure minimum display time of 2.5 seconds for videos to load
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumTimePassed(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    if (progress >= 100 && minimumTimePassed && !fadeOut) {
      console.log('[LoadingScreen] Starting fade out - all assets loaded');
      // Start fade out
      setTimeout(() => {
        setFadeOut(true);
      }, 500);
      
      // Complete transition
      setTimeout(() => {
        onLoadComplete();
      }, 1000);
    }
  }, [progress, minimumTimePassed, fadeOut, onLoadComplete]);

  return (
    <div className={`fixed inset-0 z-[9999] bg-[#fffceb] flex flex-col items-center justify-center transition-opacity duration-500 ${
      fadeOut ? 'opacity-0' : 'opacity-100'
    }`}>
      {/* Intiba Logo - smaller */}
      <img 
        src="/images/intibalogo.svg" 
        alt="intiba" 
        className="w-32 mb-8"
      />
      
      {/* Loading Bar - horizontal black outline that fills from left */}
      <div className="w-48 h-3 border-2 border-black relative overflow-hidden">
        <div 
          className="absolute top-0 left-0 bottom-0 bg-black transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Loading text instead of percentage */}
      <p className="mt-4 text-sm text-gray-700 font-medium">
        Loading videos...
      </p>
    </div>
  );
};

export default SimpleLoadingScreen;