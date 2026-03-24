#!/usr/bin/env bats
# Tests for ralph/lib/task_sources.sh
# Validates task normalization, priority sorting, PRD extraction,
# and CLI-mocked integrations (beads, GitHub).

setup() {
    load 'test_helper/common-setup'
    _common_setup
    source "$RALPH_LIB/task_sources.sh"
    _ORIG_DIR="$(pwd)"
    _ORIG_PATH="$PATH"
    _WORK_DIR="$(mktemp -d)"
    cd "$_WORK_DIR"
}

teardown() {
    cd "$_ORIG_DIR"
    PATH="$_ORIG_PATH"
    rm -rf "$_WORK_DIR"
    _common_teardown
}

# ===========================================================================
# normalize_tasks — checkbox format
# ===========================================================================

@test "normalize_tasks passes through unchecked checkbox unchanged" {
    run normalize_tasks "- [ ] Implement user authentication" "test"
    assert_success
    assert_output "- [ ] Implement user authentication"
}

@test "normalize_tasks unchecks lowercase x checkboxes" {
    run normalize_tasks "- [x] Deploy to production" "test"
    assert_success
    assert_output "- [ ] Deploy to production"
}

@test "normalize_tasks unchecks uppercase X checkboxes" {
    run normalize_tasks "- [X] Configure database" "test"
    assert_success
    assert_output "- [ ] Configure database"
}

# ===========================================================================
# normalize_tasks — bullet format
# ===========================================================================

@test "normalize_tasks converts dash bullet to checkbox" {
    run normalize_tasks "- Set up CI pipeline" "test"
    assert_success
    assert_output "- [ ] Set up CI pipeline"
}

@test "normalize_tasks converts asterisk bullet to checkbox" {
    run normalize_tasks "* Add integration tests" "test"
    assert_success
    assert_output "- [ ] Add integration tests"
}

# ===========================================================================
# normalize_tasks — numbered format
# ===========================================================================

@test "normalize_tasks converts numbered item with dot to checkbox" {
    run normalize_tasks "1. Create database schema" "test"
    assert_success
    assert_output "- [ ] Create database schema"
}

@test "normalize_tasks converts numbered item without dot to checkbox" {
    run normalize_tasks "3 Implement API endpoints" "test"
    assert_success
    assert_output "- [ ] Implement API endpoints"
}

# ===========================================================================
# normalize_tasks — plain text
# ===========================================================================

@test "normalize_tasks wraps plain text in checkbox format" {
    run normalize_tasks "Write unit tests for auth module" "test"
    assert_success
    assert_output "- [ ] Write unit tests for auth module"
}

@test "normalize_tasks skips empty lines in input" {
    local input=$'- [ ] First task\n\n- [ ] Second task'
    run normalize_tasks "$input" "test"
    assert_success
    assert_line --index 0 "- [ ] First task"
    assert_line --index 1 "- [ ] Second task"
}

@test "normalize_tasks returns 0 for empty input" {
    run normalize_tasks "" "test"
    assert_success
}

# ===========================================================================
# normalize_tasks — mixed format
# ===========================================================================

@test "normalize_tasks handles mixed format input" {
    local input=$'- [x] Completed task\n* Bullet task\n2. Numbered task\nPlain text task'
    run normalize_tasks "$input" "test"
    assert_success
    assert_line --index 0 "- [ ] Completed task"
    assert_line --index 1 "- [ ] Bullet task"
    assert_line --index 2 "- [ ] Numbered task"
    assert_line --index 3 "- [ ] Plain text task"
}

# ===========================================================================
# prioritize_tasks — high priority
# ===========================================================================

@test "prioritize_tasks puts critical tasks in high priority" {
    run prioritize_tasks "- [ ] Fix critical authentication bypass"
    assert_output --partial "## High Priority"
    assert_output --partial "critical authentication bypass"
}

@test "prioritize_tasks puts urgent tasks in high priority" {
    run prioritize_tasks "- [ ] Handle urgent database migration"
    assert_output --partial "## High Priority"
    assert_output --partial "urgent database migration"
}

