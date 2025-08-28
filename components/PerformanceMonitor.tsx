import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

interface PerformanceMonitorProps {
  onQualityChange?: (quality: 'low' | 'medium' | 'high') => void;
  showStats?: boolean;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  onQualityChange,
  showStats = false
}) => {
  const [fps, setFps] = useState(60);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const fpsHistory = useRef<number[]>([]);
  
  // FPS calculation
  useFrame(() => {
    frameCount.current++;
    const currentTime = performance.now();
    const delta = currentTime - lastTime.current;
    
    // Calculate FPS every 500ms
    if (delta >= 500) {
      const currentFps = Math.round((frameCount.current * 1000) / delta);
      setFps(currentFps);
      
      // Keep history of last 10 measurements
      fpsHistory.current.push(currentFps);
      if (fpsHistory.current.length > 10) {
        fpsHistory.current.shift();
      }
      
      // Calculate average FPS
      const avgFps = fpsHistory.current.reduce((a, b) => a + b, 0) / fpsHistory.current.length;
      
      // Auto-adjust quality based on performance
      if (avgFps < 30 && quality !== 'low') {
        setQuality('low');
        onQualityChange?.('low');
      } else if (avgFps < 45 && quality === 'high') {
        setQuality('medium');
        onQualityChange?.('medium');
      } else if (avgFps > 55 && quality === 'medium') {
        setQuality('high');
        onQualityChange?.('high');
      } else if (avgFps > 55 && quality === 'low') {
        setQuality('medium');
        onQualityChange?.('medium');
      }
      
      frameCount.current = 0;
      lastTime.current = currentTime;
    }
  });
  
  // Device capability detection
  useEffect(() => {
    const detectCapabilities = () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (!gl) {
        setQuality('low');
        onQualityChange?.('low');
        return;
      }
      
      // Check device capabilities
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const cores = navigator.hardwareConcurrency || 2;
      const memory = (navigator as any).deviceMemory || 4; // GB
      
      // Set initial quality based on device
      if (isMobile || cores < 4 || memory < 4) {
        setQuality('low');
        onQualityChange?.('low');
      } else if (cores < 8 || memory < 8) {
        setQuality('medium');
        onQualityChange?.('medium');
      } else {
        setQuality('high');
        onQualityChange?.('high');
      }
    };
    
    detectCapabilities();
  }, [onQualityChange]);
  
  if (!showStats) return null;
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      <div style={{ color: fps < 30 ? '#ff4444' : fps < 45 ? '#ffaa00' : '#44ff44' }}>
        FPS: {fps}
      </div>
      <div>Quality: {quality.toUpperCase()}</div>
      <div>Cores: {navigator.hardwareConcurrency || 'N/A'}</div>
      <div>Memory: {(navigator as any).deviceMemory || 'N/A'} GB</div>
    </div>
  );
};

export default PerformanceMonitor;