#!/bin/bash
set -e

# Update bundled BMAD and Ralph assets from upstream repos
# Usage: npm run update-bundled [-- --bmad-ref <ref>] [-- --ralph-ref <ref>] [-- --only-bmad] [-- --only-ralph]

BMAD_REF=""
RALPH_REF=""
ONLY_BMAD=false
ONLY_RALPH=false

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
    --ralph-ref)
      if [[ -z "${2:-}" || "$2" == --* ]]; then
        echo "Error: --ralph-ref requires a value"
        exit 1
      fi
      RALPH_REF="$2"
      shift 2
      ;;
    --only-bmad)
      ONLY_BMAD=true
      shift
      ;;
    --only-ralph)
      ONLY_RALPH=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: npm run update-bundled [-- --bmad-ref <ref>] [-- --ralph-ref <ref>] [-- --only-bmad] [-- --only-ralph]"
      exit 1
      ;;
  esac
done

if [ "$ONLY_BMAD" = true ] && [ "$ONLY_RALPH" = true ]; then
  echo "Error: --only-bmad and --only-ralph are mutually exclusive"
  exit 1
fi

if [ "$ONLY_BMAD" = true ] && [ -n "$RALPH_REF" ]; then
  echo "Warning: --ralph-ref is ignored when --only-bmad is set"
fi
if [ "$ONLY_RALPH" = true ] && [ -n "$BMAD_REF" ]; then
  echo "Warning: --bmad-ref is ignored when --only-ralph is set"
fi

UPDATE_BMAD=true
UPDATE_RALPH=true

if [ "$ONLY_BMAD" = true ]; then
  UPDATE_RALPH=false
fi

if [ "$ONLY_RALPH" = true ]; then
  UPDATE_BMAD=false
fi

echo "Updating bundled assets from upstream..."
echo ""

# 1. Update upstream repos
if [ "$UPDATE_BMAD" = true ]; then
  if [ -n "$BMAD_REF" ]; then
    echo "Checking out BMAD ref: $BMAD_REF..."
    git -C .refs/bmad fetch origin --tags
    git -C .refs/bmad checkout "$BMAD_REF"
  else
    echo "Pulling latest from BMAD..."
    git -C .refs/bmad pull origin main
  fi
  echo ""
fi

if [ "$UPDATE_RALPH" = true ]; then
  if [ -n "$RALPH_REF" ]; then
    echo "Checking out Ralph ref: $RALPH_REF..."
    git -C .refs/ralph fetch origin --tags
    git -C .refs/ralph checkout "$RALPH_REF"
  else
    echo "Pulling latest from Ralph..."
    git -C .refs/ralph pull origin main
  fi
  echo ""
fi

# 2. Copy BMAD files (source is at .refs/bmad/src/)
if [ "$UPDATE_BMAD" = true ]; then
  echo "Copying BMAD files..."
  rm -rf bmad/bmm bmad/core
  cp -r .refs/bmad/src/bmm bmad/
  cp -r .refs/bmad/src/core bmad/
fi

# 3. Copy Ralph files
if [ "$UPDATE_RALPH" = true ]; then
  echo "Copying Ralph files..."
  rm -rf ralph/lib ralph/templates
  cp -r .refs/ralph/lib ralph/
  cp -r .refs/ralph/templates ralph/
  cp .refs/ralph/ralph_loop.sh ralph/
  cp .refs/ralph/ralph_import.sh ralph/
  cp .refs/ralph/ralph_monitor.sh ralph/

  # Patch ralph_loop.sh: bmalph uses @fix_plan.md (prefixed with @) instead of
  # upstream's fix_plan.md. The @ prefix prevents Ralph's fix plan from being
  # treated as a regular markdown file by other tools. This is the only known
  # divergence from upstream Ralph — the bmalph version marker is injected at
  # install time by installer.ts, so it doesn't need patching here.
  echo "Patching ralph_loop.sh (fix_plan.md → @fix_plan.md)..."
  sed -i 's/fix_plan\.md/@fix_plan.md/g; s/@@fix_plan\.md/@fix_plan.md/g' ralph/ralph_loop.sh
fi

# NOTE: slash-commands/ is custom bmalph content, not from upstream

# 4. Update bundled-versions.json
if [ "$UPDATE_BMAD" = true ]; then
  BMAD_SHA=$(git -C .refs/bmad rev-parse --short=8 HEAD)
else
  BMAD_SHA=$(node -e "console.log(require('./bundled-versions.json').bmadCommit)")
fi

if [ "$UPDATE_RALPH" = true ]; then
  RALPH_SHA=$(git -C .refs/ralph rev-parse --short=8 HEAD)
else
  RALPH_SHA=$(node -e "console.log(require('./bundled-versions.json').ralphCommit)")
fi

cat > bundled-versions.json << EOF
{
  "bmadCommit": "$BMAD_SHA",
  "ralphCommit": "$RALPH_SHA"
}
EOF

# 5. Show results
echo ""
echo "Updated bundled assets:"
if [ "$UPDATE_BMAD" = true ]; then
  echo "  BMAD:  $BMAD_SHA"
fi
if [ "$UPDATE_RALPH" = true ]; then
  echo "  Ralph: $RALPH_SHA"
fi
echo ""
echo "WARNING: Potential breaking changes to check:"
if [ "$UPDATE_BMAD" = true ]; then
  echo "  - BMAD agents may have changed API/format (check bmad/bmm/*.md)"
fi
if [ "$UPDATE_RALPH" = true ]; then
  echo "  - Ralph loop signature changes (check ralph/ralph_loop.sh)"
  echo "  - New/removed files in lib/ or templates/"
  echo "  - Changes to ralph_import.sh or ralph_monitor.sh"
fi
echo ""
echo "Next steps:"
echo "  1. npm run build"
echo "  2. npm test"
echo "  3. Review changes: git diff --stat"
echo "  4. Check BMAD/Ralph changelogs for breaking changes"
echo "  5. Test locally: bmalph init in a test project"
echo "  6. Commit and bump version (MAJOR if breaking)"
