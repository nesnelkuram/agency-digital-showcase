import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UploadService } from '@/studio/library/uploadService';
import UploadTray from '@/studio/components/UploadTray';
import { mkFile, multiDeps, until } from './helpers/uploadDeps';

describe('UploadTray: bağımlılık hatası', () => {
  it('hata görünür; "Tekrar dene" yalnız 1 yeni deneme yapar ve düzelince yükleme sürer', async () => {
    const m = multiDeps();
    let ok = false;
    const getDeps = vi.fn(async () => {
      if (!ok) throw new Error('chunk');
      return m.deps;
    });
    const svc = new UploadService(getDeps, (() => { let n = 0; return () => `t${++n}`; })());
    svc.bindSession('u1');
    render(<UploadTray service={svc} />);
    svc.enqueue([mkFile('a.jpg')], { tenantId: 't1', projectId: 'p', tags: [], actor: { uid: 'u1' } });
    const alert = await screen.findByTestId('upload-deps-error');
    expect(alert.textContent).toMatch(/yüklenemedi/);
    expect(getDeps).toHaveBeenCalledTimes(1);
    ok = true;
    fireEvent.click(screen.getByText('Tekrar dene'));
    await until(() => m.mainHandles().length === 1);
    expect(getDeps).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('upload-deps-error')).toBeNull();
  });
});
