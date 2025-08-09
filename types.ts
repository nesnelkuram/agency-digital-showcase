export interface VideoInfo {
  id: string;
  src: string;
  alt: string; 
}

export interface MediaContent {
  id: string;
  thumbnail: string;      // Statik görsel
  preview?: string;       // Kısa animasyonlu video (loop)
  fullVideo?: string;     // Ana video
  alt: string;
  duration?: number;      // Video süresi (saniye)
  type: 'image' | 'video';
}

export type PlayState = 'idle' | 'animating' | 'ready' | 'playing';
