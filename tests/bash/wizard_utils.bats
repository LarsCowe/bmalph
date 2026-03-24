#!/usr/bin/env bats
# Tests for ralph/lib/wizard_utils.sh
# Validates display functions, interactive prompts, and selection menus.

setup() {
    load 'test_helper/common-setup'
    _common_setup
    source "$RALPH_LIB/wizard_utils.sh"
}

teardown() {
    _common_teardown
}

# ===========================================================================
# print_header
# ===========================================================================

@test "print_header displays title text" {
    run print_header "Installation"
    assert_success
    assert_output --partial "Installation"
}

@test "print_header displays phase when provided" {
    run print_header "Configuration" "2 of 5"
    assert_success
    assert_output --partial "Configuration"
    assert_output --partial "2 of 5"
}

@test "print_header displays separator lines" {
    run print_header "Setup"
    assert_success
    assert_output --partial "━━━━"
}

# ===========================================================================
# print_bullet
# ===========================================================================

@test "print_bullet displays text with default bullet symbol" {
    run print_bullet "Install dependencies"
    assert_success
    assert_output --partial "Install dependencies"
}

@test "print_bullet uses custom symbol when provided" {
    run print_bullet "Running tests" "→"
    assert_success
    assert_output --partial "→"
    assert_output --partial "Running tests"
}

# ===========================================================================
# print_success / print_warning / print_error / print_info
# ===========================================================================

@test "print_success displays message with checkmark" {
    run print_success "Build completed"
    assert_success
    assert_output --partial "✓"
    assert_output --partial "Build completed"
}

@test "print_warning displays message with warning symbol" {
    run print_warning "Deprecated API detected"
    assert_success
    assert_output --partial "⚠"
    assert_output --partial "Deprecated API detected"
}

@test "print_error displays message with cross symbol" {
    run print_error "Connection refused"
    assert_success
    assert_output --partial "✗"
    assert_output --partial "Connection refused"
}

@test "print_info displays message with info symbol" {
    run print_info "Using default configuration"
    assert_success
    assert_output --partial "ℹ"
    assert_output --partial "Using default configuration"
}

# ===========================================================================
# print_detection_result
# ===========================================================================

@test "print_detection_result shows available item with checkmark" {
    run print_detection_result "Framework" "Next.js" "true"
    assert_success
    assert_output --partial "✓"
    assert_output --partial "Framework"
    assert_output --partial "Next.js"
}

@test "print_detection_result shows unavailable item with circle" {
    run print_detection_result "Docker" "not found" "false"
    assert_success
    assert_output --partial "○"
    assert_output --partial "Docker"
    assert_output --partial "not found"
}

@test "print_detection_result defaults to available when third arg omitted" {
    run print_detection_result "Node.js" "v20.11.0"
    assert_success
    assert_output --partial "✓"
    assert_output --partial "Node.js"
}

# ===========================================================================
# show_progress
# ===========================================================================

@test "show_progress handles zero total without error" {
    run show_progress 0 0 "Initializing"
    assert_success
}

@test "show_progress handles negative total without error" {
    run show_progress 0 -1 "Initializing"
    assert_success
}

@test "show_progress displays current step and message" {
    run show_progress 3 10 "Installing packages"
    assert_success
    assert_output --partial "3/10"
    assert_output --partial "Installing packages"
}

@test "show_progress at completion shows filled bar characters" {
    run show_progress 5 5 "Done"
    assert_success
    assert_output --partial "5/5"
    assert_output --partial "█"
}

# ===========================================================================
# clear_line
# ===========================================================================

@test "clear_line outputs carriage return escape" {
    run clear_line
    assert_success
    # Output contains carriage return for cursor reset
    assert_output --partial $'\r'
}

# ===========================================================================
# print_summary
# ===========================================================================

@test "print_summary displays title and key-value items" {
    run print_summary "Project Configuration" "Name=weather-api" "Type=typescript"
    assert_success
    assert_output --partial "Project Configuration"
    assert_output --partial "Name:"
    assert_output --partial "weather-api"
    assert_output --partial "Type:"
    assert_output --partial "typescript"
}

@test "print_summary displays box borders" {
    run print_summary "Summary" "Status=enabled"
    assert_success
    assert_output --partial "┌─"
    assert_output --partial "└─"
}

