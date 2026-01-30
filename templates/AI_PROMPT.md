# AI Agent Prompt: Bootstrap EasyFlow Standards into a New Repository

Use this prompt with an AI agent (Cursor, Claude, Copilot, etc.) that can run shell commands in a development environment.

Prompt (copy-paste):

"You are an automation agent with filesystem and git access. I need you to apply EasyFlow project standards to a target repository. Follow these steps exactly:

1. Inputs you'll receive as environment variables or args:
   - TARGET_PATH: absolute path to the target repository root (e.g., /workspace/my-new-repo)
   - SOURCE_TEMPLATES_PATH: absolute path to the EasyFlow templates folder (containing `pre-push`, `scripts/*`, `observability/*`, `AI_PROMPT.md`, and `README.md`).
   - GITHUB_REPO (optional): owner/repo for branch-protection setup
   - GITHUB_TOKEN (optional): token with repo:admin to apply branch protection

2. Verify `TARGET_PATH` is a git repository and is clean (no uncommitted changes). If not, abort and report the problem.

3. Copy the contents of `SOURCE_TEMPLATES_PATH` into `TARGET_PATH`:
   - Copy `templates/pre-push` → `TARGET_PATH/.husky/pre-push` (create `.husky/` if missing), `chmod +x`.
   - Copy `templates/scripts/*` → `TARGET_PATH/scripts/` (create if missing), `chmod +x` for `.sh` files.
   - Copy `templates/observability/*` → `TARGET_PATH/scripts/observability/`.
   - Copy `templates/README.md` and `templates/AI_PROMPT.md` into `TARGET_PATH/docs/EASYFLOW-ADOPTION.md`.

4. If the target repo doesn't have Husky installed, run `npx husky install` in `TARGET_PATH` and add the hook with `git add .husky/pre-push`.

5. Stage and commit the changes on a new branch `chore/easyflow-standards-YYYYMMDD` (replace date). Commit message: `chore: add EasyFlow standards and templates`.

6. Push the branch and open a PR to `main` (title: `chore: add EasyFlow standards and templates`, body: short summary referencing these changes). If the agent lacks GitHub CLI auth, output the `gh` command for the user to run.

7. If `GITHUB_REPO` and `GITHUB_TOKEN` are provided, optionally call `scripts/setup-branch-protection.sh` in the target repo environment (export the env vars) to apply basic branch protection to `main`. Do not run unless both are provided.

8. Print a clear summary of actions taken and the PR URL (or the `gh pr create` command to run manually).

Constraints: Do not overwrite existing `scripts/` files unless they are empty or the user confirms overwrite. Keep changes minimal and easily revertible. Ask for confirmation before destructive actions."

Use this prompt as-is when launching an AI agent to bootstrap EasyFlow standards into new projects.
