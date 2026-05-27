import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import DraggablePostChip from './DraggablePostChip';

interface DayViewProps {
  currentDate: Date;
  posts: SocialMediaPost[];
  draggable: boolean;
  onPostClick?: (post: SocialMediaPost) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HourSlot({
  day,
  hour,
  posts,
  draggable,
  onPostClick,
}: {
  day: Date;
  hour: number;
  posts: SocialMediaPost[];
  draggable: boolean;
  onPostClick?: (post: SocialMediaPost) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-day-hour-${day.toISOString()}-${hour}`,
    data: {
      date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0).toISOString(),
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[60px] border-b border-neutral-100 p-1.5 ${
        isOver ? 'bg-neutral-100 ring-1 ring-[#171717] ring-inset' : ''
      }`}
    >
      <div className="space-y-1">
        {posts.map((p) => (
          <DraggablePostChip
            key={p.id}
            post={p}
            draggable={draggable}
            onClick={() => onPostClick?.(p)}
          />
        ))}
      </div>
    </div>
  );
}

const DayView: React.FC<DayViewProps> = ({ currentDate, posts, draggable, onPostClick }) => {
  const postsByHour = useMemo(() => {
    const map = new Map<number, SocialMediaPost[]>();
    for (const p of posts) {
      if (!p.scheduledAt) continue;
      const d = (p.scheduledAt as any).toDate ? (p.scheduledAt as any).toDate() : new Date(p.scheduledAt as any);
      if (
        d.getFullYear() !== currentDate.getFullYear() ||
        d.getMonth() !== currentDate.getMonth() ||
        d.getDate() !== currentDate.getDate()
      ) {
        continue;
      }
      const h = d.getHours();
      if (!map.has(h)) map.set(h, []);
      map.get(h)!.push(p);
    }
    return map;
  }, [posts, currentDate]);

  return (
    <div className="max-h-[640px] overflow-y-auto">
      {HOURS.map((h) => (
        <div key={h} className="grid grid-cols-[60px_1fr]">
          <div className="px-2 py-1.5 font-grotesk text-[10px] text-neutral-400 border-r border-neutral-100 bg-neutral-50">
            {String(h).padStart(2, '0')}:00
          </div>
          <HourSlot
            day={currentDate}
            hour={h}
            posts={postsByHour.get(h) || []}
            draggable={draggable}
            onPostClick={onPostClick}
          />
        </div>
      ))}
    </div>
  );
};

export default DayView;
