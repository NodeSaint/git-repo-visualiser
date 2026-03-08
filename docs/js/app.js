/**
 * Main application - wires everything together.
 * Mobile-first: bottom sheets, touch gestures, action bar.
 */

import { parseRepoUrl, fetchRepoData, getRateLimit } from './github-api.js';
import { assignAuthorColors } from './colors.js';
import { assignColumns } from './layout.js';
import { applyFilters } from './filters.js';
import { GraphRenderer } from './graph-renderer.js';
import { DetailPanel } from './detail-panel.js';
import { LegendPanel } from './legend-panel.js';

// ===== State =====
let repoData = null;
let authorColors = {};
let allRows = [];
let filterState = { authorEmail: null, branch: null, searchText: null };
let showLegend = false;

// ===== DOM refs =====
const $ = (id) => document.getElementById(id);
const form = $('repo-form');
const repoUrlInput = $('repo-url');
const maxCommitsSelect = $('max-commits');
const tokenToggle = $('token-toggle');
const tokenSection = $('token-section');
const tokenInput = $('github-token');
const loadingEl = $('loading');
const loadingText = $('loading-text');
const progressFill = $('progress-fill');
const errorEl = $('error-message');
const mainContent = $('main-content');
const repoInfo = $('repo-info');
const statusText = $('status-text');
const rateLimitEl = $('rate-limit');
const helpModal = $('help-modal');
const helpClose = $('help-close');
const graphContainer = $('graph-container');
const graphSvg = $('graph-svg');

// Desktop controls
const searchInput = $('search-input');
const authorFilter = $('author-filter');
const branchFilter = $('branch-filter');
const clearFiltersBtn = $('clear-filters');
const legendToggleBtn = $('legend-toggle');
const detailPanelEl = $('detail-panel');
const legendPanelEl = $('legend-panel');

// Mobile elements
const sheetBackdrop = $('sheet-backdrop');
const detailSheet = $('detail-sheet');
const detailSheetBody = $('detail-sheet-body');
const searchSheet = $('search-sheet');
const filterSheet = $('filter-sheet');
const legendSheet = $('legend-sheet');
const legendSheetBody = $('legend-sheet-body');
const mobileSearch = $('mobile-search');
const mobileAuthorFilter = $('mobile-author-filter');
const mobileBranchFilter = $('mobile-branch-filter');
const mobileClearFilters = $('mobile-clear-filters');
const mobileFilterBtn = $('mobile-filter-btn');

// ===== Components =====
const renderer = new GraphRenderer(graphSvg, graphContainer);
const desktopDetailPanel = new DetailPanel(detailPanelEl);
const mobileDetailPanel = new DetailPanel(detailSheetBody);
const desktopLegendPanel = new LegendPanel(legendPanelEl);
const mobileLegendPanel = new LegendPanel(legendSheetBody);

function isMobile() {
  return window.innerWidth <= 768;
}

// ===== Renderer callbacks =====
renderer.onSelect = (row) => {
  if (isMobile()) {
    mobileDetailPanel.showCommit(row.commit);
    openSheet('detail-sheet');
  } else {
    desktopDetailPanel.showCommit(row.commit);
  }
};

renderer.onHighlight = (row) => {
  // Desktop: update detail on cursor move. Mobile: only on tap (handled by onSelect).
  if (!isMobile()) {
    desktopDetailPanel.showCommit(row.commit);
  }
  updateStatus();
};

// ===== Bottom Sheet System =====
let activeSheet = null;
let sheetTouchStartY = 0;
let sheetTouchCurrentY = 0;
let sheetDragging = false;

function openSheet(id) {
  // Close any other open sheet first
  if (activeSheet && activeSheet !== id) {
    closeSheet(activeSheet, true);
  }

  const sheet = $(id);
  if (!sheet) return;

  activeSheet = id;
  sheet.classList.add('open');
  sheetBackdrop.classList.add('visible');

  // Update active state on action bar buttons
  document.querySelectorAll('.action-btn').forEach(btn => {
    const action = btn.dataset.action;
    btn.classList.toggle('active', action === sheetActionMap[id]);
  });
}

