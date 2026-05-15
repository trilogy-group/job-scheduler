#!/usr/bin/env bash
#
# install.sh — point Git at the repo-versioned hooks directory.
#
# This sets `core.hooksPath` so Git executes hooks from
# `scripts/git-hooks/` (which is committed to the repo) instead of
# the per-clone `.git/hooks/` directory. Run this once after every
# fresh clone of the repository.
#
# See CONTRIBUTING.md (#installing-the-git-hooks) for context.

set -euo pipefail

git config core.hooksPath scripts/git-hooks
echo "✓ Git hooks installed. core.hooksPath set to scripts/git-hooks."
