import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Film, Image as ImageIcon } from 'lucide-react';
import type { SocialMediaPost } from '@/shared/types/socialMedia';

interface InstagramStoryPreviewProps {
  posts: SocialMediaPost[];
  brandName: string;
  brandAvatar?: string;
}

interface DayGroup {
  date: string;
  label: string;
  posts: SocialMediaPost[];
}

const InstagramStoryPreview: React.FC<InstagramStoryPreviewProps> = ({
  posts,
  brandName,
  brandAvatar,
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  // Group stories by day
  const dayGroups: DayGroup[] = useMemo(() => {
    const groups = new Map<string, SocialMediaPost[]>();

    posts.forEach((post) => {
      const date = post.scheduledAt
        ? post.scheduledAt.toDate().toISOString().split('T')[0]
        : 'unscheduled';
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(post);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayPosts]) => ({
        date,
        label: date === 'unscheduled'
          ? 'Planlanmamis'
          : new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        posts: dayPosts,
      }));
  }, [posts]);

  const currentDay = dayGroups[selectedDayIndex];
  const currentStory = currentDay?.posts[currentStoryIndex];

  const getStoryThumbnail = (post: SocialMediaPost): string | null => {
    if (post.media && post.media.length > 0) {
      return post.media[0].thumbnailUrl || post.media[0].url;
    }
    if (post.mediaUrls && post.mediaUrls.length > 0) {
      return post.mediaUrls[0];
    }
    return null;
  };

  const handlePrevDay = () => {
    if (selectedDayIndex > 0) {
      setSelectedDayIndex((prev) => prev - 1);
      setCurrentStoryIndex(0);
    }
  };

  const handleNextDay = () => {
    if (selectedDayIndex < dayGroups.length - 1) {
      setSelectedDayIndex((prev) => prev + 1);
      setCurrentStoryIndex(0);
    }
  };

  const handleStoryClick = (index: number) => {
    setCurrentStoryIndex(index);
  };

  if (!currentDay) return null;

  return (
    <div className="space-y-4">
      {/* Story Circles Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {dayGroups.map((day, dayIdx) => (
          <button
            key={day.date}
            type="button"
            onClick={() => {
              setSelectedDayIndex(dayIdx);
              setCurrentStoryIndex(0);
            }}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            <div
              className={`w-16 h-16 rounded-full p-0.5 ${
                dayIdx === selectedDayIndex
                  ? 'bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500'
                  : 'bg-neutral-300'
              }`}
            >
              <div className="w-full h-full rounded-full bg-white p-0.5">
                <div className="w-full h-full rounded-full bg-neutral-100 overflow-hidden flex items-center justify-center">
                  {day.posts[0] && getStoryThumbnail(day.posts[0]) ? (
                    <img
                      src={getStoryThumbnail(day.posts[0])!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-grotesk text-xs text-neutral-400">
                      {day.posts.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className="font-grotesk text-[10px] text-neutral-600 max-w-[60px] truncate">
              {day.label}
            </span>
          </button>
        ))}
      </div>

      {/* Story Viewer */}
      <div className="relative bg-black rounded-2xl overflow-hidden" style={{ aspectRatio: '9/16', maxHeight: '500px' }}>
        {/* Progress Bars */}
        <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
          {currentDay.posts.map((_, idx) => (
            <div
              key={idx}
              className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/30"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  idx < currentStoryIndex
                    ? 'bg-white w-full'
                    : idx === currentStoryIndex
                    ? 'bg-white w-full'
                    : 'bg-transparent w-0'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Profile Info */}
        <div className="absolute top-4 left-3 right-3 flex items-center gap-2 z-10">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white font-grotesk font-bold text-xs">
            {brandName[0]?.toUpperCase()}
          </div>
          <span className="font-grotesk text-xs text-white font-medium drop-shadow-md">
            {brandName}
          </span>
          <span className="font-grotesk text-[10px] text-white/70 drop-shadow-md">
            {currentDay.label}
          </span>
        </div>

        {/* Story Content */}
        {currentStory && (
          <div className="w-full h-full">
            {getStoryThumbnail(currentStory) ? (
              <img
                src={currentStory.media?.[0]?.url || currentStory.mediaUrls?.[0] || ''}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center p-6">
                <p className="font-grotesk text-sm text-white text-center">
                  {currentStory.caption || currentStory.title}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Caption Overlay */}
        {currentStory?.caption && getStoryThumbnail(currentStory) && (
          <div className="absolute bottom-12 left-3 right-3 z-10">
            <p className="font-grotesk text-xs text-white bg-black/40 rounded-lg p-2 line-clamp-3 backdrop-blur-sm">
              {currentStory.caption}
            </p>
          </div>
        )}

        {/* Navigation Arrows */}
        <button
          type="button"
          onClick={() => {
            if (currentStoryIndex > 0) {
              handleStoryClick(currentStoryIndex - 1);
            } else {
              handlePrevDay();
            }
          }}
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
          disabled={selectedDayIndex === 0 && currentStoryIndex === 0}
        />
        <button
          type="button"
          onClick={() => {
            if (currentStoryIndex < currentDay.posts.length - 1) {
              handleStoryClick(currentStoryIndex + 1);
            } else {
              handleNextDay();
            }
          }}
          className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
          disabled={selectedDayIndex === dayGroups.length - 1 && currentStoryIndex === currentDay.posts.length - 1}
        />
      </div>

      {/* Day Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevDay}
          disabled={selectedDayIndex === 0}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <span className="font-grotesk text-sm text-neutral-600">
          {currentDay.label} - {currentStoryIndex + 1}/{currentDay.posts.length} story
        </span>
        <button
          type="button"
          onClick={handleNextDay}
          disabled={selectedDayIndex === dayGroups.length - 1}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5 text-neutral-600" />
        </button>
      </div>
    </div>
  );
};

export default InstagramStoryPreview;
