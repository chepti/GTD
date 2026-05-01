import { createIcons } from 'lucide';
import { updateTask, Timestamp } from '../firebase/db.js';

function fmtRelative(ts) {
  if (!ts) return '';
  const t = ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
  const diff = Date.now() - t;
  const days = Math.floor(diff / (86400000));
  if (days <= 0) return 'היום';
  if (days === 1) return 'יום אחד';
  return `${days} ימים`;
}

export function renderOrganize(root, ctx) {
  const { tasks, projects, organizeFocus } = ctx;
  const pmap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const scheduled = tasks
    .filter((t) => t.status === 'scheduled')
    .sort((a, b) => {
      const da = a.dueDate?.toMillis?.() ?? 0;
      const db = b.dueDate?.toMillis?.() ?? 0;
      return da - db;
    });
  const next = tasks.filter((t) => t.status === 'next_action');
  const waiting = tasks.filter((t) => t.status === 'waiting');
  const someday = tasks.filter((t) => t.status === 'someday');
  const ref = tasks.filter((t) => t.status === 'reference');

  root.innerHTML = `
    <h1 class="screen-title">ארגון</h1>
    <details class="org-section" ${organizeFocus === 'cal' ? 'open' : ''}>
      <summary>📅 יומן</summary>
      <div class="org-list">${scheduled.map((t) => taskRow(t, pmap, uid)).join('') || '<p class="muted">ריק</p>'}</div>
    </details>
    <details class="org-section" ${organizeFocus === 'wait' ? 'open' : ''}>
      <summary>⏳ ממתין ל</summary>
      <div class="org-list">${waiting.map((t) => taskRow(t, pmap, uid)).join('') || '<p class="muted">ריק</p>'}</div>
    </details>
    <details class="org-section" ${organizeFocus === 'some' ? 'open' : ''}>
      <summary>🌙 אולי/מתישהו</summary>
      <div class="org-list">${someday.map((t) => taskRow(t, pmap, uid)).join('') || '<p class="muted">ריק</p>'}</div>
    </details>
    <details class="org-section" ${organizeFocus === 'ref' ? 'open' : ''}>
      <summary>📚 עיון ומידע</summary>
      <div class="org-list">${ref.map((t) => taskRow(t, pmap, uid)).join('') || '<p class="muted">ריק</p>'}</div>
    </details>
    <details class="org-section" ${!organizeFocus || organizeFocus === 'next' ? 'open' : ''}>
      <summary>⚡ פעולות הבאות</summary>
      <div class="org-list">${next.map((t) => taskRow(t, pmap, uid)).join('') || '<p class="muted">ריק</p>'}</div>
    </details>
  `;
  bindRows(root, ctx);
  createIcons();
}

function taskRow(t, pmap, uid) {
  const pn = t.projectId ? pmap[t.projectId]?.name || '' : '';
  const wait = t.status === 'waiting' ? `<span class="muted">${fmtRelative(t.createdAt)} · ${escape(t.waitingFor || '')}</span>` : '';
  return `<div class="org-task" data-id="${t.id}">
    <span style="flex:1">${escape(t.title)} ${pn ? `<span class="muted">· ${escape(pn)}</span>` : ''} ${wait}</span>
    <button type="button" class="btn-ghost mini" data-act="next" data-id="${t.id}">לפעולות</button>
  </div>`;
}

function bindRows(root, ctx) {
  root.querySelectorAll('[data-act="next"]').forEach((b) => {
    b.addEventListener('click', () => {
      ctx.navigate?.('engage');
    });
  });
}

function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
