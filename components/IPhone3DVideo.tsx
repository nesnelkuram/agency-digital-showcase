import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import PlayButton from './PlayButton';
import { MediaContent, PlayState } from '../types';

interface IPhone3DVideoProps {
  media: MediaContent;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
  playState: PlayState;
  onPlayStateChange: (state: PlayState) => void;
}

const IPhone3DVideo: React.FC<IPhone3DVideoProps> = ({ 
  media, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
  playState,
  onPlayStateChange
}) => {
  // Load iPhone model
  const { scene } = useGLTF('/models/iphone_14_pro_max/scene.gltf') as any;
  
  // Video elements refs
  const previewVideoRef = useRef<HTMLVideoElement>();
  const fullVideoRef = useRef<HTMLVideoElement>();
  const textureRef = useRef<THREE.Texture>();
  
  // Determine what to display
  const currentSource = useMemo(() => {
    if (playState === 'playing' && media.fullVideo) {
      return { src: media.fullVideo, isVideo: true, loop: false };
    } else if (media.preview && (playState === 'idle' || playState === 'ready')) {
      return { src: media.preview, isVideo: true, loop: true };
    } else {
      return { src: media.thumbnail, isVideo: false, loop: false };
    }
  }, [playState, media]);

  // Create texture based on current source
  useEffect(() => {
    if (currentSource.isVideo) {
      const video = document.createElement('video');
      video.src = currentSource.src;
      video.crossOrigin = 'anonymous';
      video.loop = currentSource.loop;
      video.muted = true;
      video.playsInline = true;
      video.preload = currentSource.loop ? 'auto' : 'metadata';
      
      // Auto-play preview videos
      if (currentSource.loop) {
        video.play().catch(err => console.warn('Preview play failed:', err));
      }
      
      // Play full video when state is playing
      if (playState === 'playing') {
        video.play().catch(err => console.warn('Video play failed:', err));
      }
      
      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      
      textureRef.current = texture;
      
      if (currentSource.loop) {
        previewVideoRef.current = video;
      } else {
        fullVideoRef.current = video;
        
        // Handle video end
        video.addEventListener('ended', () => {
          onPlayStateChange('ready');
        });
      }
      
      return () => {
        video.pause();
        video.src = '';
        texture.dispose();
      };
    } else {
      // Static image texture
      const texture = new THREE.TextureLoader().load(currentSource.src);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      textureRef.current = texture;
      
      return () => {
        texture.dispose();
      };
    }
  }, [currentSource, playState, onPlayStateChange]);

  // Update video texture on each frame
  useFrame(() => {
    if (textureRef.current && textureRef.current instanceof THREE.VideoTexture) {
      textureRef.current.needsUpdate = true;
    }
  });

  // Clone and setup scene
  const clonedScene = useMemo(() => {
    const cloned = scene.clone();
    
    // Center and orient the model
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.sub(center);
    cloned.rotation.set(0, Math.PI, 0);
    
    return cloned;
  }, [scene]);

  // Update screen material with current texture
  useEffect(() => {
    if (!textureRef.current) return;
    
    console.log('=== ANALYZING IPHONE MODEL FOR VIDEO ===');
    let meshCount = 0;
    let texturedMeshes: any[] = [];
    let screenMesh: any = null;
    
    // First, analyze all meshes
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        meshCount++;
        console.log(`[${meshCount}] Mesh: ${child.name}`);
        
        // Collect textured meshes
        if (child.material && (child.material.map || child.material.emissiveMap)) {
          texturedMeshes.push({
            mesh: child,
            name: child.name,
            hasMap: !!child.material.map,
            hasEmissive: !!child.material.emissiveMap
          });
        }
      }
    });
    
    console.log(`Total meshes: ${meshCount}`);
    console.log(`Textured meshes: ${texturedMeshes.length}`);
    
    // Find screen mesh - Strategy 1: By emissive map
    screenMesh = texturedMeshes.find(item => item.hasEmissive);
    
    // Strategy 2: Find by name patterns
    if (!screenMesh) {
      screenMesh = texturedMeshes.find(item => {
        const name = item.name.toLowerCase();
        return name.includes('screen') || 
               name.includes('display') || 
               name.includes('wallpaper') ||
               name.includes('glass');
      });
    }
    
    // Strategy 3: Find the front-most textured mesh
    if (!screenMesh && texturedMeshes.length > 0) {
      screenMesh = texturedMeshes.reduce((prev, curr) => {
        return curr.mesh.position.z > prev.mesh.position.z ? curr : prev;
      });
    }
    
    // Apply texture to screen
    if (screenMesh) {
      console.log(`✓ FOUND SCREEN: ${screenMesh.name}`);
      const mesh = screenMesh.mesh;
      
      // Clone texture and adjust
      const adjustedTexture = textureRef.current.clone();
      
      // Flip horizontally for correct orientation
      adjustedTexture.repeat.set(-1, 1);
      adjustedTexture.offset.set(1, 0);
      
      mesh.material = new THREE.MeshBasicMaterial({
        map: adjustedTexture,
        toneMapped: false
      });
    } else {
      console.warn('⚠️ Could not find screen mesh!');
    }
    
    // Style the frame
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        const meshName = child.name.toLowerCase();
        if (meshName.includes('frame') || 
            meshName.includes('body') ||
            meshName.includes('case')) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#e5e5e7',
            metalness: 0.95,
            roughness: 0.15
          });
        }
      }
    });
  }, [clonedScene, textureRef.current]);

  // Calculate scale
  const calculatedScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const targetHeight = 1.6;
    return (targetHeight / size.y) * scale;
  }, [clonedScene, scale]);

  // Handle click based on state
  const handleClick = () => {
    if (playState === 'idle') {
      onPlayStateChange('animating');
      onClick?.();
    } else if (playState === 'ready') {
      onPlayStateChange('playing');
    } else if (playState === 'playing') {
      onPlayStateChange('ready');
      fullVideoRef.current?.pause();
    }
  };

  return (
    <group 
      position={position} 
      rotation={rotation} 
      scale={calculatedScale}
      onClick={handleClick}
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
      {media.type === 'video' && (
        <PlayButton
          onClick={handleClick}
          isVisible={playState !== 'animating'}
          isPlaying={playState === 'playing'}
        />
      )}
    </group>
  );
};

// Preload model
useGLTF.preload('/models/iphone_14_pro_max/scene.gltf');

export default IPhone3DVideo;