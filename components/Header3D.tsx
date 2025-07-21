import React, { useMemo, useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import AnimatedPhone from './AnimatedPhone';
import { PHONE_IMAGES } from '../constants';

const Header3D: React.FC = () => {
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const animationFrameRef = useRef<number>();
  
  // How many viewport-heights to scroll before parallax ends
  const PARALLAX_DURATION_VIEWPORTS = 2.5; // Daha kısa scroll mesafesi

  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        animationFrameRef.current = requestAnimationFrame(() => {
          if (!headerRef.current) {
            ticking = false;
            return;
          }

          const scrollY = window.scrollY;
          const { offsetTop: headerTopOffset, offsetHeight: headerClientHeight } = headerRef.current;
          const viewportHeight = window.innerHeight;

          const scrollRelativeToStickyActive = Math.max(0, scrollY - headerTopOffset);
          const parallaxActiveScrollRange = headerClientHeight - viewportHeight;

          if (parallaxActiveScrollRange <= 0) {
            setParallaxOffset(0);
            ticking = false;
            return;
          }
          
          let effectiveParallaxScroll = Math.max(0, Math.min(scrollRelativeToStickyActive, parallaxActiveScrollRange));
          if (scrollY < headerTopOffset) {
            effectiveParallaxScroll = 0;
          }

          const scrollProgress = effectiveParallaxScroll / parallaxActiveScrollRange;
          const MAX_OFFSET_PERCENT = 60; // Azaltıldı - telefonlar viewport'ta kalacak
          const newParallaxOffset = scrollProgress * MAX_OFFSET_PERCENT;

          // Debug log'ları
          console.log('Scroll Debug:', {
            scrollY,
            headerTopOffset,
            headerClientHeight,
            viewportHeight,
            scrollRelativeToStickyActive,
            parallaxActiveScrollRange,
            scrollProgress,
            newParallaxOffset
          });
          
          setParallaxOffset(newParallaxOffset);
          
          ticking = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const phoneConfigs = useMemo(() => {
    const colsPerRow = Array(12).fill(4); // 12 rows, 4 columns each = 48 phones
    const totalPhones = colsPerRow.reduce((sum, count) => sum + count, 0);
    return Array.from({ length: totalPhones }).map((_, idx) => {
      const imageIdx = idx % PHONE_IMAGES.length;
      return {
        key: `phone-${idx}`,
        videoSrc: PHONE_IMAGES[imageIdx].src, // IPhone3D hala videoSrc prop'unu bekliyor
        altText: PHONE_IMAGES[imageIdx].alt,
      };
    });
  }, []);

  return (
    <header 
      ref={headerRef} 
      className="relative w-full" 
      style={{ height: `${PARALLAX_DURATION_VIEWPORTS * 100}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center">

        {/* 3D Phone Grid Layer */}
        <div 
          className="absolute inset-0 z-10 flex justify-center items-center"
          style={{ 
            perspective: '1000px', 
            perspectiveOrigin: '60% 40%'  // adjusted vanishing point
          }}
        >
          <Canvas
            shadows
            camera={{
              position: [16, -10, 20],   // Tam karşıdan bakış
              fov: 8,
              near: 0.1,
              far: 1000,
            }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
              stencil: false,
              depth: true,
            }}
            dpr={[1, 2]}
            style={{ 
              width: '100%', 
              height: '100%',
              opacity: 0,
              animation: 'fade-in 1.2s ease-out 0.8s forwards'
            }}
          >
            <CameraController 
              lookAt={[0, 0, 0]}
              rotation={[0.5, 0.7, 0.4]}
            />
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 40, 5]} intensity={1.2} castShadow />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />

            <Suspense fallback={null}>
              <Environment preset="studio" />
              <group rotation={[0, 0, 0]} scale={1.3} position={[0, 0, 0]}>
                {(() => {
                  const colsPerRow = Array(12).fill(4);  // 12 satır
                  let idx = 0;
                  return colsPerRow.map((numCols, row) => {
                    const slice = phoneConfigs.slice(idx, idx + numCols);
                    idx += numCols;
                    return (
                      <group key={`row-${row}`}>
                        {slice.map((cfg, col) => {
                          const movingDown = col % 2 !== 0;
                          const spacingX = 1;
                          const spacingY = 1.8;
                          const x = (col - 1.5) * spacingX;  // Ortalamak için
                          // En üst satırdaki telefonların aşağı inmesini engelle
                          const baseY = (row - 6) * spacingY;
                          const offsetMultiplier = 0.06; // Daha yavaş hareket
                          let yOffset;
                          
                          if (movingDown) {
                            // Çift sütunlar (aşağı hareket) - en üst satır için sınırlama
                            yOffset = -parallaxOffset * offsetMultiplier;
                            // En üst satırdaki telefonların çok fazla aşağı inmesini engelle
                            if (row === 0) {
                              yOffset = Math.max(yOffset, -spacingY * 0.5); // Maksimum yarım satır aşağı
                            }
                          } else {
                            // Tek sütunlar (yukarı hareket)
                            yOffset = parallaxOffset * offsetMultiplier;
                          }
                          
                          const y = baseY + yOffset;
                          
                          
                          const z = 0;  // Z pozisyonu sabit, animasyon component içinde
                          const isSelected = selectedPhone === cfg.key;
                          return (
                            <AnimatedPhone
                              key={cfg.key}
                              videoSrc={cfg.videoSrc}
                              position={[x, y, z]}
                              isSelected={isSelected}
                              onClick={() => setSelectedPhone(isSelected ? null : cfg.key)}
                            />
                          );
                        })}
                      </group>
                    );
                  });
                })()}
              </group>
            </Suspense>
          </Canvas>
        </div>

        {/* Content Layer */}
        <div className="relative z-30 text-left max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl p-6 sm:p-8 md:p-12 lg:p-16 xl:p-20">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6 leading-tight"
            style={{ opacity: 0, animation: 'fade-in-left 0.8s ease-out 0.2s forwards' }}
          >
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-red-600">
              Digital Prowess,
            </span>
            <span className="block mt-1 sm:mt-2 text-neutral-900">Creative Edge.</span>
          </h1>
          <p
            className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-600 mb-6 sm:mb-8 md:mb-10"
            style={{ opacity: 0, animation: 'fade-in-left 0.8s ease-out 0.4s forwards' }}
          >
            We fuse innovative strategy with cutting-edge design and technology to forge digital experiences that captivate and convert for forward-thinking brands.
          </p>
          <div
            className="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-3 sm:gap-4"
            style={{ opacity: 0, animation: 'fade-in-left 0.8s ease-out 0.6s forwards' }}
          >
            <a
              href="#start"
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-base md:text-lg"
            >
              Launch Your Vision
            </a>
            <a
              href="#work"
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-3.5 bg-transparent border-2 border-purple-500 hover:bg-purple-600 hover:text-white text-purple-600 font-semibold rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 text-base md:text-lg"
            >
              See Our Portfolio
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};

// Camera Controller Component
function CameraController({ 
  lookAt,
  rotation = [0, 0, 0] 
}: { 
  lookAt?: [number, number, number];
  rotation?: [number, number, number]; // [x, y, z] Euler angles in radians
}) {
  const { camera } = useThree();
  
  useEffect(() => {
    if (lookAt) {
      camera.lookAt(...lookAt);
    }
    
    // Apply rotation
    camera.rotation.set(...rotation);
    
    camera.updateProjectionMatrix();
  }, [camera, lookAt, rotation]);
  
  return null;
}

export default Header3D;