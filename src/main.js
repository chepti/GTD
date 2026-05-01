import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { createIcons } from 'lucide';

import { isFirebaseConfigured } from './firebase/config.js';
import { onUserChanged, signInWithGoogle } from './firebase/auth.js';
import {
  ensurePersistence,
  subscribeMeta,
  subscribeTasks,
  subscribeProjects,
  subscribeWeeklyReviews,
  drainQueue,
  processWriteQueueItem,
  saveMeta,
  serverTimestamp,
} from './firebase/db.js';
import { onOnline } from './lib/writeQueue.js';
import { mountShell } from './app/shell.js';
import {
  setUser,
  setTab,
  subscribe as subscribeApp,
  getSessionEnergy,
  setCaptureMode,
  appState,
} from './app/store.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderCapture } from './screens/capture.js';
import { renderClarify } from './screens/clarify.js';
import { renderOrganize } from './screens/organize.js';
import { renderEngage } from './screens/engage.js';
import { renderWeekly, resetWeeklyWizard } from './screens/weekly.js';

registerSW({ immediate: true });

let meta = null;
let tasks = [];
let projects = [];
let weeklyReviews = [];
let unsub = [];
let organizeFocus = null;
let weeklyMode = null;
/** @type {ReturnType<typeof mountShell> | null} */
let shell = null;

function inboxCount() {
  return tasks.filter((t) => t.status === 'inbox').length;
}

function navigate(tab) {
  setTab(tab);
  renderAll();
}

function renderLogin() {
  const app = document.getElementById('app');
  if (!app) return;
  if (!isFirebaseConfigured()) {
    app.innerHTML = `
      <div class="login-screen">
        <h1>GTD</h1>
        <p>הגדר משתני VITE_FIREBASE_* בקובץ .env (ראה .env.example).</p>
      </div>`;
    return;
  }
  app.innerHTML = `
    <div class="login-screen">
      <h1>GTD</h1>
      <p>התחבר עם Google כדי לסנכרן בין מכשירים.</p>
      <button type="button" class="btn-primary" id="google-in">התחברות עם Google</button>
    </div>`;
  document.getElementById('google-in')?.addEventListener('click', async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      alert(/** @type {Error} */ (e).message || 'שגיאה בהתחברות');
    }
  });
}

function clearSubs() {
  unsub.forEach((u) => u());
  unsub = [];
}

function setupFirestore(uid) {
  clearSubs();
  unsub.push(
    subscribeMeta(uid, (m) => {
      meta = m;
      renderAll();
    })
  );
  unsub.push(
    subscribeTasks(uid, (list) => {
      tasks = list.filter((t) => t.status !== 'deleted');
      renderAll();
    })
  );
  unsub.push(
    subscribeProjects(uid, (list) => {
      projects = list;
      renderAll();
    })
  );
  unsub.push(
    subscribeWeeklyReviews(uid, (list) => {
      weeklyReviews = list;
      renderAll();
    })
  );
}

function ensureShell() {
  const app = document.getElementById('app');
  if (!app) return null;
  if (!document.getElementById('root-shell')) {
    app.innerHTML = '<div id="root-shell"></div>';
    shell = mountShell(app.querySelector('#root-shell'), {
      getInboxCount: inboxCount,
      onTabChange: (id) => {
        organizeFocus = null;
        if (id !== 'weekly') weeklyMode = null;
        setTab(id);
        renderAll();
      },
      onSubmenuAction: (action) => {
        if (action === 'capture-chat') setCaptureMode('chat');
        if (action === 'capture-paste') setCaptureMode('paste');
        if (action === 'org-calendar') organizeFocus = 'cal';
        if (action === 'org-waiting') organizeFocus = 'wait';
        if (action === 'org-someday') organizeFocus = 'some';
        if (action === 'org-reference') organizeFocus = 'ref';
        if (action === 'weekly-start') weeklyMode = 'wizard';
        if (action === 'weekly-schedule') weeklyMode = 'schedule';
        renderAll();
      },
    });
    shell.renderNav();
    shell.setActiveTab(appState.tab);
    subscribeApp(() => {
      shell?.setActiveTab(appState.tab);
      shell?.renderNav();
      renderScreenOnly();
    });
  }
  return shell;
}

