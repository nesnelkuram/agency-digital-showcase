import * as THREE from 'three';

class VideoTextureManager {
  private textures: Map<string, THREE.VideoTexture> = new Map();
  private videos: Map<string, HTMLVideoElement> = new Map();
  private activeVideos: Set<string> = new Set();
  private maxActiveVideos: number = 4; // Maximum simultaneous videos
  
  // Get or create video texture
  getTexture(videoSrc: string, autoplay: boolean = false): THREE.VideoTexture | null {
    if (!videoSrc) return null;
    
    // Return existing texture if available
    if (this.textures.has(videoSrc)) {
      return this.textures.get(videoSrc)!;
    }
    
    // Check if we've reached the limit
    if (this.activeVideos.size >= this.maxActiveVideos && !autoplay) {
      return null; // Don't create new videos if at limit
    }
    
    // Create new video element
    const video = document.createElement('video');
    video.src = videoSrc;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.crossOrigin = 'anonymous';
    
    // Lower quality for better performance
    video.width = 640;
    video.height = 360;
    
    // Create texture with optimized settings
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.NearestFilter; // No mipmapping
    texture.magFilter = THREE.NearestFilter; // Fastest filtering
    texture.generateMipmaps = false;
    texture.format = THREE.RGBFormat;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    // Store references
    this.videos.set(videoSrc, video);
    this.textures.set(videoSrc, texture);
    
    if (autoplay) {
      this.playVideo(videoSrc);
    }
    
    return texture;
  }
  
  // Play a specific video
  playVideo(videoSrc: string): void {
    const video = this.videos.get(videoSrc);
    if (!video) return;
    
    // Pause oldest video if at limit
    if (this.activeVideos.size >= this.maxActiveVideos) {
      const oldestVideo = this.activeVideos.values().next().value;
      this.pauseVideo(oldestVideo);
    }
    
    video.play().catch(() => {
      // Retry with user interaction
      console.warn(`Video autoplay prevented for ${videoSrc}`);
    });
    
    this.activeVideos.add(videoSrc);
  }
  
  // Pause a specific video
  pauseVideo(videoSrc: string): void {
    const video = this.videos.get(videoSrc);
    if (!video) return;
    
    video.pause();
    this.activeVideos.delete(videoSrc);
  }
  
  // Pause all videos except one
  pauseAllExcept(videoSrc: string): void {
    this.activeVideos.forEach(src => {
      if (src !== videoSrc) {
        this.pauseVideo(src);
      }
    });
  }
  
  // Update video quality based on performance
  setQuality(quality: 'low' | 'medium' | 'high'): void {
    const dimensions = {
      low: { width: 320, height: 180 },
      medium: { width: 640, height: 360 },
      high: { width: 1280, height: 720 }
    };
    
    const { width, height } = dimensions[quality];
    
    this.videos.forEach(video => {
      video.width = width;
      video.height = height;
    });
  }
  
  // Clean up specific video
  disposeVideo(videoSrc: string): void {
    const video = this.videos.get(videoSrc);
    const texture = this.textures.get(videoSrc);
    
    if (video) {
      video.pause();
      video.src = '';
      video.load();
      this.videos.delete(videoSrc);
    }
    
    if (texture) {
      texture.dispose();
      this.textures.delete(videoSrc);
    }
    
    this.activeVideos.delete(videoSrc);
  }
  
  // Clean up all resources
  dispose(): void {
    this.videos.forEach((video, src) => {
      this.disposeVideo(src);
    });
    
    this.textures.clear();
    this.videos.clear();
    this.activeVideos.clear();
  }
  
  // Get performance stats
  getStats(): { total: number; active: number; paused: number } {
    return {
      total: this.videos.size,
      active: this.activeVideos.size,
      paused: this.videos.size - this.activeVideos.size
    };
  }
}

// Export singleton instance
export const videoTextureManager = new VideoTextureManager();