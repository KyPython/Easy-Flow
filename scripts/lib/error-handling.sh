#!/bin/bash
# Error handling utilities for DevOps Productivity Suite
# Standardized error codes and logging across all tools

# Exit codes
EXIT_SUCCESS=0
EXIT_FAILURE=1
EXIT_PARTIAL=2
EXIT_CONFIG_ERROR=3
EXIT_USAGE_ERROR=4

# Detect CI environment
if [ "$CI" = "true" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$GITLAB_CI" ] || [ -n "$CIRCLECI" ]; then
  CI_MODE=true
  export NO_COLOR=1
else
  CI_MODE=false
fi

# Get tool name from script path or environment
TOOL_NAME="${TOOL_NAME:-$(basename "${BASH_SOURCE[1]}" .sh)}"

# Logging functions
log_error() {
  local message="$1"
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%d %H:%M:%S")
  echo "[$TOOL_NAME] [ERROR] [$timestamp] $message" >&2
}

log_warn() {
  local message="$1"
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%d %H:%M:%S")
  if [ "$QUIET" != "true" ]; then
    echo "[$TOOL_NAME] [WARN] [$timestamp] $message" >&2
  fi
}

log_info() {
  local message="$1"
  if [ "$QUIET" != "true" ]; then
    echo "[$TOOL_NAME] [INFO] $message"
  fi
}

log_debug() {
  local message="$1"
  if [ "$VERBOSE" = "true" ] && [ "$QUIET" != "true" ]; then
    echo "[$TOOL_NAME] [DEBUG] $message"
  fi
}

# Usage error
usage_error() {
  local message="$1"
  local usage_text="$2"
  log_error "$message"
  if [ -n "$usage_text" ]; then
    echo "$usage_text" >&2
  fi
  exit $EXIT_USAGE_ERROR
}

# Config error
config_error() {
  local message="$1"
  log_error "$message"
  exit $EXIT_CONFIG_ERROR
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check version (requires version string and minimum version)
check_version() {
  local tool="$1"
  local current_version="$2"
  local min_version="$3"
  
  if [ -z "$current_version" ] || [ -z "$min_version" ]; then
    return 1
  fi
  
  # Simple version comparison (works for semantic versions)
  # This is a basic implementation - may need enhancement for complex cases
  if [ "$(printf '%s\n' "$min_version" "$current_version" | sort -V | head -n1)" = "$min_version" ]; then
    return 0
  else
    return 1
  fi
}

