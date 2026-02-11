# Remediation Checklist — Cyclomatic Complexity

Priority order, estimated hours, and suggested actions to reduce complexity and improve maintainability.

- **P0 — Critical (Break into small helpers, add tests)**
  - `rpa-system/automation/automation-service/generic_scraper.py::_scrape_web_page_impl` — 16–24h
    - Extract helpers (parsing, structured extraction, selectors), add unit tests for parsing helpers, add integration test with a recorded HTML fixture.
  - `rpa-system/automation/automation-service/web_automation.py::download_pdf` — 12–18h
    - Split networking, validation, storage; add streaming and proper error mapping.
  - `rpa-system/automation/automation-service/production_automation_service.py::process_automation_task` — 14–24h
    - Separate orchestration from business logic; move Kafka handling into a thin adapter; add unit tests for each branch.

- **P1 — High (Refactor & tests)**
  - `scripts/notion-integrations/comprehensive-github-sync.py` — 10–16h
  - `scripts/notion-integrations/gmail-to-notion-sync.py` — 12–18h
  - `scripts/notion-integrations/google-drive-to-notion-sync.py` — 10–16h

- **P2 — Medium (Refactor for clarity)**
  - `easyflow-metrics/customer_feedback_extractor.py` — 8–12h
  - `easyflow-metrics/activation_funnel_tracker.py` — 8–12h
  - `easyflow-metrics/metrics_playbook.py` — 8–12h

- **P3 — Low (Triage and small cleanups)**
  - Various `scripts/*` and `easyflow-metrics/*` files flagged with C-level complexity — 2–6h each for minor refactors and tests.

Notes
- Estimates assume a single engineer familiar with the codebase and tests available. Include additional review and CI time (~20%).
- Start with P0 items — they are the main drivers of the Rockefeller Efficiency and Focus scores.
- Add the `complexity-check.yml` GitHub Action (added) to enforce thresholds moving forward.
