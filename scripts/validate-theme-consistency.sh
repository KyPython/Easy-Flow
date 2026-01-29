#!/bin/bash
# Theme Consistency Validation
# Ensures all React components use ThemeContext and are styled consistently

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== Theme Consistency Validation ===${NC}\n"

FAILED=0
TOTAL_VIOLATIONS=0

# Directories to check
FRONTEND_DIR="rpa-system/rpa-dashboard/src"

# Expected theme context import
THEME_IMPORT_PATTERN="useTheme|ThemeContext|ThemeProvider"
THEME_HOOK_PATTERN="useTheme\\(\\)"
THEME_CSS_VAR_PATTERN="var\\(--color-|var\\(--font-|var\\(--spacing-"

echo "${BLUE}Checking React components for theme usage...${NC}\n"

# Function to check a component file
check_component_theme() {
    local file="$1"
    local violations=0
    
    # Skip test files and non-component files
    if [[ "$file" == *".test."* ]] || [[ "$file" == *".spec."* ]] || [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *"build"* ]]; then
        return 0
    fi
    
    # Only check React component files
    if [[ "$file" != *.jsx ]] && [[ "$file" != *.tsx ]]; then
        return 0
    fi
    
    # Skip context/provider files themselves
    if [[ "$file" == *"ThemeContext"* ]] || [[ "$file" == *"Context"* ]] && [[ "$file" != *"components"* ]]; then
        return 0
    fi
    
    # Check if file contains JSX (is a component)
    if ! grep -q "return.*<" "$file" 2>/dev/null && ! grep -q "=>.*<" "$file" 2>/dev/null; then
        return 0
    fi
    
    # Check for theme context usage
    local has_theme_import=$(grep -E "import.*${THEME_IMPORT_PATTERN}" "$file" 2>/dev/null | wc -l || echo "0")
    local has_theme_hook=$(grep -E "${THEME_HOOK_PATTERN}" "$file" 2>/dev/null | wc -l || echo "0")
    local has_theme_css=$(grep -E "${THEME_CSS_VAR_PATTERN}" "$file" 2>/dev/null | wc -l || echo "0")
    local has_inline_styles=$(grep -E "style=\{" "$file" 2>/dev/null | grep -v "theme\." | grep -v "var(" | grep -E "color|background|border|fill|stroke" | wc -l || echo "0")
    local has_hardcoded_colors=$(grep -E "#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|hsl\(|hsla\(" "$file" 2>/dev/null | grep -v "//" | grep -v "var(" | wc -l || echo "0")
    
    # Components should use theme context or CSS variables
    if [ "$has_theme_import" -eq 0 ] && [ "$has_theme_hook" -eq 0 ] && [ "$has_theme_css" -eq 0 ]; then
        # Check if it's actually a component (has JSX)
        if grep -q "export.*function\|export.*const.*=" "$file" 2>/dev/null; then
            echo "  ${YELLOW}⚠ ${file}${NC}"
            echo "    ${RED}✗ Component does not use ThemeContext or CSS variables${NC}"
            echo "    ${CYAN}   Recommendation: Import and use useTheme() hook or use CSS variables${NC}"
            violations=$((violations + 1))
        fi
    fi
    
    # Check for hardcoded colors (should use theme)
    if [ "$has_hardcoded_colors" -gt 0 ] && [ "$has_theme_hook" -eq 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Hardcoded colors detected (${has_hardcoded_colors} found)${NC}"
        echo "    ${CYAN}   Recommendation: Use theme colors via useTheme() or CSS variables${NC}"
        violations=$((violations + 1))
    fi
    
    # Check for inline styles without theme (should use CSS modules or theme)
    if [ "$has_inline_styles" -gt 5 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Many inline styles detected (${has_inline_styles} found)${NC}"
        echo "    ${CYAN}   Recommendation: Use CSS modules with theme variables or styled components${NC}"
        violations=$((violations + 1))
    fi
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    return $violations
}

# Check CSS files for theme variable usage
check_css_theme() {
    local file="$1"
    local violations=0
    
    if [[ "$file" != *.css ]] && [[ "$file" != *.module.css ]]; then
        return 0
    fi
    
    # Check for hardcoded colors in CSS
    local hardcoded_colors=$(grep -E "#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|hsl\(|hsla\(" "$file" 2>/dev/null | grep -v "var(" | grep -v "/*" | wc -l || echo "0")
    local uses_css_vars=$(grep -E "var\\(--" "$file" 2>/dev/null | wc -l || echo "0")
    
    # If CSS has hardcoded colors but doesn't use CSS variables, flag it
    if [ "$hardcoded_colors" -gt 10 ] && [ "$uses_css_vars" -eq 0 ]; then
        echo "  ${YELLOW}⚠ ${file}${NC}"
        echo "    ${RED}✗ Many hardcoded colors without CSS variables (${hardcoded_colors} found)${NC}"
        echo "    ${CYAN}   Recommendation: Use CSS variables from theme.css${NC}"
        violations=$((violations + 1))
    fi
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    return $violations
}

# Scan component files
if [ -d "$FRONTEND_DIR" ]; then
    echo "${BLUE}Scanning React components...${NC}"
    while IFS= read -r -d '' file; do
        check_component_theme "$file" || FAILED=$((FAILED + 1))
    done < <(find "$FRONTEND_DIR" -type f \( -name "*.jsx" -o -name "*.tsx" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -name "*.test.jsx" \
        ! -name "*.spec.jsx" \
        -print0 2>/dev/null)
    
    echo "\n${BLUE}Scanning CSS files...${NC}"
    while IFS= read -r -d '' file; do
        check_css_theme "$file" || FAILED=$((FAILED + 1))
    done < <(find "$FRONTEND_DIR" -type f \( -name "*.css" -o -name "*.module.css" \) \
        ! -path "*/node_modules/*" \
        ! -path "*/dist/*" \
        ! -path "*/build/*" \
        ! -name "theme.css" \
        -print0 2>/dev/null)
fi

# Summary
echo "\n${BLUE}=== Theme Consistency Validation Summary ===${NC}"
if [ $TOTAL_VIOLATIONS -eq 0 ]; then
    echo "${GREEN}✅ All components use theme consistently!${NC}"
    exit 0
else
    echo "${RED}❌ Found ${TOTAL_VIOLATIONS} theme consistency violation(s)${NC}"
    echo ""
    echo "${CYAN}Recommendations:${NC}"
    echo "  1. Import and use useTheme() hook in all components"
    echo "  2. Replace hardcoded colors with theme colors"
    echo "  3. Use CSS variables from theme.css"
    echo "  4. Avoid inline styles - use CSS modules with theme variables"
    echo ""
    exit 1
fi

