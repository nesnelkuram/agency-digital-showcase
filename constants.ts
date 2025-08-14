import { VideoInfo, MediaContent } from './types';
import allBlobUrls from './all-blob-urls.json';

// Type for blob URLs
interface BlobUrls {
  full: Record<string, string>;
  preview: Record<string, string>;
  other: Record<string, string>;
}

const blobUrls = allBlobUrls as BlobUrls;

// Helper function to get video URL
export const getBlobUrl = (fileName: string, type: 'full' | 'preview' = 'full'): string => {
  // Extract video number from filename (e.g., "1.mp4" -> "1", "10.mp4" -> "10")
  const videoNum = fileName.replace('.mp4', '').replace('.', '');
  const numericValue = parseInt(videoNum);
  
  // Blob Storage uses different padding: 01-09 for 1-9, and 010-012 for 10-12
  let blobFileName: string;
  if (numericValue >= 10) {
    // 10-12 use 3-digit format: 010, 011, 012
    blobFileName = `0${numericValue}.mp4`;
  } else {
    // 1-9 use 2-digit format: 01, 02, ..., 09
    blobFileName = `${videoNum.padStart(2, '0')}.mp4`;
  }
  
  // Direct Blob Storage URL
  const blobBaseUrl = 'https://ml0qkja5xmbjesrt.public.blob.vercel-storage.com';
  const blobPath = type === 'preview' ? `/videos/preview/${blobFileName}` : `/videos/full/${blobFileName}`;
  
  console.log(`Using Blob Storage: ${blobBaseUrl}${blobPath}`);
  return `${blobBaseUrl}${blobPath}`;
};

export const HEADER_VIDEOS: VideoInfo[] = [
  // Blob Storage'dan videolar
  { 
    id: 'vid1', 
    src: getBlobUrl('1.mp4', 'preview'),
    alt: 'Video 1' 
  },
  { 
    id: 'vid2', 
    src: getBlobUrl('2.mp4', 'preview'),
    alt: 'Video 2' 
  },
  { 
    id: 'vid3', 
    src: getBlobUrl('3.mp4', 'preview'),
    alt: 'Video 3' 
  },
  { 
    id: 'vid4', 
    src: getBlobUrl('4.mp4', 'preview'),
    alt: 'Video 4' 
  },
  { 
    id: 'vid5', 
    src: getBlobUrl('5.mp4', 'preview'),
    alt: 'Video 5' 
  },
  { 
    id: 'vid6', 
    src: getBlobUrl('6.mp4', 'preview'),
    alt: 'Video 6' 
  },
];

