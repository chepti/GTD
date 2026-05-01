import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getAuthInstance, googleProvider } from './config.js';

export async function signInWithGoogle() {
  const auth = getAuthInstance();
  const { user } = await signInWithPopup(auth, googleProvider);
  return user;
}

export async function signOutUser() {
  await signOut(getAuthInstance());
}

export function onUserChanged(callback) {
  return onAuthStateChanged(getAuthInstance(), callback);
}
