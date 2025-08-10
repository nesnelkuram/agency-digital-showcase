import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface LoadingTextureProps {
  progress: number;
}

export const createLoadingTexture = (progress: number): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 828;  // iPhone 14 Pro Max screen width in pixels
  canvas.height = 1792; // iPhone 14 Pro Max screen height in pixels
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Intiba logo (text for now, can be replaced with actual logo)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('intiba', canvas.width / 2, canvas.height / 2 - 200);
    
    // Progress circle
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 100;
    
    // Background circle
    ctx.strokeStyle = 'rgba(255, 252, 235, 0.2)'; // #fffceb with opacity
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Progress arc
    ctx.strokeStyle = '#fffceb';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (progress / 100) * Math.PI * 2;
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.stroke();
    
    // Progress text
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(progress)}%`, centerX, centerY);
    
    // Loading text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.fillText('Loading Experience', centerX, centerY + 200);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

const LoadingTexture: React.FC<LoadingTextureProps> = ({ progress }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useEffect(() => {
    if (meshRef.current) {
      const texture = createLoadingTexture(progress);
      (meshRef.current.material as THREE.MeshBasicMaterial).map = texture;
      (meshRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }, [progress]);
  
  return (
    <mesh ref={meshRef} position={[0, 0, 0.041]}>
      <planeGeometry args={[0.65, 1.4]} />
      <meshBasicMaterial />
    </mesh>
  );
};

export default LoadingTexture;