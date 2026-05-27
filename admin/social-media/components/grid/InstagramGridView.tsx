import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import { updateGridPositions } from '@/shared/services/socialMediaService';
import GridPostTile from './GridPostTile';

interface InstagramGridViewProps {
  posts: SocialMediaPost[];
  onPostsChange?: (posts: SocialMediaPost[]) => void;
  onPostClick?: (post: SocialMediaPost) => void;
  readOnly?: boolean;
}

function sortPosts(posts: SocialMediaPost[]): SocialMediaPost[] {
  return [...posts].sort((a, b) => {
    const ap = a.gridPosition;
    const bp = b.gridPosition;
    if (typeof ap === 'number' && typeof bp === 'number') return ap - bp;
    if (typeof ap === 'number') return -1;
    if (typeof bp === 'number') return 1;
    // Fallback: scheduledAt desc (en yeni üstte, Instagram mantığı)
    const at = (a.scheduledAt as any)?.toDate?.()?.getTime?.() || 0;
    const bt = (b.scheduledAt as any)?.toDate?.()?.getTime?.() || 0;
    return bt - at;
  });
}

const InstagramGridView: React.FC<InstagramGridViewProps> = ({
  posts,
  onPostsChange,
  onPostClick,
  readOnly = false,
}) => {
  const [ordered, setOrdered] = useState<SocialMediaPost[]>(() => sortPosts(posts));
  const orderedRef = useRef(ordered);

  useEffect(() => {
    const sorted = sortPosts(posts);
    setOrdered(sorted);
    orderedRef.current = sorted;
  }, [posts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const ids = useMemo(() => ordered.map((p) => p.id), [ordered]);

  const handleDragEnd = async (event: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((p) => p.id === active.id);
    const newIndex = ordered.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const snapshot = ordered;
    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    orderedRef.current = next;
    onPostsChange?.(next);

    // Batch update: tüm post'ların yeni pozisyonları (basit + güvenli)
    const updates = next.map((p, idx) => ({ id: p.id, gridPosition: idx }));
    try {
      await updateGridPositions(updates);
    } catch (err) {
      console.error('[InstagramGridView] grid update failed', err);
      setOrdered(snapshot);
      orderedRef.current = snapshot;
      onPostsChange?.(snapshot);
    }
  };

  if (ordered.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
        <p className="font-grotesk text-sm text-neutral-500">Henüz post yok</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="bg-black rounded-xl p-1">
          <div className="grid grid-cols-3 gap-px bg-neutral-800">
            {ordered.map((post) => (
              <GridPostTile
                key={post.id}
                post={post}
                draggable={!readOnly}
                onClick={() => onPostClick?.(post)}
              />
            ))}
          </div>
        </div>
        {!readOnly && (
          <p className="font-grotesk text-[11px] text-neutral-400 text-center mt-2">
            Post'ları sürükleyerek Instagram feed sıralamasını ayarlayın
          </p>
        )}
      </SortableContext>
    </DndContext>
  );
};

export default InstagramGridView;
