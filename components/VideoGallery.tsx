import React, { useState, useEffect, useCallback } from 'react';
import { MediaContent } from '../types';
import { getUniqueCategories, getVideosByCategory, getUniqueLocations, getVideosByLocation, getAllVideos } from '../videoUtils';

interface VideoGalleryProps {
  initialVideos?: MediaContent[];
  showFilters?: boolean;
  columns?: number;
  autoLoad?: boolean;
}

const VideoGallery: React.FC<VideoGalleryProps> = ({
  initialVideos,
  showFilters = true,
  columns = 4,
  autoLoad = false
}) => {
  const allVideos = getAllVideos();
  const defaultInitialVideos = initialVideos || allVideos;
  const [videos, setVideos] = useState<MediaContent[]>(defaultInitialVideos);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);

  const categories = getUniqueCategories();
  const locations = getUniqueLocations();

  // Kategori veya lokasyon değiştiğinde videoları filtrele
  useEffect(() => {
    const filterVideos = async () => {
      setIsLoading(true);
      
      // Simüle edilmiş yükleme gecikmesi
      await new Promise(resolve => setTimeout(resolve, 300));
      
      let filteredVideos = getVideosByCategory(selectedCategory);
      
      if (selectedLocation !== 'All') {
        filteredVideos = filteredVideos.filter(video => 
          video.location && video.location === selectedLocation
        );
      }
      
      setVideos(filteredVideos);
      setIsLoading(false);
    };

    if (selectedCategory !== 'All' || selectedLocation !== 'All' || autoLoad) {
      filterVideos();
    } else {
      const allVideos = getAllVideos();
      setVideos(initialVideos || allVideos);
    }
  }, [selectedCategory, selectedLocation, autoLoad, initialVideos]);

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    setSelectedLocation('All'); // Kategori değiştiğinde lokasyonu sıfırla
  }, []);

  const handleLocationChange = useCallback((location: string) => {
    setSelectedLocation(location);
  }, []);

  const playVideo = useCallback((videoId: string) => {
    const videoElement = document.getElementById(`video-${videoId}`) as HTMLVideoElement;
    if (videoElement) {
      videoElement.play().catch(console.error);
    }
  }, []);

  const pauseVideo = useCallback((videoId: string) => {
    const videoElement = document.getElementById(`video-${videoId}`) as HTMLVideoElement;
    if (videoElement) {
      videoElement.pause();
    }
  }, []);

  return (
    <div className="w-full">
      {/* Filtreler */}
      {showFilters && (
        <div className="mb-8 space-y-4">
          {/* Kategori Filtreleri */}
          <div>
            <h3 className="font-grotesk text-sm font-medium text-neutral-600 mb-3">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`px-4 py-2 rounded-full text-sm font-grotesk transition-all duration-300 ${
                    selectedCategory === category
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Lokasyon Filtreleri */}
          <div>
            <h3 className="font-grotesk text-sm font-medium text-neutral-600 mb-3">Locations</h3>
            <div className="flex flex-wrap gap-2">
              {locations.map(location => (
                <button
                  key={location}
                  onClick={() => handleLocationChange(location)}
                  className={`px-3 py-1.5 rounded-full text-sm font-grotesk transition-all duration-300 ${
                    selectedLocation === location
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {location}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="relative group cursor-pointer overflow-hidden rounded-lg bg-neutral-100"
              onMouseEnter={() => {
                setHoveredVideo(video.id);
                playVideo(video.id);
              }}
              onMouseLeave={() => {
                setHoveredVideo(null);
                pauseVideo(video.id);
              }}
            >
              {/* Video */}
              <div className="aspect-[9/16] relative">
                <video
                  id={`video-${video.id}`}
                  src={hoveredVideo === video.id ? video.fullVideo : video.preview}
                  className="w-full h-full object-cover"
                  loop
                  muted
                  playsInline
                  preload="none"
                />
                
                {/* Overlay with info */}
                <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${
                  hoveredVideo === video.id ? 'opacity-100' : 'opacity-0'
                }`}>
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h4 className="font-grotesk font-medium text-sm mb-1">{video.title}</h4>
                    <p className="text-xs opacity-80 line-clamp-2">{video.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-white/20 rounded-full">
                        {video.category}
                      </span>
                      {video.location && (
                        <span className="text-xs px-2 py-1 bg-white/20 rounded-full">
                          {video.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video sayısı bilgisi */}
      {!isLoading && (
        <div className="mt-6 text-center">
          <p className="font-grotesk text-sm text-neutral-600">
            Showing {videos.length} of {allVideos.length} videos
          </p>
        </div>
      )}
    </div>
  );
};

export default VideoGallery;