import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import CalendarBoard from '@/studio/components/CalendarBoard';

const at = (days: number, h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, 0, 0, 0);
  return Timestamp.fromDate(d);
};
const post = (id: string, days: number, h: number, extra: any = {}) =>
  ({ id, projectId: 'p', status: 'draft', postType: 'static', platforms: ['instagram'], caption: `metin ${id}`, scheduledAt: at(days, h), tags: [], ...extra }) as any;

describe('CalendarBoard', () => {
  it('hafta görünümünde bugünkü içerik saatiyle görünür; oluşturma ve tıklama çalışır', () => {
    const onPostClick = vi.fn();
    const onCreate = vi.fn();
    render(
      <CalendarBoard
        posts={[post('a', 0, 13), post('b', 1, 9, { postType: 'reels', status: 'pending_approval' })]}
        onPostClick={onPostClick}
        onCreate={onCreate}
        onReschedule={() => {}}
      />
    );
    expect(screen.getByText('13:00')).toBeTruthy();
    expect(screen.getByText('Bugün')).toBeTruthy();
    fireEvent.click(screen.getByText('metin a'));
    expect(onPostClick).toHaveBeenCalled();
  });

  it('ay görünümüne geçer ve filtre uygular', () => {
    render(
      <CalendarBoard posts={[post('a', 0, 13), post('b', 0, 15, { postType: 'reels' })]} onPostClick={() => {}} onCreate={() => {}} onReschedule={() => {}} />
    );
    fireEvent.click(screen.getByText('Ay'));
    expect(screen.getByText('Pazartesi')).toBeTruthy();
    fireEvent.click(screen.getByText(/İçerik Türü/));
    fireEvent.mouseDown(screen.getByText('Reels'));
    expect(screen.queryByText('metin a')).toBeNull();
    expect(screen.getByText('metin b')).toBeTruthy();
  });
});