@test "prioritize_tasks puts security tasks in high priority" {
    run prioritize_tasks "- [ ] Patch security vulnerability in login"
    assert_output --partial "## High Priority"
    assert_output --partial "security vulnerability"
}

@test "prioritize_tasks puts blocker tasks in high priority" {
    run prioritize_tasks "- [ ] Resolve blocker for release pipeline"
    assert_output --partial "## High Priority"
    assert_output --partial "blocker for release"
}

@test "prioritize_tasks puts important tasks in high priority" {
    run prioritize_tasks "- [ ] Implement important user validation"
    assert_output --partial "## High Priority"
    assert_output --partial "important user validation"
}

# ===========================================================================
# prioritize_tasks — low priority
# ===========================================================================

@test "prioritize_tasks puts optional tasks in low priority" {
    run prioritize_tasks "- [ ] Add optional dark mode support"
    assert_success
    assert_output --partial "## Low Priority"
    assert_output --partial "optional dark mode"
}

@test "prioritize_tasks puts nice-to-have tasks in low priority" {
    run prioritize_tasks "- [ ] Nice to have: animated transitions"
    assert_success
    assert_output --partial "## Low Priority"
    assert_output --partial "animated transitions"
}

@test "prioritize_tasks puts future tasks in low priority" {
    run prioritize_tasks "- [ ] Consider for future release"
    assert_success
    assert_output --partial "## Low Priority"
    assert_output --partial "future release"
}

# ===========================================================================
# prioritize_tasks — medium priority
# ===========================================================================

@test "prioritize_tasks puts unmarked tasks in medium priority" {
    run prioritize_tasks "- [ ] Implement search functionality"
    assert_output --partial "## Medium Priority"
    assert_output --partial "search functionality"
}

@test "prioritize_tasks outputs all three priority sections" {
    local input=$'- [ ] Fix critical login bug\n- [ ] Add search feature\n- [ ] Optional theme support'
    run prioritize_tasks "$input"
    assert_success
    assert_output --partial "## High Priority"
    assert_output --partial "## Medium Priority"
    assert_output --partial "## Low Priority"
}

@test "prioritize_tasks returns 0 for empty input" {
    run prioritize_tasks ""
    assert_success
}

# ===========================================================================
# extract_prd_tasks — checkbox format (fixture)
# ===========================================================================

@test "extract_prd_tasks extracts checkbox items from PRD" {
    run extract_prd_tasks "$FIXTURES_DIR/prd_with_checkboxes.md"
    assert_success
    assert_output --partial "Password reset flow"
    assert_output --partial "OAuth2 integration with Google"
}

@test "extract_prd_tasks unchecks completed items" {
    run extract_prd_tasks "$FIXTURES_DIR/prd_with_checkboxes.md"
    assert_success
    assert_output --partial "User authentication"
    refute_output --partial "[x]"
    refute_output --partial "[X]"
}

# ===========================================================================
# extract_prd_tasks — numbered format (fixture)
# ===========================================================================

@test "extract_prd_tasks converts numbered items to checkboxes" {
    run extract_prd_tasks "$FIXTURES_DIR/prd_with_numbered_list.md"
    assert_success
    assert_output --partial "- [ ] Set up PostgreSQL database schema"
    assert_output --partial "- [ ] Create user registration endpoint"
}

# ===========================================================================
# extract_prd_tasks — edge cases
# ===========================================================================

@test "extract_prd_tasks returns 1 for missing file" {
    run extract_prd_tasks "/nonexistent/requirements.md"
    assert_failure
}

@test "extract_prd_tasks returns 0 for file with no task-like content" {
    echo "# Project Overview" > "$_WORK_DIR/plain.md"
    echo "" >> "$_WORK_DIR/plain.md"
    echo "This project provides a weather forecasting API." >> "$_WORK_DIR/plain.md"
    run extract_prd_tasks "$_WORK_DIR/plain.md"
    assert_success
}

