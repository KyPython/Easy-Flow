#!/bin/bash
# Setup script to install Terraform formatting pre-commit hook
# This script adds Terraform formatting to the existing pre-commit hook

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GIT_HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
PRE_COMMIT_HOOK="$GIT_HOOKS_DIR/pre-commit"
TERRAFORM_FORMAT_SCRIPT="$SCRIPT_DIR/pre-commit-terraform-format.sh"

# Check if we're in a git repository
if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo "Error: Not in a git repository" >&2
  exit 1
fi

# Ensure git hooks directory exists
mkdir -p "$GIT_HOOKS_DIR"

# Make the Terraform format script executable
chmod +x "$TERRAFORM_FORMAT_SCRIPT"

echo "🔧 Setting up Terraform pre-commit formatting..."

# Check if pre-commit hook already exists
if [ -f "$PRE_COMMIT_HOOK" ]; then
  # Check if Terraform formatting is already added
  if grep -q "pre-commit-terraform-format.sh" "$PRE_COMMIT_HOOK"; then
    echo "✓ Terraform formatting already configured in pre-commit hook"
    exit 0
  fi

  # Append Terraform formatting to existing hook
  echo "" >> "$PRE_COMMIT_HOOK"
  echo "# Terraform formatting (auto-format and stage)" >> "$PRE_COMMIT_HOOK"
  echo "\"$TERRAFORM_FORMAT_SCRIPT\"" >> "$PRE_COMMIT_HOOK"
  echo "" >> "$PRE_COMMIT_HOOK"
  echo "✓ Added Terraform formatting to existing pre-commit hook"
else
  # Create new pre-commit hook
  cat > "$PRE_COMMIT_HOOK" << 'EOF'
#!/bin/bash
# Pre-commit hook for DevOps Productivity Suite
# Runs various checks before allowing commit

set -e

# Terraform formatting (auto-format and stage)
EOF
  echo "\"$TERRAFORM_FORMAT_SCRIPT\"" >> "$PRE_COMMIT_HOOK"
  chmod +x "$PRE_COMMIT_HOOK"
  echo "✓ Created new pre-commit hook with Terraform formatting"
fi

echo ""
echo "✅ Terraform pre-commit formatting configured!"
echo ""
echo "The hook will:"
echo "  • Auto-format Terraform files (.tf, .tfvars)"
echo "  • Auto-stage formatted files"
echo "  • Validate Terraform syntax"
echo "  • Only fail if formatting can't be applied or validation fails"
echo ""
echo "Test it by making a commit with Terraform files."

