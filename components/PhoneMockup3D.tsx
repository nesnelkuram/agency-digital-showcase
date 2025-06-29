import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';

interface PhoneMockup3DProps {
  videoSrc: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

const PhoneMockup3D: React.FC<PhoneMockup3DProps> = ({ 
  videoSrc, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = 1 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Create video texture
  const videoTexture = useMemo(() => {
    const video = document.createElement('video');
    video.src = videoSrc;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.play();
    
    videoRef.current = video;
    
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBFormat;
    
    return texture;
  }, [videoSrc]);

  // Subtle animation
  // Remove animation for better performance with many phones
  // useFrame((state) => {
  //   if (meshRef.current) {
  //     meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.05 + rotation[1];
  //   }
  // });

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Phone body */}
      <RoundedBox
        ref={meshRef}
        args={[0.75, 1.6, 0.08]} // Width, Height, Depth - iPhone proportions
        radius={0.08}
        smoothness={4}
      >
        <meshPhysicalMaterial
          color="#1a1a1a"
          metalness={0.8}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </RoundedBox>

      {/* Screen */}
      <mesh position={[0, 0, 0.041]}>
        <planeGeometry args={[0.65, 1.42]} />
        <meshBasicMaterial map={videoTexture} />
      </mesh>

      {/* Screen glass overlay */}
      <mesh position={[0, 0, 0.042]}>
        <planeGeometry args={[0.65, 1.42]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.1}
          metalness={0}
          roughness={0}
          clearcoat={1}
          clearcoatRoughness={0}
        />
      </mesh>

      {/* Dynamic Island */}
      <mesh position={[0, 0.62, 0.042]}>
        <RoundedBox args={[0.25, 0.08, 0.01]} radius={0.04} smoothness={4}>
          <meshStandardMaterial color="#000000" />
        </RoundedBox>
      </mesh>

      {/* Side buttons */}
      <mesh position={[-0.39, 0.3, 0]}>
        <boxGeometry args={[0.015, 0.1, 0.04]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-0.39, 0.1, 0]}>
        <boxGeometry args={[0.015, 0.15, 0.04]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.39, 0.2, 0]}>
        <boxGeometry args={[0.015, 0.2, 0.04]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Camera bump */}
      <mesh position={[-0.15, 0.5, -0.045]}>
        <cylinderGeometry args={[0.08, 0.08, 0.015, 32]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
};

export default PhoneMockup3D;