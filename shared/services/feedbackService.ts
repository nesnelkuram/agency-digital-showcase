import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  Timestamp,
  DocumentSnapshot,
  QueryConstraint,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import type {
  FeedbackVideo,
  FeedbackVideoSummary,
  CreateFeedbackVideoData,
  UpdateFeedbackVideoData,
  FeedbackVideoFilters,
  FeedbackComment,
  CreateCommentData,
  FeedbackReaction,
} from '@/shared/types/feedback';

const VIDEOS_COLLECTION = 'feedback_videos';
const COMMENTS_COLLECTION = 'feedback_comments';
const REACTIONS_COLLECTION = 'feedback_reactions';

// ============================================================
// Share Token
// ============================================================

function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

// ============================================================
// Video CRUD
// ============================================================

export async function createFeedbackVideo(
  data: CreateFeedbackVideoData,
  createdByUid: string,
  createdByName: string
): Promise<string> {
  if (!db) throw new Error('Firestore baglantisi yok');

  const videoData = {
    title: data.title,
    description: data.description || '',
    videoUrl: data.videoUrl,
    thumbnailUrl: data.thumbnailUrl || null,
    duration: data.duration,
    recordingMode: data.recordingMode,
    projectId: data.projectId || null,
    tags: data.tags || [],
    shareToken: generateShareToken(),
    isPublic: data.isPublic ?? true,
    allowedUsers: [],
    viewCount: 0,
    commentCount: 0,
    status: 'ready' as const,
    metadata: data.metadata,
    createdBy: createdByUid,
    createdByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, VIDEOS_COLLECTION), videoData);
  return docRef.id;
}

export async function getFeedbackVideo(id: string): Promise<FeedbackVideo | null> {
  if (!db) throw new Error('Firestore baglantisi yok');

  const docSnap = await getDoc(doc(db, VIDEOS_COLLECTION, id));
  if (!docSnap.exists()) return null;

  return mapVideoDoc(docSnap);
}

export async function getFeedbackVideoByShareToken(token: string): Promise<FeedbackVideo | null> {
  if (!db) throw new Error('Firestore baglantisi yok');

  const q = query(
    collection(db, VIDEOS_COLLECTION),
    where('shareToken', '==', token),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return mapVideoDoc(snapshot.docs[0]);
}

export async function getFeedbackVideos(
  filters: FeedbackVideoFilters,
  pageSize: number = 12,
  lastDoc?: DocumentSnapshot
): Promise<{ videos: FeedbackVideoSummary[]; lastDoc: DocumentSnapshot | null }> {
  if (!db) throw new Error('Firestore baglantisi yok');

  const constraints: QueryConstraint[] = [];

  if (filters.recordingMode) {
    constraints.push(where('recordingMode', '==', filters.recordingMode));
  }
  if (filters.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }
  if (filters.createdBy) {
    constraints.push(where('createdBy', '==', filters.createdBy));
  }
  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, VIDEOS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  const videos: FeedbackVideoSummary[] = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title || '',
      thumbnailUrl: data.thumbnailUrl,
      duration: data.duration || 0,
      recordingMode: data.recordingMode,
      projectId: data.projectId,
      shareToken: data.shareToken,
      isPublic: data.isPublic ?? true,
      viewCount: data.viewCount || 0,
      commentCount: data.commentCount || 0,
      status: data.status || 'ready',
      createdBy: data.createdBy || '',
      createdByName: data.createdByName || '',
      createdAt: data.createdAt?.toDate?.() || new Date(),
    };
  });

  const newLastDoc = snapshot.docs.length > 0
    ? snapshot.docs[snapshot.docs.length - 1]
    : null;

  return { videos, lastDoc: newLastDoc };
}

