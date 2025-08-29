import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SimplifiedPhoneProps {
  videoSrc: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
  quality?: 'low' | 'medium' | 'high';
}

const SimplifiedPhone: React.FC<SimplifiedPhoneProps> = ({
  videoSrc,
  position,
  rotation = [0, 0, 0],
  isSelected,
  onClick,
  quality = 'medium'
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [videoTexture, setVideoTexture] = useState<THREE.Texture | null>(null);
  const [isInView, setIsInView] = useState(false);
  
  // Simple box geometry instead of complex GLTF model
  const geometry = React.useMemo(() => {
    return new THREE.BoxGeometry(0.7, 1.4, 0.05, 1, 1, 1);
  }, []);
  
  // Optimized material
  const material = React.useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#1a1a1a',
      side: THREE.FrontSide
    });
  }, []);
  
  // Check if phone is in viewport
  useFrame(({ camera }) => {
    if (!meshRef.current) return;
    
    const distance = meshRef.current.position.distanceTo(camera.position);
    const newInView = distance < 20; // Only load video if close enough
    
    if (newInView !== isInView) {
      setIsInView(newInView);
    }
  });
  
  // Load video texture only when in view
  useEffect(() => {
    if (!isInView || !videoSrc) {
      // Clean up texture when not in view
      if (videoTexture) {
        videoTexture.dispose();
        setVideoTexture(null);
      }
      return;
    }
    
    // Create optimized video element
    const video = document.createElement('video');
    video.src = videoSrc;
    
    // Set quality based on prop
    const dimensions = {
      low: { width: 320, height: 180 },
      medium: { width: 640, height: 360 },
      high: { width: 960, height: 540 }
    };
    
    const { width, height } = dimensions[quality];
    video.width = width;
    video.height = height;
    
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    // Only play if selected or autoplay is allowed
    if (isSelected) {
      video.play().catch(() => {});
    }
    
    // Create optimized texture
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.format = THREE.RGBFormat;
    
    setVideoTexture(texture);
    
    return () => {
      video.pause();
      video.src = '';
      texture.dispose();
    };
  }, [isInView, videoSrc, isSelected, quality]);
  
  // Animate selection
  useFrame(() => {
    if (!meshRef.current) return;
    
    if (isSelected) {
      // Smooth transition to selected position
      meshRef.current.position.lerp(
        new THREE.Vector3(3.4, -2, 5),
        0.1
      );
      meshRef.current.scale.lerp(
        new THREE.Vector3(1.2, 1.2, 1.2),
        0.1
      );
    } else {
      // Return to original position
      meshRef.current.position.lerp(
        new THREE.Vector3(...position),
        0.1
      );
      meshRef.current.scale.lerp(
        new THREE.Vector3(1, 1, 1),
        0.1
      );
    }
  });
  
  return (
    <group>
      {/* Phone body */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        position={position}
        rotation={rotation}
        onClick={onClick}
        castShadow={false}
        receiveShadow={false}
      >
        {/* Screen - only render if video is loaded */}
        {videoTexture && (
          <mesh position={[0, 0, 0.026]}>
            <planeGeometry args={[0.65, 1.3]} />
            <meshBasicMaterial map={videoTexture} />
          </mesh>
        )}
      </mesh>
      
      {/* Simple frame */}
      <mesh position={position}>
        <boxGeometry args={[0.72, 1.42, 0.06]} />
        <meshBasicMaterial color="#e5e5e7" />
      </mesh>
    </group>
  );
};

export default SimplifiedPhone;