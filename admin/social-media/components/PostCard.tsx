import React from 'react';
import { Calendar, Clock, Image as ImageIcon, Film } from 'lucide-react';
import type { SocialPostSummary } from '@/shared/types/socialMedia';
import {
  POST_TYPE_LABELS,
  POST_TYPE_COLORS,
  POST_STATUS_LABELS,
  POST_STATUS_COLORS,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_COLORS,
} from '@/shared/types/socialMedia';

interface PostCardProps {
  post: SocialPostSummary;
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const formattedScheduledAt = post.scheduledAt
    ? post.scheduledAt.toDate().toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const formattedCreatedAt = post.createdAt
    ? post.createdAt.toDate().toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const displayTitle = post.title || post.caption?.slice(0, 60) || 'Isimsiz Post';
  const thumbnail = post.media?.[0];

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-4 hover:shadow-sm transition-shadow">
      <div className="flex gap-3 mb-3">
        {/* Media Thumbnail */}
        {thumbnail && (
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
            {thumbnail.type === 'image' ? (
              <img
                src={thumbnail.thumbnailUrl || thumbnail.url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-5 h-5 text-neutral-400" />
              </div>
            )}
          </div>
        )}
        {/* Title */}
        <h3 className="font-grotesk font-medium text-[#171717] text-sm truncate flex-1">
          {displayTitle}
        </h3>
      </div>

      {/* Badges Row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {/* Post Type */}
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-grotesk font-medium ${POST_TYPE_COLORS[post.postType]}`}
        >
          {POST_TYPE_LABELS[post.postType]}
        </span>

        {/* Status */}
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-grotesk font-medium ${POST_STATUS_COLORS[post.status]}`}
        >
          {POST_STATUS_LABELS[post.status]}
        </span>
      </div>

      {/* Platform Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {post.platforms.map((platform) => (
          <span
            key={platform}
            className={`px-2 py-0.5 rounded-full text-xs font-grotesk font-medium ${SOCIAL_PLATFORM_COLORS[platform]}`}
          >
            {SOCIAL_PLATFORM_LABELS[platform]}
          </span>
        ))}
      </div>

      {/* Dates */}
      <div className="flex flex-col gap-1 pt-2 border-t border-neutral-50">
        {formattedScheduledAt && (
          <div className="flex items-center gap-1.5 text-xs font-grotesk text-neutral-500">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span>{formattedScheduledAt}</span>
          </div>
        )}
        {formattedCreatedAt && (
          <div className="flex items-center gap-1.5 text-xs font-grotesk text-neutral-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{formattedCreatedAt}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PostCard;
