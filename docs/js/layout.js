/**
 * Lane assignment algorithm for commit graph layout.
 * Port of columns.py - assigns each commit to a column (lane).
 */

/**
 * Find the first empty lane, or return lanes.length to append.
 */
function findEmptyLane(lanes) {
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i] === null) return i;
  }
  return lanes.length;
}

/**
 * Assign column positions to each commit for graph rendering.
 * @param {Array} commits - Commits sorted newest-first (topo order)
 * @returns {Array} GraphRow objects with column, activeLanes, mergeLines, forkLines
 */
export function assignColumns(commits) {
  if (!commits.length) return [];

  const lanes = [];        // Active lanes: array of SHA|null
  const shaToLane = {};    // SHA -> lane index
  const rows = [];

  for (const commit of commits) {
    const sha = commit.sha;
    const mergeLines = [];
    const forkLines = [];

    // Find which lane this commit occupies
    let col;
    if (sha in shaToLane) {
      col = shaToLane[sha];
      delete shaToLane[sha];
    } else {
      col = findEmptyLane(lanes);
      if (col === lanes.length) lanes.push(null);
    }

    // Place this commit in its lane
    lanes[col] = sha;

    const parents = commit.parentShas || [];

    if (parents.length === 0) {
      // Root commit - lane ends
      lanes[col] = null;
    } else if (parents.length === 1) {
      const parentSha = parents[0];
      if (parentSha in shaToLane) {
        const existingLane = shaToLane[parentSha];
        mergeLines.push([col, existingLane]);
        lanes[col] = null;
      } else {
        lanes[col] = parentSha;
        shaToLane[parentSha] = col;
      }
    } else {
      // Merge commit
      const firstParent = parents[0];
      if (firstParent in shaToLane) {
        const existingLane = shaToLane[firstParent];
        mergeLines.push([col, existingLane]);
        lanes[col] = null;
      } else {
        lanes[col] = firstParent;
        shaToLane[firstParent] = col;
      }

      // Additional parents
      for (let i = 1; i < parents.length; i++) {
        const parentSha = parents[i];
        if (parentSha in shaToLane) {
          const existingLane = shaToLane[parentSha];
          mergeLines.push([col, existingLane]);
        } else {
          const parentLane = findEmptyLane(lanes);
          if (parentLane === lanes.length) lanes.push(null);
          lanes[parentLane] = parentSha;
          shaToLane[parentSha] = parentLane;
          if (parentLane !== col) {
            forkLines.push([col, parentLane]);
          }
        }
      }
    }

    // Compact trailing empty lanes
    while (
      lanes.length > 0 &&
      lanes[lanes.length - 1] === null &&
      !Object.values(shaToLane).includes(lanes.length - 1)
    ) {
      lanes.pop();
    }

    rows.push({
      commit,
      column: col,
      activeLanes: [...lanes],
      mergeLines: [...mergeLines],
      forkLines: [...forkLines],
      numColumns: Math.max(lanes.length, col + 1),
    });
  }

  return rows;
}
