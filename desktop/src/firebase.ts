import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Ana repodaki .env.local ile aynı VITE_FIREBASE_* anahtarları (vite envDir: "../").
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || "").trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "").trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "").trim(),
  messagingSenderId: (
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ""
  ).trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || "").trim(),
};

export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  // Oturum diskte kalsın — companion her açılışta tekrar login istemesin.
  setPersistence(auth, browserLocalPersistence).catch(() => {});
} else {
  console.warn(
    "[Firebase] VITE_FIREBASE_* eksik. Ana repodaki .env.local'i kontrol et."
  );
}

export { auth, db };
