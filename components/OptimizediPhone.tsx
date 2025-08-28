import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Global cache for materials and geometries
const materialCache = new Map<string, THREE.Material>();
const geometryCache = new Map<string, THREE.BufferGeometry>();
let sharedScene: THREE.Group | null = null;

interface OptimizediPhoneProps {
  videoSrc: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
  isNearCamera?: boolean;
  isSelected?: boolean;
  enableSound?: boolean;
  isLoading?: boolean;
}

const OptimizediPhone: React.FC<OptimizediPhoneProps> = ({ 
  videoSrc, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
  isNearCamera = true,
  isSelected = false,
  enableSound = false,
  isLoading = false
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  
  // Load model once and share it
  const { scene } = useGLTF('/models/iphone_14_pro_max/scene.gltf') as any;
  
  // Use shared scene or create one
  const phoneGroup = useMemo(() => {
    if (!sharedScene) {
      sharedScene = scene.clone();
      
      // Optimize the model once
      const box = new THREE.Box3().setFromObject(sharedScene);
      const center = box.getCenter(new THREE.Vector3());
      sharedScene.position.sub(center);
      sharedScene.rotation.set(0, Math.PI, 0);
      
      // Cache all materials
      sharedScene.traverse((child: any) => {
        if (child.isMesh) {
          const meshName = child.name.toLowerCase();
          
          // Cache geometry
          if (child.geometry && !geometryCache.has(meshName)) {
            geometryCache.set(meshName, child.geometry);
          }
          
          // Create and cache optimized materials
          if (meshName.includes('screen')) {
            // Screen material - will be updated with video
            if (!materialCache.has('screen')) {
              const mat = new THREE.MeshBasicMaterial({
                color: '#000000',
                side: THREE.FrontSide
              });
              materialCache.set('screen', mat);
            }
            child.material = materialCache.get('screen');
          } else if (meshName.includes('frame') || meshName.includes('body')) {
            // Frame material
            if (!materialCache.has('frame')) {
              const mat = new THREE.MeshBasicMaterial({
                color: '#e5e5e7',
                metalness: 0.95,
                roughness: 0.05
              });
              materialCache.set('frame', mat);
            }
            child.material = materialCache.get('frame');
          } else {
            // Default material
            if (!materialCache.has('default')) {
              const mat = new THREE.MeshBasicMaterial({
                color: '#1a1a1a'
              });
              materialCache.set('default', mat);
            }
            child.material = materialCache.get('default');
          }
        }
      });
    }
    
    // Return a lightweight reference
    return sharedScene.clone(false); // Shallow clone - shares geometry and materials
  }, [scene]);
  
  // Handle video on hover/select only
  useEffect(() => {
    // Only show video when selected or hovered
    const shouldShowVideo = isSelected || (isNearCamera && showVideo);
    
    if (shouldShowVideo && videoSrc) {
      // Create simple thumbnail instead of video for performance
      const canvas = document.createElement('canvas');
      canvas.width = 256; // Lower resolution
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 256, 512);
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Video', 128, 256);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      setVideoTexture(texture);
      
      // Update screen material
      phoneGroup.traverse((child: any) => {
        if (child.isMesh && child.name.toLowerCase().includes('screen')) {
          child.material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.FrontSide
          });
        }
      });
    } else {
      // Reset to black screen
      if (videoTexture) {
        videoTexture.dispose();
        setVideoTexture(null);
      }
      
      phoneGroup.traverse((child: any) => {
        if (child.isMesh && child.name.toLowerCase().includes('screen')) {
          child.material = materialCache.get('screen');
        }
      });
    }
    
    return () => {
      if (videoTexture) {
        videoTexture.dispose();
      }
    };
  }, [isSelected, showVideo, videoSrc, phoneGroup, isNearCamera]);
  
  // Handle mouse events for hover video
  const handlePointerEnter = () => {
    if (!isSelected) {
      setShowVideo(true);
    }
  };
  
  const handlePointerLeave = () => {
    if (!isSelected) {
      setShowVideo(false);
    }
  };
  
  // Calculate scale
  const calculatedScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(phoneGroup);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 1.8;
    const scaleValue = targetSize / maxDim;
    return scaleValue * scale;
  }, [phoneGroup, scale]);

  return (
    <group 
      ref={groupRef}
      position={position} 
      rotation={rotation}
      onClick={onClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <primitive 
        object={phoneGroup} 
        scale={calculatedScale}
      />
    </group>
  );
};

// Cleanup function for when all phones are removed
export const cleanupOptimizediPhoneCache = () => {
  materialCache.forEach(material => material.dispose());
  materialCache.clear();
  geometryCache.clear();
  sharedScene = null;
};

// Preload the model once
useGLTF.preload('/models/iphone_14_pro_max/scene.gltf');

export default OptimizediPhone;