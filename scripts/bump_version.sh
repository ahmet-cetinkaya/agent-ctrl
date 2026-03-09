#!/bin/bash

# bump_version.sh - Semantic version bump utility
# Bumps the version in package.json following semantic versioning
# Also generates changelog before bumping

set -e

# Get script and project directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_JSON="$PROJECT_ROOT/package.json"
CHANGELOG_SCRIPT="$PROJECT_ROOT/packages/acore-scripts/src/generate_changelog.sh"

# Get current version
get_current_version() {
  grep '"version"' "$PACKAGE_JSON" | head -1 | sed -E 's/.*"version": "(.*)".*/\1/'
}

# Update version in package.json
update_version() {
  local new_version="$1"
  sed -i "s/\"version\": \".*\"/\"version\": \"$new_version\"/" "$PACKAGE_JSON"
}

# Generate changelog
generate_changelog() {
  local version="$1"
  if [ -f "$CHANGELOG_SCRIPT" ]; then
    echo "Generating changelog for version $version..."
    bash "$CHANGELOG_SCRIPT" "$version" -y
  else
    echo "Warning: Changelog script not found at $CHANGELOG_SCRIPT"
  fi
}

# Show usage
show_help() {
  cat << EOF
bump_version.sh - Semantic version bump utility

Usage: bump_version.sh [TYPE]

Bumps the version in package.json following semantic versioning.
Also generates changelog before bumping the version.

Arguments:
  TYPE    Version bump type: patch, minor, or major (default: patch)

Examples:
  bump_version.sh           # Bump patch version (1.0.0 -> 1.0.1)
  bump_version.sh minor    # Bump minor version (1.0.0 -> 1.1.0)
  bump_version.sh major    # Bump major version (1.0.0 -> 2.0.0)

EOF
}

# Ask for confirmation
ask_confirmation() {
  local message="$1"
  read -r -p "$message [y/N]: " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 0
  fi
}

# Main logic
BUMP_TYPE="${1:-patch}"
CURRENT_VERSION=$(get_current_version)

# Parse version parts
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]:-0}"
PATCH="${VERSION_PARTS[2]:-0}"

# Bump version based on type
case "$BUMP_TYPE" in
  patch)
    PATCH=$((PATCH + 1))
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  *)
    echo "Error: Unknown bump type '$BUMP_TYPE'"
    show_help
    exit 1
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Show what will happen and ask for confirmation
echo "Version bump: $CURRENT_VERSION -> $NEW_VERSION"
ask_confirmation "Create git commit and tag?"

# Generate changelog before updating version
generate_changelog "$NEW_VERSION"

# Update package.json
update_version "$NEW_VERSION"

echo "Bumped version: $CURRENT_VERSION -> $NEW_VERSION"

# Commit the change
git add "$PACKAGE_JSON"
git add CHANGELOG.md 2> /dev/null || true
git commit -m "chore: bump version to $NEW_VERSION"

# Create git tag
git tag "v$NEW_VERSION"

echo "Created git tag: v$NEW_VERSION"
