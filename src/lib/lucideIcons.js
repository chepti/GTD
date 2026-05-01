import { createIcons as lucideCreateIcons, icons } from 'lucide';

/** Lucide 0.46+ דורש אובייקט icons — עוטף כדי לא לשבור קריאות קיימות */
export function createIcons(options = {}) {
  return lucideCreateIcons({ icons, ...options });
}
