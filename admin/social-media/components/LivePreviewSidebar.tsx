import React, { useState, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import type {
  SocialPlatform,
  PostType,
  MediaItem,
  SocialMediaPost,
} from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS } from '@/shared/types/socialMedia';
import InstagramFeedPreview from './previews/InstagramFeedPreview';
import InstagramStoryPreview from './previews/InstagramStoryPreview';
import TikTokPreview from './previews/TikTokPreview';
import GenericPostPreview from './previews/GenericPostPreview';

interface LivePreviewSidebarProps {
  platforms: SocialPlatform[];
  postType: PostType;
  caption: string;
  media: MediaItem[];
  scheduledAt?: Date;
  brandName?: string;
}

const LivePreviewSidebar: React.FC<LivePreviewSidebarProps> = ({
  platforms,
  postType,
  caption,
  media,
  scheduledAt,
  brandName = 'Brand',
}) => {
  const [activeTab, setActiveTab] = useState<SocialPlatform | null>(
    platforms.length > 0 ? platforms[0] : null
  );

  // Keep activeTab in sync with platforms
  React.useEffect(() => {
    if (platforms.length > 0 && (!activeTab || !platforms.includes(activeTab))) {
      setActiveTab(platforms[0]);
    }
    if (platforms.length === 0) {
      setActiveTab(null);
    }
  }, [platforms, activeTab]);

  // Build a mock SocialMediaPost from the form data
  const mockPost: SocialMediaPost = useMemo(() => {
    const hashtagMatches = caption.match(/#[\w\u00C0-\u024F]+/g);
    const hashtags = hashtagMatches
      ? hashtagMatches.map((h) => h.replace('#', ''))
      : [];

    return {
      id: 'preview',
      projectId: '',
      title: caption.slice(0, 60) || 'Onizleme',
      caption,
      hashtags,
      mediaUrls: media.map((m) => m.url),
      media,
      postType,
      platforms,
      status: 'draft',
      tags: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: '',
      createdByName: '',
      scheduledAt: scheduledAt ? Timestamp.fromDate(scheduledAt) : undefined,
    };
  }, [caption, media, postType, platforms, scheduledAt]);

  if (platforms.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center p-6">
        <p className="font-grotesk text-sm text-neutral-400">
          Platform secin, onizleme burada gorunecek
        </p>
      </div>
    );
  }

  const renderPreview = () => {
    if (!activeTab) return null;

    const posts = [mockPost];

    switch (activeTab) {
      case 'instagram':
        if (postType === 'story') {
          return (
            <InstagramStoryPreview
              posts={posts}
              brandName={brandName}
            />
          );
        }
        return (
          <InstagramFeedPreview
            posts={posts}
            brandName={brandName}
          />
        );

      case 'tiktok':
        return (
          <TikTokPreview
            posts={posts}
            brandName={brandName}
          />
        );

      default:
        return (
          <GenericPostPreview
            platform={activeTab}
            posts={posts}
            brandName={brandName}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Platform tabs */}
      {platforms.length > 1 && (
        <div className="flex gap-1 p-2 border-b border-neutral-100">
          {platforms.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => setActiveTab(platform)}
              className={`px-3 py-1.5 rounded-lg font-grotesk text-xs font-medium transition-all ${
                activeTab === platform
                  ? 'bg-[#171717] text-white'
                  : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              {SOCIAL_PLATFORM_LABELS[platform]}
            </button>
          ))}
        </div>
      )}

      {/* Preview area */}
      <div className="flex-1 overflow-y-auto p-3">
        {renderPreview()}
      </div>
    </div>
  );
};

export default LivePreviewSidebar;
