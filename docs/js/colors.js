/**
 * Deterministic author color assignment.
 */

const PALETTE = [
  '#58a6ff', // blue
  '#3fb950', // green
  '#d29922', // yellow
  '#f85149', // red
  '#bc8cff', // purple
  '#f78166', // orange
  '#79c0ff', // light blue
  '#56d364', // bright green
  '#e3b341', // gold
  '#ff7b72', // salmon
  '#d2a8ff', // lavender
  '#ffa657', // light orange
  '#a5d6ff', // sky blue
  '#7ee787', // lime
  '#f2cc60', // amber
  '#ffa198', // pink
  '#e2c5ff', // light purple
  '#ffb757', // peach
  '#39d353', // emerald
  '#db61a2', // magenta
];

/**
 * FNV-1a hash of a string, returns unsigned 32-bit integer.
 */
function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Get a deterministic color for an author email.
 */
export function getAuthorColor(email) {
  const idx = fnv1a(email) % PALETTE.length;
  return PALETTE[idx];
}

/**
 * Assign colors to all authors.
 */
export function assignAuthorColors(authors) {
  const colors = {};
  for (const email of Object.keys(authors)) {
    colors[email] = getAuthorColor(email);
  }
  return colors;
}
