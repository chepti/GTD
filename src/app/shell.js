import { createIcons } from 'lucide';

export const TABS = [
  { id: 'capture', label: 'לכידה', icon: 'pencil', submenu: true },
  { id: 'clarify', label: 'הבהרה', icon: 'sparkles', submenu: 'badge' },
  { id: 'organize', label: 'ארגון', icon: 'layers', submenu: true },
  { id: 'engage', label: 'פעולות', icon: 'zap', submenu: false },
  { id: 'weekly', label: 'סקירה', icon: 'trophy', submenu: true },
  { id: 'dashboard', label: 'דשבורד', icon: 'layout-dashboard', submenu: false },
];

/**
 * @param {HTMLElement} root
 * @param {{ getInboxCount: () => number, onTabChange: (id: string) => void, onSubmenuAction: (action: string) => void }} handlers
 */
export function mountShell(root, { getInboxCount, onTabChange, onSubmenuAction }) {
  root.innerHTML = `
    <header class="app-header">
      <div class="app-header-inner">
        <i data-lucide="sparkles" class="app-logo-icon" aria-hidden="true"></i>
        <span class="app-title">GTD</span>
      </div>
    </header>
    <main class="app-main" id="screen-root"></main>
    <div class="bubble-overlay" id="bubble-overlay" hidden></div>
    <nav class="bottom-nav" id="bottom-nav" aria-label="ניווט ראשי"></nav>
  `;
  createIcons();

  const nav = root.querySelector('#bottom-nav');
  const overlay = root.querySelector('#bubble-overlay');

  function renderNav() {
    const inbox = getInboxCount();
    nav.innerHTML = TABS.map((t) => {
      const badge =
        t.submenu === 'badge' && inbox > 0
          ? `<span class="nav-badge" aria-label="פריטים בתור">${inbox > 99 ? '99+' : inbox}</span>`
          : '';
      return `
      <button type="button" class="nav-item" data-tab="${t.id}" aria-label="${t.label}">
        <span class="nav-icon-wrap"><i data-lucide="${t.icon}" class="nav-svg" aria-hidden="true"></i></span>
        ${badge}
        <span class="nav-label">${t.label}</span>
      </button>`;
    }).join('');
    nav.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = /** @type {HTMLElement} */ (btn).dataset.tab;
        const current = nav.querySelector('.nav-item.is-active')?.getAttribute('data-tab');
        const def = TABS.find((x) => x.id === id);
        if (current === id && def?.submenu === true) {
          openOverlay(id);
          return;
        }
        setActiveTab(id);
        onTabChange(id);
      });
    });
    createIcons();
  }

  function setActiveTab(id) {
    overlay.hidden = true;
    nav.querySelectorAll('.nav-item').forEach((b) => {
      b.classList.toggle('is-active', /** @type {HTMLElement} */ (b).dataset.tab === id);
    });
  }

  function openOverlay(tabId) {
    const tab = TABS.find((x) => x.id === tabId);
    if (!tab?.submenu || tab.submenu === 'badge') {
      overlay.hidden = true;
      return;
    }
    overlay.hidden = false;
    if (tabId === 'capture') {
      overlay.innerHTML = `
        <div class="bubble-backdrop" tabindex="-1"></div>
        <div class="bubble-menu">
          <button type="button" class="bubble-btn" data-action="capture-chat"><i data-lucide="message-circle"></i> שיחה</button>
          <button type="button" class="bubble-btn" data-action="capture-paste"><i data-lucide="clipboard-list"></i> הדבק טקסט</button>
        </div>`;
    } else if (tabId === 'organize') {
      overlay.innerHTML = `
        <div class="bubble-backdrop" tabindex="-1"></div>
        <div class="bubble-menu">
          <button type="button" class="bubble-btn" data-action="org-calendar"><i data-lucide="calendar"></i> יומן</button>
          <button type="button" class="bubble-btn" data-action="org-waiting"><i data-lucide="clock"></i> ממתין ל</button>
          <button type="button" class="bubble-btn" data-action="org-someday"><i data-lucide="moon"></i> אולי</button>
          <button type="button" class="bubble-btn" data-action="org-reference"><i data-lucide="book-open"></i> עיון</button>
        </div>`;
    } else if (tabId === 'weekly') {
      overlay.innerHTML = `
        <div class="bubble-backdrop" tabindex="-1"></div>
        <div class="bubble-menu">
          <button type="button" class="bubble-btn" data-action="weekly-start"><i data-lucide="bar-chart-3"></i> סקירה שבועית</button>
          <button type="button" class="bubble-btn" data-action="weekly-schedule"><i data-lucide="settings-2"></i> קבע תזמון</button>
        </div>`;
    }
    createIcons();
    overlay.querySelector('.bubble-backdrop')?.addEventListener('click', () => {
      overlay.hidden = true;
    });
    overlay.querySelectorAll('.bubble-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const action = /** @type {HTMLElement} */ (b).dataset.action;
        if (action) onSubmenuAction(action);
        overlay.hidden = true;
      });
    });
  }

  return {
    renderNav,
    setActiveTab,
    getScreenRoot: () => /** @type {HTMLElement} */ (root.querySelector('#screen-root')),
  };
}
