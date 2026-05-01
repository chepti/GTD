import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import { getDb } from './config.js';
import { isOnline } from '../lib/writeQueue.js';
import { enqueueWrite } from '../lib/writeQueue.js';

const META_DOC_ID = 'profile';

let persistenceEnabled = false;
export async function ensurePersistence() {
  if (persistenceEnabled) return;
  try {
    await enableIndexedDbPersistence(getDb());
    persistenceEnabled = true;
  } catch (e) {
    if (e?.code !== 'failed-precondition') {
      console.warn('Firestore persistence', e);
    }
  }
}

export function metaDocRef(uid) {
  return doc(getDb(), 'users', uid, 'meta', META_DOC_ID);
}

export function projectsCol(uid) {
  return collection(getDb(), 'users', uid, 'projects');
}

export function tasksCol(uid) {
  return collection(getDb(), 'users', uid, 'tasks');
}

export function weeklyReviewsCol(uid) {
  return collection(getDb(), 'users', uid, 'weekly_reviews');
}

export async function getMeta(uid) {
  const snap = await getDoc(metaDocRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveMeta(uid, data, merge = true) {
  const ref = metaDocRef(uid);
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (!merge) {
    await setDoc(ref, { createdAt: serverTimestamp(), ...payload });
    return;
  }
  await setDoc(ref, payload, { merge: true });
}

export function subscribeMeta(uid, cb) {
  return onSnapshot(metaDocRef(uid), (snap) => {
    if (!snap.exists()) {
      cb({
        onboardingComplete: false,
        weeklyReviewDay: 5,
        weeklyReviewTime: '09:00',
      });
      return;
    }
    cb(snap.data());
  });
}

export function subscribeProjects(uid, cb) {
  return onSnapshot(projectsCol(uid), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => !p.isArchived);
    cb(list);
  });
}

export function subscribeTasks(uid, cb) {
  return onSnapshot(tasksCol(uid), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeTasksByStatus(uid, status, cb) {
  const q = query(tasksCol(uid), where('status', '==', status));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeWeeklyReviews(uid, cb) {
  return onSnapshot(weeklyReviewsCol(uid), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    cb(list);
  });
}

export async function addProject(uid, data) {
  const ref = await addDoc(projectsCol(uid), {
    ...data,
    isArchived: false,
    deepReflectionDone: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProject(uid, projectId, data) {
  await updateDoc(doc(projectsCol(uid), projectId), data);
}

export async function addTask(uid, data) {
  const ref = await addDoc(tasksCol(uid), {
    ...data,
    skipReasons: data.skipReasons || [],
    energyWeight: data.energyWeight ?? 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTask(uid, taskId, data) {
  const dref = doc(tasksCol(uid), taskId);
  if (!isOnline()) {
    await enqueueWrite({ type: 'updateTask', uid, taskId, data });
    return;
  }
  await updateDoc(dref, data);
}

export async function deleteTask(uid, taskId) {
  if (!isOnline()) {
    await enqueueWrite({ type: 'deleteTask', uid, taskId });
    return;
  }
  await deleteDoc(doc(tasksCol(uid), taskId));
}

export async function addWeeklyReview(uid, data) {
  const ref = await addDoc(weeklyReviewsCol(uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function batchAddTasksInbox(uid, items) {
  const batch = writeBatch(getDb());
  items.forEach((item) => {
    const ref = doc(tasksCol(uid));
    batch.set(ref, {
      title: item.title,
      projectId: item.projectId ?? null,
      status: 'inbox',
      context: item.context || ['כל_מקום'],
      estimatedMinutes: item.estimatedMinutes ?? null,
      dueDate: item.dueDate ?? null,
      waitingFor: item.waitingFor ?? null,
      delegatedTo: null,
      notes: null,
      createdAt: serverTimestamp(),
      completedAt: null,
      skipReasons: [],
      inferredEnergyLevel: 'בינוני',
      inferredMinutes: null,
      energyWeight: 0,
    });
  });
  if (!isOnline()) {
    for (const item of items) {
      await enqueueWrite({ type: 'addInboxTask', uid, item });
    }
    return;
  }
  await batch.commit();
}

export async function processWriteQueueItem(payload) {
  if (payload.type === 'updateTask') {
    await updateDoc(doc(tasksCol(payload.uid), payload.taskId), payload.data);
  } else if (payload.type === 'deleteTask') {
    await deleteDoc(doc(tasksCol(payload.uid), payload.taskId));
  } else if (payload.type === 'addInboxTask') {
    await addDoc(tasksCol(payload.uid), {
      title: payload.item.title,
      projectId: payload.item.projectId ?? null,
      status: 'inbox',
      context: payload.item.context || ['כל_מקום'],
      estimatedMinutes: null,
      dueDate: payload.item.dueDate ?? null,
      waitingFor: payload.item.waitingFor ?? null,
      delegatedTo: null,
      notes: null,
      createdAt: serverTimestamp(),
      completedAt: null,
      skipReasons: [],
      inferredEnergyLevel: 'בינוני',
      inferredMinutes: null,
      energyWeight: 0,
    });
  }
}

export { serverTimestamp, Timestamp };
