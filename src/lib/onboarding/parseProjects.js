/**
 * פירוק טקסט חופשי לשמות פרויקטים (שורות, פסיקים, מספור)
 * @param {string} raw
 * @returns {string[]}
 */
export function parseProjects(raw) {
  if (!raw || !raw.trim()) return [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    return lines.map((l) => l.replace(/^\d+[\.)]\s*/, '').trim()).filter(Boolean);
  }
  const comma = raw.split(/[,،、]/).map((s) => s.trim()).filter(Boolean);
  if (comma.length > 1) return comma;
  return [raw.trim()];
}
