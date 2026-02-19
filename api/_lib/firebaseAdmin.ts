import { createRequire } from 'module';

// Use require() instead of ESM static imports so this module can be
// safely imported at handler module level without crashing Vercel Lambdas.
// (Static ESM imports of firebase-admin sub-paths fail during cold-start.)
const _require = createRequire(import.meta.url);

let _db: any = null;

export function getAdminDb(): any {
  if (_db) return _db;

  const { initializeApp, getApps, cert } = _require('firebase-admin/app') as any;
  const { getFirestore } = _require('firebase-admin/firestore') as any;

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

// Export FieldValue lazily so handler files don't need to statically
// import from firebase-admin/firestore at module level.
export function getFieldValue(): any {
  return (_require('firebase-admin/firestore') as any).FieldValue;
}

// Export Firebase Auth lazily for use in withAuth.ts
export function getFirebaseAuth(): any {
  // Ensure app is initialized first
  getAdminDb();
  return (_require('firebase-admin/auth') as any).getAuth();
}
