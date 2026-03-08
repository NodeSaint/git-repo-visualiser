/**
 * SVG-based graph renderer with virtual scrolling.
 * Mobile-aware: condensed layout on narrow screens, larger touch targets.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export class GraphRenderer {
  constructor(svgElement, container) {
    this.svg = svgElement;
    this.container = container;
    this.rows = [];
    this.authorColors = {};
    this.cursorIndex = 0;
    this.selectedIndex = -1;
    this.maxColumns = 0;
    this.graphWidth = 0;
    this.textStartX = 0;

    this.onSelect = null;   // callback(row)
    this.onHighlight = null; // callback(row)

    this._buffer = 30;
    this._renderedRange = { start: -1, end: -1 };
    this._rowGroup = null;

    // Mobile detection
    this._isMobile = false;
    this._updateMobileState();

    this.container.addEventListener('scroll', () => this._onScroll(), { passive: true });

    // Re-detect mobile on resize
    this._resizeObserver = new ResizeObserver(() => {
      this._updateMobileState();
      if (this.rows.length > 0) {
        this._renderedRange = { start: -1, end: -1 };
        this._setupSvgSize();
        this._render();
      }
    });
    this._resizeObserver.observe(this.container);
  }

  _updateMobileState() {
    this._isMobile = this.container.clientWidth < 600;
  }

  // Layout params that adapt to screen size
  get ROW_HEIGHT() { return this._isMobile ? 44 : 32; }
  get COL_WIDTH() { return this._isMobile ? 16 : 20; }
  get NODE_RADIUS() { return this._isMobile ? 5 : 5; }
  get GRAPH_PADDING() { return this._isMobile ? 12 : 16; }

  setData(rows, authorColors) {
    this.rows = rows;
    this.authorColors = authorColors;
    this.cursorIndex = 0;
    this.selectedIndex = -1;

    this.maxColumns = 0;
    for (const row of rows) {
      if (row.numColumns > this.maxColumns) this.maxColumns = row.numColumns;
    }

    this._setupSvgSize();

    // Clear and create row group
    this.svg.innerHTML = '';
    this._rowGroup = document.createElementNS(SVG_NS, 'g');
    this.svg.appendChild(this._rowGroup);

    this._renderedRange = { start: -1, end: -1 };
    this._render();

    if (rows.length > 0 && this.onHighlight) {
      this.onHighlight(rows[0]);
    }
  }

  _setupSvgSize() {
    const containerWidth = this.container.clientWidth;
    this.graphWidth = this.maxColumns * this.COL_WIDTH + this.GRAPH_PADDING * 2;

    if (this._isMobile) {
      // Mobile: graph + sha + short subject fit container width
      this.textStartX = this.graphWidth + 4;
      const totalWidth = Math.max(containerWidth, this.textStartX + 360);
      const totalHeight = this.rows.length * this.ROW_HEIGHT;
      this.svg.setAttribute('width', totalWidth);
      this.svg.setAttribute('height', totalHeight);
      this.svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    } else {
      this.textStartX = this.graphWidth + 12;
      const totalWidth = Math.max(this.textStartX + 800, containerWidth);
      const totalHeight = this.rows.length * this.ROW_HEIGHT;
      this.svg.setAttribute('width', totalWidth);
      this.svg.setAttribute('height', totalHeight);
      this.svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    }
  }

  _onScroll() {
    this._render();
  }

  _render() {
    const scrollTop = this.container.scrollTop;
    const viewHeight = this.container.clientHeight;
    const rowH = this.ROW_HEIGHT;

    const firstVisible = Math.floor(scrollTop / rowH);
    const lastVisible = Math.ceil((scrollTop + viewHeight) / rowH);

    const start = Math.max(0, firstVisible - this._buffer);
    const end = Math.min(this.rows.length, lastVisible + this._buffer);

    if (start === this._renderedRange.start && end === this._renderedRange.end) {
      this._updateCursor();
      return;
    }

    this._renderedRange = { start, end };
    this._rowGroup.innerHTML = '';

    for (let i = start; i < end; i++) {
      this._renderRow(i);
    }
  }

  _renderRow(index) {
    const row = this.rows[index];
    const rowH = this.ROW_HEIGHT;
    const colW = this.COL_WIDTH;
    const nodeR = this.NODE_RADIUS;
    const pad = this.GRAPH_PADDING;
    const y = index * rowH;

    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('commit-row');
    g.dataset.index = index;
    if (index === this.cursorIndex) g.classList.add('cursor');
    if (index === this.selectedIndex) g.classList.add('selected');

    // Background rect
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.classList.add('row-bg');
    bg.setAttribute('x', 0);
    bg.setAttribute('y', y);
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', rowH);
    bg.setAttribute('fill', 'transparent');
    g.appendChild(bg);

    // Lane verticals
    for (let lane = 0; lane < row.activeLanes.length; lane++) {
      if (row.activeLanes[lane] !== null && lane !== row.column) {
        const lx = pad + lane * colW;
        const line = document.createElementNS(SVG_NS, 'line');
        line.classList.add('lane-line');
        line.setAttribute('x1', lx);
        line.setAttribute('y1', y);
        line.setAttribute('x2', lx);
        line.setAttribute('y2', y + rowH);
        line.setAttribute('stroke', '#555');
        g.appendChild(line);
      }
    }

    // Vertical continuation for this lane
    const cx = pad + row.column * colW;

    if (index > 0) {
      const prevRow = this.rows[index - 1];
      if (prevRow.activeLanes[row.column] !== null || prevRow.column === row.column) {
        const upLine = document.createElementNS(SVG_NS, 'line');
        upLine.classList.add('lane-line');
        upLine.setAttribute('x1', cx);
        upLine.setAttribute('y1', y);
        upLine.setAttribute('x2', cx);
        upLine.setAttribute('y2', y + rowH / 2 - nodeR);
        upLine.setAttribute('stroke', this._getColor(row));
        upLine.style.opacity = '0.6';
        g.appendChild(upLine);
      }
    }

    if (row.commit.parentShas && row.commit.parentShas.length > 0) {
      const downLine = document.createElementNS(SVG_NS, 'line');
      downLine.classList.add('lane-line');
      downLine.setAttribute('x1', cx);
      downLine.setAttribute('y1', y + rowH / 2 + nodeR);
      downLine.setAttribute('x2', cx);
      downLine.setAttribute('y2', y + rowH);
      downLine.setAttribute('stroke', this._getColor(row));
      downLine.style.opacity = '0.6';
      g.appendChild(downLine);
    }

    // Merge/fork curves
    for (const [fromCol, toCol] of [...row.mergeLines, ...row.forkLines]) {
      const fromX = pad + fromCol * colW;
      const toX = pad + toCol * colW;
      const midY = y + rowH / 2;
      const path = document.createElementNS(SVG_NS, 'path');
      path.classList.add('merge-line');
      path.setAttribute('d',
        `M ${fromX} ${midY} C ${fromX} ${midY + rowH * 0.4}, ${toX} ${midY + rowH * 0.6}, ${toX} ${y + rowH}`
      );
      path.setAttribute('stroke', this._getColor(row));
      g.appendChild(path);
    }

    // Commit node
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.classList.add('commit-node');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', y + rowH / 2);
    circle.setAttribute('r', nodeR);
    circle.setAttribute('fill', this._getColor(row));
    circle.setAttribute('stroke', '#0d1117');
    g.appendChild(circle);

    // Text — different layouts for mobile vs desktop
    if (this._isMobile) {
      this._renderMobileText(g, row, y, rowH);
    } else {
      this._renderDesktopText(g, row, y, rowH);
    }

    // Click/tap handler
    g.addEventListener('click', () => {
      this.selectedIndex = index;
      this.cursorIndex = index;
      this._render();
      if (this.onSelect) this.onSelect(row);
    });

    this._rowGroup.appendChild(g);
  }

  _renderMobileText(g, row, y, rowH) {
    let textX = this.textStartX;
    const commit = row.commit;
    const color = this._getColor(row);
    const midY = y + rowH / 2;

    // Branch/tag badges first (compact)
    for (const branch of (commit.branches || [])) {
      const badge = this._createBadge(branch, textX, midY, 'branch');
      g.appendChild(badge);
      textX += branch.length * 6 + 14;
    }
    for (const tag of (commit.tags || []).slice(0, 2)) {
      const badge = this._createBadge(tag, textX, midY, 'tag');
      g.appendChild(badge);
      textX += tag.length * 6 + 14;
    }

    // Two-line layout: subject on top, sha + author + date below
    const topY = y + rowH / 2 - 3;
    const bottomY = y + rowH / 2 + 10;

    // Subject (truncated for mobile)
    const maxSubjectLen = 40;
    const subject = commit.subject.length > maxSubjectLen
      ? commit.subject.substring(0, maxSubjectLen - 2) + '...'
      : commit.subject;

    const subjText = document.createElementNS(SVG_NS, 'text');
    subjText.classList.add('subject-text');
    subjText.setAttribute('x', textX);
    subjText.setAttribute('y', topY);
    subjText.setAttribute('font-size', '12px');
    subjText.textContent = subject;
    g.appendChild(subjText);

    // Bottom row: sha + author + date
    const metaText = document.createElementNS(SVG_NS, 'text');
    metaText.setAttribute('x', textX);
    metaText.setAttribute('y', bottomY);
    metaText.setAttribute('font-size', '10px');
    metaText.setAttribute('fill', '#8b949e');

    const sha = document.createElementNS(SVG_NS, 'tspan');
    sha.textContent = commit.shortSha;
    sha.style.fill = color;
    sha.setAttribute('font-family', "'SF Mono', 'Fira Code', monospace");
    metaText.appendChild(sha);

    const sep1 = document.createElementNS(SVG_NS, 'tspan');
    sep1.textContent = '  ' + commit.authorName;
    sep1.style.fill = color;
    sep1.style.opacity = '0.7';
    metaText.appendChild(sep1);

    if (commit.authoredDate) {
      const dateStr = new Date(commit.authoredDate).toLocaleDateString();
      const datePart = document.createElementNS(SVG_NS, 'tspan');
      datePart.textContent = '  ' + dateStr;
      metaText.appendChild(datePart);
    }

    g.appendChild(metaText);
  }

  _renderDesktopText(g, row, y, rowH) {
    let textX = this.textStartX;
    const commit = row.commit;
    const color = this._getColor(row);

    // SHA
    const shaText = document.createElementNS(SVG_NS, 'text');
    shaText.classList.add('sha-text');
    shaText.setAttribute('x', textX);
    shaText.setAttribute('y', y + rowH / 2 + 4);
    shaText.textContent = commit.shortSha;
    shaText.style.fill = color;
    g.appendChild(shaText);
    textX += 72;

    // Branches
    for (const branch of (commit.branches || [])) {
      g.appendChild(this._createBadge(branch, textX, y + rowH / 2, 'branch'));
      textX += branch.length * 7 + 16;
    }

    // Tags
    for (const tag of (commit.tags || [])) {
      g.appendChild(this._createBadge(tag, textX, y + rowH / 2, 'tag'));
      textX += tag.length * 7 + 16;
    }

    // Subject
    const subject = commit.subject.length > 60
      ? commit.subject.substring(0, 57) + '...'
      : commit.subject;
    const subjText = document.createElementNS(SVG_NS, 'text');
    subjText.classList.add('subject-text');
    subjText.setAttribute('x', textX);
    subjText.setAttribute('y', y + rowH / 2 + 4);
    subjText.textContent = subject;
    g.appendChild(subjText);
    textX += Math.min(subject.length * 7.5, 460) + 16;

    // Author
    const authorText = document.createElementNS(SVG_NS, 'text');
    authorText.classList.add('author-text');
    authorText.setAttribute('x', textX);
    authorText.setAttribute('y', y + rowH / 2 + 4);
    authorText.textContent = commit.authorName;
    authorText.style.fill = color;
    g.appendChild(authorText);
    textX += Math.min(commit.authorName.length * 7, 140) + 12;

    // Date
    const dateStr = commit.authoredDate
      ? new Date(commit.authoredDate).toLocaleDateString()
      : '';
    const dateText = document.createElementNS(SVG_NS, 'text');
    dateText.classList.add('date-text');
    dateText.setAttribute('x', textX);
    dateText.setAttribute('y', y + rowH / 2 + 4);
    dateText.textContent = dateStr;
    g.appendChild(dateText);
  }

  _createBadge(text, x, cy, type) {
    const g = document.createElementNS(SVG_NS, 'g');
    const padX = 5;
    const charW = this._isMobile ? 5.5 : 6.5;
    const width = text.length * charW + padX * 2;
    const height = this._isMobile ? 14 : 16;
    const fontSize = this._isMobile ? '9px' : '10px';

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.classList.add(type === 'branch' ? 'branch-badge-bg' : 'tag-badge-bg');
    rect.setAttribute('x', x);
    rect.setAttribute('y', cy - height / 2);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('rx', 3);
    g.appendChild(rect);

    const label = document.createElementNS(SVG_NS, 'text');
    label.classList.add(type === 'branch' ? 'branch-badge' : 'tag-badge');
    label.setAttribute('x', x + padX);
    label.setAttribute('y', cy + 3);
    label.setAttribute('font-size', fontSize);
    label.textContent = text;
    label.style.fill = type === 'branch' ? '#3fb950' : '#d29922';
    g.appendChild(label);

    return g;
  }

  _getColor(row) {
    return this.authorColors[row.commit.authorEmail] || '#58a6ff';
  }

  _updateCursor() {
    const rows = this._rowGroup.querySelectorAll('.commit-row');
    for (const row of rows) {
      const idx = parseInt(row.dataset.index);
      row.classList.toggle('cursor', idx === this.cursorIndex);
      row.classList.toggle('selected', idx === this.selectedIndex);
    }
  }

  moveCursor(delta) {
    const newIndex = Math.max(0, Math.min(this.rows.length - 1, this.cursorIndex + delta));
    if (newIndex !== this.cursorIndex) {
      this.cursorIndex = newIndex;
      this._ensureVisible();
      this._render();
      if (this.onHighlight) this.onHighlight(this.rows[this.cursorIndex]);
    }
  }

  setCursor(index) {
    this.cursorIndex = Math.max(0, Math.min(this.rows.length - 1, index));
    this._ensureVisible();
    this._render();
    if (this.onHighlight) this.onHighlight(this.rows[this.cursorIndex]);
  }

  selectCurrent() {
    if (this.rows.length > 0) {
      this.selectedIndex = this.cursorIndex;
      this._render();
      if (this.onSelect) this.onSelect(this.rows[this.cursorIndex]);
    }
  }

  pageUp() {
    const pageSize = Math.floor(this.container.clientHeight / this.ROW_HEIGHT) - 1;
    this.moveCursor(-pageSize);
  }

  pageDown() {
    const pageSize = Math.floor(this.container.clientHeight / this.ROW_HEIGHT) - 1;
    this.moveCursor(pageSize);
  }

  goToStart() { this.setCursor(0); }
  goToEnd() { this.setCursor(this.rows.length - 1); }

  _ensureVisible() {
    const rowH = this.ROW_HEIGHT;
    const y = this.cursorIndex * rowH;
    const scrollTop = this.container.scrollTop;
    const viewHeight = this.container.clientHeight;

    if (y < scrollTop) {
      this.container.scrollTop = y;
    } else if (y + rowH > scrollTop + viewHeight) {
      this.container.scrollTop = y + rowH - viewHeight;
    }
  }

  get isMobile() { return this._isMobile; }
}
