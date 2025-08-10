import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { animated, useSpring } from '@react-spring/three';
import * as THREE from 'three';
import IPhone3DLoading from './IPhone3DLoading';

interface LoadingPhoneProps {
  progress: number;
  isClosing?: boolean;
}

const LoadingPhone: React.FC<LoadingPhoneProps> = ({ progress, isClosing = false }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Exactly match AnimatedPhone's selected state behavior
  const { posX, posY, posZ, rotX, rotY, rotZ } = useSpring({
    // Position animation (match AnimatedPhone selected state)
    posX: 4.4,        // Always at selected position X
    posY: -1,         // Always at selected position Y  
    posZ: 6,          // Always at selected position Z
    // Rotation animation (match AnimatedPhone selected state)
    rotX: Math.PI / 4,       // 45 degrees forward tilt (selected state)
    rotY: Math.PI * 2.3,     // Rotation for selected state
    rotZ: 0,
    config: {
      mass: 3,
      tension: 40,
      friction: 30
    }
  });
  
  
  return (
    <animated.group 
      ref={groupRef}
      position-x={posX}
      position-y={posY}
      position-z={posZ}
      rotation-x={rotX}
      rotation-y={rotY}
      rotation-z={rotZ}
    >
      <Suspense fallback={
        <mesh>
          <boxGeometry args={[0.75, 1.6, 0.08]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
      }>
        {/* Use IPhone3DLoading with loading progress display */}
        <IPhone3DLoading
          progress={progress}
          rotation={[0, 0, 0]}
        />
      </Suspense>
    </animated.group>
  );
};

export default LoadingPhone;