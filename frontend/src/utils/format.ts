/* ========================================
   Formatting Helpers
   ======================================== */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format ISO date to "Sep 12, 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Get color class for a rating value */
export function ratingColor(val: number): string {
  if (val >= 4) return 'text-green-600';
  if (val >= 3) return 'text-primary';
  if (val >= 2) return 'text-orange-500';
  return 'text-red-600';
}

/** Get bg color for a bar fill */
export function barBg(val: number): string {
  if (val >= 4) return 'bg-green-500';
  if (val >= 3) return 'bg-primary';
  if (val >= 2) return 'bg-orange-500';
  return 'bg-red-500';
}

/** Get initials from a name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Avatar color from index */
const AVATAR_COLORS = [
  'bg-primary', 'bg-purple-600', 'bg-red-600', 'bg-orange-600',
  'bg-green-600', 'bg-cyan-600', 'bg-pink-600', 'bg-indigo-600',
  'bg-amber-600', 'bg-emerald-600',
];

export function avatarColor(idx: number): string {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}
