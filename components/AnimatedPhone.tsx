import React, { Suspense } from 'react';
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
  
  // Kamera FOV'u 8 derece ve rotation'ı dikkate alarak telefonu viewport'ta tut
  const targetPosition = isSelected ? {
    x: 4.4,       // Kamera rotation'ı nedeniyle sağa kaydır
    y: -1,      // Kamera rotation'ı ve FOV için aşağıda tut
    z: 6      // Kameraya yakın ama tamamı görünecek mesafede
  } : shouldFall ? {
    x: position[0],
    y: position[1],      // Keep same height
    z: position[2] - 50  // Move far back behind the scene
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
    x: Math.PI * 0.2,    // Slight forward tilt
    y: Math.PI * 2,      // Full 360 rotation while falling
    z: Math.PI * 0.1     // Slight side rotation
  } : {
    x: 0,
    y: 0,
    z: 0
  };
  
  // Yavaş ve yumuşak animasyon
  const { posX, posY, posZ, rotX, rotY, rotZ, scale, opacity } = useSpring({
    posX: targetPosition.x,
    posY: targetPosition.y,
    posZ: targetPosition.z,
    rotX: targetRotation.x,
    rotY: targetRotation.y,
    rotZ: targetRotation.z,
    scale: shouldFall ? 0.7 : 1,  // Shrink when moving back
    opacity: shouldFall ? 0 : 1,  // Fade out when moving back
    config: { 
      mass: shouldFall ? 2 : 3,      // Medium mass for smooth backward motion
      tension: shouldFall ? 50 : 40,  // Medium tension for controlled movement
      friction: shouldFall ? 25 : 30,  // Medium friction for smooth stop
      delay: shouldFall ? fallDelay : 0  // Sequential delay for falling
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