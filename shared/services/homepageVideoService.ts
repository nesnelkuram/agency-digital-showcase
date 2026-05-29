import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { HomepageVideo, HomepageVideoInput } from '@/shared/types/homepageVideo';
import type { MediaContent } from '@/types';

const COLLECTION = 'homepage_videos';

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Create a new homepage video document. Returns the created record. */
export async function createHomepageVideo(input: HomepageVideoInput): Promise<HomepageVideo> {
  const ref = doc(collection(db, COLLECTION));
  const now = Date.now();
  const record: HomepageVideo = { ...input, id: ref.id, createdAt: now, updatedAt: now };
  await setDoc(ref, stripUndefined(record));
  return record;
}

export async function updateHomepageVideo(
  id: string,
  patch: Partial<HomepageVideoInput>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), stripUndefined({ ...patch, updatedAt: Date.now() }));
}

export async function deleteHomepageVideo(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function getHomepageVideo(id: string): Promise<HomepageVideo | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? (snap.data() as HomepageVideo) : null;
}

/** All videos, newest first (admin list). */
export async function listHomepageVideos(): Promise<HomepageVideo[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => d.data() as HomepageVideo);
}

/**
 * Active videos for the public grid, converted to the MediaContent shape the
 * homepage already consumes. Resilient: returns [] on any error so the static
 * catalogue keeps working (never blocks/breaks the hero).
 */
export async function getActiveHomepageVideosAsMedia(): Promise<MediaContent[]> {
  try {
    const all = await listHomepageVideos();
    return all
      .filter((v) => v.active)
      .map((v) => ({
        id: `hp-${v.id}`,
        preview: v.previewUrl,
        fullVideo: v.fullUrl,
        thumbnail: v.thumbnailUrl || '',
        alt: v.title || '',
        type: 'video' as const,
        title: v.title || '',
        description: v.description || '',
        category: v.category || '',
        category2: v.category2,
        location: v.location || '',
        tags: v.tags || '',
        year: v.year,
        duration: v.duration || '',
        services: v.services || '',
      }));
  } catch (err) {
    console.warn('[homepageVideoService] getActiveHomepageVideosAsMedia failed, using static only:', err);
    return [];
  }
}
