import { VideoInfo } from './types';

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