// Category video sets
export const CATEGORY_VIDEO_SETS: Record<string, number[][]> = {
  all: [
    [1, 5, 9, 2],      // Satır 0
    [6, 10, 3, 7],     // Satır 1  
    [11, 4, 8, 12],    // Satır 2
    [2, 7, 11, 4],     // Satır 3
    [8, 12, 5, 9],     // Satır 4
    [3, 6, 10, 1],     // Satır 5
    [7, 11, 4, 8],     // Satır 6
    [12, 2, 9, 3],     // Satır 7
    [5, 10, 1, 6],     // Satır 8
    [9, 3, 7, 11],     // Satır 9
    [4, 8, 12, 5],     // Satır 10
    [10, 1, 6, 2]      // Satır 11
  ],
  gastronomy: [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1]
  ],
  fashion: [
    [5, 6, 7, 8],
    [7, 8, 5, 6],
    [6, 5, 8, 7],
    [8, 7, 6, 5],
    [5, 6, 7, 8],
    [7, 8, 5, 6],
    [6, 5, 8, 7],
    [8, 7, 6, 5],
    [5, 6, 7, 8],
    [7, 8, 5, 6],
    [6, 5, 8, 7],
    [8, 7, 6, 5]
  ],
  corporate: [
    [9, 10, 11, 12],
    [11, 12, 9, 10],
    [10, 9, 12, 11],
    [12, 11, 10, 9],
    [9, 10, 11, 12],
    [11, 12, 9, 10],
    [10, 9, 12, 11],
    [12, 11, 10, 9],
    [9, 10, 11, 12],
    [11, 12, 9, 10],
    [10, 9, 12, 11],
    [12, 11, 10, 9]
  ],
  motion: [
    [1, 3, 5, 7],
    [9, 11, 2, 4],
    [6, 8, 10, 12],
    [2, 4, 6, 8],
    [10, 12, 1, 3],
    [5, 7, 9, 11],
    [1, 3, 5, 7],
    [9, 11, 2, 4],
    [6, 8, 10, 12],
    [2, 4, 6, 8],
    [10, 12, 1, 3],
    [5, 7, 9, 11]
  ],
  events: [
    [2, 4, 6, 8],
    [10, 12, 1, 3],
    [5, 7, 9, 11],
    [1, 3, 5, 7],
    [8, 10, 12, 2],
    [4, 6, 8, 10],
    [11, 1, 3, 5],
    [7, 9, 11, 1],
    [2, 4, 6, 8],
    [10, 12, 2, 4],
    [6, 8, 10, 12],
    [3, 5, 7, 9]
  ],
  hotels: [
    [11, 9, 7, 5],
    [3, 1, 12, 10],
    [8, 6, 4, 2],
    [2, 12, 10, 8],
    [6, 4, 2, 11],
    [9, 7, 5, 3],
    [1, 11, 9, 7],
    [5, 3, 1, 12],
    [10, 8, 6, 4],
    [4, 2, 12, 10],
    [8, 6, 4, 2],
    [11, 9, 7, 5]
  ],
  interview: [
    [12, 11, 10, 9],
    [8, 7, 6, 5],
    [4, 3, 2, 1],
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [12, 10, 8, 6],
    [4, 2, 11, 9],
    [7, 5, 3, 1],
    [1, 3, 5, 7],
    [9, 11, 2, 4],
    [6, 8, 10, 12]
  ],
  lifestyle: [
    [3, 6, 9, 12],
    [2, 5, 8, 11],
    [1, 4, 7, 10],
    [10, 7, 4, 1],
    [11, 8, 5, 2],
    [12, 9, 6, 3],
    [3, 6, 9, 12],
    [2, 5, 8, 11],
    [1, 4, 7, 10],
    [10, 7, 4, 1],
    [11, 8, 5, 2],
    [12, 9, 6, 3]
  ]
};

// Function to get phone images based on category
export const getPhoneImages = (category: string = 'all') => {
  const videoSets = CATEGORY_VIDEO_SETS[category] || CATEGORY_VIDEO_SETS.all;
  
  return Array.from({ length: 48 }, (_, idx) => {
    const col = idx % 4;  // 0, 1, 2, 3
    const row = Math.floor(idx / 4);  // 0-11
    const videoNum = videoSets[row][col];
    
    return {
      id: `img${idx + 1}`,
      src: getBlobUrl(`${videoNum}.mp4`, 'preview'),  // Use Blob URLs for preview
      alt: `Mobile video ${idx + 1}`
    };
  });
};

// MP4 formatı - Her satırda farklı videolar, sütunlar arası tekrar yok
// 48 telefon için video dağılımı (12 satır x 4 sütun)
export const PHONE_IMAGES = getPhoneImages('all');

// Tüm telefonlar için video içeriği - İlk 3 satırdan alınıyor
// İlk 12 telefon için (3 satır x 4 sütun)
export const PHONE_MEDIA_CONTENT: MediaContent[] = Array.from({ length: 12 }, (_, idx) => {
  const col = idx % 4;  // 0, 1, 2, 3
  const row = Math.floor(idx / 4);  // 0-2
  
  // İlk 3 satır için video setleri
  const videoSets = [
    [8, 1, 3, 5],      // Satır 0
    [12, 11, 6, 2],    // Satır 1
    [4, 7, 9, 10]      // Satır 2
  ];
  
  const videoNum = videoSets[row][col];
  
  return {
    id: `media${idx + 1}`,
    thumbnail: '/images/photo1.jpg',
    preview: getBlobUrl(`${videoNum}.mp4`, 'preview'),  // Blob URL for preview
    fullVideo: getBlobUrl(`${videoNum}.mp4`, 'full'),  // Blob URL for full video
    alt: `Video showcase ${idx + 1}`,
    duration: 10,
    type: 'video' as const
  };
});
