import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { videoCache } from '../utils/videoCache';
import { shouldAutoplayVideos } from '../utils/deviceDetection';

interface IPhone3DProps {
  videoSrc: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
  isNearCamera?: boolean;
  isSelected?: boolean;
  enableSound?: boolean;
  isLoading?: boolean;
  loadDelay?: number;  // Delay in ms before starting video load (for staggered loading)
}

const IPhone3D: React.FC<IPhone3DProps> = ({
  videoSrc,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
  isNearCamera = true,
  isSelected = false,
  enableSound = false,
  isLoading = false,
  loadDelay = 0
}) => {
  // Check if we should autoplay videos
  const [canAutoplay] = useState(() => shouldAutoplayVideos());
  // Staggered loading - delay video load based on phone index
  const [shouldLoadVideo, setShouldLoadVideo] = useState(true);  // Always true - disable staggered loading for now

  // Staggered loading temporarily disabled - causing videos not to show
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     setShouldLoadVideo(true);
  //   }, loadDelay);
  //   return () => clearTimeout(timer);
  // }, [loadDelay]);

  // Load iPhone model — DRACO compressed
  const { scene } = useGLTF('/models/iphone_14_pro_max/scene.gltf', true) as any;
  
  // Clone the scene — SkeletonUtils.clone shares geometry/textures, only copies transforms
  const clonedScene = useMemo(() => {
    const cloned = cloneScene(scene);
    
    // First, let's find the bounding box to understand the model size
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Model size and center calculated
    
    // Center the model
    cloned.position.sub(center);
    
    // Rotate 180 degrees around Y axis to show front
    cloned.rotation.set(0, Math.PI, 0);
    
    return cloned;
  }, [scene]);

  // Track created materials/textures for cleanup
  const createdMaterials = useRef<THREE.Material[]>([]);
  const createdTextures = useRef<THREE.Texture[]>([]);

  // Cleanup on component unmount — dispose video, textures, materials
  useEffect(() => {
    return () => {
      clonedScene.traverse((child: any) => {
        if (child.isMesh) {
          // Stop & release video element
          if (child.__video) {
            const video = child.__video as HTMLVideoElement;
            video.pause();
            video.removeAttribute('src');
            video.load(); // release network resources
            child.__video = null;
          }
        }
      });

      // Dispose all materials and textures we created
      createdTextures.current.forEach(t => t.dispose());
      createdMaterials.current.forEach(m => m.dispose());
      createdTextures.current = [];
      createdMaterials.current = [];
    };
  }, [clonedScene]);
  
  // Find and update materials
  useEffect(() => {
    // Dispose previously created resources before creating new ones
    createdTextures.current.forEach(t => t.dispose());
    createdMaterials.current.forEach(m => m.dispose());
    createdTextures.current = [];
    createdMaterials.current = [];

    const trackMaterial = (m: THREE.Material) => { createdMaterials.current.push(m); return m; };
    const trackTexture = (t: THREE.Texture) => { createdTextures.current.push(t); return t; };

    // First, let's analyze the model structure
    // Analyze model structure
    let meshCount = 0;
    let texturedMeshes: any[] = [];
    
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        meshCount++;
        // Track mesh info
        
        // Check all texture types
        if (child.material) {
          const textures = [];
          if (child.material.map) textures.push('map');
          if (child.material.emissiveMap) textures.push('emissiveMap');
          if (child.material.normalMap) textures.push('normalMap');
          if (child.material.roughnessMap) textures.push('roughnessMap');
          if (child.material.metalnessMap) textures.push('metalnessMap');
          
          if (textures.length > 0) {
            // Track textures
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
    
    // Mesh count tracked
    
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
      // Screen mesh found
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
        
        // UV bounds calculated
        
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
        
        // UV coordinates remapped
      }
      
      
      // If no video source, skip video setup for this phone
      if (!videoSrc) {
        mesh.material = trackMaterial(new THREE.MeshBasicMaterial({
          color: '#000000',
          toneMapped: false,
          side: THREE.FrontSide
        }));
        return;
      }

      // Staggered loading: show gradient placeholder until ready to load
      if (!shouldLoadVideo) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          const gradient = ctx.createLinearGradient(0, 0, 0, 512);
          gradient.addColorStop(0, '#1a1a2e');
          gradient.addColorStop(0.5, '#16213e');
          gradient.addColorStop(1, '#0f0f23');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 256, 512);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.arc(128, 256, 30, 0, Math.PI * 2);
          ctx.fill();
        }

        const placeholderTexture = trackTexture(new THREE.CanvasTexture(canvas));
        placeholderTexture.minFilter = THREE.LinearFilter;
        placeholderTexture.magFilter = THREE.LinearFilter;

        mesh.material = trackMaterial(new THREE.MeshBasicMaterial({
          map: placeholderTexture,
          toneMapped: false,
          side: THREE.FrontSide
        }));
        return;
      }

      // Create video element and texture
      const video = document.createElement('video');
      const isFullVideo = videoSrc.includes('/full/');

      if (isFullVideo) {
        video.src = videoSrc;
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
      } else {
        const cachedBlobUrl = videoCache.getBlobUrl(videoSrc);
        if (cachedBlobUrl) {
          video.src = cachedBlobUrl;
          video.preload = 'auto';
        } else {
          video.src = videoSrc;
          video.crossOrigin = 'anonymous';
          video.preload = 'metadata';
          videoCache.preloadVideo(videoSrc);
        }
      }

      video.loop = true;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.playbackRate = 1.0;

      // Store video reference on mesh for later control
      (mesh as any).__video = video;

      video.play().catch(() => {
        setTimeout(() => { video.play().catch(() => {}); }, 100);
      });

      const videoTexture = trackTexture(new THREE.VideoTexture(video));
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.generateMipmaps = false;
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.format = THREE.RGBFormat;
      videoTexture.wrapS = THREE.ClampToEdgeWrapping;
      videoTexture.wrapT = THREE.ClampToEdgeWrapping;
      videoTexture.repeat.set(-1, 1);
      videoTexture.offset.set(1, 0);

      // Full video canplay handler
      if (isFullVideo) {
        video.addEventListener('canplay', () => {
          if (mesh?.material?.map && !mesh.material.map.isVideoTexture) {
            mesh.material.map = videoTexture;
            mesh.material.needsUpdate = true;
          }
        }, { once: true });
      }

      // Show loading state or video texture
      if (isLoading || (isFullVideo && video.readyState < 2)) {
        mesh.material = trackMaterial(new THREE.MeshBasicMaterial({
          color: '#000000',
          toneMapped: false,
          side: THREE.FrontSide
        }));

        video.addEventListener('canplay', () => {
          const mat = trackMaterial(new THREE.MeshBasicMaterial({
            map: videoTexture,
            toneMapped: false,
            side: THREE.FrontSide
          }));
          mesh.material = mat;
        }, { once: true });
      } else {
        mesh.material = trackMaterial(new THREE.MeshBasicMaterial({
          map: videoTexture,
          toneMapped: false,
          side: THREE.FrontSide
        }));
      }
    }

    // Style the frame
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        const meshName = child.name.toLowerCase();

        if (meshName.includes('frame') ||
            meshName.includes('body') ||
            meshName.includes('case') ||
            child.material?.name?.toLowerCase().includes('metal') ||
            child.material?.name?.toLowerCase().includes('aluminum')) {
          child.material = trackMaterial(new THREE.MeshStandardMaterial({
            color: '#e5e5e7',
            metalness: 0.95,
            roughness: 0.05,
            envMapIntensity: 1
          }));
        }

        if (meshName.includes('glass') ||
            meshName.includes('lens') ||
            meshName.includes('camera')) {
          child.material = trackMaterial(new THREE.MeshStandardMaterial({
            color: '#1a1a1a',
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 0.5
          }));
        }
      }
    });
  }, [clonedScene, videoSrc, enableSound, isLoading, shouldLoadVideo]);

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
        // Autoplay logic for desktop
        if (canAutoplay && !isSelected) {
          // For preview videos on desktop - play if near camera
          if (isNearCamera) {
            if (video.paused) {
              video.play().catch(() => {});
            }
          } else {
            // Pause if far from camera to save resources
            if (!video.paused) {
              video.pause();
            }
          }
        } 
        // Manual play logic (for selected videos or mobile)
        else if (isNearCamera && isSelected) {
          // Play selected video
          if (video.paused) {
            video.play().catch(() => {});
          }
        } else {
          // Pause in all other cases
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
  }, [clonedScene, isNearCamera, isSelected, enableSound, canAutoplay]);
  
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
    
    // Scale calculated
    return scaleValue * scale;
  }, [clonedScene, scale]);

  return (
    <group 
      position={position} 
      rotation={rotation}
      onClick={onClick}
    >
      <primitive 
        object={clonedScene} 
        scale={calculatedScale}
      />
    </group>
  );
};

// Preload the DRACO-compressed model
useGLTF.preload('/models/iphone_14_pro_max/scene.gltf', true);

export default IPhone3D;