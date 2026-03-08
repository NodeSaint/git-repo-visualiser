# 🌳 Git Repo Visualiser

**See the shape of any GitHub repo in seconds.** Paste a link, get an interactive branching tree with contributor colors — right in your browser or terminal.

### [**→ Try it now**](https://nodesaint.github.io/git-repo-visualiser/)

> `https://nodesaint.github.io/git-repo-visualiser/`

---

## Why this exists

You're reviewing a PR and want to understand the branching strategy. You're onboarding onto a new codebase and want to see who built what. You're evaluating an open source project and want to know if it's actively maintained, how many people contribute, and how the work flows.

`git log --graph --oneline --all` gets you halfway there. This gets you the rest of the way — with color, interactivity, and zero setup.

## Who it's for

- **Open source maintainers** — understand contribution patterns, see who's active, spot long-lived branches that need attention
- **Code reviewers** — visualise the branch topology before diving into diffs
- **New contributors** — get a feel for a project's structure and pace before your first PR
- **Engineering leads** — quick health check on repos: bus factor, merge cadence, branch hygiene
- **Students & educators** — see how real projects use git: merges, release branches, hotfixes
- **Anyone curious** — sometimes you just want to see what a repo looks like

## What you get

**Web app** — no install, works on desktop and mobile:
- SVG branching tree with smooth bezier merge curves
- Each contributor gets a unique, consistent color
- Branch and tag decorations inline
- Click any commit for full details: message, author, changed files
- Search commits, filter by author or branch
- Contributor legend with commit counts and percentages
- Keyboard navigation: `j`/`k` to move, `/` to search, `l` for legend
- Mobile: bottom sheets, touch gestures, action bar
- Works with public repos out of the box; paste a GitHub token for private repos

**Terminal TUI** — for when you're already in the terminal:
- Same branching tree, rendered with Unicode box-drawing characters
- Built with Python + Textual, runs on any terminal
- Interactive: scroll, select commits, view details, filter
- Scans local repos directly via GitPython — no API needed, works offline

## Quick start

### Web (zero install)

Visit **[nodesaint.github.io/git-repo-visualiser](https://nodesaint.github.io/git-repo-visualiser/)** and paste any GitHub URL.

Or link directly:
```
https://nodesaint.github.io/git-repo-visualiser/?repo=torvalds/linux
https://nodesaint.github.io/git-repo-visualiser/?repo=expressjs/express
https://nodesaint.github.io/git-repo-visualiser/?repo=your-org/your-repo
```

### Terminal

```bash
# Clone and install
git clone https://github.com/NodeSaint/git-repo-visualiser.git
cd git-repo-visualiser
pip install textual rich gitpython

# Visualise any local repo
PYTHONPATH=src python -m gitviz /path/to/your/repo

# Or use the launcher
./run.sh /path/to/your/repo
```

## Features at a glance

| Feature | Web | Terminal |
|---|:---:|:---:|
| Branching tree with merge curves | ✓ | ✓ |
| Per-author color coding | ✓ | ✓ |
| Branch & tag decorations | ✓ | ✓ |
| Commit detail panel | ✓ | ✓ |
| Changed files per commit | ✓ (lazy) | ✓ (lazy) |
| Search by message/SHA/author | ✓ | ✓ |
| Filter by author | ✓ | ✓ |
| Filter by branch | ✓ | ✓ |
| Contributor legend & stats | ✓ | ✓ |
| Keyboard navigation | ✓ | ✓ |
| Mobile support | ✓ | — |
| Works offline | — | ✓ |
| Private repos | ✓ (token) | ✓ (local) |
| Virtual scrolling (1000s of commits) | ✓ | ✓ |

## Keyboard shortcuts

| Key | Action |
|---|---|
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `Enter` | Select commit |
| `PgUp` / `PgDn` | Page up / down |
| `Home` / `End` | First / last |
| `/` | Search |
| `l` | Toggle legend |
| `c` | Clear filters |
| `?` | Help |

## Rate limits

The web app uses the GitHub REST API:
- **Without token**: 60 requests/hour (enough for small-medium repos)
- **With token**: 5,000 requests/hour (paste a [personal access token](https://github.com/settings/tokens) — no scopes needed for public repos)

The remaining quota is shown in the top-right corner.

## Project structure

```
docs/               ← GitHub Pages static site (vanilla JS, no build step)
  index.html
  style.css
  js/
    app.js           Main orchestrator
    github-api.js    GitHub REST API client with pagination
    layout.js        Lane assignment algorithm
    graph-renderer.js SVG renderer with virtual scrolling
    filters.js       Search & filter logic
    colors.js        Deterministic author colors
    detail-panel.js  Commit detail sidebar
    legend-panel.js  Contributor statistics

src/gitviz/         ← Terminal TUI (Python + Textual)
  app.py             Main Textual app
  git/               Repo scanning, models, filters
  layout/            Lane assignment, Unicode rendering
  tui/               Widgets: graph, detail, legend, filter bar
```

## Self-hosting

It's a static site. Fork it, clone it, open `docs/index.html` — done. No build tools, no bundler, no node_modules.

To deploy your own:
1. Fork this repo
2. Go to **Settings → Pages → Source → Deploy from branch**
3. Set branch `main`, folder `/docs`
4. Your instance is live

## Contributing

PRs welcome. Some ideas:

- GitLab / Bitbucket API support
- Diff viewer for selected commits
- Time-lapse animation of repo growth
- Export graph as PNG/SVG
- Local file-based mode (drag & drop a `.git` folder)

## License

MIT

---

**[→ Try it now](https://nodesaint.github.io/git-repo-visualiser/)** — paste any GitHub repo URL and see its shape.
