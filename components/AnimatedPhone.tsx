import React, { Suspense, useMemo, useState, useEffect } from 'react';
import { animated, useSpring } from '@react-spring/three';
import IPhone3D from './IPhone3D';

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
  entranceDelay = 0
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
      
      // Hide loading when video can start playing
      const handleCanPlay = () => {
        setIsLoadingFullVideo(false);
        testVideo.remove();
      };
      
      // Also handle errors
      const handleError = () => {
        console.error('Failed to load full video:', fullVideoSrc);
        setIsLoadingFullVideo(false);
        testVideo.remove();
      };
      
      testVideo.addEventListener('canplay', handleCanPlay);
      testVideo.addEventListener('error', handleError);
      
      // Fallback timer in case events don't fire
      const fallbackTimer = setTimeout(() => {
        setIsLoadingFullVideo(false);
        testVideo.remove();
      }, 3000); // 3 second fallback
      
      return () => {
        clearTimeout(fallbackTimer);
        testVideo.removeEventListener('canplay', handleCanPlay);
        testVideo.removeEventListener('error', handleError);
        testVideo.remove();
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
  
  // Kamera FOV'u 8 derece ve rotation'ı dikkate alarak telefonu viewport'ta tut
  const targetPosition = isSelected ? {
    x: 4.4,       // Kamera rotation'ı nedeniyle sağa kaydır
    y: -1,      // Kamera rotation'ı ve FOV için aşağıda tut
    z: 6      // Kameraya yakın ama tamamı görünecek mesafede
  } : shouldFall ? {
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
    x: Math.PI / 4,      // 30 derece öne eğilme
    y: Math.PI * 2.3,      // 360 derece Y ekseninde dönüş
    z: 0
  } : shouldFall ? {
    x: 0,                // No tilt
    y: Math.PI * 2 * rotationDirection,      // 360 degrees - one full rotation (random direction)
    z: 0                 // No side rotation
  } : hasEntered ? {
    x: 0,
    y: 0,
    z: 0
  } : {
    x: -Math.PI / 6,     // Start tilted back
    y: Math.PI * rotationDirection,  // Random initial rotation
    z: 0
  };
  
  // Yavaş ve yumuşak animasyon - position ve rotation ayrı
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
    scale: shouldFall ? 0.8 : (hasEntered ? 1 : 0.5),  // Start small, grow to normal
    opacity: shouldFall ? 0 : (hasEntered ? 1 : 0),  // Start invisible then fade in
    config: { 
      mass: shouldFall ? 8 : (hasEntered ? 0.5 : 1),      // Much lighter for instant entrance
      tension: shouldFall ? 20 : (hasEntered ? 120 : 80),   // Much higher tension for quick entrance
      friction: shouldFall ? 30 : (hasEntered ? 12 : 15), // Lower friction for faster motion
      delay: shouldFall ? (fallDelay * 1) : (hasEntered ? 0 : 0)  // No delay for entrance when already entered
    }
  });

  // Separate rotation animation with its own delay
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
      mass: shouldFall ? 5 : (hasEntered ? 0.5 : 2),  // Much lighter for instant rotation
      tension: shouldFall ? 25 : (hasEntered ? 100 : 50),  // Higher tension for faster response
      friction: shouldFall ? 28 : (hasEntered ? 12 : 18),  // Lower friction for faster motion
      delay: shouldFall ? (rotationStartDelay * 0.7) : (hasEntered ? 0 : 0)  // No delay for entrance
    }
  });

  // LOD - viewport dışındaki telefonları optimize et
  // During entrance animation, always render the phone (no culling)
  const isInViewport = !hasEntered || Math.abs(position[1]) < 10;  // No culling during entrance
  
  // Don't play videos on non-selected phones when one is selected
  // Videos only play when near camera, not during initial load
  const isNearCamera = Math.abs(position[1]) < 6 && !shouldFall;   // Stop playing when falling

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
      {isInViewport ? (
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[0.75, 1.6, 0.08]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
        }>
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

export default AnimatedPhone;