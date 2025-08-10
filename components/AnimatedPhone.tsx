import React, { Suspense, useMemo, useState, useEffect } from 'react';
import { animated, useSpring } from '@react-spring/three';
import IPhone3D from './IPhone3D';

interface AnimatedPhoneProps {
  videoSrc: string;
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
  position, 
  isSelected, 
  onClick,
  shouldFall = false,
  fallDelay = 0,
  hasEntered = false,
  entranceDelay = 0
}) => {
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
    z: position[2] - 60  // Move backward away from camera
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
      mass: shouldFall ? 10 : (hasEntered ? 1.5 : 5),      // Smooth entrance
      tension: shouldFall ? 8 : (hasEntered ? 40 : 20),   // Normal speed
      friction: shouldFall ? 35 : (hasEntered ? 22 : 25), // Normal resistance
      delay: shouldFall ? (fallDelay * 2) : (hasEntered ? entranceDelay : 0)  // Staggered entrance
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
      mass: shouldFall ? 4 : (hasEntered ? 3 : 4),
      tension: shouldFall ? 20 : (hasEntered ? 25 : 20),
      friction: shouldFall ? 25 : (hasEntered ? 22 : 25),
      delay: shouldFall ? rotationStartDelay : (hasEntered ? entranceDelay + 100 : 0)  // Slight delay for rotation
    }
  });

  // LOD - viewport dışındaki telefonları optimize et
  // During entrance animation, always render the phone (no culling)
  const isInViewport = !hasEntered || Math.abs(position[1]) < 10;  // No culling during entrance
  // All videos play initially for 3 seconds, then based on viewport
  const [forcePlay, setForcePlay] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setForcePlay(false), 3000);
    return () => clearTimeout(timer);
  }, []);
  const isNearCamera = forcePlay || Math.abs(position[1]) < 6;   // Force play initially, then viewport-based

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
            videoSrc={videoSrc}
            rotation={[0, 0, 0]}
            onClick={onClick}
            isNearCamera={isNearCamera}
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