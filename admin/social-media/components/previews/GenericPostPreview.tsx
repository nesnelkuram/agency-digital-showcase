import React from 'react';
import { ThumbsUp, MessageCircle, Share2, Image as ImageIcon, Film, Calendar } from 'lucide-react';
import type { SocialPlatform, SocialMediaPost } from '@/shared/types/socialMedia';
import { SOCIAL_PLATFORM_LABELS, POST_TYPE_LABELS, POST_TYPE_COLORS } from '@/shared/types/socialMedia';

interface GenericPostPreviewProps {
  platform: SocialPlatform;
  posts: SocialMediaPost[];
  brandName: string;
  brandAvatar?: string;
}

const GenericPostPreview: React.FC<GenericPostPreviewProps> = ({
  platform,
  posts,
  brandName,
  brandAvatar,
}) => {
  const getPostMedia = (post: SocialMediaPost): string | null => {
    if (post.media && post.media.length > 0) return post.media[0].thumbnailUrl || post.media[0].url;
    if (post.mediaUrls && post.mediaUrls.length > 0) return post.mediaUrls[0];
    return null;
  };

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const mediaUrl = getPostMedia(post);
        const isVideo = post.media?.[0]?.type === 'video' || post.postType === 'video';

        return (
          <div
            key={post.id}
            className="bg-white rounded-xl border border-neutral-200 overflow-hidden"
          >
            {/* Post Header */}
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 font-grotesk font-bold text-sm flex-shrink-0">
                {brandAvatar ? (
                  <img src={brandAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  brandName[0]?.toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-grotesk text-sm font-semibold text-[#171717]">{brandName}</p>
                <div className="flex items-center gap-2">
                  {post.scheduledAt && (
                    <p className="font-grotesk text-xs text-neutral-500">
                      {post.scheduledAt.toDate().toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-grotesk font-medium ${POST_TYPE_COLORS[post.postType]}`}>
                    {POST_TYPE_LABELS[post.postType]}
                  </span>
                </div>
              </div>
            </div>

            {/* Caption */}
            {post.caption && (
              <div className="px-4 pb-3">
                <p className="font-grotesk text-sm text-neutral-700 whitespace-pre-wrap">
                  {post.caption}
                </p>
                {post.hashtags && post.hashtags.length > 0 && (
                  <p className="font-grotesk text-sm text-blue-600 mt-1">
                    {post.hashtags.map((h) => `#${h}`).join(' ')}
                  </p>
                )}
              </div>
            )}

            {/* Media */}
            {mediaUrl && (
              <div className="relative">
                {isVideo ? (
                  <div className="aspect-video bg-neutral-100 flex items-center justify-center">
                    <img
                      src={mediaUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <Film className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={mediaUrl}
                    alt=""
                    className="w-full aspect-auto max-h-[400px] object-cover"
                  />
                )}

                {/* Carousel indicator */}
                {post.media && post.media.length > 1 && (
                  <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 rounded-lg">
                    <span className="font-grotesk text-xs text-white">
                      1/{post.media.length}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-6 px-4 py-3 border-t border-neutral-100">
              <button type="button" className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-700">
                <ThumbsUp className="w-4 h-4" />
                <span className="font-grotesk text-xs">Begen</span>
              </button>
              <button type="button" className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-700">
                <MessageCircle className="w-4 h-4" />
                <span className="font-grotesk text-xs">Yorum</span>
              </button>
              <button type="button" className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-700">
                <Share2 className="w-4 h-4" />
                <span className="font-grotesk text-xs">Paylas</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GenericPostPreview;