export async function updateFeedbackVideo(
  id: string,
  data: UpdateFeedbackVideoData
): Promise<void> {
  if (!db) throw new Error('Firestore baglantisi yok');

  await updateDoc(doc(db, VIDEOS_COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFeedbackVideo(id: string): Promise<void> {
  if (!db) throw new Error('Firestore baglantisi yok');

  // Get video to find storage URL
  const video = await getFeedbackVideo(id);
  if (!video) return;

  // Delete video file from storage
  if (video.videoUrl && storage) {
    try {
      const storageRef = ref(storage, video.videoUrl);
      await deleteObject(storageRef);
    } catch {
      // Ignore storage delete errors
    }
  }

  // Delete thumbnail from storage
  if (video.thumbnailUrl && storage) {
    try {
      const storageRef = ref(storage, video.thumbnailUrl);
      await deleteObject(storageRef);
    } catch {
      // Ignore
    }
  }

  // Delete all comments
  const commentsQ = query(
    collection(db, COMMENTS_COLLECTION),
    where('videoId', '==', id)
  );
  const commentsSnap = await getDocs(commentsQ);
  const batch = writeBatch(db);
  commentsSnap.docs.forEach((d) => batch.delete(d.ref));

  // Delete all reactions
  const reactionsQ = query(
    collection(db, REACTIONS_COLLECTION),
    where('videoId', '==', id)
  );
  const reactionsSnap = await getDocs(reactionsQ);
  reactionsSnap.docs.forEach((d) => batch.delete(d.ref));

  // Delete video document
  batch.delete(doc(db, VIDEOS_COLLECTION, id));
  await batch.commit();
}

export async function incrementViewCount(videoId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, VIDEOS_COLLECTION, videoId), {
    viewCount: increment(1),
  });
}

// ============================================================
// Comments
// ============================================================

export async function addComment(
  data: CreateCommentData,
  createdByUid: string,
  createdByName: string
): Promise<string> {
  if (!db) throw new Error('Firestore baglantisi yok');

  const commentData = {
    videoId: data.videoId,
    timestamp: data.timestamp,
    text: data.text,
    createdBy: createdByUid,
    createdByName,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COMMENTS_COLLECTION), commentData);

  // Increment comment count on video
  await updateDoc(doc(db, VIDEOS_COLLECTION, data.videoId), {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function getComments(videoId: string): Promise<FeedbackComment[]> {
  if (!db) throw new Error('Firestore baglantisi yok');

  const q = query(
    collection(db, COMMENTS_COLLECTION),
    where('videoId', '==', videoId),
    orderBy('timestamp', 'asc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      videoId: data.videoId,
      timestamp: data.timestamp || 0,
      text: data.text || '',
      createdBy: data.createdBy || '',
      createdByName: data.createdByName || '',
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.(),
    };
  });
}

export async function deleteComment(commentId: string, videoId: string): Promise<void> {
  if (!db) throw new Error('Firestore baglantisi yok');

  await deleteDoc(doc(db, COMMENTS_COLLECTION, commentId));

  // Decrement comment count
  await updateDoc(doc(db, VIDEOS_COLLECTION, videoId), {
    commentCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// Reactions
// ============================================================

export async function toggleReaction(
  videoId: string,
  emoji: string,
  timestamp: number,
  createdByUid: string,
  createdByName: string
): Promise<{ added: boolean }> {
  if (!db) throw new Error('Firestore baglantisi yok');

  // Check if user already reacted with same emoji at same timestamp
  const q = query(
    collection(db, REACTIONS_COLLECTION),
    where('videoId', '==', videoId),
    where('emoji', '==', emoji),
    where('createdBy', '==', createdByUid)
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    // Remove existing reaction
    await deleteDoc(snapshot.docs[0].ref);
    return { added: false };
  }

  // Add new reaction
  await addDoc(collection(db, REACTIONS_COLLECTION), {
    videoId,
    emoji,
    timestamp,
    createdBy: createdByUid,
    createdByName,
    createdAt: serverTimestamp(),
  });

  return { added: true };
}

export async function getReactions(videoId: string): Promise<FeedbackReaction[]> {
  if (!db) throw new Error('Firestore baglantisi yok');

  const q = query(
    collection(db, REACTIONS_COLLECTION),
    where('videoId', '==', videoId),
    orderBy('createdAt', 'asc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      videoId: data.videoId,
      timestamp: data.timestamp || 0,
      emoji: data.emoji || '',
      createdBy: data.createdBy || '',
      createdByName: data.createdByName || '',
      createdAt: data.createdAt?.toDate?.() || new Date(),
    };
  });
}

// ============================================================
// Stats
// ============================================================

export async function getFeedbackStats(): Promise<{
  totalVideos: number;
  thisWeekVideos: number;
  totalComments: number;
  totalViews: number;
}> {
  if (!db) return { totalVideos: 0, thisWeekVideos: 0, totalComments: 0, totalViews: 0 };

  const allVideosQ = query(collection(db, VIDEOS_COLLECTION));
  const snapshot = await getDocs(allVideosQ);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let totalViews = 0;
  let totalComments = 0;
  let thisWeekVideos = 0;

  snapshot.docs.forEach((d) => {
    const data = d.data();
    totalViews += data.viewCount || 0;
    totalComments += data.commentCount || 0;
    const createdAt = data.createdAt?.toDate?.();
    if (createdAt && createdAt >= weekAgo) {
      thisWeekVideos++;
    }
  });

  return {
    totalVideos: snapshot.size,
    thisWeekVideos,
    totalComments,
    totalViews,
  };
}

// ============================================================
// Helpers
// ============================================================

function mapVideoDoc(docSnap: DocumentSnapshot): FeedbackVideo {
  const data = docSnap.data()!;
  return {
    id: docSnap.id,
    title: data.title || '',
    description: data.description || '',
    videoUrl: data.videoUrl || '',
    thumbnailUrl: data.thumbnailUrl,
    duration: data.duration || 0,
    recordingMode: data.recordingMode || 'screen',
    projectId: data.projectId,
    tags: data.tags || [],
    shareToken: data.shareToken || '',
    isPublic: data.isPublic ?? true,
    allowedUsers: data.allowedUsers || [],
    viewCount: data.viewCount || 0,
    commentCount: data.commentCount || 0,
    status: data.status || 'ready',
    metadata: data.metadata || { size: 0, mimeType: '' },
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  };
}
