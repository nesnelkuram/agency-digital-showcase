import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  DocumentSnapshot,
  QueryConstraint,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  SocialMediaPost,
  SocialPostSummary,
  SocialPostFilters,
  CreateSocialPostData,
  UpdateSocialPostData,
  SocialMediaStats,
} from '@/shared/types/socialMedia';

const COLLECTION_NAME = 'social_media_posts';

function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = stripUndefined(val);
      }
    }
    return result;
  }
  return obj;
}

// ============================================
// TEMEL CRUD
// ============================================

export async function createSocialPost(
  data: CreateSocialPostData,
  createdByUid: string,
  createdByName: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const now = Timestamp.now();

  const postData: Omit<SocialMediaPost, 'id'> = {
    projectId: data.projectId,
    title: data.title,
    caption: data.caption,
    hashtags: data.hashtags || [],
    mediaUrls: data.mediaUrls || [],
    postType: data.postType,
    platforms: data.platforms,
    status: 'draft',
    scheduledAt: data.scheduledAt,
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
    createdBy: createdByUid,
    createdByName,
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), stripUndefined(postData));
  return docRef.id;
}

export async function getSocialPost(id: string): Promise<SocialMediaPost | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as SocialMediaPost;
}

export async function updateSocialPost(
  id: string,
  data: UpdateSocialPostData,
  updatedByUid: string,
  updatedByName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, id);

  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSocialPost(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

// ============================================
// LISTELEME VE FILTRELEME
// ============================================

export async function getSocialPosts(
  filters?: SocialPostFilters,
  pageSize: number = 50,
  lastDoc?: DocumentSnapshot
): Promise<{ posts: SocialPostSummary[]; lastDoc: DocumentSnapshot | null }> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [];

  if (filters?.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }

  if (filters?.status?.length) {
    constraints.push(where('status', 'in', filters.status));
  }

  if (filters?.postType?.length) {
    constraints.push(where('postType', 'in', filters.postType));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  constraints.push(limit(pageSize));

  const q = query(collection(db, COLLECTION_NAME), ...constraints);
  const snapshot = await getDocs(q);

  const posts: SocialPostSummary[] = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      projectId: data.projectId,
      title: data.title,
      postType: data.postType,
      platforms: data.platforms,
      status: data.status,
      scheduledAt: data.scheduledAt,
      createdAt: data.createdAt,
    };
  });

  // Client-side search
  let filtered = posts;
  if (filters?.search) {
    const term = filters.search.toLowerCase();
    filtered = posts.filter((p) => p.title.toLowerCase().includes(term));
  }

  const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { posts: filtered, lastDoc: newLastDoc };
}

export async function getSocialPostsByDate(
  projectId: string,
  month: number,
  year: number
): Promise<SocialPostSummary[]> {
  if (!db) throw new Error('Firebase not initialized');

  const startDate = Timestamp.fromDate(new Date(year, month - 1, 1));
  const endDate = Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));

  const q = query(
    collection(db, COLLECTION_NAME),
    where('projectId', '==', projectId),
    where('scheduledAt', '>=', startDate),
    where('scheduledAt', '<=', endDate),
    orderBy('scheduledAt', 'asc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      projectId: data.projectId,
      title: data.title,
      postType: data.postType,
      platforms: data.platforms,
      status: data.status,
      scheduledAt: data.scheduledAt,
      createdAt: data.createdAt,
    };
  });
}

// ============================================
// ISTATISTIKLER
// ============================================

export async function getProjectSocialStats(projectId: string): Promise<SocialMediaStats> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION_NAME),
    where('projectId', '==', projectId)
  );

  const snapshot = await getDocs(q);

  const stats: SocialMediaStats = {
    totalPosts: 0,
    drafts: 0,
    pendingApproval: 0,
    scheduled: 0,
    published: 0,
    failed: 0,
  };

  snapshot.docs.forEach((d) => {
    const status = d.data().status;
    stats.totalPosts++;
    switch (status) {
      case 'draft': stats.drafts++; break;
      case 'pending_approval': stats.pendingApproval++; break;
      case 'scheduled': stats.scheduled++; break;
      case 'published': stats.published++; break;
      case 'failed': stats.failed++; break;
    }
  });

  return stats;
}
