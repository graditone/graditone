#!/usr/bin/env bash
# open-worktree.sh — Open the active feature worktree in a new VS Code window.
#
# Usage:
#   .specify/scripts/bash/open-worktree.sh [branch-name]
#
# If no branch-name is given, detects it from the current git branch.
# Finds the matching worktree under .worktrees/ and opens it with `code`.
#
# This ensures all file edits (including AI agent tool calls) land inside
# the worktree instead of the main repo directory.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WORKTREES_DIR="$REPO_ROOT/.worktrees"

# Determine branch name
if [[ $# -ge 1 ]]; then
  BRANCH="$1"
else
  BRANCH="$(git branch --show-current)"
fi

if [[ -z "$BRANCH" || "$BRANCH" == "main" ]]; then
  echo "Error: No feature branch detected (currently on '$BRANCH')." >&2
  echo "Usage: $0 <branch-name>" >&2
  exit 1
fi

# Find matching worktree directory
WORKTREE_PATH="$WORKTREES_DIR/$BRANCH"

if [[ ! -d "$WORKTREE_PATH" ]]; then
  echo "Error: Worktree directory not found: $WORKTREE_PATH" >&2
  echo "Available worktrees:" >&2
  ls -1 "$WORKTREES_DIR" 2>/dev/null || echo "  (none)"
  exit 1
fi

echo "Opening worktree in new VS Code window: $WORKTREE_PATH"
code "$WORKTREE_PATH"
