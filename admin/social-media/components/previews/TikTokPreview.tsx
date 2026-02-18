import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Music, Film } from 'lucide-react';
import type { SocialMediaPost } from '@/shared/types/socialMedia';

interface TikTokPreviewProps {
  posts: SocialMediaPost[];
  brandName: string;
  brandAvatar?: string;
}

const TikTokPreview: React.FC<TikTokPreviewProps> = ({
  posts,
  brandName,
  brandAvatar,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const currentPost = posts[selectedIndex];

  const getPostMedia = (post: SocialMediaPost): string | null => {
    if (post.media && post.media.length > 0) return post.media[0].url;
    if (post.mediaUrls && post.mediaUrls.length > 0) return post.mediaUrls[0];
    return null;
  };

  if (!currentPost) return null;

  return (
    <div className="space-y-4">
      {/* Video List (horizontal scroll) */}
      {posts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {posts.map((post, idx) => (
            <button
              key={post.id}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                idx === selectedIndex ? 'border-[#171717]' : 'border-neutral-200'
              }`}
            >
              {getPostMedia(post) ? (
                <img
                  src={post.media?.[0]?.thumbnailUrl || getPostMedia(post)!}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
                  <Film className="w-4 h-4 text-neutral-400" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* TikTok Phone Preview */}
      <div
        className="relative bg-black rounded-2xl overflow-hidden mx-auto"
        style={{ aspectRatio: '9/16', maxHeight: '550px', maxWidth: '310px' }}
      >
        {/* Video/Image Content */}
        {getPostMedia(currentPost) ? (
          <img
            src={getPostMedia(currentPost)!}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center">
            <Film className="w-12 h-12 text-gray-600" />
          </div>
        )}

        {/* Right Side Actions */}
        <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-10">
          {/* Profile */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-white overflow-hidden">
              {brandAvatar ? (
                <img src={brandAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white font-grotesk font-bold text-sm">
                  {brandName[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">+</span>
            </div>
          </div>

          {/* Like */}
          <div className="flex flex-col items-center gap-1">
            <Heart className="w-7 h-7 text-white drop-shadow-lg" />
            <span className="font-grotesk text-[10px] text-white drop-shadow-lg">0</span>
          </div>

          {/* Comment */}
          <div className="flex flex-col items-center gap-1">
            <MessageCircle className="w-7 h-7 text-white drop-shadow-lg" />
            <span className="font-grotesk text-[10px] text-white drop-shadow-lg">0</span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center gap-1">
            <Share2 className="w-7 h-7 text-white drop-shadow-lg" />
            <span className="font-grotesk text-[10px] text-white drop-shadow-lg">0</span>
          </div>

          {/* Bookmark */}
          <Bookmark className="w-7 h-7 text-white drop-shadow-lg" />

          {/* Music disc */}
          <div className="w-9 h-9 rounded-lg bg-neutral-700 border-2 border-neutral-600 overflow-hidden flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Bottom Info */}
        <div className="absolute bottom-4 left-3 right-14 z-10">
          <p className="font-grotesk text-sm font-semibold text-white drop-shadow-lg">
            @{brandName.toLowerCase().replace(/\s+/g, '')}
          </p>
          {currentPost.caption && (
            <p className="font-grotesk text-xs text-white/90 mt-1 line-clamp-3 drop-shadow-lg">
              {currentPost.caption}
            </p>
          )}
          {currentPost.hashtags && currentPost.hashtags.length > 0 && (
            <p className="font-grotesk text-xs text-white/80 mt-1 drop-shadow-lg">
              {currentPost.hashtags.map((h) => `#${h}`).join(' ')}
            </p>
          )}
          {/* Music bar */}
          <div className="flex items-center gap-2 mt-2">
            <Music className="w-3 h-3 text-white/70" />
            <div className="overflow-hidden flex-1">
              <p className="font-grotesk text-[10px] text-white/70 whitespace-nowrap animate-marquee">
                Original Sound - {brandName}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Post Info */}
      <div className="bg-neutral-50 rounded-xl p-4 space-y-2">
        <h4 className="font-grotesk text-sm font-semibold text-[#171717]">
          {currentPost.title}
        </h4>
        {currentPost.scheduledAt && (
          <p className="font-grotesk text-xs text-neutral-500">
            Planlanan: {currentPost.scheduledAt.toDate().toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  );
};

export default TikTokPreview;
