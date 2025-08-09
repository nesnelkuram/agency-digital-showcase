import React, { useMemo, useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import AnimatedPhone from './AnimatedPhone';
import AnimatedPhoneVideo from './AnimatedPhoneVideo';
import { PHONE_IMAGES, PHONE_MEDIA_CONTENT } from '../constants';

const Header3D: React.FC = () => {
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [lastSelectedPhone, setLastSelectedPhone] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const animationFrameRef = useRef<number>();
  
  // How many viewport-heights to scroll before parallax ends
  const PARALLAX_DURATION_VIEWPORTS = 5; // Original value for extended parallax viewing

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
          const MAX_OFFSET_PERCENT = 120; // Original value from working version
          const newParallaxOffset = scrollProgress * MAX_OFFSET_PERCENT;
          
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

  // Project data for each phone
  const projectData = [
    {
      title: "Mandarin Oriental",
      subtitle: "Istanbul",
      description: "Boğaz'ın eşsiz manzarasında lüks ve konforun buluştuğu nokta. 5 yıldızlı otel deneyimini sinematik bir hikayeye dönüştürdük.",
      tags: ["Luxury Hotel", "Bosphorus", "5 Stars"]
    },
    {
      title: "Four Seasons",
      subtitle: "Sultanahmet",
      description: "Tarihi yarımadanın kalbinde, Osmanlı mimarisinin modern konforla harmanlandığı benzersiz bir deneyim.",
      tags: ["Historic", "Ottoman Style", "Premium"]
    },
    {
      title: "Soho House",
      subtitle: "Istanbul",
      description: "Yaratıcı ruhların buluşma noktası. Sanat, tasarım ve sosyal yaşamın kesiştiği modern bir üyelik kulübü.",
      tags: ["Members Club", "Creative", "Social"]
    },
    {
      title: "Raffles",
      subtitle: "Zorlu Center",
      description: "Şehrin yeni lüks ikonu. Modern mimarinin ve sofistike tasarımın mükemmel uyumu.",
      tags: ["Modern", "Luxury", "City View"]
    },
    {
      title: "Edition",
      subtitle: "Bodrum",
      description: "Ege'nin mavisiyle buluşan çağdaş tasarım. Plaj kulübünden gece hayatına uzanan dinamik bir yaşam.",
      tags: ["Beach Club", "Aegean", "Lifestyle"]
    },
    {
      title: "Park Hyatt",
      subtitle: "Maçka",
      description: "İş ve sosyal hayatın kesişim noktasında, şehrin nabzını tutan prestijli bir adres.",
      tags: ["Business", "City Center", "Premium"]
    },
    {
      title: "W Hotel",
      subtitle: "Akaretler",
      description: "Genç ve dinamik enerjinin modern lüksle buluştuğu, şehrin en cool adresi.",
      tags: ["Trendy", "Nightlife", "Young"]
    },
    {
      title: "St. Regis",
      subtitle: "Nişantaşı",
      description: "Zarafet ve protokolün adresi. Geleneksel butler servisi ile unutulmaz bir konaklama deneyimi.",
      tags: ["Elegant", "Butler Service", "Classic"]
    },
    {
      title: "Shangri-La",
      subtitle: "Bosphorus",
      description: "Asya'nın misafirperverliği Boğaz'ın büyüsüyle buluşuyor. Huzur ve lüksün mükemmel dengesi.",
      tags: ["Asian Hospitality", "Spa", "Wellness"]
    },
    {
      title: "Swissotel",
      subtitle: "The Bosphorus",
      description: "İsviçre hassasiyeti ve Türk misafirperverliğinin eşsiz birleşimi. Kongre ve etkinliklerin vazgeçilmez adresi.",
      tags: ["Conference", "Swiss Quality", "Events"]
    },
    {
      title: "Çırağan Palace",
      subtitle: "Kempinski",
      description: "Osmanlı sarayından otele dönüşen tarihi mekan. Sultanlara layık bir konaklama deneyimi.",
      tags: ["Palace", "Historic", "Royal"]
    },
    {
      title: "Maxx Royal",
      subtitle: "Bodrum",
      description: "Her şey dahil lüks konseptinin zirvesi. Ailelere özel tasarlanmış tatil cenneti.",
      tags: ["All Inclusive", "Family", "Resort"]
    }
  ];

  const phoneConfigs = useMemo(() => {
    const colsPerRow = Array(12).fill(4); // 12 rows, 4 columns each = 48 phones
    const totalPhones = colsPerRow.reduce((sum, count) => sum + count, 0);
    return Array.from({ length: totalPhones }).map((_, idx) => {
      const mediaIdx = idx % PHONE_MEDIA_CONTENT.length;
      const projectIdx = idx % projectData.length;
      const row = Math.floor(idx / 4); // Her satırda 4 telefon var
      // İlk 3 satır (12 telefon) video olsun - performans için
      const useNewSystem = row < 3;
      
      if (useNewSystem) {
        return {
          key: `phone-${idx}`,
          media: PHONE_MEDIA_CONTENT[mediaIdx],
          videoSrc: undefined,
          altText: undefined,
          isVideo: true as const,
          project: projectData[projectIdx]
        };
      } else {
        // Geri kalanlar eski sistem
        const imageIdx = idx % PHONE_IMAGES.length;
        return {
          key: `phone-${idx}`,
          media: undefined,
          videoSrc: PHONE_IMAGES[imageIdx].src,
          altText: PHONE_IMAGES[imageIdx].alt,
          isVideo: false as const,
          project: projectData[projectIdx]
        };
      }
    });
  }, []);

  return (
    <header 
      ref={headerRef} 
      className="relative w-full block" 
      style={{ height: `${PARALLAX_DURATION_VIEWPORTS * 100}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center bg-[#ebeef8] z-10">
        
        {/* Logo */}
        <div className="absolute top-12 z-50" style={{ left: '5.5%' }}>
          <img 
            src="/images/intibalogo.svg" 
            alt="intiba" 
            style={{ 
              height: '25px',
              width: 'auto'
            }} 
          />
        </div>
        
        {/* Updated Background */}
        <div className="absolute inset-0 z-0">
          {/* Base background color #ebeef8 */}
          <div 
            className="absolute inset-0"
            style={{
              background: '#ebeef8'
            }}
          />
          
          {/* Triangle area with #fffceb */}
          <div 
            className="absolute"
            style={{
              bottom: 0,
              right: 0,
              width: '100%',
              height: '100%',
              background: '#fffceb',
              clipPath: 'circle(50% at 84% 26%)',
            }}
          />
        </div>

        {/* 3D Phone Grid Layer */}
        <div 
          className="absolute inset-0 z-40 flex justify-center items-center"
          style={{ 
            perspective: '1000px', 
            perspectiveOrigin: '60% 40%'  // adjusted vanishing point
          }}
        >
          <Canvas
            shadows
            camera={{
              position: [16, -8, 20],   // Slightly higher camera for better view
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
              <group rotation={[0, 0, 0]} scale={1.1} position={[0, 0, 0]}>
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
                          const spacingX = 1.1;  // Increased horizontal spacing
                          const spacingY = 2;  // Increased vertical spacing
                          const x = (col - 1.5) * spacingX;  // Original centering
                          // Original positioning from working version
                          const baseY = (row - 6) * spacingY;  // Original position
                          const offsetMultiplier = 0.025; // Increased movement for more visible parallax
                          
                          // Simple parallax offset like in original
                          const yOffset = movingDown ? -parallaxOffset * offsetMultiplier : parallaxOffset * offsetMultiplier;
                          const y = baseY + yOffset;
                          
                          
                          const z = 0;  // Z pozisyonu sabit, animasyon component içinde
                          const isSelected = selectedPhone === cfg.key;
                          const shouldFall = !!(selectedPhone && !isSelected);
                          
                          // Calculate fall delay based on distance from selected phone
                          let fallDelay = 0;
                          if (shouldFall && selectedPhone) {
                            const selectedIdx = phoneConfigs.findIndex(p => p.key === selectedPhone);
                            const currentIdx = phoneConfigs.findIndex(p => p.key === cfg.key);
                            const distance = Math.abs(currentIdx - selectedIdx);
                            fallDelay = distance * 30; // 30ms delay per phone distance
                          }
                          
                          // Use video component for media content, regular for images
                          if (cfg.isVideo && cfg.media) {
                            return (
                              <AnimatedPhoneVideo
                                key={cfg.key}
                                media={cfg.media}
                                position={[x, y, z]}
                                isSelected={isSelected}
                                shouldFall={shouldFall}
                                fallDelay={fallDelay}
                                onClick={() => {
                                  if (isSelected) {
                                    setIsClosing(true);
                                    setLastSelectedPhone(selectedPhone);
                                    setSelectedPhone(null);  // Phone moves immediately
                                    setTimeout(() => {
                                      setIsClosing(false);
                                      setLastSelectedPhone(null);
                                    }, 800);
                                  } else {
                                    setSelectedPhone(cfg.key);
                                    setLastSelectedPhone(cfg.key);
                                  }
                                }}
                                onDeselect={() => setSelectedPhone(null)}
                              />
                            );
                          } else if (!cfg.isVideo && cfg.videoSrc) {
                            return (
                              <AnimatedPhone
                                key={cfg.key}
                                videoSrc={cfg.videoSrc}
                                position={[x, y, z]}
                                isSelected={isSelected}
                                shouldFall={shouldFall}
                                fallDelay={fallDelay}
                                onClick={() => {
                                  if (isSelected) {
                                    setIsClosing(true);
                                    setLastSelectedPhone(selectedPhone);
                                    setSelectedPhone(null);  // Phone moves immediately
                                    setTimeout(() => {
                                      setIsClosing(false);
                                      setLastSelectedPhone(null);
                                    }, 800);
                                  } else {
                                    setSelectedPhone(cfg.key);
                                    setLastSelectedPhone(cfg.key);
                                  }
                                }}
                              />
                            );
                          }
                          return null;
                        })}
                      </group>
                    );
                  });
                })()}
              </group>
            </Suspense>
          </Canvas>
        </div>

        {/* Expanding circle background - only in header section */}
        <div 
          className={`absolute bg-[#fffceb] rounded-full transition-all ${
            selectedPhone || isClosing ? 'z-30' : 'z-10'
          }`}
          style={{
            // Circle expands when selected, shrinks when closing
            width: isClosing ? '100vh' : (selectedPhone ? '400vw' : '100vh'),
            height: isClosing ? '100vh' : (selectedPhone ? '400vw' : '100vh'),
            // Position changes based on state
            left: isClosing ? '84%' : (selectedPhone ? '60%' : '84%'),
            top: isClosing ? '26%' : (selectedPhone ? '50%' : '26%'),
            transform: 'translate(-50%, -50%)',
            transitionDuration: isClosing ? '2800ms' : (selectedPhone ? '2500ms' : '2000ms'),
            transitionDelay: '0ms', // Always immediate
            transitionTimingFunction: isClosing 
              ? 'cubic-bezier(0.4, 0, 0.2, 1)' // smooth contraction
              : 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // smooth expansion
          }}
          onClick={() => {
            if (selectedPhone) {
              setIsClosing(true);
              setLastSelectedPhone(selectedPhone);
              setSelectedPhone(null);  // Phone moves immediately
              setTimeout(() => {
                setIsClosing(false);
                setLastSelectedPhone(null);
              }, 800);
            }
          }}
        />
        
        {/* Project details - shown when phone is selected */}
        {(selectedPhone || isClosing) && (
          <div className="absolute inset-0 z-40 pointer-events-none flex h-full">
            {/* Left side - Project details */}
            <div className={`w-1/2 p-16 flex flex-col justify-center pointer-events-auto`}
                 style={{
                   opacity: isClosing ? 0 : 1,
                   transform: isClosing ? 'translateY(30px)' : 'translateY(0)',
                   transition: 'all 800ms cubic-bezier(0.4, 0, 0.2, 1)',
                   transitionDelay: isClosing ? '0ms' : '600ms'
                 }}>
              {(() => {
                const phoneKey = isClosing ? lastSelectedPhone : selectedPhone;
                const selectedConfig = phoneConfigs.find(cfg => cfg.key === phoneKey);
                const project = selectedConfig?.project;
                if (!project) return null;
                
                return (
                  <>
                    <h2 className="font-ramillas text-5xl mb-2 text-neutral-900"
                        style={{
                          opacity: 0,
                          animation: !isClosing && selectedPhone ? 'fadeInUpSmooth 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.8s forwards' : isClosing ? 'fadeOutDown 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none'
                        }}>
                      <span className="font-bold">{project.title}</span>
                    </h2>
                    <h3 className="font-ramillas text-3xl mb-6 text-neutral-600 font-normal italic"
                        style={{
                          opacity: 0,
                          animation: !isClosing && selectedPhone ? 'fadeInUpSmooth 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 1s forwards' : isClosing ? 'fadeOutDown 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.05s forwards' : 'none'
                        }}>
                      {project.subtitle}
                    </h3>
                    <p className="font-grotesk text-xl text-neutral-700 mb-8 leading-relaxed"
                        style={{
                          opacity: 0,
                          animation: !isClosing && selectedPhone ? 'fadeInUpSmooth 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 1.2s forwards' : isClosing ? 'fadeOutDown 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards' : 'none'
                        }}>
                      {project.description}
                    </p>
                    <div className="flex gap-3 flex-wrap"
                         style={{
                           opacity: 0,
                           animation: !isClosing && selectedPhone ? 'fadeInUpSmooth 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 1.4s forwards' : isClosing ? 'fadeOutDown 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.15s forwards' : 'none'
                         }}>
                      {project.tags.map((tag, i) => (
                        <span key={i} className="font-grotesk px-4 py-2 bg-neutral-200 rounded-full text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
            
            {/* Right side - Empty for phone */}
            <div className="w-1/2" />
          </div>
        )}

        {/* Content Layer */}
        <div className={`relative z-20 text-left max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-4xl p-6 sm:p-8 md:p-12 lg:p-16 xl:p-20 transition-all ${selectedPhone ? 'opacity-0 translate-y-12 pointer-events-none' : 'opacity-100 translate-y-0'}`}
             style={{
               transitionDuration: selectedPhone ? '800ms' : '1000ms',
               transitionDelay: selectedPhone ? '0ms' : '200ms',
               transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
             }}>
          <div >
            <h1
              className="font-ramillas text-neutral-900 mb-6"
              style={{ 
                fontSize: '65px',
                lineHeight: '1.15',
                letterSpacing: '-0.02em',
                opacity: 0, 
                animation: 'fade-in-left 0.8s ease-out 0.3s forwards' 
              }}
            >
              <div>
                <span className="font-normal">Cinematic </span>
                <span className="font-bold">Excellence </span>
                <span className="font-normal">in</span>
              </div>
              <div className="font-normal italic">
                Hospitality & Lifestyle
              </div>
            </h1>
            <p
              className="text-neutral-700 mb-8 sm:mb-10"
              style={{ 
                fontSize: '22px',
                letterSpacing: '-0.01em',
                opacity: 0, 
                animation: 'fade-in-left 0.8s ease-out 0.4s forwards' 
              }}
            >
              <span className="mr-1">—</span>From <span className="font-semibold">Bodrum</span>, with Precision
            </p>
          </div>
          <div
            className="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-3 sm:gap-4"
            style={{ opacity: 0, animation: 'fade-in-left 0.8s ease-out 0.6s forwards' }}
          >
            <a
              href="#start"
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-md shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-base md:text-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Get a Quote Now
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