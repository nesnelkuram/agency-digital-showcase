import { VideoInfo } from './types';

export const HEADER_VIDEOS: VideoInfo[] = [
  { 
    id: 'vid1_escapes', 
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 
    alt: 'Scenic outdoor escape video' 
  },
  { 
    id: 'vid2_fun', 
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 
    alt: 'Playful and fun animation video' 
  },
  { 
    id: 'vid3_joyrides', 
    src: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    alt: 'Dynamic car joyride video' 
  },
];

// This constant is used in PhoneMockup.tsx for styling its aspect ratio.
// export const PHONE_ASPECT_RATIO_NUMBER = 9 / 19.5; // Example: 0.4615
// The Tailwind class `aspect-[9/19.5]` is used directly for simplicity.
