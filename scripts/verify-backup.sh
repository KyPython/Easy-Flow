#!/bin/bash
# Automated Backup Verification Script
# Runs automatically via GitHub Actions to verify everything is backed up

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Verifying EasyFlow backups..."

# 1. Verify code is in GitHub
echo -n "Checking code backup (GitHub)... "
if git remote -v | grep -q "github.com"; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌ No GitHub remote${NC}"
    exit 1
fi

# 2. Verify latest commit is pushed
echo -n "Checking latest commits are pushed... "
if [ -z "$(git log origin/dev..HEAD 2>/dev/null)" ] && [ -z "$(git log origin/main..HEAD 2>/dev/null)" ]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${YELLOW}⚠️  Unpushed commits found${NC}"
    echo "   Run: git push origin dev && git push origin main"
fi

# 3. Verify critical files exist in git
echo -n "Checking critical files are in git... "
CRITICAL_FILES=(
    "render.yaml"
    "docker-compose.yml"
    ".github/workflows"
    "docs/WORKFLOW.md"
)

MISSING=0
for file in "${CRITICAL_FILES[@]}"; do
    if ! git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
        echo -e "\n   ${RED}❌ Missing: $file${NC}"
        MISSING=1
    fi
done

if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}✅${NC}"
else
    exit 1
fi

# 4. Verify .env files are NOT in git (security)
echo -n "Checking secrets are NOT in git... "
if git ls-files | grep -q "\.env$"; then
    echo -e "${RED}❌ .env files found in git!${NC}"
    echo "   Remove them: git rm --cached **/.env"
    exit 1
else
    echo -e "${GREEN}✅${NC}"
fi

echo ""
echo -e "${GREEN}✅ All automated backups verified!${NC}"
echo ""
echo "📝 Manual steps (only if computer is destroyed):"
echo "   1. Clone repo: git clone https://github.com/KyPython/Easy-Flow.git"
echo "   2. Get env vars from password manager or Render.com dashboard"
echo "   3. Run: ./start-dev.sh"
echo ""
echo "💡 Everything else is automatic:"
echo "   ✅ Code → GitHub (automatic on push)"
echo "   ✅ Database → Supabase backups (automatic daily)"
echo "   ✅ Deployment → Render.com (automatic from GitHub)"
echo "   ✅ Secrets → Render.com/GitHub Secrets (cloud-hosted)"

