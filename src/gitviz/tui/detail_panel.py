"""Commit detail panel widget."""

from __future__ import annotations

from textual.widgets import Static
from rich.text import Text
from rich.panel import Panel
from rich.table import Table

from ..git.models import CommitNode
from ..git import repo as git_repo


class DetailPanel(Static):
    """Shows detailed info about the selected commit."""

    def __init__(self, repo_path: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._repo_path = repo_path
        self._current_sha: str | None = None

    def show_commit(self, commit: CommitNode, author_color: str) -> None:
        """Display commit details."""
        self._current_sha = commit.sha

        table = Table.grid(padding=(0, 1))
        table.add_column(style="bold dim", width=10)
        table.add_column()

        table.add_row("SHA", Text(commit.sha, style="bold"))
        table.add_row("Author", Text(commit.author.name, style=f"bold {author_color}"))
        table.add_row("Email", Text(commit.author.email, style="dim"))
        table.add_row(
            "Date",
            Text(commit.authored_date.strftime("%Y-%m-%d %H:%M:%S UTC")),
        )
        table.add_row("Parents", Text(", ".join(commit.parent_shas[:3]) or "None", style="dim"))

        if commit.branches:
            table.add_row("Branches", Text(" ".join(f"[{b}]" for b in commit.branches), style="bold green"))
        if commit.tags:
            table.add_row("Tags", Text(" ".join(f"({t})" for t in commit.tags), style="bold yellow"))

        table.add_row("", Text(""))
        table.add_row("Message", Text(commit.message, style="white"))

        # Load changed files
        try:
            files = git_repo.get_changed_files(self._repo_path, commit.sha)
            table.add_row("", Text(""))
            table.add_row(
                "Files",
                Text(f"({len(files)} changed)", style="dim"),
            )
            for f in files[:30]:
                parts = f.split(" ", 1)
                if len(parts) == 2:
                    change_type, path = parts
                    style = {
                        "A": "green",
                        "M": "yellow",
                        "D": "red",
                        "R": "cyan",
                    }.get(change_type, "white")
                    table.add_row("", Text(f"  {change_type} {path}", style=style))
                else:
                    table.add_row("", Text(f"  {f}"))
            if len(files) > 30:
                table.add_row("", Text(f"  ... and {len(files) - 30} more", style="dim"))
        except Exception:
            table.add_row("Files", Text("(unable to load)", style="dim red"))

        panel = Panel(table, title="Commit Details", border_style="blue")
        self.update(panel)

    def clear_details(self) -> None:
        """Clear the panel."""
        self._current_sha = None
        self.update(Panel("Select a commit to view details", title="Commit Details", border_style="dim"))
