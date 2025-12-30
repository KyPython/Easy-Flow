#!/bin/bash
# Pre-commit hook for Terraform formatting
# Auto-formats Terraform files, stages them, and validates
# Only fails if formatting can't be applied or validation fails

set -e

# Source error handling if available
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/error-handling.sh" ]; then
  source "$SCRIPT_DIR/lib/error-handling.sh"
  TOOL_NAME="terraform-format"
fi

# Colors for output (disabled in CI)
if [ "$CI" = "true" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$GITLAB_CI" ] || [ -n "$CIRCLECI" ]; then
  CI_MODE=true
  export NO_COLOR=1
  RED=""
  GREEN=""
  YELLOW=""
  RESET=""
else
  CI_MODE=false
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RESET='\033[0m'
fi

# Check if terraform is installed
if ! command -v terraform >/dev/null 2>&1; then
  echo -e "${RED}Error: terraform command not found${RESET}" >&2
  echo "Please install Terraform: https://www.terraform.io/downloads" >&2
  exit 1
fi

# Get list of staged Terraform files
STAGED_TF_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(tf|tfvars)$' || true)

# If no Terraform files are staged, exit successfully
if [ -z "$STAGED_TF_FILES" ]; then
  exit 0
fi

echo "🔍 Checking Terraform files for formatting..."

# Track if any files were modified
FILES_MODIFIED=false
FORMAT_ERRORS=false
VALIDATION_ERRORS=false

# Process each staged Terraform file
for file in $STAGED_TF_FILES; do
  # Skip if file doesn't exist (might have been deleted)
  if [ ! -f "$file" ]; then
    continue
  fi

  echo "  Checking: $file"

  # Check if file needs formatting
  if ! terraform fmt -check -diff "$file" >/dev/null 2>&1; then
    echo "  ${YELLOW}Formatting: $file${RESET}"
    
    # Format the file
    if terraform fmt "$file"; then
      # Stage the formatted file
      git add "$file"
      FILES_MODIFIED=true
      echo "  ${GREEN}✓ Formatted and staged: $file${RESET}"
    else
      echo -e "  ${RED}✗ Failed to format: $file${RESET}" >&2
      FORMAT_ERRORS=true
    fi
  else
    echo "  ${GREEN}✓ Already formatted: $file${RESET}"
  fi

  # Validate Terraform syntax (only for .tf files, not .tfvars)
  if [[ "$file" == *.tf ]]; then
    # Get the directory containing the Terraform file
    tf_dir=$(dirname "$file")
    
    # Initialize Terraform if needed (silently, in case it's already initialized)
    if [ ! -d "$tf_dir/.terraform" ]; then
      echo "  Initializing Terraform in $tf_dir..."
      if ! (cd "$tf_dir" && terraform init -backend=false >/dev/null 2>&1); then
        echo -e "  ${YELLOW}⚠ Warning: Could not initialize Terraform for validation (non-blocking)${RESET}"
        continue
      fi
    fi

    # Validate Terraform configuration
    echo "  Validating: $file"
    if ! (cd "$tf_dir" && terraform validate -no-color >/dev/null 2>&1); then
      echo -e "  ${RED}✗ Validation failed: $file${RESET}" >&2
      echo "  Run 'terraform validate' in $tf_dir for details" >&2
      VALIDATION_ERRORS=true
    else
      echo "  ${GREEN}✓ Valid: $file${RESET}"
    fi
  fi
done

# Report results
if [ "$FILES_MODIFIED" = true ]; then
  echo ""
  echo -e "${GREEN}✓ Terraform files formatted and staged${RESET}"
  echo "  You may need to review the changes before committing."
fi

# Exit with error if formatting or validation failed
if [ "$FORMAT_ERRORS" = true ]; then
  echo ""
  echo -e "${RED}✗ Some files could not be formatted${RESET}" >&2
  exit 1
fi

if [ "$VALIDATION_ERRORS" = true ]; then
  echo ""
  echo -e "${RED}✗ Terraform validation failed${RESET}" >&2
  echo "  Please fix validation errors before committing." >&2
  exit 1
fi

echo ""
echo -e "${GREEN}✓ All Terraform files are properly formatted and valid${RESET}"
exit 0

