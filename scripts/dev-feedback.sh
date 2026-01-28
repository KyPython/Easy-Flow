#!/usr/bin/env bash
set -e
FILE=${1:-rpa-system/rpa-dashboard/src/pages/IntegrationsPage.jsx}
BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
echo -e "${BLUE}🔍 Scanning ${FILE}...${NC}\n"
if [ -f "$FILE" ]; then
  echo -e "${GREEN}✓ File found${NC}"
else
  echo -e "${YELLOW}○ File not found, skipping targeted checks${NC}"
fi
# Design System (presence of approved colors)
if [ -f .design-system.json ]; then echo -e "${GREEN}✓ Design system config present${NC}"; else echo -e "${YELLOW}○ Missing .design-system.json${NC}"; fi
# Performance (detect waterfall vs Promise.all)
if grep -q "Promise.all" "$FILE" 2>/dev/null; then echo -e "${GREEN}✓ Parallel loading detected (Promise.all)${NC}"; else echo -e "${YELLOW}⚠️  Consider using Promise.all for parallel requests${NC}"; fi
# Accessibility (alt text)
if grep -n "<img" -n "$FILE" 2>/dev/null | grep -vq "alt="; then echo -e "${YELLOW}⚠️  Missing alt text on some images${NC}"; else echo -e "${GREEN}✓ Image alt text looks ok${NC}"; fi
# Output next steps
cat <<EOF

💡 Next Steps:
  1. Fix any accessibility warnings
  2. Ensure parallel data fetching where applicable
  3. Keep UI colors within approved palette
EOF
