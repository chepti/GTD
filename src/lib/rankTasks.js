/** מיון והצגת משימות next_action */
export const CONTEXTS = ['בית', 'משרד', 'חוץ', 'מחשב', 'טלפון', 'כל_מקום'];

function matchesContext(task, selected) {
  if (!selected || selected.length === 0) return true;
  const tc = task.context || ['כל_מקום'];
  return selected.some((c) => tc.includes(c) || tc.includes('כל_מקום'));
}

function skipCount(task) {
  return (task.skipReasons || []).length;
}

/** max createdAt among tasks per project for "stale project" boost */
function projectLastActivity(projectId, allTasks) {
  if (!projectId) return 0;
  let max = 0;
  for (const t of allTasks) {
    if (t.projectId === projectId && t.createdAt) {
      const ts = t.createdAt.toMillis ? t.createdAt.toMillis() : new Date(t.createdAt).getTime();
      if (ts > max) max = ts;
    }
  }
  return max;
}

/**
 * @param {object[]} tasks
 * @param {object} session { selectedContexts, energyCutoff, availableMinutes }
 * @param {object[]} allTasksForProjectActivity - כל המשימות לחישוב פעילות פרויקט
 */
export function rankTasks(tasks, session, allTasksForProjectActivity = tasks) {
  const { selectedContexts, energyCutoff = 100, availableMinutes = Infinity } = session;
  return tasks
    .filter((t) => t.status === 'next_action')
    .filter((t) => matchesContext(t, selectedContexts))
    .filter((t) => (t.energyWeight ?? 0) <= energyCutoff)
    .filter((t) => !t.inferredMinutes || t.inferredMinutes <= availableMinutes)
    .sort((a, b) => {
      const dueA = a.dueDate?.toMillis?.() ?? (a.dueDate ? new Date(a.dueDate).getTime() : Infinity);
      const dueB = b.dueDate?.toMillis?.() ?? (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
      if (dueA !== dueB) return dueA - dueB;
      const sA = skipCount(a);
      const sB = skipCount(b);
      if (sA !== sB) return sB - sA;
      const pa = projectLastActivity(a.projectId, allTasksForProjectActivity);
      const pb = projectLastActivity(b.projectId, allTasksForProjectActivity);
      return pa - pb;
    });
}

/** משימות לתצוגה עם עדיפות — כולל כבדות מעל סף (לעמעום) */
export function rankTasksWithDim(tasks, session, allTasks) {
  const ranked = rankTasks(
    tasks,
    {
      ...session,
      energyCutoff: 100,
      availableMinutes: session.availableMinutes ?? Infinity,
    },
    allTasks
  );
  const cutoff = session.energyCutoff ?? 60;
  const avail = session.availableMinutes ?? Infinity;
  return ranked.map((t) => {
    const heavy = (t.energyWeight ?? 0) > cutoff;
    const tooLong = t.inferredMinutes && t.inferredMinutes > avail;
    return { task: t, dimmed: heavy || tooLong };
  });
}
