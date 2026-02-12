#!/usr/bin/env bash
# Install husky and set up hooks in the target repository
set -euo pipefail

if [ ! -f package.json ]; then
  echo "No package.json found; skipping husky install"
  exit 0
fi

if command -v npm >/dev/null 2>&1; then
  echo "Installing husky via npm"
  npm install --no-audit --no-fund husky --save-dev
  npx husky install
  echo "husky installed"
else
  echo "npm not found; please install Husky manually"
  exit 1
fi
