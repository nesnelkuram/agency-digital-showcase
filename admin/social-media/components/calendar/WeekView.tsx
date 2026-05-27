import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import DraggablePostChip from './DraggablePostChip';

interface WeekViewProps {
  currentDate: Date;
  posts: SocialMediaPost[];
  draggable: boolean;
  onPostClick?: (post: SocialMediaPost) => void;
}

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d;
}

function slotKey(day: Date, hour: number): string {
  return `slot-hour-${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
    day.getDate()
  ).padStart(2, '0')}T${String(hour).padStart(2, '0')}`;
}

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
  const id = slotKey(day, hour);
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0).toISOString() },
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative min-h-[48px] border-b border-neutral-100 p-1 ${
        isOver ? 'bg-neutral-100 ring-1 ring-[#171717] ring-inset' : ''
      }`}
    >
      <div className="space-y-0.5">
        {posts.map((p) => (
          <DraggablePostChip
            key={p.id}
            post={p}
            compact
            draggable={draggable}
            onClick={() => onPostClick?.(p)}
          />
        ))}
      </div>
    </div>
  );
}

const WeekView: React.FC<WeekViewProps> = ({ currentDate, posts, draggable, onPostClick }) => {
  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const postsByDayHour = useMemo(() => {
    const map = new Map<string, SocialMediaPost[]>();
    for (const p of posts) {
      if (!p.scheduledAt) continue;
      const d = (p.scheduledAt as any).toDate ? (p.scheduledAt as any).toDate() : new Date(p.scheduledAt as any);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [posts]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-neutral-100 bg-neutral-50">
          <div className="px-2 py-2" />
          {days.map((d, i) => {
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div
                key={d.toISOString()}
                className="px-2 py-2 font-grotesk text-[11px] text-center border-l border-neutral-100"
              >
                <div className="text-neutral-500">{WEEKDAYS[i]}</div>
                <div
                  className={`mt-0.5 font-bold ${
                    isToday ? 'text-white bg-[#171717] rounded-full w-5 h-5 mx-auto flex items-center justify-center' : 'text-[#171717]'
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hour grid */}
        <div className="max-h-[560px] overflow-y-auto">
          {HOURS.map((h) => (
            <div
              key={h}
              className="grid grid-cols-[60px_repeat(7,1fr)]"
            >
              <div className="px-2 py-1 font-grotesk text-[10px] text-neutral-400 border-r border-neutral-100 bg-neutral-50">
                {String(h).padStart(2, '0')}:00
              </div>
              {days.map((d) => {
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                  d.getDate()
                ).padStart(2, '0')}T${String(h).padStart(2, '0')}`;
                return (
                  <HourSlot
                    key={key}
                    day={d}
                    hour={h}
                    posts={postsByDayHour.get(key) || []}
                    draggable={draggable}
                    onPostClick={onPostClick}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeekView;
