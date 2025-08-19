import React, { useMemo, useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import AnimatedPhone from './AnimatedPhone';
import { PHONE_IMAGES } from '../constants';
import { useBreakpoint } from '../hooks/useMediaQuery';

interface Header3DProps {
  onOpenQuote?: () => void;
}

const Header3D: React.FC<Header3DProps> = ({ onOpenQuote }) => {
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [lastSelectedPhone, setLastSelectedPhone] = useState<string | null>(null);
  const [hasEntered, setHasEntered] = useState(true); // Start as true for immediate display
  const [showContent] = useState(true); // Always show content since App.tsx handles loading
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCategoryChanging, setIsCategoryChanging] = useState(false);
  const [phonesShouldFall, setPhonesShouldFall] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const animationFrameRef = useRef<number | undefined>();

  // Handle category change
  const handleCategoryChange = (category: string) => {
    if (category === selectedCategory || isCategoryChanging) return;
    
    // Immediate visual feedback - change category right away
    setSelectedCategory(category);
    
    // Close any open phone first
    if (selectedPhone) {
      setSelectedPhone(null);
      setIsClosing(true);
      setTimeout(() => {
        setIsClosing(false);
        setLastSelectedPhone(null);
      }, 800);
    }
    
    // Start animation
    setIsCategoryChanging(true);
    setPhonesShouldFall(true);  // Make all phones fall
    
    // After phones have fallen, reset and bring them back
    setTimeout(() => {
      setHasEntered(false);
      setPhonesShouldFall(false);  // Stop falling
      
      // Re-trigger entrance animation with new videos
      setTimeout(() => {
        setHasEntered(true);
        setIsCategoryChanging(false);
      }, 50);
    }, 1000);  // Longer wait for fall animation to complete
  };
  
  // How many viewport-heights to scroll before parallax ends
  const PARALLAX_DURATION_VIEWPORTS = 5; // Original value for extended parallax viewing
  
  // Don't trigger entrance animation until videos are loaded
  // (This is now handled in the preload effect above)

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

  const { isMobile, isTablet } = useBreakpoint();
  
  const phoneConfigs = useMemo(() => {
    // Use PHONE_IMAGES directly - category filtering can be added later if needed
    const phoneImages = PHONE_IMAGES;
    // Responsive grid: Mobile (3x3), Tablet (3x5), Desktop (3x7)
    const rows = isMobile ? 3 : isTablet ? 5 : 7;
    const totalPhones = rows * 3; // 3 columns per row
    
    console.log(`[Header3D] Creating ${totalPhones} phones (${rows} rows x 3 cols)`);
    
    return Array.from({ length: totalPhones }).map((_, idx) => {
      const imageIdx = idx % phoneImages.length;
      const projectIdx = idx % projectData.length;
      // Tüm telefonlar için AnimatedPhone kullan
      return {
        key: `phone-${idx}`,
        videoSrc: phoneImages[imageIdx].src,
        altText: phoneImages[imageIdx].alt,
        project: projectData[projectIdx]
      };
    });
  }, [isMobile, isTablet, selectedCategory]);

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
        
        {/* Static cursor indicator - animated entrance and hide when phone is selected */}
        <div 
          className="absolute z-50" 
          style={{ 
            right: '20%', 
            top: '10%',
            opacity: selectedPhone ? 0 : (hasEntered ? 1 : 0),
            transform: hasEntered ? 'scale(1) translateY(0)' : 'scale(0.5) translateY(30px)',
            transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transitionDelay: hasEntered ? '0.5s' : '0s',
            pointerEvents: selectedPhone ? 'none' : 'auto'
          }}
        >
          <div style={{ width: '160px', height: '160px', position: 'relative' }}>
            <style>{`
              @keyframes rotate-indicator {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes fade-in-bounce {
                0% { 
                  opacity: 0;
                  transform: scale(0.3) rotate(-180deg);
                }
                50% {
                  opacity: 0.8;
                  transform: scale(1.1) rotate(90deg);
                }
                100% { 
                  opacity: 1;
                  transform: scale(1) rotate(0deg);
                }
              }
            `}</style>
            <svg 
              viewBox="0 0 200 200" 
              style={{ 
                width: '100%', 
                height: '100%',
                animation: 'rotate-indicator 6s linear infinite'
              }}
            >
              <defs>
                <path
                  id="static-circle-path"
                  d="M 100, 100 m -60, 0 a 60,60 0 1,1 120,0 a 60,60 0 1,1 -120,0"
                />
              </defs>
              <text 
                fill="rgba(51, 51, 51, 1)" 
                fontSize="16" 
                fontWeight="900" 
                letterSpacing="1"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                style={{ textTransform: "uppercase" }}
              >
                <textPath href="#static-circle-path" startOffset="0%">
                  CLICK THE PHONE • CLICK THE PHONE • 
                </textPath>
              </text>
            </svg>
            {/* Center cursor icon with animation */}
            <div 
              style={{ 
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '48px', 
                height: '48px'
              }}
            >
              <img 
                src="/images/cursor.svg" 
                alt="Click cursor" 
                style={{ 
                  width: '100%', 
                  height: '100%',
                  opacity: hasEntered ? 1 : 0,
                  animation: hasEntered ? 'fade-in-bounce 1s ease-out 0.7s both' : 'none'
                }}
              />
            </div>
          </div>
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
          className="absolute inset-0 z-40 flex justify-center items-center pointer-events-none"
          style={{ 
            perspective: '1000px', 
            perspectiveOrigin: '60% 40%'  // adjusted vanishing point
          }}
        >
          <Canvas
            shadows
            camera={{
              position: isMobile ? [10, -5, 15] : [16, -8, 20],   // Closer camera on mobile
              fov: isMobile ? 12 : 8,  // Wider FOV on mobile
              near: 0.1,
              far: 1000,
            }}
            gl={{
              antialias: false,  // Disable antialiasing for better performance
              alpha: true,
              powerPreference: 'high-performance',
              stencil: false,
              depth: true,
              preserveDrawingBuffer: false,  // Better performance
              failIfMajorPerformanceCaveat: false,
            }}
            dpr={[1, Math.min(window.devicePixelRatio, 2)]}  // Limit DPR to 2 max
            style={{ 
              width: '100%', 
              height: '100%',
              opacity: showContent ? 1 : 0,
              animation: showContent ? 'fade-in 1.2s ease-out 0.2s forwards' : 'none',
              cursor: `url('/images/cursor.svg') 16 16, pointer`,
              pointerEvents: 'auto'
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
              <group rotation={[0, 0, 0]} scale={isMobile ? 1.5 : isTablet ? 1.3 : 1.1} position={[0, 0, 0]}>
                {(() => {
                  const rows = isMobile ? 3 : isTablet ? 5 : 7;
                  const colsPerRow = Array(rows).fill(3);  // Dynamic rows, 3 sütun
                  let idx = 0;
                  return colsPerRow.map((numCols, row) => {
                    const slice = phoneConfigs.slice(idx, idx + numCols);
                    idx += numCols;
                    return (
                      <group key={`row-${row}`}>
                        {slice.map((cfg, col) => {
                          const movingDown = col % 2 !== 0;
                          const spacingX = isMobile ? 1.3 : 1.1;  // Wider spacing on mobile
                          const spacingY = isMobile ? 2.5 : 2.0;  // Taller spacing on mobile
                          const x = (col - 1) * spacingX;  // Center 3 columns (0, 1, 2 -> -1, 0, 1)
                          // Dynamic centering based on actual row count
                          const centerOffset = Math.floor(rows / 2);
                          const baseY = (row - centerOffset) * spacingY;  // Center rows dynamically
                          const offsetMultiplier = 0.025; // Increased movement for more visible parallax
                          
                          // Simple parallax offset like in original
                          const yOffset = movingDown ? -parallaxOffset * offsetMultiplier : parallaxOffset * offsetMultiplier;
                          const y = baseY + yOffset;
                          
                          
                          const z = 0;  // Z pozisyonu sabit, animasyon component içinde
                          const isSelected = selectedPhone === cfg.key;
                          const shouldFall = phonesShouldFall || !!(selectedPhone && !isSelected);
                          
                          // Calculate fall delay based on distance from selected phone
                          let fallDelay = 0;
                          if (shouldFall && selectedPhone) {
                            const selectedIdx = phoneConfigs.findIndex(p => p.key === selectedPhone);
                            const currentIdx = phoneConfigs.findIndex(p => p.key === cfg.key);
                            const distance = Math.abs(currentIdx - selectedIdx);
                            fallDelay = distance * 30; // 30ms delay per phone distance
                          }
                          
                          // Calculate entrance delay based on row and column for better stagger
                          const entranceDelay = hasEntered ? 0 : (row * 20 + col * 10); // Smoother stagger for entrance
                          
                          // All phones use AnimatedPhone
                          return (
                            <AnimatedPhone
                              key={cfg.key}
                              videoSrc={cfg.videoSrc}
                              fullVideoSrc={cfg.videoSrc?.replace('/preview/', '/full/')}
                              position={[x, y, z]}
                              isSelected={isSelected}
                              shouldFall={shouldFall}
                              fallDelay={fallDelay}
                              hasEntered={hasEntered}
                              entranceDelay={entranceDelay}
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
        
        {/* Blue expanding circle background - between yellow bg and phone */}
        <div 
          className={`absolute bg-[#EBEEF8] rounded-full transition-all`}
          style={{
            zIndex: selectedPhone || isClosing ? 35 : 9,
            // Hidden when not selected, expands when selected
            width: isClosing ? '0' : (selectedPhone ? '120vh' : '0'),
            height: isClosing ? '0' : (selectedPhone ? '120vh' : '0'),
            // Position at top right, behind phones
            left: '84%',
            top: '26%',
            transform: 'translate(-50%, -50%)',
            transitionDuration: isClosing ? '2800ms' : (selectedPhone ? '2500ms' : '2000ms'),
            transitionDelay: '0ms',
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
            <div className={`w-1/2 p-16 flex flex-col justify-center pointer-events-auto`}>
              {(() => {
                const phoneKey = isClosing ? lastSelectedPhone : selectedPhone;
                const selectedConfig = phoneConfigs.find(cfg => cfg.key === phoneKey);
                const project = selectedConfig?.project;
                if (!project) return null;
                
                return (
                  <>
                    <h2 className="font-ramillas text-5xl mb-2 text-neutral-900 transition-all duration-700"
                        style={{
                          opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                          transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                          transitionDelay: isClosing ? '0ms' : '600ms'
                        }}>
                      <span className="font-bold">{project.title}</span>
                    </h2>
                    <h3 className="font-ramillas text-3xl mb-6 text-neutral-600 font-normal italic transition-all duration-700"
                        style={{
                          opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                          transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                          transitionDelay: isClosing ? '50ms' : '800ms'
                        }}>
                      {project.subtitle}
                    </h3>
                    <p className="font-grotesk text-xl text-neutral-700 mb-8 leading-relaxed transition-all duration-700"
                        style={{
                          opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                          transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                          transitionDelay: isClosing ? '100ms' : '1000ms'
                        }}>
                      {project.description}
                    </p>
                    <div className="flex gap-3 flex-wrap transition-all duration-700"
                         style={{
                           opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                           transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                           transitionDelay: isClosing ? '150ms' : '1200ms'
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
        <div className={`relative z-50 text-left max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-4xl p-6 sm:p-8 md:p-12 lg:p-16 xl:p-20 transition-opacity ${selectedPhone ? 'opacity-0' : 'opacity-100'}`}
             style={{
               transform: selectedPhone ? 'translateY(12px)' : 'translateY(0)',
               transitionDuration: selectedPhone ? '800ms' : '1000ms',
               transitionDelay: selectedPhone ? '0ms' : '200ms',
               transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
             }}>
          <div >
            <h1
              className="font-ramillas text-neutral-900 mb-4 md:mb-6"
              style={{ 
                fontSize: 'clamp(32px, 5vw, 65px)',
                lineHeight: '1.15',
                letterSpacing: '-0.02em',
                opacity: 0, 
                animation: showContent ? 'fade-in-left 0.8s ease-out 0.3s forwards' : 'none' 
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
              className="text-neutral-700 mb-6 sm:mb-8 md:mb-10"
              style={{ 
                fontSize: 'clamp(16px, 2.5vw, 22px)',
                letterSpacing: '-0.01em',
                opacity: 0, 
                animation: showContent ? 'fade-in-left 0.8s ease-out 0.4s forwards' : 'none' 
              }}
            >
              <span className="mr-1">—</span>From <span className="font-semibold">Bodrum</span>, with Precision
            </p>
          </div>
          <div
            className="w-full overflow-x-auto md:overflow-visible"
            style={{ 
              opacity: 0, 
              animation: showContent ? 'fade-in-left 0.8s ease-out 0.6s forwards' : 'none',
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 100
            }}
          >
            {/* Mobile: horizontal scroll, Desktop: 2 rows */}
            <div className="flex md:flex-wrap gap-3 md:mb-3 min-w-max md:min-w-0">
              <button
                onClick={() => handleCategoryChange('all')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm ${
                  selectedCategory === 'all' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-900 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategory === 'all' ? undefined : '#fffceb'
                }}
              >
                All Works
              </button>
              <button
                onClick={() => handleCategoryChange('gastronomy')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm ${
                  selectedCategory === 'gastronomy' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-900 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategory === 'gastronomy' ? undefined : '#fffceb'
                }}
              >
                Gastronomy
              </button>
              <button
                onClick={() => handleCategoryChange('fashion')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm ${
                  selectedCategory === 'fashion' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-900 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategory === 'fashion' ? undefined : '#fffceb'
                }}
              >
                Fashion
              </button>
              <button
                onClick={() => handleCategoryChange('lifestyle')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm ${
                  selectedCategory === 'lifestyle' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-900 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategory === 'lifestyle' ? undefined : '#fffceb'
                }}
              >
                Lifestyle
              </button>
            {/* Desktop only: line break for second row */}
            <div className="hidden md:block w-full h-0"></div>
              <button
                onClick={() => handleCategoryChange('corporate')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm ${
                  selectedCategory === 'corporate' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-900 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategory === 'corporate' ? undefined : '#fffceb'
                }}
              >
                Corporate
              </button>
              <button
                onClick={() => handleCategoryChange('events')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm ${
                  selectedCategory === 'events' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-900 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategory === 'events' ? undefined : '#fffceb'
                }}
              >
                Events
              </button>
              <button
                onClick={() => handleCategoryChange('hotels')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm ${
                  selectedCategory === 'hotels' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-900 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategory === 'hotels' ? undefined : '#fffceb'
                }}
              >
                Hotels
              </button>
              <button
                onClick={() => handleCategoryChange('interview')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm ${
                  selectedCategory === 'interview' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-900 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategory === 'interview' ? undefined : '#fffceb'
                }}
              >
                Interview
              </button>
            </div>
            
            {/* Call to Action Button */}
            <div
              className="mt-8 md:mt-10"
              style={{ 
                opacity: 0, 
                animation: showContent ? 'fade-in-left 0.8s ease-out 0.8s forwards' : 'none',
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 100
              }}
            >
              <button
                onClick={() => {
                  if (onOpenQuote) {
                    onOpenQuote();
                  } else {
                    // Fallback to scroll to contact section
                    const contactSection = document.querySelector('#contact');
                    if (contactSection) {
                      contactSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }}
                className="group relative px-6 py-3 font-grotesk font-bold text-sm rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl flex items-center gap-3"
                style={{
                  backgroundColor: '#333333',
                  color: 'white',
                  border: '2px solid transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#333333';
                  e.currentTarget.style.borderColor = '#333333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#333333';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                {/* Calendar Icon */}
                <svg 
                  className="w-5 h-5 relative z-10" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" 
                    clipRule="evenodd" 
                  />
                </svg>
                <span className="relative z-10">Get a Quote Now</span>
                <div 
                  className="absolute inset-0 rounded-lg transition-all duration-300 ease-in-out"
                  style={{
                    backgroundColor: '#fffceb',
                    transform: 'scale(0)',
                    zIndex: -1
                  }}
                ></div>
              </button>
            </div>
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