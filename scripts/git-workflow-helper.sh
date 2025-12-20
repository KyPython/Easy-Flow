#!/bin/bash
# EasyFlow Git Workflow Helper
# Adapted from git-workflows-sample: https://github.com/KyPython/git-workflows-sample
# CLI tool to help developers follow Git workflow best practices

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Show usage
show_usage() {
    echo "${BLUE}EasyFlow Git Workflow Helper${NC}"
    echo ""
    echo "${CYAN}Usage:${NC}"
    echo "  ./scripts/git-workflow-helper.sh <command> [options]"
    echo ""
    echo "${CYAN}Commands:${NC}"
    echo "  branch:create <name>     Create a feature branch with validation"
    echo "  branch:status            Check current branch status"
    echo "  branch:validate <name>   Validate a branch name"
    echo "  commit:check             Check last commit message"
    echo "  commit:validate <msg>    Validate a commit message"
    echo "  status                   Check if branch is ready for PR"
    echo "  rebase [--base <branch>] Rebase current branch"
    echo ""
    echo "${CYAN}Examples:${NC}"
    echo "  ./scripts/git-workflow-helper.sh branch:create feature/add-logging"
    echo "  ./scripts/git-workflow-helper.sh commit:check"
    echo "  ./scripts/git-workflow-helper.sh status"
    echo "  ./scripts/git-workflow-helper.sh rebase --base main"
    exit 1
}

# Validate branch name
validate_branch_name() {
    local branch_name="$1"
    
    if [ -z "$branch_name" ]; then
        echo "${RED}✗ Branch name is required${NC}"
        return 1
    fi
    
    # Check against conventional branch naming
    if echo "$branch_name" | grep -qE "^(feature|bugfix|hotfix|release)/"; then
        echo "${GREEN}✓ Branch name follows convention: $branch_name${NC}"
        return 0
    else
        echo "${RED}✗ Branch name must start with: feature/, bugfix/, hotfix/, or release/${NC}"
        echo "${YELLOW}  Example: feature/add-logging, bugfix/fix-auth, hotfix/critical-bug${NC}"
        return 1
    fi
}

# Create a feature branch
create_branch() {
    local branch_name="$1"
    local base_branch="${2:-main}"
    
    if [ -z "$branch_name" ]; then
        echo "${RED}✗ Branch name is required${NC}"
        echo "  Usage: branch:create <name> [--from <base>]"
        return 1
    fi
    
    # Validate branch name
    if ! validate_branch_name "$branch_name"; then
        return 1
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo "${YELLOW}⚠ You have uncommitted changes. Stash or commit them first.${NC}"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi
    
    # Fetch latest changes
    echo "${BLUE}Fetching latest changes from origin...${NC}"
    git fetch origin "$base_branch" 2>/dev/null || true
    
    # Check if base branch exists
    if ! git show-ref --verify --quiet refs/heads/"$base_branch" && ! git show-ref --verify --quiet refs/remotes/origin/"$base_branch"; then
        echo "${YELLOW}⚠ Base branch '$base_branch' not found. Using current branch.${NC}"
        base_branch=$(git branch --show-current)
    fi
    
    # Create and checkout branch
    echo "${BLUE}Creating branch '$branch_name' from '$base_branch'...${NC}"
    if git checkout -b "$branch_name" "$base_branch" 2>/dev/null; then
        echo "${GREEN}✓ Branch '$branch_name' created successfully${NC}"
        return 0
    else
        echo "${RED}✗ Failed to create branch. It may already exist.${NC}"
        return 1
    fi
}

