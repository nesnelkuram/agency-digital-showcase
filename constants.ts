import { VideoInfo, MediaContent } from './types';
import blobUrlsData from './blob-urls.json';

// Type for blob URLs
const blobUrls: Record<string, string> = blobUrlsData as Record<string, string>;

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

// Helper function to get blob URL or fallback to local
const getBlobUrl = (fileName: string): string => {
  // Try to get from blob URLs first
  if (blobUrls && blobUrls[fileName]) {
    return blobUrls[fileName];
  }
  // Fallback to local file
  return `/videos/full/${fileName}`;
};

// MP4 formatı - Her satırda farklı videolar, sütunlar arası tekrar yok
// 48 telefon için video dağılımı (12 satır x 4 sütun)
export const PHONE_IMAGES = Array.from({ length: 48 }, (_, idx) => {
  const col = idx % 4;  // 0, 1, 2, 3
  const row = Math.floor(idx / 4);  // 0-11
  
  // Her satır için farklı video setleri
  const videoSets = [
    [8, 1, 3, 5],      // Satır 0
    [12, 11, 6, 2],    // Satır 1
    [4, 7, 9, '10.'],  // Satır 2
    [13, 5, 8, 1],     // Satır 3
    [3, 2, 12, 11],    // Satır 4
    [6, '10.', 4, 7],  // Satır 5
    [9, 1, 13, 5],     // Satır 6
    [8, 11, 3, 2],     // Satır 7
    [12, 7, 6, '10.'], // Satır 8
    [4, 5, 9, 1],      // Satır 9
    [13, 2, 8, 11],    // Satır 10
    [3, '10.', 12, 7]  // Satır 11
  ];
  
  const videoNum = videoSets[row][col];
  
  return {
    id: `img${idx + 1}`,
    src: `/videos/preview/${videoNum}.mp4`,
    alt: `Mobile video ${idx + 1}`
  };
});

// Tüm telefonlar için video içeriği - İlk 3 satırdan alınıyor
// İlk 12 telefon için (3 satır x 4 sütun)
export const PHONE_MEDIA_CONTENT: MediaContent[] = Array.from({ length: 12 }, (_, idx) => {
  const col = idx % 4;  // 0, 1, 2, 3
  const row = Math.floor(idx / 4);  // 0-2
  
  // İlk 3 satır için video setleri
  const videoSets = [
    [8, 1, 3, 5],      // Satır 0
    [12, 11, 6, 2],    // Satır 1
    [4, 7, 9, '10.']   // Satır 2
  ];
  
  const videoNum = videoSets[row][col];
  
  return {
    id: `media${idx + 1}`,
    thumbnail: '/images/photo1.jpg',
    preview: `/videos/preview/${videoNum}.mp4`,
    fullVideo: getBlobUrl(`${videoNum}.mp4`),  // Use Blob URL from CDN
    alt: `Video showcase ${idx + 1}`,
    duration: 10,
    type: 'video' as const
  };
});
