import React, { useMemo, useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import AnimatedPhone from './AnimatedPhone';
import { ALL_MEDIA_CONTENT } from '../constants';
import { useBreakpoint } from '../hooks/useMediaQuery';
import { getVideosByCategory } from '../videoUtils';

interface Header3DProps {
  onOpenQuote?: () => void;
  onReady?: () => void;  // Called when 3D content is fully rendered
  revealed?: boolean;    // True when loading screen has finished transitioning
}

const Header3D: React.FC<Header3DProps> = ({ onOpenQuote, onReady, revealed = false }) => {
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [lastSelectedPhone, setLastSelectedPhone] = useState<string | null>(null);
  const [hasEntered, setHasEntered] = useState(false); // Start false for entrance animation
  const [showContent, setShowContent] = useState(false); // Content animations wait for reveal

  // Start content and phone entrance animations after reveal
  useEffect(() => {
    if (revealed) {
      // Phones enter first
      const phoneTimer = setTimeout(() => {
        setHasEntered(true);
      }, 50);
      // Content appears after phones start entering
      const contentTimer = setTimeout(() => {
        setShowContent(true);
      }, 300);
      return () => {
        clearTimeout(phoneTimer);
        clearTimeout(contentTimer);
      };
    }
  }, [revealed]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCategoryChanging, setIsCategoryChanging] = useState(false);
  const [phonesShouldFall, setPhonesShouldFall] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [mobileScrollProgress, setMobileScrollProgress] = useState(0);
  const headerRef = useRef<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  
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
  const handleCategoryChange = useCallback((category: string) => {
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
  }, [selectedCategory, isCategoryChanging, selectedPhone]);

  // Handle phone click - memoized for performance
  const handlePhoneClick = useCallback((phoneKey: string, isCurrentlySelected: boolean) => {
    if (isCurrentlySelected) {
      setIsClosing(true);
      setLastSelectedPhone(selectedPhone);
      setSelectedPhone(null);
      setTimeout(() => {
        setIsClosing(false);
        setLastSelectedPhone(null);
      }, 800);
    } else {
      setSelectedPhone(phoneKey);
      setLastSelectedPhone(phoneKey);
    }
  }, [selectedPhone]);

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
    let lastUpdateTime = 0;
    const THROTTLE_MS = 32; // ~30fps max update rate

    // Cache DOM values - only read once per resize
    let cachedHeaderTop = 0;
    let cachedHeaderHeight = 0;
    let cachedViewportHeight = window.innerHeight;

    const updateCachedValues = () => {
      if (headerRef.current) {
        cachedHeaderTop = headerRef.current.offsetTop;
        cachedHeaderHeight = headerRef.current.offsetHeight;
      }
      cachedViewportHeight = window.innerHeight;
    };

    updateCachedValues();
    window.addEventListener('resize', updateCachedValues, { passive: true });

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const now = performance.now();

      // Skip if scroll change is too small or too soon
      if (Math.abs(currentScrollY - lastScrollY) < 5 || (now - lastUpdateTime) < THROTTLE_MS) {
        return;
      }

      lastScrollY = currentScrollY;
      lastUpdateTime = now;

      if (!ticking) {
        ticking = true;
        animationFrameRef.current = requestAnimationFrame(() => {
          const scrollRelativeToStickyActive = Math.max(0, currentScrollY - cachedHeaderTop);
          const parallaxActiveScrollRange = cachedHeaderHeight - cachedViewportHeight;

          if (parallaxActiveScrollRange <= 0) {
            setParallaxOffset(0);
            ticking = false;
            return;
          }

          let effectiveParallaxScroll = Math.max(0, Math.min(scrollRelativeToStickyActive, parallaxActiveScrollRange));
          if (currentScrollY < cachedHeaderTop) {
            effectiveParallaxScroll = 0;
          }

          const scrollProgress = effectiveParallaxScroll / parallaxActiveScrollRange;
          const MAX_OFFSET_PERCENT = 120;
          const newParallaxOffset = scrollProgress * MAX_OFFSET_PERCENT;

          // Only update if change is significant (increased threshold)
          setParallaxOffset(prev => {
            if (Math.abs(prev - newParallaxOffset) > 1) {
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
      window.removeEventListener('resize', updateCachedValues);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const { isMobile, isTablet } = useBreakpoint();

  // How many viewport-heights to scroll before parallax ends
  const PARALLAX_DURATION_VIEWPORTS = isMobile ? 3.5 : 5; // Mobilde daha kısa, daha erken aşağı in

  // Mobile: No scroll animation, phones visible immediately
  useEffect(() => {
    setMobileScrollProgress(1); // Always complete - no scroll animation
  }, []);

  const phoneConfigs = useMemo(() => {
    // Kategoriye göre videoları filtrele
    let filteredVideos;
    
    if (selectedCategory === 'all') {
      // Tüm kategorilerden karışık video seç
      const allVideos = getVideosByCategory('all');
      
      // Her kategoriden en az bir video olacak şekilde karışık seç
      const categories = ['Fashion', 'Commercial', 'Gastronomy', 'Interview'];
      const selectedVideos: any[] = [];
      
      // Her kategoriden en az 2 video al
      categories.forEach(cat => {
        const catVideos = allVideos.filter(v => v.category === cat);
        if (catVideos.length > 0) {
          // Her kategoriden 2-3 rastgele video seç
          const shuffled = [...catVideos].sort(() => Math.random() - 0.5);
          selectedVideos.push(...shuffled.slice(0, Math.min(3, catVideos.length)));
        }
      });
      
      // Karıştır ve 11 video seç (mobil için 4+4+3=11)
      const mixedVideos = [...selectedVideos].sort(() => Math.random() - 0.5).slice(0, 11);
      
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
      
      // Videoları karıştır ve ilk 11'i al (mobil için 4+4+3=11)
      const shuffledVideos = [...categoryVideos].sort(() => Math.random() - 0.5).slice(0, 11);
      
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
    
    // Always show 10 phones on desktop, 11 on mobile (4+4+3)
    const totalPhones = isMobile ? 11 : isTablet ? 7 : 10;
    
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

  // Touch handlers for mobile carousel
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || selectedPhone) return;
    setTouchStartX(e.touches[0].clientX);
  }, [isMobile, selectedPhone]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isMobile || selectedPhone) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    const threshold = 50;

    if (diff > threshold && carouselIndex < phoneConfigs.length - 1) {
      setCarouselIndex(prev => prev + 1);
    } else if (diff < -threshold && carouselIndex > 0) {
      setCarouselIndex(prev => prev - 1);
    }
  }, [isMobile, selectedPhone, touchStartX, carouselIndex, phoneConfigs.length]);

  return (
    <header 
      ref={headerRef} 
      className="relative w-full block" 
      style={{ height: `${PARALLAX_DURATION_VIEWPORTS * 100}vh` }}
    >
      <div className={`sticky top-0 h-screen w-full overflow-hidden bg-[#ebeef8] z-10 ${isMobile ? 'flex flex-col' : 'flex items-center'}`}>
        
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
            ...(isMobile
              ? { left: '5%', top: '8%' }
              : { right: '20%', top: '10%' }
            ),
            opacity: selectedPhone ? 0 : (showContent ? 1 : 0),
            transform: showContent ? 'scale(1)' : 'scale(0.5)',
            transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transitionDelay: showContent ? '0.7s' : '0s',
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
          className={`z-40 flex justify-center items-center pointer-events-none ${isMobile ? 'relative' : 'absolute inset-0'}`}
          style={{
            perspective: '1000px',
            perspectiveOrigin: '60% 40%',
            ...(isMobile ? { height: '75vh', width: '100%' } : {})
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Canvas
            shadows={false}  // Disable shadows for better performance
            frameloop="demand"  // Only render when needed - use invalidate() in animations
            camera={{
              // Mobil: Desktop gibi yan açıdan bakış (FOV artırıldı tüm telefonlar görünsün)
              position: isMobile ? [12, -6, 18] : [20, -12, 24.5],
              fov: isMobile ? 25 : 6.5,
              near: 0.1,
              far: 100,
            }}
            gl={{
              antialias: false,  // Disabled for performance
              alpha: true,
              powerPreference: 'high-performance',
              stencil: false,
              depth: true,
              preserveDrawingBuffer: false,
              failIfMajorPerformanceCaveat: false
            }}
            dpr={[1, 2]}  // Dynamic: uses device pixel ratio up to 2x
            onCreated={() => {
              // Signal that 3D is ready immediately
              onReady?.();
            }}
            style={{
              width: '100%',
              height: '100%',
              opacity: showContent ? 1 : 0,
              transition: 'opacity 1s ease-out',
              cursor: `url('/images/cursor.svg') 16 16, pointer`,
              pointerEvents: 'auto'
            }}
          >
            <CameraController
              lookAt={[0, 0, 0]}
              rotation={isMobile ? [0.60, 0.55, 0.4] : [0.5, 0.7, 0.4]}  // Desktop ile aynı açı
            />
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 40, 5]} intensity={1.2} />
            <pointLight position={[-10, -10, -5]} intensity={0.4} />

            <Suspense fallback={null}>
              <Environment preset="city" />
              <group rotation={[0, 0, 0]} scale={isMobile ? 2.5 : isTablet ? 1.3 : 1.1} position={isMobile ? [0, 0, 0] : [0, 0, 0]}>
                {(() => {
                  // Telefon sayısını ayarla: Sütun bazlı düzenleme
                  // Desktop: 3 sütun (4+3+3), Mobile: 3x3 diyagonal
                  const columns = 3;  // Hepsi 3 sütun
                  const phonesPerColumn = isMobile
                    ? [4, 4, 3]  // Mobile: 4+4+3 = 11 telefon
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
                          let x: number, y: number, z: number;

                          if (isMobile) {
                            // ===== MOBİL: DESKTOP İLE AYNI GRİD DÜZEN =====
                            const movingDown = col % 2 !== 0;
                            const spacingX = 1.1;  // Desktop ile aynı
                            const spacingY = 2.0;  // Desktop ile aynı

                            // X pozisyonu - sütun bazlı (desktop ile aynı)
                            x = (col - 1) * spacingX; // -1.1, 0, 1.1

                            // Y pozisyonu - her sütundaki telefon sayısına göre merkezle
                            const centerOffsetForColumn = (totalInColumn - 1) / 2;
                            let baseY = (row - centerOffsetForColumn) * spacingY;

                            // Sütun bazlı Y offset
                            if (col === 0) {
                              baseY += spacingY;  // 1. sütun bir satır yukarı
                            } else if (col === 1) {
                              baseY += spacingY;  // 2. sütun bir satır yukarı
                            }
                            // 3. sütun offset yok - ikinci satırdan başlar

                            // Parallax efekti - mobilde daha hızlı
                            const offsetMultiplier = 0.035;
                            const yOffset = movingDown ? -parallaxOffset * offsetMultiplier : parallaxOffset * offsetMultiplier;
                            y = baseY + yOffset;

                            z = 0;

                          } else {
                            // ===== DESKTOP GRİD (DEĞİŞMEZ) =====
                            const movingDown = col % 2 !== 0;
                            const spacingX = 1.1;  // Sütunlar arası mesafe
                            const spacingY = 2.0;  // Satırlar arası mesafe

                            // X pozisyonu - sütun bazlı
                            x = (col - 1) * spacingX; // -1.1, 0, 1.1 for 3 columns

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
                            y = baseY + yOffset;

                            z = 0;  // Z pozisyonu sabit, animasyon component içinde
                          }

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

                          // Mobile: use hasEntered directly (no scroll-based stagger)
                          const mobileHasEntered = hasEntered;

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
                              hasEntered={mobileHasEntered}
                              entranceDelay={isMobile ? 0 : entranceDelay}
                              showDebugNumber={selectedCategory === 'debug'}
                              debugNumber={phoneNumber}
                              onClick={() => handlePhoneClick(cfg.key, isSelected)}
                              isMobile={isMobile}
                              phoneIndex={index}
                            />
                          );
                  });
                })()}
              </group>
            </Suspense>
          </Canvas>
        </div>

        {/* Carousel dots - sadece mobilde ve telefon seçili değilken */}
        {isMobile && !selectedPhone && (
          <div className="absolute bottom-8 left-0 right-0 z-50 flex justify-center gap-2 pointer-events-auto">
            {phoneConfigs.map((_, i) => (
              <button
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === carouselIndex ? 'bg-neutral-900 w-4' : 'bg-neutral-400 w-2'
                }`}
                onClick={() => setCarouselIndex(i)}
              />
            ))}
          </div>
        )}

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
          <div className="absolute inset-0 z-40 pointer-events-none flex flex-col md:flex-row h-full">
            {/* Mobile: Top area - clickable to close */}
            <div
              className="md:hidden flex-1 pointer-events-auto"
              onClick={() => selectedPhone && handlePhoneClick(selectedPhone, true)}
            />
            {/* Left side (desktop) / Bottom side (mobile) - Project details */}
            <div className={`w-full md:w-1/2 p-4 sm:p-8 md:p-12 lg:p-16 flex flex-col justify-center md:justify-center pointer-events-auto bg-gradient-to-t from-white/95 via-white/80 to-transparent md:bg-none`}>
              {(() => {
                const phoneKey = isClosing ? lastSelectedPhone : selectedPhone;
                const selectedConfig = phoneConfigs.find(cfg => cfg.key === phoneKey);
                const videoData = selectedConfig?.videoData;
                if (!videoData) return null;
                
                // Tags'i string'den array'e çevir
                const tags = (videoData as any).tags ? (videoData as any).tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag) : [];
                
                return (
                  <>
                    <h2 className="font-ramillas text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-2 text-neutral-900 transition-all duration-700"
                        style={{
                          opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                          transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                          transitionDelay: isClosing ? '0ms' : '600ms'
                        }}>
                      <span className="font-bold">{videoData.title || 'Untitled'}</span>
                    </h2>
                    <h3 className="font-ramillas text-lg sm:text-xl md:text-2xl lg:text-3xl mb-4 md:mb-6 text-neutral-600 font-normal italic transition-all duration-700"
                        style={{
                          opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                          transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                          transitionDelay: isClosing ? '50ms' : '800ms'
                        }}>
                      {videoData.location || 'Location'}
                    </h3>
                    <p className="font-grotesk text-sm sm:text-base md:text-lg lg:text-xl text-neutral-700 mb-4 md:mb-8 leading-relaxed transition-all duration-700"
                        style={{
                          opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                          transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                          transitionDelay: isClosing ? '100ms' : '1000ms'
                        }}>
                      {videoData.description || 'No description available'}
                    </p>
                    <div className="flex gap-2 md:gap-3 flex-wrap transition-all duration-700"
                         style={{
                           opacity: isClosing ? 0 : (selectedPhone ? 1 : 0),
                           transform: isClosing ? 'translateY(30px)' : (selectedPhone ? 'translateY(0)' : 'translateY(30px)'),
                           transitionDelay: isClosing ? '150ms' : '1200ms'
                         }}>
                      {tags.length > 0 ? tags.slice(0, 4).map((tag: string, i: number) => (
                        <span key={i} className="font-grotesk px-2 sm:px-3 md:px-4 py-1 md:py-2 bg-neutral-200 rounded-full text-xs sm:text-sm">
                          {tag}
                        </span>
                      )) : (
                        <>
                          {videoData.category && (
                            <span className="font-grotesk px-2 sm:px-3 md:px-4 py-1 md:py-2 bg-neutral-200 rounded-full text-xs sm:text-sm">
                              {videoData.category}
                            </span>
                          )}
                          {(videoData as any).category2 && (
                            <span className="font-grotesk px-2 sm:px-3 md:px-4 py-1 md:py-2 bg-neutral-200 rounded-full text-xs sm:text-sm">
                              {(videoData as any).category2}
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
            <div className="hidden md:block md:w-1/2" />
          </div>
        )}

        {/* Content Layer */}
        <div className={`z-50 text-left transition-opacity ${selectedPhone ? 'opacity-0' : 'opacity-100'} ${isMobile ? 'relative w-full px-4 pt-8 pb-4' : 'relative max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-4xl p-6 sm:p-8 md:p-12 lg:p-16 xl:p-20'}`}
             style={{
               transform: selectedPhone ? 'translateY(12px)' : 'translateY(0)',
               transitionDuration: selectedPhone ? '800ms' : '1000ms',
               transitionDelay: selectedPhone ? '0ms' : '200ms',
               transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
               ...(isMobile ? { height: '25vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' } : {})
             }}>
          <div >
            <h1
              className="font-ramillas text-neutral-900 mb-4 md:mb-6"
              style={{
                fontSize: 'clamp(32px, 4.5vw, 58px)',
                lineHeight: '1.15',
                letterSpacing: '-0.02em',
                opacity: showContent ? 1 : 0,
                transform: showContent ? 'translateX(0)' : 'translateX(-40px)',
                transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.1s'
              }}
            >
              <div>
                <span className="font-normal">Transform Your Brand With </span>
                <span className="font-bold">Premium Video Content</span>
              </div>
              <div>
                <span className="font-normal">That </span>
                <span className="font-normal italic">Drives Real Results</span>
              </div>
            </h1>
            <p
              className="font-grotesk text-neutral-600 mb-6 sm:mb-8 md:mb-10"
              style={{
                fontSize: 'clamp(17px, 2vw, 22px)',
                letterSpacing: '-0.01em',
                fontWeight: '400',
                opacity: showContent ? 1 : 0,
                transform: showContent ? 'translateX(0)' : 'translateX(-40px)',
                transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s',
                position: 'relative',
                height: '1.5em'
              }}
            >
              <span className="mr-1" style={{ opacity: 0.7 }}>—</span>
              Award-winning video production that increases brand awareness by 300%+ in{' '}
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
              opacity: showContent ? 1 : 0,
              transform: showContent ? 'translateX(0)' : 'translateX(-40px)',
              transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.5s',
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
                <span className="relative z-10">Get Free Strategy Session</span>
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