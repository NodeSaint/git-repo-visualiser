"""Contributor legend and statistics panel."""

from __future__ import annotations

from textual.widgets import Static
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from ..git.models import Author


class LegendPanel(Static):
    """Shows contributor legend with colors and stats."""

    def update_authors(
        self,
        authors: dict[str, Author],
        author_colors: dict[str, str],
        total_commits: int,
    ) -> None:
        """Refresh the legend with current author data."""
        sorted_authors = sorted(
            authors.values(), key=lambda a: a.commit_count, reverse=True
        )

        table = Table(
            title="Contributors",
            show_header=True,
            header_style="bold",
            expand=True,
            padding=(0, 1),
        )
        table.add_column("Color", width=3)
        table.add_column("Author", ratio=2)
        table.add_column("Commits", justify="right", width=8)
        table.add_column("%", justify="right", width=6)

        for author in sorted_authors[:25]:
            color = author_colors.get(author.email, "white")
            pct = (
                f"{author.commit_count / total_commits * 100:.1f}%"
                if total_commits
                else "0%"
            )
            table.add_row(
                Text("██", style=color),
                Text(author.name, style=color),
                str(author.commit_count),
                pct,
            )

        if len(sorted_authors) > 25:
            table.add_row(
                "", Text(f"... and {len(sorted_authors) - 25} more", style="dim"), "", ""
            )

        summary = Text()
        summary.append(f"\nTotal: {total_commits} commits by {len(sorted_authors)} authors\n", style="dim")

        panel = Panel(
            table,
            title=f"Contributors ({len(sorted_authors)})",
            border_style="magenta",
            subtitle="Press [L] to toggle",
        )
        self.update(panel)
