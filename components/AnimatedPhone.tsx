import React, { Suspense, useMemo, useState, useEffect, memo, useRef } from 'react';
import { animated, useSpring } from '@react-spring/three';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import IPhone3D from './IPhone3D';
import { smartVideoManager } from '../utils/smartVideoManager';

interface AnimatedPhoneProps {
  videoSrc: string;
  fullVideoSrc?: string;  // Full video URL for selected state
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
  shouldFall?: boolean;
  fallDelay?: number;
  hasEntered?: boolean;
  entranceDelay?: number;
  showDebugNumber?: boolean;
  debugNumber?: number;
  mobileRotation?: [number, number, number];  // Mobil için özel rotasyon
  mobileScale?: number;  // Mobil için özel scale
  isMobile?: boolean;  // Mobil cihaz mı
  phoneIndex?: number;  // Phone index for staggered video loading
}

const AnimatedPhone: React.FC<AnimatedPhoneProps> = ({
  videoSrc,
  fullVideoSrc,
  position,
  isSelected,
  onClick,
  shouldFall = false,
  fallDelay = 0,
  hasEntered = false,
  entranceDelay = 0,
  showDebugNumber = false,
  debugNumber = 0,
  mobileRotation,
  mobileScale = 1,
  isMobile = false,
  phoneIndex = 0
}) => {
  // Loading state for full video
  const [isLoadingFullVideo, setIsLoadingFullVideo] = useState(false);
  
  // When selected, manage loading state for full video
  useEffect(() => {
    if (isSelected && fullVideoSrc) {
      // Show loading while video starts streaming
      setIsLoadingFullVideo(true);

      // Create a video element to check loading state
      const testVideo = document.createElement('video');
      testVideo.src = fullVideoSrc;
      testVideo.preload = 'metadata';

      // Cleanup function to release video memory
      const cleanup = () => {
        testVideo.src = '';
        testVideo.load();
      };

      // Hide loading when video can start playing
      const handleCanPlay = () => {
        setIsLoadingFullVideo(false);
        cleanup();
      };

      // Also handle errors
      const handleError = () => {
        console.error('Failed to load full video:', fullVideoSrc);
        setIsLoadingFullVideo(false);
        cleanup();
      };

      testVideo.addEventListener('canplay', handleCanPlay);
      testVideo.addEventListener('error', handleError);

      // Fallback timer in case events don't fire
      const fallbackTimer = setTimeout(() => {
        setIsLoadingFullVideo(false);
        cleanup();
      }, 3000); // 3 second fallback

      return () => {
        clearTimeout(fallbackTimer);
        testVideo.removeEventListener('canplay', handleCanPlay);
        testVideo.removeEventListener('error', handleError);
        cleanup();
        setIsLoadingFullVideo(false);
      };
    } else {
      setIsLoadingFullVideo(false);
    }
  }, [isSelected, fullVideoSrc]);
  
  // Generate random delays and rotation direction (only calculated once)
  const rotationStartDelay = useMemo(() => Math.random() * 2000 + 200, []); // 200-2200ms random delay
  const rotationDirection = useMemo(() => Math.random() > 0.5 ? 1 : -1, []); // Random rotation direction
  
  // Initial position for entrance animation (phones start very close)
  const initialPosition = hasEntered ? position : [position[0], position[1] - 0.5, position[2] - 3];
  
  // Kamera FOV'u ve rotation'ı dikkate alarak telefonu viewport'ta tut
  const targetPosition = isSelected ? (isMobile ? {
    x: 1.5,         // Mobilde ortada
    y: 0,         // Mobilde biraz yukarıda
    z: 2          // Mobilde kameraya yakın
  } : {
    x: 3.4,       // Desktop: Kamera rotation'ı nedeniyle sağa kaydır
    y: -2,        // Desktop: Kamera rotation'ı ve FOV için aşağıda tut
    z: 5          // Desktop: Kameraya yakın ama tamamı görünecek mesafede
  }) : shouldFall ? {
    x: position[0],
    y: position[1],  // Keep same height
    z: position[2] - 35  // Fall backward away from camera (closer than before)
  } : hasEntered ? {
    x: position[0],
    y: position[1],
    z: position[2]
  } : {
    x: initialPosition[0],
    y: initialPosition[1],
    z: initialPosition[2]
  };
  
  // X ekseni: Üstten öne doğru eğilme
  // Y ekseni: Soldan sağa dönüş
  const targetRotation = isSelected ? {
    x: Math.PI / 4,      // Eğim yok, düz duracak
    y: Math.PI * 2.12,      // 360 derece Y ekseninde dönüş
    z: 0
  } : shouldFall ? {
    x: 0,                // No tilt
    y: Math.PI * 2 * rotationDirection,      // 360 degrees - one full rotation (random direction)
    z: 0                 // No side rotation
  } : hasEntered ? {
    // Mobil rotasyon varsa kullan, yoksa varsayılan
    x: mobileRotation ? mobileRotation[0] : 0,
    y: mobileRotation ? mobileRotation[1] : 0,
    z: mobileRotation ? mobileRotation[2] : 0
  } : {
    x: -Math.PI / 6,     // Start tilted back
    y: Math.PI * rotationDirection,  // Random initial rotation
    z: 0
  };
  
  // Memoized spring configs - prevents recalculation on every render
  const positionConfig = useMemo(() => {
    if (shouldFall) return { mass: 1.5, tension: 100, friction: 18, delay: fallDelay };
    if (isSelected) return { mass: 1.2, tension: 90, friction: 18, delay: 0 };
    if (hasEntered) return { mass: 1, tension: 100, friction: 16, delay: 0 };  // Lighter for entrance
    return { mass: 0.8, tension: 120, friction: 14, delay: 0 };  // Very light for initial
  }, [shouldFall, isSelected, hasEntered, fallDelay]);

  const rotationConfig = useMemo(() => {
    if (shouldFall) return { mass: 1.2, tension: 120, friction: 14, delay: rotationStartDelay * 0.5 };
    if (isSelected) return { mass: 1.5, tension: 80, friction: 20, delay: 0 };
    if (hasEntered) return { mass: 1, tension: 100, friction: 16, delay: 0 };  // Lighter for entrance
    return { mass: 1.5, tension: 70, friction: 16, delay: 0 };
  }, [shouldFall, isSelected, hasEntered, rotationStartDelay]);

  // Optimized position animation - lighter config for better performance
  const { posX, posY, posZ, scale } = useSpring({
    from: {
      posX: position[0],
      posY: position[1] - 0.5,
      posZ: position[2] - 3,
      scale: 0.9
    },
    posX: targetPosition.x,
    posY: targetPosition.y,
    posZ: targetPosition.z,
    scale: shouldFall ? 0.8 : (hasEntered ? mobileScale : 0.5),
    config: positionConfig
  });

  // Optimized rotation animation
  const { rotX, rotY, rotZ } = useSpring({
    from: {
      rotX: -Math.PI / 8,
      rotY: Math.PI * 0.5 * rotationDirection,
      rotZ: 0
    },
    rotX: targetRotation.x,
    rotY: targetRotation.y,
    rotZ: targetRotation.z,
    config: rotationConfig
  });

  // Track animation state for invalidation
  const isAnimating = useRef(true);
  const { invalidate } = useThree();

  // Invalidate frame when animations are active
  useFrame(() => {
    // During entrance, selection changes, or falling - invalidate to render
    if (!hasEntered || isSelected || shouldFall || isAnimating.current) {
      invalidate();
    }
  });

  // Stop invalidating after entrance animation settles (approx 1.5s)
  useEffect(() => {
    if (hasEntered && !isSelected && !shouldFall) {
      const timer = setTimeout(() => {
        isAnimating.current = false;
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      isAnimating.current = true;
    }
  }, [hasEntered, isSelected, shouldFall]);

  // LOD - viewport dışındaki telefonları optimize et
  // During entrance animation, always render the phone (no culling)
  const isInViewport = !hasEntered || Math.abs(position[1]) < 10;  // Restored to original

  // Don't play videos on non-selected phones when one is selected
  // Videos only play when near camera, not during initial load
  const isNearCamera = Math.abs(position[1]) < 6 && !shouldFall;   // Restored to original
  
  // Handle video with smart manager
  useEffect(() => {
    if (isSelected && videoSrc) {
      smartVideoManager.playSelected(videoSrc);
    } else if (isNearCamera && videoSrc) {
      // Just prepare thumbnail, don't play
      smartVideoManager.getThumbnail(videoSrc);
    }
    
    return () => {
      if (videoSrc) {
        smartVideoManager.stopSelected(videoSrc);
      }
    };
  }, [isSelected, isNearCamera, videoSrc]);

  return (
    <animated.group 
      position-x={posX}
      position-y={posY}
      position-z={posZ}
      rotation-x={rotX}
      rotation-y={rotY}
      rotation-z={rotZ}
      scale={scale}
    >
      {/* Debug number display */}
      {showDebugNumber && (
        <Text
          position={[0, 1.2, 0]}  // Position above the phone
          fontSize={0.5}
          color="red"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="white"
        >
          {debugNumber}
        </Text>
      )}
      
      {isInViewport ? (
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[0.75, 1.6, 0.08]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
        }>
          {showDebugNumber ? (
            // Debug mode: Show simple black phone without video
            <mesh onClick={onClick}>
              <boxGeometry args={[0.75, 1.6, 0.08]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          ) : (
            // Normal mode: Show IPhone3D
            <IPhone3D
              key={`${isSelected ? 'full' : 'preview'}-${videoSrc}`}  // Force re-render when video changes
              videoSrc={isSelected ? (fullVideoSrc || videoSrc) : videoSrc}  // Use full video only when selected
              rotation={[0, 0, 0]}
              isLoading={isSelected && isLoadingFullVideo}
              onClick={onClick}
              isNearCamera={isNearCamera}
              isSelected={isSelected}
              enableSound={isSelected}  // Only enable sound when selected
              loadDelay={phoneIndex * 300}  // Staggered loading: 0ms, 300ms, 600ms, etc.
            />
          )}
        </Suspense>
      ) : (
        // Basit placeholder viewport dışı için - transparent during entrance
        <mesh>
          <boxGeometry args={[0.75, 1.6, 0.08]} />
          <meshBasicMaterial color="#1a1a1a" transparent opacity={hasEntered ? 0.3 : 0} />
        </mesh>
      )}
    </animated.group>
  );
};

export default memo(AnimatedPhone);