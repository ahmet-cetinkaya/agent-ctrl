#!/bin/bash

# format.sh - Project formatting utility
# Formats all project files using appropriate formatters
# Uses acore logger for consistent output

set -e

# Get script and project directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ACORE_SCRIPTS_DIR="$PROJECT_ROOT/packages/acore-scripts/src"

# Source acore logger utilities
# shellcheck source=/dev/null
source "$ACORE_SCRIPTS_DIR/logger.sh"

# Source acore format scripts if available
# shellcheck source=/dev/null
if [[ -f "$ACORE_SCRIPTS_DIR/format_sh.sh" ]]; then
  source "$ACORE_SCRIPTS_DIR/format_sh.sh"
fi

# Configuration
TARGET_DIR="${TARGET_DIR:-$PROJECT_ROOT}"
VERBOSE="${VERBOSE:-false}"
CHECK_ONLY="${CHECK_ONLY:-false}"

# Function to check if command exists
acore_command_exists() {
  command -v "$1" > /dev/null 2>&1
}

# Function to format shell scripts
acore_format_shell_scripts() {
  acore_log_section "Shell Scripts"

  if [[ -f "$ACORE_SCRIPTS_DIR/format_sh.sh" ]]; then
    TARGET_DIR="$TARGET_DIR" \
      VERBOSE="$VERBOSE" \
      CHECK_ONLY="$CHECK_ONLY" \
      acore_sh_format_all
  else
    acore_log_warning "Shell script formatter not available"
    return 1
  fi
}