function renderAll() {
  ensureShell();
  shell?.renderNav();
  renderScreenOnly();
}

function renderScreenOnly() {
  const s = shell?.getScreenRoot();
  const uid = appState.uid;
  if (!s || !uid) return;

  const shellEl = document.getElementById('root-shell');

  if (!meta) {
    s.innerHTML = '<p class="muted" style="text-align:center;padding:40px">טוען…</p>';
    return;
  }

  if (meta.onboardingComplete !== true) {
    shellEl?.classList.add('is-onboarding');
    s.innerHTML = '<div id="onb-root"></div>';
    const ob = s.querySelector('#onb-root');
    if (ob) {
      renderOnboarding(ob, {
        uid,
        onDone: () => {
          setTab('capture');
          renderAll();
        },
      });
    }
    createIcons();
    return;
  }

  shellEl?.classList.remove('is-onboarding');

  const ctxBase = {
    uid,
    user: appState.user,
    tasks,
    projects,
    weeklyReviews,
    meta,
    inboxCount: inboxCount(),
    navigate,
    refreshNav: () => shell?.renderNav(),
    sessionEnergyLabel: getSessionEnergy().label(),
    organizeFocus,
    onWins: () => bumpWinsBadge(),
  };

  const tab = appState.tab;
  if (tab === 'dashboard') renderDashboard(s, ctxBase);
  else if (tab === 'capture') renderCapture(s, ctxBase);
  else if (tab === 'clarify') renderClarify(s, ctxBase);
  else if (tab === 'organize') renderOrganize(s, ctxBase);
  else if (tab === 'engage') renderEngage(s, ctxBase);
  else if (tab === 'weekly') {
    if (weeklyMode === 'schedule') {
      renderWeekly(s, {
        ...ctxBase,
        mode: 'schedule',
        onClose: () => {
          weeklyMode = null;
          setTab('dashboard');
          renderAll();
        },
      });
    } else if (weeklyMode === 'wizard') {
      renderWeekly(s, {
        ...ctxBase,
        mode: 'wizard',
        onClose: () => {
          weeklyMode = null;
          resetWeeklyWizard();
          setTab('dashboard');
          renderAll();
        },
      });
    } else {
      s.innerHTML = `<div class="card"><p>לחץ שוב על ״סקירה״ ובחר: סקירה שבועית או קביעת תזמון.</p></div>`;
    }
  }
  createIcons();
}

function bumpWinsBadge() {
  const el = document.getElementById('dash-wins');
  if (el) {
    el.classList.remove('bounce-once');
    void el.offsetWidth;
    el.classList.add('bounce-once');
  }
}

onUserChanged(async (user) => {
  clearSubs();
  setUser(user);
  meta = null;
  if (!user) {
    shell = null;
    renderLogin();
    return;
  }
  if (!isFirebaseConfigured()) {
    renderLogin();
    return;
  }
  await ensurePersistence();
  setupFirestore(user.uid);
  const { getMeta } = await import('./firebase/db.js');
  let m = await getMeta(user.uid);
  if (!m) {
    await saveMeta(
      user.uid,
      {
        onboardingComplete: false,
        weeklyReviewDay: 5,
        weeklyReviewTime: '09:00',
        createdAt: serverTimestamp(),
      },
      true
    );
    m = await getMeta(user.uid);
  }
  meta = m;
  setTab('dashboard');
  renderAll();
});

onOnline(() => {
  drainQueue(async (payload) => {
    await processWriteQueueItem(payload);
  });
});

renderLogin();

createIcons();