@test "extract_prd_tasks limits output to 30 tasks" {
    local large_prd="$_WORK_DIR/large_prd.md"
    echo "# Requirements" > "$large_prd"
    for i in $(seq 1 40); do
        echo "$i. Task number $i for the project" >> "$large_prd"
    done

    run extract_prd_tasks "$large_prd"
    assert_success
    # Count checkbox lines — should be capped at 30
    local line_count
    line_count=$(echo "$output" | grep -c '^\- \[ \]' || true)
    [[ "$line_count" -le 30 ]]
}

@test "extract_prd_tasks extracts bullet items under task headings" {
    cat > "$_WORK_DIR/headed_prd.md" << 'EOF'
# Product Requirements

## Overview
This is a web application.

## Tasks
- Set up authentication module
- Implement user profile API
- Add rate limiting to endpoints

## Non-functional Requirements
Performance should be under 200ms.
EOF

    run extract_prd_tasks "$_WORK_DIR/headed_prd.md"
    assert_success
    assert_output --partial "- [ ] Set up authentication module"
    assert_output --partial "- [ ] Implement user profile API"
    assert_output --partial "- [ ] Add rate limiting to endpoints"
}

@test "extract_prd_tasks extracts items from multiple task headings" {
    cat > "$_WORK_DIR/multi_headed.md" << 'EOF'
# Sprint Plan

## Features
- Build notification system
- Create admin dashboard

## Backlog
- Optimize database queries
- Add monitoring alerts

## Notes
Just some notes here.
EOF

    run extract_prd_tasks "$_WORK_DIR/multi_headed.md"
    assert_success
    assert_output --partial "- [ ] Build notification system"
    assert_output --partial "- [ ] Create admin dashboard"
    assert_output --partial "- [ ] Optimize database queries"
    assert_output --partial "- [ ] Add monitoring alerts"
}

@test "extract_prd_tasks deduplicates numbered items under task headings" {
    cat > "$_WORK_DIR/dedup_prd.md" << 'EOF'
# Product Requirements

## Tasks
1. Configure CI pipeline
2. Write integration tests
3. Deploy staging environment
EOF

    run extract_prd_tasks "$_WORK_DIR/dedup_prd.md"
    assert_success
    # Each item should appear exactly once despite matching both numbered and heading extractors
    local count
    count=$(echo "$output" | grep -c 'Configure CI pipeline')
    [[ "$count" -eq 1 ]]
    count=$(echo "$output" | grep -c 'Write integration tests')
    [[ "$count" -eq 1 ]]
    count=$(echo "$output" | grep -c 'Deploy staging environment')
    [[ "$count" -eq 1 ]]
}

@test "extract_prd_tasks extracts from duplicate heading names without duplicates" {
    cat > "$_WORK_DIR/dup_headings.md" << 'EOF'
# Sprint Plan

## Tasks
- Build user registration
- Set up email verification

## Design Notes
Some design context here.

## Tasks
- Implement password reset
- Add two-factor authentication
EOF

    run extract_prd_tasks "$_WORK_DIR/dup_headings.md"
    assert_success
    # All items from both sections present
    assert_output --partial "- [ ] Build user registration"
    assert_output --partial "- [ ] Set up email verification"
    assert_output --partial "- [ ] Implement password reset"
    assert_output --partial "- [ ] Add two-factor authentication"
    # Each item appears exactly once
    local count
    count=$(echo "$output" | grep -c 'Build user registration')
    [[ "$count" -eq 1 ]]
    count=$(echo "$output" | grep -c 'Implement password reset')
    [[ "$count" -eq 1 ]]
}

@test "extract_prd_tasks does not include section headings as tasks" {
    cat > "$_WORK_DIR/headings.md" << 'EOF'
# Project Plan

## TODO

- [ ] Implement login

## Requirements

Some description text.

## Features

More description.
EOF

    run extract_prd_tasks "$_WORK_DIR/headings.md"
    assert_success
    refute_output --partial "- [ ] ## TODO"
    refute_output --partial "- [ ] ## Requirements"
    refute_output --partial "- [ ] ## Features"
}

# ===========================================================================
# convert_prd_with_claude
# ===========================================================================

@test "convert_prd_with_claude returns 1 for missing file" {
    run convert_prd_with_claude "/nonexistent/prd.md"
    assert_failure
}