function closeSheet(id, skipBackdrop = false) {
  const sheet = id ? $(id) : null;
  if (sheet) sheet.classList.remove('open');
  if (!skipBackdrop) sheetBackdrop.classList.remove('visible');
  if (activeSheet === id) activeSheet = null;

  // Clear active state
  document.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
}

function closeAllSheets() {
  ['detail-sheet', 'search-sheet', 'filter-sheet', 'legend-sheet'].forEach(id => {
    $(id).classList.remove('open');
  });
  sheetBackdrop.classList.remove('visible');
  activeSheet = null;
  document.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
}

const sheetActionMap = {
  'detail-sheet': 'detail',
  'search-sheet': 'search',
  'filter-sheet': 'filter',
  'legend-sheet': 'legend',
};

// Sheet close buttons
document.querySelectorAll('.sheet-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const sheetId = btn.dataset.sheet;
    closeSheet(sheetId);
  });
});

// Backdrop click closes sheets
sheetBackdrop.addEventListener('click', closeAllSheets);

// Swipe-to-dismiss on sheet handles
document.querySelectorAll('.bottom-sheet').forEach(sheet => {
  const handle = sheet.querySelector('.sheet-handle');
  if (!handle) return;

  handle.addEventListener('touchstart', (e) => {
    sheetTouchStartY = e.touches[0].clientY;
    sheetDragging = true;
    sheet.style.transition = 'none';
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (!sheetDragging) return;
    sheetTouchCurrentY = e.touches[0].clientY;
    const dy = sheetTouchCurrentY - sheetTouchStartY;
    if (dy > 0) {
      sheet.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (!sheetDragging) return;
    sheetDragging = false;
    sheet.style.transition = '';
    sheet.style.transform = '';

    const dy = sheetTouchCurrentY - sheetTouchStartY;
    if (dy > 80) {
      closeSheet(sheet.id);
    }
  });
});

// ===== Mobile Action Bar =====
document.querySelectorAll('.action-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;

    // Toggle: if the same sheet is open, close it
    const sheetMap = {
      detail: 'detail-sheet',
      search: 'search-sheet',
      filter: 'filter-sheet',
      legend: 'legend-sheet',
    };

    if (action === 'help') {
      helpModal.classList.toggle('hidden');
      return;
    }

    const sheetId = sheetMap[action];
    if (activeSheet === sheetId) {
      closeSheet(sheetId);
    } else {
      // Populate legend sheet on open
      if (action === 'legend' && repoData) {
        mobileLegendPanel.update(repoData.authors, authorColors, repoData.commits.length);
      }
      openSheet(sheetId);
      // Focus search input when opening search sheet
      if (action === 'search') {
        setTimeout(() => mobileSearch.focus(), 300);
      }
    }
  });
});

// Mobile filter button in toolbar
if (mobileFilterBtn) {
  mobileFilterBtn.addEventListener('click', () => {
    openSheet('filter-sheet');
  });
}

// ===== Token toggle =====
tokenToggle.addEventListener('click', () => {
  tokenSection.classList.toggle('hidden');
  tokenToggle.textContent = tokenSection.classList.contains('hidden')
    ? '+ Token'
    : '- Token';
});

const savedToken = sessionStorage.getItem('github-token');
if (savedToken) {
  tokenInput.value = savedToken;
  tokenSection.classList.remove('hidden');
  tokenToggle.textContent = '- Token';
}

// ===== Form submit =====
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  // Blur input on mobile to dismiss keyboard
  if (isMobile()) repoUrlInput.blur();
  await loadRepo();
});

