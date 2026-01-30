#!/usr/bin/env bash
# Bootstrap EasyFlow standards into a target repository
# Usage: bootstrap-easyflow-standards.sh [--dry-run] [--overwrite] /path/to/target/repo /path/to/source/templates
# Default: dry-run (non-destructive). To apply, pass --no-dry-run or set DRY_RUN=false

set -euo pipefail

DRY_RUN=true
OVERWRITE=false

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true; shift ;;
    --no-dry-run|--apply)
      DRY_RUN=false; shift ;;
    --overwrite)
      OVERWRITE=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--overwrite] /path/to/target/repo /path/to/source/templates"; exit 0 ;;
    *)
      if [ -z "${TARGET:-}" ]; then TARGET=$1; else SOURCE=$1; fi
      shift ;;
  esac
done

TARGET=${TARGET:-}
SOURCE=${SOURCE:-}

if [ -z "$TARGET" ] || [ -z "$SOURCE" ]; then
  echo "Usage: $0 [--dry-run] [--overwrite] /path/to/target/repo /path/to/source/templates"
  exit 2
fi

if [ ! -d "$TARGET/.git" ]; then
  echo "Target path is not a git repository: $TARGET"
  exit 2
fi

echo "Preparing dry-run copy from $SOURCE to $TARGET (DRY_RUN=$DRY_RUN, OVERWRITE=$OVERWRITE)..."

if [ ! -d "$SOURCE" ]; then
  echo "Source templates path missing: $SOURCE"; exit 2
fi

# Work in a temporary clone of the target to avoid touching the real repo in dry-run
TMP_DIR="$(mktemp -d /tmp/easyflow-bootstrap.XXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Creating temp clone to show changes: $TMP_DIR"
git clone --mirror "$TARGET" "$TMP_DIR/repo.git" >/dev/null 2>&1 || {
  echo "Failed to mirror-clone target repo. Ensure path is a git repo."; exit 2
}

# create a working copy
git clone "$TMP_DIR/repo.git" "$TMP_DIR/work" >/dev/null 2>&1
cd "$TMP_DIR/work"

mkdir -p ".husky" "scripts" "scripts/observability" "docs"

copy_item() {
  local src="$1" dst="$2"
  if [ -e "$dst" ] && [ "$OVERWRITE" != "true" ]; then
    echo "SKIP (exists): $dst"
    echo "$dst" >> "$TMP_DIR/skipped.txt"
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  cp -R "$src" "$dst"
}

if [ -f "$SOURCE/pre-push" ]; then
  copy_item "$SOURCE/pre-push" ".husky/pre-push"
  chmod +x ".husky/pre-push"
fi

if [ -d "$SOURCE/scripts" ]; then
  for f in "$SOURCE/scripts/"*; do
    [ -e "$f" ] || continue
    copy_item "$f" "scripts/$(basename "$f")"
  done
  find "scripts" -type f -name "*.sh" -exec chmod +x {} \;
fi

if [ -d "$SOURCE/observability" ]; then
  for f in "$SOURCE/observability/"*; do
    [ -e "$f" ] || continue
    copy_item "$f" "scripts/observability/$(basename "$f")"
  done
fi

if [ -f "$SOURCE/README.md" ]; then
  copy_item "$SOURCE/README.md" "docs/EASYFLOW-TEMPLATES-README.md"
fi
if [ -f "$SOURCE/AI_PROMPT.md" ]; then
  copy_item "$SOURCE/AI_PROMPT.md" "docs/EASYFLOW-AI-PROMPT.md"
fi

git add -A
if git diff --staged --quiet; then
  echo "No changes would be made to the repo."
else
  echo "Files that would be added/changed:"
  git --no-pager diff --staged --name-status
  echo "\nDiff preview (staged changes):"
  git --no-pager diff --staged || true
fi

if [ "$DRY_RUN" = "true" ]; then
  echo "\nDRY_RUN=true → no changes applied to the real repo. To apply, re-run with --no-dry-run and confirm --overwrite if desired."
  exit 0
fi

echo "Applying changes to real repo..."
cd "$TARGET"
git checkout -b "chore/easyflow-standards-$(date +%Y%m%d)"

# copy with overwrite policy
mkdir -p ".husky" "scripts" "scripts/observability" "docs"
if [ -f "$SOURCE/pre-push" ]; then
  if [ -f ".husky/pre-push" ] && [ "$OVERWRITE" != "true" ]; then
    echo ".husky/pre-push exists; skipping (use --overwrite to replace)"
  else
    cp "$SOURCE/pre-push" ".husky/pre-push"; chmod +x ".husky/pre-push"; git add .husky/pre-push
  fi
fi

if [ -d "$SOURCE/scripts" ]; then
  for f in "$SOURCE/scripts/"*; do
    [ -e "$f" ] || continue
    dest="scripts/$(basename "$f")"
    if [ -f "$dest" ] && [ "$OVERWRITE" != "true" ]; then
      echo "Skipping existing $dest (use --overwrite to replace)"
    else
      cp -R "$f" "$dest"; chmod +x "$dest"; git add "$dest"
    fi
  done
fi

if [ -d "$SOURCE/observability" ]; then
  for f in "$SOURCE/observability/"*; do
    [ -e "$f" ] || continue
    dest="scripts/observability/$(basename "$f")"
    if [ -f "$dest" ] && [ "$OVERWRITE" != "true" ]; then
      echo "Skipping existing $dest (use --overwrite to replace)"
    else
      cp -R "$f" "$dest"; git add "$dest"
    fi
  done
fi

if [ -f "$SOURCE/README.md" ]; then
  dest="docs/EASYFLOW-TEMPLATES-README.md"
  if [ -f "$dest" ] && [ "$OVERWRITE" != "true" ]; then
    echo "Skipping existing $dest (use --overwrite to replace)"
  else
    cp "$SOURCE/README.md" "$dest"; git add "$dest"
  fi
fi

if [ -f "$SOURCE/AI_PROMPT.md" ]; then
  dest="docs/EASYFLOW-AI-PROMPT.md"
  if [ -f "$dest" ] && [ "$OVERWRITE" != "true" ]; then
    echo "Skipping existing $dest (use --overwrite to replace)"
  else
    cp "$SOURCE/AI_PROMPT.md" "$dest"; git add "$dest"
  fi
fi

if git diff --staged --quiet; then
  echo "No files staged — nothing to commit."
  exit 0
fi

git commit -m "chore: add EasyFlow standards and templates"
git push -u origin HEAD

echo "Applied templates and pushed branch $(git rev-parse --abbrev-ref HEAD)"
echo "Create a PR with:"
echo "  gh pr create --fill --title 'chore: add EasyFlow standards and templates' --body 'Adds pre-push hook, docs-sync, local CI template, and observability smoke test.'"

