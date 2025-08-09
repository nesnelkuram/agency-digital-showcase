import React, { useRef, Suspense, useState } from 'react';
import { animated, useSpring } from '@react-spring/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import ModernPhone from './ModernPhone';
import IPhone3D from './IPhone3D';

interface AnimatedPhoneProps {
  videoSrc: string;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
}

const AnimatedPhone: React.FC<AnimatedPhoneProps> = ({ 
  videoSrc, 
  position, 
  isSelected, 
  onClick 
}) => {
  const { camera } = useThree();
  const [isHovered, setIsHovered] = useState(false);
  
  // Kamera pozisyonu [16, -10, 20] ve rotation [0.5, 0.7, 0.4]
  const cameraPosition = new THREE.Vector3(16, -10, 20);
  const cameraRotation = new THREE.Euler(0.5, 0.7, 0.4);
  
  // Kamera FOV'u 8 derece ve rotation'ı dikkate alarak telefonu viewport'ta tut
  const targetPosition = isSelected ? {
    x: -1,       // Kamera rotation'ı nedeniyle sağa kaydır
    y: 0.1,      // Kamera rotation'ı ve FOV için aşağıda tut
    z: 1.4      // Kameraya yakın ama tamamı görünecek mesafede
  } : {
    x: position[0],
    y: position[1] + (isHovered ? 0.15 : 0), // Hover'da hafif yukarı çık
    z: position[2] + (isHovered ? 0.1 : 0)   // Hover'da hafif öne çık
  };
  
  // Telefon kameraya tam karşıdan baksın
  const phonePos = new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z);
  const lookAtDirection = cameraPosition.clone().sub(phonePos);
  const phoneToCamera = Math.atan2(lookAtDirection.x, lookAtDirection.z);
  
  // X ekseni: Üstten öne doğru eğilme
  // Y ekseni: Soldan sağa dönüş
  const targetRotation = isSelected ? {
    x: Math.PI / 3,      // 30 derece öne eğilme
    y: Math.PI * 2.3,      // 360 derece Y ekseninde dönüş
    z: 0
  } : {
    x: 0,
    y: 0,
    z: 0
  };
  
  // Yavaş ve yumuşak animasyon
  const { posX, posY, posZ, rotX, rotY, rotZ, scale } = useSpring({
    posX: targetPosition.x,
    posY: targetPosition.y,
    posZ: targetPosition.z,
    rotX: targetRotation.x,
    rotY: targetRotation.y,
    rotZ: targetRotation.z,
    scale: isHovered ? 1.02 : 1,  // Hover'da çok hafif büyüt
    config: isHovered ? {
      mass: 1,      // Hover için daha hızlı
      tension: 180,  
      friction: 20
    } : { 
      mass: 3,      // Normal animasyon için yavaş
      tension: 40,  
      friction: 30
    }
  });

  // LOD - viewport dışındaki telefonları optimize et
  const isInViewport = Math.abs(position[1]) < 10;  // Daha agresif culling

  return (
    <animated.group 
      position-x={posX}
      position-y={posY}
      position-z={posZ}
      rotation-x={rotX}
      rotation-y={rotY}
      rotation-z={rotZ}
      scale={scale}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
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
          />
        </Suspense>
      ) : (
        // Basit placeholder viewport dışı için
        <mesh>
          <boxGeometry args={[0.75, 1.6, 0.08]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
      )}
    </animated.group>
  );
};

export default AnimatedPhone;