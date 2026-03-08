"""Lane assignment algorithm for commit graph layout."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..git.models import CommitNode


@dataclass
class GraphRow:
    commit: CommitNode
    column: int
    active_lanes: list[str | None] = field(default_factory=list)
    merge_lines: list[tuple[int, int]] = field(default_factory=list)
    fork_lines: list[tuple[int, int]] = field(default_factory=list)
    num_columns: int = 0


def assign_columns(commits: list[CommitNode]) -> list[GraphRow]:
    """Assign lane columns to each commit for graph rendering.

    Processes commits top-to-bottom (newest first). Each active branch
    occupies a 'lane' (column). Merges and forks create diagonal lines.
    """
    if not commits:
        return []

    # Active lanes: list of SHAs we're expecting to see next in each lane
    lanes: list[str | None] = []
    rows: list[GraphRow] = []

    # Map from SHA -> which lane it's expected in
    sha_to_lane: dict[str, int] = {}

    for commit in commits:
        sha = commit.sha
        merge_lines: list[tuple[int, int]] = []
        fork_lines: list[tuple[int, int]] = []

        # Find which lane this commit occupies
        if sha in sha_to_lane:
            col = sha_to_lane[sha]
            del sha_to_lane[sha]
        else:
            # New lane needed - find first empty or append
            col = _find_empty_lane(lanes)
            if col == len(lanes):
                lanes.append(None)

        # Place this commit in its lane
        lanes[col] = sha

        parents = commit.parent_shas

        if len(parents) == 0:
            # Root commit - lane ends
            lanes[col] = None
        elif len(parents) == 1:
            # Linear: first parent continues in same lane
            parent_sha = parents[0]
            if parent_sha in sha_to_lane:
                # Parent already expected elsewhere - create a merge line
                existing_lane = sha_to_lane[parent_sha]
                merge_lines.append((col, existing_lane))
                lanes[col] = None
            else:
                lanes[col] = parent_sha
                sha_to_lane[parent_sha] = col
        else:
            # Merge commit: first parent stays in same lane
            first_parent = parents[0]
            if first_parent in sha_to_lane:
                existing_lane = sha_to_lane[first_parent]
                merge_lines.append((col, existing_lane))
                lanes[col] = None
            else:
                lanes[col] = first_parent
                sha_to_lane[first_parent] = col

            # Additional parents get their own lanes or merge to existing
            for parent_sha in parents[1:]:
                if parent_sha in sha_to_lane:
                    # Already expected in another lane
                    existing_lane = sha_to_lane[parent_sha]
                    merge_lines.append((col, existing_lane))
                else:
                    # Assign new lane for this parent
                    parent_lane = _find_empty_lane(lanes)
                    if parent_lane == len(lanes):
                        lanes.append(None)
                    lanes[parent_lane] = parent_sha
                    sha_to_lane[parent_sha] = parent_lane
                    if parent_lane != col:
                        fork_lines.append((col, parent_lane))

        # Compact: trim trailing None lanes
        while lanes and lanes[-1] is None and not any(
            sha_to_lane.get(s) == len(lanes) - 1
            for s in sha_to_lane
        ):
            lanes.pop()

        row = GraphRow(
            commit=commit,
            column=col,
            active_lanes=list(lanes),
            merge_lines=merge_lines,
            fork_lines=fork_lines,
            num_columns=max(len(lanes), col + 1),
        )
        rows.append(row)

    return rows


def _find_empty_lane(lanes: list[str | None]) -> int:
    """Find the first empty lane, or return len(lanes) to append."""
    for i, lane in enumerate(lanes):
        if lane is None:
            return i
    return len(lanes)
