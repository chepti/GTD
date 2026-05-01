import { createSessionEnergy } from '../lib/sessionEnergy.js';

/** @type {import('firebase/auth').User | null} */
let user = null;
let tab = 'dashboard';
let captureMode = 'chat';
let bubblesOpen = false;
let engageSelectedContexts = [];
let engageTimeMinutes = Infinity;
let energyCutoff = 60;
const listeners = new Set();

export const appState = {
  get user() {
    return user;
  },
  get uid() {
    return user?.uid ?? null;
  },
  get tab() {
    return tab;
  },
  get captureMode() {
    return captureMode;
  },
  get bubblesOpen() {
    return bubblesOpen;
  },
  get engageSelectedContexts() {
    return engageSelectedContexts;
  },
  get engageTimeMinutes() {
    return engageTimeMinutes;
  },
  get energyCutoff() {
    return energyCutoff;
  },
};

let sessionEnergy = createSessionEnergy();

export function getSessionEnergy() {
  sessionEnergy.tick();
  return sessionEnergy;
}

export function resetSessionEnergy() {
  sessionEnergy = createSessionEnergy();
}

export function setUser(u) {
  user = u;
  notify();
}

export function setTab(t) {
  tab = t;
  bubblesOpen = false;
  notify();
}

export function toggleBubbles() {
  bubblesOpen = !bubblesOpen;
  notify();
}

export function setCaptureMode(m) {
  captureMode = m;
  bubblesOpen = false;
  notify();
}

export function setEngageContexts(arr) {
  engageSelectedContexts = arr;
  notify();
}

export function setEngageTimeMinutes(n) {
  engageTimeMinutes = n;
  notify();
}

export function setEnergyCutoff(n) {
  energyCutoff = n;
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}
