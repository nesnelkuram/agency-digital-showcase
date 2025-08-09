import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface VideoTextureProps {
  src: string;
  isPlaying: boolean;
  loop?: boolean;
  muted?: boolean;
  onEnded?: () => void;
}

export const useVideoTexture = ({ 
  src, 
  isPlaying, 
  loop = false, 
  muted = true,
  onEnded 
}: VideoTextureProps) => {
  const videoRef = useRef<HTMLVideoElement>();
  const textureRef = useRef<THREE.VideoTexture>();

  // Create video element
  useEffect(() => {
    const video = document.createElement('video');
    video.src = src;
    video.crossOrigin = 'anonymous';
    video.loop = loop;
    video.muted = muted;
    video.playsInline = true;
    video.preload = loop ? 'auto' : 'metadata'; // Loop videolar için auto preload
    
    videoRef.current = video;

    if (onEnded) {
      video.addEventListener('ended', onEnded);
    }

    // Create texture
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = texture;

    return () => {
      video.pause();
      video.src = '';
      video.load();
      if (onEnded) {
        video.removeEventListener('ended', onEnded);
      }
      texture.dispose();
    };
  }, [src, loop, muted, onEnded]);

  // Control playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(err => {
        console.warn('Video play failed:', err);
      });
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Update texture on each frame when playing
  useFrame(() => {
    if (textureRef.current && videoRef.current && isPlaying) {
      textureRef.current.needsUpdate = true;
    }
  });

  return textureRef.current;
};

interface VideoMaterialProps {
  src: string;
  isPlaying: boolean;
  loop?: boolean;
  muted?: boolean;
  onEnded?: () => void;
}

export const VideoMaterial: React.FC<VideoMaterialProps> = (props) => {
  const texture = useVideoTexture(props);

  if (!texture) return <meshBasicMaterial color="#000" />;

  return (
    <meshBasicMaterial map={texture} toneMapped={false} />
  );
};