#!/bin/bash
set -e

# Directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACORE_SCRIPTS_DIR="$PROJECT_ROOT/packages/acore-scripts/src"

# Source logger for consistent output
# shellcheck source=/dev/null
source "$ACORE_SCRIPTS_DIR/logger.sh"

# Configuration
MODE="--write"

# Execute
acore_log_section "✨ Running Prettier..."
bun x prettier $MODE . \
	--ignore-path "$PROJECT_ROOT/.prettierignore" \
	--log-level warn

if command -v shfmt >/dev/null 2>&1; then
	acore_log_section "🐚 Running shfmt..."
	find . -type f \( -name "*.sh" -o -name "*.bash" \) -not -path "*/node_modules/*" -exec shfmt -w {} +
fi

acore_log_success "✅ Formatting successfully."
