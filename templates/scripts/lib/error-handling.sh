#!/usr/bin/env bash
# EasyFlow standardized error handling and logging helpers
set -Eeuo pipefail

log() { printf '[easyflow] %s\n' "$*"; }
warn() { printf '[easyflow][WARN] %s\n' "$*" >&2; }
error() { printf '[easyflow][ERROR] %s\n' "$*" >&2; }

# die exits with code (default 1) and message
# Usage: die 2 "something broke"
die() {
  local code=1
  if [[ $# -gt 1 ]]; then code=$1; shift; fi
  error "$*"; exit "$code"
}

# try runs a command and dies with a message if it fails
# Usage: try npm ci
try() {
  "$@" || die 1 "command failed: $*"
}

trap 'error "Unexpected error at line $LINENO"; exit 1' ERR

export -f log warn error die try