@test "print_summary handles multiple items" {
    run print_summary "Metrics" "Tasks=15" "Coverage=87%" "Loops=3"
    assert_success
    assert_output --partial "Tasks:"
    assert_output --partial "15"
    assert_output --partial "Coverage:"
    assert_output --partial "87%"
    assert_output --partial "Loops:"
    assert_output --partial "3"
}

# ===========================================================================
# confirm
# ===========================================================================

@test "confirm returns 0 for y input" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo 'y' | confirm 'Continue?'"
    assert_success
}

@test "confirm returns 0 for yes input" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo 'yes' | confirm 'Continue?'"
    assert_success
}

@test "confirm returns 1 for n input" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo 'n' | confirm 'Continue?'"
    assert_failure
}

@test "confirm returns 1 for no input" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo 'no' | confirm 'Continue?'"
    assert_failure
}

@test "confirm uses default n on empty input" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '' | confirm 'Continue?'"
    assert_failure
}

@test "confirm uses default y when configured and input is empty" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '' | confirm 'Continue?' 'y'"
    assert_success
}

@test "confirm is case insensitive" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo 'Y' | confirm 'Continue?'"
    assert_success
}

@test "confirm accepts YES in all caps" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo 'YES' | confirm 'Continue?'"
    assert_success
}

@test "confirm rejects invalid input then accepts valid" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; printf 'maybe\ny\n' | confirm 'Continue?'"
    assert_success
}

# ===========================================================================
# prompt_text
# ===========================================================================

@test "prompt_text returns user input" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo 'weather-api' | prompt_text 'Project name' 2>/dev/null"
    assert_output "weather-api"
}

@test "prompt_text returns default when input is empty" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '' | prompt_text 'Project name' 'my-project' 2>/dev/null"
    assert_output "my-project"
}

@test "prompt_text returns empty string without default on empty input" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '' | prompt_text 'Project name' 2>/dev/null"
    assert_output ""
}

# ===========================================================================
# prompt_number
# ===========================================================================

@test "prompt_number returns valid numeric input" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '42' | prompt_number 'Max retries' 2>/dev/null"
    assert_output "42"
}

@test "prompt_number returns default when input is empty" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '' | prompt_number 'Max retries' '10' 2>/dev/null"
    assert_output "10"
}

@test "prompt_number rejects non-numeric then accepts valid" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; printf 'abc\n5\n' | prompt_number 'Port' 2>/dev/null"
    assert_output "5"
}

@test "prompt_number rejects below minimum then accepts in-range value" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; printf '0\n5\n' | prompt_number 'Port' '' '1' '100' 2>/dev/null"
    assert_output "5"
}

@test "prompt_number rejects above maximum then accepts in-range value" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; printf '200\n50\n' | prompt_number 'Port' '' '1' '100' 2>/dev/null"
    assert_output "50"
}

# ===========================================================================
# select_option
# ===========================================================================

@test "select_option returns selected option text by number" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '2' | select_option 'Select package manager' 'npm' 'yarn' 'pnpm' 2>/dev/null"
    assert_output "yarn"
}

@test "select_option returns first option for input 1" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '1' | select_option 'Select language' 'TypeScript' 'Python' 'Rust' 2>/dev/null"
    assert_output "TypeScript"
}

@test "select_option returns empty and fails with no options" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '' | select_option 'Select something' 2>/dev/null"
    assert_failure
    assert_output ""
}

@test "select_option rejects out-of-range then accepts valid" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; printf '5\n1\n' | select_option 'Pick one' 'alpha' 'beta' 2>/dev/null"
    assert_output "alpha"
}

# ===========================================================================
# select_with_default
# ===========================================================================

@test "select_with_default returns explicitly chosen option" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '3' | select_with_default 'Framework' 1 'Next.js' 'Express' 'FastAPI' 2>/dev/null"
    assert_output "FastAPI"
}

@test "select_with_default returns default option on empty input" {
    run bash -c "source '$RALPH_LIB/wizard_utils.sh'; echo '' | select_with_default 'Framework' 2 'Next.js' 'Express' 'FastAPI' 2>/dev/null"
    assert_output "Express"
}
