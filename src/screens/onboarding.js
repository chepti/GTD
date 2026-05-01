import { parseProjects } from '../lib/onboarding/parseProjects.js';
import { addProject, saveMeta, serverTimestamp } from '../firebase/db.js';

const DEFAULT_COLORS = ['#744577', '#6b9b7a', '#5c7cfa', '#e07c4c', '#38b2ac', '#d53f8c'];
const DEFAULT_EMOJIS = ['📌', '🏠', '💼', '🌿', '📚', '✨', '🎯', '❤️'];

let step = 0;
let draftProjects = [];
let colorIdx = 0;
let deepProjectIndex = 0;

export function renderOnboarding(root, { uid, onDone }) {
  function paint() {
    root.innerHTML = renderStep();
    bind();
  }

  function renderStep() {
    if (step === 0) {
      return `
        <div class="onboarding-card card">
          <h1 class="onboarding-title">שלום! אני GTD.</h1>
          <p class="onboarding-text">בוא נבנה ביחד את המפה של החיים שלך.</p>
          <button type="button" class="btn-primary" id="ob-next">בואו נתחיל</button>
        </div>`;
    }
    if (step === 1) {
      return `
        <div class="onboarding-card card">
          <h2 class="onboarding-title">מה הפרויקטים הגדולים שלך?</h2>
          <p class="onboarding-text muted">זוגיות, בית, עבודה, תחביב, חלום — כל מה שתופס מקום בראש.</p>
          <textarea class="onboarding-textarea" id="ob-projects" rows="6" placeholder="כתוב בשורות או מופרד בפסיקים..."></textarea>
          <button type="button" class="btn-primary" id="ob-parse">המשך</button>
        </div>`;
    }
    if (step === 2) {
      const items = draftProjects
        .map(
          (name, i) => `
        <div class="project-confirm card" data-i="${i}">
          <p>זיהיתי: <strong>${escapeHtml(name)}</strong> ✓</p>
          <input type="text" class="project-name-input" value="${escapeHtml(name)}" data-i="${i}" />
          <div class="row-btns">
            <button type="button" class="btn-ghost ob-del" data-i="${i}">מחק</button>
          </div>
        </div>`
        )
        .join('');
      return `
        <div class="onboarding-stack">
          <h2 class="screen-title">אישור פרויקטים</h2>
          ${items}
          <button type="button" class="btn-primary" id="ob-colors">המשך לצבעים</button>
        </div>`;
    }
    if (step === 3) {
      return `
        <div class="onboarding-stack">
          <h2 class="screen-title">צבע ואימוג׳י</h2>
          <p class="muted">בחר לכל פרויקט — אפשר לדלג ולהשאיר ברירת מחדל.</p>
          <div class="grid-emoji" id="emoji-grid">
            ${draftProjects
              .map(
                (p, i) => `
              <div class="card project-style-card" data-i="${i}">
                <p class="project-style-name">${escapeHtml(p.name)}</p>
                <div class="color-row">
                  ${DEFAULT_COLORS.map(
                    (c, ci) =>
                      `<button type="button" class="color-dot ${p.color === c ? 'is-on' : ''}" style="background:${c}" data-i="${i}" data-color="${c}" aria-label="צבע"></button>`
                  ).join('')}
                </div>
                <div class="emoji-row">
                  ${DEFAULT_EMOJIS.map(
                    (e) =>
                      `<button type="button" class="emoji-pick ${p.emoji === e ? 'is-on' : ''}" data-i="${i}" data-emoji="${e}">${e}</button>`
                  ).join('')}
                </div>
              </div>`
              )
              .join('')}
          </div>
          <button type="button" class="btn-primary" id="ob-deep">המשך</button>
        </div>`;
    }
    if (step === 4) {
      const p = draftProjects[deepProjectIndex];
      return `
        <div class="onboarding-card card">
          <h2 class="onboarding-title">העמקה: ${escapeHtml(p.name)}</h2>
          <label class="field-label">למה הוא חשוב לך?</label>
          <textarea class="onboarding-textarea" id="ob-why" rows="3"></textarea>
          <label class="field-label">איך העולם נהיה טוב יותר כשתקדם בו?</label>
          <textarea class="onboarding-textarea" id="ob-impact" rows="3"></textarea>
          <div class="row-btns">
            <button type="button" class="btn-ghost" id="ob-more-deep">כן, עוד אחד</button>
            <button type="button" class="btn-primary" id="ob-finish-deep">לא עכשיו, נמשיך</button>
          </div>
        </div>`;
    }
    if (step === 5) {
      return `
        <div class="onboarding-card card">
          <h2 class="onboarding-title">מעולה!</h2>
          <p class="onboarding-text">יש לך <strong>${draftProjects.length}</strong> פרויקטים. עכשיו בוא נתפוס משימות.</p>
          <button type="button" class="btn-primary" id="ob-done">ללכידה</button>
        </div>`;
    }
    return '';
  }

  function bind() {
    const next = () => {
      step += 1;
      paint();
    };
    root.querySelector('#ob-next')?.addEventListener('click', next);
    root.querySelector('#ob-parse')?.addEventListener('click', () => {
      const raw = /** @type {HTMLTextAreaElement} */ (root.querySelector('#ob-projects'))?.value || '';
      draftProjects = parseProjects(raw).map((name) => ({
        name,
        color: DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length],
        emoji: DEFAULT_EMOJIS[colorIdx % DEFAULT_EMOJIS.length],
        why: '',
        impact: '',
      }));
      if (draftProjects.length === 0) {
        alert('הוסף לפחות פרויקט אחד');
        return;
      }
      step = 2;
      paint();
    });
    root.querySelectorAll('.project-name-input').forEach((inp) => {
      inp.addEventListener('change', () => {
        const i = parseInt(/** @type {HTMLInputElement} */ (inp).dataset.i || '0', 10);
        draftProjects[i].name = /** @type {HTMLInputElement} */ (inp).value.trim();
      });
    });
    root.querySelectorAll('.ob-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(/** @type {HTMLElement} */ (btn).dataset.i || '0', 10);
        draftProjects.splice(i, 1);
        if (draftProjects.length === 0) {
          step = 1;
        }
        paint();
      });
    });
    root.querySelector('#ob-colors')?.addEventListener('click', () => {
      step = 3;
      paint();
    });
    root.querySelectorAll('.color-dot').forEach((b) => {
      b.addEventListener('click', () => {
        const i = parseInt(/** @type {HTMLElement} */ (b).dataset.i || '0', 10);
        draftProjects[i].color = /** @type {HTMLElement} */ (b).dataset.color || '';
        paint();
      });
    });
    root.querySelectorAll('.emoji-pick').forEach((b) => {
      b.addEventListener('click', () => {
        const i = parseInt(/** @type {HTMLElement} */ (b).dataset.i || '0', 10);
        draftProjects[i].emoji = /** @type {HTMLElement} */ (b).dataset.emoji || '📌';
        paint();
      });
    });
    root.querySelector('#ob-deep')?.addEventListener('click', () => {
      deepProjectIndex = 0;
      step = 4;
      paint();
    });
    root.querySelector('#ob-more-deep')?.addEventListener('click', async () => {
      await saveDeep();
      deepProjectIndex += 1;
      if (deepProjectIndex >= draftProjects.length) {
        step = 5;
      }
      paint();
    });
    root.querySelector('#ob-finish-deep')?.addEventListener('click', async () => {
      await saveDeep();
      step = 5;
      paint();
    });
    root.querySelector('#ob-done')?.addEventListener('click', async () => {
      for (const p of draftProjects) {
        await addProject(uid, {
          name: p.name,
          why: p.why || '',
          impact: p.impact || '',
          color: p.color,
          emoji: p.emoji,
        });
      }
      await saveMeta(
        uid,
        {
          onboardingComplete: true,
          weeklyReviewDay: 5,
          weeklyReviewTime: '09:00',
          createdAt: serverTimestamp(),
        },
        true
      );
      onDone();
    });
  }

  async function saveDeep() {
    const p = draftProjects[deepProjectIndex];
    if (!p) return;
    const why = /** @type {HTMLTextAreaElement} */ (root.querySelector('#ob-why'))?.value?.trim() || '';
    const impact = /** @type {HTMLTextAreaElement} */ (root.querySelector('#ob-impact'))?.value?.trim() || '';
    p.why = why;
    p.impact = impact;
  }

  paint();
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