async function loadRepo() {
  const url = repoUrlInput.value.trim();
  if (!url) return;

  const parsed = parseRepoUrl(url);
  if (!parsed) {
    showError('Invalid GitHub URL. Use: https://github.com/owner/repo');
    return;
  }

  const token = tokenInput.value.trim() || null;
  if (token) sessionStorage.setItem('github-token', token);

  const maxCommits = parseInt(maxCommitsSelect.value);

  errorEl.classList.add('hidden');
  mainContent.classList.add('hidden');
  loadingEl.classList.remove('hidden');
  progressFill.style.width = '0%';
  $('visualize-btn').disabled = true;

  try {
    repoData = await fetchRepoData(parsed.owner, parsed.repo, {
      token,
      maxCommits,
      onProgress: (msg) => {
        loadingText.textContent = typeof msg === 'string' ? msg : `Loading... (${msg} commits)`;
        if (typeof msg === 'number') {
          progressFill.style.width = Math.min(90, (msg / maxCommits) * 100) + '%';
        }
      },
    });

    progressFill.style.width = '100%';

    // Colors
    authorColors = assignAuthorColors(repoData.authors);
    for (const email of Object.keys(repoData.authors)) {
      repoData.authors[email].color = authorColors[email];
    }

    // Setup panels (both desktop and mobile)
    desktopDetailPanel.setRepo(parsed.owner, parsed.repo, token, authorColors);
    mobileDetailPanel.setRepo(parsed.owner, parsed.repo, token, authorColors);

    populateFilters();

    filterState = { authorEmail: null, branch: null, searchText: null };
    applyAndRender();

    loadingEl.classList.add('hidden');
    mainContent.classList.remove('hidden');

    // Info text
    const infoText = isMobile()
      ? `${repoData.fullName} · ${repoData.commits.length} commits`
      : `${repoData.fullName} · ${repoData.commits.length} commits · ${Object.keys(repoData.authors).length} contributors · ${repoData.branches.length} branches`;
    repoInfo.textContent = infoText;

    graphContainer.focus();

  } catch (err) {
    showError(err.message);
    loadingEl.classList.add('hidden');
  } finally {
    $('visualize-btn').disabled = false;
    updateRateLimit();
  }
}

function populateFilters() {
  // Desktop dropdowns
  authorFilter.innerHTML = '<option value="">All Authors</option>';
  branchFilter.innerHTML = '<option value="">All Branches</option>';
  // Mobile dropdowns
  mobileAuthorFilter.innerHTML = '<option value="">All Authors</option>';
  mobileBranchFilter.innerHTML = '<option value="">All Branches</option>';

  const sorted = Object.values(repoData.authors)
    .sort((a, b) => b.commitCount - a.commitCount);

  for (const a of sorted) {
    const text = `${a.name} (${a.commitCount})`;
    for (const select of [authorFilter, mobileAuthorFilter]) {
      const opt = document.createElement('option');
      opt.value = a.email;
      opt.textContent = text;
      select.appendChild(opt);
    }
  }

  for (const b of repoData.branches) {
    for (const select of [branchFilter, mobileBranchFilter]) {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      select.appendChild(opt);
    }
  }
}

function applyAndRender() {
  if (!repoData) return;

  const filtered = applyFilters(repoData.commits, repoData.commitMap, filterState);
  allRows = assignColumns(filtered);
  renderer.setData(allRows, authorColors);

  if (showLegend && !isMobile()) {
    desktopLegendPanel.update(repoData.authors, authorColors, repoData.commits.length);
  }

  updateStatus();
}

function updateStatus() {
  if (!repoData) return;
  const total = repoData.commits.length;
  const shown = allRows.length;
  let text = `${shown}/${total} commits`;

  if (filterState.searchText) text += ` · "${filterState.searchText}"`;
  if (filterState.authorEmail) {
    const a = repoData.authors[filterState.authorEmail];
    if (a) text += ` · ${a.name}`;
  }
  if (filterState.branch) text += ` · ${filterState.branch}`;

  if (renderer.rows.length > 0) {
    text += ` · [${renderer.cursorIndex + 1}/${shown}]`;
  }

  statusText.textContent = text;
}

