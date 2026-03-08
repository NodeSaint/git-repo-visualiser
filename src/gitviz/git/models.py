"""Data models for git repository information."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Author:
    name: str
    email: str
    color: str = ""
    commit_count: int = 0


@dataclass
class CommitNode:
    sha: str
    short_sha: str
    message: str
    subject: str
    author: Author
    authored_date: datetime
    parent_shas: list[str] = field(default_factory=list)
    branches: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    changed_files: list[str] | None = None

    @property
    def is_merge(self) -> bool:
        return len(self.parent_shas) > 1


@dataclass
class RepoData:
    name: str
    path: str
    commits: list[CommitNode] = field(default_factory=list)
    commit_map: dict[str, CommitNode] = field(default_factory=dict)
    branches: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    authors: dict[str, Author] = field(default_factory=dict)
    head_sha: str = ""
    current_branch: str = ""
