import React, { useRef, Suspense, useState, useEffect, useMemo } from 'react';
import { animated, useSpring } from '@react-spring/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import IPhone3DVideo from './IPhone3DVideo';
import { MediaContent, PlayState } from '../types';

interface AnimatedPhoneVideoProps {
  media: MediaContent;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
  onDeselect: () => void;
  shouldFall?: boolean;
  fallDelay?: number;
}

const AnimatedPhoneVideo: React.FC<AnimatedPhoneVideoProps> = ({ 
  media, 
  position, 
  isSelected, 
  onClick,
  onDeselect,
  shouldFall = false,
  fallDelay = 0
}) => {
  const { camera } = useThree();
  const [playState, setPlayState] = useState<PlayState>('idle');
  // Generate random delays and rotation direction (only calculated once)
  const rotationStartDelay = useMemo(() => Math.random() * 2000 + 200, []); // 200-2200ms random delay
  const rotationDirection = useMemo(() => Math.random() > 0.5 ? 1 : -1, []); // Random rotation direction
  
  // Handle play state changes
  const handlePlayStateChange = (newState: PlayState) => {
    setPlayState(newState);
    
    // When animation starts, trigger the phone movement
    if (newState === 'animating') {
      onClick();
      // After animation completes, set to ready
      setTimeout(() => {
        setPlayState('ready');
      }, 2000); // 2 second animation
    }
  };
  
  // Reset state when deselected
  useEffect(() => {
    if (!isSelected && playState !== 'idle') {
      setPlayState('idle');
    }
  }, [isSelected, playState]);
  
  // Camera position and target position calculation
  const targetPosition = isSelected ? {
    x: -1,       
    y: 0.1,      
    z: 1.4      
  } : shouldFall ? {
    x: position[0],
    y: position[1],  // Keep same height
    z: position[2] - 60  // Move backward away from camera
  } : {
    x: position[0],
    y: position[1],
    z: position[2]
  };
  
  // Rotation for selected state - full 360 rotation plus tilt
  const targetRotation = isSelected ? {
    x: Math.PI / 6,      // 30 degree tilt
    y: Math.PI * 2,      // 360 degree rotation
    z: 0
  } : shouldFall ? {
    x: 0,                // No tilt
    y: Math.PI * 2 * rotationDirection,      // 360 degrees - one full rotation (random direction)
    z: 0                 // No side rotation
  } : {
    x: 0,
    y: 0,
    z: 0
  };
  
  // Smooth animation with spring - position and rotation separate
  const { posX, posY, posZ, scale, opacity } = useSpring({
    posX: targetPosition.x,
    posY: targetPosition.y,
    posZ: targetPosition.z,
    scale: isSelected ? 1.2 : shouldFall ? 0.8 : 1,
    opacity: shouldFall ? 0 : 1,  // Fade out when moving back
    config: { 
      mass: shouldFall ? 10 : (isSelected ? 2 : 3),
      tension: shouldFall ? 8 : (isSelected ? 60 : 40),
      friction: shouldFall ? 35 : (isSelected ? 25 : 30),
      delay: shouldFall ? (fallDelay * 2) : 0  // Staggered position movement
    }
  });

  // Separate rotation animation with its own delay
  const { rotX, rotY, rotZ } = useSpring({
    rotX: targetRotation.x,
    rotY: targetRotation.y,
    rotZ: targetRotation.z,
    config: { 
      mass: isSelected ? 2 : 4,
      tension: isSelected ? 60 : 20,
      friction: isSelected ? 25 : 25,
      delay: shouldFall ? rotationStartDelay : 0  // Random delay for rotation only
    }
  });

  // LOD - viewport optimization
  const isInViewport = Math.abs(position[1]) < 10;
  
  // Pause video when out of viewport
  useEffect(() => {
    if (!isInViewport && playState === 'playing') {
      setPlayState('ready');
    }
  }, [isInViewport, playState]);

  return (
    <animated.group 
      position-x={posX}
      position-y={posY}
      position-z={posZ}
      rotation-x={rotX}
      rotation-y={rotY}
      rotation-z={rotZ}
      scale={scale}
    >
      {isInViewport ? (
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[0.75, 1.6, 0.08]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
        }>
          <IPhone3DVideo
            media={media}
            rotation={[0, 0, 0]}
            onClick={() => {
              if (!isSelected) {
                handlePlayStateChange('animating');
              }
            }}
            playState={playState}
            onPlayStateChange={handlePlayStateChange}
          />
        </Suspense>
      ) : (
        // Simple placeholder for out of viewport
        <mesh>
          <boxGeometry args={[0.75, 1.6, 0.08]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
      )}
    </animated.group>
  );
};

export default AnimatedPhoneVideo;