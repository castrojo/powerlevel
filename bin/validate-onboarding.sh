#!/usr/bin/env bash
# Validates that onboarding produces minimal footprint
# Usage: bin/validate-onboarding.sh [project-directory]
#
# Checks:
# - AGENTS.md managed section ≤ 35 lines
# - .opencode/config.json ≤ 10 lines
# - docs/SUPERPOWERS.md does not exist
#
# Exit codes:
#   0 - Validation passed
#   1 - Validation failed (bloat detected)

set -euo pipefail

PROJECT_DIR="${1:-.}"
AGENTS_MD_MAX_LINES=35
CONFIG_MAX_LINES=10

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Validating onboarding footprint in: $PROJECT_DIR"
echo ""

FAILURES=0

# Check AGENTS.md managed section
if [ -f "$PROJECT_DIR/AGENTS.md" ]; then
  MANAGED_SECTION_LINES=$(sed -n '/<!-- POWERLEVEL MANAGED SECTION - START -->/,/<!-- POWERLEVEL MANAGED SECTION - END -->/p' "$PROJECT_DIR/AGENTS.md" | wc -l)
  
  if [ "$MANAGED_SECTION_LINES" -gt "$AGENTS_MD_MAX_LINES" ]; then
    echo -e "${RED}❌ AGENTS.md managed section is $MANAGED_SECTION_LINES lines (max: $AGENTS_MD_MAX_LINES)${NC}"
    FAILURES=$((FAILURES + 1))
  else
    echo -e "${GREEN}✓${NC} AGENTS.md managed section: $MANAGED_SECTION_LINES lines (within limit)"
  fi
  
  # Check for placeholder sections after managed section
  if grep -q "## Project-Specific Context" "$PROJECT_DIR/AGENTS.md"; then
    echo -e "${RED}❌ AGENTS.md contains placeholder section: 'Project-Specific Context'${NC}"
    FAILURES=$((FAILURES + 1))
  fi
  
  if grep -q "### Architecture" "$PROJECT_DIR/AGENTS.md"; then
    echo -e "${YELLOW}⚠${NC}  AGENTS.md contains placeholder section: 'Architecture' (may be intentional)"
  fi
else
  echo -e "${YELLOW}⚠${NC}  AGENTS.md not found (skipping check)"
fi

# Check .opencode/config.json
if [ -f "$PROJECT_DIR/.opencode/config.json" ]; then
  CONFIG_LINES=$(wc -l < "$PROJECT_DIR/.opencode/config.json")
  
  if [ "$CONFIG_LINES" -gt "$CONFIG_MAX_LINES" ]; then
    echo -e "${RED}❌ .opencode/config.json is $CONFIG_LINES lines (max: $CONFIG_MAX_LINES)${NC}"
    FAILURES=$((FAILURES + 1))
  else
    echo -e "${GREEN}✓${NC} .opencode/config.json: $CONFIG_LINES lines (within limit)"
  fi
  
  # Check for deprecated config keys
  if grep -q '"superpowers":' "$PROJECT_DIR/.opencode/config.json"; then
    echo -e "${RED}❌ .opencode/config.json uses deprecated 'superpowers' key${NC}"
    echo "   Use 'projectBoard' and 'superpowersIntegration' instead"
    FAILURES=$((FAILURES + 1))
  fi
  
  if grep -q '"wiki":' "$PROJECT_DIR/.opencode/config.json"; then
    echo -e "${YELLOW}⚠${NC}  .opencode/config.json uses deprecated 'wiki' key"
  fi
else
  echo -e "${YELLOW}⚠${NC}  .opencode/config.json not found (skipping check)"
fi

# Check docs/SUPERPOWERS.md (should NOT exist)
if [ -f "$PROJECT_DIR/docs/SUPERPOWERS.md" ]; then
  echo -e "${RED}❌ docs/SUPERPOWERS.md should not exist (redundant workflow documentation)${NC}"
  FAILURES=$((FAILURES + 1))
else
  echo -e "${GREEN}✓${NC} docs/SUPERPOWERS.md does not exist (correct)"
fi

echo ""

# Summary
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}✅ Onboarding footprint is minimal${NC}"
  exit 0
else
  echo -e "${RED}❌ Validation failed with $FAILURES error(s)${NC}"
  echo ""
  echo "See: docs/analysis/ROOT-CAUSE-ONBOARDING-BLOAT.md for principles"
  exit 1
fi
