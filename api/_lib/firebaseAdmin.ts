// Use top-level await import() so Vercel's NFT (Node File Trace) can detect
// firebase-admin sub-packages and bundle them into serverless functions.
// The exported functions stay synchronous — no caller changes needed.

const appModule = await import('firebase-admin/app');
const firestoreModule = await import('firebase-admin/firestore');
const authModule = await import('firebase-admin/auth');

let _db: any = null;

export function getAdminDb(): any {
  if (_db) return _db;

  if (appModule.getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      appModule.initializeApp({ credential: appModule.cert(serviceAccount) });
    } else if (projectId) {
      appModule.initializeApp({ projectId });
    } else {
      throw new Error('FIREBASE_SERVICE_ACCOUNT veya FIREBASE_PROJECT_ID ortam degiskeni gerekli');
    }
  }

  _db = firestoreModule.getFirestore();
  return _db;
}

export function getFieldValue(): any {
  return firestoreModule.FieldValue;
}

export function getFirebaseAuth(): any {
  getAdminDb();
  return authModule.getAuth();
}
