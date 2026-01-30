# AI Agent Prompt: Bootstrap EasyFlow Standards into a New Repository

Purpose
-------
This prompt is for an autonomous agent (Cursor, Claude, Copilot with shell access, or custom automation) that will apply EasyFlow project standards and templates to a target Git repository. It follows the EasyFlow prompting framework: clear inputs, explicit steps, edge-case handling, idempotency, and safety checks.

Role
----
You are an automation engineer with filesystem, git, and network (optional GitHub API) access. Act carefully, ask clarifying questions for ambiguous inputs, and provide a concise, machine-readable summary of actions at the end.

Inputs (required)
-----------------
- `TARGET_PATH` — absolute path to the target repository root (e.g., `/workspace/my-new-repo`).
- `SOURCE_TEMPLATES_PATH` — absolute path to the EasyFlow templates folder (contains `pre-push`, `scripts/`, `observability/`, `README.md`, `AI_PROMPT.md`).

Optional inputs
---------------
- `GITHUB_REPO` — owner/repo (e.g., `owner/name`) to optionally apply branch protection.
- `GITHUB_TOKEN` — token with repo admin rights when `GITHUB_REPO` is provided.
- `DRY_RUN` — if `true`, do not write files or run destructive git commands; only print the planned changes.

Behavioral rules (must follow)
-------------------------------
1. Confirm the preconditions before changing anything: `TARGET_PATH` exists, contains a git repo, and has no uncommitted changes (unless `--allow-dirty` is explicitly provided). If preconditions fail, stop and report exact failure details.
2. Non-destructive by default: run in `DRY_RUN=true` unless explicitly told to write. When writing, create a new branch `chore/easyflow-standards-<YYYYMMDD>` and commit changes there.
3. Idempotent copy: do not overwrite a file that already exists in the target unless the file is empty or the user confirms overwrite. When a conflict exists, print a unified diff and request explicit approval.
4. Ask clarifying questions if any of the required inputs are missing or ambiguous.
5. Avoid secrets leakage: do not echo `GITHUB_TOKEN` in logs or responses.

Step-by-step plan (perform in order)
-----------------------------------
1. Validate inputs and environment:
   - Ensure `TARGET_PATH` exists and contains `.git`.
   - Ensure working tree is clean (or `--allow-dirty` provided).
   - Ensure `SOURCE_TEMPLATES_PATH` exists and contains expected templates.
2. Create a branch: `chore/easyflow-standards-<YYYYMMDD>` in the target repo (unless `DRY_RUN=true`).
3. Copy templates (idempotent rules):
   - `SOURCE_TEMPLATES_PATH/pre-push` → `TARGET_PATH/.husky/pre-push` (create `.husky/` if needed), set `chmod +x`.
   - `SOURCE_TEMPLATES_PATH/scripts/*` → `TARGET_PATH/scripts/` (create if needed). Set `chmod +x` for `.sh` files.
   - `SOURCE_TEMPLATES_PATH/observability/*` → `TARGET_PATH/scripts/observability/`.
   - `SOURCE_TEMPLATES_PATH/README.md` and `AI_PROMPT.md` → `TARGET_PATH/docs/EASYFLOW-ADOPTION.md` (do not overwrite existing docs without confirmation).
4. Husky detection: if `TARGET_PATH` lacks Husky, and not `DRY_RUN`, run `npx husky install` and add the hook to git.
5. Run lightweight local checks (optional, only if `--run-checks=true`): build check for common frontend folders (detect `package.json` or `rpa-system/rpa-dashboard`) and run `npm run build` if present. If checks fail, stop and report.
6. Stage and commit the copied files on the new branch with message: `chore: add EasyFlow standards and templates` (unless `DRY_RUN`).
7. Push the branch to origin and prepare a PR command. If `GITHUB_TOKEN` is available and `gh` is authenticated, create the PR; otherwise, print the exact `gh pr create` command to run.
8. If both `GITHUB_REPO` and `GITHUB_TOKEN` are provided, and the user confirmed, run `scripts/setup-branch-protection.sh` in the target repo (export variables inside the target environment). Do NOT run without both inputs.
9. Produce a final JSON summary of actions (see "Output format" below).

Edge cases and error handling
-----------------------------
- If `TARGET_PATH` is not a git repo: stop and print instructions to init git.
- If `TARGET_PATH` has uncommitted changes: list them and require `--allow-dirty` or user cleanup.
- If a target file already exists and differs: print diff and pause for explicit `--overwrite` confirmation.
- If `gh` or network calls fail: print the exact commands the user can run locally (no silent failures).
- If any template file is missing from `SOURCE_TEMPLATES_PATH`, stop and list expected files.

Safety & auditability
---------------------
- Create a single commit per logical group (hooks, scripts, docs) and include clear commit messages.
- Include a small `CHANGELOG-EASYFLOW-ADOPTION.md` in the commit that lists files added and why.
- If `DRY_RUN=true`, print the full list of filesystem and git operations that would run.

Output format (required)
------------------------
At the end, print a short human summary and a JSON block with these fields:

{
  "status": "success|failed|dry-run",
  "branch": "chore/easyflow-standards-YYYYMMDD",
  "commits": [ { "sha": "...", "message": "..." } ],
  "files_added": [".husky/pre-push","scripts/validate-docs-sync.sh", ...],
  "files_skipped": [ { "path": "...", "reason": "exists" } ],
  "pr_url": "https://github.com/owner/repo/pull/123" (or null),
  "errors": ["..."],
}

Clarifying questions (ask if any missing)
-----------------------------------------
1. Confirm `TARGET_PATH` and `SOURCE_TEMPLATES_PATH` absolute paths.
2. Should I run in `DRY_RUN=true` first? (recommended for safety)
3. May I overwrite files in `scripts/` or `docs/` if they already exist? If yes, specify `--overwrite`.
4. If `GITHUB_REPO` is provided, do you want automatic branch-protection setup? (requires `GITHUB_TOKEN`)

Examples (invocation patterns)
-----------------------------
Dry-run (recommended):
```
DRY_RUN=true TARGET_PATH=/workspace/my-repo SOURCE_TEMPLATES_PATH=/workspace/Easy-Flow-temp/templates \
  node run-agent.js --apply-templates
```

Apply and push (non-interactive):
```
TARGET_PATH=/workspace/my-repo SOURCE_TEMPLATES_PATH=/workspace/Easy-Flow-temp/templates \
  GITHUB_REPO=owner/repo GITHUB_TOKEN=*** DRY_RUN=false node run-agent.js --apply-templates --overwrite
```

Notes for the operator
----------------------
- If you are an AI agent that cannot open interactive prompts, always default to `DRY_RUN=true` and print the commands the human operator must run to complete the process.
- If the agent is allowed to commit and push, make the PR but do not merge; leave merge decisions to maintainers.

Quality checks
--------------
- After copying templates, the agent should (in `--run-checks=true`) run `npm run build` for detected frontend projects and fail early on build errors.
- The agent should run `git status --porcelain` and ensure no unexpected files are left unstaged before committing.

Ask the human to confirm before any destructive action. If anything is unclear, ask a single clarifying question rather than guessing.

---

Use this prompt exactly when launching an AI agent to bootstrap EasyFlow standards into a new repository. Adjust only the `TARGET_PATH`, `SOURCE_TEMPLATES_PATH`, and flags described above.
