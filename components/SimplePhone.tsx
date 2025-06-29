import React, { useRef, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

interface SimplePhoneProps {
  videoSrc: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
}

const SimplePhone: React.FC<SimplePhoneProps> = ({ 
  videoSrc, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = 1,
  onClick
}) => {
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
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    
    video.addEventListener('loadeddata', () => {
      video.play().catch(e => console.log('Video play error:', e));
    });
    
    videoRef.current = video;
    
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.generateMipmaps = false;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    return texture;
  }, [videoSrc]);

  return (
    <group 
      position={position} 
      rotation={rotation} 
      scale={scale}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Phone body - Simple minimal frame */}
      <RoundedBox
        args={[0.78, 1.65, 0.06]}
        radius={0.06}
        smoothness={4}
      >
        <meshStandardMaterial 
          color="#000000" 
          metalness={0.3}
          roughness={0.7}
        />
      </RoundedBox>

      {/* Screen - Full size, no bezels */}
      <mesh position={[0, 0, 0.031]}>
        <planeGeometry args={[0.74, 1.58]} />
        <meshBasicMaterial 
          map={videoTexture} 
          toneMapped={false}
        />
      </mesh>

      {/* Subtle screen edge */}
      <RoundedBox
        args={[0.745, 1.585, 0.001]}
        radius={0.04}
        smoothness={4}
        position={[0, 0, 0.0305]}
      >
        <meshStandardMaterial 
          color="#111111"
          metalness={0.8}
          roughness={0.2}
        />
      </RoundedBox>
    </group>
  );
};

export default SimplePhone;