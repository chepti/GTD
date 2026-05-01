const CONNECTORS = /(?:\s+)(?:וגם|ועוד|בנוסף|צריך גם)(?:\s+)/g;

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function inferStatus(text) {
  const t = text.toLowerCase();
  if (/לזכור|חשוב ש|כדאי לדעת|מידע/.test(t)) return 'reference';
  if (/לקנות|להתקשר|לשלוח|לבדוק|לסיים|לעשות/.test(t)) return 'next_action';
  return 'inbox';
}

function extractDate(text) {
  const now = new Date();
  if (/מחר/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (/בשבוע הבא|שבוע הבא/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return d;
  }
  const m = text.match(/ב-?\s*(\d{1,2})(?:\/(\d{1,2}))?/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = m[2] ? parseInt(m[2], 10) - 1 : now.getMonth();
    const d = new Date(now.getFullYear(), month, day);
    if (!Number.isNaN(d.getTime())) return d;
  }
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (text.includes(`יום ${DAY_NAMES[i]}`) || text.includes(DAY_NAMES[i])) {
      const target = i;
      const d = new Date(now);
      const diff = (target - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return d;
    }
  }
  return null;
}

function inferWaitingFor(text) {
  const m = text.match(/(?:עם|ל|אצל)\s+([\u0590-\u05FF\w\s]{2,40})/);
  if (m) return m[1].trim().split(/\s+/).slice(0, 4).join(' ');
  return null;
}

function inferContext(text) {
  const ctx = [];
  if (/בית|בבית/.test(text)) ctx.push('בית');
  if (/משרד|במשרד/.test(text)) ctx.push('משרד');
  if (/חוץ|בחוץ|רחוב/.test(text)) ctx.push('חוץ');
  if (/מחשב|מייל|אימייל|מחשבון/.test(text)) ctx.push('מחשב');
  if (/טלפון|להתקשר|שיחה/.test(text)) ctx.push('טלפון');
  if (ctx.length === 0) ctx.push('כל_מקום');
  return ctx;
}

function splitLines(raw) {
  return raw
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = line.replace(/^[\s\u200f\u200e]*[-*•□✓]\s*/, '').trim();
      if (!trimmed) return [];
      return trimmed.split(CONNECTORS).map((s) => s.trim()).filter(Boolean);
    });
}

/**
 * @param {string} rawText
 * @returns {{ title: string, suggestedStatus: string, suggestedDate: Date|null, suggestedContext: string[], waitingFor: string|null }[]}
 */
export function parseInbox(rawText) {
  const items = splitLines(rawText);
  return items.map((text) => {
    let suggestedStatus = inferStatus(text);
    const waitingFor = inferWaitingFor(text);
    if (waitingFor && suggestedStatus === 'inbox') suggestedStatus = 'next_action';
    return {
      title: text,
      suggestedStatus,
      suggestedDate: extractDate(text),
      suggestedContext: inferContext(text),
      waitingFor,
    };
  });
}