@test "convert_prd_with_claude falls back to basic extraction when ralph-import unavailable" {
    # Use minimal PATH that has grep/sed but not ralph-import
    run bash -c "
        export PATH='/usr/bin:/bin:/mingw64/bin'
        source '$RALPH_LIB/task_sources.sh'
        convert_prd_with_claude '$FIXTURES_DIR/prd_with_checkboxes.md'
    "
    assert_success
    assert_output --partial "- [ ]"
}

# ===========================================================================
# check_beads_available
# ===========================================================================

@test "check_beads_available returns 1 without .beads directory" {
    run check_beads_available
    assert_failure
}

@test "check_beads_available returns 1 with .beads but no bd command" {
    mkdir -p ".beads"
    run check_beads_available
    assert_failure
}

@test "check_beads_available returns 0 with .beads directory and bd command" {
    mkdir -p ".beads"
    _mock_cli bd
    run check_beads_available
    assert_success
}

# ===========================================================================
# check_github_available
# ===========================================================================

@test "check_github_available returns 1 without gh command" {
    # Ensure gh is not in PATH for this test
    run bash -c "
        export PATH='/usr/bin:/bin'
        source '$RALPH_LIB/task_sources.sh'
        check_github_available
    "
    assert_failure
}

@test "check_github_available returns 1 when gh auth fails" {
    _mock_cli gh 1
    run check_github_available
    assert_failure
}

@test "check_github_available returns 1 without GitHub remote" {
    # gh succeeds for auth but git returns non-GitHub remote
    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/gh" << 'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
    chmod +x "$RALPH_DIR/bin/gh"
    _mock_cli git 0 "https://gitlab.com/user/repo.git"

    run check_github_available
    assert_failure
}

@test "check_github_available returns 0 when all checks pass" {
    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/gh" << 'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
    chmod +x "$RALPH_DIR/bin/gh"
    _mock_cli git 0 "https://github.com/user/repo.git"

    run check_github_available
    assert_success
}

# ===========================================================================
# fetch_beads_tasks — JSON path
# ===========================================================================

@test "fetch_beads_tasks returns formatted tasks from JSON output" {
    mkdir -p ".beads"
    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/bd" << 'MOCK'
#!/usr/bin/env bash
if [[ "$*" == *"--json"* ]]; then
    cat << 'JSON'
[
  {"id": "proj-001", "title": "Set up database schema", "status": "open"},
  {"id": "proj-002", "title": "Implement REST endpoints", "status": "open"},
  {"id": "proj-003", "title": "Add authentication", "status": "closed"}
]
JSON
    exit 0
fi
exit 0
MOCK
    chmod +x "$RALPH_DIR/bin/bd"
    [[ ":$PATH:" != *":$RALPH_DIR/bin:"* ]] && export PATH="$RALPH_DIR/bin:$PATH"

    run fetch_beads_tasks
    assert_success
    assert_output --partial "- [ ] [proj-001] Set up database schema"
    assert_output --partial "- [ ] [proj-002] Implement REST endpoints"
    # closed task should be filtered out
    refute_output --partial "proj-003"
}

@test "fetch_beads_tasks returns 1 when beads unavailable" {
    # No .beads directory
    run fetch_beads_tasks
    assert_failure
}

# ===========================================================================
# fetch_github_tasks
# ===========================================================================

@test "fetch_github_tasks returns formatted issues" {
    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/gh" << 'MOCK'
#!/usr/bin/env bash
if [[ "$1" == "issue" && "$2" == "list" ]]; then
    cat << 'JSON'
[
  {"number": 42, "title": "Implement search feature", "labels": []},
  {"number": 57, "title": "Fix pagination bug", "labels": [{"name": "ralph-task"}]}
]
JSON
    exit 0
fi
# gh auth status
exit 0
MOCK
    chmod +x "$RALPH_DIR/bin/gh"
    _mock_cli git 0 "https://github.com/user/repo.git"

    run fetch_github_tasks
    assert_success
    assert_output --partial "- [ ] [#42] Implement search feature"
    assert_output --partial "- [ ] [#57] Fix pagination bug"
}

@test "fetch_github_tasks returns 1 when GitHub unavailable" {
    run fetch_github_tasks
    assert_failure
}

