#!/bin/sh
# EasyFlow Git Hooks Setup
# Adapted from ubiquitous-automation: https://github.com/KyPython/ubiquitous-automation
# Sets up pre-commit hook to run validation before commits

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "${BLUE}=== Setting up EasyFlow Git Hooks ===${NC}\n"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

# Check if .git directory exists
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "${YELLOW}⚠ Not a git repository. Skipping hook setup.${NC}"
    exit 0
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Create pre-commit hook
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"

echo "Creating pre-commit hook..."
cat > "$PRE_COMMIT_HOOK" <<'EOF'
#!/bin/sh
# EasyFlow Pre-Commit Hook
# Runs validation before allowing commits

# Run the pre-commit validation script
./scripts/pre-commit.sh

# Exit with the script's exit code
exit $?
EOF

# Make it executable
chmod +x "$PRE_COMMIT_HOOK"

echo "  ${GREEN}✓ Pre-commit hook installed${NC}"

# Optional: Create commit-msg hook for conventional commits (optional)
read -p "Install commit-msg hook for conventional commits? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    COMMIT_MSG_HOOK="$HOOKS_DIR/commit-msg"
    cat > "$COMMIT_MSG_HOOK" <<'EOF'
#!/bin/sh
# EasyFlow Commit Message Hook
# Validates commit message format (optional - can be customized)

commit_msg=$(cat "$1")

# Check for conventional commit format (optional)
if ! echo "$commit_msg" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+\))?:"; then
    echo "⚠️  Consider using conventional commit format:"
    echo "   feat: description"
    echo "   fix: description"
    echo "   docs: description"
    echo ""
    echo "   Current message: $commit_msg"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
EOF
    chmod +x "$COMMIT_MSG_HOOK"
    echo "  ${GREEN}✓ Commit-msg hook installed${NC}"
fi

echo "\n${GREEN}✅ Git hooks setup complete!${NC}"
echo "\n${BLUE}Hooks installed:${NC}"
echo "  - pre-commit: Runs linting, tests, and build checks"
if [ -f "$COMMIT_MSG_HOOK" ]; then
    echo "  - commit-msg: Validates commit message format"
fi

echo "\n${BLUE}To test the pre-commit hook:${NC}"
echo "  Make a change and try: ${GREEN}git commit -m 'test'${NC}"
echo "\n${BLUE}To bypass hooks (not recommended):${NC}"
echo "  ${YELLOW}git commit --no-verify${NC}"

