/** עדכון inferredMinutes לפי דחיות "ארוך_מדי" */
export function updateInferredMinutes(task) {
  const skips = (task.skipReasons || []).filter((s) => s.reason === 'ארוך_מדי');
  if (skips.length >= 3) {
    const avgSkipped = skips.reduce((a, s) => a + (s.availableMinutes || 0), 0) / skips.length;
    return { ...task, inferredMinutes: Math.round(avgSkipped * 1.2) };
  }
  return task;
}

/** עדכון inferredEnergyLevel ו-energyWeight */
export function updateEnergyWeight(task) {
  const energySkips = (task.skipReasons || []).filter((s) => s.reason === 'אין_אנרגיה').length;
  if (energySkips >= 3) {
    return {
      ...task,
      inferredEnergyLevel: 'גבוה',
      energyWeight: Math.min(100, energySkips * 20),
    };
  }
  return {
    ...task,
    energyWeight: Math.min(100, energySkips * 20),
  };
}

export function applyInferenceToTask(task) {
  let t = { ...task, skipReasons: task.skipReasons || [], energyWeight: task.energyWeight ?? 0 };
  t = updateInferredMinutes(t);
  t = updateEnergyWeight(t);
  return t;
}
