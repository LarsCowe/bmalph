#!/bin/bash
set -e

# Update bundled BMAD assets from upstream repo
# Usage: npm run update-bundled [-- --bmad-ref <ref>]

BMAD_REF=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bmad-ref)
      if [[ -z "${2:-}" || "$2" == --* ]]; then
        echo "Error: --bmad-ref requires a value"
        exit 1
      fi
      BMAD_REF="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: npm run update-bundled [-- --bmad-ref <ref>]"
      exit 1
      ;;
  esac
done

echo "Updating bundled assets from upstream..."
echo ""

# 1. Update upstream repo
if [ -n "$BMAD_REF" ]; then
  echo "Checking out BMAD ref: $BMAD_REF..."
  git -C .refs/bmad fetch origin --tags
  git -C .refs/bmad checkout "$BMAD_REF"
else
  echo "Pulling latest from BMAD..."
  git -C .refs/bmad pull origin main
fi
echo ""

# 2. Copy BMAD files (source is at .refs/bmad/src/)
echo "Copying BMAD files..."
rm -rf bmad/bmm bmad/core
cp -r .refs/bmad/src/bmm bmad/
cp -r .refs/bmad/src/core bmad/

# NOTE: slash-commands/ is custom bmalph content, not from upstream
# NOTE: ralph/ is fully owned by bmalph, no upstream tracking

# 3. Update bundled-versions.json
BMAD_SHA=$(git -C .refs/bmad rev-parse --short=8 HEAD)

cat > bundled-versions.json << EOF
{
  "bmadCommit": "$BMAD_SHA"
}
EOF

# 4. Show results
echo ""
echo "Updated bundled assets:"
echo "  BMAD:  $BMAD_SHA"
echo ""
echo "WARNING: Potential breaking changes to check:"
echo "  - BMAD agents may have changed API/format (check bmad/bmm/*.md)"
echo ""
echo "Next steps:"
echo "  1. npm run build"
echo "  2. npm test"
echo "  3. Review changes: git diff --stat"
echo "  4. Check BMAD changelog for breaking changes"
echo "  5. Test locally: bmalph init in a test project"
echo "  6. Commit and bump version (MAJOR if breaking)"
