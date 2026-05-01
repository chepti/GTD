import { createIcons } from '../lib/lucideIcons.js';
import { parseInbox } from '../lib/parseInbox.js';
import { batchAddTasksInbox, Timestamp } from '../firebase/db.js';
import { appState, setCaptureMode } from '../app/store.js';

const messages = [];

export function renderCapture(root, ctx) {
  const { uid, refreshNav } = ctx;
  const mode = appState.captureMode;

  if (mode === 'paste') {
    root.innerHTML = `
      <h1 class="screen-title">הדבקה מהירה</h1>
      <p class="muted">הדבק כאן כל מה שצברת. מבולגן זה בסדר.</p>
      <textarea class="onboarding-textarea" id="paste-area" rows="10" placeholder="הדבק כאן..."></textarea>
      <button type="button" class="btn-primary" id="parse-btn">⚡ פרק לרשימה</button>
      <div id="parse-preview"></div>
    `;
    let parsed = [];
    root.querySelector('#parse-btn')?.addEventListener('click', () => {
      const raw = /** @type {HTMLTextAreaElement} */ (root.querySelector('#paste-area')).value;
      parsed = parseInbox(raw);
      const prev = root.querySelector('#parse-preview');
      if (prev) {
        prev.innerHTML = `
          <p style="font-weight:700;margin-top:16px">אישור פריטים</p>
          ${parsed
            .map(
              (p, i) => `
            <div class="card" style="margin-bottom:8px;display:flex;gap:8px;align-items:flex-start" data-i="${i}">
              <input type="text" class="project-name-input" value="${escapeHtml(p.title)}" data-i="${i}" style="flex:1"/>
              <button type="button" class="btn-ghost ob-del-p" data-i="${i}">✕</button>
            </div>`
            )
            .join('')}
          <button type="button" class="btn-primary" id="save-all-inbox" style="margin-top:12px">שמור הכל ל-Inbox</button>
        `;
        prev.querySelectorAll('input').forEach((inp) => {
          inp.addEventListener('change', () => {
            const i = +/** @type {HTMLInputElement} */ (inp).dataset.i;
            parsed[i].title = /** @type {HTMLInputElement} */ (inp).value;
          });
        });
        prev.querySelectorAll('.ob-del-p').forEach((b) => {
          b.addEventListener('click', () => {
            const i = +/** @type {HTMLElement} */ (b).dataset.i;
            parsed.splice(i, 1);
            root.querySelector('#parse-btn')?.click();
          });
        });
        prev.querySelector('#save-all-inbox')?.addEventListener('click', async () => {
          const items = parsed.map((p) => ({
            title: p.title,
            context: p.suggestedContext,
            waitingFor: p.waitingFor,
            dueDate: p.suggestedDate ? Timestamp.fromDate(p.suggestedDate) : null,
          }));
          await batchAddTasksInbox(uid, items);
          setCaptureMode('chat');
          refreshNav();
          renderCapture(root, ctx);
        });
      }
    });
    createIcons();
    return;
  }

  root.innerHTML = `
    <div class="capture-chat">
      <div class="capture-bubble-app">מה מסתובב לך בראש?</div>
      <div id="capture-thread">${messages.map((m) => `<div class="capture-bubble-user">${escapeHtml(m)}</div><div class="capture-bubble-app subtle">תפסתי ✓</div>`).join('')}</div>
      <div class="capture-zen" aria-hidden="true">🪨</div>
      <div class="chips-row" style="justify-content:center;margin-bottom:8px">
        <span class="chip">מחשבה</span>
        <span class="chip">משימה</span>
      </div>
      <div class="capture-input-row">
        <input type="text" id="cap-input" placeholder="כתוב כאן..." autocomplete="off" />
        <button type="button" class="capture-send" id="cap-send" aria-label="שלח"><i data-lucide="send"></i></button>
      </div>
    </div>
  `;
  const send = async () => {
    const inp = /** @type {HTMLInputElement} */ (root.querySelector('#cap-input'));
    const v = inp?.value?.trim();
    if (!v) return;
    messages.push(v);
    while (messages.length > 15) messages.shift();
    inp.value = '';
    await batchAddTasksInbox(uid, [{ title: v, context: ['כל_מקום'] }]);
    refreshNav();
    renderCapture(root, ctx);
  };
  root.querySelector('#cap-send')?.addEventListener('click', send);
  root.querySelector('#cap-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send();
  });
  createIcons();
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
