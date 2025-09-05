# DEMO_CHECKLIST.md

This checklist helps reproduce demo scenarios and verify claims shown in marketing material.

## Local setup (macOS)

1. Backend & automation service

   - Open two terminals.

2. Automation service (safe dry-run):

   - In terminal A:
     cd rpa-system/automation
     export AUTOMATION_API_KEY="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
     export DRY_RUN=1
     python automate.py
   - Expected: service listens on port (7001 by default) and returns DRY_RUN responses for /run.

3. Backend (if used)

   - In terminal B:
     cd rpa-system
     # start your backend (example)
     npm install
     npm run start

4. Frontend (dashboard)
   - In a new terminal:
     cd rpa-dashboard
     npm install
     npm start
   - Open http://localhost:3000 and navigate to the Task Management page.

## Quick API verification (curl)

- Dry-run call:

```
curl -X POST http://localhost:7001/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
  -d '{"url":"https://example.com","user_id":"demo-user"}'
```

- Expected JSON: {"result":"DRY_RUN: would automate https://example.com"}

## Demo flows to verify features

- Task creation → Automation history:

  1. Create a task in the dashboard with a chosen "type".
  2. Confirm backend log shows the task payload (search for "run-task payload" in automation logs).
  3. Visit Automation History and confirm the new row displays the task type and status.

- File download validation:
  1. Use automation to download a PDF (set DRY_RUN=0 and correct pdf_url).
  2. Confirm file appears in `/downloads/` and passes PDF validation.

## Logs & evidence

- Capture console output showing:
  - `run-task payload: {...}` log entry.
  - Task persisted in DB (or displayed in Automation History).
  - Any validation messages for downloads.
