import { createIcons } from 'lucide';
import { CONTEXTS, rankTasksWithDim } from '../lib/rankTasks.js';
import { applyInferenceToTask } from '../lib/inference.js';
import { burstConfetti } from '../lib/confetti.js';
import { updateTask, Timestamp } from '../firebase/db.js';
import {
  appState,
  setEngageContexts,
  setEngageTimeMinutes,
  setEnergyCutoff,
  getSessionEnergy,
} from '../app/store.js';

const TIME_CHIPS = [
  { label: "5'", m: 5 },
  { label: "15'", m: 15 },
  { label: "30'", m: 30 },
  { label: "60'", m: 60 },
  { label: '∞', m: Infinity },
];

let pointerStartX = 0;
let pointerStartY = 0;
let activeSwipeId = null;

export function renderEngage(root, ctx) {
  const { tasks, projects, uid, refreshNav, onWins } = ctx;
  const pmap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const selected = appState.engageSelectedContexts;
  const session = {
    selectedContexts: selected.length ? selected : null,
    energyCutoff: appState.energyCutoff,
    availableMinutes: appState.engageTimeMinutes,
  };
  const ranked = rankTasksWithDim(tasks, session, tasks);

  const contextChips = CONTEXTS.map(
    (c) => `
    <button type="button" class="chip ctx-chip ${selected.includes(c) ? 'is-active' : ''}" data-ctx="${c}">${ctxLabel(c)}</button>`
  ).join('');

  const timeChips = TIME_CHIPS.map(
    (t) => `
    <button type="button" class="chip time-chip ${session.availableMinutes === t.m ? 'is-active' : ''}" data-min="${t.m}">${t.label}</button>`
  ).join('');

  const cutoffPct = 100 - appState.energyCutoff;
  const handleTop = `${Math.min(88, Math.max(8, cutoffPct))}%`;

  root.innerHTML = `
    <h1 class="screen-title">פעולות הבאות</h1>
    <div class="chips-row">${contextChips}</div>
    <div class="chips-row">${timeChips}</div>
    <div class="engage-energy">
      <div class="engage-energy-label">האנרגיה שלי — גרור את 🔋</div>
      <div class="energy-track" style="position:absolute;inset:0;height:100%">
        <div class="energy-handle" id="energy-handle" style="top:${handleTop}">🔋</div>
      </div>
    </div>
    <p class="muted" style="font-size:0.8rem">מעל הקו: עמום יותר · מתחת: מוכן לפעולה</p>
    <div id="engage-list">
      ${ranked
        .map(({ task: t, dimmed }) => {
          const p = pmap[t.projectId];
          const col = p?.color || '#744577';
          const minLabel = t.inferredMinutes ? `${t.inferredMinutes}'` : '';
          return `<div class="task-row-engage ${dimmed ? 'is-dim' : ''}" data-id="${t.id}" style="--project-color:${col};touch-action:pan-y">
            <button type="button" class="cb" aria-label="סימון בוצע"></button>
            <div style="flex:1">
              <div style="font-weight:600">${escape(t.title)}</div>
              <div class="muted" style="font-size:0.8rem">${p ? escape(p.name) : 'ללא פרויקט'} ${minLabel ? `· ${minLabel}` : ''}</div>
            </div>
          </div>`;
        })
        .join('') || '<p class="muted">אין משימות מתאימות</p>'}
    </div>
    <div id="skip-sheet" hidden></div>
  `;

  root.querySelectorAll('.ctx-chip').forEach((b) => {
    b.addEventListener('click', () => {
      const c = /** @type {HTMLElement} */ (b).dataset.ctx;
      const set = new Set(selected);
      if (set.has(c)) set.delete(c);
      else set.add(c);
      setEngageContexts([...set]);
      renderEngage(root, ctx);
    });
  });
  root.querySelectorAll('.time-chip').forEach((b) => {
    b.addEventListener('click', () => {
      const m = /** @type {HTMLElement} */ (b).dataset.min;
      setEngageTimeMinutes(m === 'Infinity' ? Infinity : Number(m));
      renderEngage(root, ctx);
    });
  });

  const handle = /** @type {HTMLElement} */ (root.querySelector('#energy-handle'));
  const track = /** @type {HTMLElement} */ (root.querySelector('.engage-energy'));
  let dragging = false;
  const onMove = (clientY) => {
    const rect = track.getBoundingClientRect();
    const y = clientY - rect.top;
    const pct = Math.round((1 - y / rect.height) * 100);
    setEnergyCutoff(Math.min(100, Math.max(0, pct)));
    handle.style.top = `${Math.min(88, Math.max(8, 100 - pct))}%`;
    root.querySelectorAll('.task-row-engage').forEach((row) => {
      const id = row.getAttribute('data-id');
      const t = tasks.find((x) => x.id === id);
      if (!t) return;
      const dim = (t.energyWeight ?? 0) > appState.energyCutoff;
      row.classList.toggle('is-dim', dim);
    });
  };
  handle?.addEventListener('pointerdown', (e) => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
  });
  handle?.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    onMove(e.clientY);
  });
  handle?.addEventListener('pointerup', () => {
    dragging = false;
  });

  root.querySelectorAll('.task-row-engage').forEach((row) => {
    row.addEventListener('pointerdown', (e) => {
      if ((/** @type {HTMLElement} */ (e.target)).closest('.cb')) return;
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
      activeSwipeId = row.getAttribute('data-id');
    });
    row.addEventListener('pointerup', async (e) => {
      const id = row.getAttribute('data-id');
      if (id !== activeSwipeId) return;
      const dx = e.clientX - pointerStartX;
      const dy = e.clientY - pointerStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx > 0) {
          await completeTask(uid, id, tasks, onWins, e.clientX, e.clientY);
          refreshNav();
          renderEngage(root, ctx);
        } else {
          openSkipSheet(root, ctx, id);
        }
      }
    });
  });

  root.querySelectorAll('.cb').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const row = btn.closest('.task-row-engage');
      const id = row?.getAttribute('data-id');
      if (!id) return;
      await completeTask(uid, id, tasks, onWins, e.clientX, e.clientY);
      refreshNav();
      renderEngage(root, ctx);
    });
  });

  createIcons();
}

async function completeTask(uid, id, tasks, onWins, x, y) {
  getSessionEnergy().onTaskCompleted(tasks.find((t) => t.id === id));
  await updateTask(uid, id, { status: 'done', completedAt: Timestamp.now() });
  onWins?.();
  burstConfetti(x, y, 8);
}

function openSkipSheet(root, ctx, taskId) {
  const sheet = root.querySelector('#skip-sheet');
  if (!sheet) return;
  sheet.hidden = false;
  sheet.innerHTML = `
    <div class="skip-sheet-backdrop">
      <div class="skip-sheet-inner">
        <h3 style="margin-top:0">למה לא עכשיו?</h3>
        <div class="skip-reasons">
          <button type="button" class="skip-reason-btn" data-reason="ארוך_מדי">⏱ ארוך מדי</button>
          <button type="button" class="skip-reason-btn" data-reason="אין_אנרגיה">🔋 אין אנרגיה</button>
          <button type="button" class="skip-reason-btn" data-reason="הקשר_לא_נכון">📍 הקשר לא נכון</button>
          <button type="button" class="skip-reason-btn" data-reason="לא_עכשיו">🚫 לא עכשיו</button>
        </div>
        <button type="button" class="btn-ghost" id="skip-close" style="margin-top:16px;width:100%">סגור</button>
      </div>
    </div>`;
  sheet.querySelector('#skip-close')?.addEventListener('click', () => {
    sheet.hidden = true;
    sheet.innerHTML = '';
  });
  sheet.querySelectorAll('.skip-reason-btn').forEach((b) => {
    b.addEventListener('click', async () => {
      const reason = /** @type {HTMLElement} */ (b).dataset.reason;
      const t = ctx.tasks.find((x) => x.id === taskId);
      if (!t) return;
      const entry = {
        reason,
        availableMinutes: appState.engageTimeMinutes === Infinity ? 120 : appState.engageTimeMinutes,
        timestamp: Timestamp.now(),
      };
      const skipReasons = [...(t.skipReasons || []), entry];
      let updated = { ...t, skipReasons };
      updated = applyInferenceToTask(updated);
      await updateTask(ctx.uid, taskId, {
        skipReasons,
        inferredMinutes: updated.inferredMinutes ?? t.inferredMinutes ?? null,
        inferredEnergyLevel: updated.inferredEnergyLevel ?? t.inferredEnergyLevel,
        energyWeight: updated.energyWeight ?? t.energyWeight,
      });
      sheet.hidden = true;
      sheet.innerHTML = '';
      renderEngage(root, ctx);
    });
  });
}

function ctxLabel(c) {
  const map = { בית: '🏠 בית', משרד: '🏢 משרד', חוץ: '🌿 חוץ', מחשב: '💻 מחשב', טלפון: '📱 טלפון', כל_מקום: '🌍 כל מקום' };
  return map[c] || c;
}

function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
