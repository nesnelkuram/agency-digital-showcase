import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const updateDoc = vi.fn(async () => {});
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<any>()),
  doc: vi.fn(() => ({})),
  updateDoc: (...args: any[]) => (updateDoc as any)(...args),
  serverTimestamp: () => 'ts',
}));
vi.mock('@/lib/firebase/config', () => ({ db: {} }));
vi.mock('@/shared/hooks/useMediaUpload', () => ({
  useMediaUpload: () => ({ uploadFiles: vi.fn(async () => []), uploading: false, error: null }),
}));

import StudioPostDetail from '@/studio/components/StudioPostDetail';

describe('StudioPostDetail — eski mediaUrls kayıtları (Codex ara inceleme 10 takip)', () => {
  beforeEach(() => updateDoc.mockClear());

  it('yalnızca mediaUrls olan post: medya görünür ve metin kaydı medyayı silmez', async () => {
    const post: any = {
      id: 'p1', projectId: 'proj', status: 'draft', postType: 'static', platforms: ['instagram'],
      caption: 'eski', media: [], mediaUrls: ['https://example.invalid/existing.png'], tags: [],
    };
    render(<StudioPostDetail post={post} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByText('Medya yok')).toBeNull();
    fireEvent.change(screen.getByDisplayValue('eski'), { target: { value: 'yeni metin' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = (updateDoc.mock.calls[0] as any[])[1];
    expect(patch.caption).toBe('yeni metin');
    expect(patch).not.toHaveProperty('media');
    expect(patch).not.toHaveProperty('mediaUrls');
  });
});
