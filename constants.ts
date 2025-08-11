import { VideoInfo, MediaContent } from './types';
import allBlobUrls from './all-blob-urls.json';

// Type for blob URLs
interface BlobUrls {
  full: Record<string, string>;
  preview: Record<string, string>;
  other: Record<string, string>;
}

const blobUrls = allBlobUrls as BlobUrls;

// Helper function to get blob URL - all videos now in Blob Storage
export const getBlobUrl = (fileName: string, type: 'full' | 'preview' = 'full'): string => {
  // For full videos - all are now uploaded
  if (type === 'full') {
    if (blobUrls.full[fileName]) {
      return blobUrls.full[fileName];
    }
    // Fallback to preview if full not found
    if (blobUrls.preview[fileName]) {
      console.warn(`⚠️ Using preview as full video: ${fileName}`);
      return blobUrls.preview[fileName];
    }
  }
  
  // For preview videos
  if (type === 'preview') {
    if (blobUrls.preview[fileName]) {
      return blobUrls.preview[fileName];
    }
    // Fallback to full if preview not found
    if (blobUrls.full[fileName]) {
      console.warn(`⚠️ Using full as preview: ${fileName}`);
      return blobUrls.full[fileName];
    }
  }
  
  // Video not found - fallback to local for development
  console.warn(`⚠️ Video not found in Blob: ${type}/${fileName}, using local fallback`);
  const localPath = type === 'preview' ? `/videos/preview/${fileName}` : `/videos/full/${fileName}`;
  return localPath;
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
    src: getBlobUrl(`${videoNum}.mp4`, 'preview'),  // Use Blob URLs for preview
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
    preview: getBlobUrl(`${videoNum}.mp4`, 'preview'),  // Blob URL for preview
    fullVideo: getBlobUrl(`${videoNum}.mp4`, 'full'),  // Blob URL for full video
    alt: `Video showcase ${idx + 1}`,
    duration: 10,
    type: 'video' as const
  };
});
