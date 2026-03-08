"""Main Textual application for git repo visualisation."""

from __future__ import annotations

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widgets import Footer, Header, Static, Label
from rich.panel import Panel
from rich.text import Text

from .git.repo import scan_repo
from .git.filters import FilterState, apply_filters
from .git.models import RepoData
from .layout.columns import assign_columns, GraphRow
from .layout.renderer import render_commit_line
from .tui.styles import assign_author_colors
from .tui.graph_widget import GraphWidget, CommitSelected, CommitHighlighted
from .tui.detail_panel import DetailPanel
from .tui.legend_panel import LegendPanel
from .tui.filter_bar import SearchBar, FilterBar, FilterChanged


class HelpScreen(ModalScreen):
    """Help overlay showing keybindings."""

    BINDINGS = [
        Binding("escape", "dismiss", "Close"),
        Binding("question_mark", "dismiss", "Close"),
    ]

    def compose(self) -> ComposeResult:
        help_text = Text()
        help_text.append("Git Repo Visualiser - Keyboard Shortcuts\n\n", style="bold cyan")
        keys = [
            ("↑ / k", "Move cursor up"),
            ("↓ / j", "Move cursor down"),
            ("Enter", "Select commit (show details)"),
            ("PgUp / PgDn", "Page up / down"),
            ("Home / End", "Jump to first / last commit"),
            ("/", "Search commits"),
            ("f", "Toggle filter bar"),
            ("l", "Toggle contributor legend"),
            ("c", "Clear all filters"),
            ("?", "Toggle this help screen"),
            ("q", "Quit"),
        ]
        for key, desc in keys:
            help_text.append(f"  {key:<16}", style="bold yellow")
            help_text.append(f"{desc}\n", style="white")

        help_text.append("\n\nPress Escape or ? to close", style="dim")

        yield Static(
            Panel(help_text, title="Help", border_style="cyan", padding=(1, 2)),
            id="help-panel",
        )


