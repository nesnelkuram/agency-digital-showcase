import { MediaContent } from './types';
import { videoMetadata, getAllCategories, getVideosByCategory as getVideosFromMetadata } from './videoMetadata';

// Convert video metadata to MediaContent format
const convertToMediaContent = (videos: any[]): MediaContent[] => {
  return videos.map(video => ({
    id: String(video.id),
    // Format: 1→01, 10→010, 41→041 (always add single '0' prefix)
    preview: `https://ml0qkja5xmbjesrt.public.blob.vercel-storage.com/videos/preview/0${video.id}.mp4`,
    fullVideo: `https://ml0qkja5xmbjesrt.public.blob.vercel-storage.com/videos/full/0${video.id}.mp4`,
    thumbnail: `/videos/thumbnails/0${video.id}.jpg`,
    alt: video.title || '',
    type: 'video' as const,
    title: video.title || '',
    description: video.description || '',
    category: video.category || '',
    category2: video.category2,
    location: video.location || '',
    tags: video.tags || '',
    year: video.year,
    duration: video.duration || '',
    services: video.services || ''
  }));
};

// Get all videos from metadata
export const getAllVideos = (): MediaContent[] => {
  return convertToMediaContent(Object.values(videoMetadata));
};

// Benzersiz kategorileri al 
export const getUniqueCategories = (): string[] => {
  const categories = getAllCategories();
  return ['All', ...categories];
};

// Kategoriye göre videoları filtrele
export const getVideosByCategory = (category: string): MediaContent[] => {
  if (category.toLowerCase() === 'all' || !category) {
    return getAllVideos();
  }
  
  const videos = getVideosFromMetadata(category);
  return convertToMediaContent(videos);
};

// Lokasyona göre videoları filtrele
export const getVideosByLocation = (location: string): MediaContent[] => {
  if (location === 'All' || !location) {
    return getAllVideos();
  }
  
  const allVideos = getAllVideos();
  return allVideos.filter(video => 
    video.location && video.location.toLowerCase() === location.toLowerCase()
  );
};

// Benzersiz lokasyonları al
export const getUniqueLocations = (): string[] => {
  const locations = new Set<string>();
  locations.add('All');
  
  const allVideos = getAllVideos();
  allVideos.forEach(video => {
    if (video.location && video.location.trim() !== '') {
      locations.add(video.location);
    }
  });
  
  return Array.from(locations).sort();
};

// Yıla göre videoları filtrele
export const getVideosByYear = (year: number): MediaContent[] => {
  const allVideos = getAllVideos();
  return allVideos.filter(video => video.year === year);
};

// Arama fonksiyonu - başlık, açıklama, etiketler içinde arama
export const searchVideos = (searchTerm: string): MediaContent[] => {
  const term = searchTerm.toLowerCase();
  const allVideos = getAllVideos();
  
  return allVideos.filter(video => {
    const searchableText = [
      video.title,
      video.description,
      video.tags,
      video.category,
      video.category2,
      video.location,
      video.services
    ].filter(Boolean).join(' ').toLowerCase();
    
    return searchableText.includes(term);
  });
};

// Rastgele video seç
export const getRandomVideos = (count: number): MediaContent[] => {
  const allVideos = getAllVideos();
  const shuffled = [...allVideos].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Sayfalama için video getir
export const getPaginatedVideos = (page: number, pageSize: number = 12): {
  videos: MediaContent[];
  totalPages: number;
  currentPage: number;
  totalVideos: number;
} => {
  const allVideos = getAllVideos();
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  
  return {
    videos: allVideos.slice(start, end),
    totalPages: Math.ceil(allVideos.length / pageSize),
    currentPage: page,
    totalVideos: allVideos.length
  };
};

// Kategori istatistikleri
export const getCategoryStats = (): { category: string; count: number }[] => {
  const stats = new Map<string, number>();
  const allVideos = getAllVideos();
  
  allVideos.forEach(video => {
    if (video.category) {
      stats.set(video.category, (stats.get(video.category) || 0) + 1);
    }
  });
  
  return Array.from(stats.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
};