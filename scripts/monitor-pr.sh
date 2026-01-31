#!/usr/bin/env bash
# Poll a PR until checks complete. If all pass, attempt merge. If any fail, post diagnostics to the PR.

PR_NUMBER=${1:-183}
POLL_INTERVAL=${2:-30}
TIMEOUT=${3:-3600} # seconds
START=$(date +%s)

echo "Monitoring PR #${PR_NUMBER} (poll interval ${POLL_INTERVAL}s, timeout ${TIMEOUT}s)"

while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW-START))
  if [ $ELAPSED -gt $TIMEOUT ]; then
    echo "Timeout reached after ${ELAPSED}s"
    gh pr comment $PR_NUMBER --body "CI monitor: timed out after ${ELAPSED}s waiting for checks."
    exit 2
  fi

  # Get merge state and check status
  STATE_JSON=$(gh pr view $PR_NUMBER --json mergeStateStatus,mergeable,headRefName,number,state --jq '.')
  MERGE_STATE=$(echo "$STATE_JSON" | jq -r '.mergeStateStatus')
  MERGEABLE=$(echo "$STATE_JSON" | jq -r '.mergeable')
  PR_STATE=$(echo "$STATE_JSON" | jq -r '.state')

  echo "PR state: ${PR_STATE}, mergeStateStatus: ${MERGE_STATE}, mergeable: ${MERGEABLE}"

  # Inspect check runs for the PR's head commit
  HEAD_SHA=$(gh pr view $PR_NUMBER --json headRefName --jq '.headRefName' | xargs -I{} gh rev-parse origin/{} 2>/dev/null || true)
  if [ -z "$HEAD_SHA" ]; then
    # fallback: get headRefName's latest commit via GitHub API
    HEAD_SHA=$(gh pr view $PR_NUMBER --json headRefOid --jq '.headRefOid')
  fi

  if [ -z "$HEAD_SHA" ]; then
    echo "Unable to determine head SHA; sleeping..."
    sleep $POLL_INTERVAL
    continue
  fi

  CHECKS=$(gh api repos/:owner/:repo/commits/$HEAD_SHA/check-runs -q '.check_runs[] | {name: .name, conclusion: .conclusion, status: .status, details_url: .details_url}' || true)

  # Determine if checks are still in progress
  INPROGRESS=$(echo "$CHECKS" | jq -r 'select(.status=="in_progress" or .status=="queued")' || true)
  FAILED=$(echo "$CHECKS" | jq -r 'select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out")' || true)
  PASSED=$(echo "$CHECKS" | jq -r 'select(.conclusion=="success")' || true)

  if [ -n "$INPROGRESS" ]; then
    echo "Checks still running..."
    sleep $POLL_INTERVAL
    continue
  fi

  # No checks in progress — evaluate results
  if [ -z "$FAILED" ] && [ -n "$PASSED" ]; then
    echo "All checks passed (or at least some succeeded and none reported failure). Attempting merge..."
    gh pr merge $PR_NUMBER --merge || {
      echo "Merge attempt failed; posting comment"
      gh pr comment $PR_NUMBER --body "CI monitor: checks passed but merge failed. Please check branch protections or merge manually."
      exit 1
    }
    echo "PR merged successfully."
    gh pr comment $PR_NUMBER --body "CI monitor: checks passed and PR merged." || true
    exit 0
  fi

  if [ -n "$FAILED" ]; then
    echo "Some checks failed. Gathering diagnostics..."
    # List failing check names and details URLs
    DETAILS=$(echo "$CHECKS" | jq -r 'select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out") | "- "+.name+": "+(.details_url // "(no details url)")')
    SUMMARY="CI monitor detected failing checks for PR #${PR_NUMBER} on commit ${HEAD_SHA}:\n${DETAILS}\n\nCommands to reproduce locally:\n- Pull the branch: git fetch origin && git checkout ${PR_STATE:-$(gh pr view $PR_NUMBER --json headRefName --jq '.headRefName')}\n- Run the CI steps locally (see workflow file in .github/workflows)\n"
    echo "$SUMMARY"
    gh pr comment $PR_NUMBER --body "$SUMMARY"
    # Also create an issue to track the CI failure for visibility
    gh issue create --title "CI failure: PR #${PR_NUMBER} checks failing" --body "$SUMMARY" || true
    exit 3
  fi

  echo "Unknown check state; sleeping..."
  sleep $POLL_INTERVAL
done
