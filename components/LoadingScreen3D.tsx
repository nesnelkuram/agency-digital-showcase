import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import LoadingPhone from './LoadingPhone';

interface LoadingScreen3DProps {
  onLoadComplete: () => void;
  progress: number;
}

const LoadingScreen3D: React.FC<LoadingScreen3DProps> = ({ onLoadComplete, progress }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  
  useEffect(() => {
    if (progress >= 100 && !isClosing) {
      // Start closing animation (like clicking selected phone)
      setIsClosing(true);
      
      // After circle starts contracting, fade out entire loading screen
      setTimeout(() => {
        setFadeOut(true);
      }, 2000);
      
      // Complete transition
      setTimeout(() => {
        onLoadComplete();
      }, 2800); // Match Header3D closing animation timing
    }
  }, [progress, isClosing, onLoadComplete]);

  return (
    <div className={`fixed inset-0 z-[9999] bg-white transition-opacity duration-500 ${
      fadeOut ? 'opacity-0' : 'opacity-100'
    }`}>
      {/* Circle background - exactly like Header3D selected/closing behavior */}
      <div 
        className={`absolute bg-[#fffceb] rounded-full transition-all ${
          isClosing ? 'z-30' : 'z-10'
        }`}
        style={{
          // Circle contracts when closing, stays expanded otherwise
          width: isClosing ? '100vh' : '400vw',
          height: isClosing ? '100vh' : '400vw',
          // Position changes based on state (exactly like Header3D)
          left: isClosing ? '84%' : '60%',
          top: isClosing ? '26%' : '50%',
          transform: 'translate(-50%, -50%)',
          transitionDuration: isClosing ? '2800ms' : '0ms',
          transitionDelay: '0ms',
          transitionTimingFunction: isClosing 
            ? 'cubic-bezier(0.4, 0, 0.2, 1)' // smooth contraction
            : 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // smooth expansion
        }}
      />
      
      {/* 3D Canvas with loading phone */}
      <div className="relative w-full h-full">
        <Canvas
          camera={{ 
            position: [16, -8, 20],  // Same as Header3D
            fov: 8,
            near: 0.1,
            far: 1000 
          }}
          gl={{ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1
          }}
        >
          <Environment preset="studio" />
          
          {/* Lighting setup */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <pointLight position={[-5, -5, -5]} intensity={0.5} />
          
          {/* Loading phone in selected position */}
          <LoadingPhone 
            progress={progress}
            isClosing={isClosing}
          />
        </Canvas>
      </div>
      
      {/* Loading text */}
      <div className={`absolute bottom-20 left-1/2 transform -translate-x-1/2 text-center transition-opacity duration-500 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}>
        <p className="font-ramillas text-2xl text-gray-800 mb-2">Loading Experience</p>
        <p className="font-grotesk text-lg text-gray-600">{Math.round(progress)}%</p>
      </div>
    </div>
  );
};

export default LoadingScreen3D;