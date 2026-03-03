import type { PostStatus } from '@/shared/types/socialMedia';
import { POST_STATUS_LABELS, POST_STATUS_COLORS } from '@/shared/types/socialMedia';

interface PostApprovalBadgeProps {
  status: PostStatus;
  size?: 'sm' | 'md';
}

export default function PostApprovalBadge({ status, size = 'sm' }: PostApprovalBadgeProps) {
  const label = POST_STATUS_LABELS[status] || status;
  const color = POST_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium font-grotesk ${color} ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      }`}
    >
      {label}
    </span>
  );
}
