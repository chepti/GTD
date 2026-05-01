/**
 * תור כתיבות ל-Firestore כשאין רשת — IndexedDB
 */
const DB_NAME = 'gtd-write-queue';
const STORE = 'pending';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export async function enqueueWrite(payload) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({
      payload,
      createdAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function drainQueue(processor) {
  const db = await openDb();
  const all = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  for (const row of all) {
    try {
      await processor(row.payload);
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(row.id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      break;
    }
  }
}

export function onOnline(callback) {
  window.addEventListener('online', callback);
  return () => window.removeEventListener('online', callback);
}

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
