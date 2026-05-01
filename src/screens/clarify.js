import { createIcons } from 'lucide';
import { updateTask, Timestamp, deleteTask } from '../firebase/db.js';

let phase = 'action';
/** @type {any} */
let currentTask = null;
let undoTimer = null;

export function resetClarifyState() {
  phase = 'action';
  currentTask = null;
}

export function renderClarify(root, ctx) {
  const { tasks, projects, uid, refreshNav } = ctx;
  const inbox = tasks.filter((t) => t.status === 'inbox').sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return ta - tb;
  });
  const total = inbox.length;
  if (!currentTask || !inbox.find((t) => t.id === currentTask.id)) {
    currentTask = inbox[0] || null;
    phase = 'action';
  }

  const idx = currentTask ? inbox.findIndex((t) => t.id === currentTask.id) : -1;
  const num = idx >= 0 ? idx + 1 : 0;

  if (!currentTask) {
    root.innerHTML = `<div class="card"><p>אין פריטים ב-inbox 🎉</p><p class="muted">חזור ללכידה כדי להוסיף.</p></div>`;
    createIcons();
    return;
  }

  const progress = total ? Math.round((num / total) * 100) : 0;
  const projectChips = projects
    .map(
      (p) =>
        `<button type="button" class="chip proj-chip" data-pid="${p.id}" style="border-inline-end:3px solid ${p.color || '#ccc'}">${p.emoji || ''} ${escape(p.name)}</button>`
    )
    .join('');

  let body = '';
  if (phase === 'action') {
    body = `
      <p class="clarify-q">האם זה דורש פעולה?</p>
      <div class="circle-actions">
        <button type="button" class="circle-btn is-primary" data-act="yes" title="כן"><i data-lucide="check"></i></button>
        <button type="button" class="circle-btn" data-act="ref" title="לשמור לעיון"><i data-lucide="book-open"></i></button>
        <button type="button" class="circle-btn" data-act="some" title="אולי"><i data-lucide="moon"></i></button>
        <button type="button" class="circle-btn" data-act="del" title="מחק"><i data-lucide="trash-2"></i></button>
      </div>`;
  } else if (phase === 'duration') {
    body = `
      <p class="clarify-q">כמה זמן ייקח?</p>
      <div class="circle-actions">
        <button type="button" class="circle-btn is-primary" data-dur="2min">⚡ פחות מ-2 דקות</button>
        <button type="button" class="circle-btn" data-dur="short">⏱ קצר</button>
        <button type="button" class="circle-btn" data-dur="long">🕐 ארוך</button>
      </div>`;
  } else if (phase === 'who') {
    body = `
      <p class="clarify-q">מי עושה?</p>
      <div class="circle-actions">
        <button type="button" class="circle-btn is-primary" data-who="me">🙋 אני</button>
        <button type="button" class="circle-btn" data-who="del">👥 להאציל</button>
        <button type="button" class="circle-btn" data-who="wait">⏳ ממתין</button>
      </div>
      <div id="who-extra" style="margin-top:12px"></div>`;
  } else if (phase === 'date') {
    body = `
      <p class="clarify-q">יש תאריך?</p>
      <div class="circle-actions">
        <button type="button" class="circle-btn" data-date="yes">📅 כן</button>
        <button type="button" class="circle-btn is-primary" data-date="no">➡ לא</button>
      </div>
      <input type="date" id="clarify-date" class="project-name-input" style="display:none;margin-top:12px" />`;
  } else if (phase === 'project') {
    body = `
      <p class="clarify-q">לאיזה פרויקט?</p>
      <div class="chips-row" style="flex-wrap:wrap">${projectChips}<button type="button" class="chip proj-chip" data-pid="">ללא פרויקט</button></div>`;
  }

  root.innerHTML = `
    <div class="clarify-wrap">
      <div class="clarify-progress">
        <span>${num} מתוך ${total}</span>
        <div class="clarify-progress-bar"><div class="clarify-progress-fill" style="width:${progress}%"></div></div>
      </div>
      <div class="clarify-stack-visual">
        <div class="clarify-card-back"></div>
        <div class="clarify-card-mid"></div>
        <div class="clarify-card-main" id="clarify-main-card">
          <h2 style="margin-top:0;font-size:1.1rem;font-weight:700">${escape(currentTask.title)}</h2>
          ${body}
          <p class="muted" style="margin-top:20px;font-size:0.85rem;font-style:italic">״המוח שם כדי לחשוב, לא כדי לאחסן.״</p>
        </div>
      </div>
    </div>
  `;
  createIcons();

  const nextTask = () => {
    const rest = inbox.filter((t) => t.id !== currentTask.id);
    currentTask = rest[0] || null;
    phase = 'action';
    refreshNav();
    renderClarify(root, ctx);
  };

  const flyNext = () => {
    const card = root.querySelector('#clarify-main-card');
    card?.classList.add('is-flying-out');
    setTimeout(nextTask, 320);
  };

  if (phase === 'action') {
    root.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', async () => {
        const act = /** @type {HTMLElement} */ (b).dataset.act;
        if (act === 'yes') {
          phase = 'duration';
          renderClarify(root, ctx);
        } else if (act === 'ref') {
          await updateTask(uid, currentTask.id, { status: 'reference' });
          flyNext();
        } else if (act === 'some') {
          await updateTask(uid, currentTask.id, { status: 'someday' });
          flyNext();
        } else if (act === 'del') {
          await updateTask(uid, currentTask.id, { status: 'deleted' });
          if (undoTimer) clearTimeout(undoTimer);
          const tid = currentTask.id;
          undoTimer = setTimeout(async () => {
            await deleteTask(uid, tid);
          }, 5000);
          flyNext();
        }
      });
    });
  } else if (phase === 'duration') {
    root.querySelectorAll('[data-dur]').forEach((b) => {
      b.addEventListener('click', async () => {
        const d = /** @type {HTMLElement} */ (b).dataset.dur;
        if (d === '2min') {
          await updateTask(uid, currentTask.id, {
            status: 'done',
            completedAt: Timestamp.now(),
            estimatedMinutes: 2,
          });
          flyNext();
        } else {
          const est = d === 'short' ? 20 : 60;
          await updateTask(uid, currentTask.id, { estimatedMinutes: est });
          phase = 'who';
          renderClarify(root, ctx);
        }
      });
    });
  } else if (phase === 'who') {
    root.querySelectorAll('[data-who]').forEach((b) => {
      b.addEventListener('click', async () => {
        const w = /** @type {HTMLElement} */ (b).dataset.who;
        const extra = root.querySelector('#who-extra');
        if (w === 'me') {
          phase = 'date';
          renderClarify(root, ctx);
        } else if (w === 'del') {
          if (extra) {
            extra.innerHTML = `
              <input type="text" id="del-to" class="project-name-input" placeholder="למי?"/>
              <button type="button" class="btn-primary" id="del-ok" style="margin-top:10px;width:100%">המשך</button>`;
            extra.querySelector('#del-ok')?.addEventListener('click', async () => {
              const v = /** @type {HTMLInputElement} */ (root.querySelector('#del-to'))?.value?.trim();
              if (!v) return;
              await updateTask(uid, currentTask.id, { status: 'delegated', delegatedTo: v });
              phase = 'project';
              renderClarify(root, ctx);
            });
          }
        } else if (w === 'wait') {
          if (extra) {
            extra.innerHTML = `
              <input type="text" id="wait-for" class="project-name-input" placeholder="ממתין ל..."/>
              <button type="button" class="btn-primary" id="wait-ok" style="margin-top:10px;width:100%">המשך</button>`;
            extra.querySelector('#wait-ok')?.addEventListener('click', async () => {
              const v = /** @type {HTMLInputElement} */ (root.querySelector('#wait-for'))?.value?.trim();
              if (!v) return;
              await updateTask(uid, currentTask.id, { status: 'waiting', waitingFor: v });
              phase = 'project';
              renderClarify(root, ctx);
            });
          }
        }
      });
    });
  } else if (phase === 'date') {
    root.querySelectorAll('[data-date]').forEach((b) => {
      b.addEventListener('click', async () => {
        const d = /** @type {HTMLElement} */ (b).dataset.date;
        const dateInp = /** @type {HTMLInputElement} */ (root.querySelector('#clarify-date'));
        if (d === 'yes') {
          if (dateInp) dateInp.style.display = 'block';
        } else {
          await updateTask(uid, currentTask.id, { status: 'next_action', dueDate: null });
          phase = 'project';
          renderClarify(root, ctx);
        }
      });
    });
    root.querySelector('#clarify-date')?.addEventListener('change', async () => {
      const dateInp = /** @type {HTMLInputElement} */ (root.querySelector('#clarify-date'));
      if (!dateInp?.value) return;
      const d = new Date(dateInp.value);
      await updateTask(uid, currentTask.id, {
        status: 'scheduled',
        dueDate: Timestamp.fromDate(d),
      });
      phase = 'project';
      renderClarify(root, ctx);
    });
  } else if (phase === 'project') {
    root.querySelectorAll('.proj-chip').forEach((b) => {
      b.addEventListener('click', async () => {
        const pid = /** @type {HTMLElement} */ (b).dataset.pid || null;
        await updateTask(uid, currentTask.id, { projectId: pid || null });
        flyNext();
      });
    });
  }
}

function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
