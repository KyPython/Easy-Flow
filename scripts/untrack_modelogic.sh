#!/usr/bin/env bash
# Untrack ModeLogic draft assets from git index while keeping them locally.
# Run this from the repo root.

set -euo pipefail

if [ ! -d "docs/modeLogic" ]; then
  echo "No docs/modeLogic directory found in repo root." >&2
  exit 1
fi

git rm --cached -r docs/modeLogic || true
git commit -m "chore: untrack ModeLogic draft assets"

echo "ModeLogic docs untracked. Push changes if desired: git push"
