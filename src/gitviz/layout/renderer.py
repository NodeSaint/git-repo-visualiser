"""Render graph rows into styled text using Unicode box-drawing characters."""

from __future__ import annotations

from rich.text import Text

from .columns import GraphRow


# Graph characters
NODE = "●"
VERTICAL = "│"
HORIZONTAL = "─"
MERGE_DOWN_RIGHT = "╭"
MERGE_DOWN_LEFT = "╮"
MERGE_UP_RIGHT = "╰"
MERGE_UP_LEFT = "╯"
CROSS = "┼"
EMPTY = " "


def render_graph_cell(row: GraphRow, author_colors: dict[str, str]) -> Text:
    """Render the graph portion of a single row as Rich Text."""
    num_cols = max(row.num_columns, len(row.active_lanes), row.column + 1)
    # Each column uses 2 chars: symbol + space
    width = num_cols * 2

    cells = [" "] * width
    styles = [""] * width

    commit_color = author_colors.get(row.commit.author.email, "white")

    # Draw active lane verticals
    for i, lane_sha in enumerate(row.active_lanes):
        pos = i * 2
        if pos < width and lane_sha is not None and i != row.column:
            cells[pos] = VERTICAL
            styles[pos] = "dim"

    # Draw the commit node
    node_pos = row.column * 2
    if node_pos < width:
        cells[node_pos] = NODE
        styles[node_pos] = f"bold {commit_color}"

    # Draw merge/fork lines
    for from_col, to_col in row.merge_lines + row.fork_lines:
        _draw_connection(cells, styles, from_col, to_col, width, commit_color)

    result = Text()
    for i, (char, style) in enumerate(zip(cells, styles)):
        result.append(char, style=style or "dim")

    return result


def _draw_connection(
    cells: list[str],
    styles: list[str],
    from_col: int,
    to_col: int,
    width: int,
    color: str,
) -> None:
    """Draw a horizontal/diagonal connection between two columns."""
    left = min(from_col, to_col)
    right = max(from_col, to_col)

    if left == right:
        return

    # Draw horizontal line between the columns
    for col in range(left + 1, right):
        pos = col * 2
        if pos < width:
            cells[pos] = HORIZONTAL
            styles[pos] = f"dim {color}"
        # Fill the space after too
        if pos + 1 < width:
            cells[pos + 1] = HORIZONTAL
            styles[pos + 1] = f"dim {color}"

    # Draw connectors at the endpoints
    left_pos = left * 2 + 1
    right_pos = right * 2 - 1

    if left_pos < width and left_pos > 0 and cells[left_pos] == " ":
        if from_col < to_col:
            cells[left_pos] = HORIZONTAL
        else:
            cells[left_pos] = HORIZONTAL
        styles[left_pos] = f"dim {color}"

    if right_pos < width and right_pos > 0 and cells[right_pos] == " ":
        cells[right_pos] = HORIZONTAL
        styles[right_pos] = f"dim {color}"


def render_commit_line(
    row: GraphRow,
    author_colors: dict[str, str],
    max_graph_width: int = 30,
) -> Text:
    """Render a complete commit line: graph + sha + decorations + subject + author + date."""
    graph = render_graph_cell(row, author_colors)
    commit = row.commit
    color = author_colors.get(commit.author.email, "white")

    # Pad/truncate graph to fixed width
    graph_str = graph.plain
    if len(graph_str) < max_graph_width:
        graph.append(" " * (max_graph_width - len(graph_str)))
    elif len(graph_str) > max_graph_width:
        graph = graph[:max_graph_width]

    line = Text()
    line.append_text(graph)

    # Short SHA
    line.append(f" {commit.short_sha} ", style=f"bold {color}")

    # Branch decorations
    for branch in commit.branches:
        line.append(f" [{branch}]", style="bold green")

    # Tag decorations
    for tag in commit.tags:
        line.append(f" ({tag})", style="bold yellow")

    # Subject (truncate if needed)
    subject = commit.subject
    if len(subject) > 60:
        subject = subject[:57] + "..."
    line.append(f" {subject}", style="white")

    # Author
    line.append(f"  {commit.author.name}", style=f"dim {color}")

    # Date
    date_str = commit.authored_date.strftime("%Y-%m-%d")
    line.append(f"  {date_str}", style="dim")

    return line
