import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Image as ImageIcon, Video, Film, Type as TypeIcon } from 'lucide-react';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import { POST_STATUS_COLORS, POST_STATUS_LABELS } from '@/shared/types/socialMedia';

interface GridPostTileProps {
  post: SocialMediaPost;
  draggable: boolean;
  onClick?: () => void;
}

function postIcon(post: SocialMediaPost) {
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

const GridPostTile: React.FC<GridPostTileProps> = ({ post, draggable, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: post.id,
    disabled: !draggable,
  });

  const Icon = postIcon(post);
  const thumb = post.media?.[0]?.thumbnailUrl || post.media?.[0]?.url;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      className={`relative aspect-square bg-neutral-100 overflow-hidden cursor-${
        draggable ? 'grab active:cursor-grabbing' : 'pointer'
      } group`}
    >
      {thumb ? (
        <img src={thumb} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Icon className="w-8 h-8 text-neutral-400" />
        </div>
      )}

      {/* Type badge */}
      <div className="absolute top-1 right-1 p-1 rounded-md bg-black/50 backdrop-blur-sm">
        <Icon className="w-3 h-3 text-white" />
      </div>

      {/* Status badge (hover) */}
      <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span
          className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-grotesk ${
            POST_STATUS_COLORS[post.status] || 'bg-white text-neutral-600'
          }`}
        >
          {POST_STATUS_LABELS[post.status]}
        </span>
      </div>
    </div>
  );
};

export default GridPostTile;
