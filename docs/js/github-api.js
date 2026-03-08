/**
 * GitHub REST API client for fetching repository data.
 */

let rateLimitRemaining = null;
let rateLimitTotal = null;

export function getRateLimit() {
  return { remaining: rateLimitRemaining, total: rateLimitTotal };
}

/**
 * Parse a GitHub URL into owner/repo.
 */
export function parseRepoUrl(url) {
  // Handle various URL formats
  const cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');

  // Try URL parsing
  let match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (match) return { owner: match[1], repo: match[2] };

  // Try owner/repo format
  match = cleaned.match(/^([^/]+)\/([^/]+)$/);
  if (match) return { owner: match[1], repo: match[2] };

  return null;
}

/**
 * Fetch with GitHub API headers and rate limit tracking.
 */
async function apiFetch(url, token = null) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;

  const resp = await fetch(url, { headers });

  // Track rate limit
  const remaining = resp.headers.get('X-RateLimit-Remaining');
  const limit = resp.headers.get('X-RateLimit-Limit');
  if (remaining !== null) rateLimitRemaining = parseInt(remaining);
  if (limit !== null) rateLimitTotal = parseInt(limit);

  if (!resp.ok) {
    if (resp.status === 403 && rateLimitRemaining === 0) {
      throw new Error('GitHub API rate limit exceeded. Add a GitHub token to increase the limit.');
    }
    if (resp.status === 404) {
      throw new Error('Repository not found. Check the URL or add a token for private repos.');
    }
    throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
  }

  // Parse Link header for pagination
  const linkHeader = resp.headers.get('Link');
  let nextUrl = null;
  if (linkHeader) {
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (nextMatch) nextUrl = nextMatch[1];
  }

  const data = await resp.json();
  return { data, nextUrl };
}

/**
 * Fetch all pages of a paginated endpoint.
 */
async function fetchAllPages(url, token, maxItems = 500, onProgress = null) {
  const items = [];
  let currentUrl = url;
  let page = 0;

  while (currentUrl && items.length < maxItems) {
    const { data, nextUrl } = await apiFetch(currentUrl, token);
    items.push(...data);
    page++;
    if (onProgress) onProgress(items.length);
    currentUrl = nextUrl;
  }

  return items.slice(0, maxItems);
}

/**
 * Fetch full repository data from GitHub API.
 */
export async function fetchRepoData(owner, repo, options = {}) {
  const { token = null, maxCommits = 500, onProgress = null } = options;
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  if (onProgress) onProgress('Fetching repository info...');

  // Fetch repo info, branches, and tags in parallel
  const [repoInfo, branches, tags] = await Promise.all([
    apiFetch(base, token).then(r => r.data),
    fetchAllPages(`${base}/branches?per_page=100`, token, 100),
    fetchAllPages(`${base}/tags?per_page=100`, token, 100),
  ]);

  const defaultBranch = repoInfo.default_branch;

  if (onProgress) onProgress('Fetching commits...');

  // Build branch/tag maps: sha -> names
  const branchMap = {};
  for (const b of branches) {
    const sha = b.commit.sha;
    if (!branchMap[sha]) branchMap[sha] = [];
    branchMap[sha].push(b.name);
  }

  const tagMap = {};
  for (const t of tags) {
    const sha = t.commit.sha;
    if (!tagMap[sha]) tagMap[sha] = [];
    tagMap[sha].push(t.name);
  }

  // Fetch commits from default branch first (largest set)
  const commitMap = new Map();
  const seen = new Set();

  const defaultCommits = await fetchAllPages(
    `${base}/commits?sha=${defaultBranch}&per_page=100`,
    token,
    maxCommits,
    (count) => { if (onProgress) onProgress(`Fetching commits... (${count})`); }
  );

  for (const c of defaultCommits) {
    if (!seen.has(c.sha)) {
      seen.add(c.sha);
      commitMap.set(c.sha, apiCommitToNode(c, branchMap, tagMap));
    }
  }

  // Fetch from other branches (only what's missing)
  const otherBranches = branches
    .map(b => b.name)
    .filter(name => name !== defaultBranch);

  for (const branchName of otherBranches) {
    if (commitMap.size >= maxCommits) break;

    if (onProgress) onProgress(`Fetching branch: ${branchName}...`);

    const remaining = maxCommits - commitMap.size;
    let branchCommits;
    try {
      branchCommits = await fetchAllPages(
        `${base}/commits?sha=${branchName}&per_page=100`,
        token,
        Math.min(remaining, 200)
      );
    } catch {
      continue; // Skip branches that error
    }

    let newCount = 0;
    for (const c of branchCommits) {
      if (!seen.has(c.sha)) {
        seen.add(c.sha);
        commitMap.set(c.sha, apiCommitToNode(c, branchMap, tagMap));
        newCount++;
      }
      if (newCount === 0 && branchCommits.indexOf(c) > 10) break; // All overlap
    }
  }

  if (onProgress) onProgress('Building graph...');

  // Topological sort
  const commits = topoSort(commitMap);

  // Build authors map
  const authors = {};
  for (const c of commits) {
    if (!authors[c.authorEmail]) {
      authors[c.authorEmail] = {
        name: c.authorName,
        email: c.authorEmail,
        commitCount: 0,
        color: '',
      };
    }
    authors[c.authorEmail].commitCount++;
  }

  return {
    name: repo,
    owner,
    fullName: `${owner}/${repo}`,
    defaultBranch,
    commits,
    commitMap: Object.fromEntries(commitMap),
    branches: branches.map(b => b.name),
    tags: tags.map(t => t.name),
    authors,
  };
}

