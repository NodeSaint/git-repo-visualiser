"""Custom scrollable widget for rendering the commit graph."""

from __future__ import annotations

from rich.console import Console
from rich.segment import Segment
from rich.text import Text
from textual.binding import Binding
from textual.geometry import Size
from textual.message import Message
from textual.scroll_view import ScrollView
from textual.strip import Strip

from ..layout.columns import GraphRow
from ..layout.renderer import render_commit_line

_CONSOLE = Console(width=300, no_color=False, force_terminal=True)


class CommitSelected(Message):
    """Posted when a commit is selected."""

    def __init__(self, row: GraphRow) -> None:
        super().__init__()
        self.row = row


class CommitHighlighted(Message):
    """Posted when cursor moves to a commit."""

    def __init__(self, row: GraphRow) -> None:
        super().__init__()
        self.row = row


class GraphWidget(ScrollView, can_focus=True):
    """Virtual-scrolling commit graph widget."""

    BINDINGS = [
        Binding("up", "cursor_up", "Up", show=False),
        Binding("down", "cursor_down", "Down", show=False),
        Binding("k", "cursor_up", "Up", show=False),
        Binding("j", "cursor_down", "Down", show=False),
        Binding("enter", "select", "Select", show=False),
        Binding("home", "scroll_home", "Top", show=False),
        Binding("end", "scroll_end", "Bottom", show=False),
        Binding("pageup", "page_up", "Page Up", show=False),
        Binding("pagedown", "page_down", "Page Down", show=False),
    ]

    def __init__(
        self,
        rows: list[GraphRow],
        author_colors: dict[str, str],
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._rows = rows
        self._author_colors = author_colors
        self._cursor = 0
        self._max_graph_width = self._compute_max_graph_width()

    def _compute_max_graph_width(self) -> int:
        if not self._rows:
            return 10
        max_cols = max(r.num_columns for r in self._rows)
        return min(max(max_cols * 2 + 2, 10), 40)

    def update_rows(self, rows: list[GraphRow], author_colors: dict[str, str]) -> None:
        """Update the graph data and refresh."""
        self._rows = rows
        self._author_colors = author_colors
        self._cursor = min(self._cursor, max(0, len(rows) - 1))
        self._max_graph_width = self._compute_max_graph_width()
        self.virtual_size = Size(self.size.width, len(self._rows))
        self.refresh()
        if self._rows:
            self.post_message(CommitHighlighted(self._rows[self._cursor]))

    def on_mount(self) -> None:
        self.virtual_size = Size(self.size.width, len(self._rows))
        if self._rows:
            self.post_message(CommitHighlighted(self._rows[self._cursor]))

    def render_line(self, y: int) -> Strip:
        scroll_y = self.scroll_offset.y
        row_idx = y + scroll_y

        if row_idx < 0 or row_idx >= len(self._rows):
            return Strip.blank(self.size.width)

        row = self._rows[row_idx]
        line = render_commit_line(
            row, self._author_colors, self._max_graph_width
        )

        # Highlight cursor row
        if row_idx == self._cursor:
            highlight = Text(style="on #1a1a2e")
            highlight.append_text(line)
            # Pad to full width
            plain_len = len(highlight.plain)
            if plain_len < self.size.width:
                highlight.append(" " * (self.size.width - plain_len), style="on #1a1a2e")
            line = highlight

        # Convert Rich Text to proper Segments for Strip
        segments = list(line.render(_CONSOLE))
        return Strip(segments)

    def action_cursor_up(self) -> None:
        if self._cursor > 0:
            self._cursor -= 1
            self._ensure_visible()
            self.refresh()
            if self._rows:
                self.post_message(CommitHighlighted(self._rows[self._cursor]))

    def action_cursor_down(self) -> None:
        if self._cursor < len(self._rows) - 1:
            self._cursor += 1
            self._ensure_visible()
            self.refresh()
            if self._rows:
                self.post_message(CommitHighlighted(self._rows[self._cursor]))

    def action_select(self) -> None:
        if self._rows and 0 <= self._cursor < len(self._rows):
            self.post_message(CommitSelected(self._rows[self._cursor]))

    def action_page_up(self) -> None:
        page = max(1, self.size.height - 2)
        self._cursor = max(0, self._cursor - page)
        self._ensure_visible()
        self.refresh()
        if self._rows:
            self.post_message(CommitHighlighted(self._rows[self._cursor]))

    def action_page_down(self) -> None:
        page = max(1, self.size.height - 2)
        self._cursor = min(len(self._rows) - 1, self._cursor + page)
        self._ensure_visible()
        self.refresh()
        if self._rows:
            self.post_message(CommitHighlighted(self._rows[self._cursor]))

    def action_scroll_home(self) -> None:
        self._cursor = 0
        self._ensure_visible()
        self.refresh()
        if self._rows:
            self.post_message(CommitHighlighted(self._rows[self._cursor]))

    def action_scroll_end(self) -> None:
        self._cursor = max(0, len(self._rows) - 1)
        self._ensure_visible()
        self.refresh()
        if self._rows:
            self.post_message(CommitHighlighted(self._rows[self._cursor]))

    def _ensure_visible(self) -> None:
        """Scroll to keep cursor visible."""
        if self._cursor < self.scroll_offset.y:
            self.scroll_to(y=self._cursor, animate=False)
        elif self._cursor >= self.scroll_offset.y + self.size.height:
            self.scroll_to(y=self._cursor - self.size.height + 1, animate=False)
