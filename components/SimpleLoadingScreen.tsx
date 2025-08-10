import React, { useEffect, useState } from 'react';

interface SimpleLoadingScreenProps {
  onLoadComplete: () => void;
  progress: number;
}

const SimpleLoadingScreen: React.FC<SimpleLoadingScreenProps> = ({ onLoadComplete, progress }) => {
  const [fadeOut, setFadeOut] = useState(false);
  
  useEffect(() => {
    if (progress >= 100 && !fadeOut) {
      // Start fade out
      setTimeout(() => {
        setFadeOut(true);
      }, 500);
      
      // Complete transition
      setTimeout(() => {
        onLoadComplete();
      }, 1000);
    }
  }, [progress, fadeOut, onLoadComplete]);

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
    </div>
  );
};

export default SimpleLoadingScreen;