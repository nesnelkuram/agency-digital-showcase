/**
 * Admin-managed showcase video that appears in the public homepage phone grid.
 *
 * Unlike the static entries in `videoMetadata.ts`, these are created at runtime
 * from the admin panel: the browser compresses the source with ffmpeg.wasm,
 * uploads the result to Vercel Blob, and the metadata is stored in the public
 * `homepage_videos` Firestore collection (read: anyone, write: admins).
 */
export interface HomepageVideo {
  id: string;            // Firestore document id
  /** Slug used for the Blob object paths (videos/full/<slug>.mp4 etc.) */
  slug: string;
  title: string;
  location: string;
  category: string;
  category2?: string;
  description: string;
  tags?: string;
  year?: number;
  duration?: string;
  services?: string;

  /** Public Vercel Blob URLs of the compressed assets. */
  fullUrl: string;
  previewUrl: string;
  thumbnailUrl?: string;

  /** Higher = shown earlier. Optional manual ordering. */
  order?: number;
  /** Hidden from the grid when false (kept for soft-delete / drafts). */
  active: boolean;

  createdAt: number;
  updatedAt: number;
}

export type HomepageVideoInput = Omit<
  HomepageVideo,
  'id' | 'createdAt' | 'updatedAt'
>;

/** The four categories the homepage grid samples from. */
export const HOMEPAGE_CATEGORIES = [
  'Fashion',
  'Commercial',
  'Gastronomy',
  'Interview',
] as const;
