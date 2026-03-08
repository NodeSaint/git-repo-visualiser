/**
 * Commit detail panel rendering.
 */

import { fetchCommitFiles } from './github-api.js';

export class DetailPanel {
  constructor(element) {
    this.element = element;
    this.owner = '';
    this.repo = '';
    this.token = null;
    this.authorColors = {};
    this._currentSha = null;
    this._filesCache = {};
  }

  setRepo(owner, repo, token, authorColors) {
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.authorColors = authorColors;
    this._filesCache = {};
  }

  showCommit(commit) {
    if (!commit) {
      this.clear();
      return;
    }

    this._currentSha = commit.sha;
    const color = this.authorColors[commit.authorEmail] || '#58a6ff';

    const date = commit.authoredDate
      ? new Date(commit.authoredDate).toLocaleString()
      : 'Unknown';

    const parentsHtml = (commit.parentShas || [])
      .map(sha => `<a href="#" class="parent-link" data-sha="${sha}">${sha.substring(0, 8)}</a>`)
      .join(', ') || 'None (root commit)';

    const branchesHtml = (commit.branches || [])
      .map(b => `<span class="detail-branch">${b}</span>`)
      .join('');

    const tagsHtml = (commit.tags || [])
      .map(t => `<span class="detail-tag">${t}</span>`)
      .join('');

    const decorations = (branchesHtml || tagsHtml)
      ? `<div class="detail-decorations">${branchesHtml}${tagsHtml}</div>`
      : '';

    this.element.innerHTML = `
      <div class="detail-header">
        <div class="detail-sha">${commit.sha}</div>
        <div class="detail-author" style="color: ${color}">${commit.authorName}</div>
        <div class="detail-email">${commit.authorEmail}</div>
        <div class="detail-date">${date}</div>
        ${decorations}
        <div class="detail-parents">Parents: ${parentsHtml}</div>
      </div>
      <div class="detail-message">${escapeHtml(commit.message)}</div>
      <div class="detail-files">
        <h3>Changed Files</h3>
        <div id="files-content" class="files-loading">Loading...</div>
      </div>
    `;

    // Load files
    this._loadFiles(commit.sha);
  }

  async _loadFiles(sha) {
    const filesEl = document.getElementById('files-content');
    if (!filesEl) return;

    // Check cache
    if (this._filesCache[sha]) {
      this._renderFiles(filesEl, this._filesCache[sha]);
      return;
    }

    try {
      const files = await fetchCommitFiles(this.owner, this.repo, sha, this.token);
      this._filesCache[sha] = files;

      // Only render if still showing this commit
      if (this._currentSha === sha) {
        this._renderFiles(filesEl, files);
      }
    } catch (e) {
      if (this._currentSha === sha) {
        filesEl.innerHTML = `<span style="color: var(--red)">Unable to load files</span>`;
      }
    }
  }

  _renderFiles(element, files) {
    if (!files.length) {
      element.innerHTML = '<span style="color: var(--text-secondary)">No files changed</span>';
      return;
    }

    const statusMap = {
      added: { label: 'A', class: 'added' },
      modified: { label: 'M', class: 'modified' },
      removed: { label: 'D', class: 'deleted' },
      renamed: { label: 'R', class: 'renamed' },
    };

    const items = files.slice(0, 50).map(f => {
      const s = statusMap[f.status] || { label: '?', class: '' };
      return `<li>
        <span class="file-status ${s.class}">${s.label}</span>
        <span class="file-path">${escapeHtml(f.filename)}</span>
      </li>`;
    }).join('');

    const more = files.length > 50
      ? `<li style="color: var(--text-secondary)">... and ${files.length - 50} more</li>`
      : '';

    element.innerHTML = `
      <div style="color: var(--text-secondary); margin-bottom: 8px; font-size: 12px">
        ${files.length} file${files.length !== 1 ? 's' : ''} changed
      </div>
      <ul class="file-list">${items}${more}</ul>
    `;
  }

  clear() {
    this._currentSha = null;
    this.element.innerHTML = '<div class="panel-placeholder">Select a commit to view details</div>';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