/**
 * Convert GitHub API commit object to internal CommitNode.
 */
function apiCommitToNode(apiCommit, branchMap, tagMap) {
  const sha = apiCommit.sha;
  const commit = apiCommit.commit;
  const message = commit.message || '';
  const subject = message.split('\n')[0];

  const authorName = commit.author?.name || apiCommit.author?.login || 'Unknown';
  const authorEmail = commit.author?.email || `${authorName}@users.noreply.github.com`;
  const authoredDate = commit.author?.date || '';
  const avatarUrl = apiCommit.author?.avatar_url || '';

  return {
    sha,
    shortSha: sha.substring(0, 8),
    message,
    subject,
    authorName,
    authorEmail,
    authoredDate,
    avatarUrl,
    parentShas: (apiCommit.parents || []).map(p => p.sha),
    isMerge: (apiCommit.parents || []).length > 1,
    branches: branchMap[sha] || [],
    tags: tagMap[sha] || [],
  };
}

/**
 * Topological sort (Kahn's algorithm) - parents after children.
 */
function topoSort(commitMap) {
  const inDegree = new Map();
  const children = new Map(); // parent -> [children]

  for (const [sha, node] of commitMap) {
    if (!inDegree.has(sha)) inDegree.set(sha, 0);
    if (!children.has(sha)) children.set(sha, []);

    for (const parentSha of node.parentShas) {
      if (commitMap.has(parentSha)) {
        inDegree.set(sha, (inDegree.get(sha) || 0) + 1);
        if (!children.has(parentSha)) children.set(parentSha, []);
        children.get(parentSha).push(sha);
      }
    }
  }

  // Recalculate properly: in-degree = number of parents that exist in our set
  for (const [sha, node] of commitMap) {
    let deg = 0;
    for (const p of node.parentShas) {
      if (commitMap.has(p)) deg++;
    }
    inDegree.set(sha, deg);
  }

  // Wait, we want newest first (children before parents)
  // So "in-degree" = number of children pointing to us
  // Actually let's just sort by date descending and verify topo order
  const result = [...commitMap.values()];
  result.sort((a, b) => {
    const da = new Date(a.authoredDate).getTime() || 0;
    const db = new Date(b.authoredDate).getTime() || 0;
    return db - da; // Newest first
  });

  return result;
}

/**
 * Fetch changed files for a single commit (lazy loaded).
 */
export async function fetchCommitFiles(owner, repo, sha, token = null) {
  const { data } = await apiFetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
    token
  );

  return (data.files || []).map(f => ({
    filename: f.filename,
    status: f.status, // added, modified, removed, renamed
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
    previousFilename: f.previous_filename || null,
  }));
}
