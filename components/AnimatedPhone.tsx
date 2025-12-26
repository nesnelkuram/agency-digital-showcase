import React, { Suspense, useMemo, useState, useEffect, memo } from 'react';
import { animated, useSpring } from '@react-spring/three';
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
  isMobile = false
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
  
  // Optimized position animation - lighter config for better performance
  const { posX, posY, posZ, scale, opacity } = useSpring({
    from: {
      posX: position[0],
      posY: position[1] - 0.5,
      posZ: position[2] - 3,
      scale: 0.9,
      opacity: 0
    },
    posX: targetPosition.x,
    posY: targetPosition.y,
    posZ: targetPosition.z,
    scale: shouldFall ? 0.8 : (hasEntered ? mobileScale : 0.5),
    opacity: shouldFall ? 0 : (hasEntered ? 1 : 0),
    config: {
      mass: shouldFall ? 2 : (isSelected ? 1.5 : (hasEntered ? 1.2 : 1)),      // Lighter mass = faster settle
      tension: shouldFall ? 80 : (isSelected ? 70 : (hasEntered ? 70 : 80)),   // Higher tension = snappier
      friction: shouldFall ? 20 : (isSelected ? 20 : (hasEntered ? 18 : 15)),  // Lower friction = less drag
      delay: shouldFall ? (fallDelay * 1) : (hasEntered ? 0 : 0)
    }
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
    config: {
      mass: shouldFall ? 1.5 : (isSelected ? 1.8 : (hasEntered ? 1.2 : 2)),  // Lighter mass for faster settle
      tension: shouldFall ? 100 : (isSelected ? 60 : (hasEntered ? 70 : 50)),  // Higher tension = faster response
      friction: shouldFall ? 15 : (isSelected ? 22 : (hasEntered ? 18 : 18)),  // Lower friction = less drag
      delay: shouldFall ? (rotationStartDelay * 0.7) : (hasEntered ? 0 : 0)
    }
  });

  // LOD - viewport dışındaki telefonları optimize et
  // During entrance animation, always render the phone (no culling)
  const isInViewport = !hasEntered || Math.abs(position[1]) < 10;  // No culling during entrance
  
  // Don't play videos on non-selected phones when one is selected
  // Videos only play when near camera, not during initial load
  const isNearCamera = Math.abs(position[1]) < 6 && !shouldFall;   // Stop playing when falling
  
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