import { createIcons } from '../lib/lucideIcons.js';
import { burstConfetti } from '../lib/confetti.js';
import { addWeeklyReview, updateProject, saveMeta, Timestamp } from '../firebase/db.js';

let wStep = 0;
let wData = {
  starredSelf: false,
  note: '',
  completedTaskIds: [],
  projectsSummary: [],
  stickerEmoji: '🎉',
};

export function resetWeeklyWizard() {
  wStep = 0;
  wData = {
    starredSelf: false,
    note: '',
    completedTaskIds: [],
    projectsSummary: [],
    stickerEmoji: '🎉',
  };
}

export function renderWeekly(root, ctx) {
  const { tasks, projects, uid, meta, onClose, mode } = ctx;
  if (mode === 'schedule') {
    root.innerHTML = `
      <div class="modal" id="sched-modal">
        <div class="modal-inner">
          <h3 style="margin-top:0">קבע תזמון לסקירה</h3>
          <label class="field-label">יום בשבוע (0=ראשון)</label>
          <input type="number" min="0" max="6" id="wd" class="project-name-input" value="${meta?.weeklyReviewDay ?? 5}" />
          <label class="field-label">שעה</label>
          <input type="time" id="wt" class="project-name-input" value="${meta?.weeklyReviewTime || '09:00'}" />
          <button type="button" class="btn-primary" id="save-sched" style="margin-top:16px">שמור</button>
          <button type="button" class="btn-ghost" id="close-sched" style="margin-top:8px;width:100%">סגור</button>
        </div>
      </div>`;
    root.querySelector('#save-sched')?.addEventListener('click', async () => {
      const d = /** @type {HTMLInputElement} */ (root.querySelector('#wd')).value;
      const t = /** @type {HTMLInputElement} */ (root.querySelector('#wt')).value;
      await saveMeta(uid, { weeklyReviewDay: Number(d), weeklyReviewTime: t }, true);
      onClose();
    });
    root.querySelector('#close-sched')?.addEventListener('click', onClose);
    createIcons();
    return;
  }

  const weekAgo = Date.now() - 7 * 86400000;
  const doneWeek = tasks.filter((t) => {
    if (t.status !== 'done' || !t.completedAt) return false;
    const ts = t.completedAt.toMillis ? t.completedAt.toMillis() : new Date(t.completedAt).getTime();
    return ts >= weekAgo;
  });
  wData.completedTaskIds = doneWeek.map((t) => t.id);

  const projectsSummary = projects.map((p) => ({
    projectId: p.id,
    completedCount: doneWeek.filter((t) => t.projectId === p.id).length,
  }));
  wData.projectsSummary = projectsSummary;

  if (wStep === 0) {
    root.innerHTML = `
      <div class="weekly-step">
        <h2 class="screen-title" style="font-size:28px;font-weight:900">מה עשית השבוע?</h2>
        <div class="weekly-big" id="w-count">${doneWeek.length}</div>
        <p>משימות הושלמו</p>
        <ul style="text-align:right;padding:0;list-style:none;margin:20px 0">
          ${doneWeek
            .slice(0, 3)
            .map((t) => {
              const p = projects.find((x) => x.id === t.projectId);
              const col = p?.color || '#ccc';
              return `<li style="padding:8px 0;border-bottom:1px solid var(--color-border);border-inline-start:4px solid ${col};padding-inline-start:10px">${escape(t.title)}</li>`;
            })
            .join('')}
        </ul>
        <button type="button" class="btn-ghost" id="w-more">עוד</button>
        <button type="button" class="btn-primary" id="w-star">${wData.starredSelf ? '⭐ סומן' : '⭐ אני גאה בעצמי השבוע'}</button>
        <textarea class="onboarding-textarea" id="w-note" rows="2" placeholder="כמה מילים...">${escape(wData.note)}</textarea>
        <button type="button" class="btn-primary" id="w-next1" style="margin-top:12px">המשך</button>
        <button type="button" class="btn-ghost" id="w-close" style="margin-top:8px">סגור</button>
      </div>`;
    root.querySelector('#w-star')?.addEventListener('click', () => {
      wData.starredSelf = !wData.starredSelf;
      renderWeekly(root, ctx);
    });
    root.querySelector('#w-note')?.addEventListener('change', (e) => {
      wData.note = /** @type {HTMLTextAreaElement} */ (e.target).value;
    });
    root.querySelector('#w-next1')?.addEventListener('click', () => {
      wStep = 1;
      renderWeekly(root, ctx);
    });
    root.querySelector('#w-close')?.addEventListener('click', onClose);
    root.querySelector('#w-more')?.addEventListener('click', () => alert(doneWeek.map((t) => t.title).join('\n')));
    createIcons();
    return;
  }

  if (wStep === 1) {
    const emojis = ['🎉', '✨', '🏆', '💪', '❤️', '🔥', '🌟', '🎯', '🙌', '👏', '🥳', '🌈'];
    root.innerHTML = `
      <div class="weekly-step card">
        <h3>חגיגת נצחונות</h3>
        <p>בחר אימוג׳י מדבקה</p>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0">
          ${emojis.map((e) => `<button type="button" class="emoji-pick ${wData.stickerEmoji === e ? 'is-on' : ''}" data-e="${e}">${e}</button>`).join('')}
        </div>
        <button type="button" class="btn-primary" id="w-confetti">חגיגה!</button>
        <button type="button" class="btn-primary" id="w-next2" style="margin-top:10px">המשך לסקירה</button>
      </div>`;
    root.querySelectorAll('[data-e]').forEach((b) => {
      b.addEventListener('click', () => {
        wData.stickerEmoji = /** @type {HTMLElement} */ (b).dataset.e || '🎉';
        renderWeekly(root, ctx);
      });
    });
    root.querySelector('#w-confetti')?.addEventListener('click', (e) => {
      burstConfetti(e.clientX, e.clientY, 12);
    });
    root.querySelector('#w-next2')?.addEventListener('click', () => {
      wStep = 2;
      renderWeekly(root, ctx);
    });
    createIcons();
    return;
  }

  if (wStep === 2) {
    const p = projects[0];
    root.innerHTML = `
      <div class="weekly-step">
        <h3>עוברים על פרויקטים</h3>
        ${projects
          .map(
            (pr) => `
          <div class="card" style="margin-bottom:12px;text-align:right">
            <div style="font-size:1.5rem">${pr.emoji || '📁'}</div>
            <strong>${escape(pr.name)}</strong>
            <p class="muted" style="font-size:0.9rem">${escape(pr.why || '')}</p>
            <p>יש פעולה הבאה מוגדרת?</p>
            <div class="row-btns">
              <button type="button" class="btn-ghost" data-pid="${pr.id}" data-has="yes">כן ✓</button>
              <button type="button" class="btn-primary" data-pid="${pr.id}" data-has="no">לא - הוסף עכשיו</button>
            </div>
            <p class="muted">פתוחות: ${tasks.filter((t) => t.projectId === pr.id && t.status !== 'done').length}</p>
            <button type="button" class="btn-ghost ob-arch" data-pid="${pr.id}">העבר לארכיון</button>
          </div>`
          )
          .join('') || '<p class="muted">אין פרויקטים</p>'}
        <button type="button" class="btn-primary" id="w-next3">המשך</button>
      </div>`;
    root.querySelectorAll('[data-has]').forEach((b) => {
      b.addEventListener('click', () => {
        if (/** @type {HTMLElement} */ (b).dataset.has === 'no') {
          ctx.navigate?.('engage');
        }
      });
    });
    root.querySelectorAll('.ob-arch').forEach((b) => {
      b.addEventListener('click', async () => {
        const pid = /** @type {HTMLElement} */ (b).dataset.pid;
        await updateProject(uid, pid, { isArchived: true });
      });
    });
    root.querySelector('#w-next3')?.addEventListener('click', () => {
      wStep = 3;
      renderWeekly(root, ctx);
    });
    createIcons();
    return;
  }

  if (wStep === 3) {
    const inboxN = tasks.filter((t) => t.status === 'inbox').length;
    root.innerHTML = `
      <div class="weekly-step">
        <h3>מיכלים</h3>
        <div class="card" style="text-align:right;margin-bottom:12px">
          <p>Inbox: נשארו <strong>${inboxN}</strong> פריטים</p>
          <button type="button" class="btn-primary" id="go-clarify">לנקות עכשיו</button>
        </div>
        <div class="card" style="text-align:right">
          <p>ממתין ל: עברו על כל פריט</p>
          <p class="muted">עדכן סטטוס מהארגון</p>
        </div>
        <button type="button" class="btn-primary" id="w-next4" style="margin-top:16px">המשך</button>
      </div>`;
    root.querySelector('#go-clarify')?.addEventListener('click', () => ctx.navigate?.('clarify'));
    root.querySelector('#w-next4')?.addEventListener('click', () => {
      wStep = 4;
      renderWeekly(root, ctx);
    });
    createIcons();
    return;
  }

  if (wStep === 4) {
    root.innerHTML = `
      <div class="weekly-step card">
        <h3>סקירה הושלמה! 🎉</h3>
        <p>פרויקטים עם פעולה: ${projects.filter((p) => tasks.some((t) => t.projectId === p.id && t.status === 'next_action')).length}</p>
        <p>סה״כ הושלמו השבוע: ${wData.completedTaskIds.length}</p>
        <button type="button" class="btn-primary" id="w-save-review">שמור סקירה</button>
      </div>`;
    root.querySelector('#w-save-review')?.addEventListener('click', async () => {
      const weekStart = Timestamp.fromDate(new Date(Date.now() - 7 * 86400000));
      await addWeeklyReview(uid, {
        weekStart,
        starredSelf: wData.starredSelf,
        note: wData.note,
        completedTaskIds: wData.completedTaskIds,
        projectsSummary: wData.projectsSummary,
        stickerEmoji: wData.stickerEmoji,
      });
      resetWeeklyWizard();
      onClose();
    });
    createIcons();
  }
}

function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