class GitVizApp(App):
    """Interactive git repository visualiser."""

    CSS_PATH = "gitviz.tcss"
    TITLE = "Git Repo Visualiser"

    BINDINGS = [
        Binding("q", "quit", "Quit", priority=True),
        Binding("question_mark", "help", "Help"),
        Binding("slash", "search", "Search"),
        Binding("f", "filter", "Filter"),
        Binding("l", "legend", "Legend"),
        Binding("c", "clear_filters", "Clear Filters"),
        Binding("escape", "dismiss_overlay", "Dismiss", show=False),
    ]

    def __init__(self, repo_path: str = ".", max_commits: int = 5000) -> None:
        super().__init__()
        self._repo_path = repo_path
        self._max_commits = max_commits
        self._repo_data: RepoData | None = None
        self._rows: list[GraphRow] = []
        self._author_colors: dict[str, str] = {}
        self._filter_state = FilterState()
        self._show_legend = False
        self._show_search = False
        self._show_filter = False

    def compose(self) -> ComposeResult:
        yield Header()
        with Horizontal(id="main-area"):
            yield GraphWidget([], {}, id="graph")
            with Vertical(id="side-panel"):
                yield DetailPanel(self._repo_path, id="detail")
                yield LegendPanel(id="legend")
        yield SearchBar(id="search-bar")
        yield FilterBar([], [], id="filter-bar")
        yield Static(id="status-bar")
        yield Footer()

    def on_mount(self) -> None:
        # Hide optional panels initially
        self.query_one("#legend").display = False
        self.query_one("#search-bar").display = False
        self.query_one("#filter-bar").display = False

        # Load repo data
        self._load_repo()

    def _load_repo(self) -> None:
        """Load and display repository data."""
        try:
            self._repo_data = scan_repo(self._repo_path, self._max_commits)
        except Exception as e:
            self.query_one("#status-bar", Static).update(
                f"[bold red]Error:[/bold red] {e}"
            )
            return

        self._author_colors = assign_author_colors(self._repo_data.authors)

        # Assign colors to Author objects
        for email, author in self._repo_data.authors.items():
            author.color = self._author_colors.get(email, "white")

        self.title = f"Git Viz: {self._repo_data.name}"
        self.sub_title = f"branch: {self._repo_data.current_branch} | {len(self._repo_data.commits)} commits | {len(self._repo_data.authors)} authors"

        # Build filter bar data
        filter_bar = self.query_one("#filter-bar", FilterBar)
        filter_bar._authors = [
            (email, a.name) for email, a in sorted(
                self._repo_data.authors.items(),
                key=lambda x: x[1].commit_count,
                reverse=True,
            )
        ]
        filter_bar._branches = self._repo_data.branches

        self._apply_filters_and_render()

    def _apply_filters_and_render(self) -> None:
        """Apply current filters and re-render the graph."""
        if not self._repo_data:
            return

        filtered = apply_filters(self._repo_data, self._filter_state)
        self._rows = assign_columns(filtered)

        graph = self.query_one("#graph", GraphWidget)
        graph.update_rows(self._rows, self._author_colors)

        # Update status
        total = len(self._repo_data.commits)
        shown = len(filtered)
        status_text = f" {shown}/{total} commits"
        if self._filter_state.search_text:
            status_text += f' | search: "{self._filter_state.search_text}"'
        if self._filter_state.author_email:
            author = self._repo_data.authors.get(self._filter_state.author_email)
            if author:
                status_text += f" | author: {author.name}"
        if self._filter_state.branch:
            status_text += f" | branch: {self._filter_state.branch}"

        self.query_one("#status-bar", Static).update(status_text)

        # Update detail panel
        detail = self.query_one("#detail", DetailPanel)
        detail.clear_details()

    def on_commit_selected(self, event: CommitSelected) -> None:
        """Handle commit selection - show details."""
        commit = event.row.commit
        color = self._author_colors.get(commit.author.email, "white")
        detail = self.query_one("#detail", DetailPanel)
        detail.show_commit(commit, color)

    def on_commit_highlighted(self, event: CommitHighlighted) -> None:
        """Handle cursor movement - preview commit."""
        commit = event.row.commit
        color = self._author_colors.get(commit.author.email, "white")
        detail = self.query_one("#detail", DetailPanel)
        detail.show_commit(commit, color)

    def on_filter_changed(self, event: FilterChanged) -> None:
        """Handle filter changes."""
        if event.search_text is not None or (
            event.search_text is None
            and event.author is None
            and event.branch is None
        ):
            if hasattr(event, "search_text"):
                self._filter_state.search_text = event.search_text
        if event.author is not None or (event.author is None and not event.search_text):
            self._filter_state.author_email = event.author
        if event.branch is not None or (event.branch is None and not event.search_text):
            self._filter_state.branch = event.branch
        self._apply_filters_and_render()

    def action_help(self) -> None:
        self.push_screen(HelpScreen())

    def action_search(self) -> None:
        search = self.query_one("#search-bar")
        self._show_search = not self._show_search
        search.display = self._show_search
        if self._show_search:
            self.query_one("#filter-bar").display = False
            self._show_filter = False

    def action_filter(self) -> None:
        filter_bar = self.query_one("#filter-bar")
        self._show_filter = not self._show_filter
        filter_bar.display = self._show_filter
        if self._show_filter:
            self.query_one("#search-bar").display = False
            self._show_search = False

    def action_legend(self) -> None:
        legend = self.query_one("#legend", LegendPanel)
        detail = self.query_one("#detail", DetailPanel)
        self._show_legend = not self._show_legend

        if self._show_legend and self._repo_data:
            legend.update_authors(
                self._repo_data.authors,
                self._author_colors,
                len(self._repo_data.commits),
            )
            legend.display = True
            detail.display = False
        else:
            legend.display = False
            detail.display = True

    def action_clear_filters(self) -> None:
        self._filter_state = FilterState()
        self.query_one("#search-bar", SearchBar).clear()
        self._show_search = False
        self._show_filter = False
        self.query_one("#search-bar").display = False
        self.query_one("#filter-bar").display = False
        self._apply_filters_and_render()

    def action_dismiss_overlay(self) -> None:
        if self._show_search:
            self._show_search = False
            self.query_one("#search-bar").display = False
        elif self._show_filter:
            self._show_filter = False
            self.query_one("#filter-bar").display = False
        # Refocus graph
        self.query_one("#graph", GraphWidget).focus()