function updateRateLimit() {
  const rl = getRateLimit();
  if (rl.remaining !== null) {
    rateLimitEl.textContent = `API: ${rl.remaining}/${rl.total}`;
    rateLimitEl.style.color = rl.remaining < 10 ? '#f85149' : '#8b949e';
  }
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

// ===== Desktop filter handlers =====
searchInput.addEventListener('input', debounce(() => {
  filterState.searchText = searchInput.value.trim() || null;
  applyAndRender();
}, 300));

authorFilter.addEventListener('change', () => {
  filterState.authorEmail = authorFilter.value || null;
  applyAndRender();
});

branchFilter.addEventListener('change', () => {
  filterState.branch = branchFilter.value || null;
  applyAndRender();
});

clearFiltersBtn.addEventListener('click', clearAllFilters);

// Desktop legend toggle
legendToggleBtn.addEventListener('click', () => {
  showLegend = !showLegend;
  legendToggleBtn.classList.toggle('active', showLegend);
  if (showLegend && repoData) {
    desktopLegendPanel.update(repoData.authors, authorColors, repoData.commits.length);
    legendPanelEl.classList.remove('hidden');
    detailPanelEl.classList.add('hidden');
  } else {
    legendPanelEl.classList.add('hidden');
    detailPanelEl.classList.remove('hidden');
  }
});

// ===== Mobile filter handlers =====
mobileSearch.addEventListener('input', debounce(() => {
  filterState.searchText = mobileSearch.value.trim() || null;
  // Sync to desktop input
  searchInput.value = mobileSearch.value;
  applyAndRender();
}, 300));

mobileAuthorFilter.addEventListener('change', () => {
  filterState.authorEmail = mobileAuthorFilter.value || null;
  authorFilter.value = mobileAuthorFilter.value;
  applyAndRender();
});

mobileBranchFilter.addEventListener('change', () => {
  filterState.branch = mobileBranchFilter.value || null;
  branchFilter.value = mobileBranchFilter.value;
  applyAndRender();
});

mobileClearFilters.addEventListener('click', () => {
  clearAllFilters();
  closeSheet('filter-sheet');
});

function clearAllFilters() {
  filterState = { authorEmail: null, branch: null, searchText: null };
  searchInput.value = '';
  authorFilter.value = '';
  branchFilter.value = '';
  mobileSearch.value = '';
  mobileAuthorFilter.value = '';
  mobileBranchFilter.value = '';
  applyAndRender();
}

// ===== Help modal =====
helpClose.addEventListener('click', () => helpModal.classList.add('hidden'));
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) helpModal.classList.add('hidden');
});

// ===== Keyboard shortcuts (desktop) =====
document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  const isInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

  if (e.key === 'Escape') {
    if (!helpModal.classList.contains('hidden')) {
      helpModal.classList.add('hidden');
      return;
    }
    if (activeSheet) {
      closeAllSheets();
      return;
    }
    if (isInput) {
      e.target.blur();
      graphContainer.focus();
      return;
    }
  }

  if (isInput) return;

  switch (e.key) {
    case 'ArrowUp':
    case 'k':
      e.preventDefault();
      renderer.moveCursor(-1);
      break;
    case 'ArrowDown':
    case 'j':
      e.preventDefault();
      renderer.moveCursor(1);
      break;
    case 'Enter':
      e.preventDefault();
      renderer.selectCurrent();
      break;
    case 'PageUp':
      e.preventDefault();
      renderer.pageUp();
      break;
    case 'PageDown':
      e.preventDefault();
      renderer.pageDown();
      break;
    case 'Home':
      e.preventDefault();
      renderer.goToStart();
      break;
    case 'End':
      e.preventDefault();
      renderer.goToEnd();
      break;
    case '/':
      e.preventDefault();
      searchInput.focus();
      break;
    case 'l':
      legendToggleBtn.click();
      break;
    case 'c':
      clearAllFilters();
      break;
    case '?':
      helpModal.classList.toggle('hidden');
      break;
  }
});

// ===== URL params auto-load =====
const urlParams = new URLSearchParams(window.location.search);
const repoParam = urlParams.get('repo');
if (repoParam) {
  repoUrlInput.value = repoParam;
  loadRepo();
}

// ===== Utility =====
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
