import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let _db: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (_db) return _db;

  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } else if (projectId) {
      initializeApp({ projectId });
    } else {
      throw new Error('FIREBASE_SERVICE_ACCOUNT veya FIREBASE_PROJECT_ID ortam degiskeni gerekli');
    }
  }

  _db = getFirestore();
  return _db;
}
