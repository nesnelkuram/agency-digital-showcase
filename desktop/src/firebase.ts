import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  Auth,
  indexedDBLocalPersistence,
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
  const isNew = getApps().length === 0;
  app = isNew ? initializeApp(firebaseConfig) : getApps()[0];
  // Oturum diskte kalsın — companion her açılışta tekrar login istemesin.
  //
  // getAuth() + asenkron setPersistence() yerine initializeAuth() kullanıyoruz:
  // getAuth oturumu okumaya hemen başlar, setPersistence ise sonradan çalışır;
  // bu yarış WKWebView'de (Tauri macOS) kalıcılığın in-memory'ye düşmesine ve
  // oturumun her açılışta kaybolmasına yol açıyordu. initializeAuth ile
  // kalıcılık başlangıçta deterministik veriliyor. IndexedDB öncelikli çünkü
  // WebKit localStorage'ı agresif temizleyebiliyor; IndexedDB daha kalıcı.
  try {
    auth = isNew
      ? initializeAuth(app, {
          persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        })
      : getAuth(app);
  } catch {
    // initializeAuth aynı app için ikinci kez çağrılırsa hata verir — fallback.
    auth = getAuth(app);
  }
  db = getFirestore(app);
} else {
  console.warn(
    "[Firebase] VITE_FIREBASE_* eksik. Ana repodaki .env.local'i kontrol et."
  );
}

export { auth, db };
