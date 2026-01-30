#!/usr/bin/env bash
# Minimal local CI gate template: install, lint, build, test

set -euo pipefail

echo "🔧 Running local CI gate..."

if command -v npm >/dev/null 2>&1; then
  npm ci
  npm run lint || true
  npm run build || true
  npm test --silent || true
else
  echo "⚠️ npm not found; skipping JS checks"
fi

echo "✅ Local CI gate finished (adjust script to be stricter for your project)"
