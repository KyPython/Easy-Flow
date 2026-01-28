#!/bin/bash
# Sovereign Copywriting & Branding Consistency Check
# Ensures all public copy, UI text, and docs follow the Language of Trust & Branding Framework

set -e

FAILED=0

# 1. Check for forbidden words/phrases (hype, absolutes, etc.)
FORBIDDEN_WORDS=("guarantee" "total" "one-stop" "world-class" "leading" "dream retirement" "financial freedom")
PREFER_WORDS=("protection" "portion" "diversified" "comprehensive" "effective" "comfortable retirement" "financial security")

# 2. Check for required themes (sovereign, trust, clarity, focus, transparency, etc.)
REQUIRED_THEMES=("sovereign" "trust" "clarity" "focus" "transparency" "credibility" "collaborative" "architect")

# 3. Scan UI copy, docs, and marketing for violations
FILES=$(find rpa-system/rpa-dashboard/src/i18n/locales/ docs/ README.md -type f \( -name '*.json' -o -name '*.md' -o -name '*.js' -o -name '*.jsx' \) 2>/dev/null)

for file in $FILES; do
  for word in "${FORBIDDEN_WORDS[@]}"; do
    if grep -i -q "$word" "$file"; then
      echo "❌ Forbidden word '$word' found in $file"
      FAILED=1
    fi
  done
  # Check for at least one required theme word in each major doc/locale
  if [[ "$file" == *en.json || "$file" == *.md ]]; then
    THEME_FOUND=0
    for theme in "${REQUIRED_THEMES[@]}"; do
      if grep -i -q "$theme" "$file"; then
        THEME_FOUND=1
        break
      fi
    done
    if [ $THEME_FOUND -eq 0 ]; then
      echo "⚠️  No required theme word found in $file (consider reinforcing sovereign/trust/clarity/focus)"
      FAILED=1
    fi
  fi
  # Check for over-promising language (absolutes, hype)
  if grep -i -E '\b(always|never|perfect|best|only|all|every|guaranteed|unlimited|no risk|no fail|no effort|instantly|impossible|revolutionary|disruptive|world[- ]?class|leading|total|one[- ]?stop|dream retirement|financial freedom)\b' "$file"; then
    echo "❌ Hype/absolute language found in $file"
    FAILED=1
  fi
  # Check for clarity: flag sentences >30 words (potentially unclear)
  if grep -oE '[^.?!]{30,}' "$file" | grep -q ' '; then
    echo "⚠️  Long/unwieldy sentence found in $file (review for clarity)"
    FAILED=1
  fi
  # Check for missing alternative solutions or limitations
  if grep -i -q 'alternative' "$file" || grep -i -q 'limitation' "$file"; then
    : # Good, skip
  else
    echo "⚠️  $file may not acknowledge alternatives/limitations (review for credibility)"
    FAILED=1
  fi
  # Check for branding word focus ("sovereign")
  if ! grep -i -q 'sovereign' "$file"; then
    echo "⚠️  $file missing 'sovereign' (reinforce brand focus)"
    FAILED=1
  fi
  # Check for trust-building practices (transparency, feedback, update, example, limitation)
  if ! grep -i -E 'transpar|feedback|update|example|limitation' "$file"; then
    echo "⚠️  $file missing trust-building language (add transparency/feedback/examples/limitations)"
    FAILED=1
  fi

done

if [ $FAILED -ne 0 ]; then
  echo "❌ Sovereign copywriting/branding check failed. See above for details."
  exit 1
else
  echo "✅ All copy and branding checks passed."
  exit 0
fi
