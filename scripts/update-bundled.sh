#!/bin/bash
set -e

# Update bundled BMAD and Ralph assets from upstream repos
# Usage: npm run update-bundled

echo "Updating bundled assets from upstream..."
echo ""

# 1. Pull latest from upstream repos
echo "Pulling latest from BMAD..."
git -C .refs/bmad pull origin main

echo ""
echo "Pulling latest from Ralph..."
git -C .refs/ralph pull origin main

echo ""

# 2. Copy BMAD files (source is at .refs/bmad/src/)
echo "Copying BMAD files..."
rm -rf bmad/bmm bmad/core
cp -r .refs/bmad/src/bmm bmad/
cp -r .refs/bmad/src/core bmad/

# 3. Copy Ralph files
echo "Copying Ralph files..."
rm -rf ralph/lib ralph/templates
cp -r .refs/ralph/lib ralph/
cp -r .refs/ralph/templates ralph/
cp .refs/ralph/ralph_loop.sh ralph/
cp .refs/ralph/ralph_import.sh ralph/
cp .refs/ralph/ralph_monitor.sh ralph/

# NOTE: slash-commands/ is custom bmalph content, not from upstream

# 4. Update bundled-versions.json
BMAD_SHA=$(git -C .refs/bmad rev-parse --short=8 HEAD)
RALPH_SHA=$(git -C .refs/ralph rev-parse --short=8 HEAD)

cat > bundled-versions.json << EOF
{
  "bmadCommit": "$BMAD_SHA",
  "ralphCommit": "$RALPH_SHA"
}
EOF

# 5. Show results
echo ""
echo "Updated bundled assets:"
echo "  BMAD:  $BMAD_SHA"
echo "  Ralph: $RALPH_SHA"
echo ""
echo "WARNING: Potential breaking changes to check:"
echo "  - BMAD agents may have changed API/format (check bmad/bmm/*.md)"
echo "  - Ralph loop signature changes (check ralph/ralph_loop.sh)"
echo "  - New/removed files in lib/ or templates/"
echo "  - Changes to ralph_import.sh or ralph_monitor.sh"
echo ""
echo "Next steps:"
echo "  1. npm run build"
echo "  2. npm test"
echo "  3. Review changes: git diff --stat"
echo "  4. Check BMAD/Ralph changelogs for breaking changes"
echo "  5. Test locally: bmalph init in a test project"
echo "  6. Commit and bump version (MAJOR if breaking)"