# Check branch status
branch_status() {
    local current_branch=$(git branch --show-current)
    
    echo "${BLUE}=== Branch Status ===${NC}"
    echo "Current branch: ${CYAN}$current_branch${NC}"
    
    # Check if branch follows convention
    if validate_branch_name "$current_branch"; then
        echo ""
    else
        echo "${YELLOW}⚠ Branch name doesn't follow convention${NC}"
    fi
    
    # Check uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo "${YELLOW}⚠ You have uncommitted changes${NC}"
        git status --short
    else
        echo "${GREEN}✓ No uncommitted changes${NC}"
    fi
    
    # Check commits ahead/behind
    local base_branch="main"
    if git show-ref --verify --quiet refs/remotes/origin/"$base_branch"; then
        local ahead=$(git rev-list --count "$current_branch" ^origin/"$base_branch" 2>/dev/null || echo "0")
        local behind=$(git rev-list --count origin/"$base_branch" ^"$current_branch" 2>/dev/null || echo "0")
        
        if [ "$ahead" -gt 0 ] || [ "$behind" -gt 0 ]; then
            echo ""
            echo "${BLUE}Branch sync status:${NC}"
            if [ "$ahead" -gt 0 ]; then
                echo "  ${GREEN}✓ $ahead commit(s) ahead of $base_branch${NC}"
            fi
            if [ "$behind" -gt 0 ]; then
                echo "  ${YELLOW}⚠ $behind commit(s) behind $base_branch (consider rebasing)${NC}"
            fi
        else
            echo "${GREEN}✓ Branch is in sync with $base_branch${NC}"
        fi
    fi
}

# Validate commit message
validate_commit_message() {
    local commit_msg="$1"
    
    if [ -z "$commit_msg" ]; then
        echo "${RED}✗ Commit message is required${NC}"
        return 1
    fi
    
    # Check conventional commit format
    if echo "$commit_msg" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:"; then
        echo "${GREEN}✓ Commit message follows Conventional Commits format${NC}"
        echo "  Message: ${CYAN}$commit_msg${NC}"
        return 0
    else
        echo "${RED}✗ Commit message doesn't follow Conventional Commits format${NC}"
        echo ""
        echo "${YELLOW}Format: <type>(<scope>): <subject>${NC}"
        echo ""
        echo "${CYAN}Types:${NC}"
        echo "  feat     - New feature"
        echo "  fix      - Bug fix"
        echo "  docs     - Documentation"
        echo "  style    - Code style (formatting)"
        echo "  refactor - Code refactoring"
        echo "  test     - Adding tests"
        echo "  chore    - Maintenance tasks"
        echo "  perf     - Performance improvements"
        echo "  ci       - CI/CD changes"
        echo "  build    - Build system changes"
        echo "  revert   - Revert previous commit"
        echo ""
        echo "${CYAN}Examples:${NC}"
        echo "  feat(auth): add login functionality"
        echo "  fix(api): resolve timeout issue"
        echo "  docs: update README"
        return 1
    fi
}

# Check last commit
check_last_commit() {
    if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
        echo "${YELLOW}⚠ No commits found${NC}"
        return 1
    fi
    
    local last_commit_msg=$(git log -1 --pretty=%B)
    
    echo "${BLUE}=== Last Commit ===${NC}"
    echo "Message: ${CYAN}$last_commit_msg${NC}"
    echo ""
    
    validate_commit_message "$last_commit_msg"
}

# Check PR readiness
check_pr_readiness() {
    local current_branch=$(git branch --show-current)
    local base_branch="main"
    
    echo "${BLUE}=== PR Readiness Check ===${NC}"
    echo "Branch: ${CYAN}$current_branch${NC}"
    echo "Base: ${CYAN}$base_branch${NC}"
    echo ""
    
    local all_checks_passed=true
    
    # Check 1: Uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo "${RED}✗ Uncommitted changes detected${NC}"
        git status --short
        all_checks_passed=false
    else
        echo "${GREEN}✓ No uncommitted changes${NC}"
    fi
    
    # Check 2: Branch naming
    if ! validate_branch_name "$current_branch"; then
        all_checks_passed=false
    fi
    
    # Check 3: Commit messages
    echo ""
    echo "${BLUE}Checking commit messages...${NC}"
    local invalid_commits=0
    local commits=$(git rev-list "$base_branch".."$current_branch" 2>/dev/null || echo "")
    if [ -n "$commits" ]; then
        while IFS= read -r commit; do
            [ -z "$commit" ] && continue
            local commit_msg=$(git log -1 --pretty=%B "$commit" 2>/dev/null)
            if ! validate_commit_message "$commit_msg" >/dev/null 2>&1; then
                invalid_commits=$((invalid_commits + 1))
                echo "  ${RED}✗ Invalid: $commit_msg${NC}"
            fi
        done <<< "$commits"
    fi
    
    if [ "$invalid_commits" -eq 0 ]; then
        echo "${GREEN}✓ All commit messages are valid${NC}"
    else
        echo "${RED}✗ $invalid_commits commit(s) with invalid messages${NC}"
        all_checks_passed=false
    fi
    
    # Check 4: Branch sync
    echo ""
    if git show-ref --verify --quiet refs/remotes/origin/"$base_branch"; then
        local behind=$(git rev-list --count origin/"$base_branch" ^"$current_branch" 2>/dev/null || echo "0")
        if [ "$behind" -gt 0 ]; then
            echo "${YELLOW}⚠ Branch is $behind commit(s) behind $base_branch${NC}"
            echo "  Run: ${CYAN}./scripts/git-workflow-helper.sh rebase${NC}"
            all_checks_passed=false
        else
            echo "${GREEN}✓ Branch is up to date with $base_branch${NC}"
        fi
    fi
    
    # Summary
    echo ""
    if [ "$all_checks_passed" = true ]; then
        echo "${GREEN}✅ Branch is ready for Pull Request!${NC}"
        return 0
    else
        echo "${RED}❌ Branch is not ready for Pull Request${NC}"
        echo "  Fix the issues above before creating a PR"
        return 1
    fi
}

