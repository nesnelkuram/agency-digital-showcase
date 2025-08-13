import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RaycastDetectorProps {
  onHoverChange: (isHovering: boolean) => void;
}

const RaycastDetector: React.FC<RaycastDetectorProps> = ({ onHoverChange }) => {
  const { scene, camera, gl, size } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const wasHovering = useRef(false);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Calculate mouse position in normalized device coordinates
      // (-1 to +1) for both components
      mouse.current.x = (event.clientX / size.width) * 2 - 1;
      mouse.current.y = -(event.clientY / size.height) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [size]);

  // Check for intersections on every frame
  useFrame(() => {
    // Update the picking ray with the camera and mouse position
    raycaster.current.setFromCamera(mouse.current, camera);

    // Calculate objects intersecting the picking ray
    // We're looking for any mesh in the scene
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    // Check if we're hovering over a phone
    let isHoveringPhone = false;
    
    for (const intersect of intersects) {
      // Check if the intersected object is part of a phone
      // Phones are in groups that contain meshes
      let parent = intersect.object;
      while (parent) {
        // Check if this is a phone mesh (IPhone3D wraps the phone model)
        // The phone model contains meshes with specific characteristics
        if (parent.type === 'Mesh' || parent.type === 'Group') {
          // Check if this object or its parent is within the phone grid area
          const worldPos = new THREE.Vector3();
          parent.getWorldPosition(worldPos);
          
          // Phones are positioned in a grid pattern
          // Check if the position matches a phone location
          if (Math.abs(worldPos.x) <= 3 && Math.abs(worldPos.y) <= 8 && Math.abs(worldPos.z) <= 10) {
            // Additional check: phones have specific materials/geometry
            if (intersect.object.type === 'Mesh') {
              const mesh = intersect.object as THREE.Mesh;
              // Phones typically have video textures or specific materials
              if (mesh.material) {
                isHoveringPhone = true;
                break;
              }
            }
          }
        }
        parent = parent.parent as any;
      }
      
      if (isHoveringPhone) break;
    }

    // Only trigger callback if hover state changed
    if (isHoveringPhone !== wasHovering.current) {
      wasHovering.current = isHoveringPhone;
      onHoverChange(isHoveringPhone);
      console.log('RaycastDetector: Hover state changed to', isHoveringPhone);
    }
  });

  return null;
};

export default RaycastDetector;