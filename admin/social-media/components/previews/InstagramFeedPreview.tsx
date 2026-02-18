import React, { useState } from 'react';
import { X, Layers, Play, Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import type { SocialMediaPost } from '@/shared/types/socialMedia';

interface InstagramFeedPreviewProps {
  posts: SocialMediaPost[];
  brandName: string;
  brandAvatar?: string;
}

const InstagramFeedPreview: React.FC<InstagramFeedPreviewProps> = ({
  posts,
  brandName,
  brandAvatar,
}) => {
  const [selectedPost, setSelectedPost] = useState<SocialMediaPost | null>(null);

  const getPostThumbnail = (post: SocialMediaPost): string | null => {
    if (post.media && post.media.length > 0) {
      return post.media[0].thumbnailUrl || post.media[0].url;
    }
    if (post.mediaUrls && post.mediaUrls.length > 0) {
      return post.mediaUrls[0];
    }
    return null;
  };

  const getPostOverlay = (post: SocialMediaPost) => {
    if (post.postType === 'carousel' && post.media && post.media.length > 1) {
      return <Layers className="w-4 h-4 text-white drop-shadow-md" />;
    }
    if (post.postType === 'reels') {
      return <Play className="w-4 h-4 text-white drop-shadow-md" />;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white font-grotesk font-bold text-sm flex-shrink-0">
          {brandAvatar ? (
            <img src={brandAvatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            brandName[0]?.toUpperCase()
          )}
        </div>
        <div>
          <p className="font-grotesk text-sm font-semibold text-[#171717]">{brandName}</p>
          <p className="font-grotesk text-xs text-neutral-500">{posts.length} gonderi</p>
        </div>
      </div>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-3 gap-0.5">
        {posts.map((post) => {
          const thumbnail = getPostThumbnail(post);
          const overlay = getPostOverlay(post);

          return (
            <button
              key={post.id}
              type="button"
              onClick={() => setSelectedPost(post)}
              className="relative aspect-square bg-neutral-100 overflow-hidden group"
            >
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                  <p className="font-grotesk text-[10px] text-neutral-400 px-2 text-center truncate">
                    {post.title}
                  </p>
                </div>
              )}

              {overlay && (
                <div className="absolute top-2 right-2">
                  {overlay}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white font-grotesk font-bold text-xs">
                  {brandName[0]?.toUpperCase()}
                </div>
                <span className="font-grotesk text-sm font-semibold">{brandName}</span>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="p-1 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-600" />
              </button>
            </div>

            {/* Image */}
            {getPostThumbnail(selectedPost) && (
              <div className="aspect-square bg-neutral-100">
                <img
                  src={selectedPost.media?.[0]?.url || selectedPost.mediaUrls?.[0] || ''}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-4">
                <Heart className="w-6 h-6 text-neutral-700" />
                <MessageCircle className="w-6 h-6 text-neutral-700" />
                <Send className="w-6 h-6 text-neutral-700" />
              </div>
              <Bookmark className="w-6 h-6 text-neutral-700" />
            </div>

            {/* Caption */}
            <div className="px-4 pb-4">
              <p className="font-grotesk text-sm">
                <span className="font-semibold">{brandName}</span>{' '}
                <span className="text-neutral-700">{selectedPost.caption}</span>
              </p>
              {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                <p className="font-grotesk text-sm text-blue-600 mt-1">
                  {selectedPost.hashtags.map((h) => `#${h}`).join(' ')}
                </p>
              )}
              {selectedPost.scheduledAt && (
                <p className="font-grotesk text-xs text-neutral-400 mt-2">
                  {selectedPost.scheduledAt.toDate().toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstagramFeedPreview;
