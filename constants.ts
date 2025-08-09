import { VideoInfo, MediaContent } from './types';

export const HEADER_VIDEOS: VideoInfo[] = [
  // Yerel optimize edilmiş dikey video
  { 
    id: 'vid1_dikey_2_1', 
    src: '/videos/Dikey_2_1.mp4',  // 4.1MB - optimize boyut
    alt: 'Dikey video 2.1' 
  },
  // Exit109 kısa video klipleri
  { 
    id: 'vid2_rw20', 
    src: 'https://www.exit109.com/~dnn/clips/RW20seconds_1.mp4', 
    alt: 'RW 20 seconds clip 1' 
  },
  { 
    id: 'vid3_rw20_2', 
    src: 'https://www.exit109.com/~dnn/clips/RW20seconds_2.mp4', 
    alt: 'RW 20 seconds clip 2' 
  },
  { 
    id: 'vid4_clips', 
    src: 'https://www.exit109.com/~dnn/clips/RW20seconds.mp4',
    alt: 'RW 20 seconds original' 
  },
  // Mobile format videolar
  { 
    id: 'vid5_bunny', 
    src: 'https://www.exit109.com/~dnn/clips/bbb_480_688.mp4',
    alt: 'Big Buck Bunny mobile' 
  },
  { 
    id: 'vid6_sintel', 
    src: 'https://www.exit109.com/~dnn/clips/sintel_480_688.mp4',
    alt: 'Sintel mobile format' 
  },
];

// This constant is used in PhoneMockup.tsx for styling its aspect ratio.
// export const PHONE_ASPECT_RATIO_NUMBER = 9 / 19.5; // Example: 0.4615
// The Tailwind class `aspect-[9/19.5]` is used directly for simplicity.

// MP4 formatı daha iyi performans için
export const PHONE_IMAGES = [
  { id: 'img1', src: '/videos/preview/1.mp4', alt: 'Mobile video 1' },
  { id: 'img2', src: '/videos/preview/1.mp4', alt: 'Mobile video 2' },
  { id: 'img3', src: '/videos/preview/1.mp4', alt: 'Mobile video 3' },
  { id: 'img4', src: '/videos/preview/1.mp4', alt: 'Mobile video 4' },
  { id: 'img5', src: '/videos/preview/1.mp4', alt: 'Mobile video 5' },
  { id: 'img6', src: '/videos/preview/1.mp4', alt: 'Mobile video 6' },
  { id: 'img7', src: '/videos/preview/1.mp4', alt: 'Mobile video 7' },
  { id: 'img8', src: '/videos/preview/1.mp4', alt: 'Mobile video 8' },
  { id: 'img9', src: '/videos/preview/1.mp4', alt: 'Mobile video 9' },
  { id: 'img10', src: '/videos/preview/1.mp4', alt: 'Mobile video 10' },
  { id: 'img11', src: '/videos/preview/1.mp4', alt: 'Mobile video 11' },
  { id: 'img12', src: '/videos/preview/1.mp4', alt: 'Mobile video 12' },
];

// Tüm telefonlar için video içeriği - MP4 formatında
export const PHONE_MEDIA_CONTENT: MediaContent[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `media${i + 1}`,
    thumbnail: '/images/photo1.jpg', // Statik thumbnail
    preview: '/videos/preview/1.mp4',  // MP4 format
    fullVideo: '/videos/preview/1.mp4',
    alt: `Video showcase ${i + 1}`,
    duration: 10,
    type: 'video' as const
  }))
];
