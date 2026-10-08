import React, { Suspense, useMemo, memo } from 'react';
import { animated, useSpring } from '@react-spring/three';
import { useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { PerspectiveCamera } from 'three';
import IPhone3D from './IPhone3D';
import { getPhonePresentation } from '../utils/phonePresentation';

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
  parentScale?: number;
  reducedMotion?: boolean;
  /** Controlled by usePlaybackOrchestrator — when false, video is paused to save decoder slots */
  playbackAllowed?: boolean;
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
  parentScale = 1,
  reducedMotion = false,
  playbackAllowed = true
}) => {
  const { camera, size, invalidate } = useThree();
  const presentation = getPhonePresentation(camera as PerspectiveCamera, size.width, size.height, parentScale, isMobile);
  // Generate random delays and rotation direction (only calculated once)
  const rotationStartDelay = useMemo(() => Math.random() * 2000 + 200, []); // 200-2200ms random delay
  const rotationDirection = useMemo(() => Math.random() > 0.5 ? 1 : -1, []); // Random rotation direction
  
  // Initial position for entrance animation (phones start very close)
  const initialPosition = hasEntered ? position : [position[0], position[1] - 0.5, position[2] - 3];
  
  const targetPosition = isSelected ? presentation.position : shouldFall ? {
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
    ...presentation.rotation,
    // Make one complete turn before settling square to the camera. Adding a
    // full revolution preserves the final upright orientation on every screen.
    y: presentation.rotation.y + Math.PI * 2,
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
    scale: isSelected ? presentation.scale : shouldFall ? 0.8 : (hasEntered ? mobileScale : 0.5),
    config: positionConfig,
    immediate: reducedMotion,
    onChange: () => invalidate(),
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
    config: rotationConfig,
    immediate: reducedMotion,
    onChange: () => invalidate(),
  });

  // LOD - viewport dışındaki telefonları optimize et
  // During entrance animation, always render the phone (no culling)
  const isInViewport = isSelected || !hasEntered || Math.abs(position[1]) < 10;

  // Don't play videos on non-selected phones when one is selected
  // Videos only play when near camera, not during initial load
  const isNearCamera = isSelected || (Math.abs(position[1]) < 6 && !shouldFall);

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
              key={videoSrc}  // Stable — selection swaps the texture in-place, no remount
              videoSrc={videoSrc}  // Always the preview: instant, already cached
              fullVideoSrc={fullVideoSrc}  // Streams in on select, then swaps seamlessly
              rotation={[0, 0, 0]}
              onClick={onClick}
              isNearCamera={isNearCamera}
              isSelected={isSelected}
              enableSound={isSelected}  // Only enable sound when selected
              playbackAllowed={playbackAllowed || isSelected}  // Selected phone always plays
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
