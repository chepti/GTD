import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app;
let auth;
let db;

export function getFirebaseApp() {
  if (!app) {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase לא מוגדר — הוסף משתני VITE_FIREBASE_* ב-.env');
    }
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getAuthInstance() {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

export function getDb() {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

export const googleProvider = new GoogleAuthProvider();
