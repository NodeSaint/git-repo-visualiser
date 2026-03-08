"""Command-line argument parsing."""

from __future__ import annotations

import argparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="gitviz",
        description="Terminal-based git repository visualiser with interactive branching tree",
    )
    parser.add_argument(
        "path",
        nargs="?",
        default=".",
        help="Path to git repository (default: current directory)",
    )
    parser.add_argument(
        "-n",
        "--max-commits",
        type=int,
        default=5000,
        help="Maximum number of commits to load (default: 5000)",
    )
    parser.add_argument(
        "-b",
        "--branch",
        type=str,
        default=None,
        help="Initial branch filter",
    )
    parser.add_argument(
        "-a",
        "--author",
        type=str,
        default=None,
        help="Initial author filter (email)",
    )
    return parser.parse_args()
