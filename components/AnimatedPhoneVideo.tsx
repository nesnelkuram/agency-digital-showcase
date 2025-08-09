import React, { useRef, Suspense, useState, useEffect } from 'react';
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
    y: position[1],      // Keep same height
    z: position[2] - 50  // Move far back behind the scene
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
    x: Math.PI * 0.2,    // Slight forward tilt
    y: Math.PI * 2,      // Full 360 rotation while falling
    z: Math.PI * 0.1     // Slight side rotation
  } : {
    x: 0,
    y: 0,
    z: 0
  };
  
  // Smooth animation with spring
  const { posX, posY, posZ, rotX, rotY, rotZ, scale, opacity } = useSpring({
    posX: targetPosition.x,
    posY: targetPosition.y,
    posZ: targetPosition.z,
    rotX: targetRotation.x,
    rotY: targetRotation.y,
    rotZ: targetRotation.z,
    scale: isSelected ? 1.2 : shouldFall ? 0.7 : 1,
    opacity: shouldFall ? 0 : 1,  // Fade out when moving back
    config: { 
      mass: shouldFall ? 2 : (isSelected ? 2 : 3),
      tension: shouldFall ? 50 : (isSelected ? 60 : 40),
      friction: shouldFall ? 25 : (isSelected ? 25 : 30),
      delay: shouldFall ? fallDelay : 0  // Sequential delay for falling
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