import { createIcons } from 'lucide';
import { rankTasks } from '../lib/rankTasks.js';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function renderDashboard(root, ctx) {
  const { tasks, projects, weeklyReviews, inboxCount, navigate, sessionEnergyLabel } = ctx;
  const todayStart = startOfToday();
  const doneToday = tasks.filter((t) => {
    if (t.status !== 'done' || !t.completedAt) return false;
    const ts = t.completedAt.toMillis ? t.completedAt.toMillis() : new Date(t.completedAt).getTime();
    return ts >= todayStart.getTime();
  }).length;

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const nextRec = rankTasks(
    tasks,
    {
      selectedContexts: [],
      energyCutoff: 100,
      availableMinutes: Infinity,
    },
    tasks
  ).slice(0, 3);

  root.innerHTML = `
    <h1 class="screen-title">דשבורד</h1>
    <div class="card dashboard-card">
      <h3 style="margin-top:0">היום</h3>
      <p><span class="wins-badge" id="dash-wins">${doneToday}</span> משימות הושלמו היום</p>
      <p class="muted" style="font-size:0.9rem">🔋 ${sessionEnergyLabel}</p>
      <p style="font-weight:600;margin-top:12px">המלצות לפעולה</p>
      <ul style="padding:0;margin:0;list-style:none">
        ${nextRec
          .map((t) => {
            const pn = t.projectId ? projectMap[t.projectId]?.name || 'פרויקט' : 'ללא פרויקט';
            return `<li style="padding:8px 0;border-bottom:1px solid var(--color-border)">${escape(t.title)} <span class="muted">· ${escape(pn)}</span></li>`;
          })
          .join('') || '<li class="muted">אין פעולות הבאות</li>'}
      </ul>
    </div>
    <div class="card dashboard-card">
      <h3 style="margin-top:0">הפרויקטים שלי</h3>
      ${projects
        .map((p) => {
          const open = tasks.filter((t) => t.projectId === p.id && ['next_action', 'inbox', 'waiting', 'scheduled'].includes(t.status)).length;
          const pct = Math.min(100, open * 10);
          return `<div style="margin-bottom:12px;cursor:pointer" class="dash-proj" data-id="${p.id}">
            <div style="display:flex;justify-content:space-between"><span>${p.emoji || '📁'} ${escape(p.name)}</span><span class="muted">${open} פתוחות</span></div>
            <div style="height:6px;background:var(--color-bg-soft);border-radius:99px;margin-top:6px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${p.color || 'var(--color-primary)'}"></div>
            </div>
          </div>`;
        })
        .join('') || '<p class="muted">אין פרויקטים</p>'}
    </div>
    <div class="card dashboard-card">
      <h3 style="margin-top:0">יומן נצחונות</h3>
      ${weeklyReviews
        .slice(0, 6)
        .map(
          (w) => `
        <div class="review-timeline-item">
          <strong>${formatDate(w.createdAt)}</strong> ${w.starredSelf ? '⭐' : ''}
          <div class="muted small">${escape((w.note || '').slice(0, 80))}</div>
        </div>`
        )
        .join('') || '<p class="muted">עדיין אין סקירות</p>'}
    </div>
    <div class="card dashboard-card">
      <h3 style="margin-top:0">Inbox ממתין</h3>
      <p><span class="nav-badge" style="position:static;display:inline-flex">${inboxCount}</span> פריטים</p>
      <button type="button" class="btn-primary" id="dash-clarify">לנקות עכשיו</button>
    </div>
  `;
  root.querySelector('#dash-clarify')?.addEventListener('click', () => navigate('clarify'));
  root.querySelectorAll('.dash-proj').forEach((el) => {
    el.addEventListener('click', () => navigate('organize'));
  });
  createIcons();
}

function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('he-IL');
}
