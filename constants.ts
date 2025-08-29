import { VideoInfo, MediaContent } from './types';
import allBlobUrls from './all-blob-urls.json';
import { getVideoMetadata } from './videoMetadata';

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
  
  // Blob Storage uses different padding: 01-09 for 1-9, 010-035 for 10-35
  let blobFileName: string;
  if (numericValue >= 10) {
    // 10-35 use 3-digit format: 010, 011, 012, ..., 035
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
  // Blob Storage'dan videolar - İlk 6 video
  ...[1, 2, 3, 4, 5, 6].map(num => {
    const metadata = getVideoMetadata(num);
    return {
      id: `vid${num}`,
      src: getBlobUrl(`${num}.mp4`, 'preview'),
      alt: metadata?.title || `Video ${num}`,
      title: metadata?.title,
      description: metadata?.description,
      category: metadata?.category,
      location: metadata?.location,
      tags: metadata?.tags,
      year: metadata?.year,
      services: metadata?.services
    };
  })
];

// MP4 formatı - İlk yüklemede sadece ilk 12 video gösteriliyor (performans için)
// 48 telefon için video dağılımı (12 satır x 4 sütun)
export const PHONE_IMAGES = Array.from({ length: 48 }, (_, idx) => {
  const col = idx % 4;  // 0, 1, 2, 3
  const row = Math.floor(idx / 4);  // 0-11
  
  // İlk yüklemede sadece 1-12 arası videolar (performans optimizasyonu)
  const videoSets = [
    [8, 1, 3, 5],      // Satır 0
    [12, 11, 6, 2],    // Satır 1
    [4, 7, 9, 10],     // Satır 2
    [1, 5, 8, 3],      // Satır 3
    [3, 2, 12, 11],    // Satır 4
    [6, 10, 4, 7],     // Satır 5
    [9, 1, 5, 8],      // Satır 6
    [8, 11, 3, 2],     // Satır 7
    [12, 7, 6, 10],    // Satır 8
    [4, 5, 9, 1],      // Satır 9
    [2, 8, 11, 3],     // Satır 10
    [3, 10, 12, 7]     // Satır 11
  ];
  
  const videoNum = videoSets[row][col];
  const metadata = getVideoMetadata(videoNum);
  
  return {
    id: `img${idx + 1}`,
    src: getBlobUrl(`${videoNum}.mp4`, 'preview'),  // Use Blob URLs for preview
    alt: metadata?.title || `Mobile video ${idx + 1}`,
    title: metadata?.title,
    description: metadata?.description,
    category: metadata?.category,
    location: metadata?.location
  };
});

// İlk yüklemede gösterilecek videolar (performans için sadece ilk 12)
export const INITIAL_PHONE_MEDIA_CONTENT: MediaContent[] = Array.from({ length: 12 }, (_, idx) => {
  const videoNum = idx + 1;  // 1-12
  const metadata = getVideoMetadata(videoNum);
  
  // Duration'ı string'den saniyeye çevir
  const durationInSeconds = metadata?.duration ? 
    parseInt(metadata.duration.replace('s', '')) : 30;
  
  return {
    id: `media${videoNum}`,
    preview: getBlobUrl(`${videoNum}.mp4`, 'preview'),  // Blob URL for preview
    fullVideo: getBlobUrl(`${videoNum}.mp4`, 'full'),  // Blob URL for full video
    alt: metadata?.title || `Video showcase ${videoNum}`,
    duration: durationInSeconds,
    type: 'video' as const,
    title: metadata?.title,
    description: metadata?.description,
    category: metadata?.category,
    location: metadata?.location,
    tags: metadata?.tags,
    year: metadata?.year,
    services: metadata?.services
  };
});

// Tüm videolar için lazy loading - kategori seçiminde kullanılacak
// CSV'deki tüm videoları dahil et
export const ALL_MEDIA_CONTENT: MediaContent[] = (() => {
  const allVideos: MediaContent[] = [];
  
  // CSV'deki video ID'lerini kullan (1-40 arası, bazıları eksik olabilir)
  const videoIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 
                    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 39, 40];
  
  videoIds.forEach(videoNum => {
    const metadata = getVideoMetadata(videoNum);
    
    // Eğer metadata yoksa veya title boşsa, bu videoyu atla
    if (!metadata || !metadata.title) {
      return;
    }
    
    // Duration'ı string'den saniyeye çevir
    const durationInSeconds = metadata.duration ? 
      parseInt(metadata.duration.replace('s', '')) : 30;
    
    allVideos.push({
      id: `media${videoNum}`,
      preview: getBlobUrl(`${videoNum}.mp4`, 'preview'),  // Blob URL for preview
      fullVideo: getBlobUrl(`${videoNum}.mp4`, 'full'),  // Blob URL for full video
      alt: metadata.title || `Video showcase ${videoNum}`,
      duration: durationInSeconds,
      type: 'video' as const,
      title: metadata.title,
      description: metadata.description,
      category: metadata.category,
      category2: metadata.category2,
      location: metadata.location,
      tags: metadata.tags,
      year: metadata.year,
      services: metadata.services
    });
  });
  
  return allVideos;
})();

// Eski isimle uyumluluk için
export const PHONE_MEDIA_CONTENT = INITIAL_PHONE_MEDIA_CONTENT;

