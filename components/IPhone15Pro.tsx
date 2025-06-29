import React, { useRef, useMemo } from 'react';
import { RoundedBox, Box } from '@react-three/drei';
import * as THREE from 'three';

interface IPhone15ProProps {
  videoSrc: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
}

const IPhone15Pro: React.FC<IPhone15ProProps> = ({ 
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
    
    // Video yüklendiğinde başlat
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
      {/* Main body - Titanium frame */}
      <RoundedBox
        args={[0.7706, 1.6095, 0.0825]} // iPhone 15 Pro dimensions
        radius={0.065}
        smoothness={8}
        position={[0, 0, 0]}
      >
        <meshPhysicalMaterial
          color="#4a4a4a"
          metalness={0.95}
          roughness={0.15}
          clearcoat={0.5}
          clearcoatRoughness={0.2}
          reflectivity={0.9}
        />
      </RoundedBox>

      {/* Screen bezel */}
      <Box args={[0.7306, 1.5695, 0.001]} position={[0, 0, 0.0415]}>
        <meshStandardMaterial color="#000000" />
      </Box>

      {/* Screen - slightly recessed */}
      <mesh position={[0, -0.025, 0.05]}>
        <planeGeometry args={[0.7, 1.5, 1, 1]} />
        <meshBasicMaterial 
          map={videoTexture} 
          toneMapped={false}
          side={THREE.FrontSide}
          depthWrite={true}
          depthTest={true}
        />
      </mesh>



      {/* Camera module background */}
      <RoundedBox
        args={[0.32, 0.32, 0.025]}
        radius={0.08}
        smoothness={8}
        position={[-0.19, 0.55, -0.045]}
      >
        <meshPhysicalMaterial
          color="#2a2a2a"
          metalness={0.9}
          roughness={0.3}
          clearcoat={0.8}
        />
      </RoundedBox>

      {/* Main camera (larger) */}
      <group position={[-0.19, 0.58, -0.048]}>
        <mesh>
          <cylinderGeometry args={[0.048, 0.048, 0.012, 32]} />
          <meshPhysicalMaterial color="#1a1a1a" metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.006]}>
          <cylinderGeometry args={[0.038, 0.038, 0.004, 32]} />
          <meshPhysicalMaterial color="#0a0a0a" metalness={0.9} roughness={0.05} />
        </mesh>
        <mesh position={[0, 0, 0.008]}>
          <cylinderGeometry args={[0.028, 0.028, 0.001, 32]} />
          <meshPhysicalMaterial 
            color="#000033" 
            metalness={0.5} 
            roughness={0} 
            transparent 
            opacity={0.8}
          />
        </mesh>
      </group>

      {/* Ultra wide camera */}
      <group position={[-0.25, 0.47, -0.048]}>
        <mesh>
          <cylinderGeometry args={[0.035, 0.035, 0.01, 32]} />
          <meshPhysicalMaterial color="#1a1a1a" metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <cylinderGeometry args={[0.025, 0.025, 0.003, 32]} />
          <meshPhysicalMaterial color="#0a0a0a" metalness={0.9} roughness={0.05} />
        </mesh>
      </group>

      {/* Telephoto camera */}
      <group position={[-0.13, 0.47, -0.048]}>
        <mesh>
          <cylinderGeometry args={[0.035, 0.035, 0.01, 32]} />
          <meshPhysicalMaterial color="#1a1a1a" metalness={0.95} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <cylinderGeometry args={[0.025, 0.025, 0.003, 32]} />
          <meshPhysicalMaterial color="#0a0a0a" metalness={0.9} roughness={0.05} />
        </mesh>
      </group>

      {/* LiDAR scanner */}
      <mesh position={[-0.19, 0.47, -0.048]}>
        <cylinderGeometry args={[0.018, 0.018, 0.008, 32]} />
        <meshStandardMaterial color="#050505" metalness={0.8} />
      </mesh>

      {/* Flash */}
      <mesh position={[-0.25, 0.58, -0.048]}>
        <cylinderGeometry args={[0.02, 0.02, 0.008, 32]} />
        <meshPhysicalMaterial color="#f0f0f0" metalness={0.3} roughness={0.2} />
      </mesh>

      {/* Action button (left side) */}
      <Box args={[0.003, 0.08, 0.025]} position={[-0.39, 0.35, 0]}>
        <meshPhysicalMaterial
          color="#ff6b35"
          metalness={0.8}
          roughness={0.3}
        />
      </Box>

      {/* Volume buttons */}
      <Box args={[0.003, 0.06, 0.02]} position={[-0.39, 0.15, 0]}>
        <meshPhysicalMaterial color="#3a3a3a" metalness={0.9} roughness={0.3} />
      </Box>
      <Box args={[0.003, 0.06, 0.02]} position={[-0.39, 0.05, 0]}>
        <meshPhysicalMaterial color="#3a3a3a" metalness={0.9} roughness={0.3} />
      </Box>

      {/* Power button */}
      <Box args={[0.003, 0.1, 0.025]} position={[0.39, 0.2, 0]}>
        <meshPhysicalMaterial color="#3a3a3a" metalness={0.9} roughness={0.3} />
      </Box>

      {/* USB-C port */}
      <Box args={[0.04, 0.008, 0.02]} position={[0, -0.81, 0]}>
        <meshStandardMaterial color="#1a1a1a" />
      </Box>

      {/* Speakers */}
      {[...Array(6)].map((_, i) => (
        <mesh key={`speaker-${i}`} position={[(i - 2.5) * 0.008, -0.81, 0.04]}>
          <cylinderGeometry args={[0.002, 0.002, 0.01, 16]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      ))}
    </group>
  );
};

export default IPhone15Pro;