/**
 * אנרגיית session: ברירת מחדל גבוה; אחרי 3 משימות inferredEnergyLevel=גבוה → בינוני; אחרי 30 דק׳ → נמוך; איפוס בטעינה מחדש
 */
const LEVELS = ['גבוה', 'בינוני', 'נמוך'];

export function createSessionEnergy() {
  let level = 'גבוה';
  let highEnergyTaskCount = 0;
  let sessionStart = Date.now();

  return {
    getLevel: () => level,
    /** לאחר השלמת משימה — אם המשימה נלמדה ככבדת אנרגיה */
    onTaskCompleted(task) {
      if (task?.inferredEnergyLevel === 'גבוה') {
        highEnergyTaskCount += 1;
        if (highEnergyTaskCount >= 3) level = 'בינוני';
      }
    },
    tick() {
      const mins = (Date.now() - sessionStart) / 60000;
      if (mins >= 30) level = 'נמוך';
    },
    label() {
      if (level === 'גבוה') return 'אנרגיה גבוהה';
      if (level === 'בינוני') return 'אנרגיה בינונית';
      return 'אנרגיה נמוכה';
    },
  };
}

export { LEVELS };
