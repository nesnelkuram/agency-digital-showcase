import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InstancedMesh, Matrix4, Object3D, VideoTexture, Mesh, MeshBasicMaterial } from 'three';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface OptimizedPhoneGridProps {
  phones: Array<{
    position: [number, number, number];
    rotation: [number, number, number];
    videoSrc: string;
  }>;
  parallaxOffset: number;
  selectedIndex: number | null;
  onPhoneClick: (index: number) => void;
}

const OptimizedPhoneGrid: React.FC<OptimizedPhoneGridProps> = ({
  phones,
  parallaxOffset,
  selectedIndex,
  onPhoneClick
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const { scene } = useGLTF('/models/iphone_14_pro_max/scene.gltf') as any;
  const { camera, gl } = useThree();
  
  // Video textures pool
  const [videoTextures, setVideoTextures] = useState<Map<number, VideoTexture>>(new Map());
  const [visiblePhones, setVisiblePhones] = useState<Set<number>>(new Set());
  
  // Dummy object for matrix calculations
  const dummy = useMemo(() => new Object3D(), []);
  
  // Extract geometry and material from model
  const { geometry, material } = useMemo(() => {
    let phoneGeometry: any = null;
    let phoneMaterial: any = null;
    
    scene.traverse((child: any) => {
      if (child.isMesh && !phoneGeometry) {
        // Use the first mesh found as the phone body
        phoneGeometry = child.geometry;
        phoneMaterial = new MeshBasicMaterial({
          color: '#e5e5e7',
          metalness: 0.95,
          roughness: 0.05
        });
      }
    });
    
    return { 
      geometry: phoneGeometry, 
      material: phoneMaterial 
    };
  }, [scene]);
  
  // Initialize instances
  useEffect(() => {
    if (!meshRef.current) return;
    
    const mesh = meshRef.current;
    const matrix = new Matrix4();
    
    phones.forEach((phone, i) => {
      dummy.position.set(...phone.position);
      dummy.rotation.set(...phone.rotation);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    
    mesh.instanceMatrix.needsUpdate = true;
  }, [phones, dummy]);
  
  // Frustum culling - check which phones are visible
  useFrame(() => {
    if (!meshRef.current) return;
    
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(cameraMatrix);
    
    const newVisiblePhones = new Set<number>();
    
    phones.forEach((phone, i) => {
      const point = new THREE.Vector3(...phone.position);
      if (frustum.containsPoint(point)) {
        newVisiblePhones.add(i);
      }
    });
    
    // Only update if visibility changed
    if (newVisiblePhones.size !== visiblePhones.size || 
        ![...newVisiblePhones].every(i => visiblePhones.has(i))) {
      setVisiblePhones(newVisiblePhones);
    }
  });
  
  // Update parallax positions
  useFrame(() => {
    if (!meshRef.current) return;
    
    const mesh = meshRef.current;
    
    phones.forEach((phone, i) => {
      // Only update visible phones
      if (!visiblePhones.has(i)) return;
      
      const movingDown = i % 2 !== 0;
      const offsetMultiplier = 0.025;
      const yOffset = movingDown ? -parallaxOffset * offsetMultiplier : parallaxOffset * offsetMultiplier;
      
      dummy.position.set(
        phone.position[0],
        phone.position[1] + yOffset,
        phone.position[2]
      );
      
      // Special handling for selected phone
      if (selectedIndex === i) {
        dummy.position.set(3.4, -2, 5);
        dummy.rotation.set(Math.PI / 4, Math.PI * 2.3, 0);
        dummy.scale.set(1.2, 1.2, 1.2);
      } else {
        dummy.rotation.set(...phone.rotation);
        dummy.scale.set(1, 1, 1);
      }
      
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    
    mesh.instanceMatrix.needsUpdate = true;
  });
  
  // Lazy load videos only for visible phones
  useEffect(() => {
    const newTextures = new Map(videoTextures);
    
    visiblePhones.forEach(index => {
      if (!newTextures.has(index) && phones[index].videoSrc) {
        const video = document.createElement('video');
        video.src = phones[index].videoSrc;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.play().catch(() => {});
        
        const texture = new VideoTexture(video);
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        
        newTextures.set(index, texture);
      }
    });
    
    // Clean up textures for non-visible phones
    newTextures.forEach((texture, index) => {
      if (!visiblePhones.has(index)) {
        const video = (texture.image as HTMLVideoElement);
        video.pause();
        texture.dispose();
        newTextures.delete(index);
      }
    });
    
    setVideoTextures(newTextures);
  }, [visiblePhones, phones]);
  
  // Handle click events
  const handleClick = (event: any) => {
    if (!meshRef.current) return;
    
    // Raycasting to find clicked instance
    const mesh = meshRef.current;
    const intersection = event.intersections[0];
    
    if (intersection && intersection.instanceId !== undefined) {
      onPhoneClick(intersection.instanceId);
    }
  };
  
  if (!geometry || !material) return null;
  
  return (
    <instancedMesh 
      ref={meshRef} 
      args={[geometry, material, phones.length]}
      onClick={handleClick}
      frustumCulled={false}
    />
  );
};

// Preload model
useGLTF.preload('/models/iphone_14_pro_max/scene.gltf');

export default OptimizedPhoneGrid;