# ===========================================================================
# import_tasks_from_sources — combined
# ===========================================================================

@test "import_tasks_from_sources imports from PRD source" {
    local prd="$_WORK_DIR/requirements.md"
    echo "- [ ] Write API documentation" > "$prd"
    echo "- [ ] Set up monitoring alerts" >> "$prd"

    run import_tasks_from_sources "prd" "$prd"
    assert_success
    assert_output --partial "API documentation"
    assert_output --partial "monitoring alerts"
}

@test "import_tasks_from_sources returns 1 when no tasks found" {
    run import_tasks_from_sources "beads"
    assert_failure
}

@test "import_tasks_from_sources combines beads and prd sources" {
    mkdir -p ".beads"
    _mock_cli bd 0 '[{"id":"proj-001","title":"Database migration","status":"open"}]'

    local prd="$_WORK_DIR/requirements.md"
    echo "- [ ] Write API documentation" > "$prd"

    run import_tasks_from_sources "beads prd" "$prd"
    assert_success
    assert_output --partial "Database migration"
    assert_output --partial "API documentation"
}

@test "import_tasks_from_sources skips prd when file missing" {
    mkdir -p ".beads"
    _mock_cli bd 0 '[{"id":"proj-001","title":"Run integration tests","status":"open"}]'

    run import_tasks_from_sources "beads prd" "/nonexistent/prd.md"
    assert_success
    assert_output --partial "integration tests"
}

# ===========================================================================
# get_beads_count
# ===========================================================================

@test "get_beads_count returns count from mock beads" {
    mkdir -p "$_WORK_DIR/.beads"
    _mock_cli bd 0 '[{"id": 1, "status": "open"}, {"id": 2, "status": "open"}, {"id": 3, "status": "closed"}]'
    cd "$_WORK_DIR"
    run get_beads_count
    assert_success
    assert_output "2"
}

@test "get_beads_count returns 0 and fails when beads unavailable" {
    cd "$_WORK_DIR"
    # No .beads directory
    run get_beads_count
    assert_failure
    assert_output "0"
}

# ===========================================================================
# get_github_issue_count
# ===========================================================================

@test "get_github_issue_count returns count from mock gh" {
    # Create mock gh with multiple behaviors based on args
    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/gh" << 'MOCK'
#!/usr/bin/env bash
if [[ "$1" == "auth" ]]; then
    exit 0
elif [[ "$1" == "issue" ]]; then
    echo '[{"number": 1}, {"number": 2}, {"number": 3}]'
    exit 0
fi
exit 1
MOCK
    chmod +x "$RALPH_DIR/bin/gh"
    export PATH="$RALPH_DIR/bin:$PATH"

    # Mock git remote
    mkdir -p "$_WORK_DIR/.git"
    cd "$_WORK_DIR"
    git init -q
    git remote add origin https://github.com/test/repo.git

    run get_github_issue_count
    assert_success
    assert_output "3"
}

@test "get_github_issue_count returns 0 when gh unavailable" {
    cd "$_WORK_DIR"
    # No gh command in path (restore original PATH)
    PATH="$_ORIG_PATH"
    run get_github_issue_count
    assert_failure
    assert_output "0"
}

# ===========================================================================
# get_github_labels
# ===========================================================================

@test "get_github_labels returns label names from mock gh" {
    mkdir -p "$RALPH_DIR/bin"
    cat > "$RALPH_DIR/bin/gh" << 'MOCK'
#!/usr/bin/env bash
if [[ "$1" == "auth" ]]; then
    exit 0
elif [[ "$1" == "label" ]]; then
    echo -e "bug\nenhancement\ndocumentation"
    exit 0
fi
exit 1
MOCK
    chmod +x "$RALPH_DIR/bin/gh"
    export PATH="$RALPH_DIR/bin:$PATH"

    mkdir -p "$_WORK_DIR/.git"
    cd "$_WORK_DIR"
    git init -q
    git remote add origin https://github.com/test/repo.git

    run get_github_labels
    assert_success
    assert_output --partial "bug"
    assert_output --partial "enhancement"
}
