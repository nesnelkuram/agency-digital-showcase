/**
 * Smart Video Manager
 * - Only plays video on hover or selection
 * - Shows static thumbnails otherwise
 * - Maximum 1-2 videos playing simultaneously
 */

class SmartVideoManager {
  private activeVideo: HTMLVideoElement | null = null;
  private hoveredVideo: HTMLVideoElement | null = null;
  private thumbnailCache: Map<string, string> = new Map();
  private videoElements: Map<string, HTMLVideoElement> = new Map();
  
  /**
   * Get or create thumbnail for video
   */
  getThumbnail(videoSrc: string): string {
    if (this.thumbnailCache.has(videoSrc)) {
      return this.thumbnailCache.get(videoSrc)!;
    }
    
    // Create a simple placeholder thumbnail
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Dark gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0, '#2a2a2a');
      gradient.addColorStop(1, '#0a0a0a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 512);
      
      // Play button
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(108, 236);
      ctx.lineTo(148, 256);
      ctx.lineTo(108, 276);
      ctx.closePath();
      ctx.fill();
    }
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    this.thumbnailCache.set(videoSrc, dataUrl);
    return dataUrl;
  }
  
  /**
   * Prepare video element (but don't play)
   */
  prepareVideo(videoSrc: string): HTMLVideoElement {
    if (this.videoElements.has(videoSrc)) {
      return this.videoElements.get(videoSrc)!;
    }
    
    const video = document.createElement('video');
    video.src = videoSrc;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'none'; // Don't load until needed
    video.crossOrigin = 'anonymous';
    
    // Lower quality for better performance
    video.width = 360;
    video.height = 640;
    
    this.videoElements.set(videoSrc, video);
    return video;
  }
  
  /**
   * Play video on hover
   */
  playOnHover(videoSrc: string): HTMLVideoElement | null {
    // Stop previous hover video
    if (this.hoveredVideo && this.hoveredVideo.src !== videoSrc) {
      this.hoveredVideo.pause();
      this.hoveredVideo = null;
    }
    
    // Don't play if selected video is playing
    if (this.activeVideo) {
      return null;
    }
    
    const video = this.prepareVideo(videoSrc);
    video.play().catch(() => {
      // Silent fail - autoplay might be blocked
    });
    
    this.hoveredVideo = video;
    return video;
  }
  
  /**
   * Stop hover video
   */
  stopHover(videoSrc: string) {
    const video = this.videoElements.get(videoSrc);
    if (video && video === this.hoveredVideo) {
      video.pause();
      this.hoveredVideo = null;
    }
  }
  
  /**
   * Play selected video (priority)
   */
  playSelected(videoSrc: string): HTMLVideoElement {
    // Stop all other videos
    if (this.hoveredVideo) {
      this.hoveredVideo.pause();
      this.hoveredVideo = null;
    }
    
    if (this.activeVideo && this.activeVideo.src !== videoSrc) {
      this.activeVideo.pause();
    }
    
    const video = this.prepareVideo(videoSrc);
    video.play().catch(() => {
      // Silent fail
    });
    
    this.activeVideo = video;
    return video;
  }
  
  /**
   * Stop selected video
   */
  stopSelected(videoSrc: string) {
    const video = this.videoElements.get(videoSrc);
    if (video && video === this.activeVideo) {
      video.pause();
      this.activeVideo = null;
    }
  }
  
  /**
   * Pause all videos
   */
  pauseAll() {
    this.videoElements.forEach(video => {
      video.pause();
    });
    this.activeVideo = null;
    this.hoveredVideo = null;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    this.pauseAll();
    this.videoElements.forEach(video => {
      video.src = '';
      video.load();
    });
    this.videoElements.clear();
    this.thumbnailCache.clear();
  }
  
  /**
   * Get stats
   */
  getStats() {
    return {
      totalVideos: this.videoElements.size,
      activePlaying: this.activeVideo ? 1 : 0,
      hoverPlaying: this.hoveredVideo ? 1 : 0,
      thumbnails: this.thumbnailCache.size
    };
  }
}

// Export singleton
export const smartVideoManager = new SmartVideoManager();