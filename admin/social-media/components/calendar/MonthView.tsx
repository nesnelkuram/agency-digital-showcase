import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import DraggablePostChip from './DraggablePostChip';

interface MonthViewProps {
  currentDate: Date;
  posts: SocialMediaPost[];
  draggable: boolean;
  onPostClick?: (post: SocialMediaPost) => void;
}

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function startOfMonthGrid(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfWeek = (first.getDay() + 6) % 7; // Monday=0
  first.setDate(first.getDate() - dayOfWeek);
  first.setHours(0, 0, 0, 0);
  return first;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function DayCell({
  date,
  currentMonth,
  posts,
  draggable,
  onPostClick,
}: {
  date: Date;
  currentMonth: number;
  posts: SocialMediaPost[];
  draggable: boolean;
  onPostClick?: (post: SocialMediaPost) => void;
}) {
  const slotId = `slot-day-${dateKey(date)}`;
  const { setNodeRef, isOver } = useDroppable({ id: slotId, data: { date: date.toISOString() } });
  const outOfMonth = date.getMonth() !== currentMonth;
  const isToday = dateKey(date) === dateKey(new Date());

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[110px] p-1.5 border border-neutral-100 ${
        outOfMonth ? 'bg-neutral-50/50' : 'bg-white'
      } ${isOver ? 'ring-2 ring-[#171717] ring-inset' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-[11px] font-grotesk ${
            isToday
              ? 'bg-[#171717] text-white rounded-full w-5 h-5 flex items-center justify-center'
              : outOfMonth
              ? 'text-neutral-400'
              : 'text-neutral-700'
          }`}
        >
          {date.getDate()}
        </span>
        {posts.length > 0 && (
          <span className="text-[10px] text-neutral-400 font-grotesk">{posts.length}</span>
        )}
      </div>
      <div className="space-y-1 max-h-[90px] overflow-y-auto">
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

const MonthView: React.FC<MonthViewProps> = ({ currentDate, posts, draggable, onPostClick }) => {
  const grid = useMemo(() => {
    const start = startOfMonthGrid(currentDate);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialMediaPost[]>();
    for (const p of posts) {
      if (!p.scheduledAt) continue;
      const d = (p.scheduledAt as any).toDate ? (p.scheduledAt as any).toDate() : new Date(p.scheduledAt as any);
      const key = dateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [posts]);

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-neutral-100 bg-neutral-50">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 font-grotesk text-[11px] font-semibold text-neutral-500 text-center"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((date) => (
          <DayCell
            key={date.toISOString()}
            date={date}
            currentMonth={currentDate.getMonth()}
            posts={postsByDay.get(dateKey(date)) || []}
            draggable={draggable}
            onPostClick={onPostClick}
          />
        ))}
      </div>
    </div>
  );
};

export default MonthView;
