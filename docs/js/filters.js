/**
 * Filter and search logic for commits.
 */

/**
 * Apply filters to a commit list.
 */
export function applyFilters(commits, commitMap, filterState) {
  let result = commits;

  if (filterState.authorEmail) {
    result = result.filter(c => c.authorEmail === filterState.authorEmail);
  }

  if (filterState.searchText) {
    const text = filterState.searchText.toLowerCase();
    result = result.filter(c =>
      c.subject.toLowerCase().includes(text) ||
      c.message.toLowerCase().includes(text) ||
      c.shortSha.toLowerCase().includes(text) ||
      c.authorName.toLowerCase().includes(text)
    );
  }

  if (filterState.branch) {
    const reachable = reachableFromBranch(commits, commitMap, filterState.branch);
    if (reachable) {
      result = result.filter(c => reachable.has(c.sha));
    }
  }

  return result;
}

/**
 * Find all commit SHAs reachable from a branch head.
 */
function reachableFromBranch(commits, commitMap, branch) {
  // Find the branch head
  let headSha = null;
  for (const commit of commits) {
    if (commit.branches && commit.branches.includes(branch)) {
      headSha = commit.sha;
      break;
    }
  }

  if (!headSha) return null;

  const reachable = new Set();
  const stack = [headSha];

  while (stack.length > 0) {
    const sha = stack.pop();
    if (reachable.has(sha)) continue;
    reachable.add(sha);

    const node = commitMap[sha];
    if (node && node.parentShas) {
      stack.push(...node.parentShas);
    }
  }

  return reachable;
}
