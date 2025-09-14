# Easy-Flow

## Environment setup and recovery

This repository ignores all `.env*` files by design. If you run a hard reset and clean (e.g., `git reset --hard` + `git clean -fdx`), any untracked `.env*` files will be removed. Keep secrets in a password manager or a secure backup.

### Restore env files

- Backend: copy `rpa-system/backend/.env.example` to `rpa-system/backend/.env` and fill in required values.
- Dashboard: copy `rpa-system/rpa-dashboard/.env.example` to `rpa-system/rpa-dashboard/.env.local` and fill in values, or set runtime values in `rpa-system/rpa-dashboard/public/env.js` without rebuilding.

### Recommended backup

Before destructive git operations:

- Save a tarball of your local env files outside the repo folder.
- Example (zsh):

  # optional: back up .env files

  # tar -czf "$HOME/Easy-Flow.envs.$(date +%Y%m%d-%H%M%S).tgz" \

  # rpa-system/backend/.env \

  # rpa-system/rpa-dashboard/.env.local \

  # rpa-system/rpa-dashboard/public/env.js

### Runtime config for dashboard

- `public/env.js` is loaded by the dashboard at runtime and can provide keys like `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, Firebase keys, and `ENABLE_ANALYTICS`.
- This lets you deploy the same build to multiple environments by swapping `env.js`.

## Notes

- Do not commit actual secrets. Only commit `*.example` templates.
- If you need help reconstructing envs from a deployed environment (e.g., Supabase, Firebase), consult those providers' dashboards.
