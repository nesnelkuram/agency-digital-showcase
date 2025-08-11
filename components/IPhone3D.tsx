import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface IPhone3DProps {
  videoSrc: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
  isNearCamera?: boolean;
  isSelected?: boolean;
  enableSound?: boolean;
}

const IPhone3D: React.FC<IPhone3DProps> = ({ 
  videoSrc, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
  isNearCamera = true,
  isSelected = false,
  enableSound = false
}) => {
  // Load iPhone model
  const { scene } = useGLTF('/models/iphone_14_pro_max/scene.gltf') as any;
  
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

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // When component unmounts, stop and mute the video
      clonedScene.traverse((child: any) => {
        if (child.isMesh && child.__video) {
          const video = child.__video;
          video.muted = true;
          video.volume = 0;
          video.pause();
        }
      });
    };
  }, [clonedScene]);
  
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
    
    // Apply image texture to the found screen mesh
    if (screenMesh) {
      console.log(`\n✓ FOUND SCREEN: ${screenMesh.name}`);
      const mesh = screenMesh.mesh;
      
      // Remap UV coordinates to be uniform (0-1 range)
      if (mesh.geometry && mesh.geometry.attributes.uv) {
        const uvAttribute = mesh.geometry.attributes.uv;
        const uvArray = uvAttribute.array;
        
        // Get bounds of current UVs
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;
        
        for (let i = 0; i < uvArray.length; i += 2) {
          minU = Math.min(minU, uvArray[i]);
          maxU = Math.max(maxU, uvArray[i]);
          minV = Math.min(minV, uvArray[i + 1]);
          maxV = Math.max(maxV, uvArray[i + 1]);
        }
        
        console.log('Original UV bounds:', { minU, maxU, minV, maxV });
        
        // Normalize UVs to 0-1 range
        const rangeU = maxU - minU || 1;
        const rangeV = maxV - minV || 1;
        
        for (let i = 0; i < uvArray.length; i += 2) {
          uvArray[i] = (uvArray[i] - minU) / rangeU;
          uvArray[i + 1] = (uvArray[i + 1] - minV) / rangeV;
        }
        
        // Mark UV attribute as needing update
        uvAttribute.needsUpdate = true;
        mesh.geometry.attributes.uv.needsUpdate = true;
        mesh.geometry.uvsNeedUpdate = true;
        
        console.log('✓ Remapped UV coordinates to uniform 0-1 range');
      }
      
      
      // Create video element and texture with performance optimizations
      const video = document.createElement('video');
      video.src = videoSrc;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = !enableSound;  // Only mute if sound is not enabled
      video.autoplay = false;  // Disabled for faster initial load
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      
      // Performance optimizations
      video.preload = 'metadata';  // Only preload metadata for faster initial load
      video.playbackRate = 1.0;
      
      // Store video reference on mesh for later control
      (mesh as any).__video = video;
      
      // Don't autoplay - will be controlled by user interaction and visibility
      
      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;  // Better quality for visible videos
      videoTexture.magFilter = THREE.LinearFilter;  // Better quality for visible videos
      videoTexture.generateMipmaps = false;
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.format = THREE.RGBFormat;  // Simpler format
      
      // Apply UV adjustments
      videoTexture.wrapS = THREE.ClampToEdgeWrapping;
      videoTexture.wrapT = THREE.ClampToEdgeWrapping;
      
      // Flip horizontally for correct orientation
      videoTexture.repeat.set(-1, 1);
      videoTexture.offset.set(1, 0);
      
      mesh.material = new THREE.MeshBasicMaterial({
        map: videoTexture,
        toneMapped: false,
        side: THREE.FrontSide  // Only render front side
      });
      
      console.log('✓ Applied video texture to screen');
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
            roughness: 0.05,
            envMapIntensity: 1
          });
        }
        
        // Make any glass or lens darker
        if (meshName.includes('glass') || 
            meshName.includes('lens') ||
            meshName.includes('camera')) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#1a1a1a',
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 0.5
          });
        }
      }
    });
  }, [clonedScene, videoSrc, enableSound]);

  // Control video playback based on viewport visibility AND selection state
  useEffect(() => {
    if (!clonedScene) return;
    
    let screenMesh: any = null;
    clonedScene.traverse((child: any) => {
      if (child.isMesh && child.__video) {
        screenMesh = child;
      }
    });
    
    if (screenMesh && screenMesh.__video) {
      const video = screenMesh.__video;
      
      // Small delay to ensure video element is ready
      setTimeout(() => {
        // Only play if near camera AND user has interacted (scrolled)
        if (isNearCamera && (isSelected || !enableSound) && window.scrollY > 50) {
          // Video is in viewport and user has scrolled - play it
          if (video.paused) {
            video.play().catch(() => {});
          }
        } else {
          // Video is far from camera OR no user interaction - pause
          if (!video.paused) {
            video.pause();
          }
        }
      }, 100);
    }
    
    return () => {
      // Cleanup on unmount
      if (screenMesh && screenMesh.__video) {
        screenMesh.__video.pause();
      }
    };
  }, [clonedScene, isNearCamera, isSelected, enableSound]);
  
  // Control sound based on selection state - immediate mute when deselected
  useEffect(() => {
    if (!clonedScene) return;
    
    let screenMesh: any = null;
    clonedScene.traverse((child: any) => {
      if (child.isMesh && child.__video) {
        screenMesh = child;
      }
    });
    
    if (screenMesh && screenMesh.__video) {
      const video = screenMesh.__video;
      
      // Immediately control mute state based on selection
      if (isSelected && enableSound) {
        video.muted = false;
        video.volume = 1.0;
      } else {
        video.muted = true;
        video.volume = 0;
      }
    }
  }, [clonedScene, enableSound, isSelected]);

  // Calculate scale once and memoize it
  const calculatedScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Target size: slightly larger than ModernPhone
    const targetSize = 1.8;
    const scaleValue = targetSize / maxDim;
    
    console.log('Calculated scale for iPhone:', scaleValue);
    return scaleValue * scale;
  }, [clonedScene, scale]);

  return (
    <group 
      position={position} 
      rotation={rotation}
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
      <primitive 
        object={clonedScene} 
        scale={calculatedScale}
      />
    </group>
  );
};

// Preload the model
useGLTF.preload('/models/iphone_14_pro_max/scene.gltf');

export default IPhone3D;