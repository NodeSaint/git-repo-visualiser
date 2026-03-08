"""Filter and search bar widget."""

from __future__ import annotations

from textual.containers import Horizontal
from textual.message import Message
from textual.widget import Widget
from textual.widgets import Input, Label, Select


class FilterChanged(Message):
    """Posted when filter criteria change."""

    def __init__(
        self,
        search_text: str | None = None,
        author: str | None = None,
        branch: str | None = None,
    ) -> None:
        super().__init__()
        self.search_text = search_text
        self.author = author
        self.branch = branch


class SearchBar(Widget):
    """Search input bar."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._input = Input(placeholder="Search commits... (Esc to close)")

    def compose(self):
        with Horizontal(id="search-container"):
            yield Label(" 🔍 ", id="search-icon")
            yield self._input

    def on_mount(self) -> None:
        self._input.focus()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        text = event.value.strip()
        self.post_message(FilterChanged(search_text=text if text else None))

    def clear(self) -> None:
        self._input.value = ""


class FilterBar(Widget):
    """Filter controls bar with author and branch selectors."""

    def __init__(
        self,
        authors: list[tuple[str, str]],  # (email, name)
        branches: list[str],
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._authors = authors
        self._branches = branches

    def compose(self):
        with Horizontal(id="filter-container"):
            yield Label(" Filter: ", id="filter-label")
            yield Select(
                [(f"{name} <{email}>", email) for email, name in self._authors],
                prompt="All Authors",
                id="author-select",
                allow_blank=True,
            )
            yield Select(
                [(b, b) for b in self._branches],
                prompt="All Branches",
                id="branch-select",
                allow_blank=True,
            )

    def on_select_changed(self, event: Select.Changed) -> None:
        author = None
        branch = None

        author_select = self.query_one("#author-select", Select)
        branch_select = self.query_one("#branch-select", Select)

        if author_select.value != Select.BLANK:
            author = str(author_select.value)
        if branch_select.value != Select.BLANK:
            branch = str(branch_select.value)

        self.post_message(FilterChanged(author=author, branch=branch))
