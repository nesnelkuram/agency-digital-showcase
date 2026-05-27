import React, { useState, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import { updatePostSchedule } from '@/shared/services/socialMediaService';
import CalendarHeader, { CalendarViewMode } from './CalendarHeader';
import MonthView from './MonthView';
import WeekView from './WeekView';
import DayView from './DayView';

interface CalendarViewProps {
  posts: SocialMediaPost[];
  onPostsChange?: (posts: SocialMediaPost[]) => void;
  onPostClick?: (post: SocialMediaPost) => void;
  readOnly?: boolean;
  initialMode?: CalendarViewMode;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  posts,
  onPostsChange,
  onPostClick,
  readOnly = false,
  initialMode = 'month',
}) => {
  const [mode, setMode] = useState<CalendarViewMode>(initialMode);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [localPosts, setLocalPosts] = useState<SocialMediaPost[]>(posts);
  const postsRef = useRef(localPosts);

  // Sync external posts
  React.useEffect(() => {
    setLocalPosts(posts);
    postsRef.current = posts;
  }, [posts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = event;
    if (!over) return;

    const postId = active.id as string;
    const targetDateIso = (over.data.current as any)?.date as string | undefined;
    if (!targetDateIso) return;

    const post = postsRef.current.find((p) => p.id === postId);
    if (!post) return;
    const newDate = new Date(targetDateIso);

    // Preserve existing minutes when dragging to month view (only date changes)
    if (mode === 'month' && post.scheduledAt) {
      const prev = (post.scheduledAt as any).toDate
        ? (post.scheduledAt as any).toDate()
        : new Date(post.scheduledAt as any);
      newDate.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    }

    // Optimistic update
    const snapshot = postsRef.current;
    const optimistic = snapshot.map((p) =>
      p.id === postId
        ? {
            ...p,
            scheduledAt: {
              toDate: () => newDate,
              seconds: Math.floor(newDate.getTime() / 1000),
              nanoseconds: 0,
            } as any,
          }
        : p
    );
    setLocalPosts(optimistic);
    postsRef.current = optimistic;
    onPostsChange?.(optimistic);

    try {
      await updatePostSchedule(postId, newDate);
    } catch (err) {
      console.error('[CalendarView] schedule update failed', err);
      setLocalPosts(snapshot);
      postsRef.current = snapshot;
      onPostsChange?.(snapshot);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <CalendarHeader
          mode={mode}
          onModeChange={setMode}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          readOnly={readOnly}
        />
        {mode === 'month' && (
          <MonthView
            currentDate={currentDate}
            posts={localPosts}
            draggable={!readOnly}
            onPostClick={onPostClick}
          />
        )}
        {mode === 'week' && (
          <WeekView
            currentDate={currentDate}
            posts={localPosts}
            draggable={!readOnly}
            onPostClick={onPostClick}
          />
        )}
        {mode === 'day' && (
          <DayView
            currentDate={currentDate}
            posts={localPosts}
            draggable={!readOnly}
            onPostClick={onPostClick}
          />
        )}
      </div>
    </DndContext>
  );
};

export default CalendarView;
