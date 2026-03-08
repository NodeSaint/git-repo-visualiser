"""Color assignment for authors."""

from __future__ import annotations

import hashlib

# Palette of distinct, terminal-friendly colors
AUTHOR_PALETTE = [
    "cyan",
    "magenta",
    "green",
    "yellow",
    "blue",
    "red",
    "bright_cyan",
    "bright_magenta",
    "bright_green",
    "bright_yellow",
    "bright_blue",
    "bright_red",
    "dark_orange",
    "purple",
    "deep_pink2",
    "spring_green2",
    "dodger_blue2",
    "gold1",
    "medium_orchid",
    "chartreuse2",
]


def assign_author_colors(authors: dict[str, object]) -> dict[str, str]:
    """Assign a deterministic color to each author based on email hash."""
    colors: dict[str, str] = {}
    for email in authors:
        h = hashlib.md5(email.encode()).hexdigest()
        idx = int(h[:8], 16) % len(AUTHOR_PALETTE)
        colors[email] = AUTHOR_PALETTE[idx]
    return colors


def get_author_color(email: str) -> str:
    """Get a deterministic color for a single author."""
    h = hashlib.md5(email.encode()).hexdigest()
    idx = int(h[:8], 16) % len(AUTHOR_PALETTE)
    return AUTHOR_PALETTE[idx]
