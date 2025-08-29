import React, { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface IPhone3DProps {
  videoSrc: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
  isSelected?: boolean;
}

const IPhone3D: React.FC<IPhone3DProps> = ({ 
  videoSrc,
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
  isSelected = false
}) => {
  // Load iPhone model
  const { scene } = useGLTF('/models/iphone_14_pro_max/scene.gltf') as any;
  
  // Clone the scene to avoid modifying the original
  const clonedScene = useMemo(() => {
    const cloned = scene.clone();
    
    // Center the model
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.sub(center);
    
    // Rotate 180 degrees around Y axis to show front
    cloned.rotation.set(0, Math.PI, 0);
    
    return cloned;
  }, [scene]);

  // Store video element reference
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Find and update the screen mesh with video
  useEffect(() => {
    if (!videoSrc) return;

    // Find the screen mesh
    let screenMesh: any = null;
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        const meshName = child.name.toLowerCase();
        if (meshName.includes('screen') || 
            meshName.includes('display') ||
            meshName === 'object_13') {
          screenMesh = child;
        }
      }
    });

    if (!screenMesh) {
      console.warn('[IPhone3D] Could not find screen mesh');
      return;
    }

    // Create or reuse video element
    let video = videoRef.current;
    if (!video) {
      video = document.createElement('video');
      videoRef.current = video;
    }

    // Set video properties
    video.src = videoSrc;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.preload = 'auto';

    // Try to play the video
    video.play().catch(err => {
      console.warn('[IPhone3D] Video autoplay failed:', err);
    });

    // Create video texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.generateMipmaps = false;
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    
    // Flip horizontally for correct orientation
    videoTexture.repeat.set(-1, 1);
    videoTexture.offset.set(1, 0);

    // Apply video texture to screen
    screenMesh.material = new THREE.MeshBasicMaterial({
      map: videoTexture,
      toneMapped: false,
      side: THREE.FrontSide
    });

    console.log('[IPhone3D] Video applied:', videoSrc.substring(videoSrc.lastIndexOf('/') + 1));

    // Cleanup
    return () => {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [videoSrc, clonedScene]);

  // Style the phone frame
  useEffect(() => {
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        const meshName = child.name.toLowerCase();
        
        // Style the frame
        if (meshName.includes('frame') || 
            meshName.includes('body') ||
            meshName.includes('case')) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#e5e5e7',
            metalness: 0.95,
            roughness: 0.05,
          });
        }
        
        // Style buttons
        if (meshName.includes('button') || 
            meshName.includes('volume') || 
            meshName.includes('power')) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#c7c7c9',
            metalness: 0.9,
            roughness: 0.1,
          });
        }
      }
    });
  }, [clonedScene]);

  return (
    <group 
      position={position} 
      rotation={rotation} 
      scale={scale}
      onClick={onClick}
    >
      <primitive object={clonedScene} />
    </group>
  );
};

// Preload the model
useGLTF.preload('/models/iphone_14_pro_max/scene.gltf');

export default IPhone3D;