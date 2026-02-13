#!/usr/bin/env bash
# Lightweight check for Rockefeller principles artifacts
set -euo pipefail
missing=()
check() { [[ -e "$1" ]] || missing+=("$1"); }

check docs/WORKFLOW.md
check ROCKEFELLER_COMPLIANCE_PROGRESS.md
check easyflow-metrics/experiments.json
check easyflow-metrics/activation_funnel_tracker.py

echo "[easyflow] verifying Rockefeller artifacts"

if [ ${#missing[@]} -eq 0 ]; then
  echo "OK: Rockefeller artifacts present"
  exit 0
else
  echo "MISSING Rockefeller artifacts:" >&2
  for f in "${missing[@]}"; do echo " - $f" >&2; done
  echo "See templates/rockefeller/README.md for remediation steps" >&2
  exit 2
fi
