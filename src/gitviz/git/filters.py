"""Filtering logic for commits."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .models import CommitNode, RepoData


@dataclass
class FilterState:
    author_email: str | None = None
    branch: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    search_text: str | None = None


def apply_filters(
    repo_data: RepoData, state: FilterState
) -> list[CommitNode]:
    """Filter commits based on the given filter state."""
    commits = repo_data.commits

    if state.author_email:
        commits = [c for c in commits if c.author.email == state.author_email]

    if state.date_from:
        commits = [c for c in commits if c.authored_date >= state.date_from]

    if state.date_to:
        commits = [c for c in commits if c.authored_date <= state.date_to]

    if state.search_text:
        text = state.search_text.lower()
        commits = [
            c
            for c in commits
            if text in c.subject.lower()
            or text in c.message.lower()
            or text in c.short_sha.lower()
        ]

    if state.branch:
        # Walk reachable commits from branch head
        reachable = _reachable_from_branch(repo_data, state.branch)
        if reachable is not None:
            commits = [c for c in commits if c.sha in reachable]

    return commits


def _reachable_from_branch(
    repo_data: RepoData, branch: str
) -> set[str] | None:
    """Find all commit SHAs reachable from a branch head."""
    # Find the branch head
    head_sha = None
    for commit in repo_data.commits:
        if branch in commit.branches:
            head_sha = commit.sha
            break

    if head_sha is None:
        return None

    reachable: set[str] = set()
    stack = [head_sha]
    while stack:
        sha = stack.pop()
        if sha in reachable:
            continue
        reachable.add(sha)
        node = repo_data.commit_map.get(sha)
        if node:
            stack.extend(node.parent_shas)

    return reachable
