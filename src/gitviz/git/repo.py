"""Git repository scanning and data extraction."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import git

from .models import Author, CommitNode, RepoData


def scan_repo(path: str, max_commits: int = 5000) -> RepoData:
    """Scan a git repository and return structured data."""
    repo = git.Repo(path)
    repo_name = os.path.basename(os.path.abspath(path))

    # Build reverse maps: sha -> branch names, sha -> tag names
    branch_map: dict[str, list[str]] = {}
    for head in repo.heads:
        sha = head.commit.hexsha
        branch_map.setdefault(sha, []).append(head.name)

    tag_map: dict[str, list[str]] = {}
    for tag in repo.tags:
        try:
            sha = tag.commit.hexsha
            tag_map.setdefault(sha, []).append(tag.name)
        except Exception:
            pass

    # Current branch and HEAD
    try:
        current_branch = repo.active_branch.name
    except TypeError:
        current_branch = "HEAD (detached)"

    head_sha = repo.head.commit.hexsha

    # Iterate commits across all branches
    authors: dict[str, Author] = {}
    commits: list[CommitNode] = []
    commit_map: dict[str, CommitNode] = {}

    seen = set()
    for commit in repo.iter_commits("--all", max_count=max_commits, topo_order=True):
        if commit.hexsha in seen:
            continue
        seen.add(commit.hexsha)

        email = commit.author.email or "unknown"
        if email not in authors:
            authors[email] = Author(
                name=commit.author.name or "Unknown",
                email=email,
            )
        author = authors[email]
        author.commit_count += 1

        message = commit.message.strip()
        subject = message.split("\n", 1)[0]

        authored_date = datetime.fromtimestamp(
            commit.authored_date, tz=timezone.utc
        )

        node = CommitNode(
            sha=commit.hexsha,
            short_sha=commit.hexsha[:8],
            message=message,
            subject=subject,
            author=author,
            authored_date=authored_date,
            parent_shas=[p.hexsha for p in commit.parents],
            branches=branch_map.get(commit.hexsha, []),
            tags=tag_map.get(commit.hexsha, []),
        )
        commits.append(node)
        commit_map[node.sha] = node

    return RepoData(
        name=repo_name,
        path=os.path.abspath(path),
        commits=commits,
        commit_map=commit_map,
        branches=[h.name for h in repo.heads],
        tags=[t.name for t in repo.tags],
        authors=authors,
        head_sha=head_sha,
        current_branch=current_branch,
    )


def get_changed_files(path: str, sha: str) -> list[str]:
    """Get list of changed files for a specific commit (lazy loaded)."""
    repo = git.Repo(path)
    commit = repo.commit(sha)

    files = []
    if commit.parents:
        diffs = commit.diff(commit.parents[0])
    else:
        diffs = commit.diff(git.NULL_TREE)

    for diff in diffs:
        change_type = diff.change_type  # A, M, D, R, etc.
        path_str = diff.b_path or diff.a_path or "unknown"
        files.append(f"{change_type} {path_str}")

    return files
