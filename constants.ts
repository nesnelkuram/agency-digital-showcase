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

// Public klasöründeki görselleri kullanalım
export const PHONE_IMAGES = [
  { id: 'img1', src: '/images/photo1.jpg', alt: 'Mobile app showcase 1' },
  { id: 'img2', src: '/images/photo2.jpg', alt: 'Mobile app showcase 2' },
  { id: 'img3', src: '/images/photo3.jpg', alt: 'Mobile app showcase 3' },
  { id: 'img4', src: '/images/photo4.jpg', alt: 'Mobile app showcase 4' },
  // Geri kalanlar için aynı görselleri tekrar kullanalım
  { id: 'img5', src: '/images/photo1.jpg', alt: 'Mobile app showcase 5' },
  { id: 'img6', src: '/images/photo2.jpg', alt: 'Mobile app showcase 6' },
  { id: 'img7', src: '/images/photo3.jpg', alt: 'Mobile app showcase 7' },
  { id: 'img8', src: '/images/photo4.jpg', alt: 'Mobile app showcase 8' },
  { id: 'img9', src: '/images/photo1.jpg', alt: 'Mobile app showcase 9' },
  { id: 'img10', src: '/images/photo2.jpg', alt: 'Mobile app showcase 10' },
  { id: 'img11', src: '/images/photo3.jpg', alt: 'Mobile app showcase 11' },
  { id: 'img12', src: '/images/photo4.jpg', alt: 'Mobile app showcase 12' },
];

// Yeni medya içeriği yapısı - animasyonlu önizlemeler için
export const PHONE_MEDIA_CONTENT: MediaContent[] = [
  {
    id: 'media1',
    thumbnail: '/images/photo1.jpg',
    preview: '/videos/preview/1.webm', // Yerel WebM video
    fullVideo: '/videos/preview/1.webm',
    alt: 'Showcase video 1',
    duration: 10,
    type: 'video'
  },
  {
    id: 'media2',
    thumbnail: '/images/photo2.jpg',
    preview: '/videos/preview/1.webm', // Aynı video farklı telefonda
    fullVideo: '/videos/preview/1.webm',
    alt: 'Showcase video 2',
    duration: 10,
    type: 'video'
  },
  {
    id: 'media3',
    thumbnail: '/images/photo3.jpg',
    preview: '/videos/preview/1.webm', // Test için aynı video
    fullVideo: '/videos/preview/1.webm',
    alt: 'Showcase video 3',
    duration: 10,
    type: 'video'
  },
  {
    id: 'media4',
    thumbnail: '/images/photo4.jpg',
    alt: 'Static image showcase',
    type: 'image'
  },
  {
    id: 'media5',
    thumbnail: '/images/photo1.jpg',
    preview: '/videos/preview/1.webm',
    fullVideo: '/videos/preview/1.webm',
    alt: 'Video showcase 5',
    duration: 10,
    type: 'video'
  },
  {
    id: 'media6',
    thumbnail: '/images/photo2.jpg',
    alt: 'Static showcase 6',
    type: 'image'
  },
  // Geri kalanlar için statik görseller
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `media${i + 7}`,
    thumbnail: `/images/photo${(i % 4) + 1}.jpg`,
    alt: `Showcase ${i + 7}`,
    type: 'image' as const
  }))
];
