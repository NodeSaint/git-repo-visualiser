/**
 * Contributor legend panel.
 */

export class LegendPanel {
  constructor(element) {
    this.element = element;
  }

  update(authors, authorColors, totalCommits) {
    const sorted = Object.values(authors)
      .sort((a, b) => b.commitCount - a.commitCount);

    const rows = sorted.slice(0, 30).map(a => {
      const color = authorColors[a.email] || '#58a6ff';
      const pct = totalCommits > 0
        ? (a.commitCount / totalCommits * 100).toFixed(1) + '%'
        : '0%';

      return `<tr>
        <td><span class="legend-swatch" style="background: ${color}"></span></td>
        <td class="legend-name" style="color: ${color}">${escapeHtml(a.name)}</td>
        <td class="legend-count">${a.commitCount}</td>
        <td class="legend-pct">${pct}</td>
      </tr>`;
    }).join('');

    const more = sorted.length > 30
      ? `<tr><td colspan="4" style="color: var(--text-secondary)">... and ${sorted.length - 30} more</td></tr>`
      : '';

    this.element.innerHTML = `
      <h3 style="margin-bottom: 12px; color: var(--accent)">Contributors (${sorted.length})</h3>
      <table class="legend-table">
        <thead>
          <tr>
            <th></th>
            <th>Author</th>
            <th style="text-align: right">Commits</th>
            <th style="text-align: right">%</th>
          </tr>
        </thead>
        <tbody>${rows}${more}</tbody>
      </table>
      <div class="legend-summary">
        ${totalCommits} commits by ${sorted.length} authors
      </div>
    `;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
