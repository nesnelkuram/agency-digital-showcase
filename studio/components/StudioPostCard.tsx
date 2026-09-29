import React from 'react';
import { Image as ImageIcon, Film, MessageSquareWarning } from 'lucide-react';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import { POST_TYPE_LABELS } from '@/shared/types/socialMedia';
import { STUDIO_STATUS_COLOR, STUDIO_STATUS_LABEL, formatDate, postThumb } from '../studioData';

interface Props {
  post: SocialMediaPost;
  onClick?: () => void;
  children?: React.ReactNode;
  compact?: boolean;
}

/** Studio post kartı — görsel, metin özeti, durum ve varsa revizyon notu */
const StudioPostCard: React.FC<Props> = ({ post, onClick, children, compact }) => {
  const thumb = postThumb(post);
  const isVideo = post.media?.[0]?.type === 'video';
  const note =
    post.status === 'revision_requested'
      ? post.lastRevisionComment
      : post.status === 'revision_requested_internal'
        ? post.lastInternalRevisionComment
        : undefined;

  return (
    <div
      className={`bg-white rounded-xl border border-neutral-200 overflow-hidden ${onClick ? 'cursor-pointer hover:border-neutral-300 hover:shadow-sm transition-all' : ''}`}
      onClick={onClick}
    >
      <div className="flex gap-3 p-3">
        <div className={`${compact ? 'w-14 h-14' : 'w-20 h-20'} shrink-0 rounded-lg bg-neutral-100 overflow-hidden flex items-center justify-center`}>
          {thumb ? (
            <img src={thumb} alt="" className="w-full h-full object-cover" />
          ) : isVideo ? (
            <Film className="w-5 h-5 text-neutral-400" />
          ) : (
            <ImageIcon className="w-5 h-5 text-neutral-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full font-grotesk text-[10px] font-medium ${STUDIO_STATUS_COLOR[post.status] || 'bg-neutral-100 text-neutral-600'}`}>
              {STUDIO_STATUS_LABEL[post.status] || post.status}
            </span>
            <span className="font-grotesk text-[10px] text-neutral-400">{POST_TYPE_LABELS[post.postType] || post.postType}</span>
            {post.scheduledAt && <span className="font-grotesk text-[10px] text-neutral-400">· {formatDate(post.scheduledAt, true)}</span>}
          </div>
          <p className={`font-grotesk text-xs text-neutral-700 mt-1 ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
            {post.title || post.caption || <span className="text-neutral-400">Metin yok</span>}
          </p>
          {note && (
            <p className="mt-1.5 flex items-start gap-1 font-grotesk text-[11px] text-red-600">
              <MessageSquareWarning className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span className="line-clamp-2">{note}</span>
            </p>
          )}
        </div>
      </div>
      {children && <div className="border-t border-neutral-100 px-3 py-2">{children}</div>}
    </div>
  );
};

export default StudioPostCard;
