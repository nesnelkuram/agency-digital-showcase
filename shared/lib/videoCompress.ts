/**
 * In-browser video compression with ffmpeg.wasm (single-threaded core — no
 * SharedArrayBuffer, so it works WITHOUT site-wide COOP/COEP headers that would
 * otherwise break Firebase auth popups & third-party embeds).
 *
 * Produces two web-optimised (faststart) MP4s from a source file:
 *   - full:    720p @ ~1.1 Mbps, with audio — the clip played when a phone is tapped
 *   - preview: first 6s, 540p @ ~0.8 Mbps, muted — the looping grid thumbnail
 *
 * Single-threaded wasm is slow (roughly real-time or slower), which is the
 * accepted trade-off for keeping compression in-house and free.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.10';
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export type CompressPhase = 'loading-engine' | 'full' | 'preview' | 'done';

export interface CompressProgress {
  phase: CompressPhase;
  /** 0..1 progress within the current phase (best-effort). */
  ratio: number;
}

export interface CompressResult {
  full: Blob;
  preview: Blob;
}

async function getFFmpeg(onProgress?: (p: CompressProgress) => void): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ff = new FFmpeg();
    onProgress?.({ phase: 'loading-engine', ratio: 0 });
    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    onProgress?.({ phase: 'loading-engine', ratio: 1 });
    ffmpegSingleton = ff;
    return ff;
  })();

  return loadPromise;
}

/**
 * Compress `file` into { full, preview } MP4 blobs.
 * `onProgress` reports phase + best-effort ratio for a UI bar.
 */
export async function compressVideo(
  file: File,
  onProgress?: (p: CompressProgress) => void,
): Promise<CompressResult> {
  const ff = await getFFmpeg(onProgress);

  const inputName = 'in.mp4';
  const fullName = 'full.mp4';
  const previewName = 'preview.mp4';

  await ff.writeFile(inputName, await fetchFile(file));

  // ---- FULL: 720p @ ~1.1 Mbps, faststart, audio ----
  let phase: CompressPhase = 'full';
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.({ phase, ratio: Math.max(0, Math.min(1, progress)) });
  };
  ff.on('progress', progressHandler);

  onProgress?.({ phase: 'full', ratio: 0 });
  await ff.exec([
    '-i', inputName,
    '-vf', 'scale=720:-2',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-b:v', '1100k', '-maxrate', '1400k', '-bufsize', '2200k', '-preset', 'veryfast',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart',
    fullName,
  ]);

  // ---- PREVIEW: first 6s, 540p @ ~0.8 Mbps, muted, faststart ----
  phase = 'preview';
  onProgress?.({ phase: 'preview', ratio: 0 });
  await ff.exec([
    '-i', inputName,
    '-t', '6',
    '-vf', 'scale=540:-2',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-b:v', '800k', '-maxrate', '1000k', '-bufsize', '1600k', '-preset', 'veryfast',
    '-an',
    '-movflags', '+faststart',
    previewName,
  ]);

  ff.off('progress', progressHandler);

  const fullData = await ff.readFile(fullName);
  const previewData = await ff.readFile(previewName);

  // Free wasm FS memory
  await ff.deleteFile(inputName).catch(() => {});
  await ff.deleteFile(fullName).catch(() => {});
  await ff.deleteFile(previewName).catch(() => {});

  onProgress?.({ phase: 'done', ratio: 1 });

  const toBlob = (d: Uint8Array | string) =>
    new Blob([d as BlobPart], { type: 'video/mp4' });

  return { full: toBlob(fullData), preview: toBlob(previewData) };
}
