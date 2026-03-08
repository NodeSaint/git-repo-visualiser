#!/bin/bash
# Git Repo Visualiser - Launch script
# Usage: ./run.sh [path-to-repo] [options]
#
# Examples:
#   ./run.sh                    # Visualise current directory
#   ./run.sh ~/my-project       # Visualise specific repo
#   ./run.sh ~/my-project -n 1000  # Limit to 1000 commits

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="$SCRIPT_DIR/src:$PYTHONPATH"

python3 -m gitviz "$@"
