import { describe, it, expect, afterEach } from 'vitest';
import { mediaAnalysisState, storageBucketName } from '../api/_lib/integrations/config';

const KEYS = ['MEDIA_AI_ANALYSIS_ENABLED', 'OPENROUTER_API_KEY', 'FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET', 'MEDIA_AI_MODEL'];
const saved: Record<string, string | undefined> = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const set = (o: Record<string, string>) => { for (const k of KEYS) delete process.env[k]; Object.assign(process.env, o); };
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe('medya analizi: depolama kovası yedeği (üretim yalnız VITE_ değişkenini taşır)', () => {
  it('FIREBASE_STORAGE_BUCKET yoksa VITE_FIREBASE_STORAGE_BUCKET kullanılır ve analiz açılır', () => {
    set({ MEDIA_AI_ANALYSIS_ENABLED: 'true', OPENROUTER_API_KEY: 'k', VITE_FIREBASE_STORAGE_BUCKET: 'proje.firebasestorage.app' });
    expect(storageBucketName()).toBe('proje.firebasestorage.app');
    expect(mediaAnalysisState()).toEqual({ enabled: true });
  });
  it('açık FIREBASE_STORAGE_BUCKET önceliklidir', () => {
    set({ MEDIA_AI_ANALYSIS_ENABLED: 'true', OPENROUTER_API_KEY: 'k', FIREBASE_STORAGE_BUCKET: 'a', VITE_FIREBASE_STORAGE_BUCKET: 'b' });
    expect(storageBucketName()).toBe('a');
  });
  it('ikisi de yoksa kapalı ve eksik değişken adı raporlanır; bayrak yoksa kapalı', () => {
    set({ MEDIA_AI_ANALYSIS_ENABLED: 'true', OPENROUTER_API_KEY: 'k' });
    expect(mediaAnalysisState()).toMatchObject({ enabled: false, missing: ['FIREBASE_STORAGE_BUCKET'] });
    set({ OPENROUTER_API_KEY: 'k', VITE_FIREBASE_STORAGE_BUCKET: 'b' });
    expect(mediaAnalysisState()).toMatchObject({ enabled: false });
  });
});
