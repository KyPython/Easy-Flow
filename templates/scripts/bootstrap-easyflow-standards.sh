#!/usr/bin/env bash
# Bootstrap EasyFlow standards into a target repository
# Usage: bootstrap-easyflow-standards.sh /path/to/target/repo /path/to/source/templates

set -euo pipefail

TARGET=${1:-}
SOURCE=${2:-}

if [ -z "$TARGET" ] || [ -z "$SOURCE" ]; then
  echo "Usage: $0 /path/to/target/repo /path/to/source/templates"
  exit 2
fi

if [ ! -d "$TARGET/.git" ]; then
  echo "Target path is not a git repository: $TARGET"
  exit 2
fi

echo "Copying EasyFlow templates from $SOURCE to $TARGET..."

mkdir -p "$TARGET/.husky"
mkdir -p "$TARGET/scripts"
mkdir -p "$TARGET/scripts/observability"

# copy pre-push
if [ -f "$SOURCE/pre-push" ]; then
  cp "$SOURCE/pre-push" "$TARGET/.husky/pre-push"
  chmod +x "$TARGET/.husky/pre-push"
  echo "Installed .husky/pre-push"
fi

# copy scripts
if [ -d "$SOURCE/scripts" ]; then
  cp -R "$SOURCE/scripts/"* "$TARGET/scripts/"
  find "$TARGET/scripts" -type f -name "*.sh" -exec chmod +x {} \;
  echo "Copied scripts into scripts/"
fi

# copy observability
if [ -d "$SOURCE/observability" ]; then
  cp -R "$SOURCE/observability/"* "$TARGET/scripts/observability/"
  echo "Copied observability templates"
fi

# copy docs and prompt
mkdir -p "$TARGET/docs"
if [ -f "$SOURCE/README.md" ]; then
  cp "$SOURCE/README.md" "$TARGET/docs/EASYFLOW-TEMPLATES-README.md"
fi
if [ -f "$SOURCE/AI_PROMPT.md" ]; then
  cp "$SOURCE/AI_PROMPT.md" "$TARGET/docs/EASYFLOW-AI-PROMPT.md"
fi

echo "Templates copied. Next steps (run these in $TARGET):"
echo "  1) If you use Husky: run 'npx husky install' and ensure .husky is committed"
echo "  2) git checkout -b chore/easyflow-standards-$(date +%Y%m%d)"
echo "  3) git add .husky scripts docs && git commit -m 'chore: add EasyFlow standards and templates'"
echo "  4) git push -u origin HEAD && gh pr create --fill --title 'chore: add EasyFlow standards and templates' --body 'Adds EasyFlow standards/templates'"
echo "  5) (optional) Run scripts/setup-branch-protection.sh with GITHUB_REPO and GITHUB_TOKEN to apply branch protection"

echo "Bootstrap complete. Review changes and open a PR."
