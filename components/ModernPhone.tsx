import React, { useRef, useMemo } from 'react';
import { RoundedBox, Box } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';

interface ModernPhoneProps {
  videoSrc: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
}

const ModernPhone: React.FC<ModernPhoneProps> = ({ 
  videoSrc, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = 1,
  onClick
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Create video texture
  const videoTexture = useMemo(() => {
    const video = document.createElement('video');
    video.src = videoSrc;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    
    video.addEventListener('loadedmetadata', () => {
      video.play().catch(e => console.log('Video play error:', e));
    });
    
    video.addEventListener('canplaythrough', () => {
      texture.needsUpdate = true;
    });
    
    videoRef.current = video;
    
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.generateMipmaps = false;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    
    return texture;
  }, [videoSrc]);

  // Custom shader material for rounded corners
  const RoundedVideoMaterial = useMemo(() => {
    return shaderMaterial(
      { uTexture: null, uRadius: 0.04, uSize: new THREE.Vector2(0.71, 1.56) },
      // Vertex shader
      `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      // Fragment shader
      `
        uniform sampler2D uTexture;
        uniform float uRadius;
        uniform vec2 uSize;
        varying vec2 vUv;
        
        float roundedBoxSDF(vec2 p, vec2 size, float radius) {
          vec2 q = abs(p) - size + radius;
          return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
        }
        
        void main() {
          vec2 pos = (vUv - 0.5) * uSize;
          float dist = roundedBoxSDF(pos, uSize * 0.5, uRadius);
          
          if (dist > 0.0) {
            discard;
          }
          
          vec4 color = texture2D(uTexture, vUv);
          float alpha = 1.0 - smoothstep(-0.001, 0.001, dist);
          gl_FragColor = vec4(color.rgb, color.a * alpha);
        }
      `
    );
  }, []);

  // Extend the material with proper typing
  const RoundedVideoMaterialImpl = RoundedVideoMaterial;
  extend({ RoundedVideoMaterialImpl });

  return (
    <group 
      position={position} 
      rotation={rotation} 
      scale={scale}
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
      {/* Modern phone body - ultra thin with metallic finish */}
      <RoundedBox
        args={[0.75, 1.6, 0.035]}
        radius={0.04}
        smoothness={8}
      >
        <meshStandardMaterial 
          color="#0a0a0a"
          metalness={0.7}
          roughness={0.3}
        />
      </RoundedBox>

      {/* Inner black fill to make phone solid */}
      <Box args={[0.73, 1.58, 0.033]} position={[0, 0, 0]}>
        <meshBasicMaterial color="#000000" />
      </Box>


      {/* Main screen - video display with rounded corners */}
      <mesh position={[0, 0, 0.03 ]}>
        <planeGeometry args={[0.71, 1.56]} />
        {/* @ts-ignore - custom shader material */}
        <roundedVideoMaterialImpl 
          uTexture={videoTexture} 
          uRadius={0.038}
          uSize={new THREE.Vector2(0.71, 1.56)}
          toneMapped={false}
          transparent
        />
      </mesh>



      {/* Top speaker/camera notch - minimal design */}
      <Box args={[0.15, 0.015, 0.001]} position={[0, 0.77, 0.0178]}>
        <meshStandardMaterial color="#0a0a0a" />
      </Box>

      {/* Front camera dot */}
      <mesh position={[0, 0.77, 0.0179]}>
        <circleGeometry args={[0.004, 32]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Power button */}
      <Box args={[0.003, 0.08, 0.01]} position={[0.3755, 0.15, 0]}>
        <meshPhysicalMaterial 
          color="#1a1a1a"
          metalness={0.9}
          roughness={0.3}
        />
      </Box>

      {/* Volume buttons */}
      <Box args={[0.003, 0.05, 0.01]} position={[-0.3755, 0.2, 0]}>
        <meshPhysicalMaterial 
          color="#1a1a1a"
          metalness={0.9}
          roughness={0.3}
        />
      </Box>
      <Box args={[0.003, 0.05, 0.01]} position={[-0.3755, 0.1, 0]}>
        <meshPhysicalMaterial 
          color="#1a1a1a"
          metalness={0.9}
          roughness={0.3}
        />
      </Box>
    </group>
  );
};

export default ModernPhone;