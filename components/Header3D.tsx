import React, { useMemo, useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import AnimatedPhone from './AnimatedPhone';
import PerformanceMonitor from './PerformanceMonitor';
import { PHONE_IMAGES, ALL_MEDIA_CONTENT } from '../constants';
import { useBreakpoint } from '../hooks/useMediaQuery';
import { getVideosByCategory } from '../videoUtils';

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
  
  // Animated locations with icons
  const locations = [
    { name: 'Bodrum', icon: '🌊' },      // Sea/Waves (Bodrum's beaches)
    { name: 'Istanbul', icon: '🕌' },    // Mosque
    { name: 'London', icon: '🎡' },      // London Eye
    { name: 'Dubai', icon: '🏙️' },      // Skyscrapers
    { name: 'New York', icon: '🗽' },   // Statue of Liberty
    { name: 'Paris', icon: '🗼' },       // Eiffel Tower
    { name: 'Milan', icon: '👗' },       // Fashion
    { name: 'Tokyo', icon: '🗾' }        // Japan/Mt. Fuji
  ];
  const [currentLocationIndex, setCurrentLocationIndex] = useState(0);
  const [isLocationChanging, setIsLocationChanging] = useState(false);

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
  
  // Animate location text
  useEffect(() => {
    const interval = setInterval(() => {
      setIsLocationChanging(true);
      setTimeout(() => {
        setCurrentLocationIndex((prev) => (prev + 1) % locations.length);
        setIsLocationChanging(false);
      }, 300);
    }, 2500);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let ticking = false;
    let lastScrollY = 0;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Skip if scroll change is too small
      if (Math.abs(currentScrollY - lastScrollY) < 2) {
        return;
      }
      
      lastScrollY = currentScrollY;
      
      if (!ticking) {
        ticking = true;
        animationFrameRef.current = requestAnimationFrame(() => {
          if (!headerRef.current) {
            ticking = false;
            return;
          }

          const { offsetTop: headerTopOffset, offsetHeight: headerClientHeight } = headerRef.current;
          const viewportHeight = window.innerHeight;

          const scrollRelativeToStickyActive = Math.max(0, currentScrollY - headerTopOffset);
          const parallaxActiveScrollRange = headerClientHeight - viewportHeight;

          if (parallaxActiveScrollRange <= 0) {
            setParallaxOffset(0);
            ticking = false;
            return;
          }
          
          let effectiveParallaxScroll = Math.max(0, Math.min(scrollRelativeToStickyActive, parallaxActiveScrollRange));
          if (currentScrollY < headerTopOffset) {
            effectiveParallaxScroll = 0;
          }

          const scrollProgress = effectiveParallaxScroll / parallaxActiveScrollRange;
          const MAX_OFFSET_PERCENT = 120; // Original value from working version
          const newParallaxOffset = scrollProgress * MAX_OFFSET_PERCENT;
          
          // Only update if change is significant
          setParallaxOffset(prev => {
            if (Math.abs(prev - newParallaxOffset) > 0.5) {
              return newParallaxOffset;
            }
            return prev;
          });
          
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

  // Project data artık doğrudan video metadata'dan alınacak

  const { isMobile, isTablet } = useBreakpoint();
  
  const phoneConfigs = useMemo(() => {
    // Kategoriye göre videoları filtrele
    let filteredVideos;
    
    if (selectedCategory === 'all') {
      // Tüm kategorilerden karışık video seç
      const allVideos = getVideosByCategory('all');
      
      // Her kategoriden en az bir video olacak şekilde karışık seç
      const categories = ['Fashion', 'Commercial', 'Gastronomy', 'Interview'];
      const selectedVideos = [];
      
      // Her kategoriden en az 2 video al
      categories.forEach(cat => {
        const catVideos = allVideos.filter(v => v.category === cat);
        if (catVideos.length > 0) {
          // Her kategoriden 2-3 rastgele video seç
          const shuffled = [...catVideos].sort(() => Math.random() - 0.5);
          selectedVideos.push(...shuffled.slice(0, Math.min(3, catVideos.length)));
        }
      });
      
      // Karıştır ve 10 video seç
      const mixedVideos = [...selectedVideos].sort(() => Math.random() - 0.5).slice(0, 10);
      
      filteredVideos = mixedVideos.map(video => ({
        id: video.id,
        src: video.preview || video.fullVideo || '',
        alt: video.alt || video.title || '',
        title: video.title,
        description: video.description,
        category: video.category,
        location: video.location
      }));
    } else if (selectedCategory === 'fashion') {
      // Fashion kategorisi için özel sıralama
      const categoryVideos = getVideosByCategory(selectedCategory);
      
      // Video 41'i bul
      const video41Index = categoryVideos.findIndex(v => v.id === '41');
      let reorderedVideos = [...categoryVideos];
      
      if (video41Index !== -1) {
        // Video 41'i çıkar
        const video41 = reorderedVideos.splice(video41Index, 1)[0];
        
        // Pozisyon 5'teki videoyu al (0-indexed, yani 6. telefon)
        if (reorderedVideos.length > 5) {
          const video6 = reorderedVideos[5];
          // Video 41'i pozisyon 5'e koy
          reorderedVideos.splice(5, 1, video41);
          // Eski 6. videoyu pozisyon 9'a koy (10. telefon)
          if (reorderedVideos.length > 9) {
            reorderedVideos.splice(9, 1, video6);
          } else {
            reorderedVideos.push(video6);
          }
        } else {
          // Eğer 6. pozisyon yoksa direkt ekle
          reorderedVideos.splice(5, 0, video41);
        }
      }
      
      // MediaContent'ten preview URL'lerini çıkar ve VideoInfo formatına çevir
      filteredVideos = reorderedVideos.map(video => ({
        id: video.id,
        src: video.preview || video.fullVideo || '',
        alt: video.alt || video.title || '',
        title: video.title,
        description: video.description,
        category: video.category,
        location: video.location
      }));
    } else if (selectedCategory === 'commercial') {
      // Commercial kategorisi için rastgele sıralama
      const categoryVideos = getVideosByCategory(selectedCategory);
      
      // Videoları karıştır ve ilk 10'u al (12 video var)
      const shuffledVideos = [...categoryVideos].sort(() => Math.random() - 0.5).slice(0, 10);
      
      // MediaContent'ten preview URL'lerini çıkar ve VideoInfo formatına çevir
      filteredVideos = shuffledVideos.map(video => ({
        id: video.id,
        src: video.preview || video.fullVideo || '',
        alt: video.alt || video.title || '',
        title: video.title,
        description: video.description,
        category: video.category,
        location: video.location
      }));
    } else {
      // Diğer kategoriler için normal sıralama
      const categoryVideos = getVideosByCategory(selectedCategory);
      
      // MediaContent'ten preview URL'lerini çıkar ve VideoInfo formatına çevir
      filteredVideos = categoryVideos.map(video => ({
        id: video.id,
        src: video.preview || video.fullVideo || '',
        alt: video.alt || video.title || '',
        title: video.title,
        description: video.description,
        category: video.category,
        location: video.location
      }));
    }
    
    // Always show 10 phones on desktop
    const totalPhones = isMobile ? 6 : isTablet ? 7 : 10;
    
    console.log(`[Header3D] Category: ${selectedCategory}, Videos: ${filteredVideos.length}, Phones: ${totalPhones}`);
    
    // Create phone configurations
    return Array.from({ length: totalPhones }).map((_, idx) => {
      if (idx < filteredVideos.length) {
        // Video varsa göster
        const video = filteredVideos[idx];
        return {
          key: `phone-${idx}`,
          videoSrc: video.src,
          altText: video.alt,
          videoData: video,
          hasVideo: true
        };
      } else {
        // Video yoksa boş telefon göster
        return {
          key: `phone-${idx}`,
          videoSrc: '',
          altText: 'Empty',
          videoData: null,
          hasVideo: false
        };
      }
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
            alt="Intiba Production - Bodrum Video Prodüksiyon Ajansı Logo" 
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
                alt="Telefona tıklayın - İnteraktif video galerisi" 
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
            shadows={false}  // Disable shadows for better performance
            frameloop="always"  // Always render for animations
            camera={{
              position: isMobile ? [12, -7, 15] : [20, -12, 24.5],   // Sağa ve aşağıya kaydırıldı
              fov: isMobile ? 12 : 6.5,  // Wider FOV on mobile
              near: 0.1,
              far: 100,  // Reduced far plane
            }}
            gl={{
              antialias: true,  // Enable antialiasing for better quality
              alpha: true,
              powerPreference: 'high-performance',
              stencil: false,
              depth: true,
              preserveDrawingBuffer: false,  // Better performance
              failIfMajorPerformanceCaveat: false
            }}
            dpr={[1, 2]}  // Allow up to 2x for retina displays
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
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 40, 5]} intensity={1.2} />
            <pointLight position={[-10, -10, -5]} intensity={0.4} />

            <Suspense fallback={null}>
              <Environment preset="city" />
              <PerformanceMonitor 
                showStats={false}
                onQualityChange={(quality) => {
                  // Adjust render quality based on performance
                  console.log('Quality changed to:', quality);
                }}
              />
              <group rotation={[0, 0, 0]} scale={isMobile ? 1.5 : isTablet ? 1.3 : 1.1} position={[0, 0, 0]}>
                {(() => {
                  // Telefon sayısını azalt: Sütun bazlı düzenleme
                  // Desktop: 3 sütun (4+3+3), Tablet: 3 sütun (3+2+2), Mobile: 2 sütun (3+3)
                  const columns = isMobile ? 2 : 3;
                  const phonesPerColumn = isMobile 
                    ? [3, 3]  // Mobile: 2 sütun, her biri 3 telefon
                    : isTablet 
                      ? [3, 2, 2]  // Tablet: 3 sütun (3+2+2 = 7 telefon)
                      : [4, 3, 3];  // Desktop: 3 sütun (4+3+3 = 10 telefon)
                  
                  let phoneIndex = 0;
                  const allPhones = [];
                  
                  // Sütunları oluştur
                  for (let col = 0; col < columns; col++) {
                    const phoneCount = phonesPerColumn[col];
                    for (let row = 0; row < phoneCount; row++) {
                      if (phoneIndex < phoneConfigs.length) {
                        allPhones.push({
                          config: phoneConfigs[phoneIndex],
                          col: col,
                          row: row,
                          totalInColumn: phoneCount
                        });
                        phoneIndex++;
                      }
                    }
                  }
                  
                  return allPhones.map(({ config: cfg, col, row, totalInColumn }, index) => {
                          const movingDown = col % 2 !== 0;
                          const spacingX = isMobile ? 1.3 : 1.1;  // Sütunlar arası mesafe
                          const spacingY = isMobile ? 2.2 : 2.0;  // Satırlar arası mesafe
                          
                          // X pozisyonu - sütun bazlı
                          const x = (col - 1) * spacingX; // -1.1, 0, 1.1 for 3 columns
                          
                          // Y pozisyonu - her sütundaki telefon sayısına göre merkezle
                          const centerOffsetForColumn = (totalInColumn - 1) / 2;
                          let baseY = (row - centerOffsetForColumn) * spacingY;
                          
                          // 2. sütundaki telefonları bir telefon boyu yukarı taşı
                          if (col === 1) {  // 2. sütun (0-indexed)
                            baseY += spacingY;  // Bir telefon boyu yukarı
                          }
                          
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
                          const entranceDelay = hasEntered ? 0 : (col * 50 + row * 20); // Sütun bazlı gecikme
                          
                          // All phones use AnimatedPhone
                          const phoneNumber = index + 1;
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
                              showDebugNumber={selectedCategory === 'debug'}
                              debugNumber={phoneNumber}
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
                const videoData = selectedConfig?.videoData;
                if (!videoData) return null;
                
                // Tags'i string'den array'e çevir
                const tags = videoData.tags ? videoData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
                
                return (
                  <>
                    <h2 className="font-ramillas text-5xl mb-2 text-neutral-900 transition-all duration-700"
                        style={{
                          opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                          transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                          transitionDelay: isClosing ? '0ms' : '600ms'
                        }}>
                      <span className="font-bold">{videoData.title || 'Untitled'}</span>
                    </h2>
                    <h3 className="font-ramillas text-3xl mb-6 text-neutral-600 font-normal italic transition-all duration-700"
                        style={{
                          opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                          transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                          transitionDelay: isClosing ? '50ms' : '800ms'
                        }}>
                      {videoData.location || 'Location'}
                    </h3>
                    <p className="font-grotesk text-xl text-neutral-700 mb-8 leading-relaxed transition-all duration-700"
                        style={{
                          opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                          transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                          transitionDelay: isClosing ? '100ms' : '1000ms'
                        }}>
                      {videoData.description || 'No description available'}
                    </p>
                    <div className="flex gap-3 flex-wrap transition-all duration-700"
                         style={{
                           opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                           transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                           transitionDelay: isClosing ? '150ms' : '1200ms'
                         }}>
                      {tags.length > 0 ? tags.slice(0, 4).map((tag, i) => (
                        <span key={i} className="font-grotesk px-4 py-2 bg-neutral-200 rounded-full text-sm">
                          {tag}
                        </span>
                      )) : (
                        <>
                          {videoData.category && (
                            <span className="font-grotesk px-4 py-2 bg-neutral-200 rounded-full text-sm">
                              {videoData.category}
                            </span>
                          )}
                          {videoData.category2 && (
                            <span className="font-grotesk px-4 py-2 bg-neutral-200 rounded-full text-sm">
                              {videoData.category2}
                            </span>
                          )}
                        </>
                      )}
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
                fontSize: 'clamp(32px, 4.5vw, 58px)',
                lineHeight: '1.15',
                letterSpacing: '-0.02em',
                opacity: 0, 
                animation: showContent ? 'fade-in-left 0.8s ease-out 0.3s forwards' : 'none' 
              }}
            >
              <div>
                <span className="font-normal">We </span>
                <span className="font-bold">Define Brands</span>
              </div>
              <div>
                <span className="font-normal">Through </span>
                <span className="font-normal italic">Visual Storytelling</span>
              </div>
            </h1>
            <p
              className="font-grotesk text-neutral-600 mb-6 sm:mb-8 md:mb-10"
              style={{ 
                fontSize: 'clamp(17px, 2vw, 22px)',
                letterSpacing: '-0.01em',
                fontWeight: '400',
                opacity: 0, 
                animation: showContent ? 'fade-in-left 0.8s ease-out 0.4s forwards' : 'none',
                position: 'relative',
                height: '1.5em'
              }}
            >
              <span className="mr-1" style={{ opacity: 0.7 }}>—</span>
              Premium Video Production in{' '}
              <span 
                className="inline-flex items-center gap-1"
                style={{
                  opacity: isLocationChanging ? 0 : 1,
                  transform: isLocationChanging ? 'translateY(-10px)' : 'translateY(0)',
                  transition: 'all 0.3s ease-in-out',
                  minWidth: '150px'
                }}
              >
                <span style={{ fontSize: '1.1em', verticalAlign: 'middle' }}>
                  {locations[currentLocationIndex].icon}
                </span>
                <span className="font-semibold" style={{ color: '#111' }}>
                  {locations[currentLocationIndex].name}
                </span>
              </span>
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
            {/* All buttons in a single row */}
            <div className="flex gap-3 py-2">
              <button
                onClick={() => handleCategoryChange('all')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm whitespace-nowrap ${
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
                onClick={() => handleCategoryChange('fashion')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm whitespace-nowrap ${
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
                onClick={() => handleCategoryChange('commercial')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm whitespace-nowrap ${
                  selectedCategory === 'commercial' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-900 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: selectedCategory === 'commercial' ? undefined : '#fffceb'
                }}
              >
                Commercial
              </button>
              <button
                onClick={() => handleCategoryChange('gastronomy')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm whitespace-nowrap ${
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
                onClick={() => handleCategoryChange('interview')}
                className={`px-4 py-2 font-grotesk font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-sm whitespace-nowrap ${
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