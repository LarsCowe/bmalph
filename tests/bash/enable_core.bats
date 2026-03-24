#!/usr/bin/env bats
# Tests for ralph/lib/enable_core.sh
# Validates logging, state checks, file operations, project detection,
# template generators, and the main enable_ralph_in_directory integration.

setup() {
    load 'test_helper/common-setup'
    _common_setup
    source "$RALPH_LIB/enable_core.sh"
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
# enable_log
# ===========================================================================

@test "enable_log INFO displays level prefix and message" {
    run enable_log "INFO" "Starting installation"
    assert_success
    assert_output --partial "[INFO]"
    assert_output --partial "Starting installation"
}

@test "enable_log WARN displays level prefix and message" {
    run enable_log "WARN" "Deprecated API version"
    assert_success
    assert_output --partial "[WARN]"
    assert_output --partial "Deprecated API version"
}

@test "enable_log ERROR displays level prefix and message" {
    run enable_log "ERROR" "Connection failed"
    assert_success
    assert_output --partial "[ERROR]"
    assert_output --partial "Connection failed"
}

@test "enable_log SUCCESS displays level prefix and message" {
    run enable_log "SUCCESS" "Build completed"
    assert_success
    assert_output --partial "[SUCCESS]"
    assert_output --partial "Build completed"
}

@test "enable_log without colors omits ANSI escapes" {
    ENABLE_USE_COLORS=false
    run enable_log "INFO" "Plain output"
    assert_success
    assert_output "[INFO] Plain output"
}

# ===========================================================================
# check_existing_ralph
# ===========================================================================

@test "check_existing_ralph sets none when no .ralph directory" {
    check_existing_ralph
    assert_equal "$RALPH_STATE" "none"
}

@test "check_existing_ralph returns 0 when no .ralph directory" {
    run check_existing_ralph
    assert_success
}

@test "check_existing_ralph treats empty .ralph directory as none" {
    mkdir -p ".ralph"
    check_existing_ralph
    assert_equal "$RALPH_STATE" "none"
}

@test "check_existing_ralph sets partial when some files exist" {
    mkdir -p ".ralph"
    echo "# Prompt" > ".ralph/PROMPT.md"
    # Missing @AGENT.md and @fix_plan.md

    check_existing_ralph || true
    assert_equal "$RALPH_STATE" "partial"
}

@test "check_existing_ralph returns 1 for partial state" {
    mkdir -p ".ralph"
    echo "# Prompt" > ".ralph/PROMPT.md"

    run check_existing_ralph
    assert_failure
}

@test "check_existing_ralph tracks missing files for partial state" {
    mkdir -p ".ralph"
    echo "# Prompt" > ".ralph/PROMPT.md"

    check_existing_ralph || true
    # @AGENT.md and @fix_plan.md should be in the missing list
    local missing_str="${RALPH_MISSING_FILES[*]}"
    [[ "$missing_str" == *"@AGENT.md"* ]]
    [[ "$missing_str" == *"@fix_plan.md"* ]]
}

@test "check_existing_ralph sets complete when all files exist" {
    mkdir -p ".ralph"
    echo "# Prompt" > ".ralph/PROMPT.md"
    echo "# Agent" > ".ralph/@AGENT.md"
    echo "# Fix Plan" > ".ralph/@fix_plan.md"

    check_existing_ralph || true
    assert_equal "$RALPH_STATE" "complete"
}

@test "check_existing_ralph returns 2 for complete state" {
    mkdir -p ".ralph"
    echo "# Prompt" > ".ralph/PROMPT.md"
    echo "# Agent" > ".ralph/@AGENT.md"
    echo "# Fix Plan" > ".ralph/@fix_plan.md"

    run check_existing_ralph
    assert_equal "$status" "2"
}

# ===========================================================================
# is_ralph_enabled
# ===========================================================================

@test "is_ralph_enabled returns true for complete installation" {
    mkdir -p ".ralph"
    echo "# Prompt" > ".ralph/PROMPT.md"
    echo "# Agent" > ".ralph/@AGENT.md"
    echo "# Fix Plan" > ".ralph/@fix_plan.md"

    run is_ralph_enabled
    assert_success
}

@test "is_ralph_enabled returns false when not installed" {
    run is_ralph_enabled
    assert_failure
}

@test "is_ralph_enabled returns false for partial installation" {
    mkdir -p ".ralph"
    echo "# Prompt" > ".ralph/PROMPT.md"

    run is_ralph_enabled
    assert_failure
}

# ===========================================================================
# safe_create_file
# ===========================================================================

@test "safe_create_file creates new file with content" {
    run safe_create_file "output.txt" "Hello, World!"
    assert_success

    [[ -f "output.txt" ]]
    run cat "output.txt"
    assert_output "Hello, World!"
}

@test "safe_create_file skips existing file without force" {
    echo "existing content" > "output.txt"

    run safe_create_file "output.txt" "new content"
    assert_failure

    run cat "output.txt"
    assert_output "existing content"
}

@test "safe_create_file overwrites with ENABLE_FORCE" {
    echo "existing content" > "output.txt"

    export ENABLE_FORCE=true
    run safe_create_file "output.txt" "new content"
    assert_success

    run cat "output.txt"
    assert_output "new content"
}

@test "safe_create_file creates parent directories" {
    run safe_create_file "deep/nested/dir/output.txt" "nested content"
    assert_success

    [[ -f "deep/nested/dir/output.txt" ]]
    run cat "deep/nested/dir/output.txt"
    assert_output "nested content"
}

@test "safe_create_file handles path with spaces" {
    run safe_create_file "sub dir/output file.txt" "spaced content"
    assert_success

    [[ -f "sub dir/output file.txt" ]]
    run cat "sub dir/output file.txt"
    assert_output "spaced content"
}

@test "safe_create_file creates file with empty content" {
    run safe_create_file "empty.txt" ""
    assert_success

    [[ -f "empty.txt" ]]
}

@test "safe_create_file logs CREATE on new file" {
    run safe_create_file "new.txt" "content"
    assert_success
    assert_output --partial "Created"
}

@test "safe_create_file logs SKIP on existing file" {
    echo "old" > "existing.txt"
    run safe_create_file "existing.txt" "new"
    assert_output --partial "already exists"
}

@test "safe_create_file logs OVERWRITE with force" {
    echo "old" > "overwrite.txt"
    export ENABLE_FORCE=true
    run safe_create_file "overwrite.txt" "new"
    assert_success
    assert_output --partial "Overwrote"
}

# ===========================================================================
# safe_create_dir
# ===========================================================================

@test "safe_create_dir creates new directory" {
    run safe_create_dir "new-dir"
    assert_success
    [[ -d "new-dir" ]]
}

@test "safe_create_dir succeeds for existing directory" {
    mkdir "existing-dir"
    run safe_create_dir "existing-dir"
    assert_success
}

@test "safe_create_dir creates nested directories" {
    run safe_create_dir "parent/child/grandchild"
    assert_success
    [[ -d "parent/child/grandchild" ]]
}

# ===========================================================================
# create_ralph_structure
# ===========================================================================

@test "create_ralph_structure creates all required directories" {
    run create_ralph_structure
    assert_success
    [[ -d ".ralph" ]]
    [[ -d ".ralph/specs" ]]
    [[ -d ".ralph/examples" ]]
    [[ -d ".ralph/logs" ]]
    [[ -d ".ralph/docs/generated" ]]
}

# ===========================================================================
# detect_project_context — JavaScript / TypeScript
# ===========================================================================

@test "detect_project_context detects TypeScript from tsconfig.json" {
    echo '{"name": "weather-api"}' > package.json
    touch tsconfig.json

    detect_project_context

    assert_equal "$DETECTED_PROJECT_TYPE" "typescript"
    assert_equal "$DETECTED_PROJECT_NAME" "weather-api"
}

@test "detect_project_context detects JavaScript without tsconfig" {
    echo '{"name": "simple-server"}' > package.json

    detect_project_context

    assert_equal "$DETECTED_PROJECT_TYPE" "javascript"
    assert_equal "$DETECTED_PROJECT_NAME" "simple-server"
}

@test "detect_project_context detects TypeScript from package.json dependency" {
    echo '{"name": "typed-app", "dependencies": {"typescript": "^5.3"}}' > package.json

    detect_project_context

    assert_equal "$DETECTED_PROJECT_TYPE" "typescript"
}

@test "detect_project_context detects Next.js framework" {
    echo '{"name": "nextjs-app", "dependencies": {"next": "^14.0"}}' > package.json

    detect_project_context

    assert_equal "$DETECTED_FRAMEWORK" "nextjs"
}

@test "detect_project_context detects Express framework" {
    echo '{"name": "api-server", "dependencies": {"express": "^4.18"}}' > package.json

    detect_project_context

    assert_equal "$DETECTED_FRAMEWORK" "express"
}

@test "detect_project_context detects React framework" {
    echo '{"name": "frontend", "dependencies": {"react": "^18.2"}}' > package.json

    detect_project_context

    assert_equal "$DETECTED_FRAMEWORK" "react"
}

@test "detect_project_context sets npm commands by default" {
    echo '{"name": "npm-project"}' > package.json

    detect_project_context

    assert_equal "$DETECTED_BUILD_CMD" "npm run build"
    assert_equal "$DETECTED_TEST_CMD" "npm test"
    assert_equal "$DETECTED_RUN_CMD" "npm start"
}

@test "detect_project_context detects yarn from lock file" {
    echo '{"name": "yarn-project"}' > package.json
    touch yarn.lock

    detect_project_context

    assert_equal "$DETECTED_BUILD_CMD" "yarn build"
    assert_equal "$DETECTED_TEST_CMD" "yarn test"
}

@test "detect_project_context detects pnpm from lock file" {
    echo '{"name": "pnpm-project"}' > package.json
    touch pnpm-lock.yaml

    detect_project_context

    assert_equal "$DETECTED_BUILD_CMD" "pnpm build"
    assert_equal "$DETECTED_TEST_CMD" "pnpm test"
}

# ===========================================================================
# detect_project_context — Python
# ===========================================================================

@test "detect_project_context detects Python from pyproject.toml" {
    cat > pyproject.toml << 'EOF'
[project]
name = "forecast-service"
EOF

    detect_project_context

    assert_equal "$DETECTED_PROJECT_TYPE" "python"
    assert_equal "$DETECTED_PROJECT_NAME" "forecast-service"
}

@test "detect_project_context detects FastAPI framework" {
    cat > pyproject.toml << 'EOF'
[project]
name = "api"
dependencies = ["fastapi>=0.100"]
EOF

    detect_project_context

    assert_equal "$DETECTED_FRAMEWORK" "fastapi"
}

@test "detect_project_context: JS/TS takes precedence when both package.json and pyproject.toml exist" {
    # Monorepo scenario: Next.js frontend with Python API
    echo '{"name": "fullstack-app", "dependencies": {"next": "14.0.0"}}' > package.json
    echo '{}' > tsconfig.json
    cat > pyproject.toml << 'TOML'
[project]
name = "api-service"
dependencies = ["fastapi"]
TOML

    detect_project_context

    # JS/TS detected first should not be overwritten by Python
    assert_equal "$DETECTED_PROJECT_TYPE" "typescript"
}

# ===========================================================================
# detect_project_context — Rust / Go / unknown
# ===========================================================================

@test "detect_project_context detects Rust from Cargo.toml" {
    cat > Cargo.toml << 'EOF'
[package]
name = "weather-cli"
version = "0.1.0"
EOF

    detect_project_context

    assert_equal "$DETECTED_PROJECT_TYPE" "rust"
    assert_equal "$DETECTED_PROJECT_NAME" "weather-cli"
    assert_equal "$DETECTED_BUILD_CMD" "cargo build"
    assert_equal "$DETECTED_TEST_CMD" "cargo test"
}

@test "detect_project_context detects Go from go.mod" {
    echo "module github.com/user/weather-service" > go.mod

    detect_project_context

    assert_equal "$DETECTED_PROJECT_TYPE" "go"
    assert_equal "$DETECTED_BUILD_CMD" "go build"
    assert_equal "$DETECTED_TEST_CMD" "go test ./..."
}

@test "detect_project_context falls back to unknown with no markers" {
    detect_project_context

    assert_equal "$DETECTED_PROJECT_TYPE" "unknown"
}

@test "detect_project_context falls back to folder name when no project name found" {
    detect_project_context

    local folder_name
    folder_name=$(basename "$_WORK_DIR")
    assert_equal "$DETECTED_PROJECT_NAME" "$folder_name"
}

# ===========================================================================
# detect_git_info
# ===========================================================================

@test "detect_git_info detects git repository" {
    git init > /dev/null 2>&1

    detect_git_info

    assert_equal "$DETECTED_GIT_REPO" "true"
}

@test "detect_git_info sets false outside git repository" {
    detect_git_info

    assert_equal "$DETECTED_GIT_REPO" "false"
}

@test "detect_git_info detects GitHub remote" {
    git init > /dev/null 2>&1
    git remote add origin "https://github.com/user/weather-api.git" 2>/dev/null

    detect_git_info

    assert_equal "$DETECTED_GIT_GITHUB" "true"
    assert_equal "$DETECTED_GIT_REMOTE" "https://github.com/user/weather-api.git"
}

@test "detect_git_info sets github false for non-GitHub remote" {
    git init > /dev/null 2>&1
    git remote add origin "https://gitlab.com/user/repo.git" 2>/dev/null

    detect_git_info

    assert_equal "$DETECTED_GIT_GITHUB" "false"
}

# ===========================================================================
# detect_task_sources
# ===========================================================================

@test "detect_task_sources detects .beads directory" {
    mkdir -p ".beads"

    detect_task_sources

    assert_equal "$DETECTED_BEADS_AVAILABLE" "true"
}

@test "detect_task_sources sets beads false without .beads" {
    detect_task_sources

    assert_equal "$DETECTED_BEADS_AVAILABLE" "false"
}

@test "detect_task_sources finds PRD files in docs directory" {
    mkdir -p docs
    echo "# PRD" > "docs/project-prd.md"

    detect_task_sources

    [[ "${#DETECTED_PRD_FILES[@]}" -ge 1 ]]
    local found_files="${DETECTED_PRD_FILES[*]}"
    [[ "$found_files" == *"prd"* ]]
}

# ===========================================================================
# generate_prompt_md
# ===========================================================================

@test "generate_prompt_md includes project name and type" {
    run generate_prompt_md "weather-api" "typescript" "nextjs"
    assert_success
    assert_output --partial "weather-api"
    assert_output --partial "typescript"
    assert_output --partial "nextjs"
}

@test "generate_prompt_md includes default objectives without custom" {
    run generate_prompt_md "my-app" "javascript"
    assert_success
    assert_output --partial "Review the codebase"
    assert_output --partial "Follow tasks in @fix_plan.md"
}

@test "generate_prompt_md includes custom objectives when provided" {
    local objectives="- Build REST API endpoints
- Add JWT authentication"
    run generate_prompt_md "my-app" "python" "" "$objectives"
    assert_success
    assert_output --partial "Build REST API endpoints"
    assert_output --partial "JWT authentication"
}

# ===========================================================================
# generate_agent_md
# ===========================================================================

@test "generate_agent_md includes build commands" {
    run generate_agent_md "npm run build" "npm test" "npm start"
    assert_success
    assert_output --partial "npm run build"
    assert_output --partial "npm test"
    assert_output --partial "npm start"
}

# ===========================================================================
# generate_fix_plan_md
# ===========================================================================

@test "generate_fix_plan_md includes provided tasks in high priority" {
    local tasks="- [ ] Implement user search
- [ ] Add pagination to results"
    run generate_fix_plan_md "$tasks"
    assert_success
    assert_output --partial "## High Priority"
    assert_output --partial "Implement user search"
    assert_output --partial "Add pagination"
}

@test "generate_fix_plan_md uses defaults when no tasks provided" {
    run generate_fix_plan_md
    assert_success
    assert_output --partial "Review codebase and understand architecture"
}

# ===========================================================================
# generate_ralphrc
# ===========================================================================

@test "generate_ralphrc includes project configuration" {
    run generate_ralphrc "weather-api" "typescript" "beads,local"
    assert_success
    assert_output --partial 'PROJECT_NAME="weather-api"'
    assert_output --partial 'PROJECT_TYPE="typescript"'
    assert_output --partial 'TASK_SOURCES="beads,local"'
}

# ===========================================================================
# enable_ralph_in_directory — integration
# ===========================================================================

@test "enable_ralph_in_directory creates complete .ralph structure and files" {
    run enable_ralph_in_directory
    assert_success

    [[ -d ".ralph" ]]
    [[ -d ".ralph/specs" ]]
    [[ -d ".ralph/logs" ]]
    [[ -f ".ralph/PROMPT.md" ]]
    [[ -f ".ralph/@AGENT.md" ]]
    [[ -f ".ralph/@fix_plan.md" ]]
    [[ -f ".ralphrc" ]]
}

@test "enable_ralph_in_directory returns ENABLE_ALREADY_ENABLED when complete" {
    mkdir -p ".ralph"
    echo "# Prompt" > ".ralph/PROMPT.md"
    echo "# Agent" > ".ralph/@AGENT.md"
    echo "# Fix Plan" > ".ralph/@fix_plan.md"

    run enable_ralph_in_directory
    assert_equal "$status" "2"
    assert_output --partial "already enabled"
}

@test "enable_ralph_in_directory with force overwrites existing installation" {
    # Initial installation
    run enable_ralph_in_directory
    assert_success

    # Overwrite with force
    export ENABLE_FORCE=true
    run enable_ralph_in_directory
    assert_success
    assert_output --partial "Overwrote"
}

@test "enable_ralph_in_directory uses custom project name" {
    export ENABLE_PROJECT_NAME="custom-weather-app"
    run enable_ralph_in_directory
    assert_success

    run grep "custom-weather-app" ".ralph/PROMPT.md"
    assert_success
}
