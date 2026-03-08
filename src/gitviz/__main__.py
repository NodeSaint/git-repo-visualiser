"""Entry point for python -m gitviz."""

from __future__ import annotations

from .cli import parse_args
from .app import GitVizApp


def main() -> None:
    args = parse_args()
    app = GitVizApp(repo_path=args.path, max_commits=args.max_commits)
    app.run()


if __name__ == "__main__":
    main()
