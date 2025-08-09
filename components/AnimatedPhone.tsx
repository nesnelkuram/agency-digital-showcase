import React, { Suspense, useMemo } from 'react';
import { animated, useSpring } from '@react-spring/three';
import IPhone3D from './IPhone3D';

interface AnimatedPhoneProps {
  videoSrc: string;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
  shouldFall?: boolean;
  fallDelay?: number;
}

const AnimatedPhone: React.FC<AnimatedPhoneProps> = ({ 
  videoSrc, 
  position, 
  isSelected, 
  onClick,
  shouldFall = false,
  fallDelay = 0
}) => {
  // Generate random delays and rotation direction (only calculated once)
  const rotationStartDelay = useMemo(() => Math.random() * 2000 + 200, []); // 200-2200ms random delay
  const rotationDirection = useMemo(() => Math.random() > 0.5 ? 1 : -1, []); // Random rotation direction
  
  // Kamera FOV'u 8 derece ve rotation'ı dikkate alarak telefonu viewport'ta tut
  const targetPosition = isSelected ? {
    x: 4.4,       // Kamera rotation'ı nedeniyle sağa kaydır
    y: -1,      // Kamera rotation'ı ve FOV için aşağıda tut
    z: 6      // Kameraya yakın ama tamamı görünecek mesafede
  } : shouldFall ? {
    x: position[0],
    y: position[1],  // Keep same height
    z: position[2] - 60  // Move backward away from camera
  } : {
    x: position[0],
    y: position[1],
    z: position[2]
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
  } : {
    x: 0,
    y: 0,
    z: 0
  };
  
  // Yavaş ve yumuşak animasyon - position ve rotation ayrı
  const { posX, posY, posZ, scale, opacity } = useSpring({
    posX: targetPosition.x,
    posY: targetPosition.y,
    posZ: targetPosition.z,
    scale: shouldFall ? 0.8 : 1,  // Slight shrink when moving back
    opacity: shouldFall ? 0 : 1,  // Fade out when moving back
    config: { 
      mass: shouldFall ? 10 : 3,      // Heavy for slow initial movement
      tension: shouldFall ? 8 : 40,   // Low tension for slow start
      friction: shouldFall ? 35 : 30, // High friction
      delay: shouldFall ? (fallDelay * 2) : 0  // Staggered position movement
    }
  });

  // Separate rotation animation with its own delay
  const { rotX, rotY, rotZ } = useSpring({
    rotX: targetRotation.x,
    rotY: targetRotation.y,
    rotZ: targetRotation.z,
    config: { 
      mass: 4,
      tension: 20,
      friction: 25,
      delay: shouldFall ? rotationStartDelay : 0  // Random delay for rotation only
    }
  });

  // LOD - viewport dışındaki telefonları optimize et
  const isInViewport = Math.abs(position[1]) < 10;  // Daha agresif culling
  const isNearCamera = Math.abs(position[1]) < 5;   // Yakın telefonlar için video oynat

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
        // Basit placeholder viewport dışı için
        <mesh>
          <boxGeometry args={[0.75, 1.6, 9]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
      )}
    </animated.group>
  );
};

export default AnimatedPhone;