import React from 'react';
import { animated, useSpring } from '@react-spring/three';
import ModernPhone from './ModernPhone';

interface AnimatedPhoneProps {
  videoSrc: string;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
}

const AnimatedPhone: React.FC<AnimatedPhoneProps> = ({ 
  videoSrc, 
  position, 
  isSelected, 
  onClick 
}) => {
  const { scale, positionZ } = useSpring({
    scale: isSelected ? 1.5 : 1,
    positionZ: isSelected ? 8 : 0,
    config: { mass: 1, tension: 170, friction: 26 }
  });

  return (
    <animated.group 
      position-x={position[0]}
      position-y={position[1]}
      position-z={positionZ}
      scale={scale}
    >
      <ModernPhone
        videoSrc={videoSrc}
        rotation={[0, 0, 0]}
        onClick={onClick}
      />
    </animated.group>
  );
};

export default AnimatedPhone;