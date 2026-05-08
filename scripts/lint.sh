#!/bin/bash

# lint.sh - Project linting utility
# Runs TypeScript check first, then ESLint

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ACORE_SCRIPTS_DIR="$PROJECT_ROOT/packages/acore-scripts/src"

# shellcheck source=/dev/null
source "$ACORE_SCRIPTS_DIR/logger.sh"

TARGET_DIR="${TARGET_DIR:-$PROJECT_ROOT}"
FIX="${FIX:-false}"

show_help() {
	cat <<EOF
Usage: lint.sh [OPTIONS]

Options:
  --fix         Automatically fix ESLint issues
  -h, --help    Show this help

EOF
}

while [[ $# -gt 0 ]]; do
	case $1 in
	--fix)
		FIX=true
		shift
		;;
	-h | --help)
		show_help
		exit 0
		;;
	*)
		acore_log_error "Unknown option: $1"
		show_help
		exit 1
		;;
	esac
done

acore_log_header "Project Linter" "="

acore_log_section "TypeScript"
tsc --noEmit
acore_log_success "TypeScript check passed"

acore_log_section "ESLint"
if [[ "$FIX" == "true" ]]; then
	eslint "$TARGET_DIR" --fix
else
	eslint "$TARGET_DIR"
fi
acore_log_success "ESLint check passed"

acore_log_section "ShellCheck"
shellcheck "$SCRIPT_DIR"/*.sh
acore_log_success "ShellCheck passed"

acore_log_divider
acore_log_success "All linting passed"