# Rebase helper
rebase_branch() {
    local base_branch="${1:-main}"
    local current_branch=$(git branch --show-current)
    
    echo "${BLUE}=== Rebase Helper ===${NC}"
    echo "Current branch: ${CYAN}$current_branch${NC}"
    echo "Base branch: ${CYAN}$base_branch${NC}"
    echo ""
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo "${RED}✗ You have uncommitted changes${NC}"
        echo "  Stash or commit them before rebasing"
        return 1
    fi
    
    # Check if base branch exists
    if ! git show-ref --verify --quiet refs/heads/"$base_branch" && ! git show-ref --verify --quiet refs/remotes/origin/"$base_branch"; then
        echo "${RED}✗ Base branch '$base_branch' not found${NC}"
        return 1
    fi
    
    # Fetch latest
    echo "${BLUE}Fetching latest changes...${NC}"
    git fetch origin "$base_branch" 2>/dev/null || true
    
    # Check if rebase is needed
    local behind=$(git rev-list --count origin/"$base_branch" ^"$current_branch" 2>/dev/null || echo "0")
    if [ "$behind" -eq 0 ]; then
        echo "${GREEN}✓ Branch is already up to date${NC}"
        return 0
    fi
    
    echo "${YELLOW}⚠ Branch is $behind commit(s) behind $base_branch${NC}"
    read -p "Rebase onto $base_branch? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 1
    fi
    
    # Perform rebase
    echo "${BLUE}Rebasing...${NC}"
    if git rebase "origin/$base_branch"; then
        echo "${GREEN}✓ Rebase completed successfully${NC}"
        echo ""
        echo "${YELLOW}⚠ If you've already pushed this branch, you'll need to force push:${NC}"
        echo "  ${CYAN}git push --force-with-lease origin $current_branch${NC}"
        return 0
    else
        echo "${RED}✗ Rebase failed. Resolve conflicts and run:${NC}"
        echo "  ${CYAN}git rebase --continue${NC}"
        return 1
    fi
}

# Main command handler
main() {
    local command="$1"
    shift || true
    
    case "$command" in
        branch:create|bc)
            local branch_name="$1"
            local base_branch="main"
            
            # Parse --from option
            while [ $# -gt 0 ]; do
                case "$1" in
                    --from)
                        base_branch="$2"
                        shift 2
                        ;;
                    *)
                        if [ -z "$branch_name" ]; then
                            branch_name="$1"
                        fi
                        shift
                        ;;
                esac
            done
            
            create_branch "$branch_name" "$base_branch"
            ;;
        branch:status|bs)
            branch_status
            ;;
        branch:validate|bv)
            validate_branch_name "$1"
            ;;
        commit:check|cc)
            check_last_commit
            ;;
        commit:validate|cv)
            validate_commit_message "$1"
            ;;
        status|st)
            check_pr_readiness
            ;;
        rebase|rb)
            local base_branch="main"
            
            # Parse --base option
            while [ $# -gt 0 ]; do
                case "$1" in
                    --base)
                        base_branch="$2"
                        shift 2
                        ;;
                    *)
                        shift
                        ;;
                esac
            done
            
            rebase_branch "$base_branch"
            ;;
        *)
            show_usage
            ;;
    esac
}

# Run main
main "$@"