# Function to format TypeScript/JavaScript files
acore_format_typescript() {
  acore_log_section "TypeScript/JavaScript"

  # Check for formatters in order of preference
  if acore_command_exists biome; then
    acore_log_info "Using Biome formatter"

    local biome_opts=(--write)
    if [[ "$CHECK_ONLY" == "true" ]]; then
      biome_opts=(--check)
    fi

    if biome "${biome_opts[@]}" "$TARGET_DIR/src" "$TARGET_DIR/scripts" 2> /dev/null; then
      acore_log_success "TypeScript/JavaScript files formatted"
    else
      local exit_code=$?
      if [[ "$CHECK_ONLY" == "true" ]] && [[ $exit_code -ne 0 ]]; then
        acore_log_warning "Some files need formatting"
      fi
      return $exit_code
    fi

  elif acore_command_exists prettier; then
    acore_log_info "Using Prettier formatter"

    local prettier_opts=(--write)
    if [[ "$CHECK_ONLY" == "true" ]]; then
      prettier_opts=(--check)
    fi

    local ts_files
    mapfile -t ts_files < <(find "$TARGET_DIR/src" "$TARGET_DIR/scripts" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -not -path "*/.serena/*" \
      -not -path "*/packages/*" 2> /dev/null)

    if [[ ${#ts_files[@]} -eq 0 ]]; then
      acore_log_info "No TypeScript/JavaScript files found"
      return 0
    fi

    if prettier "${prettier_opts[@]}" "${ts_files[@]}" 2> /dev/null; then
      acore_log_success "TypeScript/JavaScript files formatted"
    else
      local exit_code=$?
      if [[ "$CHECK_ONLY" == "true" ]] && [[ $exit_code -ne 0 ]]; then
        acore_log_warning "Some files need formatting"
      fi
      return $exit_code
    fi

  elif acore_command_exists eslint; then
    acore_log_info "Using ESLint formatter"

    local eslint_opts=(--fix)
    if [[ "$CHECK_ONLY" == "true" ]]; then
      eslint_opts=()
    fi

    if eslint "${eslint_opts[@]}" "$TARGET_DIR/src" 2> /dev/null; then
      acore_log_success "TypeScript/JavaScript files formatted"
    else
      local exit_code=$?
      if [[ "$CHECK_ONLY" == "true" ]] && [[ $exit_code -ne 0 ]]; then
        acore_log_warning "Some files need formatting"
      fi
      return $exit_code
    fi

  else
    acore_log_warning "No TypeScript/JavaScript formatter found"
    acore_log_info "Install one of: biome, prettier, or eslint"
    return 1
  fi
}

# Function to format markdown files
acore_format_markdown() {
  acore_log_section "Markdown"

  # Check for markdown formatters
  if acore_command_exists prettier; then
    acore_log_info "Using Prettier for Markdown"

    local prettier_opts=(--write)
    if [[ "$CHECK_ONLY" == "true" ]]; then
      prettier_opts=(--check)
    fi

    local md_files
    mapfile -t md_files < <(find "$TARGET_DIR" -type f -name "*.md" \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -not -path "*/.serena/*" \
      -not -path "*/packages/*" 2> /dev/null)

    if [[ ${#md_files[@]} -eq 0 ]]; then
      acore_log_info "No Markdown files found"
      return 0
    fi

    if prettier "${prettier_opts[@]}" "${md_files[@]}" 2> /dev/null; then
      acore_log_success "Markdown files formatted"
    else
      local exit_code=$?
      if [[ "$CHECK_ONLY" == "true" ]] && [[ $exit_code -ne 0 ]]; then
        acore_log_warning "Some files need formatting"
      fi
      return $exit_code
    fi

  elif acore_command_exists mdformat; then
    acore_log_info "Using mdformat"

    local mdformat_opts=()
    if [[ "$CHECK_ONLY" == "true" ]]; then
      mdformat_opts=(--check)
    fi

    if mdformat "${mdformat_opts[@]}" "$TARGET_DIR" 2> /dev/null; then
      acore_log_success "Markdown files formatted"
    else
      local exit_code=$?
      if [[ "$CHECK_ONLY" == "true" ]] && [[ $exit_code -ne 0 ]]; then
        acore_log_warning "Some files need formatting"
      fi
      return $exit_code
    fi

  elif [[ -f "$ACORE_SCRIPTS_DIR/format_md.sh" ]]; then
    acore_log_info "Using acore markdown formatter"
    # Source and run the acore markdown formatter
    # shellcheck source=/dev/null
    source "$ACORE_SCRIPTS_DIR/format_md.sh"
  else
    acore_log_warning "No Markdown formatter found"
    return 1
  fi
}

# Function to format YAML files
acore_format_yaml() {
  acore_log_section "YAML"

  if acore_command_exists prettier; then
    acore_log_info "Using Prettier for YAML"

    local prettier_opts=(--write)
    if [[ "$CHECK_ONLY" == "true" ]]; then
      prettier_opts=(--check)
    fi

    local yaml_files
    mapfile -t yaml_files < <(find "$TARGET_DIR" -type f \( -name "*.yaml" -o -name "*.yml" \) \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -not -path "*/.serena/*" \
      -not -path "*/packages/*" 2> /dev/null)

    if [[ ${#yaml_files[@]} -eq 0 ]]; then
      acore_log_info "No YAML files found"
      return 0
    fi

    if prettier "${prettier_opts[@]}" "${yaml_files[@]}" 2> /dev/null; then
      acore_log_success "YAML files formatted"
    else
      local exit_code=$?
      if [[ "$CHECK_ONLY" == "true" ]] && [[ $exit_code -ne 0 ]]; then
        acore_log_warning "Some files need formatting"
      fi
      return $exit_code
    fi

  elif acore_command_exists yamllint; then
    acore_log_info "Using yamllint (check-only)"

    if yamllint -d relaxed "$TARGET_DIR" 2> /dev/null; then
      acore_log_success "YAML files are valid"
    else
      local exit_code=$?
      acore_log_warning "Some YAML files have issues"
      return $exit_code
    fi

  elif [[ -f "$ACORE_SCRIPTS_DIR/format_yaml.sh" ]]; then
    acore_log_info "Using acore YAML formatter"
    # shellcheck source=/dev/null
    source "$ACORE_SCRIPTS_DIR/format_yaml.sh"
  else
    acore_log_warning "No YAML formatter found"
    return 1
  fi
}

# Function to format JSON files
acore_format_json() {
  acore_log_section "JSON"

  if acore_command_exists prettier; then
    acore_log_info "Using Prettier for JSON"

    local prettier_opts=(--write)
    if [[ "$CHECK_ONLY" == "true" ]]; then
      prettier_opts=(--check)
    fi

    local json_files
    mapfile -t json_files < <(find "$TARGET_DIR" -type f -name "*.json" \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -not -path "*/.serena/*" \
      -not -path "*/packages/*" 2> /dev/null)

    if [[ ${#json_files[@]} -eq 0 ]]; then
      acore_log_info "No JSON files found"
      return 0
    fi

    if prettier "${prettier_opts[@]}" "${json_files[@]}" 2> /dev/null; then
      acore_log_success "JSON files formatted"
    else
      local exit_code=$?
      if [[ "$CHECK_ONLY" == "true" ]] && [[ $exit_code -ne 0 ]]; then
        acore_log_warning "Some JSON files need formatting"
      fi
      return $exit_code
    fi

  elif command -v jq > /dev/null 2>&1; then
    acore_log_info "Using jq for JSON formatting (fallback)"

    local json_files
    mapfile -t json_files < <(find "$TARGET_DIR" -type f -name "*.json" \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -not -path "*/packages/*" 2> /dev/null)

    local exit_code=0
    for file in "${json_files[@]}"; do
      if jq '.' "$file" > /tmp/json_format_tmp.$$ 2> /dev/null; then
        if [[ "$CHECK_ONLY" == "false" ]]; then
          mv /tmp/json_format_tmp.$$ "$file"
        else
          rm -f /tmp/json_format_tmp.$$
        fi
        [[ "$VERBOSE" == "true" ]] && acore_log_success "Formatted: $file"
      else
        acore_log_warning "Invalid JSON: $file"
        rm -f /tmp/json_format_tmp.$$
        exit_code=1
      fi
    done

    return $exit_code
  else
    acore_log_warning "No JSON formatter found"
    acore_log_info "Install: prettier or jq"
    return 1
  fi
}

# Main formatting function
acore_format_all() {
  acore_log_header "Project Formatter" "="

  local overall_exit_code=0
  local formatter_failed=0

  # Format shell scripts
  if ! acore_format_shell_scripts; then
    overall_exit_code=1
    formatter_failed=1
  fi

  # Format TypeScript/JavaScript
  if acore_format_typescript; then
    : # Success
  else
    overall_exit_code=1
    formatter_failed=1
  fi

  # Format Markdown
  if acore_format_markdown; then
    : # Success
  else
    overall_exit_code=1
    formatter_failed=1
  fi

  # Format YAML
  if acore_format_yaml; then
    : # Success
  else
    overall_exit_code=1
    formatter_failed=1
  fi

  # Format JSON
  if acore_format_json; then
    : # Success
  else
    overall_exit_code=1
    formatter_failed=1
  fi

  acore_log_divider

  # Final summary
  if [[ $formatter_failed -eq 0 ]]; then
    acore_log_success "All formatters completed successfully"
  elif [[ "$CHECK_ONLY" == "true" ]]; then
    acore_log_warning "Formatting check completed with issues"
  else
    acore_log_warning "Formatting completed with some issues"
  fi

  return $overall_exit_code
}

# Show usage
acore_format_show_help() {
  cat << EOF
Usage: format.sh [OPTIONS]

Project formatting utility using acore logger.

Options:
  -c, --check      Check only, don't modify files
  -v, --verbose    Show detailed output
  -d, --dir DIR    Target directory (default: project root)
  -h, --help       Show this help message

Environment Variables:
  TARGET_DIR       Target directory to format
  VERBOSE          Enable verbose output
  CHECK_ONLY       Enable check-only mode

Examples:
  ./scripts/format.sh                 # Format all files
  ./scripts/format.sh --check         # Check if files need formatting
  ./scripts/format.sh --verbose       # Show detailed output
  CHECK_ONLY=true ./scripts/format.sh # Alternative syntax

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -c | --check)
      CHECK_ONLY=true
      shift
      ;;
    -v | --verbose)
      VERBOSE=true
      shift
      ;;
    -d | --dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    -h | --help)
      acore_format_show_help
      exit 0
      ;;
    *)
      acore_log_error "Unknown option: $1"
      acore_format_show_help
      exit 1
      ;;
  esac
done

# Run main function
acore_format_all
exit $?
