import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Image as ImageIcon, Video, Film, Type as TypeIcon } from 'lucide-react';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import { POST_STATUS_COLORS } from '@/shared/types/socialMedia';

interface DraggablePostChipProps {
  post: SocialMediaPost;
  compact?: boolean;
  draggable?: boolean;
  onClick?: () => void;
}

function typeIcon(post: SocialMediaPost) {
  switch (post.postType) {
    case 'reels':
    case 'video':
      return Video;
    case 'story':
      return Film;
    case 'text':
      return TypeIcon;
    default:
      return ImageIcon;
  }
}

const DraggablePostChip: React.FC<DraggablePostChipProps> = ({
  post,
  compact = false,
  draggable = true,
  onClick,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: post.id,
    data: { post },
    disabled: !draggable,
  });

  const Icon = typeIcon(post);
  const thumbUrl = post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url;
  const transformStr = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      style={{ transform: transformStr, opacity: isDragging ? 0.4 : 1 }}
      className={`group relative w-full flex items-center gap-1.5 ${
        compact ? 'px-1.5 py-1' : 'px-2 py-1.5'
      } rounded-md border border-neutral-200 bg-white hover:border-neutral-400 transition-colors text-left ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      }`}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          className={`${compact ? 'w-5 h-5' : 'w-7 h-7'} rounded object-cover flex-shrink-0`}
        />
      ) : (
        <div
          className={`${
            compact ? 'w-5 h-5' : 'w-7 h-7'
          } rounded bg-neutral-100 flex items-center justify-center flex-shrink-0`}
        >
          <Icon className="w-3 h-3 text-neutral-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`font-grotesk ${compact ? 'text-[10px]' : 'text-[11px]'} text-[#171717] truncate`}>
          {post.title || post.caption?.slice(0, 24) || 'İsimsiz'}
        </p>
        {!compact && (
          <span
            className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-grotesk ${
              POST_STATUS_COLORS[post.status] || 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {post.postType}
          </span>
        )}
      </div>
    </button>
  );
};

export default DraggablePostChip;
