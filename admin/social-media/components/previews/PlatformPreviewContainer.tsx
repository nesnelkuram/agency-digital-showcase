import React from 'react';
import type { SocialPlatform, SocialMediaPost } from '@/shared/types/socialMedia';
import InstagramFeedPreview from './InstagramFeedPreview';
import InstagramStoryPreview from './InstagramStoryPreview';
import TikTokPreview from './TikTokPreview';
import GenericPostPreview from './GenericPostPreview';

interface PlatformPreviewContainerProps {
  platform: SocialPlatform;
  posts: SocialMediaPost[];
  brandName?: string;
  brandAvatar?: string;
}

const PlatformPreviewContainer: React.FC<PlatformPreviewContainerProps> = ({
  platform,
  posts,
  brandName = 'Brand',
  brandAvatar,
}) => {
  if (posts.length === 0) {
    return (
      <div className="bg-neutral-50 rounded-xl p-8 text-center">
        <p className="font-grotesk text-sm text-neutral-500">
          Bu platform icin henuz icerik yok.
        </p>
      </div>
    );
  }

  switch (platform) {
    case 'instagram': {
      const feedPosts = posts.filter(
        (p) => p.postType === 'static' || p.postType === 'carousel' || p.postType === 'reels'
      );
      const storyPosts = posts.filter((p) => p.postType === 'story');

      return (
        <div className="space-y-6">
          {storyPosts.length > 0 && (
            <InstagramStoryPreview
              posts={storyPosts}
              brandName={brandName}
              brandAvatar={brandAvatar}
            />
          )}
          {feedPosts.length > 0 && (
            <InstagramFeedPreview
              posts={feedPosts}
              brandName={brandName}
              brandAvatar={brandAvatar}
            />
          )}
        </div>
      );
    }

    case 'tiktok':
      return (
        <TikTokPreview
          posts={posts}
          brandName={brandName}
          brandAvatar={brandAvatar}
        />
      );

    default:
      return (
        <GenericPostPreview
          platform={platform}
          posts={posts}
          brandName={brandName}
          brandAvatar={brandAvatar}
        />
      );
  }
};

export default PlatformPreviewContainer;
