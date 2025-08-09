import React, { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface IPhone3DProps {
  videoSrc: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
  isNearCamera?: boolean;
}

const IPhone3D: React.FC<IPhone3DProps> = ({ 
  videoSrc, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
  isNearCamera = true
}) => {
  // Load iPhone model
  const { scene } = useGLTF('/models/iphone_14_pro_max/scene.gltf') as any;
  
  // Store video element reference for aspect ratio
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // Create texture - handle both images and videos
  const imageTexture = useMemo(() => {
    // Check if it's a video file
    if (videoSrc.endsWith('.webm') || videoSrc.endsWith('.mp4')) {
      const video = document.createElement('video');
      video.src = videoSrc;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      
      // Store video reference
      videoRef.current = video;
      
      // Only play if near camera
      if (isNearCamera) {
        video.play().catch(err => {
          console.warn('Video autoplay failed:', err);
        });
      } else {
        video.pause();
      }
      
      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    } else {
      // Regular image
      const texture = new THREE.TextureLoader().load(videoSrc);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }
  }, [videoSrc]);

  // Clone the scene to avoid modifying the original
  const clonedScene = useMemo(() => {
    const cloned = scene.clone();
    
    // First, let's find the bounding box to understand the model size
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    console.log('Original model size:', size);
    console.log('Original model center:', center);
    
    // Center the model
    cloned.position.sub(center);
    
    // Rotate 180 degrees around Y axis to show front
    cloned.rotation.set(0, Math.PI, 0);
    
    return cloned;
  }, [scene]);

  // Find and update materials
  useEffect(() => {
    // First, let's analyze the model structure
    console.log('=== ANALYZING iPHONE MODEL ===');
    let meshCount = 0;
    let texturedMeshes: any[] = [];
    
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        meshCount++;
        console.log(`[${meshCount}] Mesh: ${child.name}`);
        console.log(`  - Material: ${child.material?.name || 'unnamed'}`);
        console.log(`  - Position:`, child.position);
        
        // Check all texture types
        if (child.material) {
          const textures = [];
          if (child.material.map) textures.push('map');
          if (child.material.emissiveMap) textures.push('emissiveMap');
          if (child.material.normalMap) textures.push('normalMap');
          if (child.material.roughnessMap) textures.push('roughnessMap');
          if (child.material.metalnessMap) textures.push('metalnessMap');
          
          if (textures.length > 0) {
            console.log(`  - Textures: ${textures.join(', ')}`);
            texturedMeshes.push({
              mesh: child,
              name: child.name,
              materialName: child.material.name,
              textures: textures
            });
          }
        }
      }
    });
    
    console.log(`\nTotal meshes: ${meshCount}`);
    console.log(`Textured meshes: ${texturedMeshes.length}`);
    
    // Now find the screen mesh - usually it's the one with emissiveMap or specific name
    let screenMesh = null;
    
    // Strategy 1: Find by emissive map (screens often glow)
    screenMesh = texturedMeshes.find(item => 
      item.textures.includes('emissiveMap') || 
      item.textures.includes('map') && item.name.toLowerCase().includes('screen')
    );
    
    // Strategy 2: If not found, find the front-most textured mesh
    if (!screenMesh && texturedMeshes.length > 0) {
      // iPhone screens are usually at Z position close to max
      screenMesh = texturedMeshes.reduce((prev, curr) => {
        return curr.mesh.position.z > prev.mesh.position.z ? curr : prev;
      });
    }
    
    // Apply video to the found screen mesh
    if (screenMesh) {
      console.log(`\n✓ FOUND SCREEN: ${screenMesh.name}`);
      const mesh = screenMesh.mesh;
      
      // Don't clone video textures - use directly
      // Simple horizontal flip for correct orientation
      imageTexture.repeat.set(-1, 1);
      imageTexture.offset.set(1, 0);
      
      // Set proper texture settings
      imageTexture.wrapS = THREE.ClampToEdgeWrapping;
      imageTexture.wrapT = THREE.ClampToEdgeWrapping;
      imageTexture.needsUpdate = true;
      
      // Create new material with video texture
      mesh.material = new THREE.MeshBasicMaterial({
        map: imageTexture,
        toneMapped: false
      });
      
      console.log('✓ Applied video texture with correct aspect ratio');
    } else {
      console.log('\n❌ Could not find screen mesh!');
    }
        
    // Also style the frame
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        const meshName = child.name.toLowerCase();
        
        // Make the frame silver like ModernPhone
        if (meshName.includes('frame') || 
            meshName.includes('body') ||
            meshName.includes('case') ||
            child.material?.name?.toLowerCase().includes('metal') ||
            child.material?.name?.toLowerCase().includes('aluminum')) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#e5e5e7',
            metalness: 0.95,
            roughness: 0.15
          });
        }
      }
    });
  }, [clonedScene, imageTexture]);

  // Control video playback based on distance
  useEffect(() => {
    if (videoRef.current) {
      if (isNearCamera) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isNearCamera]);

  // Update video texture every frame when playing
  useFrame(() => {
    // Update texture if it's a video and near camera
    if (imageTexture instanceof THREE.VideoTexture && isNearCamera) {
      imageTexture.needsUpdate = true;
    }
  });

  // Calculate scale once and memoize it
  const calculatedScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    
    // ModernPhone dimensions: [0.75, 1.6, 0.08]
    const targetHeight = 1.6;
    const currentHeight = size.y;
    
    // Calculate scale factor to match ModernPhone height
    const scaleFactor = targetHeight / currentHeight;
    
    console.log('Calculated scale factor:', scaleFactor);
    return scaleFactor;
  }, [clonedScene]);

  return (
    <group 
      position={position} 
      rotation={rotation} 
      scale={scale * calculatedScale}
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
      <primitive object={clonedScene} />
    </group>
  );
};

// Preload the model
useGLTF.preload('/models/iphone_14_pro_max/scene.gltf');

export default IPhone3D;