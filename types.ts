export interface VideoInfo {
  id: string;
  src: string;
  alt: string;
  title?: string;
  description?: string;
  category?: string;
  location?: string;
  tags?: string;
  year?: number;
  services?: string;
}

export interface MediaContent {
  id: string;
  thumbnail: string;      // Statik görsel
  preview?: string;       // Kısa animasyonlu video (loop)
  fullVideo?: string;     // Ana video
  alt: string;
  duration?: number;      // Video süresi (saniye)
  type: 'image' | 'video';
  title?: string;
  description?: string;
  category?: string;
  category2?: string;     // İkinci kategori
  location?: string;
  tags?: string;
  year?: number;
  services?: string;
}

export type PlayState = 'idle' | 'animating' | 'ready' | 'playing';
